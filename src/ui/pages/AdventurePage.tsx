import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ADVENTURE_BALANCE,
  OWN_SWORD_BONUS,
  adventureRegions,
  canUseSkill,
  getAdventureEnemy,
  getAdventureSkill,
  isBossStage,
  performPlayerAction,
  startAdventureBattle,
  type AdventureAction,
  type AdventureBattle,
  type AdventureSkillId,
  type AdventureVictory,
  ADVENTURE_STAGES_PER_REGION,
  getExploreMap,
  resolveEquippedSkills,
} from "../../features/adventure";
import { PILL_CATALOG, QUALITY_NAMES } from "../../features/alchemy/Alchemy";
import type { CompanionSprite } from "../../features/companion/domain/companionSprites";
import type { AdventureProgress } from "../../features/adventure";
import { AdventureMap } from "./AdventureMap";
import { ExplorePage } from "./ExplorePage";
import { towerThemes } from "../../features/tower";
import { themedMonsters } from "../../game/monsters/themedMonsters";
import { SpriteAnimation } from "../SpriteAnimation";
import { ChunhuaBlossoms, LeiyuLightning, LuoyingPetals, QianfengPeaks, QinghuiSnow, SwordStrike, TaxueFeathers, XingluoMeteors, XinyueCrescent, YuehuaMoonlight, ZhoutianStars } from "./AdventureEffects";
import { castLength, castTimeAt, skillCasts, type HeroPlacement } from "./adventureCasts";

interface FloatingNumber {
  readonly id: number;
  readonly side: "enemy" | "hero";
  readonly text: string;
  readonly tone: "normal" | "crit" | "status" | "heal" | "poison";
}

/** One pause per step of a turn, so a basic strike and the reply can be read apart. */
const HIT_GAP_MS = 170;
const ENEMY_REPLY_GAP_MS = 420;
/** How long the hero's lunge takes before the first cut of a basic strike lands. */
const STRIKE_LEAD_MS = 200;

/**
 * The hurt flash for the nth hit. It alternates between two identical animations so each hit restarts it
 * without remounting the figure, which would restart a cast animation or skill effect playing inside it.
 */
const hurtClass = (hits: number): string => (hits === 0 ? "" : hits % 2 ? " is-hurt" : " is-hurt is-hurt--again");

const placementStyle = (placement: HeroPlacement): CSSProperties => ({ width: `${placement.width}%`, left: `${placement.left}%`, bottom: `${placement.bottom}%` });

const monsterSprite = (themeId: string): CompanionSprite | null => {
  const monster = themedMonsters[themeId];
  if (!monster) return null;
  return {
    sheet: monster.sheetPath,
    poster: monster.posterPath,
    cols: 4,
    cellWidth: 512,
    cellHeight: 512,
    // frameRate is frames per second (Phaser's convention), so each frame holds 1000 / frameRate ms.
    steps: Array.from({ length: monster.frames }, (_, cell) => ({ cell, holdMs: 1000 / monster.frameRate })),
    blendMs: 0,
  };
};

const percent = (value: number, max: number): string => `${Math.max(0, Math.min(100, (value / max) * 100))}%`;

export interface AdventureFightProps {
  readonly characterName: string;
  /** Final attack and critical chance of the equipped sword. */
  readonly attack: number;
  readonly critRate: number;
  /** The equipped sword: its own skill deals more. */
  readonly weaponId: string;
  readonly regionIndex: number;
  readonly stage: number;
  /** The skills taken into the fight. */
  readonly skills: readonly AdventureSkillId[];
  /** Records the win (once) and returns what it paid. */
  readonly onVictory: () => AdventureVictory;
  readonly onLeave: () => void;
  /** Starts the next stage; null when there is none to go to. */
  readonly onNext: (() => void) | null;
}

/**
 * 遊歷: a turn-based fight seen from a slant, the enemy up-left and the hero
 * down-right, on the tower background of the enemy's theme. The hero picks
 * the basic strike or a skill from the menu on the right; the enemy answers.
 * The rules live in features/adventure; this page plays the result back one
 * hit at a time.
 */
