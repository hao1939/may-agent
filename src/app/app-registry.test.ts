import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AppRegistry } from "./app-registry.js";

describe("App registry", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  function fixture(id: string): { root: string; inboxPath: string } {
    const root = join(tmpdir(), `app-registry-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const appDir = join(root, "fixture.app");
    const inboxPath = join(appDir, "inbox.js");
    roots.push(root);
    mkdirSync(appDir, { recursive: true });
    writeFileSync(
      inboxPath,
      `export default { id: "${id}", version: 1, owner: "may", inputSchema: { type: "object" } };\n`,
    );
    return { root, inboxPath };
  }

  it("publishes a replacement only after its consumer accepts it", async () => {
    const { root, inboxPath } = fixture("before");
    const registry = new AppRegistry(root);
    await registry.reload();
    expect(registry.snapshot().generation).toBe(1);

    writeFileSync(
      inboxPath,
      `export default { id: "after", version: 1, owner: "may", inputSchema: { type: "object" } };\n`,
    );
    await expect(
      registry.reload(() => {
        throw new Error("host rejected replacement");
      }),
    ).rejects.toThrow("host rejected replacement");

    expect(registry.entries().map((entry) => entry.definition.id)).toEqual(["before"]);
    expect(registry.snapshot().generation).toBe(1);
    await registry.reload();
    expect(registry.entries().map((entry) => entry.definition.id)).toEqual(["after"]);
    expect(registry.snapshot().generation).toBe(2);
  });

  it("does not expose its mutable snapshot array", async () => {
    const { root } = fixture("stable");
    const registry = new AppRegistry(root);
    await registry.reload();

    registry.entries().length = 0;
    expect(registry.entries().map((entry) => entry.definition.id)).toEqual(["stable"]);
    expect(Object.isFrozen(registry.snapshot())).toBeTrue();
    expect(Object.isFrozen(registry.snapshot().entries)).toBeTrue();
    expect(Object.isFrozen(registry.snapshot().entries[0])).toBeTrue();
    expect(Object.isFrozen(registry.snapshot().entries[0]?.definition)).toBeTrue();
  });
});
