import { afterEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { resolveRuntimeRoots } from "../src/app/path-roots.js";

const ENV_KEYS = ["APP_ROOT", "PROJECT_ROOT", "AGENTS_ROOT", "SHARED_ROOT", "PROJECTS_ROOT", "STATE_DIR"] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("resolveRuntimeRoots", () => {
  it("infers the app root when app/ contains agents/ and shared/", () => {
    for (const key of ENV_KEYS) delete process.env[key];
    const root = process.cwd();
    const roots = resolveRuntimeRoots(new URL("../src/app/may.ts", import.meta.url).href);

    expect(roots.projectRoot).toBe(join(root, "app"));
    expect(roots.agentsRoot).toBe(join(root, "app", "agents"));
    expect(roots.sharedRoot).toBe(join(root, "app", "shared"));
    expect(roots.projectsRoot).toBe(join(root, "app", "projects"));
  });

  it("honors explicit container roots", () => {
    process.env.PROJECT_ROOT = "/app";
    process.env.AGENTS_ROOT = "/app/agents";
    process.env.SHARED_ROOT = "/app/shared";
    process.env.PROJECTS_ROOT = "/app/projects";
    process.env.STATE_DIR = "/app/.state";

    const roots = resolveRuntimeRoots(new URL("../src/app/may.ts", import.meta.url).href);

    expect(roots).toEqual({
      projectRoot: "/app",
      agentsRoot: "/app/agents",
      sharedRoot: "/app/shared",
      projectsRoot: "/app/projects",
      persistDir: "/app/.state",
    });
  });
});
