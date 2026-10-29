import { WeaponLoadout } from "./weapons/WeaponLoadout";
import { WeaponCalibrationStore, type WeaponCalibration } from "./weapons/WeaponCalibrationStore";
import type { RealmId } from "../features/cultivation/domain/RealmCatalog";
import type { FinalCombatStats } from "../features/combat";
import type { BeastConfig } from "../features/beast";
import {
  applyTowerDamage,
  DEFAULT_TOWER_BATTLE_SPEED,
  isTowerBattleSpeed,
  type TowerBattleSpeed,
  evaluateTowerChallenge,
  startTowerChallenge,
  type TowerChallengeState,
  type TowerProgress,
} from "../features/tower";

/** Per-device convenience: the last tower speed the player picked. */
const TOWER_SPEED_STORAGE_KEY = "cultivation.towerBattleSpeed";

function loadTowerBattleSpeed(): TowerBattleSpeed {
  try {
    const stored = Number(window.localStorage.getItem(TOWER_SPEED_STORAGE_KEY));
    return isTowerBattleSpeed(stored) ? stored : DEFAULT_TOWER_BATTLE_SPEED;
  } catch {
    return DEFAULT_TOWER_BATTLE_SPEED;
  }
}

interface CalibrationDebugFlags {
  readonly showSockets: boolean;
  readonly showHitbox: boolean;
  readonly playbackRate: number;
}

export type RuntimeCalibration = WeaponCalibration & CalibrationDebugFlags;

/** Shared application state exposed to both the React shell and Phaser scenes. */
export class GameRuntime {
  public readonly weaponLoadout = new WeaponLoadout();
  private readonly calibrationListeners = new Set<() => void>();
  private readonly towerChallengeListeners = new Set<(challenge: TowerChallengeState | null) => void>();
  private readonly towerSpeedListeners = new Set<(speed: TowerBattleSpeed) => void>();
  private towerBattleSpeed = loadTowerBattleSpeed();
  private readonly beastListeners = new Set<(beast: BeastConfig | null) => void>();
  /** The spirit beast fighting beside the hero (出戰), or null before the save is read. */
  private deployedBeast: BeastConfig | null = null;
  /** The deployed beast's realm stage (0 = 凝氣一層); scales its damage. */
  private deployedBeastStage = 0;
  /** Per-sword calibration (offsets and grip/blade overrides), saved in this browser. */
  public readonly weaponCalibrations = new WeaponCalibrationStore();
  /** Calibration-panel debug switches; these apply to every sword and are not saved. */
  private debugFlags: CalibrationDebugFlags = { showSockets: false, showHitbox: false, playbackRate: 1 };
  private combatStats: FinalCombatStats | null = null;
  private towerChallenge: TowerChallengeState | null = null;
  /**
   * Battle clock (ms): advanced only by the Phaser loop's game delta, so a
   * slow device, a throttled tab or a focus-loss slowdown slows the tower
   * timer exactly as much as it slows the attacks.
   */
  private battleTime = Date.now();

  public advanceBattleTime(deltaMs: number): void {
    this.battleTime += Math.max(0, deltaMs);
  }

  public getBattleTime = (): number => this.battleTime;

  public constructor() {
    const notify = () => this.calibrationListeners.forEach(listener => listener());
    this.weaponCalibrations.subscribe(notify);
    // The panel shows the equipped sword's calibration.
    this.weaponLoadout.subscribe(notify);
  }

  /** The equipped sword's calibration plus the panel's debug switches. */
  public get calibration(): RuntimeCalibration {
    return { ...this.weaponCalibrations.get(this.weaponLoadout.getEquipped().weaponId), ...this.debugFlags };
  }

  public getWeaponCalibration(weaponId: string): WeaponCalibration {
    return this.weaponCalibrations.get(weaponId);
  }

