import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { create, parseDeepEvaluationArtifact } from "../agents/may/handlers/eval-llm-scan.ts";
import { closeDb, getDb } from "../src/lib/requests.js";

describe("eval-llm-scan", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      closeDb(dir);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function setup() {
    const root = join(tmpdir(), `eval-llm-scan-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const persist = join(root, ".state");
    const agentsRoot = join(root, "agents");
    tempDirs.push(root);
    mkdirSync(join(agentsRoot, "evaluator", "workspace", "deep-evals"), { recursive: true });
    mkdirSync(persist, { recursive: true });

    const db = getDb(persist);
    const logs: string[] = [];
    const emitted: Array<{ type: string; data?: Record<string, unknown> }> = [];
    const runWorkflowCalls: Array<{ workflow: string; task: string; source?: string }> = [];

    const ctx = {
      sdk: {
        paths: { root, persist, agents: agentsRoot },
        getDb: () => db,
        log: (_level: string, msg: string) => logs.push(msg),
        emit: (type: string, data?: Record<string, unknown>) => emitted.push({ type, data }),
        runWorkflow: async (workflow: string, task: string, opts?: { source?: string }) => {
          runWorkflowCalls.push({ workflow, task, source: opts?.source });
          const sessionId = task.match(/Evaluate session (s_[^ ]+)/)?.[1] ?? "s_target";
          const artifactPath = join(root, "agents", "evaluator", "workspace", "deep-evals", `${sessionId}.json`);
          writeFileSync(artifactPath, JSON.stringify({
            sessionId,
            agent: "scout",
            quality: 0.92,
            efficiency: 0.8,
            productiveCalls: 8,
            wastedCalls: 1,
            verdict: "good",
            issues: ["strong synthesis worth learning from"],
            overall: { resultDelivered: true, valueProduced: "useful research note", learningCandidate: true },
            usage: {},
            failureChains: [],
          }), "utf-8");
          return { runId: "wr_eval", status: "done", summary: "wrote artifact" };
        },
        runAgent: async () => {
          throw new Error("eval-llm-scan should dispatch evaluator-deep-eval workflow");
        },
      },
    } as any;

    return { root, persist, db, logs, emitted, runWorkflowCalls, ctx };
  }

  function insertCandidate(db: ReturnType<typeof getDb>, now: number, sessionId = "s_target") {
    db.run(
      `INSERT INTO sessions (sessionId, agent, task, status, source, startedAt, endedAt, opCount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, "scout", "learn from an external project", "done", "workflow:project", now - 60 * 60_000, now - 50 * 60_000, 9],
    );
    db.run(
      `INSERT INTO evaluations (
        sessionId, agent, quality, efficiency, productiveCalls, wastedCalls,
        verdict, issues, overall, usage, failureChains,
        evaluatedByHeuristic, skippedByJs, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        "scout",
        0.85,
        0.8,
        8,
        0,
        "good",
        "[]",
        JSON.stringify({ aftermathWorkflow: true, heuristicVersion: 4 }),
        null,
        "[]",
        1,
        0,
        now - 49 * 60_000,
      ],
    );
  }

  it("parses valid deep evaluation artifacts", () => {
    const parsed = parseDeepEvaluationArtifact(JSON.stringify({
      sessionId: "s1",
      agent: "dev",
      quality: 1.5,
      efficiency: "0.75",
      productive_calls: 4,
      wasted_calls: 2,
      verdict: "needs improvement",
      issues: ["missing verification"],
      overall: { resultDelivered: false },
      failureChains: [],
    }), "s1", "dev");

    expect(parsed).toMatchObject({
      sessionId: "s1",
      agent: "dev",
      quality: 1,
      efficiency: 0.75,
      productiveCalls: 4,
      wastedCalls: 2,
      verdict: "needs_improvement",
      issues: ["missing verification"],
    });
    expect(parsed?.overall).toMatchObject({ deepEval: true, deepEvalVersion: 1 });
  });

  it("dispatches one evaluator workflow and records the artifact on the next scan", async () => {
    const { db, ctx, runWorkflowCalls, emitted } = setup();
    const now = Date.now();
    insertCandidate(db, now);

    const handler = create(ctx, {
      handlerConfig: { backfillHours: 24, fallbackDelayMs: 1 },
    } as any);

    await handler();
    await Promise.resolve();

    expect(runWorkflowCalls).toHaveLength(1);
    expect(runWorkflowCalls[0]).toMatchObject({ workflow: "evaluator-deep-eval", source: "evaluator" });
    expect(runWorkflowCalls[0].task).toContain("real value, not just process cleanliness");
    expect(emitted.some((event) => event.type === "evaluation.deep_dispatched")).toBe(true);

    await handler();

    const row = db.prepare(
      "SELECT evaluatedByHeuristic, skippedByJs, verdict, quality, overall FROM evaluations WHERE sessionId = ?",
    ).get("s_target") as any;
    expect(row).toMatchObject({ evaluatedByHeuristic: 0, skippedByJs: 0, verdict: "good", quality: 0.92 });
    expect(JSON.parse(row.overall)).toMatchObject({ deepEval: true, learningCandidate: true });
    expect(emitted.some((event) => event.type === "evaluation.deep_recorded")).toBe(true);
  });

  it("does not fail the handler while a deep evaluator workflow is still running", async () => {
    const { db, ctx, runWorkflowCalls, emitted } = setup();
    const now = Date.now();
    insertCandidate(db, now);

    ctx.sdk.runWorkflow = async (workflow: string, task: string, opts?: { source?: string }) => {
      runWorkflowCalls.push({ workflow, task, source: opts?.source });
      await new Promise(() => {});
      return { runId: "wr_never", status: "done", summary: "unreachable" };
    };

    const handler = create(ctx, {
      handlerConfig: { backfillHours: 24, fallbackDelayMs: 1 },
    } as any);

    await handler();

    expect(runWorkflowCalls).toHaveLength(1);
    expect(emitted.some((event) => event.type === "handler.failed")).toBe(false);
    expect(emitted.some((event) => event.type === "evaluation.deep_dispatched")).toBe(true);
  });

  it("does not dispatch while a recent deep evaluator session is running", async () => {
    const { db, ctx, runWorkflowCalls, logs } = setup();
    const now = Date.now();
    insertCandidate(db, now);
    db.run(
      `INSERT INTO sessions (sessionId, agent, task, status, source, startedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ["s_eval_running", "evaluator", "deep eval", "running", "eval-llm-scan", now - 60_000],
    );

    const handler = create(ctx, {
      handlerConfig: { backfillHours: 24, fallbackDelayMs: 1, activeWindowMs: 30 * 60_000 },
    } as any);

    await handler();

    expect(runWorkflowCalls).toEqual([]);
    expect(logs.some((msg) => msg.includes("still active"))).toBe(true);
  });
});
