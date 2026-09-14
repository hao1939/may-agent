// Ordinary App intake; no maintenance role, optional schedules, or model calls.
export default {
  id: "input",
  version: 1,
  agent: "may",
  inputSchema: {
    type: "object",
    required: ["kind", "data"],
    properties: {
      kind: { const: "message" },
      data: {
        type: "object",
        required: ["message"],
        properties: { message: { type: "string", minLength: 1, maxLength: 1000 } },
      },
    },
  },
  workspace: { kind: "local", localPath: "." },
  tasks: {},
  task(input) {
    return {
      kind: "desired",
      intent: {
        id: "work/input",
        parentId: "input",
        workflow: "e2e-noop-workflow",
        outcome: input.input.data.message,
        acceptance: ["The workflow executes and the Task accepts its result"],
      },
    };
  },
};
