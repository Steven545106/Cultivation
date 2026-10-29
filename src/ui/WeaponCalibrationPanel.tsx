import { useEffect, useState } from "react";
import type { GameRuntime, RuntimeCalibration } from "../game/GameRuntime";
import type { NormalizedPoint } from "../game/weapons/WeaponConfig";

const controls: Array<{ key: keyof Pick<RuntimeCalibration, "scale" | "offsetX" | "offsetY" | "rotation">; label: string; min: number; max: number; step: number }> = [
  { key: "scale", label: "武器大小", min: 0.5, max: 1.6, step: 0.01 },
  { key: "offsetX", label: "手部 X 偏移", min: -100, max: 100, step: 1 },
  { key: "offsetY", label: "手部 Y 偏移", min: -100, max: 100, step: 1 },
  { key: "rotation", label: "握持角度", min: -90, max: 90, step: 1 },
];

const points: Array<{ key: "gripPoint" | "bladeStart" | "tip"; label: string }> = [
  { key: "gripPoint", label: "握點" },
  { key: "bladeStart", label: "劍身起點" },
  { key: "tip", label: "劍尖" },
];

interface PanelState {
  readonly calibration: RuntimeCalibration;
  readonly weaponId: string;
  readonly weaponName: string;
  readonly defaults: Record<"gripPoint" | "bladeStart" | "tip", NormalizedPoint>;
  readonly customized: boolean;
  readonly saved: string;
}

function readState(runtime: GameRuntime): PanelState {
  const weapon = runtime.weaponLoadout.getEquipped();
  return {
    calibration: runtime.calibration,
    weaponId: weapon.weaponId,
    weaponName: weapon.nameZh,
    defaults: { gripPoint: weapon.gripPoint, bladeStart: weapon.bladeGeometry.bladeStart, tip: weapon.bladeGeometry.tip },
    customized: runtime.weaponCalibrations.isCustomized(weapon.weaponId),
    saved: JSON.stringify({ weaponCalibrations: runtime.weaponCalibrations.getAll() }, null, 2),
  };
}

/**
 * Development live controls. Each sword keeps its own calibration in this
 * browser (offsets plus grip / blade-start / tip in 0–1 of its image) and can
 * be reset to its defaults; the JSON is never written to source files.
 */
export function WeaponCalibrationPanel({ runtime }: { runtime: GameRuntime | null }): JSX.Element | null {
  const [state, setState] = useState<PanelState | null>(runtime ? readState(runtime) : null);
  const [showExport, setShowExport] = useState(false);
  // Dev tool: collapsed by default so it never covers the battle.
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!runtime) return undefined;
    const sync = () => setState(readState(runtime));
    sync();
    return runtime.subscribeToCalibration(sync);
  }, [runtime]);

  if (!runtime || !state) return null;
  const { calibration } = state;
  const update = (change: Partial<RuntimeCalibration>) => runtime.updateCalibration(change);
  const updatePoint = (key: "gripPoint" | "bladeStart" | "tip", axis: "x" | "y", value: number) => {
    const current = calibration[key] ?? state.defaults[key];
    update({ [key]: { ...current, [axis]: value } });
  };

  return (
    <aside className={expanded ? "calibration-panel" : "calibration-panel is-collapsed"} aria-label="武器校準工具">
      <button className="calibration-panel__toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
        <strong>{expanded ? "武器校準（即時預覽）" : "武器校準"}</strong>
        <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && <>
      <p className="calibration-panel__weapon">{state.weaponName}{state.customized ? "・已自訂（存在此瀏覽器）" : "・預設值"}</p>
      {controls.map(control => (
        <label className="calibration-control" key={control.key}>
          <span>{control.label}：{calibration[control.key]}</span>
          <input type="range" min={control.min} max={control.max} step={control.step} value={calibration[control.key]}
            onChange={event => update({ [control.key]: Number(event.target.value) })} />
        </label>
      ))}
      <fieldset className="calibration-points">
        <legend>劍身幾何（圖片比例 0–1）</legend>
        {points.map(point => {
          const value = calibration[point.key] ?? state.defaults[point.key];
          return (
            <div className="calibration-point" key={point.key}>
              <span>{point.label}{calibration[point.key] ? "＊" : ""}</span>
              {(["x", "y"] as const).map(axis => (
                <label key={axis}>
                  {axis.toUpperCase()}
                  <input type="number" min={0} max={1} step={0.005} value={value[axis]} aria-label={`${point.label} ${axis.toUpperCase()}`}
                    onChange={event => updatePoint(point.key, axis, Number(event.target.value))} />
                </label>
              ))}
            </div>
          );
        })}
      </fieldset>
      <div className="calibration-reset">
        <button type="button" disabled={!state.customized} onClick={() => runtime.resetWeaponCalibration("equipped")}>還原此劍預設</button>
        <button type="button" onClick={() => runtime.resetWeaponCalibration("all")}>全部還原</button>
      </div>
      <div className="debug-toggles">
        <label><input type="checkbox" checked={calibration.showSockets} onChange={event => update({ showSockets: event.target.checked })} /> 顯示掛點</label>
        <label><input type="checkbox" checked={calibration.showHitbox} onChange={event => update({ showHitbox: event.target.checked })} /> 顯示劍身判定</label>
      </div>
      <label className="calibration-control">
        <span>播放速度：{calibration.playbackRate}x</span>
        <select value={calibration.playbackRate} onChange={event => update({ playbackRate: Number(event.target.value) })}>
          <option value={0.25}>0.25x</option><option value={0.5}>0.5x</option><option value={1}>1x</option>
        </select>
      </label>
      <button className="export-button" type="button" onClick={() => setShowExport(value => !value)}>顯示校準 JSON</button>
      {showExport && <textarea className="export-json" aria-label="校準 JSON" readOnly value={state.saved} />}
      </>}
    </aside>
  );
}
