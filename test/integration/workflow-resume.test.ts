import { expect, test } from "bun:test";
import { createWorkflowTool } from "../../src/lib/workflow-tool.js";

test("workflow replay is rejected rather than reading historical steps", async () => {
  const tool = createWorkflowTool({ manager: {} as never, workflowDir: "/missing-workflows" });
  const result = await tool.execute("retired", { action: "resume", workflowRunId: "historical" } as never);
  expect(JSON.parse(result.content[0].text)).toEqual({ error: "Unknown action: resume" });
});
