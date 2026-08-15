import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

export type AppTaskExecutionPaths = {
  appDir: string;
  projectDir: string;
  workspaceDir: string;
};

function canonicalExistingPath(path: string): string {
  let cursor = resolve(path);
  const suffix: string[] = [];
  while (!existsSync(cursor)) {
    const parent = dirname(cursor);
    if (parent === cursor) break;
    suffix.unshift(cursor.slice(parent.length + (parent.endsWith("/") ? 0 : 1)));
    cursor = parent;
  }
  const base = existsSync(cursor) ? realpathSync(cursor) : cursor;
  return resolve(base, ...suffix);
}

function isWithin(root: string, candidate: string): boolean {
  const fromRoot = relative(root, candidate);
  return fromRoot === "" || (!fromRoot.startsWith("..") && !isAbsolute(fromRoot));
}

export function appTaskExecutionPaths(appDir: string, projectDir: string): AppTaskExecutionPaths {
  return {
    appDir: canonicalExistingPath(appDir),
    projectDir: canonicalExistingPath(projectDir),
    workspaceDir: canonicalExistingPath(projectDir),
  };
}

/** Resolve declared outputs against the domain workspace and reject root escapes. */
export function resolveAppTaskOutputPaths(
  outputs: string[],
  paths: Pick<AppTaskExecutionPaths, "appDir" | "projectDir">,
): string[] {
  const roots = [...new Set([canonicalExistingPath(paths.appDir), canonicalExistingPath(paths.projectDir)])];
  return outputs.map((raw, index) => {
    if (typeof raw !== "string" || !raw.trim()) {
      throw new Error(`outputs[${index}] must be a non-empty path`);
    }
    const candidate = canonicalExistingPath(isAbsolute(raw) ? raw : resolve(paths.projectDir, raw));
    if (!roots.some((root) => isWithin(root, candidate))) {
      throw new Error(`outputs[${index}] escapes the app/domain roots: ${raw}`);
    }
    return candidate;
  });
}
