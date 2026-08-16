import type {
  ExecutionResult,
  TaskAction,
  WorkflowContext,
} from "@may-agent/sdk";

export const name = "unified-resource-migration";
export const description =
  "Close the fixed set of implemented or superseded pre-contract May Agent resources.";

const legacyResources: Array<{
  taskId: string;
  generation: number;
  summary: string;
}> = [
  {
    taskId: "ops-health-silent-recording",
    generation: 1,
    summary:
      "Implemented by ops-health-review: every observation is persisted and a quiet packet emits no owner wake.",
  },
  {
    taskId: "ops-health-escalation",
    generation: 1,
    summary:
      "Implemented by ops-health-review: meaningful platform signals emit one project.owner.requested event.",
  },
  {
    taskId: "ops-health-packet-builder",
    generation: 1,
    summary:
      "Implemented and covered by the ops-health-review workflow and its signal-category tests.",
  },
  {
    taskId: "shared-kanban-steering-actions-design",
    generation: 1,
    summary:
      "Superseded by the accepted default-project-ui owner-mediated steering contract and event-native project controls.",
  },
  {
    taskId: "project-app-v2-adoption-playbook",
    generation: 1,
    summary:
      "Superseded by the accepted Agent App and task-resource-engine contracts, which document current V3 layout, routing, workflows, and ownership boundaries.",
  },
  {
    taskId: "cron-mark-trigger-event-handled-bug",
    generation: 1,
    summary:
      "Superseded by the unified task controller and durable event/task admission path; the legacy per-workflow trigger-marking mechanism no longer exists.",
  },
];

export function legacyMayAgentTaskCloseActions(): TaskAction[] {
  return legacyResources.map(({ taskId, generation, summary }) => ({
    kind: "close-task",
    taskId,
    expectedGeneration: generation,
    summary,
  }));
}

export async function execute(ctx: WorkflowContext): Promise<ExecutionResult> {
  const actions = legacyMayAgentTaskCloseActions();
  const summary = `Retired ${actions.length} implemented or superseded pre-contract May Agent resources.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: [
      "docs/2a-design/agent-app.md",
      "docs/2a-design/default-project-ui.md",
      "agents/tech-lead/workflows/ops-health-review.test.ts",
    ],
    actions,
  });
}
