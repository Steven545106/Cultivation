import { afterEach, describe, expect, it, vi } from "vitest";
import { ThrottledWrite } from "./ThrottledWrite";

describe("throttled save writes", () => {
  afterEach(() => vi.useRealTimers());

  it("writes the first request at once, then at most once per interval", () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const writer = new ThrottledWrite(write, 5_000);
    writer.request();
    expect(write).toHaveBeenCalledTimes(1);
    for (let second = 1; second <= 4; second += 1) {
      vi.advanceTimersByTime(1_000);
      writer.request();
    }
    expect(write).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1_000);
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("writes at once for actions and when flushed, and never writes with nothing pending", () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const writer = new ThrottledWrite(write, 5_000);
    writer.request();
    writer.request();
    writer.flush();
    expect(write).toHaveBeenCalledTimes(2);
    writer.now();
    expect(write).toHaveBeenCalledTimes(3);
    writer.flush();
    vi.advanceTimersByTime(10_000);
    expect(write).toHaveBeenCalledTimes(3);
  });
});