export function AdventureFight({ characterName, attack, critRate, weaponId, regionIndex, stage, skills, onVictory, onLeave, onNext }: AdventureFightProps): JSX.Element {
  const newBattle = (): AdventureBattle => startAdventureBattle({ attack, critRate, weaponId }, getAdventureEnemy(regionIndex, stage));
  const [battle, setBattle] = useState<AdventureBattle>(newBattle);
  /** What the screen shows while a turn plays back; equals `battle` when idle. */
  const [shown, setShown] = useState<AdventureBattle>(battle);
  const [busy, setBusy] = useState(false);
  const [floats, setFloats] = useState<readonly FloatingNumber[]>([]);
  /** The skill being cast, keyed so a new cast replays its animation from the start. */
  const [casting, setCasting] = useState<{ readonly key: number; readonly skillId: AdventureSkillId } | null>(null);
  /** The skill effect playing on the enemy. */
  const [effect, setEffect] = useState<{ readonly key: number; readonly skillId: AdventureSkillId } | null>(null);
  /** The sword qi of a basic strike: one cut per hit, keyed so the next strike replays it. */
  const [strike, setStrike] = useState<{ readonly key: number; readonly slashes: readonly { readonly delay: number; readonly critical: boolean }[] } | null>(null);
  const [enemyHurt, setEnemyHurt] = useState(0);
  const [heroHurt, setHeroHurt] = useState(0);
  const [menu, setMenu] = useState<"main" | "skills">("main");
  /** The hero stands in the ready stance of the skill he cast last, so the next cast of it starts in place. */
  const [stanceSkill, setStanceSkill] = useState<AdventureSkillId>(skills[0] ?? "leiyu");
  /** What the win paid, once it has been recorded. */
  const [victory, setVictory] = useState<AdventureVictory | null>(null);
  const stanceCast = skillCasts[stanceSkill];
  /** Seconds left to choose this turn; null while a turn plays out or the fight is over. */
  const [secondsLeft, setSecondsLeft] = useState<number | null>(ADVENTURE_BALANCE.turnSeconds);
  const timers = useRef<number[]>([]);
  const nextId = useRef(0);
  const reducedMotion = useMemo(() => typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false), []);
  const enemySprite = useMemo(() => monsterSprite(battle.enemy.themeId), [battle.enemy.themeId]);

  const later = (delay: number, work: () => void): void => { timers.current.push(window.setTimeout(work, delay)); };
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);
  // Warm every cast animation and ready stance so the hero does not blink out, or show one stance at another's size, while a picture loads.
  useEffect(() => { Object.values(skillCasts).forEach(cast => { new Image().src = cast.sprite.sheet; new Image().src = cast.sprite.poster; }); }, []);

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
    const reply = next.events.find(event => event.kind === "enemy-hit" || event.kind === "enemy-paralyzed" || event.kind === "enemy-charge" || event.kind === "hero-evade");
    const healed = next.events.find(event => event.kind === "hero-heal");
    const poison = next.events.find(event => event.kind === "poison");
    const cast = action.kind === "skill" && !reducedMotion ? skillCasts[action.skillId] : null;
    // When each hit lands: on its frame of the cast, or one after another for a basic strike.
    const striking = !cast && heroHits.length > 0 && !reducedMotion;
    const hitTimes = heroHits.map((_, index) => {
      if (!cast) return (striking ? STRIKE_LEAD_MS : 0) + index * HIT_GAP_MS;
      const frames = cast.hitFrames;
      const frame = frames[index] ?? frames[frames.length - 1] + (index - frames.length + 1) * 2;
      return castTimeAt(cast, frame);
    });

    // Swap to this skill's ready stance now, while the cast hides it, so it has loaded by the time the cast ends.
    if (action.kind === "skill") setStanceSkill(action.skillId);
    if (action.kind === "skill" && cast) {
      const key = nextId.current++;
      setCasting({ key, skillId: action.skillId });
      later(castTimeAt(cast, cast.effectFrame), () => setEffect({ key, skillId: action.skillId }));
    }
    // A basic strike: the hero lunges and each hit is a cut of sword qi, landing a little before its number.
    if (striking) setStrike({ key: nextId.current++, slashes: heroHits.map((event, index) => ({ delay: Math.max(0, hitTimes[index] - 90), critical: event.kind === "hero-hit" && event.critical })) });
    heroHits.forEach((event, index) => {
      if (event.kind !== "hero-hit") return;
      later(hitTimes[index], () => { float("enemy", event.damage.toLocaleString("zh-TW"), event.critical ? "crit" : "normal"); setEnemyHurt(count => count + 1); });
    });
    let clock = (hitTimes[hitTimes.length - 1] ?? 0) + HIT_GAP_MS;
    const heroAfterHits = healed?.kind === "hero-heal" ? battle.hero.hp + healed.amount : battle.hero.hp;
    // The enemy's HP and the hero's spirit power (and any healing) settle once the hero's hits have landed.
    later(clock, () => {
      if (healed?.kind === "hero-heal") float("hero", `+${healed.amount.toLocaleString("zh-TW")}`, "heal");
      setShown({ ...battle, hero: { ...next.hero, hp: heroAfterHits }, enemy: { ...next.enemy, hp: next.enemy.hp + (poison?.kind === "poison" ? poison.damage : 0) }, log: next.log.slice(0, battle.log.length + 1) });
    });
    clock += ENEMY_REPLY_GAP_MS;
    if (reply) {
      later(clock, () => {
        if (reply.kind === "enemy-paralyzed") float("enemy", "麻痺", "status");
        else if (reply.kind === "enemy-charge") float("enemy", "蓄力", "status");
        else if (reply.kind === "hero-evade") float("hero", "閃避", "status");
        else if (reply.kind === "enemy-hit") {
          float("hero", `${reply.damage.toLocaleString("zh-TW")}${reply.blocked > 0 ? `（擋 ${reply.blocked.toLocaleString("zh-TW")}）` : ""}`, reply.heavy ? "crit" : "normal");
          setHeroHurt(count => count + 1);
        }
        setShown({ ...next, enemy: { ...next.enemy, hp: next.enemy.hp + (poison?.kind === "poison" ? poison.damage : 0) } });
      });
      clock += HIT_GAP_MS * 2;
    }
    if (poison?.kind === "poison") {
      later(clock, () => { float("enemy", poison.damage.toLocaleString("zh-TW"), "poison"); setEnemyHurt(count => count + 1); setShown(next); });
      clock += HIT_GAP_MS * 2;
    }
    // A cast holds the turn until its animation has played out.
    later(cast ? Math.max(clock, castLength(cast)) : clock, () => {
      setShown(next); setBattle(next); setBusy(false); setCasting(null); setEffect(null); setStrike(null);
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

  // Record a win once, as soon as it is decided, so leaving mid-playback still counts it.
  useEffect(() => { if (battle.status === "victory" && !victory) setVictory(onVictory()); }, [battle.status]);

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
    setStrike(null);
    setMenu("main");
    setVictory(null);
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
      <section className="adventure-stage" style={stageStyle} aria-label="遊歷戰鬥">
        <div className="adventure-stage__bg" />
        <div className="adventure-stage__ring" />
        <div className="adventure-place">{adventureRegions[regionIndex].nameZh}・第 {stage} 關{isBossStage(stage) ? "（首領）" : ""}・第 {view.turn} 回合</div>
        <button type="button" className="adventure-leave" onClick={onLeave} disabled={busy}>返回地圖</button>
        {secondsLeft !== null && (
          <div className={secondsLeft <= 5 ? "adventure-countdown is-urgent" : "adventure-countdown"} role="timer" aria-label={`剩餘 ${secondsLeft} 秒選擇招式`}>{secondsLeft}</div>
        )}

        <div className="adventure-unit adventure-unit--enemy">
          <div className="adventure-tag">
            <span>{view.enemy.nameZh}</span>
            <Bar label="氣血" tone="enemy" value={view.enemy.hp} max={view.enemy.maxHp} compact />
          </div>
          <div className={`adventure-figure${hurtClass(enemyHurt)}${view.status === "victory" ? " is-defeated" : ""}`}>
            {enemySprite ? <SpriteAnimation sprite={enemySprite} className="adventure-enemy" label={view.enemy.nameZh} /> : <span className="adventure-enemy-fallback">{view.enemy.nameZh}</span>}
            {strike && <SwordStrike key={strike.key} slashes={strike.slashes} />}
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
            {effect && effectCast?.effect === "moonlight" && (
              <YuehuaMoonlight key={effect.key} waveDelays={effectCast.hitFrames.map(frame => castTimeAt(effectCast, frame) - castTimeAt(effectCast, effectCast.effectFrame))} />
            )}
            {effect && effectCast?.effect === "stars" && (
              <ZhoutianStars key={effect.key} starDelays={effectCast.hitFrames.map(frame => castTimeAt(effectCast, frame) - castTimeAt(effectCast, effectCast.effectFrame))} />
            )}
            {effect && effectCast?.effect === "meteors" && (
              <XingluoMeteors key={effect.key} meteorDelays={effectCast.hitFrames.map(frame => castTimeAt(effectCast, frame) - castTimeAt(effectCast, effectCast.effectFrame))} />
            )}
            {effect && effectCast?.effect === "snow" && (
              <QinghuiSnow
                key={effect.key}
                flakeDelays={effectCast.hitFrames.slice(0, -1).map(frame => castTimeAt(effectCast, frame) - castTimeAt(effectCast, effectCast.effectFrame))}
                moonDelay={castTimeAt(effectCast, effectCast.hitFrames[effectCast.hitFrames.length - 1]) - castTimeAt(effectCast, effectCast.effectFrame)}
              />
            )}
            {effect && effectCast?.effect === "feathers" && (
              <TaxueFeathers
                key={effect.key}
                streakDelays={effectCast.hitFrames.slice(0, -1).map(frame => castTimeAt(effectCast, frame) - castTimeAt(effectCast, effectCast.effectFrame))}
                burstDelay={castTimeAt(effectCast, effectCast.hitFrames[effectCast.hitFrames.length - 1]) - castTimeAt(effectCast, effectCast.effectFrame)}
              />
            )}
            {effect && effectCast?.effect === "peaks" && (
              <QianfengPeaks
                key={effect.key}
                peakDelays={effectCast.hitFrames.slice(0, -1).map(frame => castTimeAt(effectCast, frame) - castTimeAt(effectCast, effectCast.effectFrame))}
                shatterDelay={castTimeAt(effectCast, effectCast.hitFrames[effectCast.hitFrames.length - 1]) - castTimeAt(effectCast, effectCast.effectFrame)}
              />
            )}
            {effect && effectCast?.effect === "blossoms" && (
              <ChunhuaBlossoms
                key={effect.key}
                bloomDelays={effectCast.hitFrames.slice(0, -1).map(frame => castTimeAt(effectCast, frame) - castTimeAt(effectCast, effectCast.effectFrame))}
                waveDelay={castTimeAt(effectCast, effectCast.hitFrames[effectCast.hitFrames.length - 1]) - castTimeAt(effectCast, effectCast.effectFrame) - 250}
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
          <div className={`adventure-figure${hurtClass(heroHurt)}`}>
            <img key={stanceSkill} className={castNow ? "adventure-hero-stance is-casting" : strike ? "adventure-hero-stance is-striking" : "adventure-hero-stance"} src={stance.image} style={placementStyle(stance.placement)} alt={`${characterName}持劍應戰`} draggable={false} />
            {casting && castNow && <SpriteAnimation key={casting.key} sprite={castNow.sprite} className={castNow.glowing ? "adventure-hero-skill is-glowing" : "adventure-hero-skill"} style={placementStyle(castNow.placement)} />}
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
            {skills.map(getAdventureSkill).map(skill => (
              <button key={skill.id} type="button" role="menuitem" disabled={!canUseSkill(battle, skill.id)} onClick={() => act({ kind: "skill", skillId: skill.id })}>
                <strong>{skill.nameZh}<small className="adventure-skill-role">{skill.roleZh}</small>{skill.weaponId === weaponId && <small className="adventure-skill-own">本命劍 +{Math.round(OWN_SWORD_BONUS * 100)}%</small>}</strong>
                <span>靈力 {skill.qiCost}・{skill.hitMultipliers.length} 連擊</span>
                <em>{skill.description}</em>
              </button>
            ))}
          </div>
        )}

        {finished && (
          <div className={`adventure-result adventure-result--${battle.status}`} role="status">
            <strong>{battle.status === "victory" ? (victory?.firstClear ? "首次通關" : "旗開得勝") : "力竭落敗"}</strong>
            {battle.status === "victory" && <RewardLine victory={victory} />}
            <div className="adventure-result__actions">
              {battle.status === "victory" && onNext && <button type="button" onClick={onNext}>下一關</button>}
              <button type="button" onClick={restart}>{battle.status === "victory" ? "再打一次" : "重整旗鼓再戰"}</button>
              <button type="button" onClick={onLeave}>返回地圖</button>
            </div>
          </div>
        )}
      </section>
  );
}

