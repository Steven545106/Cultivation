import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import {
  cultivationService,
  normalizeCultivationState,
  type PlayerCultivationState,
} from "../cultivation/RealTimeCultivationService";
import { getDefaultWeapon, getWeaponById, weaponCatalog } from "../../features/weapon/domain/WeaponCatalog";
import { settleWeaponUnlocks } from "../../features/weapon/domain/WeaponUnlockInheritance";
import { isWeaponUnlocked } from "../../features/weapon/domain/WeaponUnlockRules";
import { getRefinementCost, normalizeRefinementLevel, planRefinement } from "../../features/refinement/domain/RefinementRules";
import {
  normalizeSpiritStoneRewardState,
  settleSpiritStoneRewards,
  type SpiritStoneRewardState,
} from "../../features/cultivation/domain/SpiritStoneRewards";
import {
  completeTowerStage as resolveTowerCompletion,
  createTowerProgress,
  getTowerStage,
  normalizeTowerProgress,
  type TowerProgress,
} from "../../features/tower";

import {
  createBeastProgress,
  getBeastById,
  getBeastFeedCost,
  planBeastFeeding,
  getBeastPossessionBonuses,
  getBeastStageIndex,
  getTowerDemonCoreReward,
  isBeastUnlocked,
  normalizeBeastProgress,
  settleBeastUnlocks,
  settleDemonCoreIncome,
  type BeastProgress,
  type DemonCoreIncomeState,
} from "../../features/beast";
import { isProgressResetPending } from "./progressReset";
import { DEFAULT_CHARACTER_NAME, normalizeCharacterName, validateCharacterName } from "../../features/character/domain/characterName";
import { companionCatalog, getActiveCompanion, getCompanionUnlockBonus, getDualCultivationBonus, getDualSpecialty, normalizeIntimacy, migrateOldIntimacy } from "../../features/companion/companionCatalog";
import { settleIntimacy, INTIMACY_POINT_MS, migrateIntimacyRemainder } from "../../features/companion/intimacyTime";
import { ALCHEMY_SUCCESS_RATE, ALCHEMY_DURATION_MS, PILL_CATALOG, alchemyCost, normalizeAlchemy, pillBonus, qualityFromRoll, consumePill, discardPill, completeAlchemy, type AlchemyState, type PillId } from "../../features/alchemy/Alchemy";
import { getDualAlchemySuccessBonus } from "../../features/companion/companionCatalog";
import { createAdventureProgress, normalizeAdventureProgress, settleAdventureVictory, type AdventureProgress, type AdventureSkillId, type AdventureVictory } from "../../features/adventure";

const CACHE_KEY = "bai-xiaochun-game-save-v1";
const SAVE_VERSION = 1;
export const CLOUD_AUTO_SAVE_DELAY_MS = 30_000;

export interface WeaponProgress {
  readonly refinementLevel: number;
  /** True once this sword unlocked and received its inherited starting refinement. */
  readonly unlockSettled: boolean;
}

function createWeaponProgress(refinementLevel: unknown = 0, unlockSettled = false): WeaponProgress {
  return { refinementLevel: normalizeRefinementLevel(refinementLevel), unlockSettled };
}

/** Grants the inherited starting refinement to any sword this save has newly unlocked. */
function withSettledWeaponUnlocks(save: GameSaveData): GameSaveData {
  const weapons = settleWeaponUnlocks(
    save.weapons,
    { realmStageId: save.cultivation.stageId, highestClearedTowerStage: save.tower.highestClearedStage },
    refinementLevel => createWeaponProgress(refinementLevel, true),
  );
  return weapons === save.weapons ? save : { ...save, weapons: { ...weapons } };
}

/** Gives newly unlocked beasts their inherited starting realm. */
function withSettledBeastUnlocks(save: GameSaveData): GameSaveData {
  const beasts = settleBeastUnlocks(save.beasts, save.tower.highestClearedStage);
  return beasts === save.beasts ? save : { ...save, beasts };
}

export type BeastFeedResult =
  | { readonly ok: true; readonly cost: number }
  | { readonly ok: false; readonly reason: "locked" | "already-max" }
  | { readonly ok: false; readonly reason: "insufficient-demon-cores"; readonly cost: number };

