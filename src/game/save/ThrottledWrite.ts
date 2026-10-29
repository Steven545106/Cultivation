/** Local saves from the idle tick go to storage at most this often; actions and leaving the page write at once. */
export const IDLE_SAVE_INTERVAL_MS = 5_000;

/**
 * Coalesces storage writes: `request` writes at most once per interval (the
 * latest state, when the interval is up), `now` and `flush` write a pending
 * change at once. Idle progress is settled from timestamps, so a write that is
 * still pending when the page dies loses nothing: the next load settles it.
 */
export class ThrottledWrite {
  private lastWriteAt = Number.NEGATIVE_INFINITY;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending = false;

  public constructor(private readonly write: () => void, private readonly intervalMs = IDLE_SAVE_INTERVAL_MS) {}

  public request(): void {
    this.pending = true;
    const wait = this.lastWriteAt + this.intervalMs - Date.now();
    if (wait <= 0) this.flush();
    else this.timer ??= setTimeout(() => this.flush(), wait);
  }

  public now(): void {
    this.pending = true;
    this.flush();
  }

  public flush = (): void => {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    if (!this.pending) return;
    this.pending = false;
    this.lastWriteAt = Date.now();
    this.write();
  };
}
