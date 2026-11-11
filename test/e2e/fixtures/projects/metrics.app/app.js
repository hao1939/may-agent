export default {
  id: "metrics", version: 1, agent: "may", inputSchema: { type: "object" },
  workspace: { kind: "local", localPath: "." }, tasks: {},
  subscriptions: [{ id: "sample", event: "e2e.metric.sample", toInput(event) {
    return { kind: "sample", data: event.data };
  } }],
  task(input) { return { kind: "desired", intent: {
    id: `sample/${input.input.data.phase}`, parentId: "metrics", workflow: "e2e-metric-canary",
    outcome: "Record one metric lifecycle sample", acceptance: ["Sample recorded"], input: input.input.data,
  } }; },
};