  /** Debug switches apply to all swords; everything else is saved for the equipped sword only. */
  public updateCalibration(change: Partial<RuntimeCalibration>): void {
    const { showSockets, showHitbox, playbackRate, ...weaponChange } = change;
    if (showSockets !== undefined || showHitbox !== undefined || playbackRate !== undefined) {
      this.debugFlags = {
        showSockets: showSockets ?? this.debugFlags.showSockets,
        showHitbox: showHitbox ?? this.debugFlags.showHitbox,
        playbackRate: playbackRate ?? this.debugFlags.playbackRate,
      };
    }
    if (Object.keys(weaponChange).length > 0) this.weaponCalibrations.update(this.weaponLoadout.getEquipped().weaponId, weaponChange);
    else this.calibrationListeners.forEach(listener => listener());
  }

  /** Back to the defaults: the equipped sword, or every sword. */
  public resetWeaponCalibration(scope: "equipped" | "all" = "equipped"): void {
    if (scope === "all") this.weaponCalibrations.resetAll();
    else this.weaponCalibrations.reset(this.weaponLoadout.getEquipped().weaponId);
  }

  public subscribeToCalibration(listener: () => void): () => void {
    this.calibrationListeners.add(listener);
    return () => this.calibrationListeners.delete(listener);
  }

  /** React computes domain stats; Phaser only consumes this immutable snapshot. */
  public setCombatStats(stats: FinalCombatStats): void {
    this.combatStats = stats;
  }

  public getCombatStats(): FinalCombatStats | null {
    return this.combatStats;
  }

  public startTowerChallenge(progress: TowerProgress, stageNumber: number, realmId?: RealmId, now = this.battleTime): TowerChallengeState {
    this.towerChallenge = startTowerChallenge(progress, stageNumber, now, realmId);
    this.notifyTowerChallenge();
    return this.towerChallenge;
  }

  public getTowerChallenge(): TowerChallengeState | null {
    return this.towerChallenge;
  }

  public applyTowerDamage(damage: number, now = this.battleTime): TowerChallengeState | null {
    if (!this.towerChallenge) return null;
    this.towerChallenge = applyTowerDamage(this.towerChallenge, damage, now);
    this.notifyTowerChallenge();
    return this.towerChallenge;
  }

  public settleTowerChallenge(now = this.battleTime): TowerChallengeState | null {
    if (!this.towerChallenge) return null;
    const next = evaluateTowerChallenge(this.towerChallenge, now);
    if (next !== this.towerChallenge) {
      this.towerChallenge = next;
      this.notifyTowerChallenge();
    }
    return this.towerChallenge;
  }

  public clearTowerChallenge(): void {
    this.towerChallenge = null;
    this.notifyTowerChallenge();
  }

  public getDeployedBeast = (): BeastConfig | null => this.deployedBeast;

  public getDeployedBeastStage = (): number => this.deployedBeastStage;

  public setDeployedBeast(beast: BeastConfig, stageIndex: number): void {
    this.deployedBeastStage = stageIndex;
    if (beast === this.deployedBeast) return;
    this.deployedBeast = beast;
    this.beastListeners.forEach(listener => listener(beast));
  }

  public subscribeToDeployedBeast(listener: (beast: BeastConfig | null) => void): () => void {
    this.beastListeners.add(listener);
    return () => this.beastListeners.delete(listener);
  }

  public getTowerBattleSpeed = (): TowerBattleSpeed => this.towerBattleSpeed;

  public setTowerBattleSpeed(speed: TowerBattleSpeed): void {
    if (speed === this.towerBattleSpeed) return;
    this.towerBattleSpeed = speed;
    try {
      window.localStorage.setItem(TOWER_SPEED_STORAGE_KEY, String(speed));
    } catch {
      // Storage blocked: the speed still applies for this session.
    }
    this.towerSpeedListeners.forEach(listener => listener(speed));
  }

  public subscribeToTowerBattleSpeed(listener: (speed: TowerBattleSpeed) => void): () => void {
    this.towerSpeedListeners.add(listener);
    return () => this.towerSpeedListeners.delete(listener);
  }

  public subscribeToTowerChallenge(listener: (challenge: TowerChallengeState | null) => void): () => void {
    this.towerChallengeListeners.add(listener);
    return () => this.towerChallengeListeners.delete(listener);
  }

  private notifyTowerChallenge(): void {
    this.towerChallengeListeners.forEach(listener => listener(this.towerChallenge));
  }
}
