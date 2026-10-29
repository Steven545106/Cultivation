export const DEFAULT_CHARACTER_NAME = "玩家";
export const MAX_CHARACTER_NAME_LENGTH = 16;

export function validateCharacterName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (!name || Array.from(name).length > MAX_CHARACTER_NAME_LENGTH || /[\u0000-\u001f\u007f]/u.test(name)) return null;
  return name;
}

export function normalizeCharacterName(value: unknown): string {
  const name = validateCharacterName(value);
  return name === "白小純" ? DEFAULT_CHARACTER_NAME : name ?? DEFAULT_CHARACTER_NAME;
}
