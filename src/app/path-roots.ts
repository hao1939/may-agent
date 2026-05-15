import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { resolveProjectRoot } from "./bundle-mode.js";

export interface RuntimeRoots {
  projectRoot: string;
  agentsRoot: string;
  sharedRoot: string;
  projectsRoot: string;
  persistDir: string;
}

function inferAppRoot(sourceRoot: string): string {
  const nestedAppRoot = resolve(sourceRoot, "agents");
  if (
    existsSync(resolve(nestedAppRoot, "agents"))
    && existsSync(resolve(nestedAppRoot, "shared"))
  ) {
    return nestedAppRoot;
  }
  return sourceRoot;
}

function firstExisting(...paths: string[]): string | null {
  for (const path of paths) {
    if (existsSync(path)) return path;
  }
  return null;
}

export function resolveRuntimeRoots(importMetaUrl: string): RuntimeRoots {
  const sourceRoot = resolveProjectRoot(importMetaUrl);
  const explicitRoot = process.env.APP_ROOT || process.env.PROJECT_ROOT;
  const projectRoot = resolve(explicitRoot || inferAppRoot(sourceRoot));
  const agentsRoot = resolve(process.env.AGENTS_ROOT || resolve(projectRoot, "agents"));
  const sharedRoot = resolve(
    process.env.SHARED_ROOT
      || firstExisting(resolve(projectRoot, "shared"), resolve(agentsRoot, "shared"))
      || resolve(projectRoot, "shared"),
  );
  const projectsRoot = resolve(
    process.env.PROJECTS_ROOT
      || firstExisting(resolve(projectRoot, "projects"), resolve(sharedRoot, "projects"))
      || resolve(projectRoot, "projects"),
  );
  const persistDir = resolve(process.env.STATE_DIR || resolve(projectRoot, ".state"));

  return { projectRoot, agentsRoot, sharedRoot, projectsRoot, persistDir };
}
