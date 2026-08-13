import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listAppInboxDefinitionFiles, loadAppInboxDefinitions } from "./app-inbox-loader.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(): string {
  const root = join(tmpdir(), `app-inbox-loader-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  roots.push(root);
  mkdirSync(join(root, "evaluation.app"), { recursive: true });
  mkdirSync(join(root, "legacy.app"), { recursive: true });
  writeFileSync(join(root, "legacy.app", "app.js"), "export default { id: 'legacy' };\n");
  return root;
}

describe("App inbox definition loader", () => {
  it("loads only explicit inbox modules beside legacy Project Apps", async () => {
    const root = fixture();
    const modulePath = join(root, "evaluation.app", "inbox.js");
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

    expect(listAppInboxDefinitionFiles(root)).toEqual([modulePath]);
    const loaded = await loadAppInboxDefinitions(root);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({
      appDir: join(root, "evaluation.app"),
      definition: { id: "evaluation-canary", owner: "evaluator" },
    });
  });

  it("rejects duplicate App ids before starting the host", async () => {
    const root = fixture();
    mkdirSync(join(root, "second.app"), { recursive: true });
    for (const directory of ["evaluation.app", "second.app"]) {
      writeFileSync(
        join(root, directory, "inbox.js"),
        `export default { id: "duplicate", version: 1, owner: "owner", inputSchema: {} };\n`,
      );
    }

    await expect(loadAppInboxDefinitions(root)).rejects.toThrow("Duplicate App inbox id: duplicate");
  });
});
