import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { findUnevaluatedChildren } from "../evaluator.js";
import type { EvalCtx } from "../evaluator.js";
import type { PersistedSession } from "../../agent-sdk.js";

// ── In-memory EvalCtx backed by disk for session messages ────────────

function createTestCtx(persistDir: string): EvalCtx & { _evals: Map<string, { evaluatedByHeuristic?: boolean }> } {
  const evals = new Map<string, { evaluatedByHeuristic?: boolean }>();

  // Real session message reader (reads from disk JSONL files)
  function readMessages(sessionId: string, subdir: string): any[] {
    try {
      const { readFileSync } = require("node:fs");
      const jsonlPath = join(persistDir, subdir, sessionId, "session.jsonl");
      const content = readFileSync(jsonlPath, "utf-8").trim();
      if (!content) return [];
      return content.split("\n").map((line: string) => JSON.parse(line));
    } catch {
      return [];
    }
  }

  return {
    _evals: evals,
    readSessionMessages: (sessionId) => readMessages(sessionId, "sessions"),
    readArchivedSessionMessages: (sessionId) => readMessages(sessionId, "archive"),
    upsertEvaluation: (opts: any) => {
      evals.set(opts.sessionId, { evaluatedByHeuristic: opts.evaluatedByHeuristic ?? false });
    },
    hasEvaluation: (sessionId) => evals.has(sessionId),
    hasLLMEvaluation: (sessionId) => {
      const e = evals.get(sessionId);
      return e ? !e.evaluatedByHeuristic : false;
    },
    getAllEvaluations: () => [],
  };
}

function makeRegistry(sessions: Record<string, Partial<PersistedSession>>): Record<string, PersistedSession> {
  const result: Record<string, PersistedSession> = {};
  for (const [id, partial] of Object.entries(sessions)) {
    result[id] = {
      agent: partial.agent ?? "coder",
      task: partial.task ?? "test task",
      status: partial.status ?? "done",
      startedAt: partial.startedAt ?? Date.now(),
      parentSessionId: partial.parentSessionId,
      workflowRunId: partial.workflowRunId,
      stepLabel: partial.stepLabel,
    };
  }
  return result;
}

function writeSessionJsonl(persistDir: string, sessionId: string, messages: unknown[]): void {
  const dir = join(persistDir, "sessions", sessionId);
  mkdirSync(dir, { recursive: true });
  const jsonl = messages.map((m) => JSON.stringify(m)).join("\n") + "\n";
  writeFileSync(join(dir, "session.jsonl"), jsonl, "utf-8");
}

const skipAgents = new Set(["evaluator", "optimizer", "may"]);

const fakeMessages = [
  { role: "user", content: [{ type: "text", text: "do something" }], timestamp: 1 },
  { role: "assistant", content: [{ type: "text", text: "done" }] },
];

