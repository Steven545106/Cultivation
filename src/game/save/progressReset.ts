/**
 * Wipes every local save so the next load starts a brand-new game. While a
 * reset is pending, both save services stop writing, so a late tick cannot
 * put the old progress back before the page reloads.
 */
export const LOCAL_SAVE_KEYS = ["bai-xiaochun-game-save-v1", "bai-xiaochun-cultivation-v1"] as const;

let resetPending = false;

export function isProgressResetPending(): boolean {
  return resetPending;
}

export function resetLocalProgress(): void {
  resetPending = true;
  try {
    for (const key of LOCAL_SAVE_KEYS) window.localStorage.removeItem(key);
  } catch {
    // Storage unavailable: nothing was persisted, so a reload is already a fresh start.
  }
  window.location.reload();
}