export interface GameSaveData {
  readonly version: number;
  readonly characterName: string;
  readonly alchemy: AlchemyState;
  readonly activeCompanionId: string | null;
  readonly companionIntimacy: Record<string, number>;
  readonly companionIntimacyVersion: number;
  readonly companionIntimacyTimeVersion: number;
  readonly companionIntimacyRemainders: Record<string, number>;
  readonly lastIntimacyTimestamp: number;
  readonly cultivation: PlayerCultivationState;
  readonly equippedWeaponId: string;
  readonly weapons: Record<string, WeaponProgress>;
  readonly spiritStones: number;
  readonly totalSpiritStonesEarned: number;
  readonly spiritStoneRemainderMicros: number;
  readonly lastSpiritStoneTimestamp: number;
  readonly inventory: Record<string, number>;
  readonly pills: Record<string, number>;
  readonly techniques: Record<string, unknown>;
  readonly otherProgress: Record<string, unknown>;
  readonly tower: TowerProgress;
  /** The beast fighting beside the hero (出戰) and every beast's realm; unlocks follow tower progress. */
  readonly beasts: BeastProgress;
  /** 遊歷: stages cleared per region, the skills taken into fights, today's rewarded repeats. */
  readonly adventure: AdventureProgress;
  /** 妖丹: fed to spirit beasts. Earned idle (with cultivation, offline included) and from tower first clears. */
  readonly demonCores: number;
  readonly demonCoreRemainderMicros: number;
  readonly lastDemonCoreTimestamp: number;
  readonly updatedAt: number;
}

export interface GameSaveSnapshot {
  readonly save: GameSaveData;
  readonly configured: boolean;
  readonly loading: boolean;
  readonly saving: boolean;
  readonly cloudReady: boolean;
  readonly user: Pick<User, "id" | "email" | "user_metadata"> | null;
  readonly error: string | null;
}

export interface RefinementAttemptResult {
  readonly ok: boolean;
  readonly reason?: "unknown-weapon" | "locked" | "already-max" | "insufficient-spirit-stones";
  readonly cost?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeCount(value: unknown, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(maximum, Math.floor(value)));
}

function safeCountRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, count]) => [key, safeCount(count)]));
}

function defaultWeaponProgress(): Record<string, WeaponProgress> {
  return Object.fromEntries(weaponCatalog.map(weapon => [weapon.weaponId, createWeaponProgress()]));
}

/** Unlocked beasts' possession bonuses at the realm each has been fed to, as the beast page shows them. */
export function beastIncomeBonuses(save: Pick<GameSaveData, "tower" | "beasts">) {
  return getBeastPossessionBonuses(save.tower.highestClearedStage, beast => getBeastStageIndex(save.beasts, beast.beastId));
}

function createDefaultSave(): GameSaveData {
  const cultivation = cultivationService.getSnapshot();
  return withSettledWeaponUnlocks({
    version: SAVE_VERSION,
    characterName: DEFAULT_CHARACTER_NAME,
    alchemy: normalizeAlchemy(undefined),
    activeCompanionId: null,
    companionIntimacy: {},
    companionIntimacyVersion: 2,
    companionIntimacyTimeVersion: 2,
    companionIntimacyRemainders: {},
    lastIntimacyTimestamp: Date.now(),
    cultivation,
    equippedWeaponId: getDefaultWeapon().weaponId,
    weapons: defaultWeaponProgress(),
    spiritStones: 0,
    totalSpiritStonesEarned: 0,
    spiritStoneRemainderMicros: 0,
    lastSpiritStoneTimestamp: cultivation.lastCultivationTimestamp,
    inventory: {},
    pills: {},
    techniques: {},
    otherProgress: {},
    tower: createTowerProgress(),
    beasts: createBeastProgress(),
    adventure: createAdventureProgress(),
    demonCores: 0,
    demonCoreRemainderMicros: 0,
    lastDemonCoreTimestamp: cultivation.lastCultivationTimestamp,
    updatedAt: Date.now(),
  });
}

