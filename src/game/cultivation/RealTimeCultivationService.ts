import {
  applyAutomaticProgression,
  attemptBreakthrough as resolveBreakthrough,
  estimateSecondsToEternal,
  getEffectiveCultivationRate,
  grantCultivation as applyCultivationGrant,
  isBreakthroughAvailable,
  settleCultivation,
  type BreakthroughResult,
} from "../../features/cultivation/domain/CultivationRules";
import {
  createCultivationState,
  normalizeCultivationState,
  type PlayerCultivationState,
} from "../../features/cultivation/domain/CultivationState";
import { getNextRealmStage, getRealmStage, type RealmStageConfig } from "../../features/cultivation/domain/RealmCatalog";
import { isProgressResetPending } from "../save/progressReset";

const STORAGE_KEY = "bai-xiaochun-cultivation-v1";

function currentTimestamp(): number {
  return Date.now();
}

function loadState(now = currentTimestamp()): PlayerCultivationState {
  if (typeof window === "undefined") return createCultivationState(now);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeCultivationState(JSON.parse(raw), now) : createCultivationState(now);
  } catch {
    return createCultivationState(now);
  }
}

/**
 * Browser adapter for the cultivation domain. The domain functions own all
 * balancing and progression rules; this service owns only clock, local cache,
 * lifecycle events, and subscription compatibility for the existing UI.
 */
export class RealTimeCultivationService {
  private state = createCultivationState(currentTimestamp());
  private readonly listeners = new Set<() => void>();
  private timerId: number | null = null;
  private started = false;
  /** Outside cultivation-speed bonuses (spirit-beast possession); applied from the next settle on. */
  private rateMultiplier = 1;
  private breakthroughBonus = 0;

  public setBreakthroughBonus(value: number): void { this.breakthroughBonus = Math.max(0, value); }

  public getSnapshot = (): PlayerCultivationState => this.state;

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public start(): void {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    this.settle();
    this.timerId = window.setInterval(() => this.settle(), 1000);
    window.addEventListener("focus", this.settle);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  /** Settle once and stop background ticks while the game is shutting down. */
  public pause(): void {
    if (!this.started) return;
    this.settle();
    if (this.timerId !== null) window.clearInterval(this.timerId);
    this.timerId = null;
    window.removeEventListener("focus", this.settle);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.started = false;
  }

  public getCurrentStage(): RealmStageConfig {
    return getRealmStage(this.state.stageId);
  }

  public getNextStage(): RealmStageConfig | null {
    return getNextRealmStage(this.state.stageId);
  }

  public getEffectiveCultivationRate(stage = this.getCurrentStage()): number {
    return getEffectiveCultivationRate(this.state, stage, this.rateMultiplier);
  }

  public isBreakthroughAvailable(): boolean {
    return isBreakthroughAvailable(this.state);
  }

  /** Settles the time so far at the old rate, then switches to the new one. */
  public setRateMultiplier(multiplier: number): void {
    if (multiplier === this.rateMultiplier) return;
    // Switch first, so a listener reacting to the settle below sees the new rate and does not re-enter.
    const previous = this.rateMultiplier;
    this.rateMultiplier = multiplier;
    const settled = settleCultivation(this.state, currentTimestamp(), previous);
    if (settled !== this.state) this.commit(settled);
    else this.listeners.forEach(listener => listener());
  }

  public settle = (): void => {
    const settled = settleCultivation(this.state, currentTimestamp(), this.rateMultiplier);
    if (settled !== this.state) this.commit(settled);
  };

  /** Future pills and rewards must use this path so lifetime earned cultivation stays correct. */
  public grantCultivation(amount: number): void {
    this.settle();
    const nextState = applyCultivationGrant(this.state, amount);
    if (nextState !== this.state) this.commit(nextState);
  }

  public spendCultivation(amount: number): boolean {
    this.settle();
    if (!Number.isSafeInteger(amount) || amount < 0 || this.state.currentCultivation < amount) return false;
    this.commit({ ...this.state, currentCultivation: this.state.currentCultivation - amount });
    return true;
  }

  public attemptBreakthrough(): Omit<BreakthroughResult, "state"> {
    this.settle();
    const result = resolveBreakthrough(this.state, Math.random(), this.breakthroughBonus);
    // A failed roll also changes state: it costs cultivation and raises pity.
    if (result.state !== this.state) this.commit(result.state);
    const { state: _state, ...outcome } = result;
    return outcome;
  }

  /** Replaces local cache with a validated cloud snapshot, then settles exactly once. */
  public hydrateFromSave(savedState: unknown, multiplier?: number): void {
    if (multiplier !== undefined) this.rateMultiplier = multiplier;
    this.commit(applyAutomaticProgression(normalizeCultivationState(savedState, currentTimestamp())));
    this.settle();
  }

  private commit(nextState: PlayerCultivationState): void {
    this.state = nextState;
    this.listeners.forEach(listener => listener());
  }

  private save(): void {
    if (typeof window === "undefined" || isProgressResetPending()) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // The game remains playable when storage is unavailable; persistence is simply disabled.
    }
  }

  private onVisibilityChange = (): void => {
    if (document.visibilityState === "visible") this.settle();
  };
}

/** @deprecated Import domain functions from features/cultivation instead. */
export { estimateSecondsToEternal, normalizeCultivationState };
export type { BreakthroughResult, PlayerCultivationState };

export const cultivationService = new RealTimeCultivationService();
