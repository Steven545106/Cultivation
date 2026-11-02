import { describe, expect, it } from "vitest";
import { getMount, mountCatalog, MOUNT_MAX_LEVEL } from "./MountCatalog";
import { createMountProgress, deployMount, getDeployedMountBonuses, getMountBonus, getMountUpgradeCost, isMountUnlocked, readMountProgress, upgradeMount } from "./MountRules";

describe("mounts", () => {
  it("starts with 破涅 owned at level 1 and deployed", () => {
    const progress = readMountProgress({});
    expect(progress).toEqual(createMountProgress());
    expect(getDeployedMountBonuses(progress).cultivationSpeed).toBeCloseTo(0.03);
  });

  it("only mounts with art and no unlock condition are open", () => {
    expect(mountCatalog.filter(isMountUnlocked).map(mount => mount.nameZh)).toEqual(["破涅"]);
  });

  it("mends saved progress: clamps levels and drops unknown or locked mounts", () => {
    const progress = readMountProgress({ mounts: { deployedMountId: "cangming-dragon", levels: { ponie: 99, "cangming-dragon": 5, nope: 3 } } });
    expect(progress.levels).toEqual({ ponie: MOUNT_MAX_LEVEL });
    expect(progress.deployedMountId).toBe("ponie");
  });

  it("raises the bonus a little each level", () => {
    const ponie = getMount("ponie");
    expect(getMountBonus(ponie, 0)).toBe(0);
    expect(getMountBonus(ponie, 2)).toBeCloseTo(0.0325);
    expect(getMountBonus(ponie, MOUNT_MAX_LEVEL)).toBeCloseTo(0.03 + 0.0025 * 19);
  });

  it("upgrades for spirit stones until the top level", () => {
    const start = createMountProgress();
    expect(upgradeMount(start, "ponie", 100)).toEqual({ ok: false, reason: "insufficient-spirit-stones", cost: 2000 });
    const done = upgradeMount(start, "ponie", 5000);
    expect(done.ok && done.progress.levels.ponie).toBe(2);
    expect(done.ok && done.cost).toBe(2000);
    const maxed = { ...start, levels: { ponie: MOUNT_MAX_LEVEL } };
    expect(upgradeMount(maxed, "ponie", 1e12)).toEqual({ ok: false, reason: "max-level" });
    expect(getMountUpgradeCost(MOUNT_MAX_LEVEL)).toBeNull();
    expect(upgradeMount(start, "xuepo-deer", 1e12)).toEqual({ ok: false, reason: "locked" });
  });

  it("deploys only an owned mount", () => {
    const start = createMountProgress();
    expect(deployMount(start, "chiyan-qilin")).toBe(start);
    expect(deployMount(start, "ponie").deployedMountId).toBe("ponie");
  });
});
