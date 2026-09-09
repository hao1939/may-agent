import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listAppDefinitionFiles, discoverAppDefinitions } from "./app-definitions.js";
import { AppRegistry } from "../../core/apps/registry.js";

function loadAppDefinitions(projectsRoot: string, canonicalProjectsRoot = projectsRoot) {
  return new AppRegistry(discoverAppDefinitions(projectsRoot, canonicalProjectsRoot)).reload();
}

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "app-discovery-"));
  roots.push(root);
  mkdirSync(join(root, "evaluation.app"), { recursive: true });
  mkdirSync(join(root, "empty.app"), { recursive: true });
  return root;
}

describe("conventional App file discovery", () => {
  it("loads one manifest per App directory, preferring app.ts and falling back to app.js", async () => {
    const root = fixture();
    const modulePath = join(root, "evaluation.app", "app.ts");
    writeFileSync(
      modulePath,
      `export default {
        id: "evaluation-canary",
        version: 1,
        agent: "evaluator",
        inputSchema: { type: "object", required: ["kind", "data"], properties: {
          kind: { const: "probe" }, data: { type: "object" }
        } }
      };\n`,
    );

    const fallbackPath = join(root, "fallback.app", "app.js");
    mkdirSync(join(root, "fallback.app"));
    writeFileSync(
      fallbackPath,
      `export default {
        id: "fallback", version: 1, agent: "evaluator",
        inputSchema: { type: "object" }
      };\n`,
    );
    mkdirSync(join(root, "not-an-app"));
    for (const path of [
      join(root, "evaluation.app", "app.js"),
      join(root, "empty.app", "project.ts"),
      join(root, "not-an-app", "app.ts"),
    ]) writeFileSync(path, 'throw new Error("must not import this file");\n');

    expect(listAppDefinitionFiles(root)).toEqual([modulePath, fallbackPath]);
    const loaded = await loadAppDefinitions(root);
    expect(loaded).toMatchObject([
      {
        appDir: join(root, "evaluation.app"),
        definition: { id: "evaluation-canary", agent: "evaluator", owner: "evaluator" },
      },
      {
        appDir: join(root, "fallback.app"),
        definition: { id: "fallback", agent: "evaluator", owner: "evaluator" },
      },
    ]);
  });

  it("loads code from a release while keeping the canonical App path", async () => {
    const sourceRoot = fixture();
    const canonicalRoot = join(sourceRoot, "canonical-projects");
    writeFileSync(
      join(sourceRoot, "evaluation.app", "app.js"),
      `export default { id: "evaluation", version: 1, agent: "evaluator", inputSchema: { type: "object" } };\n`,
    );

    const loaded = await loadAppDefinitions(sourceRoot, canonicalRoot);
    expect(loaded[0]).toMatchObject({
      appDir: join(canonicalRoot, "evaluation.app"),
      definition: { id: "evaluation", agent: "evaluator", owner: "evaluator" },
    });
  });

  it("rejects a retired ProjectApp declaration instead of adapting it", async () => {
    const root = fixture();
    writeFileSync(
      join(root, "evaluation.app", "app.js"),
      `export default {
        id: "evaluation", version: 1, owner: "evaluator", description: "retired declaration",
        schedules: [{ id: "evaluation-pipeline-review", enabled: true, intervalMs: 300000,
          emits: [{ type: "evaluation.pipeline.check", project: "evaluation" }]
        }],
        events: ["evaluation.reviewed"]
      };\n`,
    );

    await expect(loadAppDefinitions(root)).rejects.toThrow("App evaluation inputSchema must be an object schema");
  });

  it("rejects duplicate App ids before starting the host", async () => {
    const root = fixture();
    mkdirSync(join(root, "second.app"), { recursive: true });
    for (const directory of ["evaluation.app", "second.app"]) {
      writeFileSync(
        join(root, directory, "app.js"),
        `export default { id: "duplicate", version: 1, owner: "owner", inputSchema: {} };\n`,
      );
    }

    await expect(loadAppDefinitions(root)).rejects.toThrow("Duplicate App id: duplicate");
  });

  it("refreshes failed and repaired modules on reload without changing the live snapshot", async () => {
    const root = fixture();
    const appPath = join(root, "evaluation.app", "app.js");
    const write = (id: string) =>
      writeFileSync(
        appPath,
        `export default { id: "${id}", version: 1, agent: "evaluator", inputSchema: { type: "object" } };\n`,
      );
    write("before");
    const registry = new AppRegistry(discoverAppDefinitions(root));
    await registry.reload();
    const previous = registry.snapshot();
    writeFileSync(appPath, "export default { broken: true };\n");
    await expect(registry.reload()).rejects.toThrow("App id");
    expect(registry.snapshot()).toBe(previous);
    write("after");
    await registry.reload();
    expect(registry.entries()[0]?.definition.id).toBe("after");
    expect(registry.snapshot().generation).toBe(2);
  });

  it("switches release sources while keeping the canonical App path", async () => {
    const first = fixture();
    const second = fixture();
    for (const [root, id] of [
      [first, "before"],
      [second, "after"],
    ]) {
      writeFileSync(
        join(root!, "evaluation.app", "app.js"),
        `export default { id: "${id}", version: 1, agent: "evaluator", inputSchema: { type: "object" } };\n`,
      );
    }
    const registry = new AppRegistry(discoverAppDefinitions(first));
    await registry.reload();
    await registry.reload(undefined, discoverAppDefinitions(second, first));
    expect(registry.entries()[0]).toMatchObject({ appDir: join(first, "evaluation.app"), definition: { id: "after" } });
    await registry.reload();
    expect(registry.entries()[0]?.definition.id).toBe("after");
  });
});