function RewardLine({ victory }: { readonly victory: AdventureVictory | null }): JSX.Element | null {
  if (!victory) return null;
  const reward = victory.reward;
  if (!reward) return <p className="adventure-result__reward">今日重複挑戰的獎勵已領完</p>;
  return (
    <p className="adventure-result__reward">
      靈石 +{reward.spiritStones.toLocaleString("zh-TW")}・妖丹 +{reward.demonCores.toLocaleString("zh-TW")}
      {reward.pill && <>・{QUALITY_NAMES[reward.pill.quality]}{PILL_CATALOG.find(pill => pill.id === reward.pill!.id)?.name} ×1</>}
    </p>
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

interface AdventurePageProps {
  readonly navigation: JSX.Element;
  readonly characterName: string;
  readonly attack: number;
  readonly critRate: number;
  readonly weaponId: string;
  readonly unlockedWeaponIds: readonly string[];
  readonly progress: AdventureProgress;
  readonly onSkillsChange: (skills: readonly AdventureSkillId[]) => void;
  readonly onVictory: (regionIndex: number, stage: number) => AdventureVictory;
}

/**
 * 遊歷: the map (region, stage and the three skills taken along), and the
 * turn-based fight on the stage picked from it.
 */
export function AdventurePage({ navigation, characterName, attack, critRate, weaponId, unlockedWeaponIds, progress, onSkillsChange, onVictory }: AdventurePageProps): JSX.Element {
  const [fight, setFight] = useState<{ readonly key: number; readonly regionIndex: number; readonly stage: number } | null>(null);
  const [skills, setSkills] = useState<readonly AdventureSkillId[]>(() => resolveEquippedSkills(progress.skills, unlockedWeaponIds));
  const nextKey = useRef(0);
  // New swords unlock new skills: refill the empty slots with them.
  useEffect(() => { setSkills(current => resolveEquippedSkills(current, unlockedWeaponIds)); }, [unlockedWeaponIds.join()]);
  const chooseSkills = (next: readonly AdventureSkillId[]): void => { setSkills(next); onSkillsChange(next); };
  const start = (regionIndex: number, stage: number): void => setFight({ key: nextKey.current++, regionIndex, stage });
  /** The region whose map the hero is walking, if any. */
  const [exploring, setExploring] = useState<number | null>(null);
  const exploreMap = exploring === null ? null : getExploreMap(exploring);

  if (exploreMap) {
    return (
      <main className="weapon-library adventure-page" aria-label="遊歷">
        {navigation}
        <ExplorePage map={exploreMap} characterName={characterName} attack={attack} critRate={critRate} weaponId={weaponId} skills={skills} progress={progress} onVictory={onVictory} onLeave={() => setExploring(null)} />
      </main>
    );
  }
  if (!fight) {
    return (
      <main className="weapon-library adventure-page adventure-page--map" aria-label="遊歷">
        {navigation}
        <AdventureMap progress={progress} attack={attack} weaponId={weaponId} unlockedWeaponIds={unlockedWeaponIds} skills={skills} onSkillsChange={chooseSkills} onChallenge={start} onExplore={setExploring} />
      </main>
    );
  }
  const after = fight.stage < ADVENTURE_STAGES_PER_REGION ? { regionIndex: fight.regionIndex, stage: fight.stage + 1 } : fight.regionIndex + 1 < adventureRegions.length ? { regionIndex: fight.regionIndex + 1, stage: 1 } : null;
  return (
    <main className="weapon-library adventure-page" aria-label="遊歷">
      {navigation}
      <AdventureFight
        key={fight.key}
        characterName={characterName}
        attack={attack}
        critRate={critRate}
        weaponId={weaponId}
        regionIndex={fight.regionIndex}
        stage={fight.stage}
        skills={skills}
        onVictory={() => onVictory(fight.regionIndex, fight.stage)}
        onLeave={() => setFight(null)}
        onNext={after ? () => start(after.regionIndex, after.stage) : null}
      />
    </main>
  );
}