describe("findUnevaluatedChildren", () => {
  let persistDir: string;
  let ctx: ReturnType<typeof createTestCtx>;

  beforeEach(() => {
    persistDir = join(tmpdir(), `eval-task-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(persistDir, { recursive: true });
    ctx = createTestCtx(persistDir);
  });

  it("finds unevaluated child sessions", () => {
    const registry = makeRegistry({
      "may-session": { agent: "may", status: "idle" },
      "coder-1": { agent: "coder", status: "done", parentSessionId: "may-session" },
      "qa-1": { agent: "qa", status: "done", parentSessionId: "may-session" },
    });

    writeSessionJsonl(persistDir, "coder-1", fakeMessages);
    writeSessionJsonl(persistDir, "qa-1", fakeMessages);

    const children = findUnevaluatedChildren(ctx, registry, "may-session", skipAgents);
    expect(children).toHaveLength(2);
    expect(children.map((c) => c.agent).sort()).toEqual(["coder", "qa"]);
  });

  it("skips already evaluated sessions", () => {
    const registry = makeRegistry({
      "may-session": { agent: "may", status: "idle" },
      "coder-1": { agent: "coder", status: "done", parentSessionId: "may-session" },
      "coder-2": { agent: "coder", status: "done", parentSessionId: "may-session" },
    });

    writeSessionJsonl(persistDir, "coder-1", fakeMessages);
    writeSessionJsonl(persistDir, "coder-2", fakeMessages);
    ctx.upsertEvaluation({ sessionId: "coder-1", agent: "test", quality: 0, efficiency: 0, verdict: "skipped", createdAt: Date.now() });

    const children = findUnevaluatedChildren(ctx, registry, "may-session", skipAgents);
    expect(children).toHaveLength(1);
    expect(children[0].sessionId).toBe("coder-2");
  });

  it("skips meta agents (evaluator, optimizer, may)", () => {
    const registry = makeRegistry({
      "may-session": { agent: "may", status: "idle" },
      "coder-1": { agent: "coder", status: "done", parentSessionId: "may-session" },
      "eval-1": { agent: "evaluator", status: "done", parentSessionId: "may-session" },
      "opt-1": { agent: "optimizer", status: "done", parentSessionId: "may-session" },
    });

    writeSessionJsonl(persistDir, "coder-1", fakeMessages);
    writeSessionJsonl(persistDir, "eval-1", fakeMessages);
    writeSessionJsonl(persistDir, "opt-1", fakeMessages);

    const children = findUnevaluatedChildren(ctx, registry, "may-session", skipAgents);
    expect(children).toHaveLength(1);
    expect(children[0].agent).toBe("coder");
  });

  it("skips sessions still running", () => {
    const registry = makeRegistry({
      "may-session": { agent: "may", status: "idle" },
      "coder-1": { agent: "coder", status: "running", parentSessionId: "may-session" },
      "coder-2": { agent: "coder", status: "done", parentSessionId: "may-session" },
    });

    writeSessionJsonl(persistDir, "coder-1", fakeMessages);
    writeSessionJsonl(persistDir, "coder-2", fakeMessages);

    const children = findUnevaluatedChildren(ctx, registry, "may-session", skipAgents);
    expect(children).toHaveLength(1);
    expect(children[0].sessionId).toBe("coder-2");
  });

  it("skips sessions from other parents", () => {
    const registry = makeRegistry({
      "may-1": { agent: "may", status: "idle" },
      "may-2": { agent: "may", status: "idle" },
      "coder-1": { agent: "coder", status: "done", parentSessionId: "may-1" },
      "coder-2": { agent: "coder", status: "done", parentSessionId: "may-2" },
    });

    writeSessionJsonl(persistDir, "coder-1", fakeMessages);
    writeSessionJsonl(persistDir, "coder-2", fakeMessages);

    const children = findUnevaluatedChildren(ctx, registry, "may-1", skipAgents);
    expect(children).toHaveLength(1);
    expect(children[0].sessionId).toBe("coder-1");
  });

  it("skips sessions with empty transcripts", () => {
    const registry = makeRegistry({
      "may-session": { agent: "may", status: "idle" },
      "coder-1": { agent: "coder", status: "done", parentSessionId: "may-session" },
      "coder-2": { agent: "coder", status: "done", parentSessionId: "may-session" },
    });

    writeSessionJsonl(persistDir, "coder-1", fakeMessages);
    // coder-2 has no transcript written

    const children = findUnevaluatedChildren(ctx, registry, "may-session", skipAgents);
    expect(children).toHaveLength(1);
    expect(children[0].sessionId).toBe("coder-1");
  });

  it("returns empty when all children are evaluated", () => {
    const registry = makeRegistry({
      "may-session": { agent: "may", status: "idle" },
      "coder-1": { agent: "coder", status: "done", parentSessionId: "may-session" },
    });

    writeSessionJsonl(persistDir, "coder-1", fakeMessages);
    ctx.upsertEvaluation({ sessionId: "coder-1", agent: "test", quality: 0, efficiency: 0, verdict: "skipped", createdAt: Date.now() });

    const children = findUnevaluatedChildren(ctx, registry, "may-session", skipAgents);
    expect(children).toHaveLength(0);
  });

  it("returns empty when parent has no children", () => {
    const registry = makeRegistry({
      "may-session": { agent: "may", status: "idle" },
    });

    const children = findUnevaluatedChildren(ctx, registry, "may-session", skipAgents);
    expect(children).toHaveLength(0);
  });

  it("loads messages from child sessions", () => {
    const registry = makeRegistry({
      "may-session": { agent: "may", status: "idle" },
      "coder-1": { agent: "coder", status: "done", parentSessionId: "may-session", task: "implement foo" },
    });

    writeSessionJsonl(persistDir, "coder-1", fakeMessages);

    const children = findUnevaluatedChildren(ctx, registry, "may-session", skipAgents);
    expect(children).toHaveLength(1);
    expect(children[0].agent).toBe("coder");
    expect(children[0].task).toBe("implement foo");
    expect(children[0].messages).toHaveLength(2);
    expect((children[0].messages[0] as any).role).toBe("user");
  });

  it("includes sessions with only heuristic evaluations (allows LLM upgrade)", () => {
    const registry = makeRegistry({
      "may-session": { agent: "may", status: "idle" },
      "coder-1": { agent: "coder", status: "done", parentSessionId: "may-session" },
      "coder-2": { agent: "coder", status: "done", parentSessionId: "may-session" },
    });

    writeSessionJsonl(persistDir, "coder-1", fakeMessages);
    writeSessionJsonl(persistDir, "coder-2", fakeMessages);
    ctx.upsertEvaluation({ sessionId: "coder-1", agent: "test", quality: 1.0, efficiency: 0.8, verdict: "good", evaluatedByHeuristic: true, createdAt: Date.now() });

    const children = findUnevaluatedChildren(ctx, registry, "may-session", skipAgents);
    expect(children).toHaveLength(2);
    const sessionIds = children.map(c => c.sessionId).sort();
    expect(sessionIds).toEqual(["coder-1", "coder-2"]);
  });

  it("skips sessions with LLM evaluations (no double LLM eval)", () => {
    const registry = makeRegistry({
      "may-session": { agent: "may", status: "idle" },
      "coder-1": { agent: "coder", status: "done", parentSessionId: "may-session" },
      "coder-2": { agent: "coder", status: "done", parentSessionId: "may-session" },
    });

    writeSessionJsonl(persistDir, "coder-1", fakeMessages);
    writeSessionJsonl(persistDir, "coder-2", fakeMessages);
    ctx.upsertEvaluation({ sessionId: "coder-1", agent: "test", quality: 0, efficiency: 0, verdict: "skipped", createdAt: Date.now() });

    const children = findUnevaluatedChildren(ctx, registry, "may-session", skipAgents);
    expect(children).toHaveLength(1);
    expect(children[0].sessionId).toBe("coder-2");
  });
});