function normalizeSave(candidate: unknown): GameSaveData {
  const raw = isRecord(candidate) ? candidate : {};
  const weapons = defaultWeaponProgress();
  if (isRecord(raw.weapons)) {
    for (const weapon of weaponCatalog) {
      const progress = raw.weapons[weapon.weaponId];
      // Saves from before refinement inheritance have no flag; settling them may raise (never lower) levels.
      if (isRecord(progress)) weapons[weapon.weaponId] = createWeaponProgress(progress.refinementLevel, progress.unlockSettled === true);
    }
  }
  const equippedWeaponId = typeof raw.equippedWeaponId === "string" && getWeaponById(raw.equippedWeaponId) && weapons[raw.equippedWeaponId]
    ? raw.equippedWeaponId
    : getDefaultWeapon().weaponId;

  const cultivation = normalizeCultivationState(raw.cultivation, Date.now());
  const rewards = normalizeSpiritStoneRewardState(raw, cultivation.lastCultivationTimestamp);
  const intimacy = Object.fromEntries(companionCatalog.map(companion => {
    const points = (raw.companionIntimacyVersion === 2 ? normalizeIntimacy : migrateOldIntimacy)(isRecord(raw.companionIntimacy) ? raw.companionIntimacy[companion.id] : 0);
    const remainder = isRecord(raw.companionIntimacyRemainders) ? raw.companionIntimacyRemainders[companion.id] : 0;
    return [companion.id, raw.companionIntimacyTimeVersion === 2 ? { points, remainderMs: safeCount(remainder, INTIMACY_POINT_MS - 1) } : migrateIntimacyRemainder(points, remainder)];
  }));
  return withSettledWeaponUnlocks({
    version: SAVE_VERSION,
    characterName: normalizeCharacterName(raw.characterName),
    alchemy: normalizeAlchemy(raw.alchemy),
    activeCompanionId: getActiveCompanion(raw.activeCompanionId, normalizeTowerProgress(raw.tower).highestClearedStage, cultivation.realmId)?.id ?? null,
    companionIntimacy: Object.fromEntries(companionCatalog.map(companion => [companion.id, intimacy[companion.id].points])),
    companionIntimacyVersion: 2,
    companionIntimacyTimeVersion: 2,
    companionIntimacyRemainders: Object.fromEntries(companionCatalog.map(companion => [companion.id, intimacy[companion.id].remainderMs])),
    lastIntimacyTimestamp: safeCount(raw.lastIntimacyTimestamp) || Date.now(),
    cultivation,
    equippedWeaponId,
    weapons,
    spiritStones: rewards.spiritStones,
    totalSpiritStonesEarned: rewards.totalSpiritStonesEarned,
    spiritStoneRemainderMicros: rewards.spiritStoneRemainderMicros,
    lastSpiritStoneTimestamp: rewards.lastSpiritStoneTimestamp,
    inventory: safeCountRecord(raw.inventory),
    pills: safeCountRecord(raw.pills),
    techniques: isRecord(raw.techniques) ? raw.techniques : {},
    otherProgress: isRecord(raw.otherProgress) ? raw.otherProgress : {},
    tower: normalizeTowerProgress(raw.tower),
    beasts: normalizeBeastProgress(raw.beasts),
    adventure: normalizeAdventureProgress(raw.adventure),
    demonCores: safeCount(raw.demonCores),
    demonCoreRemainderMicros: safeCount(raw.demonCoreRemainderMicros, 999_999),
    // Saves from before 妖丹 start earning now, never retroactively.
    lastDemonCoreTimestamp: safeCount(raw.lastDemonCoreTimestamp) || cultivation.lastCultivationTimestamp,
    updatedAt: safeCount(raw.updatedAt) || Date.now(),
  });
}

function loadLocalCache(): GameSaveData {
  if (typeof window === "undefined") return createDefaultSave();
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? normalizeSave(JSON.parse(raw)) : createDefaultSave();
  } catch {
    return createDefaultSave();
  }
}

function createSupabaseClient(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}

/**
 * Cloud save is primary after sign-in; localStorage remains an offline cache and
 * compatibility fallback. RLS is enforced by the database migration, never by UI.
 */
export class GameSaveService {
  private readonly client = createSupabaseClient();
  private snapshot: GameSaveSnapshot = {
    save: createDefaultSave(),
    configured: this.client !== null,
    loading: true,
    saving: false,
    cloudReady: false,
    user: null,
    error: null,
  };
  private readonly listeners = new Set<() => void>();
  private saveTimer: number | null = null;
  private alchemyTimer: number | null = null;
  private cloudSaveQueue: Promise<void> = Promise.resolve();
  private cloudReadyUserId: string | null = null;
  private cloudLoadingUserId: string | null = null;
  private authRevision = 0;
  private suppressCloudSync = false;
  private initialized = false;

