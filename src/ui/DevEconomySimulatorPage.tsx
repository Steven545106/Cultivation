import { useMemo, useState } from "react";
import {
  createEconomyTimeline,
  forecastRefinementTimes,
  type BreakthroughSimulationMode,
  type EconomySimulationOptions,
  type EconomySimulationResult,
  type RefinementTimeForecast,
} from "../features/cultivation";

function format(value: number): string {
  return value.toLocaleString("zh-TW", { maximumFractionDigits: 0 });
}

function formatDays(days: number | null): string {
  return days === null ? "30 天內無法達成" : `${days.toFixed(2)} 天`;
}

function TimelineTable({ title, rows }: { title: string; rows: readonly EconomySimulationResult[] }): JSX.Element {
  return (
    <section className="dev-economy__scenario">
      <h2>{title}</h2>
      <div className="dev-economy__table-wrap">
        <table>
          <thead><tr><th>天數</th><th>境界</th><th>歷史修為</th><th>可用修為</th><th>修為/秒</th><th>靈石</th><th>+11</th><th>+21</th><th>+30</th></tr></thead>
          <tbody>
            {rows.map(row => (
              <tr key={`${title}-${row.days}`}>
                <td>{row.days}</td><td>{row.realmName}</td><td>{format(row.totalCultivationEarned)}</td><td>{format(row.currentCultivation)}</td>
                <td>{format(row.cultivationRate)}</td><td>{format(row.spiritStones)}</td>
                <td>{row.affordableWeaponsAtPlus11}</td><td>{row.affordableWeaponsAtPlus21}</td><td>{row.affordableWeaponsAtPlus30}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Forecast({ title, forecasts }: { title: string; forecasts: readonly RefinementTimeForecast[] }): JSX.Element {
  return (
    <section className="dev-economy__forecast">
      <h2>{title}</h2>
      {forecasts.map(forecast => <p key={forecast.targetLevel}>第一把仙劍 +{forecast.targetLevel}（{format(forecast.totalCost)} 靈石）：<strong>{formatDays(forecast.days)}</strong></p>)}
    </section>
  );
}

/** Isolated developer route: it uses only pure domain functions and never initializes the game save service. */
export function DevEconomySimulatorPage(): JSX.Element {
  const [days, setDays] = useState(7);
  const [cultivationRateMultiplier, setCultivationRateMultiplier] = useState(1);
  const [spiritStoneRateMultiplier, setSpiritStoneRateMultiplier] = useState(1);
  const [mode, setMode] = useState<BreakthroughSimulationMode>("immediate");
  const [delayHours, setDelayHours] = useState(6);

  const baselineOptions: EconomySimulationOptions = { days, mode, manualBreakthroughDelaySeconds: delayHours * 3600 };
  const adjustedOptions: EconomySimulationOptions = { ...baselineOptions, cultivationRateMultiplier, spiritStoneRateMultiplier };
  const baselineRows = useMemo(() => createEconomyTimeline(baselineOptions), [days, mode, delayHours]);
  const adjustedRows = useMemo(() => createEconomyTimeline(adjustedOptions), [days, mode, delayHours, cultivationRateMultiplier, spiritStoneRateMultiplier]);
  const baselineForecast = useMemo(() => forecastRefinementTimes({ mode, manualBreakthroughDelaySeconds: delayHours * 3600 }), [mode, delayHours]);
  const adjustedForecast = useMemo(() => forecastRefinementTimes({ mode, manualBreakthroughDelaySeconds: delayHours * 3600, cultivationRateMultiplier, spiritStoneRateMultiplier }), [mode, delayHours, cultivationRateMultiplier, spiritStoneRateMultiplier]);
  const finalBaseline = baselineRows[baselineRows.length - 1];
  const finalAdjusted = adjustedRows[adjustedRows.length - 1];

  return (
    <main className="dev-economy" aria-label="經濟平衡模擬器">
      <section className="dev-economy__content">
        <button type="button" className="home-button" onClick={() => { window.location.assign("/"); }}>返回遊戲</button>
        <p className="eyebrow">Developer Tool・完全隔離正式存檔</p>
        <h1>經濟平衡模擬器</h1>
        <p>本頁只使用境界、靈石與煉靈 Domain 規則進行預測；不初始化 Supabase、localStorage 或玩家存檔。</p>

        <section className="dev-economy__controls" aria-label="模擬設定">
          <label>模擬天數：{days}<input type="range" min="0" max="30" step="1" value={days} onChange={event => setDays(Number(event.target.value))} /></label>
          <label>修為倍率：{cultivationRateMultiplier.toFixed(2)}×<input type="range" min="0.1" max="10" step="0.1" value={cultivationRateMultiplier} onChange={event => setCultivationRateMultiplier(Number(event.target.value))} /></label>
          <label>靈石倍率：{spiritStoneRateMultiplier.toFixed(2)}×<input type="range" min="0.1" max="10" step="0.1" value={spiritStoneRateMultiplier} onChange={event => setSpiritStoneRateMultiplier(Number(event.target.value))} /></label>
          <label>大境界策略
            <select value={mode} onChange={event => setMode(event.target.value as BreakthroughSimulationMode)}>
              <option value="immediate">可突破時立即突破</option>
              <option value="delayed">延遲後手動突破</option>
              <option value="never">不進行大境界突破</option>
            </select>
          </label>
          {mode === "delayed" && <label>突破延遲：{delayHours} 小時<input type="range" min="0" max="48" step="1" value={delayHours} onChange={event => setDelayHours(Number(event.target.value))} /></label>}
        </section>

        <section className="dev-economy__summary">
          <div><span>原始設定在第 {days} 天</span><strong>{finalBaseline.realmName}</strong><small>{finalBaseline.realmName === "永恆" ? "已達永恆" : "尚未達永恆"}・可滿煉 {finalBaseline.affordableWeaponsAtPlus30} 把</small></div>
          <div><span>調整設定在第 {days} 天</span><strong>{finalAdjusted.realmName}</strong><small>{finalAdjusted.realmName === "永恆" ? "已達永恆" : "尚未達永恆"}・可滿煉 {finalAdjusted.affordableWeaponsAtPlus30} 把</small></div>
        </section>

        <Forecast title="原始設定：煉靈時間預測" forecasts={baselineForecast} />
        <Forecast title="調整設定：煉靈時間預測" forecasts={adjustedForecast} />
        <TimelineTable title="原始設定" rows={baselineRows} />
        <TimelineTable title="調整後設定" rows={adjustedRows} />
      </section>
    </main>
  );
}
