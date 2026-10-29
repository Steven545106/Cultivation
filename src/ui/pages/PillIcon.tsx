import { useId } from "react";
import type { PillId } from "../../features/alchemy/Alchemy";

interface PillIconProps { readonly id: PillId; readonly quality?: number }

const MATERIAL: Record<PillId, readonly [string, string, string, string]> = {
  attack: ["#f7a064", "#be5439", "#742d2a", "#e9ad77"],
  crit: ["#91c9df", "#426989", "#263b5b", "#b9d5e8"],
  speed: ["#a9e8ad", "#58ae88", "#286b61", "#c9ebba"],
  cultivation: ["#b6edb3", "#58ad84", "#2b6f62", "#d0efd0"],
  stones: ["#ffe1a2", "#d6a353", "#865b30", "#f6d999"],
  cores: ["#d3a5de", "#815c91", "#463656", "#dfbde8"],
  breakthrough: ["#f6c5bc", "#d78995", "#8b526f", "#ffe1ca"],
};

/** All recipes are round alchemy beads; only the material and engraved seal differ. */
export function PillIcon({ id, quality }: PillIconProps): JSX.Element {
  const gradientId = useId();
  const [light, body, dark, rim] = MATERIAL[id];
  const grade = quality === undefined ? "plain" : Math.max(0, Math.min(5, quality));
  return <span className={`alchemy-pill alchemy-pill--${id} alchemy-pill--quality-${grade}`} aria-hidden="true">
    <svg viewBox="0 0 100 100" focusable="false">
      <defs><radialGradient id={gradientId} cx="33%" cy="25%" r="78%"><stop offset="0" stopColor={light}/><stop offset=".48" stopColor={body}/><stop offset="1" stopColor={dark}/></radialGradient></defs>
      <circle cx="50" cy="50" r="42" fill={dark} stroke={rim} strokeWidth="3"/>
      <circle cx="50" cy="50" r="36" fill={`url(#${gradientId})`} stroke={rim} strokeOpacity=".65" strokeWidth="1.5"/>
      <path d="M24 39c4-12 13-20 25-22" fill="none" stroke="#fff8e4" strokeOpacity=".52" strokeWidth="4" strokeLinecap="round"/>
      <path d="M66 79c-8 4-17 5-25 2" fill="none" stroke="#251e28" strokeOpacity=".3" strokeWidth="3" strokeLinecap="round"/>
      {id === "attack" && <><path d="m30 63 12-22 8 11 9-19 12 30Z" fill="#753029" stroke="#ffd18d" strokeWidth="2.5" strokeLinejoin="round"/><path d="m50 29 7 17-7 21-6-14Z" fill="#ffe4ad"/></>}
      {id === "crit" && <><circle cx="50" cy="51" r="22" fill="none" stroke="#c7edfa" strokeOpacity=".8" strokeWidth="2"/><path d="m50 26 6 19 18 6-18 6-6 19-6-19-18-6 18-6Z" fill="#eaf9ff"/><circle cx="50" cy="51" r="6" fill="#83d9f5"/></>}
      {id === "speed" && <><path d="M33 67c23-2 35-17 35-39-20 6-38 19-35 39Z" fill="#d5f4be" stroke="#2e7667" strokeWidth="2"/><path d="M36 69c10-13 21-22 32-30M28 40l11-2M25 51l10-2" fill="none" stroke="#f0ffe4" strokeWidth="3" strokeLinecap="round"/></>}
      {id === "cultivation" && <><path d="M51 27c-23 0-30 29-12 36 15 6 28-8 20-19-7-9-22-3-17 7 2 5 9 5 12 1" fill="none" stroke="#e0ffe2" strokeWidth="5" strokeLinecap="round"/><path d="M31 69c11-3 18 1 20 10M69 66c-10 1-16 5-18 13" fill="none" stroke="#a8e5b2" strokeWidth="3" strokeLinecap="round"/></>}
      {id === "stones" && <><circle cx="50" cy="50" r="23" fill="none" stroke="#ffe6ad" strokeWidth="3"/><path d="M39 37h22v26H39z" fill="#865b30" stroke="#fff0bf" strokeWidth="3"/><path d="M46 44h8v12h-8z" fill="#ffe2a1"/><circle cx="50" cy="27" r="2" fill="#fff4ce"/><circle cx="50" cy="73" r="2" fill="#fff4ce"/></>}
      {id === "cores" && <><path d="M33 39c0-8 4-13 10-15-2 7 1 11 7 13 6-2 9-6 7-13 6 2 10 7 10 15" fill="none" stroke="#e7c7eb" strokeWidth="3" strokeLinecap="round"/><path d="m36 47 12 16-5 11m21-27L52 63l5 11M50 42l-5 15 5 10 5-10Z" fill="none" stroke="#efc8ea" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="50" cy="56" r="4" fill="#a7e4dc"/></>}
      {id === "breakthrough" && <><path d="M50 29c9 9 11 17 0 26-11-9-9-17 0-26ZM29 44c12 0 21 7 21 20-13-1-21-8-21-20ZM71 44c-12 0-21 7-21 20 13-1 21-8 21-20Z" fill="#ffe1cb" stroke="#ad657c" strokeWidth="2"/><path d="M32 64c12-7 24-7 36 0-4 9-10 14-18 14s-14-5-18-14Z" fill="#f5b6ad"/><circle cx="50" cy="62" r="6" fill="#fff3da"/></>}
    </svg>
  </span>;
}
