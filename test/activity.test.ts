/**
 * activity.test.ts — Tests for the activity tracking module.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  appendActivity,
  activityPath,
  truncateSummary,
  PROGRESS_INTERVAL,
  SUMMARY_MAX_CHARS,
  type StartEvent,
  type ProgressEvent,
  type DoneEvent,
  type ErrorEvent,
  type BlockedEvent,
} from "../src/lib/activity.js";

describe("activity", () => {
  let agentsRoot: string;

  beforeEach(() => {
    agentsRoot = mkdtempSync(join(tmpdir(), "activity-test-"));
  });

  afterEach(() => {
    rmSync(agentsRoot, { recursive: true, force: true });
  });

  describe("activityPath", () => {
    it("resolves to agents/<name>/workspace/activity.jsonl", () => {
      const path = activityPath("/app", "tech-lead");
      expect(path).toBe("/app/agents/tech-lead/workspace/activity.jsonl");
    });

    it("uses workspacePath when provided instead of constructing from agent name", () => {
      const path = activityPath("/app", "bob-c40", "/app/agents/bob/workspace");
      expect(path).toBe("/app/agents/bob/workspace/activity.jsonl");
    });

    it("falls back to default when workspacePath is undefined", () => {
      const path = activityPath("/app", "bob-c40", undefined);
      expect(path).toBe("/app/agents/bob-c40/workspace/activity.jsonl");
    });
  });

  describe("appendActivity", () => {
    it("creates directory and appends a start event", () => {
      const event: StartEvent = {
        ts: 1773574054,
        event: "start",
        sid: "s_1773574054340_1115",
        agent: "tech-lead",
        task: "Implement Layer 2",
      };
      appendActivity(agentsRoot, event);

      const filePath = activityPath(agentsRoot, "tech-lead");
      expect(existsSync(filePath)).toBe(true);

      const content = readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(content.trim());
      expect(parsed.event).toBe("start");
      expect(parsed.task).toBe("Implement Layer 2");
      expect(parsed.sid).toBe("s_1773574054340_1115");
    });

    it("appends multiple events as separate JSONL lines", () => {
      const start: StartEvent = {
        ts: 1773574054,
        event: "start",
        sid: "s_1",
        agent: "bob",
        task: "Review design",
      };
      const progress: ProgressEvent = {
        ts: 1773574200,
        event: "progress",
        sid: "s_1",
        agent: "bob",
        turns: 5,
        summary: "Reading brief, analyzing architecture",
      };
      const done: DoneEvent = {
        ts: 1773574890,
        event: "done",
        sid: "s_1",
        agent: "bob",
        turns: 12,
        duration: "13m56s",
        summary: "Review complete, 3 recommendations",
        files: ["agents/bob/workspace/review.md"],
      };

      appendActivity(agentsRoot, start);
      appendActivity(agentsRoot, progress);
      appendActivity(agentsRoot, done);

      const filePath = activityPath(agentsRoot, "bob");
      const lines = readFileSync(filePath, "utf-8").trim().split("\n");
      expect(lines).toHaveLength(3);

      const events = lines.map((l) => JSON.parse(l));
      expect(events[0].event).toBe("start");
      expect(events[1].event).toBe("progress");
      expect(events[1].turns).toBe(5);
      expect(events[2].event).toBe("done");
      expect(events[2].files).toEqual(["agents/bob/workspace/review.md"]);
    });

    it("writes error events with error field", () => {
      const event: ErrorEvent = {
        ts: 1773575900,
        event: "error",
        sid: "s_2",
        agent: "coder",
        turns: 9,
        duration: "8m44s",
        summary: "bun build fails",
        error: "BunBuildError: Cannot resolve module",
      };
      appendActivity(agentsRoot, event);

      const filePath = activityPath(agentsRoot, "coder");
      const parsed = JSON.parse(readFileSync(filePath, "utf-8").trim());
      expect(parsed.event).toBe("error");
      expect(parsed.error).toBe("BunBuildError: Cannot resolve module");
    });

    it("writes blocked events with blocker field", () => {
      const event: BlockedEvent = {
        ts: 1773576100,
        event: "blocked",
        sid: "s_3",
        agent: "tech-lead",
        turns: 3,
        summary: "Need npm publish credentials",
        blocker: "waiting on human: npm publish credentials",
      };
      appendActivity(agentsRoot, event);

      const filePath = activityPath(agentsRoot, "tech-lead");
      const parsed = JSON.parse(readFileSync(filePath, "utf-8").trim());
      expect(parsed.event).toBe("blocked");
      expect(parsed.blocker).toBe("waiting on human: npm publish credentials");
    });

    it("handles multiple agents writing to different files", () => {
      appendActivity(agentsRoot, {
        ts: 1, event: "start", sid: "s_1", agent: "alice", task: "task A",
      });
      appendActivity(agentsRoot, {
        ts: 2, event: "start", sid: "s_2", agent: "bob", task: "task B",
      });

      expect(existsSync(activityPath(agentsRoot, "alice"))).toBe(true);
      expect(existsSync(activityPath(agentsRoot, "bob"))).toBe(true);

      const aliceContent = readFileSync(activityPath(agentsRoot, "alice"), "utf-8");
      const bobContent = readFileSync(activityPath(agentsRoot, "bob"), "utf-8");
      expect(JSON.parse(aliceContent.trim()).task).toBe("task A");
      expect(JSON.parse(bobContent.trim()).task).toBe("task B");
    });

    it("does not throw on invalid path", () => {
      // Best-effort: appendActivity should never throw
      expect(() => {
        appendActivity("/nonexistent/readonly/path", {
          ts: 1, event: "start", sid: "s_1", agent: "test", task: "test",
        });
      }).not.toThrow();
    });

    it("writes to custom workspace path instead of ghost directory (fork agents)", () => {
      // Simulate a fork agent "bob-c40" whose workspace is agents/bob/workspace
      const bobWorkspace = join(agentsRoot, "agents", "bob", "workspace");
      const event: StartEvent = {
        ts: 1773574054,
        event: "start",
        sid: "s_fork_1",
        agent: "bob-c40",
        task: "Fork task",
      };
      appendActivity(agentsRoot, event, bobWorkspace);

      // Should write to bob's workspace, NOT create agents/bob-c40/workspace/
      const expectedPath = join(bobWorkspace, "activity.jsonl");
      expect(existsSync(expectedPath)).toBe(true);

      const ghostPath = join(agentsRoot, "agents", "bob-c40", "workspace", "activity.jsonl");
      expect(existsSync(ghostPath)).toBe(false);

      const content = readFileSync(expectedPath, "utf-8");
      const parsed = JSON.parse(content.trim());
      expect(parsed.agent).toBe("bob-c40");
      expect(parsed.task).toBe("Fork task");
    });
  });

  describe("activity file trimming", () => {
    it("trims activity file when it exceeds size threshold on start event", () => {
      const filePath = activityPath(agentsRoot, "bloaty");
      // Write 2000 large lines to exceed 500KB threshold
      for (let i = 0; i < 2000; i++) {
        appendActivity(agentsRoot, {
          ts: i,
          event: "progress",
          sid: `s_${i}`,
          agent: "bloaty",
          turns: i,
          summary: "x".repeat(190), // ~250 bytes per line
        });
      }
      const beforeLines = readFileSync(filePath, "utf-8").trim().split("\n").length;
      expect(beforeLines).toBe(2000);

      // Now append a "start" event which triggers trimming
      appendActivity(agentsRoot, {
        ts: 9999,
        event: "start",
        sid: "s_trim",
        agent: "bloaty",
        task: "trigger trim",
      });

      const afterContent = readFileSync(filePath, "utf-8").trim().split("\n");
      // Should be 1000 retained + 1 new start event = 1001
      expect(afterContent.length).toBe(1001);
      // Last line should be the new start event
      const lastEvent = JSON.parse(afterContent[afterContent.length - 1]);
      expect(lastEvent.event).toBe("start");
      expect(lastEvent.sid).toBe("s_trim");
      // Retained lines should be the most recent (tail)
      const firstRetained = JSON.parse(afterContent[0]);
      expect(firstRetained.ts).toBe(1000); // kept lines 1000-1999
    });

    it("does not trim small activity files", () => {
      // Write just 10 lines — well under 500KB
      for (let i = 0; i < 10; i++) {
        appendActivity(agentsRoot, {
          ts: i,
          event: "progress",
          sid: `s_${i}`,
          agent: "small",
          turns: i,
          summary: "small entry",
        });
      }
      appendActivity(agentsRoot, {
        ts: 99,
        event: "start",
        sid: "s_start",
        agent: "small",
        task: "no trim needed",
      });

      const filePath = activityPath(agentsRoot, "small");
      const lines = readFileSync(filePath, "utf-8").trim().split("\n");
      expect(lines.length).toBe(11); // 10 progress + 1 start, no trimming
    });

    it("does not trim on non-start events", () => {
      const filePath = activityPath(agentsRoot, "notrim");
      // Write enough to exceed threshold
      for (let i = 0; i < 2000; i++) {
        appendActivity(agentsRoot, {
          ts: i,
          event: "progress",
          sid: `s_${i}`,
          agent: "notrim",
          turns: i,
          summary: "x".repeat(190),
        });
      }

      // Append another progress event (not start) — should NOT trigger trim
      appendActivity(agentsRoot, {
        ts: 9999,
        event: "progress",
        sid: "s_nope",
        agent: "notrim",
        turns: 9999,
        summary: "no trim",
      });

      const lines = readFileSync(filePath, "utf-8").trim().split("\n");
      expect(lines.length).toBe(2001); // all lines kept, no trim
    });
  });

  describe("truncateSummary", () => {
    it("returns '(no summary)' for null", () => {
      expect(truncateSummary(null)).toBe("(no summary)");
    });

    it("returns '(no summary)' for empty string", () => {
      expect(truncateSummary("")).toBe("(no summary)");
    });

    it("collapses newlines and whitespace", () => {
      const input = "Line one\n\nLine two\n  \n  Line three";
      expect(truncateSummary(input)).toBe("Line one Line two Line three");
    });

    it("truncates long strings with ellipsis", () => {
      const long = "a".repeat(300);
      const result = truncateSummary(long);
      expect(result.length).toBe(SUMMARY_MAX_CHARS);
      expect(result.endsWith("…")).toBe(true);
    });

    it("does not truncate strings within limit", () => {
      const short = "a".repeat(50);
      expect(truncateSummary(short)).toBe(short);
    });

    it("respects custom maxLen", () => {
      const input = "Hello World, this is a test summary";
      const result = truncateSummary(input, 15);
      expect(result.length).toBe(15);
      expect(result).toBe("Hello World, t…");
    });
  });

  describe("constants", () => {
    it("PROGRESS_INTERVAL is a positive number", () => {
      expect(PROGRESS_INTERVAL).toBeGreaterThan(0);
    });

    it("SUMMARY_MAX_CHARS is a positive number", () => {
      expect(SUMMARY_MAX_CHARS).toBeGreaterThan(0);
    });
  });
});
