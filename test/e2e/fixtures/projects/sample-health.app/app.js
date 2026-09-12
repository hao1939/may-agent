export default {
  id: "sample-health",
  version: 1,
  agent: "may",
  inputSchema: { type: "object" },
  workspace: { kind: "local", localPath: "." },
  tasks: {},
  task(input) {
    return {
      kind: "desired",
      intent: {
        id: "review",
        parentId: "root",
        workflow: "host-health-proof",
        outcome: "Inspect Host observation",
        acceptance: ["Facts inspected"],
        input: input.input,
      },
    };
  },
  subscriptions: [
    {
      id: "health",
      event: "sample.health.observed",
      toInput(event) {
        return { kind: "snapshot", data: event.data };
      },
    },
  ],
  observers: [
    {
      id: "health",
      intervalMs: 3600000,
      async run(ctx) {
        const snapshot = await ctx.read.hostHealth();
        if ("query" in ctx.read || "getDb" in ctx.read) throw new Error("Private capability leaked");
        return [{ type: "sample.health.observed", target: { appId: "sample-health" }, data: snapshot }];
      },
    },
  ],
};
