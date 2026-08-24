import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export function resolveAppDir(projectDir: string, explicitAppDir?: string): string {
  if (explicitAppDir) return explicitAppDir;
  const siblingAppDir = projectDir.endsWith(".app") ? projectDir : `${projectDir}.app`;
  if (existsSync(join(siblingAppDir, "project.json"))) return siblingAppDir;
  throw new Error(`Cannot resolve sibling App for workspace ${projectDir}`);
}