  public getSnapshot = (): GameSaveSnapshot => this.snapshot;

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    cultivationService.subscribe(() => {
      if (!this.cloudReadyUserId) return;
      const nextCultivation = cultivationService.getSnapshot();
      const save = this.snapshot.save;
      const active = getActiveCompanion(save.activeCompanionId, save.tower.highestClearedStage, save.cultivation.realmId);
      const intimacy = settleIntimacy(active ? save.companionIntimacy[active.id] : 0, active ? save.companionIntimacyRemainders[active.id] ?? 0 : 0, save.lastIntimacyTimestamp, nextCultivation.lastCultivationTimestamp, Boolean(active));
      const bonuses = beastIncomeBonuses(save);
      const rewards = settleSpiritStoneRewards(this.getSpiritStoneRewardState(), this.snapshot.save.cultivation, nextCultivation, 1 + bonuses.spiritStoneSpeed + pillBonus(save.alchemy, "stones"));
      const demonCores = settleDemonCoreIncome(this.getDemonCoreIncomeState(), this.snapshot.save.cultivation, nextCultivation, 1 + bonuses.demonCoreYield + pillBonus(save.alchemy, "cores"));
      this.patchSave({ cultivation: nextCultivation, ...rewards, ...demonCores, lastIntimacyTimestamp: intimacy.timestamp, ...(active ? { companionIntimacy: { ...save.companionIntimacy, [active.id]: intimacy.points }, companionIntimacyRemainders: { ...save.companionIntimacyRemainders, [active.id]: intimacy.remainderMs } } : {}) }, !this.suppressCloudSync);
    });
    if (!this.client) { this.setSnapshot({ loading: false, error: "尚未設定 Supabase，無法讀取雲端存檔。" }); return; }

