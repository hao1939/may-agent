import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, validateToolArguments, type ToolCall } from "@earendil-works/pi-ai";
import { createFinishTool } from "./lifecycle.js";
import { createWorkflowFinishTool } from "./workflow-finish.js";

function toolCall(arguments_: Record<string, unknown>): ToolCall {
  return { type: "toolCall", id: "call-1", name: "finish", arguments: arguments_ };
}

describe("workflow finish contract", () => {
  it("requires and captures the workflow-authored result schema through finish()", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "workflow-finish-"));
    try {
      const base = createFinishTool({ agentName: "reviewer", projectRoot, persistDir: projectRoot });
      const tool = createWorkflowFinishTool(
        base,
        Type.Object({ verdict: Type.Union([Type.Literal("pass"), Type.Literal("fail")]) }),
      );
      expect((tool.parameters as any).type).toBe("object");
      const call = toolCall({
        status: "success",
        summary: "Review complete",
        verification_evidence: ["test evidence"],
        result: { verdict: "pass" },
      });
      const params = validateToolArguments(tool, call);

      const result = await tool.execute(call.id, params);

      expect(result.terminate).toBe(true);
      expect((params as any).result).toEqual({ verdict: "pass" });
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it("rejects a missing caller-defined result before finish executes", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "workflow-finish-"));
    try {
      const base = createFinishTool({ agentName: "reviewer", projectRoot, persistDir: projectRoot });
      const tool = createWorkflowFinishTool(base, Type.Object({ verdict: Type.String() }));

      expect(() =>
        validateToolArguments(
          tool,
          toolCall({ status: "success", summary: "Review complete", verification_evidence: ["test evidence"] }),
        ),
      ).toThrow("result");
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it("does not terminate when finish semantic checks reject the call", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "workflow-finish-"));
    try {
      const base = createFinishTool({ agentName: "reviewer", projectRoot, persistDir: projectRoot });
      const tool = createWorkflowFinishTool(base);

      const result = await tool.execute("call-1", { status: "blocked", summary: "Need input" } as any);

      expect(result.terminate).toBeUndefined();
      expect(result.content[0]).toMatchObject({ type: "text", text: expect.stringContaining("finish() error") });
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
