import { afterEach, describe, expect, it, vi } from "vitest";
import { RealTimeCultivationService } from "./RealTimeCultivationService";
import { createCultivationState } from "../../features/cultivation/domain/CultivationState";

describe("real-time cultivation service", () => {
  afterEach(() => vi.useRealTimers());

  it("settles offline time with the bonuses supplied at startup, not ×1", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const service = new RealTimeCultivationService();
    // 1,000 s pass (offline) before the save is loaded with its +50% bonus.
    vi.setSystemTime(2_000_000);
    service.hydrateFromSave(createCultivationState(1_000_000), 1.5);
    // 凝氣一層 cultivates 2 per second.
    expect(service.getSnapshot().totalCultivationEarned).toBe(3_000);
  });

  it("settles the time so far at the old rate when the bonus changes later", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const service = new RealTimeCultivationService();
    service.setRateMultiplier(1);
    vi.setSystemTime(1_100_000);
    service.setRateMultiplier(2);
    vi.setSystemTime(1_200_000);
    service.settle();
    expect(service.getSnapshot().totalCultivationEarned).toBe(100 * 2 + 100 * 4);
  });
});
