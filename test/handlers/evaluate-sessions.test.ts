/**
 * Tests for findParentsWithUnevaluatedChildren() and handleEvaluateSessions()
 * from evaluate-sessions handler.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { findParentsWithUnevaluatedChildren } from "../../agents/may/handlers/evaluate-sessions.js";

describe("findParentsWithUnevaluatedChildren", () => {
  let dir: string;
  let persistDir: string;

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), "eval-sessions-"));
    persistDir = resolve(dir, ".state");
    mkdirSync(resolve(persistDir, "sessions"), { recursive: true });
    mkdirSync(resolve(persistDir, "evaluations"), { recursive: true });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function createSession(sid: string, meta: Record<string, unknown>, hasTranscript = true) {
    const sessionDir = resolve(persistDir, "sessions", sid);
    mkdirSync(sessionDir, { recursive: true });
    writeFileSync(resolve(sessionDir, "meta.json"), JSON.stringify(meta));
    if (hasTranscript) {
      writeFileSync(resolve(sessionDir, "session.jsonl"), '{"role":"user"}\n');
    }
  }

  function createEvaluation(sid: string) {
    writeFileSync(resolve(persistDir, "evaluations", `${sid}.json`), JSON.stringify({ verdict: "good" }));
  }

  it("returns empty when no sessions exist", () => {
    expect(findParentsWithUnevaluatedChildren(persistDir)).toEqual([]);
  });

  it("finds parent of unevaluated child session", () => {
    createSession("s_child_1", {
      agent: "coder",
      status: "complete",
      startedAt: Date.now(),
      task: "fix bug",
      parentSessionId: "s_parent_1",
    });

    const parents = findParentsWithUnevaluatedChildren(persistDir);
    expect(parents).toEqual(["s_parent_1"]);
  });

  it("skips already-evaluated sessions", () => {
    createSession("s_child_1", {
      agent: "coder",
      status: "complete",
      startedAt: Date.now(),
      task: "fix bug",
      parentSessionId: "s_parent_1",
    });
    createEvaluation("s_child_1");

    const parents = findParentsWithUnevaluatedChildren(persistDir);
    expect(parents).toEqual([]);
  });

  it("skips running/idle sessions", () => {
    createSession("s_running", {
      agent: "coder",
      status: "running",
      startedAt: Date.now(),
      task: "ongoing",
      parentSessionId: "s_parent_1",
    });

    expect(findParentsWithUnevaluatedChildren(persistDir)).toEqual([]);
  });

  it("skips meta-agent sessions (evaluator, optimizer, may)", () => {
    createSession("s_eval_1", {
      agent: "evaluator",
      status: "complete",
      startedAt: Date.now(),
      task: "evaluate",
      parentSessionId: "s_parent_1",
    });
    createSession("s_opt_1", {
      agent: "optimizer",
      status: "complete",
      startedAt: Date.now(),
      task: "optimize",
      parentSessionId: "s_parent_1",
    });
    createSession("s_may_1", {
      agent: "may",
      status: "complete",
      startedAt: Date.now(),
      task: "dispatch",
      parentSessionId: "s_parent_1",
    });

    expect(findParentsWithUnevaluatedChildren(persistDir)).toEqual([]);
  });

  it("skips sessions without transcript", () => {
    createSession("s_no_transcript", {
      agent: "coder",
      status: "complete",
      startedAt: Date.now(),
      task: "empty session",
      parentSessionId: "s_parent_1",
    }, false); // no transcript

    expect(findParentsWithUnevaluatedChildren(persistDir)).toEqual([]);
  });

  it("skips sessions without parentSessionId", () => {
    createSession("s_orphan", {
      agent: "coder",
      status: "complete",
      startedAt: Date.now(),
      task: "orphan task",
    });

    expect(findParentsWithUnevaluatedChildren(persistDir)).toEqual([]);
  });

  it("deduplicates parents with multiple unevaluated children", () => {
    createSession("s_child_1", {
      agent: "coder",
      status: "complete",
      startedAt: Date.now(),
      task: "task 1",
      parentSessionId: "s_parent_1",
    });
    createSession("s_child_2", {
      agent: "bob",
      status: "complete",
      startedAt: Date.now(),
      task: "task 2",
      parentSessionId: "s_parent_1",
    });

    const parents = findParentsWithUnevaluatedChildren(persistDir);
    expect(parents).toEqual(["s_parent_1"]);
  });
});
