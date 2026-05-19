import { describe, test, expect, beforeEach } from "bun:test";
import { createFileReadTracker, getFileReadStats } from "../../src/lib/session-subscribers.js";
import { getDb } from "../../src/lib/requests.js";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

describe("File Read Tracker", () => {
  let persistDir: string;
  let tracker: (event: any) => void;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "file-read-test-"));
    // Initialize DB schema
    getDb(persistDir);
    tracker = createFileReadTracker(persistDir);
  });

  test("records cross-agent file reads", () => {
    tracker({
      type: "tool_call",
      sessionId: "s_123",
      agent: "tech-lead",
      tool: "read",
      args: { path: "agents/scout/workspace/deep-dive.md" },
    });

    const db = getDb(persistDir);
    const rows = db.prepare("SELECT * FROM file_reads").all() as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0].agent).toBe("tech-lead");
    expect(rows[0].producerAgent).toBe("scout");
    expect(rows[0].filePath).toBe("agents/scout/workspace/deep-dive.md");
  });

  test("skips self-reads", () => {
    tracker({
      type: "tool_call",
      sessionId: "s_123",
      agent: "scout",
      tool: "read",
      args: { path: "agents/scout/workspace/deep-dive.md" },
    });

    const db = getDb(persistDir);
    const rows = db.prepare("SELECT * FROM file_reads").all() as any[];
    expect(rows).toHaveLength(0);
  });

  test("skips non-read tool calls", () => {
    tracker({
      type: "tool_call",
      sessionId: "s_123",
      agent: "tech-lead",
      tool: "bash",
      args: { command: "ls" },
    });

    const db = getDb(persistDir);
    const rows = db.prepare("SELECT * FROM file_reads").all() as any[];
    expect(rows).toHaveLength(0);
  });

  test("records reads of non-agent files with null producer", () => {
    tracker({
      type: "tool_call",
      sessionId: "s_123",
      agent: "tech-lead",
      tool: "read",
      args: { path: "src/lib/manager.ts" },
    });

    const db = getDb(persistDir);
    const rows = db.prepare("SELECT * FROM file_reads").all() as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0].producerAgent).toBeNull();
  });

  test("getFileReadStats returns aggregated stats", () => {
    // tech-lead reads two scout files
    tracker({ type: "tool_call", sessionId: "s_1", agent: "tech-lead", tool: "read", args: { path: "agents/scout/workspace/a.md" } });
    tracker({ type: "tool_call", sessionId: "s_1", agent: "tech-lead", tool: "read", args: { path: "agents/scout/workspace/b.md" } });
    // may reads one scout file
    tracker({ type: "tool_call", sessionId: "s_2", agent: "may", tool: "read", args: { path: "agents/scout/workspace/a.md" } });

    const stats = getFileReadStats(persistDir, 1);
    expect(stats).toHaveLength(2);
    // tech-lead read 2 distinct files from scout
    const tlStat = stats.find((s) => s.reader === "tech-lead");
    expect(tlStat?.fileCount).toBe(2);
    expect(tlStat?.readCount).toBe(2);
    expect(tlStat?.producer).toBe("scout");
  });
});
