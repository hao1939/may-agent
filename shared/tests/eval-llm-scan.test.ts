import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "../../../src/lib/requests.js";
import { create } from "../../may/handlers/eval-llm-scan.js";

describe("eval-llm-scan handler", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      closeDb(join(root, ".state"));
      rmSync(root, { recursive: true, force: true });
    }
  });

  function harness() {
    const root = mkdtempSync(join(tmpdir(), "eval-llm-scan-"));
    roots.push(root);
    const persist = join(root, ".state");
    const agents = join(root, "agents");
    mkdirSync(agents, { recursive: true });
    const db = getDb(persist);
    const runWorkflow = vi.fn(async (_workflow: string, _task: string) => {
      const artifactDir = join(root, "agents", "evaluator", "workspace", "deep-evals");
      mkdirSync(artifactDir, { recursive: true });
      writeFileSync(join(artifactDir, "s_candidate.json"), JSON.stringify({
        sessionId: "s_candidate",
        agent: "dev",
        quality: 0.8,
        efficiency: 0.7,
        productiveCalls: 3,
        wastedCalls: 1,
        verdict: "good",
        issues: ["useful implementation"],
        overall: { resultDelivered: true, valueProduced: "patch" },
        usage: {},
        failureChains: [],
      }));
      return { status: "done" as const, summary: "ok", runId: "wr_deep" };
    });
    const ctx = {
      agentName: "evaluator",
      sdk: {
        paths: { root, persist, agents },
        getDb: () => db,
        runWorkflow,
        runAgent: vi.fn(() => { throw new Error("runAgent should not be called by eval-llm-scan handler"); }),
        emit: vi.fn(),
        log: vi.fn(),
      },
    } as any;
    return { root, persist, db, ctx, runWorkflow };
  }

  it("dispatches deep evaluator work through workflow and records validated artifact", async () => {
    const { db, ctx, runWorkflow } = harness();
    const endedAt = Date.now() - 60_000;
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, source, startedAt, endedAt, opCount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["s_candidate", "dev", "fix a bug", "done", "workflow:dev-heartbeat", endedAt - 30_000, endedAt, 7],
    );

    const handler = create(ctx, {
      handlerConfig: {
        backfillHours: 24,
        fallbackDelayMs: 0,
        runTimeoutMs: 10_000,
        activeWindowMs: 1,
        artifactLimit: 3,
      },
    } as any);

    await handler();

    expect(runWorkflow).toHaveBeenCalledWith(
      "evaluator-deep-eval",
      expect.stringContaining("[deep-eval] Evaluate session s_candidate"),
      { source: "evaluator" },
    );
    expect(ctx.sdk.runAgent).not.toHaveBeenCalled();
    expect(ctx.sdk.emit).toHaveBeenCalledWith("handler.workflow_dispatched", expect.objectContaining({
      handler: "eval-llm-scan",
      workflow: "evaluator-deep-eval",
      workflowRunId: "wr_deep",
      sessionId: "s_candidate",
    }));
    const row = db.prepare("SELECT verdict, evaluatedByHeuristic FROM evaluations WHERE sessionId = ?").get("s_candidate") as { verdict: string; evaluatedByHeuristic: number } | null;
    expect(row).toEqual({ verdict: "good", evaluatedByHeuristic: 0 });
    expect(existsSync(join(ctx.sdk.paths.root, "agents", "evaluator", "workspace", "deep-evals", "s_candidate.json"))).toBe(true);
  });
});
