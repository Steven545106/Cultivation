import { useEffect, useRef, useState } from "react";
import { ALCHEMY_SUCCESS_RATE, ALCHEMY_DURATION_MS, ALCHEMIST_THRESHOLDS, PILL_CATALOG, PILL_DAILY_LIMIT, QUALITY_NAMES, alchemistLevel, alchemyCost, pillBonus, pillsTakenToday, type PillId } from "../../features/alchemy/Alchemy";
import { getDualAlchemySuccessBonus } from "../../features/companion/companionCatalog";
import { gameSaveCommands, type GameSaveData } from "../../features/persistence";
import { FurnaceFire } from "./FurnaceFire";
import { PillIcon } from "./PillIcon";

function formatAlchemyResult(result: NonNullable<GameSaveData["alchemy"]["lastResult"]>): string {
  const name = PILL_CATALOG.find(item => item.id === result.id)?.name ?? "丹藥";
  const successes = QUALITY_NAMES.flatMap((quality, index) => { const count = result.qualities.filter(value => value === index).length; return count ? [`${quality}${name} ${count} 顆`] : []; });
  const failures = result.qualities.filter(value => value < 0).length;
  return [...successes, ...(failures ? [`失敗 ${failures} 次`] : [])].join("、");
}

export function AlchemyPage({ navigation, save }: { readonly navigation: JSX.Element; readonly save: GameSaveData }): JSX.Element {
  const [id, setId] = useState<PillId>("attack");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(Date.now());
  const [showResult, setShowResult] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const wasBrewing = useRef(Boolean(save.alchemy.pending));
  useEffect(() => { if (!save.alchemy.pending) return undefined; setNow(Date.now()); const timer = window.setInterval(() => setNow(Date.now()), 100); return () => window.clearInterval(timer); }, [save.alchemy.pending?.startedAt]);
  useEffect(() => { if (save.alchemy.pending) { wasBrewing.current = true; setShowResult(false); } else if (wasBrewing.current && save.alchemy.lastResult) { wasBrewing.current = false; setShowResult(true); } }, [save.alchemy.pending, save.alchemy.lastResult]);
  const pill = PILL_CATALOG.find(item => item.id === id)!;
  const level = alchemistLevel(save.alchemy.attempts);
  const next = ALCHEMIST_THRESHOLDS[level + 1];
  const bonus = getDualAlchemySuccessBonus(save.activeCompanionId, save.tower.highestClearedStage, save.cultivation.realmId, save.activeCompanionId ? save.companionIntimacy[save.activeCompanionId] : 0);
  const consumed = save.alchemy.consumed[id];
  const count = consumed.reduce((a, b) => a + b, 0);
  const takenToday = pillsTakenToday(save.alchemy, id, Date.now());
  const dailyFull = takenToday >= PILL_DAILY_LIMIT;
  return <main className="weapon-library alchemy-page" aria-label="煉丹">{navigation}<section className="weapon-library__content alchemy-content">
    <div className="alchemy-layout">
    <div className="alchemy-visual">
      <div className={`alchemy-furnace${save.alchemy.pending ? " is-brewing" : ""}`} aria-label={save.alchemy.pending ? "丹爐正在煉製" : "丹爐靈火燃燒"} role="img"><img src="/assets/alchemy/immortal-furnace.png" alt="" /><FurnaceFire brewing={Boolean(save.alchemy.pending)} /></div>
    </div>
    <div className="alchemy-controls">
    <p className="eyebrow">丹火凝靈・以修為入藥</p><h1>煉丹</h1>
    <p>煉丹師：{QUALITY_NAMES[level]}・熟練度 {save.alchemy.attempts}{next !== undefined ? ` / ${next}` : "（已達最高）"}　成功率：{Math.round(Math.min(1, ALCHEMY_SUCCESS_RATE + bonus) * 100)}%</p>
    <p>可用修為：{save.cultivation.currentCultivation.toLocaleString("zh-TW")}　每次消耗：{alchemyCost(save.cultivation.realmId).toLocaleString("zh-TW")}</p>
    <div className="alchemy-selector">{PILL_CATALOG.map(item => <button key={item.id} type="button" className={item.id === id ? "is-active" : ""} onClick={() => { setId(item.id); setMessage(""); }}><PillIcon id={item.id} />{item.name}</button>)}</div>
    <h2>{pill.name}・{pill.effect}</h2><p>今日已服用 {takenToday} / {PILL_DAILY_LIMIT} 顆・累計已服用 {count} 顆・累計 +{(pillBonus(save.alchemy, id) * 100).toFixed(2)}{id === "crit" || id === "breakthrough" ? " 個百分點" : "%"}</p>
    <div className="alchemy-pill-grades" aria-label={`${pill.name}各品級外觀`}>{QUALITY_NAMES.map((name, quality) => <div key={name} className="alchemy-pill-grade"><PillIcon id={id} quality={quality}/><span>{name}</span></div>)}</div>
    <button type="button" disabled={!!save.alchemy.pending} onClick={() => { const result = gameSaveCommands.craftPill(id); setMessage(result.ok ? "" : result.message); }}>煉製 {pill.name}</button>
    <button type="button" disabled={!!save.alchemy.pending} onClick={() => { const result = gameSaveCommands.craftPill(id, 10); setMessage(result.ok ? "" : result.message); }}>一次煉 10 顆（消耗 { (alchemyCost(save.cultivation.realmId) * 10).toLocaleString("zh-TW") } 修為）</button>
    <button type="button" onClick={() => setShowInventory(true)}>丹藥背包</button>
    {save.alchemy.pending ? <div className="alchemy-timer"><p>丹火淬煉中・剩餘 {Math.max(0, Math.ceil((save.alchemy.pending.startedAt + ALCHEMY_DURATION_MS - now) / 1000))} 秒</p><div className="alchemy-progress" role="progressbar" aria-label="煉丹進度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.max(0, Math.min(1, (now - save.alchemy.pending.startedAt) / ALCHEMY_DURATION_MS)) * 100)}><span style={{ width: `${Math.max(0, Math.min(1, (now - save.alchemy.pending.startedAt) / ALCHEMY_DURATION_MS)) * 100}%` }} /></div></div> : message ? <span role="status">{message}</span> : save.alchemy.lastResult && <p role="status">煉製結果：{formatAlchemyResult(save.alchemy.lastResult)}</p>}
    </div>
    </div>
    {showInventory && <div className="alchemy-result-overlay" onClick={() => setShowInventory(false)}><section className="alchemy-result alchemy-inventory" role="dialog" aria-modal="true" aria-labelledby="alchemy-inventory-title" onClick={event => event.stopPropagation()}><h2 id="alchemy-inventory-title">{pill.name}・丹藥背包</h2><p>今日已服用 {takenToday} / {PILL_DAILY_LIMIT} 顆（每天 0 點重置）・累計已服用 {count} 顆</p>{message && <p role="status">{message}</p>}<div className="alchemy-table-wrap"><table className="alchemy-table"><thead><tr><th>品級</th><th>持有</th><th>已服用</th><th>操作</th></tr></thead><tbody>
      {QUALITY_NAMES.map((name, quality) => { const owned = save.alchemy.inventory[id][quality]; return <tr key={name}><td><span className="alchemy-grade-label"><PillIcon id={id} quality={quality}/>{name}</span></td><td>{owned}</td><td>{consumed[quality]}</td><td><button type="button" disabled={!owned || dailyFull} onClick={() => { setMessage(gameSaveCommands.consumeAlchemyPill(id, quality) ? "服用成功。" : "無法服用。"); }}>{dailyFull ? "今日已滿" : "服用"}</button> <button type="button" disabled={!owned} onClick={() => { const input = window.prompt(`要丟棄幾顆${name}${pill.name}？目前持有 ${owned} 顆。`, "1"); if (input === null) return; const amount = Number(input.trim()); if (!Number.isSafeInteger(amount) || amount < 1 || amount > owned) { window.alert(`請輸入 1 至 ${owned} 的整數。`); return; } if (!window.confirm(`確定丟棄 ${amount} 顆${name}${pill.name}？丟棄後無法復原。`)) return; const ok = gameSaveCommands.discardAlchemyPill(id, quality, amount); window.alert(ok ? `已丟棄 ${amount} 顆${name}${pill.name}。` : "丟棄失敗，請確認背包數量及雲端連線。"); }}>丟棄</button></td></tr>; })}
    </tbody></table></div><button type="button" onClick={() => setShowInventory(false)}>關閉</button></section></div>}
    {showResult && save.alchemy.lastResult && <div className="alchemy-result-overlay" onClick={() => setShowResult(false)}><section className="alchemy-result" role="dialog" aria-modal="true" aria-labelledby="alchemy-result-title" onClick={event => event.stopPropagation()}><p className="eyebrow">丹火漸息・爐開見真章</p><h2 id="alchemy-result-title">{save.alchemy.lastResult.qualities.some(quality => quality >= 0) ? "煉製完成" : "煉製失敗"}</h2><div className="alchemy-result-pills">{QUALITY_NAMES.map((name, quality) => { const amount = save.alchemy.lastResult?.qualities.filter(value => value === quality).length ?? 0; return amount > 0 && <div key={name}><PillIcon id={save.alchemy.lastResult!.id} quality={quality}/><span>{name} × {amount}</span></div>; })}</div><p>{formatAlchemyResult(save.alchemy.lastResult)}</p><button type="button" onClick={() => setShowResult(false)}>確認</button></section></div>}
  </section></main>;
}
