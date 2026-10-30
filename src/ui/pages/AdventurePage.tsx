import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ADVENTURE_BALANCE,
  adventureSkills,
  canUseSkill,
  performPlayerAction,
  pickAdventureEnemy,
  startAdventureBattle,
  type AdventureAction,
  type AdventureBattle,
  type AdventureSkillId,
} from "../../features/adventure";
import type { CompanionSprite } from "../../features/companion/domain/companionSprites";
import { towerThemes } from "../../features/tower";
import { themedMonsters } from "../../game/monsters/themedMonsters";
import { SpriteAnimation } from "../SpriteAnimation";
import { LeiyuLightning, LuoyingPetals, XinyueCrescent } from "./AdventureEffects";
import { castLength, castTimeAt, skillCasts, type HeroPlacement } from "./adventureCasts";

interface FloatingNumber {
  readonly id: number;
  readonly side: "enemy" | "hero";
  readonly text: string;
  readonly tone: "normal" | "crit" | "status";
}

/** One pause per step of a turn, so a basic strike and the reply can be read apart. */
const HIT_GAP_MS = 170;
const ENEMY_REPLY_GAP_MS = 420;

const placementStyle = (placement: HeroPlacement): CSSProperties => ({ width: `${placement.width}%`, left: `${placement.left}%`, bottom: `${placement.bottom}%` });

const monsterSprite = (themeId: string): CompanionSprite | null => {
  const monster = themedMonsters[themeId];
  if (!monster) return null;
  return {
    sheet: monster.sheetPath,
    poster: monster.sheetPath,
    cols: 4,
    cellWidth: 512,
    cellHeight: 512,
    // frameRate is frames per second (Phaser's convention), so each frame holds 1000 / frameRate ms.
    steps: Array.from({ length: monster.frames }, (_, cell) => ({ cell, holdMs: 1000 / monster.frameRate })),
    blendMs: 0,
  };
};

const percent = (value: number, max: number): string => `${Math.max(0, Math.min(100, (value / max) * 100))}%`;

interface AdventurePageProps {
  readonly navigation: JSX.Element;
  readonly characterName: string;
  /** Final attack and critical chance of the equipped sword. */
  readonly attack: number;
  readonly critRate: number;
  readonly highestClearedStage: number;
}

/**
 * 遊歷: a turn-based fight seen from a slant, the enemy up-left and the hero
 * down-right, on the tower background of the enemy's theme. The hero picks
 * the basic strike or a skill from the menu on the right; the enemy answers.
 * The rules live in features/adventure; this page plays the result back one
 * hit at a time.
 */
