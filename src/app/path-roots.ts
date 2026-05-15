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
  if (existsSync("/app/agents") && existsSync("/app/shared")) {
    return "/app";
  }
  const nestedAppRoot = resolve(sourceRoot, "app");
  if (
    existsSync(resolve(nestedAppRoot, "agents"))
    && existsSync(resolve(nestedAppRoot, "shared"))
  ) {
    return nestedAppRoot;
  }
  return sourceRoot;
}

export function resolveRuntimeRoots(importMetaUrl: string): RuntimeRoots {
  const sourceRoot = resolveProjectRoot(importMetaUrl);
  const explicitRoot = process.env.APP_ROOT || process.env.PROJECT_ROOT;
  const projectRoot = resolve(explicitRoot || inferAppRoot(sourceRoot));
  const agentsRoot = resolve(process.env.AGENTS_ROOT || resolve(projectRoot, "agents"));
  const sharedRoot = resolve(process.env.SHARED_ROOT || resolve(projectRoot, "shared"));
  const projectsRoot = resolve(process.env.PROJECTS_ROOT || resolve(projectRoot, "projects"));
  const persistDir = resolve(process.env.STATE_DIR || resolve(projectRoot, ".state"));

  return { projectRoot, agentsRoot, sharedRoot, projectsRoot, persistDir };
}
