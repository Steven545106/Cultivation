import { describe, expect, it } from "vitest";
import { getMount, mountCatalog, MOUNT_MAX_LEVEL } from "./MountCatalog";
import { createMountProgress, deployMount, getDeployedMountBonuses, getMountBonus, getMountUpgradeCost, isMountUnlocked, readMountProgress, upgradeMount } from "./MountRules";

describe("mounts", () => {
  it("starts with 破涅 owned at level 1 and deployed", () => {
    const progress = readMountProgress({}, 0);
    expect(progress).toEqual(createMountProgress());
    expect(getDeployedMountBonuses(progress).cultivationSpeed).toBeCloseTo(0.03);
  });

  it("opens a drawn mount once its tower stage is cleared", () => {
    expect(mountCatalog.filter(mount => isMountUnlocked(mount, 0)).map(mount => mount.nameZh)).toEqual(["破涅"]);
    expect(mountCatalog.filter(mount => isMountUnlocked(mount, 200)).map(mount => mount.nameZh)).toEqual(["破涅", "碧靈仙鹿"]);
    expect(readMountProgress({}, 200).levels).toEqual({ ponie: 1, "biling-deer": 1 });
  });

  it("碧靈仙鹿 raises the spirit stone speed when deployed", () => {
    const progress = { deployedMountId: "biling-deer" as const, levels: { ponie: 1, "biling-deer": 3 } };
    expect(getDeployedMountBonuses(progress)).toEqual({ cultivationSpeed: 0, spiritStoneSpeed: expect.closeTo(0.046, 5) });
  });

  it("mends saved progress: clamps levels and drops unknown or locked mounts", () => {
    const progress = readMountProgress({ mounts: { deployedMountId: "biling-deer", levels: { ponie: 99, "biling-deer": 5, "cangming-dragon": 5, nope: 3 } } }, 0);
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
    expect(upgradeMount(start, "biling-deer", 1e12)).toEqual({ ok: false, reason: "locked" });
  });

  it("deploys only an owned mount", () => {
    const start = createMountProgress();
    expect(deployMount(start, "chiyan-qilin")).toBe(start);
    expect(deployMount(start, "ponie").deployedMountId).toBe("ponie");
  });
});
