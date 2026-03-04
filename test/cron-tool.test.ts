import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createCronTool, type CronEntry } from "../src/cron-tool.js";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

function makeToolCtx(cronEnabled = false) {
  const dir = mkdtempSync(resolve(tmpdir(), "cron-tool-"));
  const configPath = resolve(dir, "cron.json");
  let reloadCount = 0;
  const tool = createCronTool({
    configPath,
    onConfigChange: () => { reloadCount++; },
    cronEnabled,
  });
  return {
    dir,
    configPath,
    tool,
    get reloadCount() { return reloadCount; },
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

async function exec(tool: ReturnType<typeof createCronTool>, input: Record<string, unknown>): Promise<string> {
  const result = await tool.execute("test-call", input as any);
  return result.content[0].text;
}

describe("cron tool", () => {
  let ctx: ReturnType<typeof makeToolCtx>;

  beforeEach(() => { ctx = makeToolCtx(); });
  afterEach(() => { ctx.cleanup(); });

  it("list returns empty when no cron.json", async () => {
    const out = await exec(ctx.tool, { action: "list" });
    expect(out).toContain("No cron jobs.");
    expect(out).toContain("Cron: disabled");
  });

  it("add creates a cron entry", async () => {
    const out = await exec(ctx.tool, {
      action: "add",
      name: "health",
      intervalMs: 60000,
      message: "check health",
    });
    expect(out).toContain('Added job "health"');
    expect(out).toContain("60s");
    expect(ctx.reloadCount).toBe(1);

    // Verify file contents
    const entries: CronEntry[] = JSON.parse(readFileSync(ctx.configPath, "utf-8"));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ name: "health", intervalMs: 60000, message: "check health" });
  });

  it("add rejects duplicate names", async () => {
    await exec(ctx.tool, { action: "add", name: "t1", intervalMs: 10000, message: "m" });
    const out = await exec(ctx.tool, { action: "add", name: "t1", intervalMs: 20000, message: "m2" });
    expect(out).toContain("already exists");
  });

  it("add rejects intervalMs below minimum", async () => {
    const out = await exec(ctx.tool, { action: "add", name: "fast", intervalMs: 5000, message: "m" });
    expect(out).toContain("10000");
  });

  it("add requires all fields", async () => {
    expect(await exec(ctx.tool, { action: "add" })).toContain("'name' is required");
    expect(await exec(ctx.tool, { action: "add", name: "x" })).toContain("'intervalMs' is required");
    expect(await exec(ctx.tool, { action: "add", name: "x", intervalMs: 10000 })).toContain("'message' is required");
  });

  it("list shows all entries", async () => {
    await exec(ctx.tool, { action: "add", name: "a", intervalMs: 60000, message: "first" });
    await exec(ctx.tool, { action: "add", name: "b", intervalMs: 120000, message: "second" });
    const out = await exec(ctx.tool, { action: "list" });
    expect(out).toContain("a: every 60s");
    expect(out).toContain("b: every 120s");
  });

  it("remove deletes an entry", async () => {
    await exec(ctx.tool, { action: "add", name: "a", intervalMs: 60000, message: "m" });
    await exec(ctx.tool, { action: "add", name: "b", intervalMs: 60000, message: "m" });
    const reloadBefore = ctx.reloadCount;
    const out = await exec(ctx.tool, { action: "remove", name: "a" });
    expect(out).toContain('Removed job "a"');
    expect(ctx.reloadCount).toBe(reloadBefore + 1);

    const entries: CronEntry[] = JSON.parse(readFileSync(ctx.configPath, "utf-8"));
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("b");
  });

  it("remove reports missing entry", async () => {
    const out = await exec(ctx.tool, { action: "remove", name: "nope" });
    expect(out).toContain("not found");
  });

  it("update modifies interval", async () => {
    await exec(ctx.tool, { action: "add", name: "t1", intervalMs: 60000, message: "m" });
    const out = await exec(ctx.tool, { action: "update", name: "t1", intervalMs: 120000 });
    expect(out).toContain('Updated job "t1"');

    const entries: CronEntry[] = JSON.parse(readFileSync(ctx.configPath, "utf-8"));
    expect(entries[0].intervalMs).toBe(120000);
    expect(entries[0].message).toBe("m"); // unchanged
  });

  it("update modifies message", async () => {
    await exec(ctx.tool, { action: "add", name: "t1", intervalMs: 60000, message: "old" });
    await exec(ctx.tool, { action: "update", name: "t1", message: "new" });

    const entries: CronEntry[] = JSON.parse(readFileSync(ctx.configPath, "utf-8"));
    expect(entries[0].intervalMs).toBe(60000); // unchanged
    expect(entries[0].message).toBe("new");
  });

  it("update rejects intervalMs below minimum", async () => {
    await exec(ctx.tool, { action: "add", name: "t1", intervalMs: 60000, message: "m" });
    const out = await exec(ctx.tool, { action: "update", name: "t1", intervalMs: 1000 });
    expect(out).toContain("10000");
  });

  it("update reports missing entry", async () => {
    const out = await exec(ctx.tool, { action: "update", name: "nope" });
    expect(out).toContain("not found");
  });

  it("calls onConfigChange on every write", async () => {
    expect(ctx.reloadCount).toBe(0);
    await exec(ctx.tool, { action: "add", name: "a", intervalMs: 10000, message: "m" });
    expect(ctx.reloadCount).toBe(1);
    await exec(ctx.tool, { action: "update", name: "a", message: "new" });
    expect(ctx.reloadCount).toBe(2);
    await exec(ctx.tool, { action: "remove", name: "a" });
    expect(ctx.reloadCount).toBe(3);
  });

  it("reads existing cron.json on first list", async () => {
    writeFileSync(ctx.configPath, JSON.stringify([
      { name: "pre", intervalMs: 30000, message: "preloaded" },
    ]));
    const out = await exec(ctx.tool, { action: "list" });
    expect(out).toContain("pre: every 30s");
  });

  it("list shows cron disabled when cronEnabled is false", async () => {
    await exec(ctx.tool, { action: "add", name: "a", intervalMs: 60000, message: "m" });
    const out = await exec(ctx.tool, { action: "list" });
    expect(out).toContain("Cron: disabled");
  });

  it("list shows cron active when cronEnabled is true", async () => {
    const enabledCtx = makeToolCtx(true);
    await exec(enabledCtx.tool, { action: "add", name: "a", intervalMs: 60000, message: "m" });
    const out = await exec(enabledCtx.tool, { action: "list" });
    expect(out).toContain("Cron: active");
    expect(out).not.toContain("disabled");
    enabledCtx.cleanup();
  });
});
