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
  subscriptions: [{
    id: "project-comment",
    event: { type: "project.comment.created", project: "comment" },
    toInput(event) { return { kind: "owner-review", data: { message: event.data.comment } }; },
  }],
  task(input) {
    return { kind: "desired", intent: {
      id: "work/comment", parentId: "comment", mode: "achieve",
      workflow: "e2e-noop-workflow", outcome: input.input.data.message,
      acceptance: ["The workflow executes and the Task accepts its result"],
    } };
  },
};
