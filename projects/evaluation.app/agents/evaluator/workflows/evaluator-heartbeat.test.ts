import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { admitProjectAppTaskHandlerResult } from "@may-agent/sdk";
import { execute, normalizeOwnerResult } from "./evaluator-heartbeat";

function context(result: Record<string, unknown>) {
  const emitted: Array<Record<string, unknown>> = [];
  let runOptions: Record<string, unknown> | undefined;
  const unavailable = () => {
    throw new Error("not available in unit test");
  };
  return {
    emitted,
    get runOptions() {
      return runOptions;
    },
    ctx: {
      task: "evaluation owner review",
      query: {
        metrics: unavailable,
        workflowRuns: unavailable,
        events: unavailable,
      },
      emit(event: Record<string, unknown>) {
        emitted.push(event);
      },
      async runAgent(
        _agent: string,
        _prompt: string,
        options: Record<string, unknown>,
      ) {
        runOptions = options;
        return {
          sessionId: "s_owner",
          status: "done",
          lastAssistantText: "reviewed",
          messages: [],
          structuredResult: result,
        };
      },
      done(summary: string, output?: unknown) {
        return { type: "done", summary, output };
      },
      blocked(reason: string, detail?: unknown) {
        return { type: "blocked", reason, context: detail };
      },
    } as any,
  };
}

