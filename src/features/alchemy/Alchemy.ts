import { realmConfigs, type RealmId } from "../cultivation/domain/RealmCatalog";

export const QUALITY_NAMES = ["雜品", "初品", "中品", "地品", "金品", "天品"] as const;
export const ALCHEMIST_THRESHOLDS = [0, 20, 60, 130, 260, 500] as const;
export const QUALITY_CHANCES = [[60,25,15,0,0,0],[35,35,25,5,0,0],[15,25,35,20,5,0],[5,15,25,35,17,3],[2,8,15,30,35,10],[0,3,7,20,40,30]] as const;
/** Pills of each kind that may be taken per local calendar day; the permanent bonus has no lifetime cap. */
export const PILL_DAILY_LIMIT = 10;
export const ALCHEMY_SUCCESS_RATE = 0.65;
export const ALCHEMY_DURATION_MS = 5000;
export const PILL_CATALOG = [
  { id: "attack", name: "破岳丹", effect: "攻擊力", values: [0.0025,0.004,0.006,0.008,0.01,0.0125] },
  { id: "crit", name: "星瞳丹", effect: "暴擊率", values: [0.0005,0.001,0.0015,0.002,0.0025,0.0035] },
  { id: "speed", name: "疾風丹", effect: "攻擊速度", values: [0.0025,0.004,0.006,0.008,0.01,0.0125] },
  { id: "cultivation", name: "聚靈丹", effect: "修煉速度", values: [0.0025,0.004,0.006,0.008,0.01,0.0125] },
  { id: "stones", name: "納財丹", effect: "靈石獲取速度", values: [0.0025,0.004,0.006,0.008,0.01,0.0125] },
  { id: "cores", name: "凝妖丹", effect: "妖丹獲取速度", values: [0.0025,0.004,0.006,0.008,0.01,0.0125] },
  { id: "breakthrough", name: "悟道丹", effect: "突破成功率", values: [0.001,0.0015,0.0025,0.0035,0.0045,0.006] },
] as const;
export type PillId = typeof PILL_CATALOG[number]["id"];
export interface AlchemyResult { readonly id: PillId; readonly qualities: readonly number[] }
export interface AlchemyPending extends AlchemyResult { readonly startedAt: number }
export interface AlchemyState { readonly attempts: number; readonly inventory: Record<string, number[]>; readonly consumed: Record<string, number[]>; /** Local date (YYYY-MM-DD) the daily counts belong to; they are zero on any other day. */ readonly dailyDate: string; readonly dailyConsumed: Record<string, number>; readonly pending: AlchemyPending | null; readonly lastResult: AlchemyResult | null }
export function normalizeAlchemy(value: unknown): AlchemyState {
  const raw = value && typeof value === "object" ? value as Partial<AlchemyState> : {};
  const read = (source: Record<string, number[]> | undefined, max: number) => Object.fromEntries(PILL_CATALOG.map(pill => {
    const vals = Array.isArray(source?.[pill.id]) ? source![pill.id] : [];
    let remaining = max;
    return [pill.id, QUALITY_NAMES.map((_, i) => { const n = typeof vals[i] === "number" && Number.isSafeInteger(vals[i]) ? Math.max(0, Math.min(remaining, vals[i])) : 0; remaining -= n; return n; })];
  }));
  const normalizeResult = (item: unknown): AlchemyResult | null => { const entry = item && typeof item === "object" ? item as Record<string, unknown> : {}; const id = PILL_CATALOG.find(p => p.id === entry.id)?.id; const values = Array.isArray(entry.qualities) ? entry.qualities : [entry.quality]; return id && (values.length === 1 || values.length === 10) && values.every(q => typeof q === "number" && Number.isInteger(q) && q >= -1 && q < 6) ? { id, qualities: values as number[] } : null; };
  const result = normalizeResult(raw.pending);
  const pending = result && typeof raw.pending?.startedAt === "number" && Number.isSafeInteger(raw.pending.startedAt) && raw.pending.startedAt > 0 ? { ...result, startedAt: raw.pending.startedAt } : null;
  return { attempts: typeof raw.attempts === "number" && Number.isSafeInteger(raw.attempts) ? Math.max(0, raw.attempts) : 0, inventory: read(raw.inventory, Number.MAX_SAFE_INTEGER), consumed: read(raw.consumed, Number.MAX_SAFE_INTEGER), dailyDate: typeof raw.dailyDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.dailyDate) ? raw.dailyDate : "", dailyConsumed: Object.fromEntries(PILL_CATALOG.map(pill => { const n = raw.dailyConsumed?.[pill.id]; return [pill.id, typeof n === "number" && Number.isSafeInteger(n) ? Math.max(0, Math.min(PILL_DAILY_LIMIT, n)) : 0]; })), pending, lastResult: normalizeResult(raw.lastResult) };
}
export function completeAlchemy(state: AlchemyState, now: number): AlchemyState {
  const pending = state.pending;
  if (!pending || now < pending.startedAt + ALCHEMY_DURATION_MS) return state;
  const inventory = { ...state.inventory };
  const counts = [...inventory[pending.id]];
  for (const quality of pending.qualities) if (quality >= 0) counts[quality] = Math.min(Number.MAX_SAFE_INTEGER, counts[quality] + 1);
  inventory[pending.id] = counts;
  return { ...state, inventory, attempts: Math.min(Number.MAX_SAFE_INTEGER, state.attempts + pending.qualities.length), pending: null, lastResult: { id: pending.id, qualities: pending.qualities } };
}
export function alchemistLevel(attempts: number): number { return ALCHEMIST_THRESHOLDS.filter(n => attempts >= n).length - 1; }
export function alchemyCost(realmId: RealmId): number { return (realmConfigs.find(stage => stage.realmId === realmId)?.baseCultivationRate ?? 0) * 60; }
export function qualityFromRoll(attempts: number, roll: number): number { let sum = 0; const chances = QUALITY_CHANCES[alchemistLevel(attempts)]; let last = 0; for (let i = 0; i < chances.length; i++) { sum += chances[i]; if (chances[i] > 0) last = i; if (roll * 100 < sum) return i; } return last; }
export function pillBonus(state: AlchemyState, id: PillId): number { const pill = PILL_CATALOG.find(p => p.id === id)!; return (state.consumed[id] ?? []).reduce((sum, count, i) => sum + count * (pill.values[i] ?? 0), 0); }
/** The player's local calendar day, which the daily pill limit resets on. */
export function localDateKey(now: number): string { const date = new Date(now); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
export function pillsTakenToday(state: AlchemyState, id: PillId, now: number): number { return state.dailyDate === localDateKey(now) ? state.dailyConsumed[id] ?? 0 : 0; }
export function consumePill(state: AlchemyState, id: PillId, quality: number, now: number = Date.now()): AlchemyState | null {
  if (!PILL_CATALOG.some(p => p.id === id) || !Number.isInteger(quality) || quality < 0 || quality >= 6) return null;
  const inventory = [...(state.inventory[id] ?? [])]; const consumed = [...(state.consumed[id] ?? [])];
  if (!inventory[quality]) return null;
  const taken = pillsTakenToday(state, id, now);
  if (taken >= PILL_DAILY_LIMIT) return null;
  inventory[quality]--; consumed[quality]++;
  const today = localDateKey(now);
  const dailyConsumed = state.dailyDate === today ? state.dailyConsumed : {};
  return { ...state, inventory: { ...state.inventory, [id]: inventory }, consumed: { ...state.consumed, [id]: consumed }, dailyDate: today, dailyConsumed: { ...dailyConsumed, [id]: taken + 1 } };
}

/** Remove only unconsumed inventory; previously applied permanent bonuses remain unchanged. */
export function discardPill(state: AlchemyState, id: PillId, quality: number, count: number): AlchemyState | null {
  if (!PILL_CATALOG.some(pill => pill.id === id) || !Number.isInteger(quality) || quality < 0 || quality >= QUALITY_NAMES.length || !Number.isSafeInteger(count) || count <= 0) return null;
  const inventory = state.inventory[id];
  if (!inventory || (inventory[quality] ?? 0) < count) return null;
  const next = [...inventory];
  next[quality] -= count;
  return { ...state, inventory: { ...state.inventory, [id]: next } };
}
