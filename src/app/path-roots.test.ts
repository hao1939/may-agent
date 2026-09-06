import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import * as fs from "node:fs";
import { resolveRuntimeRoots } from "./path-roots.js";

const ENV_KEYS = ["APP_ROOT", "PROJECT_ROOT", "AGENTS_ROOT", "SHARED_ROOT", "PROJECTS_ROOT", "STATE_DIR"] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const sourceUrl = "file:///fixture/may/src/app/may.ts";
let existingPaths: Set<string>;
let exists: ReturnType<typeof spyOn<typeof fs, "existsSync">>;

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  existingPaths = new Set();
  exists = spyOn(fs, "existsSync").mockImplementation((path) => existingPaths.has(String(path)));
});

afterEach(() => {
  exists.mockRestore();
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("resolveRuntimeRoots", () => {
  it("infers the canonical /app root when it contains agents/ and shared/", () => {
    existingPaths.add("/app/agents").add("/app/shared");
    const roots = resolveRuntimeRoots(sourceUrl);

    expect(roots.projectRoot).toBe("/app");
    expect(roots.agentsRoot).toBe("/app/agents");
    expect(roots.sharedRoot).toBe("/app/shared");
    expect(roots.projectsRoot).toBe("/app/projects");
  });

  it("uses a nested App root when no canonical installation exists", () => {
    existingPaths.add("/fixture/may/app/agents").add("/fixture/may/app/shared");
    expect(resolveRuntimeRoots(sourceUrl).projectRoot).toBe("/fixture/may/app");
  });

  it("uses the source root in a standalone checkout", () => {
    expect(resolveRuntimeRoots(sourceUrl)).toEqual({
      projectRoot: "/fixture/may",
      agentsRoot: "/fixture/may/agents",
      sharedRoot: "/fixture/may/shared",
      projectsRoot: "/fixture/may/projects",
      persistDir: "/fixture/may/.state",
    });
  });

  it("does not infer an incomplete installation", () => {
    existingPaths.add("/app/agents").add("/fixture/may/app/shared");
    expect(resolveRuntimeRoots(sourceUrl).projectRoot).toBe("/fixture/may");
  });

  it("prefers the explicit App root even when /app exists", () => {
    existingPaths.add("/app/agents").add("/app/shared");
    process.env.APP_ROOT = "/custom-app";
    process.env.PROJECT_ROOT = "/other-root";
    expect(resolveRuntimeRoots(sourceUrl).projectRoot).toBe("/custom-app");
  });

  it("honors explicit container roots", () => {
    process.env.PROJECT_ROOT = "/app";
    process.env.AGENTS_ROOT = "/app/agents";
    process.env.SHARED_ROOT = "/app/shared";
    process.env.PROJECTS_ROOT = "/app/projects";
    process.env.STATE_DIR = "/app/.state";

    const roots = resolveRuntimeRoots(new URL("./may.ts", import.meta.url).href);

    expect(roots).toEqual({
      projectRoot: "/app",
      agentsRoot: "/app/agents",
      sharedRoot: "/app/shared",
      projectsRoot: "/app/projects",
      persistDir: "/app/.state",
    });
  });
});
