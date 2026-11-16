import { resolve, join } from "node:path";
import { resolveCaseDirectory } from "../../src/cases/catalog";
const root = resolve(import.meta.dirname, "../..");
/** Prefer the current owner; use preserved historical fixtures only when retired. */
export function casePath(id: string, ...parts: string[]): string {
  const dir = resolveCaseDirectory(root, id, true);
  if (!dir) throw new Error(`Unknown test fixture case: ${id}`);
  return join(dir, ...parts);
}
