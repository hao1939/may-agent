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

  function fixture(id: string): { root: string; appPath: string } {
    const root = join(tmpdir(), `app-registry-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const appDir = join(root, "fixture.app");
    const appPath = join(appDir, "app.js");
    roots.push(root);
    mkdirSync(appDir, { recursive: true });
    writeFileSync(
      appPath,
      `export default { id: "${id}", version: 1, owner: "may", inputSchema: { type: "object" } };\n`,
    );
    return { root, appPath };
  }

  it("publishes a replacement only after its consumer accepts it", async () => {
    const { root, appPath } = fixture("before");
    const registry = new AppRegistry(root);
    await registry.reload();
    expect(registry.snapshot().generation).toBe(1);

    writeFileSync(
      appPath,
      `export default { id: "after", version: 1, owner: "may", inputSchema: { type: "object" } };\n`,
    );
    await expect(
      registry.reload(async () => {
        await Promise.resolve();
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

  it("uses a boot-unique snapshot identity even when generations repeat", async () => {
    const { root } = fixture("stable");
    const first = new AppRegistry(root);
    const second = new AppRegistry(root);
    await first.reload();
    await second.reload();

    expect(first.snapshot().generation).toBe(1);
    expect(second.snapshot().generation).toBe(1);
    expect(first.snapshot().id).not.toBe(second.snapshot().id);
  });

  it("serializes overlapping generation transactions", async () => {
    const { root, appPath } = fixture("initial");
    const registry = new AppRegistry(root);
    await registry.reload();

    writeFileSync(
      appPath,
      `export default { id: "first", version: 1, owner: "may", inputSchema: { type: "object" } };\n`,
    );
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let markFirstStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    const observed: string[] = [];
    const first = registry.reload(async (snapshot) => {
      observed.push(`start:${snapshot.generation}:${snapshot.entries[0]?.definition.id}`);
      markFirstStarted();
      await firstGate;
      observed.push(`end:${snapshot.generation}`);
    });
    await firstStarted;

    writeFileSync(
      appPath,
      `export default { id: "second", version: 1, owner: "may", inputSchema: { type: "object" } };\n`,
    );
    const second = registry.reload((snapshot) => {
      observed.push(`start:${snapshot.generation}:${snapshot.entries[0]?.definition.id}`);
    });
    await Bun.sleep(10);
    expect(observed).toEqual(["start:2:first"]);

    releaseFirst();
    await Promise.all([first, second]);
    expect(observed).toEqual(["start:2:first", "end:2", "start:3:second"]);
    expect(registry.snapshot().generation).toBe(3);
  });
});
