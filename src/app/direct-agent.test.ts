import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveDirectToolPolicy, runDirectAgent } from "./direct-agent.js";

describe("direct agent tool policy", () => {
  test("derives effective tools from configured tools and explicit denials in stable order", () => {
    expect(
      resolveDirectToolPolicy("may", ["coding", "message", "finish"], [
        { name: "message", reason: "isolated benchmark must not notify users" },
      ]),
    ).toEqual({
      agent: "may",
      configuredTools: ["coding", "message", "finish"],
      deniedTools: [{ name: "message", reason: "isolated benchmark must not notify users" }],
      effectiveTools: ["coding", "finish"],
    });
  });

  test("rejects unknown, duplicate, and unexplained denials", () => {
    expect(() =>
      resolveDirectToolPolicy("may", ["coding"], [{ name: "message", reason: "not configured" }]),
    ).toThrow("unconfigured tool");
    expect(() =>
      resolveDirectToolPolicy("may", ["coding"], [
        { name: "coding", reason: "first" },
        { name: "coding", reason: "second" },
      ]),
    ).toThrow("more than once");
    expect(() => resolveDirectToolPolicy("may", ["coding"], [{ name: "coding", reason: " " }])).toThrow(
      "requires a reason",
    );
  });

  test("fails before generation when an effective configured tool has no direct implementation", async () => {
    const root = await mkdtemp(join(tmpdir(), "may-direct-tools-"));
    const agentDir = join(root, "agents", "example");
    await mkdir(agentDir, { recursive: true });
    await writeFile(
      join(agentDir, "agent.json"),
      JSON.stringify({
        name: "example",
        description: "example",
        domain: "test",
        model: "test",
        tools: ["message"],
      }),
    );
    try {
      await expect(
        runDirectAgent({
          agentName: "example",
          task: "test",
          projectRoot: root,
          workRoot: root,
          agentsRoot: join(root, "agents"),
          sharedRoot: join(root, "shared"),
          outputRoot: join(root, "output"),
          models: { test: {} as any },
        }),
      ).rejects.toThrow('cannot construct effective tool "message"');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
