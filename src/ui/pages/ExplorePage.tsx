import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import {
  ADVENTURE_STAGES_PER_REGION,
  ENCOUNTER_RADIUS,
  adventureRegions,
  cameraOrigin,
  canChallengeStage,
  exploreMaps,
  getAdventureEnemy,
  getClearedStages,
  getExploreMap,
  getMapObstacles,
  isBlocked,
  isBossStage,
  isRegionOpen,
  moveWithCollision,
  resolveEquippedSkills,
  walkStep,
  type AdventureProgress,
  type AdventureSkillId,
  type AdventureVictory,
  type ExploreMapSpec,
  type ExplorePoint,
  type ExploreProp,
  PROP_SIZES,
} from "../../features/adventure";
import { towerThemes } from "../../features/tower";
import { themedMonsters } from "../../game/monsters/themedMonsters";
import { AdventureFight } from "./AdventurePage";

/** How far the camera sees across, in world units: less on a narrow (portrait) screen. */
const VIEW_WIDTH = 720;
const VIEW_WIDTH_NARROW = 470;
/** World units per second a creature walks while it roams. */
const CREATURE_SPEED = 42;
/** A sealed creature blocks the path like a rock. */
const SEALED_RADIUS = 24;
/** Height of the hero picture, in world units. */
const HERO_HEIGHT = 92;

type Direction = "up" | "down" | "left" | "right";
const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right",
};

interface Creature {
  readonly stage: number;
  position: ExplorePoint;
  target: ExplorePoint;
  /** When it picks somewhere new to wander to. */
  nextTurnAt: number;
  facingLeft: boolean;
}

interface ExploreScreenProps {
  readonly navigation: JSX.Element;
  readonly characterName: string;
  readonly attack: number;
  readonly critRate: number;
  readonly weaponId: string;
  readonly unlockedWeaponIds: readonly string[];
  readonly progress: AdventureProgress;
  readonly onVictory: (regionIndex: number, stage: number) => AdventureVictory;
}

/**
 * The 探索 page: pick a region (those open in 遊歷 that have a map yet), then
 * walk it. The fights take along the skills chosen on the 遊歷 page.
 */
