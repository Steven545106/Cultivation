import { describe, expect, it } from "vitest";
import { normalizeCharacterName, validateCharacterName } from "./characterName";

describe("角色名稱", () => {
  it("保留有效名稱並移除前後空白", () => {
    expect(validateCharacterName(" 小仙人 ")).toBe("小仙人");
    expect(normalizeCharacterName("小仙人")).toBe("小仙人");
  });
  it("舊存檔或無效名稱使用預設名稱", () => {
    expect(normalizeCharacterName(undefined)).toBe("玩家");
    expect(normalizeCharacterName("白小純")).toBe("玩家");
    expect(validateCharacterName("  ")).toBeNull();
    expect(validateCharacterName("仙".repeat(17))).toBeNull();
    expect(validateCharacterName("仙\n人")).toBeNull();
  });
});
