import { describe, expect, it } from "bun:test";
import { AppRegistry, type AppDefinitionSource } from "./registry.js";

function entry(id = "sample") {
  return {
    appDir: "/fixture/sample.app",
    definition: { id, version: 1, agent: "worker", inputSchema: { type: "object" } },
  };
}

describe("App registry", () => {
  it("validates and normalizes a supplied source without filesystem discovery", async () => {
    const original = entry();
    const registry = new AppRegistry(async () => [original]);
    await registry.reload();
    expect(registry.entries()[0]?.definition).toMatchObject({ id: "sample", agent: "worker", owner: "worker" });
    expect(original.definition).not.toHaveProperty("owner");
    registry.entries().length = 0;
    expect(registry.entries()).toHaveLength(1);
    expect(Object.isFrozen(registry.snapshot())).toBeTrue();
    expect(Object.isFrozen(registry.snapshot().entries)).toBeTrue();
    expect(Object.isFrozen(registry.snapshot().entries[0])).toBeTrue();
    expect(Object.isFrozen(registry.snapshot().entries[0]?.definition)).toBeTrue();
  });

  it.each([
    ["malformed declaration", async () => [{ appDir: "/fixture/sample.app", definition: {} }], "App id"],
    ["duplicate identity", async () => [entry(), entry()], "Duplicate App id"],
    [
      "discovery failure",
      async () => {
        throw new Error("source unavailable");
      },
      "source unavailable",
    ],
  ] satisfies [string, AppDefinitionSource, string][])(
    "retains the generation and source after %s",
    async (_label, source, error) => {
      const registry = new AppRegistry(async () => [entry("stable")]);
      await registry.reload();
      const previous = registry.snapshot();
      let applied = false;
      await expect(
        registry.reload(() => {
          applied = true;
        }, source),
      ).rejects.toThrow(error);
      expect(applied).toBeFalse();
      expect(registry.snapshot()).toBe(previous);
      await registry.reload();
      expect(registry.entries()[0]?.definition.id).toBe("stable");
      expect(registry.snapshot().generation).toBe(2);
    },
  );

  it("publishes a replacement only after its consumer accepts it", async () => {
    const registry = new AppRegistry(async () => [entry("before")]);
    await registry.reload();
    const previous = registry.snapshot();
    const replacement: AppDefinitionSource = async () => [entry("after")];
    await expect(
      registry.reload(async (next) => {
        expect(next.entries[0]?.definition.id).toBe("after");
        expect(registry.snapshot()).toBe(previous);
        throw new Error("host rejected replacement");
      }, replacement),
    ).rejects.toThrow("host rejected replacement");
    expect(registry.snapshot()).toBe(previous);
    await registry.reload();
    expect(registry.entries()[0]?.definition.id).toBe("before");
    await registry.reload(undefined, replacement);
    expect(registry.entries()[0]?.definition.id).toBe("after");
  });

  it("uses a boot-unique snapshot identity even when generations repeat", async () => {
    const first = new AppRegistry(async () => [entry()]);
    const second = new AppRegistry(async () => [entry()]);
    await first.reload();
    await second.reload();
    expect(first.snapshot().generation).toBe(1);
    expect(second.snapshot().generation).toBe(1);
    expect(first.snapshot().id).not.toBe(second.snapshot().id);
  });

  it("resolves installed Task intent through the same validated definition", async () => {
    const registry = new AppRegistry(async () => [
      {
        ...entry(),
        definition: {
          ...entry().definition,
          tasks: {
            resolve: (event: { data: Record<string, unknown> }) => ({
              id: event.data.taskId,
              outcome: "observe",
              acceptance: ["done"],
              input: event.data,
            }),
          },
        },
      },
    ]);
    await registry.reload();
    const snapshot = registry.snapshot();
    const data = { taskId: "full-intent", fields: ["one", "two"] };
    expect(registry.resolveInstalledTask("sample", { type: "project.task.tick", data })).toEqual({
      snapshot: { id: snapshot.id, generation: 1 },
      appId: "sample",
      intent: { id: "full-intent", outcome: "observe", acceptance: ["done"], input: data },
    });
    expect(registry.snapshot()).toBe(snapshot);
  });

  it("serializes discovery and publication, selecting the default source at execution time", async () => {
    const observed: string[] = [];
    const registry = new AppRegistry(async () => {
      observed.push("old source");
      return [entry("old")];
    });
    expect(observed).toEqual([]); // Construction must not discover or activate anything.
    await registry.reload();
    observed.length = 0;
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const replacement: AppDefinitionSource = async () => {
      observed.push("new source");
      return [entry("new")];
    };
    const first = registry.reload(async () => {
      observed.push("applying");
      started.resolve();
      await release.promise;
      observed.push("applied");
    }, replacement);
    await started.promise;
    const second = registry.reload();
    // Cross a microtask boundary while the first transaction is still blocked.
    await Promise.resolve();
    expect(observed).toEqual(["new source", "applying"]);
    release.resolve();
    await Promise.all([first, second]);
    expect(observed).toEqual(["new source", "applying", "applied", "new source"]);
    expect(registry.snapshot().generation).toBe(3);
    expect(registry.entries()[0]?.definition.id).toBe("new");
  });
});
