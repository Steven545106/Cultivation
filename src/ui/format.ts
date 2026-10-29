/** Player-facing number and time formats (zh-TW), shared by the panels and dialogs. */

export function formatFull(value: number): string {
  return new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 }).format(value);
}

/** 萬 / 億 above ten thousand, so large totals stay short. */
export function formatCompact(value: number): string {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(value >= 1_000_000_000 ? 1 : 2)}億`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(value >= 100_000 ? 1 : 2)}萬`;
  return formatFull(value);
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "—";
  const value = Math.max(0, Math.ceil(seconds));
  const days = Math.floor(value / 86400);
  const hours = Math.floor(value % 86400 / 3600);
  const minutes = Math.floor(value % 3600 / 60);
  const secs = value % 60;
  if (days > 0) return `${days}天${hours}時${minutes}分`;
  if (hours > 0) return `${hours}時${minutes}分`;
  if (minutes > 0) return `${minutes}分${secs}秒`;
  return `${secs}秒`;
}