describe("evaluation owner action boundary", () => {
  it("runs owner judgment read-only and returns a typed no-op to the reconciler", async () => {
    const harness = context({
      state: "converged",
      summary: "Existing tasks already cover the signal.",
      evidence: ["No changed anomaly"],
      actions: [],
    });

    const result = await execute(harness.ctx);

    expect(result.type).toBe("done");
    expect(harness.runOptions?.tools).toBe("readonly");
    expect(harness.runOptions?.schema).toBeDefined();
    expect(harness.emitted.at(-1)?.type).toBe("evaluation.owner_reviewed");
    if (result.type === "done") {
      expect((result.output as Record<string, unknown>).actions).toEqual([]);
    }
  });

  it("converts failed inner owner review sessions into visible no-action fallback", async () => {
    const harness = context({
      state: "converged",
      summary: "unused",
      evidence: [],
      actions: [],
    });
    harness.ctx.runAgent = async (
      _agent: string,
      _prompt: string,
      _options: Record<string, unknown>,
    ) => {
      return {
        sessionId: "s_empty_owner",
        status: "error",
        lastAssistantText: "",
        messages: [],
        structuredResult: undefined,
      };
    };

    const result = await execute(harness.ctx);

    expect(result.type).toBe("done");
    expect(harness.emitted.map((event) => event.type)).toContain(
      "evaluation.owner_review_failed_fallback",
    );
    expect(harness.emitted.at(-1)).toMatchObject({
      type: "evaluation.owner_reviewed",
      data: { state: "converged", proposedActions: [] },
    });
    if (result.type === "done") {
      expect(result.output).toMatchObject({
        state: "converged",
        actions: [],
      });
      expect(JSON.stringify(result.output)).toContain(
        "owner-review-session:s_empty_owner",
      );
    }
  });

  it("coerces invalid needs-owner payloads with actions or conditions to a converged no-op", async () => {
    const harness = context({
      state: "needs-owner",
      summary: "Need owner action with a condition.",
      evidence: ["affected session-aftermath case"],
      actions: [
        {
          kind: "create-task",
          id: "repair-invalid-needs-owner",
          outcome: "Repair invalid handoff.",
          acceptance: ["no rejected needs-owner payload"],
        },
      ],
      conditions: [
        {
          id: "invalid-wait",
          type: "session.state",
          subject: "session:s_owner",
          expected: { field: "status", equals: "done" },
        },
      ],
    });

    const result = await execute(harness.ctx);

    expect(result.type).toBe("done");
    expect(harness.emitted.at(-1)).toMatchObject({
      type: "evaluation.owner_reviewed",
      data: { state: "converged", proposedActions: [] },
    });
    if (result.type === "done") {
      expect(result.output).toMatchObject({
        state: "converged",
        actions: [],
      });
      expect(JSON.stringify(result.output)).toContain(
        "invalid needs-owner with actions and conditions",
      );
      expect(JSON.stringify(result.output)).toContain(
        "needs-owner cannot include actions or Conditions",
      );
      expect(JSON.stringify(result.output)).not.toContain(
        "repair-invalid-needs-owner",
      );
      expect(result.output).not.toHaveProperty("conditions");
      const admitted = admitProjectAppTaskHandlerResult(result.output, {
        allowNeedsOwner: true,
        defaultParentId: "evaluation-system",
      });
      expect(admitted.ok).toBe(true);
    }
  });

  it("normalizes a representative malformed needs-owner aftermath payload into an admitted handler result", () => {
    const malformed = {
      state: "needs-owner",
      summary: "Session aftermath needs owner action and a retry condition.",
      evidence: ["runtime/session-aftermath/s_example rejected previously"],
      actions: [
        {
          kind: "create-task",
          id: "retry-session-aftermath-example",
          outcome: "Retry session aftermath.",
          acceptance: ["accepted by handler contract"],
        },
      ],
      conditions: [
        {
          id: "session-aftermath-example-retry",
          type: "session.state",
          subject: "session:s_example",
          expected: { field: "status", equals: "done" },
        },
      ],
    };

    expect(
      admitProjectAppTaskHandlerResult(malformed, {
        allowNeedsOwner: true,
        defaultParentId: "evaluation-system",
      }),
    ).toMatchObject({
      ok: false,
      error: "needs-owner cannot include actions or Conditions",
    });

    const normalized = normalizeOwnerResult(malformed);
    expect(normalized).toMatchObject({
      state: "converged",
      actions: [],
    });
    expect(normalized).not.toHaveProperty("conditions");
    expect(
      admitProjectAppTaskHandlerResult(normalized, {
        allowNeedsOwner: true,
        defaultParentId: "evaluation-system",
      }),
    ).toMatchObject({ ok: true });
  });

  it("coerces a waiting no-op without exact conditions to converged", async () => {
    const harness = context({
      state: "waiting",
      summary: "No task-tree edit; wait for the next owner wake.",
      evidence: [
        "Regression shape: Waiting result for runtime/owner-review requires at least one exact Condition",
      ],
      actions: [],
      conditions: [],
    });

    const result = await execute(harness.ctx);

    expect(result.type).toBe("done");
    expect(harness.emitted.at(-1)).toMatchObject({
      type: "evaluation.owner_reviewed",
      data: { state: "converged", proposedActions: [] },
    });
    if (result.type === "done") {
      expect(result.output).toMatchObject({
        state: "converged",
        actions: [],
        conditions: [],
      });
      expect(
        String((result.output as Record<string, unknown>).summary),
      ).toContain("waiting without exact conditions");
    }
  });

  it("preserves waiting when exact conditions are present", async () => {
    const harness = context({
      state: "waiting",
      summary: "Wait for runtime patch evidence.",
      evidence: ["Owner identified a real external wait."],
      actions: [],
      conditions: [
        {
          id: "runtime-owner-review-contract-patch-observed",
          type: "event-observed",
          subject: "runtime/owner-review contract enforcement",
          expected:
            "a passing owner-review reconciliation with exact conditions",
          owner: "may-agent.app",
        },
      ],
    });

    const result = await execute(harness.ctx);

    expect(result.type).toBe("done");
    if (result.type === "done") {
      expect(result.output).toMatchObject({
        state: "waiting",
        conditions: [
          {
            id: "runtime-owner-review-contract-patch-observed",
            type: "event-observed",
          },
        ],
      });
    }
  });

  it("filters proposed mutations of reconciler-owned runtime tasks", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "evaluator-heartbeat-runtime-"));
    const previous = process.env.MAY_AGENT_TASK_TREE_PATH;
    try {
      process.env.MAY_AGENT_TASK_TREE_PATH = join(tmp, "tree.json");
      writeFileSync(
        process.env.MAY_AGENT_TASK_TREE_PATH,
        JSON.stringify({
          version: 1,
          project: "evaluation",
          root_task_id: "root",
          active_task_ids: ["root", "normal-evaluator-task"],
          tasks: {
            root: { id: "root", item_type: "task", phase: "waiting" },
            "runtime/owner-review": {
              id: "runtime/owner-review",
              item_type: "task",
              phase: "attention",
              generation: 1,
            },
            "normal-evaluator-task": {
              id: "normal-evaluator-task",
              item_type: "task",
              phase: "attention",
              generation: 2,
            },
          },
        }),
      );
      const harness = context({
        state: "converged",
        summary: "Change the controller task.",
        evidence: [],
        actions: [
          {
            kind: "close-task",
            taskId: "runtime/owner-review",
            expectedGeneration: 1,
            summary: "closed",
          },
          {
            kind: "update-task",
            taskId: "normal-evaluator-task",
            expectedGeneration: 2,
            priority: "P1",
          },
        ],
      });

      const result = await execute(harness.ctx);

      expect(result.type).toBe("done");
      expect(harness.emitted.at(-1)).toMatchObject({
        type: "evaluation.owner_reviewed",
        data: {
          proposedActions: [
            {
              kind: "update-task",
              taskId: "normal-evaluator-task",
            },
          ],
        },
      });
      if (result.type === "done") {
        expect(result.output).toMatchObject({
          actions: [{ kind: "update-task", taskId: "normal-evaluator-task" }],
        });
        expect(JSON.stringify(result.output)).toContain(
          "Filtered 1 illegal runtime task mutation",
        );
      }
    } finally {
      if (previous === undefined) {
        delete process.env.MAY_AGENT_TASK_TREE_PATH;
      } else {
        process.env.MAY_AGENT_TASK_TREE_PATH = previous;
      }
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("filters pipeline-health owner mutations of standing runtime children", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "evaluator-heartbeat-pipeline-"));
    const previous = process.env.MAY_AGENT_TASK_TREE_PATH;
    try {
      process.env.MAY_AGENT_TASK_TREE_PATH = join(tmp, "tree.json");
      writeFileSync(
        process.env.MAY_AGENT_TASK_TREE_PATH,
        JSON.stringify({
          version: 1,
          project: "evaluation",
          root_task_id: "root",
          active_task_ids: ["pipeline-health"],
          tasks: {
            root: { id: "root", item_type: "task", phase: "waiting" },
            "pipeline-health": {
              id: "pipeline-health",
              item_type: "task",
              phase: "running",
              generation: 1,
              children: ["runtime/deep-eval-scan", "runtime/aftermath-backfill"],
            },
            "runtime/deep-eval-scan": {
              id: "runtime/deep-eval-scan",
              item_type: "task",
              phase: "attention",
              generation: 7,
            },
            "runtime/aftermath-backfill": {
              id: "runtime/aftermath-backfill",
              item_type: "task",
              phase: "waiting",
              generation: 8,
            },
          },
        }),
      );
      const harness = context({
        state: "converged",
        summary: "Directly clean up standing pipeline children.",
        evidence: ["owner attempted illegal runtime child mutation"],
        actions: [
          {
            kind: "close-task",
            taskId: "runtime/deep-eval-scan",
            expectedGeneration: 7,
            summary: "closed by owner",
          },
          {
            kind: "unblock-task",
            taskId: "runtime/aftermath-backfill",
            expectedGeneration: 8,
            reason: "retry scan",
          },
        ],
      });

      const result = await execute(harness.ctx);

      expect(result.type).toBe("done");
      expect(harness.emitted.at(-1)).toMatchObject({
        type: "evaluation.owner_reviewed",
        data: { proposedActions: [] },
      });
      if (result.type === "done") {
        expect(result.output).toMatchObject({ actions: [] });
        expect(JSON.stringify(result.output)).toContain(
          "Filtered 2 illegal runtime task mutation",
        );
        expect(JSON.stringify(result.output)).toContain(
          "runtime/deep-eval-scan",
        );
        expect(JSON.stringify(result.output)).toContain(
          "runtime/aftermath-backfill",
        );
      }
    } finally {
      if (previous === undefined) {
        delete process.env.MAY_AGENT_TASK_TREE_PATH;
      } else {
        process.env.MAY_AGENT_TASK_TREE_PATH = previous;
      }
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("filters stale owner actions whose target recovered before dispatch", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "evaluator-heartbeat-stale-"));
    const previous = process.env.MAY_AGENT_TASK_TREE_PATH;
    try {
      process.env.MAY_AGENT_TASK_TREE_PATH = join(tmp, "tree.json");
      writeFileSync(
        process.env.MAY_AGENT_TASK_TREE_PATH,
        JSON.stringify({
          version: 1,
          project: "evaluation",
          root_task_id: "root",
          active_task_ids: ["root"],
          tasks: {
            root: { id: "root", item_type: "task", phase: "waiting" },
            "pipeline-health": {
              id: "pipeline-health",
              item_type: "task",
              phase: "converged",
              generation: 1,
            },
          },
        }),
      );
      const harness = context({
        state: "converged",
        summary: "Propose unblocking recovered pipeline-health.",
        evidence: ["pipeline-health looked waiting in the owner prompt"],
        actions: [
          {
            kind: "unblock-task",
            taskId: "pipeline-health",
            expectedGeneration: 1,
            reason: "recovery tick arrived",
          },
        ],
      });

      const result = await execute(harness.ctx);

      expect(result.type).toBe("done");
      expect(harness.emitted.at(-1)).toMatchObject({
        type: "evaluation.owner_reviewed",
        data: { proposedActions: [] },
      });
      if (result.type === "done") {
        expect(result.output).toMatchObject({ actions: [] });
        expect(JSON.stringify(result.output)).toContain(
          "pipeline-health is not waiting or in attention",
        );
      }
    } finally {
      if (previous === undefined) {
        delete process.env.MAY_AGENT_TASK_TREE_PATH;
      } else {
        process.env.MAY_AGENT_TASK_TREE_PATH = previous;
      }
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("keeps the owner heartbeat prompt bounded when the task tree has huge context blobs", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "evaluator-heartbeat-"));
    const previous = process.env.MAY_AGENT_TASK_TREE_PATH;
    const rawBlob = "RAW_CONTEXT_BLOB_".repeat(20_000);
    try {
      process.env.MAY_AGENT_TASK_TREE_PATH = join(tmp, "tree.json");
      writeFileSync(
        process.env.MAY_AGENT_TASK_TREE_PATH,
        JSON.stringify({
          version: 1,
          project: "evaluation",
          updated_at: "2026-07-20T00:00:00Z",
          root_task_id: "root",
          active_task_ids: ["root", "active"],
          tasks: {
            root: {
              id: "root",
              revision: 1,
              state: "active",
              goal: "Keep evaluation healthy.",
              summary: "ROOT_SUMMARY_".repeat(500),
              context: { raw: rawBlob },
              children: ["active"],
            },
            active: {
              id: "active",
              revision: 2,
              parent_id: "root",
              state: "active",
              goal: "Investigate active work.",
              summary: "ACTIVE_SUMMARY_".repeat(500),
              context: { raw: rawBlob },
              children: [],
            },
          },
        }),
      );
      const harness = context({
        state: "converged",
        summary: "No task-tree changes.",
        evidence: ["bounded packet"],
        actions: [],
      });
      let prompt = "";
      harness.ctx.runAgent = async (
        _agent: string,
        ownerPrompt: string,
        options: Record<string, unknown>,
      ) => {
        prompt = ownerPrompt;
        return {
          sessionId: "s_owner",
          status: "done",
          lastAssistantText: "reviewed",
          messages: [],
          structuredResult: {
            state: "converged",
            summary: "No task-tree changes.",
            evidence: ["bounded packet"],
            actions: [],
          },
        };
      };

      const result = await execute(harness.ctx);

      expect(result.type).toBe("done");
      expect(prompt.length).toBeLessThan(25_000);
      expect(prompt).not.toContain(rawBlob);
      expect(prompt).not.toContain("ROOT_SUMMARY_".repeat(100));
      expect(prompt).not.toContain("ACTIVE_SUMMARY_".repeat(100));
      expect(prompt).not.toContain('"context"');
      expect(prompt).toContain('"contextSummary"');
      expect(prompt).toContain('"omitted": true');
    } finally {
      if (previous === undefined) {
        delete process.env.MAY_AGENT_TASK_TREE_PATH;
      } else {
        process.env.MAY_AGENT_TASK_TREE_PATH = previous;
      }
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
