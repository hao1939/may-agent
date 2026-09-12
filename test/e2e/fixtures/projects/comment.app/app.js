// Ordinary App intake; no maintenance role, optional schedules, or model calls.
export default {
  id: "comment", version: 1, agent: "may",
  inputSchema: {
    type: "object", required: ["kind", "data"],
    properties: {
      kind: { const: "owner-review" },
      data: {
        type: "object", required: ["message"],
        properties: { message: { type: "string", minLength: 1, maxLength: 1000 } },
      },
    },
  },
  workspace: { kind: "local", localPath: "." }, tasks: {},
  subscriptions: ["project.comment.created", "project.approval.submitted"].map(type => ({
    id: type,
    event: { type, project: "comment" },
    toInput(event) { return { kind: "owner-review", data: { message: event.data.comment } }; },
  })),
  task(input) {
    return { kind: "desired", intent: {
      id: "work/comment", parentId: "comment",
      workflow: "e2e-noop-workflow", outcome: input.input.data.message,
      acceptance: ["The workflow executes and the Task accepts its result"],
    } };
  },
};
