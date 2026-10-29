import { useEffect } from "react";
import type { AwaySummary } from "../game/save/awaySummary";
import { formatCompact, formatDuration, formatFull } from "./format";

/** "While you were away": what idle cultivation earned, shown once when the player returns. */
export function AwaySummaryDialog({ summary, characterName, onClose }: { readonly summary: AwaySummary; readonly characterName: string; readonly onClose: () => void }): JSX.Element {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" || event.key === "Enter") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const advanced = summary.fromStageNameZh !== summary.toStageNameZh;
  return (
    <div className="away-summary" role="dialog" aria-modal="true" aria-labelledby="away-summary-title" onClick={onClose}>
      <section className="away-summary__sheet" onClick={event => event.stopPropagation()}>
        <p className="eyebrow">閉關歸來</p>
        <h2 id="away-summary-title">離線收益</h2>
        <p className="away-summary__time">{characterName}獨自修練了 {formatDuration(summary.seconds)}</p>
        <dl className="away-summary__gains">
          <div><dt>修為</dt><dd title={formatFull(summary.cultivation)}>+{formatCompact(summary.cultivation)}</dd></div>
          <div><dt>靈石</dt><dd title={formatFull(summary.spiritStones)}>+{formatCompact(summary.spiritStones)}</dd></div>
          <div><dt>妖丹</dt><dd title={formatFull(summary.demonCores)}>+{formatCompact(summary.demonCores)}</dd></div>
        </dl>
        <p className="away-summary__realm">{advanced ? `境界：${summary.fromStageNameZh} → ${summary.toStageNameZh}` : `境界：${summary.toStageNameZh}`}</p>
        {summary.breakthroughToNameZh && <p className="away-summary__ready">修為已圓滿，可以突破至{summary.breakthroughToNameZh}！</p>}
        <button type="button" className="away-summary__collect" onClick={onClose} autoFocus>收下</button>
      </section>
    </div>
  );
}
