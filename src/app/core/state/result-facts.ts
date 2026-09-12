/** Read the old result spelling at known storage fields only. Never rewrite App payloads or events. */
export function storedResultFacts<T extends { facts?: string[] }>(value: T): T {
  const stored = value as T & { evidence?: unknown };
  if (!("evidence" in stored)) return value;
  if (stored.facts === undefined) {
    if (!Array.isArray(stored.evidence) || !stored.evidence.every((fact) => typeof fact === "string"))
      throw new Error("Invalid retained result facts");
    stored.facts = stored.evidence;
  }
  delete stored.evidence;
  return stored;
}
