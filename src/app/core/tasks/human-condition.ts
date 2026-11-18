/** Conditions use the canonical human namespace after schema normalization. */
export function isHumanActionOwner(owner: string | undefined): boolean {
  const normalized = owner?.trim();
  return normalized === "human" || (normalized?.startsWith("human:") === true && normalized.length > "human:".length);
}