export function AdventurePage({ navigation, characterName, attack, critRate, highestClearedStage }: AdventurePageProps): JSX.Element {
  const newBattle = (): AdventureBattle => startAdventureBattle({ attack, critRate }, pickAdventureEnemy(highestClearedStage, Math.random));
  const [battle, setBattle] = useState<AdventureBattle>(newBattle);
  /** What the screen shows while a turn plays back; equals `battle` when idle. */
  const [shown, setShown] = useState<AdventureBattle>(battle);
  const [busy, setBusy] = useState(false);
  const [floats, setFloats] = useState<readonly FloatingNumber[]>([]);
  /** The skill being cast, keyed so a new cast replays its animation from the start. */
  const [casting, setCasting] = useState<{ readonly key: number; readonly skillId: AdventureSkillId } | null>(null);
  /** The skill effect playing on the enemy. */
  const [effect, setEffect] = useState<{ readonly key: number; readonly skillId: AdventureSkillId } | null>(null);
  const [enemyHurt, setEnemyHurt] = useState(0);
  const [heroHurt, setHeroHurt] = useState(0);
  const [menu, setMenu] = useState<"main" | "skills">("main");
  /** The hero stands in the ready stance of the skill he cast last, so the next cast of it starts in place. */
  const [stanceSkill, setStanceSkill] = useState<AdventureSkillId>(adventureSkills[0].id);
  const stanceCast = skillCasts[stanceSkill];
  /** Seconds left to choose this turn; null while a turn plays out or the fight is over. */
  const [secondsLeft, setSecondsLeft] = useState<number | null>(ADVENTURE_BALANCE.turnSeconds);
  const timers = useRef<number[]>([]);
  const nextId = useRef(0);
  const reducedMotion = useMemo(() => typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false), []);
  const enemySprite = useMemo(() => monsterSprite(battle.enemy.themeId), [battle.enemy.themeId]);

  const later = (delay: number, work: () => void): void => { timers.current.push(window.setTimeout(work, delay)); };
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);
  // Warm every cast animation so the hero does not blink out while a sheet loads.
  useEffect(() => { Object.values(skillCasts).forEach(cast => { new Image().src = cast.sprite.sheet; }); }, []);

  const float = (side: FloatingNumber["side"], text: string, tone: FloatingNumber["tone"]): void => {
    const id = nextId.current++;
    setFloats(current => [...current, { id, side, text, tone }]);
    later(1000, () => setFloats(current => current.filter(entry => entry.id !== id)));
  };

  const act = (action: AdventureAction): void => {
    if (busy || battle.status !== "playerTurn") return;
    const next = performPlayerAction(battle, action, Math.random);
    if (next === battle) return;
    setMenu("main");
    setBusy(true);
    const heroHits = next.events.filter(event => event.kind === "hero-hit");
    const enemyHit = next.events.find(event => event.kind === "enemy-hit");
    const paralyzed = next.events.some(event => event.kind === "enemy-paralyzed");
    const cast = action.kind === "skill" && !reducedMotion ? skillCasts[action.skillId] : null;
    // When each hit lands: on its frame of the cast, or one after another for a basic strike.
    const hitTimes = heroHits.map((_, index) => {
      if (!cast) return index * HIT_GAP_MS;
      const frames = cast.hitFrames;
      const frame = frames[index] ?? frames[frames.length - 1] + (index - frames.length + 1) * 2;
      return castTimeAt(cast, frame);
    });

    if (action.kind === "skill" && cast) {
      const key = nextId.current++;
      setCasting({ key, skillId: action.skillId });
      later(castTimeAt(cast, cast.effectFrame), () => setEffect({ key, skillId: action.skillId }));
    }
    heroHits.forEach((event, index) => {
      if (event.kind !== "hero-hit") return;
      later(hitTimes[index], () => { float("enemy", event.damage.toLocaleString("zh-TW"), event.critical ? "crit" : "normal"); setEnemyHurt(count => count + 1); });
    });
    let clock = (hitTimes[hitTimes.length - 1] ?? 0) + HIT_GAP_MS;
    // The enemy's HP and the hero's spirit power settle once the hero's hits have landed.
    later(clock, () => setShown({ ...battle, hero: { ...next.hero, hp: battle.hero.hp }, enemy: next.enemy, log: next.log.slice(0, battle.log.length + 1) }));
    clock += ENEMY_REPLY_GAP_MS;
    if (paralyzed) {
      later(clock, () => { float("enemy", "麻痺", "status"); setShown(next); });
      clock += HIT_GAP_MS * 2;
    } else if (enemyHit?.kind === "enemy-hit") {
      const damage = enemyHit.damage;
      later(clock, () => { float("hero", damage.toLocaleString("zh-TW"), "normal"); setHeroHurt(count => count + 1); setShown(next); });
      clock += HIT_GAP_MS * 2;
    }
    // A cast holds the turn until its animation has played out.
    later(cast ? Math.max(clock, castLength(cast)) : clock, () => {
      setShown(next); setBattle(next); setBusy(false); setCasting(null); setEffect(null);
      if (action.kind === "skill") setStanceSkill(action.skillId);
    });
  };

  // Each turn the hero has 30 seconds to choose; the clock restarts whenever it is his turn again.
  const choosing = !busy && battle.status === "playerTurn";
  useEffect(() => {
    if (!choosing) { setSecondsLeft(null); return undefined; }
    const deadline = Date.now() + ADVENTURE_BALANCE.turnSeconds * 1000;
    setSecondsLeft(ADVENTURE_BALANCE.turnSeconds);
    const timer = window.setInterval(() => setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 200);
    return () => window.clearInterval(timer);
  }, [choosing, battle.turn]);
  // Time ran out before a choice: the chance passes and the enemy strikes.
  useEffect(() => { if (choosing && secondsLeft === 0) act({ kind: "timeout" }); });

  const restart = (): void => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    const fresh = newBattle();
    setBattle(fresh);
    setShown(fresh);
    setBusy(false);
    setFloats([]);
    setCasting(null);
    setEffect(null);
    setMenu("main");
  };

  const finished = battle.status !== "playerTurn" && !busy;
  const view = shown;
  const theme = towerThemes.find(entry => entry.id === battle.enemy.themeId) ?? towerThemes[0];
  const canAct = !busy && battle.status === "playerTurn";
  const castNow = casting ? skillCasts[casting.skillId] : null;
  const stance = { image: stanceCast.sprite.poster, placement: stanceCast.placement };
  const effectCast = effect ? skillCasts[effect.skillId] : null;
  const stageStyle = {
    "--adv-bg": theme.background ? `url("${theme.background}")` : "none",
    "--adv-saturate": theme.saturate,
    "--adv-brightness": theme.brightness,
    "--adv-tint": theme.tint,
  } as CSSProperties;
  return (
    <main className="weapon-library adventure-page" aria-label="遊歷">
      {navigation}
      <section className="adventure-stage" style={stageStyle} aria-label="遊歷戰鬥">
        <div className="adventure-stage__bg" />
        <div className="adventure-stage__ring" />
        <div className="adventure-place">{theme.nameZh}・第 {view.turn} 回合</div>
        {secondsLeft !== null && (
          <div className={secondsLeft <= 5 ? "adventure-countdown is-urgent" : "adventure-countdown"} role="timer" aria-label={`剩餘 ${secondsLeft} 秒選擇招式`}>{secondsLeft}</div>
        )}

        <div className="adventure-unit adventure-unit--enemy">
          <div className="adventure-tag">
            <span>{view.enemy.nameZh}</span>
            <Bar label="氣血" tone="enemy" value={view.enemy.hp} max={view.enemy.maxHp} compact />
          </div>
          <div className={`adventure-figure${enemyHurt ? " is-hurt" : ""}${view.status === "victory" ? " is-defeated" : ""}`} key={`enemy-${enemyHurt}`}>
            {enemySprite ? <SpriteAnimation sprite={enemySprite} className="adventure-enemy" label={view.enemy.nameZh} /> : <span className="adventure-enemy-fallback">{view.enemy.nameZh}</span>}
            {effect && effectCast?.effect === "petals" && <LuoyingPetals key={effect.key} />}
            {effect && effectCast?.effect === "lightning" && (
              <LeiyuLightning
                key={effect.key}
                pillarDelays={effectCast.hitFrames.slice(0, 4).map(frame => castTimeAt(effectCast, frame) - castTimeAt(effectCast, effectCast.effectFrame))}
                boltDelay={castTimeAt(effectCast, effectCast.hitFrames[4] ?? effectCast.effectFrame) - castTimeAt(effectCast, effectCast.effectFrame)}
              />
            )}
            {effect && effectCast?.effect === "crescent" && (
              <XinyueCrescent
                key={effect.key}
                slashDelay={castTimeAt(effectCast, effectCast.hitFrames[0] ?? effectCast.effectFrame) - castTimeAt(effectCast, effectCast.effectFrame)}
                starDelays={effectCast.hitFrames.slice(1).map(frame => castTimeAt(effectCast, frame) - castTimeAt(effectCast, effectCast.effectFrame))}
              />
            )}
            {floats.filter(entry => entry.side === "enemy").map(entry => <b key={entry.id} className={`adventure-float${entry.tone === "crit" ? " adventure-float--crit" : entry.tone === "status" ? " adventure-float--status" : ""}`}>{entry.text}</b>)}
          </div>
        </div>

        <div className="adventure-unit adventure-unit--hero">
          <div className="adventure-tag">
            <span>{characterName}</span>
            <Bar label="氣血" tone="hp" value={view.hero.hp} max={view.hero.maxHp} compact />
          </div>
          <div className={`adventure-figure${heroHurt ? " is-hurt" : ""}`} key={`hero-${heroHurt}`}>
            <img className={castNow ? "adventure-hero-stance is-casting" : "adventure-hero-stance"} src={stance.image} style={placementStyle(stance.placement)} alt={`${characterName}持劍應戰`} draggable={false} />
            {casting && castNow && <SpriteAnimation key={casting.key} sprite={castNow.sprite} className="adventure-hero-skill" style={placementStyle(castNow.placement)} />}
            {floats.filter(entry => entry.side === "hero").map(entry => <b key={entry.id} className="adventure-float adventure-float--hero">{entry.text}</b>)}
          </div>
        </div>

        <aside className="adventure-status" aria-label="我方狀態">
          <b>{characterName}</b>
          <Bar label="氣血" tone="hp" value={view.hero.hp} max={view.hero.maxHp} />
          <Bar label="靈力" tone="qi" value={view.hero.qi} max={view.hero.maxQi} />
        </aside>

        <nav className="adventure-menu" aria-label="選擇行動">
          <button type="button" disabled={!canAct} onClick={() => act({ kind: "attack" })}>劍擊</button>
          <button type="button" className={menu === "skills" ? "is-open" : ""} disabled={!canAct} onClick={() => setMenu(menu === "skills" ? "main" : "skills")}>招式</button>
        </nav>
        {menu === "skills" && canAct && (
          <div className="adventure-skills" role="menu" aria-label="招式">
            {adventureSkills.map(skill => (
              <button key={skill.id} type="button" role="menuitem" disabled={!canUseSkill(battle, skill.id)} onClick={() => act({ kind: "skill", skillId: skill.id })}>
                <strong>{skill.nameZh}</strong>
                <span>靈力 {skill.qiCost}・{skill.hitMultipliers.length} 連擊</span>
                <em>{skill.description}</em>
              </button>
            ))}
          </div>
        )}

        {finished && (
          <div className={`adventure-result adventure-result--${battle.status}`} role="status">
            <strong>{battle.status === "victory" ? "旗開得勝" : "力竭落敗"}</strong>
            <button type="button" onClick={restart}>{battle.status === "victory" ? "再遇一隻妖獸" : "重整旗鼓再戰"}</button>
          </div>
        )}
      </section>
    </main>
  );
}

function Bar({ label, tone, value, max, compact = false }: { readonly label: string; readonly tone: "hp" | "qi" | "enemy"; readonly value: number; readonly max: number; readonly compact?: boolean }): JSX.Element {
  return (
    <div className={compact ? "adventure-bar adventure-bar--compact" : "adventure-bar"} role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={Math.round(max)}>
      <span className="adventure-bar__label">{label}</span>
      <i><b className={`adventure-bar__fill adventure-bar__fill--${tone}`} style={{ width: percent(value, max) }} /></i>
      <span className="adventure-bar__value">{Math.round(value).toLocaleString("zh-TW")} / {Math.round(max).toLocaleString("zh-TW")}</span>
    </div>
  );
}
