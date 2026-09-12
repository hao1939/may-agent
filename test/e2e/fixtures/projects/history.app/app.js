// A loaded App can observe a comment without accepting responsibility for it.
export default {
  id: "history", version: 1, agent: "may",
  inputSchema: { type: "object", properties: { kind: { const: "archive" } }, required: ["kind"] },
  workspace: { kind: "local", localPath: "." }, tasks: {},
  observations: [{ type: "project.comment.created", project: "history" }],
};
