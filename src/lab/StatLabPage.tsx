import { useEffect, useMemo, useState } from "react";
import { PILL_CATALOG, QUALITY_NAMES, type PillId } from "../features/alchemy/Alchemy";
import {
  defaultLabProfile,
  evaluateLab,
  evaluateLabSteps,
  labBeastStage,
  labMetric,
  labUnlockedBeasts,
  labUnlockedCompanions,
  labUnlockedWeapons,
  type LabMetric,
  type LabProfile,
  type LabResult,
} from "../features/balance/statLab";
import { beastCatalog, BEAST_STAGES, type BeastId } from "../features/beast";
import { companionCatalog, INTIMACY_THRESHOLDS } from "../features/companion/companionCatalog";
import { realmConfigs } from "../features/cultivation";
import { MAX_REFINEMENT_LEVEL } from "../features/refinement";
import { TOWER_STAGES_PER_FLOOR, TOWER_TOTAL_STAGES } from "../features/tower";
import { weaponCatalog } from "../features/weapon";

const STORAGE_KEY = "cultivation-stat-lab-v1";

const loadProfile = (): LabProfile => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? { ...defaultLabProfile, ...JSON.parse(saved) } : defaultLabProfile;
  } catch {
    return defaultLabProfile;
  }
};

const num = (value: number, digits = 0) => value.toLocaleString("zh-TW", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const pct = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;
const floorOf = (stage: number) => (stage === 0 ? "未通關" : `第 ${Math.ceil(stage / TOWER_STAGES_PER_FLOOR)} 層第 ${(stage - 1) % TOWER_STAGES_PER_FLOOR + 1} 關`);

interface Column {
  readonly metric: LabMetric;
  readonly label: string;
  /** How a change shows: relative for amounts, points for chances, stages for the tower. */
  readonly kind: "relative" | "points" | "stages";
}

const COLUMNS: readonly Column[] = [
  { metric: "attack", label: "攻擊", kind: "relative" },
  { metric: "critRate", label: "暴擊", kind: "points" },
  { metric: "attackSpeed", label: "攻速", kind: "relative" },
  { metric: "teamDps", label: "隊伍 DPS", kind: "relative" },
  { metric: "towerReach", label: "通天塔", kind: "stages" },
  { metric: "cultivationPerSecond", label: "修為", kind: "relative" },
  { metric: "spiritStonesPerSecond", label: "靈石", kind: "relative" },
  { metric: "demonCoresPerSecond", label: "妖丹", kind: "relative" },
  { metric: "breakthroughRate", label: "突破", kind: "points" },
];

function change(column: Column, before: LabResult, after: LabResult): string {
  const a = labMetric(before, column.metric);
  const b = labMetric(after, column.metric);
  if (Math.abs(b - a) < 1e-9) return "";
  if (column.kind === "stages") return `${b > a ? "+" : ""}${b - a} 關`;
  if (column.kind === "points") return `${b > a ? "+" : ""}${((b - a) * 100).toFixed(2)} 點`;
  return a === 0 ? "新增" : `${b > a ? "+" : ""}${((b / a - 1) * 100).toFixed(2)}%`;
}

export function StatLabPage(): JSX.Element {
  const [profile, setProfile] = useState<LabProfile>(loadProfile);
  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch { /* the lab works without remembering */ }
  }, [profile]);

  const result = useMemo(() => evaluateLab(profile), [profile]);
  const impacts = useMemo(() => evaluateLabSteps(profile), [profile]);
  const unlockedWeapons = new Set(labUnlockedWeapons(profile).map(weapon => weapon.weaponId));
  const unlockedBeasts = new Set(labUnlockedBeasts(profile).map(beast => beast.beastId));
  const unlockedCompanions = new Set<string>(labUnlockedCompanions(profile).map(companion => companion.id));
  const deployed = beastCatalog.find(beast => beast.beastId === profile.deployedBeastId) ?? beastCatalog[0];
  const set = (patch: Partial<LabProfile>) => setProfile(current => ({ ...current, ...patch }));

  return (
    <main className="lab">
      <style>{LAB_CSS}</style>
      <header className="lab__header">
        <h1>數值實驗室</h1>
        <p>自訂一個角色，直接用遊戲本身的規則計算。右邊的表格列出「再往前一步」各會改變多少。只在本機開發時開得到，不會上傳到 GitHub Pages。</p>
        <button type="button" onClick={() => setProfile(defaultLabProfile)}>重設為新角色</button>
      </header>

      <section className="lab__panel" aria-label="角色設定">
        <h2>境界</h2>
        <label>目前境界
          <select value={profile.stageId} onChange={event => set({ stageId: event.target.value })}>
            {realmConfigs.map(stage => <option key={stage.stageId} value={stage.stageId}>{stage.displayNameZh}</option>)}
          </select>
        </label>

        <h2>通天塔</h2>
        <label>已通關到第 {Math.ceil(profile.towerCleared / TOWER_STAGES_PER_FLOOR)} 層（{profile.towerCleared} 關）
          <input type="range" min={0} max={TOWER_TOTAL_STAGES} step={TOWER_STAGES_PER_FLOOR} value={profile.towerCleared} onChange={event => set({ towerCleared: Number(event.target.value) })} />
        </label>
        <small>決定哪些仙劍、靈獸、道侶已解鎖。</small>

        <h2>仙劍</h2>
        <label>裝備
          <select value={profile.weaponId} onChange={event => set({ weaponId: event.target.value })}>
            {weaponCatalog.map(weapon => <option key={weapon.weaponId} value={weapon.weaponId}>{weapon.nameZh}{unlockedWeapons.has(weapon.weaponId) ? "" : "（未解鎖）"}</option>)}
          </select>
        </label>
        <label>煉靈 {profile.refinementLevel} 級
          <input type="range" min={0} max={MAX_REFINEMENT_LEVEL} value={profile.refinementLevel} onChange={event => set({ refinementLevel: Number(event.target.value) })} />
        </label>
        <small>已解鎖 {unlockedWeapons.size} 把，持有效果全部生效。</small>

        <h2>靈獸</h2>
        <label>出戰
          <select value={profile.deployedBeastId} onChange={event => set({ deployedBeastId: event.target.value as BeastId })}>
            {beastCatalog.map(beast => <option key={beast.beastId} value={beast.beastId}>{beast.nameZh}{unlockedBeasts.has(beast.beastId) ? "" : "（未解鎖）"}</option>)}
          </select>
        </label>
        <label>出戰靈獸境界
          <select value={labBeastStage(profile, deployed)} onChange={event => set({ beastStages: { ...profile.beastStages, [deployed.beastId]: Number(event.target.value) } })}>
            {BEAST_STAGES.map((stage, index) => <option key={stage.stageId} value={index}>{stage.displayNameZh}</option>)}
          </select>
        </label>

        <h2>道侶</h2>
        <label>雙修
          <select value={profile.companionId ?? ""} onChange={event => set({ companionId: event.target.value || null })}>
            <option value="">不雙修</option>
            {companionCatalog.map(companion => <option key={companion.id} value={companion.id}>{companion.name}{unlockedCompanions.has(companion.id) ? "" : "（未解鎖）"}</option>)}
          </select>
        </label>
        <label>親密度
          <select value={profile.intimacy} onChange={event => set({ intimacy: Number(event.target.value) })}>
            {INTIMACY_THRESHOLDS.map((threshold, index) => <option key={threshold} value={threshold}>{index + 1} 級（{threshold}）</option>)}
          </select>
        </label>
        {profile.companionId && !unlockedCompanions.has(profile.companionId) && <small className="lab__warn">這位道侶在目前境界／塔層還沒解鎖，加成不會生效。</small>}

        <h2>靈丹</h2>
        <label>品質
          <select value={profile.pillQuality} onChange={event => set({ pillQuality: Number(event.target.value) })}>
            {QUALITY_NAMES.map((name, index) => <option key={name} value={index}>{name}</option>)}
          </select>
        </label>
        <div className="lab__pills">
          {PILL_CATALOG.map(pill => (
            <label key={pill.id}>{pill.name}（{pill.effect}）
              <input type="number" min={0} value={profile.pillCounts[pill.id] ?? 0} onChange={event => set({ pillCounts: { ...profile.pillCounts, [pill.id as PillId]: Math.max(0, Number(event.target.value) || 0) } })} />
            </label>
          ))}
        </div>
      </section>

      <section className="lab__results" aria-label="計算結果">
        <div className="lab__cards">
          <Card title="攻擊力" value={num(result.combat.attack)} />
          <Card title="暴擊率" value={pct(result.combat.critRate)} />
          <Card title="攻速" value={`${result.combat.attackSpeed.toFixed(2)} /秒`} />
          <Card title="主角 DPS" value={num(result.combat.dps)} />
          <Card title="靈獸助攻" value={`+${pct(result.beastShare)}`} note={deployed.nameZh} />
          <Card title="隊伍 DPS" value={num(result.teamDps)} />
          <Card title="通天塔估計" value={floorOf(result.towerReach)} note={`境界上限 ${floorOf(result.towerCap)}`} />
          <Card title="修為" value={`${num(result.cultivationPerSecond, 1)} /秒`} note={breakdown(result.parts.cultivation)} />
          <Card title="靈石" value={`${num(result.spiritStonesPerSecond, 2)} /秒`} note={breakdown(result.parts.spiritStones)} />
          <Card title="妖丹" value={`${num(result.demonCoresPerSecond, 2)} /秒`} note={breakdown(result.parts.demonCores)} />
          <Card title="下次突破" value={result.breakthroughRate === null ? "—" : pct(result.breakthroughRate)} note={result.breakthroughTarget ? `突破到${result.breakthroughTarget}（第一次嘗試）` : "已到最高境界"} />
        </div>

        <h2>再往前一步會怎樣</h2>
        <div className="lab__table-wrap">
          <table className="lab__table">
            <thead>
              <tr><th>系統</th><th>這一步</th>{COLUMNS.map(column => <th key={column.metric}>{column.label}</th>)}</tr>
            </thead>
            <tbody>
              {impacts.map(({ step, after }) => (
                <tr key={step.label} className={after ? "" : "is-off"}>
                  <td>{step.system}</td>
                  <td>{step.label}</td>
                  {COLUMNS.map(column => <td key={column.metric}>{after ? change(column, result, after) : "—"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="lab__notes">
          <li>攻擊、暴擊、攻速、DPS 與遊戲裡顯示的完全相同（有單元測試比對）。</li>
          <li>通天塔是估計值：只看「隊伍 DPS 是否達到該關需要的 DPS」，沒有算連招節奏和靈獸攻擊的間隔。</li>
          <li>靈丹是「這個品質吃了幾顆」的累計效果；遊戲每天每種最多吃 10 顆。</li>
          <li>遊歷的妖獸強度跟著主角攻擊力變，所以這些屬性不會讓遊歷變簡單，只有暴擊會。</li>
          <li>靈獸的持有加成按每隻靈獸目前的境界計算；左邊只能調出戰那隻的境界，其他已解鎖的靈獸按初始境界算。</li>
        </ul>
      </section>
    </main>
  );
}

const breakdown = (parts: Readonly<Record<string, number>>) => {
  const used = Object.entries(parts).filter(([, value]) => value > 0);
  return used.length ? used.map(([name, value]) => `${name} +${pct(value, 2)}`).join("・") : "沒有加成";
};

function Card({ title, value, note }: { readonly title: string; readonly value: string; readonly note?: string }): JSX.Element {
  return (
    <div className="lab__card">
      <span>{title}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

const LAB_CSS = `
:root { color-scheme: dark; }
body { margin: 0; background: #0d1824; color: #e8f1fa; font-family: "Noto Sans TC", "PingFang TC", system-ui, sans-serif; }
.lab { display: grid; grid-template-columns: minmax(260px, 320px) 1fr; gap: 16px; padding: 16px; max-width: 1500px; margin: 0 auto; }
.lab__header { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
.lab__header h1 { margin: 0; font-size: 24px; color: #f6dc96; }
.lab__header p { margin: 0; flex: 1 1 400px; color: #a9bccd; font-size: 14px; }
.lab button { background: #2a4560; color: #fff2d2; border: 1px solid #c8b078; border-radius: 6px; padding: 6px 12px; cursor: pointer; }
.lab__panel { min-width: 0; background: #142536; border: 1px solid #2c4560; border-radius: 10px; padding: 12px 14px; display: grid; gap: 6px; align-content: start; }
.lab__panel h2 { margin: 10px 0 0; font-size: 15px; color: #f6dc96; }
.lab__panel h2:first-child { margin-top: 0; }
.lab__panel label { display: grid; gap: 3px; font-size: 13px; color: #c9d8e6; }
.lab__panel select, .lab__panel input { width: 100%; min-width: 0; box-sizing: border-box; }
.lab__panel select, .lab__panel input[type=number] { background: #0d1824; color: #e8f1fa; border: 1px solid #36506b; border-radius: 5px; padding: 5px 6px; font-size: 14px; }
.lab__panel small { color: #8aa0b4; font-size: 12px; }
.lab__pills { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.lab__warn { color: #ffcf8a !important; }
.lab__results { display: grid; gap: 12px; align-content: start; min-width: 0; }
.lab__results h2 { margin: 6px 0 0; font-size: 17px; color: #f6dc96; }
.lab__cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.lab__card { background: #142536; border: 1px solid #2c4560; border-radius: 8px; padding: 8px 10px; display: grid; gap: 2px; }
.lab__card span { font-size: 12px; color: #8aa0b4; }
.lab__card strong { font-size: 19px; color: #ffffff; font-variant-numeric: tabular-nums; }
.lab__card small { font-size: 11px; color: #8aa0b4; line-height: 1.4; }
.lab__table-wrap { overflow-x: auto; border: 1px solid #2c4560; border-radius: 8px; }
.lab__table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.lab__table th, .lab__table td { padding: 6px 8px; border-bottom: 1px solid #22384f; text-align: right; white-space: nowrap; }
.lab__table th { background: #182c40; color: #c9d8e6; position: sticky; top: 0; }
.lab__table td:nth-child(1), .lab__table td:nth-child(2), .lab__table th:nth-child(1), .lab__table th:nth-child(2) { text-align: left; }
.lab__table td:nth-child(n+3) { color: #8fe3a0; }
.lab__table tr.is-off td { color: #5d7084; }
.lab__notes { margin: 0; padding-left: 18px; color: #a9bccd; font-size: 13px; line-height: 1.7; }
@media (max-width: 760px) { .lab { grid-template-columns: 1fr; } }
`;
