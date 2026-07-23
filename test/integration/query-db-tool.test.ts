import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createQueryDbTool } from "../../src/lib/tools/query-db.js";
import { closeDb, getDb } from "../../src/lib/requests.js";
import { loadAgents } from "../../src/app/agent-loader.js";

let persistDir: string;

async function runQuery(tool: ReturnType<typeof createQueryDbTool>, params: Record<string, unknown>) {
  return tool.execute("tc_test", params);
}

function resultText(result: Awaited<ReturnType<typeof runQuery>>): string {
  return result.content.map((part) => ("text" in part ? part.text : "")).join("\n");
}

describe("query_db tool", () => {
  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "query-db-tool-"));
  });

  afterEach(() => {
    closeDb(persistDir);
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("uses getDb and runs bounded read-only queries", async () => {
    const db = getDb(persistDir);
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, startedAt) VALUES (?, ?, ?, ?, ?)",
      ["s_test", "may", "inspect db", "done", Date.now()],
    );

    const tool = createQueryDbTool(persistDir);
    const result = await runQuery(tool, {
      sql: "SELECT sessionId, agent, status FROM sessions WHERE agent = ?",
      params: ["may"],
      limit: 10,
    });

    const parsed = JSON.parse(resultText(result));
    expect(parsed.rows).toEqual([{ sessionId: "s_test", agent: "may", status: "done" }]);
    expect(result.details).toMatchObject({ rowCount: 1, limit: 10, truncated: false });
  });

  it("rejects writes", async () => {
    const tool = createQueryDbTool(persistDir);
    const result = await runQuery(tool, {
      sql: "UPDATE sessions SET status = 'done'",
    });

    expect(JSON.parse(resultText(result)).error).toContain("read-only");
  });

  it("allows schema inspection pragmas", async () => {
    getDb(persistDir);
    const tool = createQueryDbTool(persistDir);
    const result = await runQuery(tool, { sql: "PRAGMA table_info(sessions)" });
    const parsed = JSON.parse(resultText(result));

    expect(parsed.rows.some((row: { name?: string }) => row.name === "sessionId")).toBe(true);
  });

  it("returns table schema hints when a query guesses wrong columns", async () => {
    getDb(persistDir);
    const tool = createQueryDbTool(persistDir);
    const result = await runQuery(tool, {
      sql: "SELECT current_value, target_value FROM metrics",
    });
    const parsed = JSON.parse(resultText(result));

    expect(parsed.error).toContain("no such column");
    expect(parsed.hint).toContain("real column names");
    expect(parsed.schema.metrics).toContain("current");
    expect(parsed.schema.metrics).toContain("target");
    expect(parsed.schema.metrics).toContain("threshold");
    expect(parsed.schema.metrics).not.toContain("current_value");
  });

  it("returns schema hints for joined alert queries that use legacy open-alert columns", async () => {
    getDb(persistDir);
    const tool = createQueryDbTool(persistDir);
    const result = await runQuery(tool, {
      sql: "SELECT metric_name, status FROM metric_alerts WHERE status = 'open'",
    });
    const parsed = JSON.parse(resultText(result));

    expect(parsed.error).toContain("no such column");
    expect(parsed.schema.metric_alerts).toContain("metric_id");
    expect(parsed.schema.metric_alerts).toContain("resolved_at");
    expect(parsed.schema.metric_alerts).not.toContain("status");
  });

  it("is loaded as a core tool for agents", async () => {
    const root = mkdtempSync(join(tmpdir(), "query-db-loader-"));
    try {
      const agentsRoot = join(root, "agents");
      const agentDir = join(agentsRoot, "sample");
      mkdirSync(agentDir, { recursive: true });
      writeFileSync(
        join(agentDir, "agent.json"),
        JSON.stringify({
          name: "sample",
          description: "Sample agent",
          domain: "test",
          model: "claude-opus-4-6",
          tools: ["read-only", "query_db"],
        }),
      );

      const registered: Array<{ name: string; tools: Array<{ name: string }> }> = [];
      const manager = {
        hasAgent: () => false,
        register: (config: { name: string; tools: Array<{ name: string }> }) => {
          registered.push(config);
        },
      };

      await loadAgents({
        agentsRoot,
        projectRoot: root,
        persistDir: join(root, ".state"),
        models: { "claude-opus-4-6": { id: "claude-opus-4-6", provider: "test", apiKey: "test" } } as any,
        manager: manager as any,
        bus: { emit: () => undefined } as any,
        cronEnabled: false,
      });

      expect(registered).toHaveLength(1);
      expect(registered[0].tools.filter((tool) => tool.name === "query_db")).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
