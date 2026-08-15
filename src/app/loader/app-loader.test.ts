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
        owner: "evaluator",
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
      definition: { id: "evaluation-canary", owner: "evaluator" },
    });
  });

  it("loads one valid canonical manifest", async () => {
    const root = fixture();
    const appPath = join(root, "evaluation.app", "app.js");
    writeFileSync(
      appPath,
      `export default {
        id: "evaluation-canary", version: 1, owner: "evaluator",
        inputSchema: { type: "object" }
      };\n`,
    );

    const loaded = await loadAppDefinitions(root);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({
      appDir: join(root, "evaluation.app"),
      definition: { id: "evaluation-canary" },
    });
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