export function ExploreScreen({ navigation, characterName, attack, critRate, weaponId, unlockedWeaponIds, progress, onVictory }: ExploreScreenProps): JSX.Element {
  const [regionIndex, setRegionIndex] = useState<number | null>(null);
  const map = regionIndex === null ? null : getExploreMap(regionIndex);
  const skills = resolveEquippedSkills(progress.skills, unlockedWeaponIds);
  // Fetch the painted maps and their props while the region list is up, so the map opens drawn.
  useEffect(() => {
    exploreMaps.forEach(entry => {
      new Image().src = entry.ground;
      new Set(entry.props.map(prop => prop.kind)).forEach(kind => { new Image().src = `${entry.propFolder}/${kind}.webp`; });
    });
  }, []);
  if (map) {
    return (
      <main className="weapon-library adventure-page" aria-label="探索">
        {navigation}
        <ExplorePage map={map} characterName={characterName} attack={attack} critRate={critRate} weaponId={weaponId} skills={skills} progress={progress} onVictory={onVictory} onLeave={() => setRegionIndex(null)} />
      </main>
    );
  }
  return (
    <main className="weapon-library adventure-page adventure-page--map" aria-label="探索">
      {navigation}
      <section className="explore-lobby" aria-label="選擇探索地區">
        <header>
          <h2>探索</h2>
          <p>親自走進各地，用方向鍵（手機用畫面上的方向鍵）移動，碰到妖獸就開戰；獎勵與遊歷關卡相同。地區隨遊歷進度開放。</p>
        </header>
        <ol className="explore-lobby__regions">
          {adventureRegions.map(region => {
            const open = isRegionOpen(progress, region.index);
            const hasMap = getExploreMap(region.index) !== null;
            const theme = towerThemes.find(entry => entry.id === region.themeId) ?? towerThemes[0];
            return (
              <li key={region.themeId} className={open && hasMap ? "is-ready" : "is-locked"} style={{ backgroundImage: theme.background ? `linear-gradient(rgba(6, 16, 28, 0.35), rgba(6, 16, 28, 0.85)), url("${theme.background}")` : undefined }}>
                <strong>{region.nameZh}</strong>
                <small>{!open ? "未開放（先通過上一區首領）" : hasMap ? `已通關 ${getClearedStages(progress, region.index)} / ${ADVENTURE_STAGES_PER_REGION}` : "地圖繪製中"}</small>
                <button type="button" disabled={!open || !hasMap} onClick={() => setRegionIndex(region.index)}>{open && hasMap ? "進入探索" : "敬請期待"}</button>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}

interface ExplorePageProps {
  readonly map: ExploreMapSpec;
  readonly characterName: string;
  readonly attack: number;
  readonly critRate: number;
  readonly weaponId: string;
  readonly skills: readonly AdventureSkillId[];
  readonly progress: AdventureProgress;
  readonly onVictory: (regionIndex: number, stage: number) => AdventureVictory;
  readonly onLeave: () => void;
}

/**
 * 探索: the hero walks a region's map with the direction keys (or the
 * on-screen pad) and meets its creatures there; walking into one opens that
 * stage's fight, and a creature beaten stays gone for the rest of the visit.
 */
export function ExplorePage({ map, characterName, attack, critRate, weaponId, skills, progress, onVictory, onLeave }: ExplorePageProps): JSX.Element {
  /** Where the hero stands; kept here so a fight does not send him back to the start. */
  const hero = useRef<ExplorePoint>(map.start);
  const [defeated, setDefeated] = useState<ReadonlySet<number>>(new Set());
  const [fight, setFight] = useState<{ readonly key: number; readonly stage: number } | null>(null);
  /** The creature just fought: it cannot start another fight until the hero steps away from it. */
  const grace = useRef<number | null>(null);
  const nextKey = useRef(0);

  if (fight) {
    return (
      <AdventureFight
        key={fight.key}
        characterName={characterName}
        attack={attack}
        critRate={critRate}
        weaponId={weaponId}
        regionIndex={map.regionIndex}
        stage={fight.stage}
        skills={skills}
        onVictory={() => {
          setDefeated(current => new Set(current).add(fight.stage));
          return onVictory(map.regionIndex, fight.stage);
        }}
        onLeave={() => { grace.current = fight.stage; setFight(null); }}
        onNext={null}
      />
    );
  }
  return (
    <ExploreField
      map={map}
      hero={hero}
      grace={grace}
      progress={progress}
      defeated={defeated}
      onEncounter={stage => setFight({ key: nextKey.current++, stage })}
      onLeave={onLeave}
    />
  );
}

interface ExploreFieldProps {
  readonly map: ExploreMapSpec;
  readonly hero: { current: ExplorePoint };
  readonly grace: { current: number | null };
  readonly progress: AdventureProgress;
  readonly defeated: ReadonlySet<number>;
  readonly onEncounter: (stage: number) => void;
  readonly onLeave: () => void;
}

function ExploreField({ map, hero, grace, progress, defeated, onEncounter, onLeave }: ExploreFieldProps): JSX.Element {
  const region = adventureRegions[map.regionIndex];
  const obstacles = useMemo(() => getMapObstacles(map), [map]);
  const stageRef = useRef<HTMLElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const creatureRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const held = useRef<Set<Direction>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number>();
  const cleared = getClearedStages(progress, map.regionIndex);

  const sealed = (stage: number): boolean => !canChallengeStage(progress, map.regionIndex, stage);
  const creatures = useRef<Creature[]>([]);
  if (creatures.current.length === 0) {
    creatures.current = map.spawns.map(spawn => ({ stage: spawn.stage, position: spawn.home, target: spawn.home, nextTurnAt: 0, facingLeft: false }));
  }
  const present = creatures.current.filter(creature => !defeated.has(creature.stage));

  const say = (text: string): void => {
    setNotice(text);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 1800);
  };
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  // Direction keys and WASD; the page must not scroll while the hero walks.
  useEffect(() => {
    const down = (event: KeyboardEvent): void => {
      const direction = KEY_DIRECTIONS[event.key];
      if (!direction || (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(event.target.tagName))) return;
      event.preventDefault();
      held.current.add(direction);
    };
    const up = (event: KeyboardEvent): void => {
      const direction = KEY_DIRECTIONS[event.key];
      if (direction) held.current.delete(direction);
    };
    const release = (): void => held.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", release);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", release); };
  }, []);

  // The game loop: move the hero and the creatures, follow with the camera, and meet whoever he walks into.
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let facingLeft = false;
    let encountered = false;
    const sealedObstacles = present.filter(creature => sealed(creature.stage)).map(creature => ({ kind: "circle" as const, x: creature.position.x, y: creature.position.y - 10, radius: SEALED_RADIUS }));
    const blocking = [...obstacles, ...sealedObstacles];
    const tick = (now: number): void => {
      const seconds = (now - last) / 1000;
      last = now;
      const keys = held.current;
      const direction = { x: (keys.has("right") ? 1 : 0) - (keys.has("left") ? 1 : 0), y: (keys.has("down") ? 1 : 0) - (keys.has("up") ? 1 : 0) };
      const step = walkStep(direction, seconds);
      const walking = step.x !== 0 || step.y !== 0;
      if (walking) hero.current = moveWithCollision(map, blocking, hero.current, step.x, step.y);
      if (direction.x !== 0) facingLeft = direction.x < 0;

      for (const creature of present) {
        if (sealed(creature.stage)) continue;
        const spawn = map.spawns.find(entry => entry.stage === creature.stage)!;
        if (now >= creature.nextTurnAt) {
          const angle = Math.random() * Math.PI * 2;
          const distance = Math.random() * spawn.roam;
          creature.target = { x: spawn.home.x + Math.cos(angle) * distance, y: spawn.home.y + Math.sin(angle) * distance };
          creature.nextTurnAt = now + 1600 + Math.random() * 2400;
        }
        const dx = creature.target.x - creature.position.x;
        const dy = creature.target.y - creature.position.y;
        const gap = Math.hypot(dx, dy);
        if (gap > 2) {
          const move = Math.min(gap, CREATURE_SPEED * Math.min(seconds, 0.05));
          const next = { x: creature.position.x + (dx / gap) * move, y: creature.position.y + (dy / gap) * move };
          if (!isBlocked(map, obstacles, next, 16)) creature.position = next;
          else creature.nextTurnAt = 0;
          if (Math.abs(dx) > 1) creature.facingLeft = dx < 0;
        }
      }

      // Draw: the camera on the world, every figure at its feet and in front of what is behind it.
      const stage = stageRef.current;
      if (stage && worldRef.current) {
        const viewWidth = stage.clientWidth < 600 ? VIEW_WIDTH_NARROW : VIEW_WIDTH;
        const scale = stage.clientWidth / viewWidth;
        const camera = cameraOrigin(map, hero.current, viewWidth, stage.clientHeight / scale);
        worldRef.current.style.transform = `translate(${-camera.x * scale}px, ${-camera.y * scale}px) scale(${scale})`;
      }
      const heroElement = heroRef.current;
      if (heroElement) {
        heroElement.style.left = `${hero.current.x}px`;
        heroElement.style.top = `${hero.current.y}px`;
        heroElement.style.zIndex = `${Math.round(hero.current.y)}`;
        heroElement.classList.toggle("is-walking", walking);
        heroElement.classList.toggle("is-facing-left", facingLeft);
      }
      for (const creature of present) {
        const element = creatureRefs.current[creature.stage];
        if (!element) continue;
        element.style.left = `${creature.position.x}px`;
        element.style.top = `${creature.position.y}px`;
        element.style.zIndex = `${Math.round(creature.position.y)}`;
        element.classList.toggle("is-facing-left", creature.facingLeft);
      }

      // Meeting a creature: a sealed one only says so; the one just fought waits until he has stepped away.
      for (const creature of present) {
        const distance = Math.hypot(creature.position.x - hero.current.x, creature.position.y - hero.current.y);
        if (grace.current === creature.stage) {
          if (distance > ENCOUNTER_RADIUS + 40) grace.current = null;
          continue;
        }
        if (sealed(creature.stage)) {
          if (distance < ENCOUNTER_RADIUS + SEALED_RADIUS && walking) say(`封印未解：先擊敗第 ${creature.stage - 1} 關`);
          continue;
        }
        if (distance < ENCOUNTER_RADIUS && !encountered) {
          encountered = true;
          held.current.clear();
          onEncounter(creature.stage);
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [map, obstacles, defeated, cleared]);

  const press = (direction: Direction) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => { event.currentTarget.setPointerCapture(event.pointerId); held.current.add(direction); },
    onPointerUp: () => held.current.delete(direction),
    onPointerCancel: () => held.current.delete(direction),
    onLostPointerCapture: () => held.current.delete(direction),
  });

  return (
    <section ref={stageRef} className="adventure-stage explore-stage" aria-label={`探索・${region.nameZh}`}>
      <div ref={worldRef} className="explore-world" style={{ width: map.width, height: map.height }}>
        <img className="explore-ground" src={map.ground} alt="" draggable={false} />
        {map.props.map((prop, index) => <PropFigure key={index} prop={prop} folder={map.propFolder} />)}
        {present.map(creature => {
          const enemy = getAdventureEnemy(map.regionIndex, creature.stage);
          const boss = isBossStage(creature.stage);
          const picture = themedMonsters[boss ? `${region.themeId}-boss` : region.themeId] ?? themedMonsters[region.themeId];
          const isSealed = sealed(creature.stage);
          return (
            <div
              key={creature.stage}
              ref={element => { creatureRefs.current[creature.stage] = element; }}
              className={["explore-creature", boss ? "is-boss" : "", isSealed ? "is-sealed" : "", creature.stage <= cleared ? "is-cleared" : ""].filter(Boolean).join(" ")}
              style={{ left: creature.position.x, top: creature.position.y }}
            >
              <span className="explore-creature__tag">{isSealed ? "封印" : `第 ${creature.stage} 關`}・{enemy.nameZh}</span>
              {picture && <img src={picture.posterPath} alt={enemy.nameZh} draggable={false} />}
              <i className="explore-shadow" />
            </div>
          );
        })}
        <div ref={heroRef} className="explore-hero" style={{ left: hero.current.x, top: hero.current.y, "--hero-height": `${HERO_HEIGHT}px` } as CSSProperties}>
          <img src="/assets/player/cultivator-chibi.webp" alt="主角" draggable={false} />
          <i className="explore-shadow" />
        </div>
      </div>
      <div className="explore-mist" aria-hidden="true" />

      <div className="adventure-place">{region.nameZh}・探索</div>
      <button type="button" className="adventure-leave" onClick={onLeave}>返回地區</button>
      <p className="explore-hint">方向鍵或 WASD 移動・碰到妖獸即開戰</p>
      {notice && <p className="explore-notice" role="status">{notice}</p>}

      <div className="explore-pad" aria-label="移動方向">
        <button type="button" className="explore-pad__up" aria-label="上" {...press("up")}>▲</button>
        <button type="button" className="explore-pad__left" aria-label="左" {...press("left")}>◀</button>
        <button type="button" className="explore-pad__right" aria-label="右" {...press("right")}>▶</button>
        <button type="button" className="explore-pad__down" aria-label="下" {...press("down")}>▼</button>
      </div>
    </section>
  );
}

function PropFigure({ prop, folder }: { readonly prop: ExploreProp; readonly folder: string }): JSX.Element {
  return (
    <img
      className={prop.flip ? "explore-prop is-flipped" : "explore-prop"}
      src={`${folder}/${prop.kind}.webp`}
      alt=""
      draggable={false}
      style={{ left: prop.x, top: prop.y, width: PROP_SIZES[prop.kind].width * prop.scale, zIndex: Math.round(prop.y) } as CSSProperties}
    />
  );
}