    this.client.auth.onAuthStateChange((_event, session) => {
      void this.handleAuthUser(session?.user ?? null);
    });
    void this.client.auth.getUser().then(({ data, error }) => {
      if (error) this.setSnapshot({ error: error.message });
      void this.handleAuthUser(data.user ?? null);
    });
  }

  public renameCharacter(value: string): boolean {
    const name = validateCharacterName(value);
    if (!name) return false;
    this.patchSave({ characterName: name }, true, true);
    return true;
  }

  public craftPill(id: PillId, count: 1 | 10 = 1): { ok: boolean; message: string } {
    if (!this.cloudReadyUserId || !PILL_CATALOG.some(pill => pill.id === id)) return { ok: false, message: "無法煉製此丹藥。" };
    if (count !== 1 && count !== 10) return { ok: false, message: "無效的煉製數量。" };
    if (this.snapshot.save.alchemy.pending) return { ok: false, message: "正在煉丹，請等候完成。" };
    cultivationService.settle();
    const save = this.snapshot.save;
    const cost = alchemyCost(save.cultivation.realmId) * count;
    if (!cultivationService.spendCultivation(cost)) return { ok: false, message: "可用修為不足。" };
    const bonus = getDualAlchemySuccessBonus(save.activeCompanionId, save.tower.highestClearedStage, save.cultivation.realmId, save.activeCompanionId ? save.companionIntimacy[save.activeCompanionId] : 0);
    const qualities = Array.from({ length: count }, (_, index) => Math.random() < Math.min(1, ALCHEMY_SUCCESS_RATE + bonus) ? qualityFromRoll(Math.min(Number.MAX_SAFE_INTEGER, save.alchemy.attempts + index), Math.random()) : -1);
    this.patchSave({ alchemy: { ...save.alchemy, pending: { id, qualities, startedAt: Date.now() }, lastResult: null } }, true, true);
    this.scheduleAlchemy();
    return { ok: true, message: "正在煉丹，請稍候。" };
  }

  private scheduleAlchemy(): void {
    if (this.alchemyTimer !== null) window.clearTimeout(this.alchemyTimer);
    this.alchemyTimer = null;
    const pending = this.snapshot.save.alchemy.pending;
    if (!pending || !this.cloudReadyUserId) return;
    const remaining = pending.startedAt + ALCHEMY_DURATION_MS - Date.now();
    if (remaining > 0) { this.alchemyTimer = window.setTimeout(() => { this.alchemyTimer = null; this.scheduleAlchemy(); }, remaining); return; }
    const next = completeAlchemy(this.snapshot.save.alchemy, Date.now());
    if (next !== this.snapshot.save.alchemy) this.patchSave({ alchemy: next }, true, true);
  }

  public consumeAlchemyPill(id: PillId, quality: number): boolean {
    if (!this.cloudReadyUserId) return false;
    cultivationService.settle();
    const alchemy = consumePill(this.snapshot.save.alchemy, id, quality, Date.now());
    if (!alchemy) return false;
    this.patchSave({ alchemy }, true, true);
    return true;
  }

  public discardAlchemyPill(id: PillId, quality: number, count: number): boolean {
    if (!this.cloudReadyUserId) return false;
    const alchemy = discardPill(this.snapshot.save.alchemy, id, quality, count);
    if (!alchemy) return false;
    this.patchSave({ alchemy }, true, true);
    return true;
  }

  public selectCompanion(id: string | null): boolean {
    if (id !== null && !getActiveCompanion(id, this.snapshot.save.tower.highestClearedStage, this.snapshot.save.cultivation.realmId)) return false;
    if (id === this.snapshot.save.activeCompanionId) return true;
    cultivationService.settle();
    this.patchSave({ activeCompanionId: id, lastIntimacyTimestamp: Date.now() }, true, true);
    return true;
  }

  public async signInWithGoogle(): Promise<void> {
    if (!this.client) {
      this.setSnapshot({ error: "尚未設定 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY。" });
      return;
    }
    this.setSnapshot({ error: null });
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await this.client.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) this.setSnapshot({ error: error.message });
  }

  public async signOut(): Promise<void> {
    if (!this.client) return;
    cultivationService.pause();
    await this.saveNow();
    if (this.snapshot.error || this.cloudReadyUserId !== this.snapshot.user?.id) {
      this.setSnapshot({ error: this.snapshot.error ?? "雲端存檔尚未讀取完成，無法安全登出。" });
      cultivationService.start();
      return;
    }
    const { error } = await this.client.auth.signOut();
    if (error) { this.setSnapshot({ error: error.message }); cultivationService.start(); }
  }

  /** Whether a sword is open to this save (realm and tower), so commands cannot touch a locked one. */
  private isWeaponOpen(weaponId: string): boolean {
    const weapon = getWeaponById(weaponId);
    const save = this.snapshot.save;
    return weapon !== null && save.weapons[weaponId] !== undefined
      && isWeaponUnlocked(weapon, { realmStageId: save.cultivation.stageId, highestClearedTowerStage: save.tower.highestClearedStage });
  }

  public setEquippedWeapon(weaponId: string): void {
    if (!this.isWeaponOpen(weaponId)) return;
    this.patchSave({ equippedWeaponId: weaponId }, true, true);
  }

  /** Public persistence point for the future 0–30 refinement UI. */
  public setWeaponRefinement(weaponId: string, refinementLevel: number): void {
    if (!this.snapshot.save.weapons[weaponId]) return;
    this.patchSave({
      weapons: { ...this.snapshot.save.weapons, [weaponId]: createWeaponProgress(refinementLevel, this.snapshot.save.weapons[weaponId].unlockSettled) },
    }, true, true);
  }

  /** Performs exactly one 100%-success refinement using the immutable 30-step cost table. */
  public refineWeapon(weaponId: string): RefinementAttemptResult {
    const current = this.snapshot.save.weapons[weaponId];
    if (!current) return { ok: false, reason: "unknown-weapon" };
    if (!this.isWeaponOpen(weaponId)) return { ok: false, reason: "locked" };
    const targetLevel = current.refinementLevel + 1;
    const cost = getRefinementCost(targetLevel);
    if (cost === null) return { ok: false, reason: "already-max" };
    if (this.snapshot.save.spiritStones < cost) return { ok: false, reason: "insufficient-spirit-stones", cost };

    this.patchSave({
      spiritStones: this.snapshot.save.spiritStones - cost,
      weapons: { ...this.snapshot.save.weapons, [weaponId]: createWeaponProgress(targetLevel, current.unlockSettled) },
    }, true, true);
    return { ok: true, cost };
  }

  /** Public persistence point for future spirit-stone, inventory, pill and technique features. */
  /** One-click refinement (一鍵煉靈): every level the spirit stones pay for, in one save. */
  public refineWeaponMax(weaponId: string): RefinementAttemptResult & { readonly levels?: number } {
    const current = this.snapshot.save.weapons[weaponId];
    if (!current) return { ok: false, reason: "unknown-weapon" };
    if (!this.isWeaponOpen(weaponId)) return { ok: false, reason: "locked" };
    const plan = planRefinement(current.refinementLevel, this.snapshot.save.spiritStones);
    if (plan.levels === 0) {
      const next = getRefinementCost(current.refinementLevel + 1);
      return next === null ? { ok: false, reason: "already-max" } : { ok: false, reason: "insufficient-spirit-stones", cost: next };
    }
    this.patchSave({
      spiritStones: this.snapshot.save.spiritStones - plan.cost,
      weapons: { ...this.snapshot.save.weapons, [weaponId]: createWeaponProgress(plan.toLevel, current.unlockSettled) },
    }, true, true);
    return { ok: true, cost: plan.cost, levels: plan.levels };
  }

  public patchProgress(progress: Partial<Pick<GameSaveData, "spiritStones" | "inventory" | "pills" | "techniques" | "otherProgress">>): void {
    this.patchSave(progress, true, true);
  }

  /** Sends an unlocked beast to fight (出戰); locked or unknown beasts are ignored. */
  public deployBeast(beastId: string): void {
    const beast = getBeastById(beastId);
    if (!beast || !isBeastUnlocked(beast, this.snapshot.save.tower.highestClearedStage)) return;
    this.patchSave({ beasts: { ...this.snapshot.save.beasts, deployedBeastId: beast.beastId } }, true, true);
  }

  /** Feeds 妖丹 to an unlocked beast: one realm stage up (a breakthrough when it crosses a major realm). Always succeeds. */
  public feedBeast(beastId: string): BeastFeedResult {
    const save = this.snapshot.save;
    const beast = getBeastById(beastId);
    if (!beast || !isBeastUnlocked(beast, save.tower.highestClearedStage)) return { ok: false, reason: "locked" };
    const stageIndex = getBeastStageIndex(save.beasts, beast.beastId);
    const cost = getBeastFeedCost(stageIndex);
    if (cost === null) return { ok: false, reason: "already-max" };
    if (save.demonCores < cost) return { ok: false, reason: "insufficient-demon-cores", cost };
    this.patchSave({
      demonCores: save.demonCores - cost,
      beasts: { ...save.beasts, beasts: { ...save.beasts.beasts, [beast.beastId]: { stageIndex: stageIndex + 1, unlockSettled: true } } },
    }, true, true);
    return { ok: true, cost };
  }

  /** Feeds a beast every stage the 妖丹 pay for (連續餵養), breakthroughs included, in one save. */
  public feedBeastMax(beastId: string): BeastFeedResult & { readonly levels?: number } {
    const save = this.snapshot.save;
    const beast = getBeastById(beastId);
    if (!beast || !isBeastUnlocked(beast, save.tower.highestClearedStage)) return { ok: false, reason: "locked" };
    const stageIndex = getBeastStageIndex(save.beasts, beast.beastId);
    const plan = planBeastFeeding(stageIndex, save.demonCores);
    if (plan.levels === 0) {
      const next = getBeastFeedCost(stageIndex);
      return next === null ? { ok: false, reason: "already-max" } : { ok: false, reason: "insufficient-demon-cores", cost: next };
    }
    this.patchSave({
      demonCores: save.demonCores - plan.cost,
      beasts: { ...save.beasts, beasts: { ...save.beasts.beasts, [beast.beastId]: { stageIndex: plan.toStageIndex, unlockSettled: true } } },
    }, true, true);
    return { ok: true, cost: plan.cost, levels: plan.levels };
  }

  public setTowerProgress(tower: TowerProgress): void {
    this.patchSave({ tower: normalizeTowerProgress(tower) }, true, true);
  }

  /** Atomically records first-clear progress and its one-time tower rewards. */
  /** The skills taken into 遊歷 fights (the page keeps only unlocked ones, at most three). */
  public setAdventureSkills(skills: readonly AdventureSkillId[]): void {
    this.patchSave({ adventure: { ...this.snapshot.save.adventure, skills: [...skills] } }, true);
  }

  /** A won 遊歷 stage: advances the region on a first clear and pays its spirit stones, demon cores and (a boss's first clear) pill. */
  public completeAdventureStage(regionIndex: number, stage: number, now = Date.now()): AdventureVictory {
    const save = this.snapshot.save;
    const victory = settleAdventureVictory(save.adventure, regionIndex, stage, now);
    const reward = victory.reward;
    let alchemy = save.alchemy;
    if (reward?.pill) {
      const counts = [...(alchemy.inventory[reward.pill.id] ?? [])];
      while (counts.length < 6) counts.push(0);
      counts[reward.pill.quality] += 1;
      alchemy = { ...alchemy, inventory: { ...alchemy.inventory, [reward.pill.id]: counts } };
    }
    this.patchSave({
      adventure: victory.progress,
      spiritStones: safeCount(save.spiritStones + (reward?.spiritStones ?? 0)),
      demonCores: safeCount(save.demonCores + (reward?.demonCores ?? 0)),
      alchemy,
    }, true, true);
    return victory;
  }

  public completeTowerStage(stageNumber: number): { readonly awardedSpiritStones: number; readonly awardedCultivation: number; readonly awardedDemonCores: number; readonly repeat: boolean; readonly tower: TowerProgress } {
    const completion = resolveTowerCompletion(this.snapshot.save.tower, getTowerStage(stageNumber));
    const awardedSpiritStones = completion.reward?.spiritStones ?? 0;
    const awardedCultivation = completion.reward?.cultivation ?? 0;
    // Cultivation service owns lifetime-earned accounting and automatic
    // minor-stage advancement. Its subscription updates this same save before
    // the tower-progress update below is queued for cloud storage.
    if (awardedCultivation > 0) cultivationService.grantCultivation(awardedCultivation);
    const yieldMultiplier = 1 + beastIncomeBonuses(this.snapshot.save).demonCoreYield + pillBonus(this.snapshot.save.alchemy, "cores");
    const awardedDemonCores = completion.reward ? Math.round(getTowerDemonCoreReward(stageNumber) * yieldMultiplier) : 0;
    this.patchSave({
      tower: completion.progress,
      spiritStones: safeCount(this.snapshot.save.spiritStones + awardedSpiritStones),
      demonCores: safeCount(this.snapshot.save.demonCores + awardedDemonCores),
    }, true, true);
    return { awardedSpiritStones, awardedCultivation, awardedDemonCores, repeat: completion.repeat, tower: completion.progress };
  }

  public exportJson(): string {
    return JSON.stringify({ exportedAt: new Date().toISOString(), save: this.snapshot.save }, null, 2);
  }

  public async importJson(raw: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.snapshot.user || this.cloudReadyUserId !== this.snapshot.user.id) return { ok: false, error: "請先登入並成功讀取雲端存檔。" };
    try {
      const parsed: unknown = JSON.parse(raw);
      const save = normalizeSave(isRecord(parsed) && "save" in parsed ? parsed.save : parsed);
      this.suppressCloudSync = true;
      this.replaceSave(save, false);
      cultivationService.hydrateFromSave(save.cultivation);
      this.suppressCloudSync = false;
      this.replaceSave({ ...this.snapshot.save, cultivation: cultivationService.getSnapshot(), updatedAt: Date.now() }, false);
      await this.saveNow();
      return this.snapshot.error ? { ok: false, error: `雲端保存失敗：${this.snapshot.error}` } : { ok: true };
    } catch {
      this.suppressCloudSync = false;
      return { ok: false, error: "無法讀取此 JSON 存檔。" };
    }
  }

  public async saveNow(): Promise<void> {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (!this.client || !this.snapshot.user || this.cloudReadyUserId !== this.snapshot.user.id) return;
    // Serialize uploads so an earlier, slower request cannot overwrite a later save.
    const client = this.client;
    const userId = this.snapshot.user.id;
    const save = this.snapshot.save;
    const upload = async (): Promise<void> => {
      this.setSnapshot({ saving: true, error: null });
      try {
        const payload = { user_id: userId, save_data: save, updated_at: new Date().toISOString() };
        const { error } = await client.from("game_saves").upsert(payload, { onConflict: "user_id" });
        this.setSnapshot({ saving: false, error: error?.message ?? null });
      } catch (error) {
        this.setSnapshot({ saving: false, error: error instanceof Error ? error.message : "雲端存檔失敗。" });
      }
    };
    this.cloudSaveQueue = this.cloudSaveQueue.then(upload, upload);
    await this.cloudSaveQueue;
  }

  /** Settle current income and verify the local and (when signed in) cloud save. */
  public async saveBeforeShutdown(): Promise<void> {
    if (this.snapshot.loading) throw new Error("雲端存檔仍在讀取，請稍後再試。");
    if (!this.snapshot.user || this.cloudReadyUserId !== this.snapshot.user.id) throw new Error("雲端存檔尚未成功讀取，請確認連線後再試。");
    cultivationService.pause();
    await this.saveNow();
    if (this.snapshot.user && this.snapshot.error) throw new Error(`雲端存檔失敗：${this.snapshot.error}`);
  }

  public resumeAfterShutdownFailure(): void { cultivationService.start(); }

  private async handleAuthUser(user: User | null): Promise<void> {
    if (!this.client) return;
    if (!user) {
      cultivationService.pause();
      if (this.alchemyTimer !== null) window.clearTimeout(this.alchemyTimer);
      this.alchemyTimer = null;
      this.authRevision += 1;
      this.cloudReadyUserId = null;
      this.cloudLoadingUserId = null;
      this.setSnapshot({ user: null, loading: false, cloudReady: false });
      return;
    }
    if (this.cloudLoadingUserId === user.id || this.cloudReadyUserId === user.id) return;
    const revision = ++this.authRevision;
    this.cloudReadyUserId = null;
    this.cloudLoadingUserId = user.id;
    this.setSnapshot({ user, loading: true, cloudReady: false, error: null });
    const { data, error } = await this.client.from("game_saves").select("save_data").eq("user_id", user.id).maybeSingle();
    if (revision !== this.authRevision) return;
    this.cloudLoadingUserId = null;
    if (error) {
      this.setSnapshot({ loading: false, error: error.message });
      return;
    }

    if (!data || !isRecord(data.save_data)) {
      this.setSnapshot({ loading: false, cloudReady: false, error: "找不到有效的雲端存檔，已停止載入，沒有使用或覆蓋本機資料。請確認登入帳號及資料庫。" });
      return;
    }

    this.cloudReadyUserId = user.id;

    if (data?.save_data) {
      const cloudSave = normalizeSave(data.save_data);
      this.suppressCloudSync = true;
      this.snapshot = { ...this.snapshot, save: withSettledBeastUnlocks(withSettledWeaponUnlocks(cloudSave)) };
      const save = this.snapshot.save;
      const bonus = getCompanionUnlockBonus(save.tower.highestClearedStage, save.cultivation.realmId) + getDualCultivationBonus(save.activeCompanionId, save.tower.highestClearedStage, save.cultivation.realmId, save.activeCompanionId ? save.companionIntimacy[save.activeCompanionId] : 0);
      const multiplier = 1 + beastIncomeBonuses(save).cultivationSpeed + bonus + pillBonus(save.alchemy, "cultivation");
      cultivationService.hydrateFromSave(cloudSave.cultivation, multiplier);
      this.suppressCloudSync = false;
      this.replaceSave({ ...this.snapshot.save, cultivation: cultivationService.getSnapshot() }, false);
    }
    this.setSnapshot({ loading: false, cloudReady: true });
    this.scheduleAlchemy();
    this.scheduleCloudSave();
  }

  private patchSave(patch: Partial<GameSaveData>, scheduleCloud: boolean, immediate = false): void {
    this.replaceSave({ ...this.snapshot.save, ...patch, updatedAt: Date.now() }, scheduleCloud, immediate);
  }

  /** Unlocked beasts' cultivation-speed possession bonus drives the idle cultivation clock. */
  private syncBeastCultivationBonus(): void {
    const save = this.snapshot.save;
    const unlockBonus = getCompanionUnlockBonus(save.tower.highestClearedStage, save.cultivation.realmId);
    const dualBonus = getDualCultivationBonus(save.activeCompanionId, save.tower.highestClearedStage, save.cultivation.realmId, save.activeCompanionId ? save.companionIntimacy[save.activeCompanionId] : 0);
    cultivationService.setBreakthroughBonus(getDualSpecialty(save.activeCompanionId, save.tower.highestClearedStage, save.cultivation.realmId, save.activeCompanionId ? save.companionIntimacy[save.activeCompanionId] : 0).breakthroughBonus + pillBonus(save.alchemy, "breakthrough"));
    cultivationService.setRateMultiplier(1 + beastIncomeBonuses(save).cultivationSpeed + unlockBonus + dualBonus + pillBonus(save.alchemy, "cultivation"));
  }

  private getDemonCoreIncomeState(): DemonCoreIncomeState {
    const { demonCores, demonCoreRemainderMicros, lastDemonCoreTimestamp } = this.snapshot.save;
    return { demonCores, demonCoreRemainderMicros, lastDemonCoreTimestamp };
  }

  private getSpiritStoneRewardState(): SpiritStoneRewardState {
    const save = this.snapshot.save;
    return {
      spiritStones: save.spiritStones,
      totalSpiritStonesEarned: save.totalSpiritStonesEarned,
      spiritStoneRemainderMicros: save.spiritStoneRemainderMicros,
      lastSpiritStoneTimestamp: save.lastSpiritStoneTimestamp,
    };
  }

  private replaceSave(save: GameSaveData, scheduleCloud: boolean, _immediate = false): void {
    // Realm and Tower changes both arrive here, so newly unlocked swords settle in one place.
    this.snapshot = { ...this.snapshot, save: withSettledBeastUnlocks(withSettledWeaponUnlocks(save)) };
    this.notify();
    this.syncBeastCultivationBonus();
    if (scheduleCloud) this.scheduleCloudSave();
  }

  private scheduleCloudSave(): void {
    if (!this.client || !this.snapshot.user || this.saveTimer !== null) return;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.saveNow();
    }, CLOUD_AUTO_SAVE_DELAY_MS);
  }

  private writeLocalCache(): void {
    if (typeof window === "undefined" || isProgressResetPending()) return;
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(this.snapshot.save));
    } catch {
      // Local cache is optional when storage is unavailable.
    }
  }

  private setSnapshot(patch: Partial<Omit<GameSaveSnapshot, "save" | "configured">>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
  }
}

export const gameSaveService = new GameSaveService();
