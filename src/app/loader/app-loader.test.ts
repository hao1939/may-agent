import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listAppDefinitionFiles, loadAppDefinitions } from "./app-loader.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(): string {
  const root = join(tmpdir(), `app-loader-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  roots.push(root);
  mkdirSync(join(root, "evaluation.app"), { recursive: true });
  mkdirSync(join(root, "empty.app"), { recursive: true });
  return root;
}

describe("canonical App loader", () => {
  it("loads only the canonical app.ts manifest", async () => {
    const root = fixture();
    const modulePath = join(root, "evaluation.app", "app.js");
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

    expect(listAppDefinitionFiles(root)).toEqual([modulePath]);
    const loaded = await loadAppDefinitions(root);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({
      appDir: join(root, "evaluation.app"),
      definition: { id: "evaluation-canary", agent: "evaluator", owner: "evaluator" },
    });
  });

  it("loads one valid canonical manifest", async () => {
    const root = fixture();
    const appPath = join(root, "evaluation.app", "app.js");
    writeFileSync(
      appPath,
      `export default {
        id: "evaluation-canary", version: 1, agent: "evaluator",
        inputSchema: { type: "object" }
      };\n`,
    );

    const loaded = await loadAppDefinitions(root);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({
      appDir: join(root, "evaluation.app"),
      definition: { id: "evaluation-canary", agent: "evaluator", owner: "evaluator" },
    });
  });

  it("loads code from a release while keeping the canonical App path", async () => {
    const sourceRoot = fixture();
    const canonicalRoot = join(sourceRoot, "canonical-projects");
    writeFileSync(
      join(sourceRoot, "evaluation.app", "app.js"),
      `export default { id: "evaluation", version: 1, agent: "evaluator", inputSchema: { type: "object" } };\n`,
    );

    const loaded = await loadAppDefinitions(sourceRoot, {}, canonicalRoot);
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
});
