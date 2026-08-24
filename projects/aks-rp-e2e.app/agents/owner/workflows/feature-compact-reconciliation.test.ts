import { describe, expect, test } from "bun:test";
import { admitTaskReconcileResult, type WorkflowContext } from "@may-agent/sdk";
import { execute } from "./feature-compact-reconciliation.ts";

function context(): WorkflowContext {
  return {
    input: {},
    reconciliation: {
      appId: "aks-rp-e2e",
      taskId: "compact/compact-feature-example",
      generation: 1,
      resourceVersion: 1,
      agent: "aks-explorer",
      mode: "achieve",
      outcome: "Reconcile one feature compact package.",
      acceptance: ["Owner judgment is admitted."],
      input: {},
      children: { live: [], completed: [] },
    },
    workspace: {
      appRoot: "/app/projects/aks-rp-e2e.app",
      projectRoot: "/app/projects/aks-rp-e2e",
      root: "/app/projects/aks-rp-e2e",
      output: "/app/projects/aks-rp-e2e",
    },
    done(summary: string, output?: unknown) {
      return {
        id: "workflow:test",
        kind: "workflow",
        status: "done",
        summary,
        output,
      };
    },
  } as WorkflowContext;
}

describe("feature compact reconciliation", () => {
  test("emits a bare owner handoff accepted by the current task contract", async () => {
    const execution = await execute(context());
    expect(execution.status).toBe("done");

    const output = (execution as { output?: unknown }).output;
    expect(output).toEqual({
      state: "needs-agent",
      summary:
        "Feature-compact reconciliation requires current domain judgment; hand off with deterministic ledger admission retained at the completion boundary.",
      evidence: [],
    });
    for (const forbidden of [
      "actions",
      "conditions",
      "dependencies",
      "response",
    ]) {
      expect(output).not.toHaveProperty(forbidden);
    }

    expect(
      admitTaskReconcileResult(output, {
        allowNeedsAgent: true,
        defaultParentId: "aks-feature-compact-loop",
      }),
    ).toEqual({
      ok: true,
      result: output,
    });
  });
});
