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
