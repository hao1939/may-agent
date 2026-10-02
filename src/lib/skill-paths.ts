import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

/** Shared by discovery and release checks; additional roots do not load more path files. */
export function resolveSkillRoots(root: string, diagnostics: string[]): string[] {
  const pathsFile = join(root, "paths.json");
  const roots = existsSync(root) ? [realpathSync(root)] : [];
  if (!existsSync(pathsFile)) return roots;
  let paths: unknown;
  try {
    paths = JSON.parse(readFileSync(pathsFile, "utf8"));
    if (!Array.isArray(paths) || paths.some((path) => typeof path !== "string" || !path.trim() || isAbsolute(path))) {
      throw new Error("Expected an array of non-empty relative directory paths");
    }
  } catch (err) {
    diagnostics.push(`${pathsFile}: ${err instanceof Error ? err.message : String(err)}`);
    return roots;
  }
  for (const path of paths as string[]) {
    try {
      const target = realpathSync(resolve(root, path));
      if (!statSync(target).isDirectory()) throw new Error("Expected a directory");
      roots.push(target);
    } catch (err) {
      diagnostics.push(`${pathsFile}: ${path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return [...new Set(roots)];
}
