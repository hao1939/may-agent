import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createCronTool, type CronEntry } from "./cron-tool.js";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

function makeToolCtx(cronEnabled = false) {
  const dir = mkdtempSync(resolve(tmpdir(), "cron-tool-"));
  const configPath = resolve(dir, "cron.json");
  let reloadCount = 0;
  const tool = createCronTool({
    configPath,
    onConfigChange: () => {
      reloadCount++;
    },
    cronEnabled,
  });
  return {
    dir,
    configPath,
    tool,
    get reloadCount() {
      return reloadCount;
    },
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function makeAgentToolCtx(agentName: string) {
  const dir = mkdtempSync(resolve(tmpdir(), "cron-tool-"));
  const configPath = resolve(dir, "cron.json");
  let reloadCount = 0;
  const tool = createCronTool({
    configPath,
    agentName,
    onConfigChange: () => {
      reloadCount++;
    },
  });
  return {
    dir,
    configPath,
    tool,
    get reloadCount() {
      return reloadCount;
    },
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

async function exec(tool: ReturnType<typeof createCronTool>, input: Record<string, unknown>): Promise<string> {
  const result = await tool.execute("test-call", input as any);
  return result.content[0].text;
}

describe("cron tool", () => {
  let ctx: ReturnType<typeof makeToolCtx>;

  beforeEach(() => {
    ctx = makeToolCtx();
  });
  afterEach(() => {
    ctx.cleanup();
  });

  it("list returns empty when no cron.json", async () => {
    const out = await exec(ctx.tool, { action: "list" });
    expect(out).toContain("no cron jobs configured");
    expect(out).toContain("DISABLED");
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
    expect(entries[0]).toEqual({
      name: "health",
      intervalMs: 60000,
      handler: { workflow: "verify-wrap", agent: "may", task: "check health" },
      enabled: true,
    });
  });

  it("add defaults new jobs to a workflow-backed handler for the owning agent", async () => {
    const agentCtx = makeAgentToolCtx("bob");
    try {
      await exec(agentCtx.tool, {
        action: "add",
        name: "follow-up",
        intervalMs: 60000,
        message: "check follow-up items",
      });

      const entries: CronEntry[] = JSON.parse(readFileSync(agentCtx.configPath, "utf-8"));
      expect(entries[0]).toMatchObject({
        name: "follow-up",
        handler: { workflow: "verify-wrap", agent: "bob", task: "check follow-up items" },
      });
      expect(entries[0].agent).toBeUndefined();
      expect(entries[0].message).toBeUndefined();
    } finally {
      agentCtx.cleanup();
    }
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

  it("add rejects name longer than 50 chars", async () => {
    const longName = "a".repeat(51);
    const out = await exec(ctx.tool, { action: "add", name: longName, intervalMs: 60000, message: "m" });
    expect(out).toContain("Error: name must be <= 50 characters");
  });

  it("add rejects message longer than 500 chars", async () => {
    const longMessage = "a".repeat(501);
    const out = await exec(ctx.tool, { action: "add", name: "test", intervalMs: 60000, message: longMessage });
    expect(out).toContain("Error: message must be <= 500 characters");
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
    expect(typeof entries[0].handler).toBe("object");
    expect((entries[0].handler as { task: string }).task).toBe("m"); // unchanged
  });

  it("update modifies message", async () => {
    await exec(ctx.tool, { action: "add", name: "t1", intervalMs: 60000, message: "old" });
    await exec(ctx.tool, { action: "update", name: "t1", message: "new" });

    const entries: CronEntry[] = JSON.parse(readFileSync(ctx.configPath, "utf-8"));
    expect(entries[0].intervalMs).toBe(60000); // unchanged
    expect(typeof entries[0].handler).toBe("object");
    expect((entries[0].handler as { task: string }).task).toBe("new");
    expect(entries[0].message).toBeUndefined();
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

  it("update rejects name longer than 50 chars", async () => {
    const longName = "a".repeat(51);
    const out = await exec(ctx.tool, { action: "update", name: longName, intervalMs: 60000 });
    expect(out).toContain("Error: name must be <= 50 characters");
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
    writeFileSync(ctx.configPath, JSON.stringify([{ name: "pre", intervalMs: 30000, message: "preloaded" }]));
    const out = await exec(ctx.tool, { action: "list" });
    expect(out).toContain("pre: every 30s");
    expect(out).not.toContain("[DISABLED] pre");
    expect(await exec(ctx.tool, { action: "status" })).toContain('Shortest configured interval: "pre"');
  });

  it("list shows cron disabled when cronEnabled is false", async () => {
    await exec(ctx.tool, { action: "add", name: "a", intervalMs: 60000, message: "m" });
    const out = await exec(ctx.tool, { action: "list" });
    expect(out).toContain("DISABLED");
  });

  it("list shows cron active when cronEnabled is true", async () => {
    const enabledCtx = makeToolCtx(true);
    await exec(enabledCtx.tool, { action: "add", name: "a", intervalMs: 60000, message: "m" });
    const out = await exec(enabledCtx.tool, { action: "list" });
    expect(out).toContain("Timers: ENABLED");
    expect(out).not.toContain("DISABLED");
    enabledCtx.cleanup();
  });

  it("status shows 0 jobs when empty", async () => {
    const out = await exec(ctx.tool, { action: "status" });
    expect(out).toContain("No cron jobs configured.");
    expect(out).toContain("Timers: DISABLED");
  });

  it("status shows enabled when cronEnabled is true", async () => {
    const enabledCtx = makeToolCtx(true);
    const out = await exec(enabledCtx.tool, { action: "status" });
    expect(out).toContain("Timers: ENABLED");
    expect(out).not.toContain("DISABLED");
    enabledCtx.cleanup();
  });

  it("status shows configured cadence without claiming a next run time", async () => {
    await exec(ctx.tool, { action: "add", name: "slow", intervalMs: 120000, message: "slow msg" });
    await exec(ctx.tool, { action: "add", name: "fast", intervalMs: 30000, message: "fast msg" });
    await exec(ctx.tool, { action: "add", name: "medium", intervalMs: 60000, message: "med msg" });
    const out = await exec(ctx.tool, { action: "status" });
    expect(out).toContain("3 job(s) configured");
    expect(out).toContain('"fast"');
    expect(out).toContain("30s");
    expect(out).toContain("Shortest configured interval:");
    expect(out).not.toContain("Next to fire");
  });

  it("status reports first-defined job on intervalMs tie", async () => {
    await exec(ctx.tool, { action: "add", name: "alpha", intervalMs: 30000, message: "a" });
    await exec(ctx.tool, { action: "add", name: "beta", intervalMs: 30000, message: "b" });
    const out = await exec(ctx.tool, { action: "status" });
    expect(out).toContain('"alpha"');
    expect(out).not.toContain('"beta"');
  });

  it("status shows disabled when jobs exist but cronEnabled is false", async () => {
    await exec(ctx.tool, { action: "add", name: "job1", intervalMs: 60000, message: "m" });
    const out = await exec(ctx.tool, { action: "status" });
    expect(out).toContain("DISABLED");
    expect(out).toContain("1 job(s)");
    expect(out).toContain('"job1"');
    expect(out).toContain("Event/manual triggers are independent");
  });

  it("add creates entry with enabled=true by default", async () => {
    await exec(ctx.tool, { action: "add", name: "j1", intervalMs: 60000, message: "msg" });
    const entries: CronEntry[] = JSON.parse(readFileSync(ctx.configPath, "utf-8"));
    expect(entries[0].enabled).toBe(true);
  });

  it("update can set enabled=false", async () => {
    await exec(ctx.tool, { action: "add", name: "j1", intervalMs: 60000, message: "msg" });
    await exec(ctx.tool, { action: "update", name: "j1", enabled: false });
    const entries: CronEntry[] = JSON.parse(readFileSync(ctx.configPath, "utf-8"));
    expect(entries[0].enabled).toBe(false);
  });

  it("list shows [DISABLED] prefix for disabled jobs", async () => {
    await exec(ctx.tool, { action: "add", name: "active-job", intervalMs: 60000, message: "m" });
    await exec(ctx.tool, { action: "add", name: "dead-job", intervalMs: 60000, message: "m" });
    await exec(ctx.tool, { action: "update", name: "dead-job", enabled: false });
    const out = await exec(ctx.tool, { action: "list" });
    expect(out).toContain("- active-job:");
    expect(out).not.toContain("[DISABLED] active-job");
    expect(out).toContain("[DISABLED] dead-job");
  });

  it("status skips disabled jobs for configured cadence", async () => {
    await exec(ctx.tool, { action: "add", name: "fast", intervalMs: 10000, message: "m" });
    await exec(ctx.tool, { action: "add", name: "slow", intervalMs: 120000, message: "m" });
    await exec(ctx.tool, { action: "update", name: "fast", enabled: false });
    const out = await exec(ctx.tool, { action: "status" });
    expect(out).toContain("2 job(s) configured");
    expect(out).toContain('"slow"');
    expect(out).not.toContain('"fast"');
  });

  it("add with description shows it in list", async () => {
    await exec(ctx.tool, {
      action: "add",
      name: "described",
      intervalMs: 60000,
      message: "do stuff",
      description: "This is a helpful description of the job",
    });
    const out = await exec(ctx.tool, { action: "list" });
    expect(out).toContain("— This is a helpful description of the job");
  });

  it("add truncates long description to 200 chars", async () => {
    const longDesc = "a".repeat(250);
    await exec(ctx.tool, {
      action: "add",
      name: "long-desc",
      intervalMs: 60000,
      message: "msg",
      description: longDesc,
    });
    const entries: CronEntry[] = JSON.parse(readFileSync(ctx.configPath, "utf-8"));
    expect(entries[0].description).toBe("a".repeat(200) + "...");
    expect(entries[0].description!.length).toBe(203);
  });

  it("update truncates long description to 200 chars", async () => {
    await exec(ctx.tool, {
      action: "add",
      name: "trunc-test",
      intervalMs: 60000,
      message: "msg",
      description: "short",
    });
    const longDesc = "b".repeat(250);
    await exec(ctx.tool, {
      action: "update",
      name: "trunc-test",
      description: longDesc,
    });
    const entries: CronEntry[] = JSON.parse(readFileSync(ctx.configPath, "utf-8"));
    expect(entries[0].description).toBe("b".repeat(200) + "...");
    expect(entries[0].description!.length).toBe(203);
  });
});
