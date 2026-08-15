import type {
  AppEvent,
  TaskReconciliationChild,
  WorkflowContext,
} from "@may-agent/sdk";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";

type SpecLiveTestContextOptions = {
  taskId: string;
  input: unknown;
  appRoot: string;
  projectRoot: string;
  workspaceRoot: string;
  owner?: string;
  generation?: number;
  trigger?: AppEvent<Record<string, unknown>>;
  liveChildren?: TaskReconciliationChild[];
  completedChildren?: TaskReconciliationChild[];
  callAgent?: WorkflowContext["agents"]["call"];
};

/** Canonical App workflow context for subprocess-heavy spec-live tests. */
export function createSpecLiveTestContext(
  options: SpecLiveTestContextOptions,
): WorkflowContext {
  const owner = options.owner ?? "aks-explorer";
  const generation = options.generation ?? 1;
  return createTestAppWorkflowContext({
    input: options.input,
    reconciliation: {
      appId: "aks-rp-e2e",
      taskId: options.taskId,
      generation,
      resourceVersion: 1,
      owner,
      mode: "achieve",
      outcome: `Reconcile ${options.taskId}.`,
      acceptance: [],
      input: options.input,
      children: {
        live: options.liveChildren ?? [],
        completed: options.completedChildren ?? [],
      },
      taskSnapshot: { live: [], truncated: false },
      ...(options.trigger ? { trigger: options.trigger } : {}),
    },
    ...(options.callAgent ? { callAgent: options.callAgent } : {}),
    workspace: {
      appRoot: options.appRoot,
      projectRoot: options.projectRoot,
      root: options.workspaceRoot,
      output: `${options.workspaceRoot}/.output`,
    },
    executionId: "wf_spec_live_test",
  });
}
