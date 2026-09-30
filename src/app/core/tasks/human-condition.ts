const LEGACY_HAO_HUMAN_OWNER = "Hao";

/** Canonical human owner, plus the retained legacy Hao read projection. */
export function isHumanActionOwner(owner: string | undefined): boolean {
  const normalized = owner?.trim();
  if (normalized === "human" || (normalized?.startsWith("human:") === true && normalized.length > "human:".length)) {
    return true;
  }
  return normalized === LEGACY_HAO_HUMAN_OWNER;
}
