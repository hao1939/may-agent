export default {
  id: "scheduled-workflow",
  version: 1,
  agent: "may",
  inputSchema: { type: "object" },
  workspace: { kind: "local", localPath: "." },
  tasks: {},
  task() {
    return {
      kind: "desired",
      intent: {
        id: "work/main",
        parentId: "scheduled-workflow",
        mode: "achieve",
        workflow: "e2e-noop-workflow",
        outcome: "Verify scheduled workflow execution",
        acceptance: ["The isolated workflow completes and its Task accepts the result"],
      },
    };
  },
  schedules: [
    {
      id: "workflow-probe",
      intervalMs: 3_600_000,
      input: { kind: "probe", data: {} },
    },
  ],
};
