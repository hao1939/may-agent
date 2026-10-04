import { conversationTurnResultSchema } from "@may-agent/sdk";
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
        verification_facts: ["test facts"],
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
          toolCall({ status: "success", summary: "Review complete", verification_facts: ["test facts"] }),
        ),
      ).toThrow("result");
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it("validates quiet bookkeeping and reply-requiring effects through the serialized Conversation schema", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "conversation-finish-"));
    try {
      const base = createFinishTool({ agentName: "may", projectRoot, persistDir: projectRoot });
      const tool = createWorkflowFinishTool(base, JSON.parse(JSON.stringify(conversationTurnResultSchema)));
      const quiet = { summary: "Reviewed", topic: { kind: "none" } };
      const validate = (result: unknown) => validateToolArguments(tool, toolCall({
        status: "success", summary: "Reviewed", verification_facts: ["Current state read"], result,
      }));
      expect(() => validate(quiet)).not.toThrow();
      const request = { id: "ask", expectedRevision: 1, scope: "Compare" };
      const open = { ...request, disposition: "open" };
      for (const reason of [undefined, " \n "]) {
        expect(() => validate({ ...quiet, response: "Another ask is answered.", requestUpdates: [{ ...open, reason }] }))
          .toThrow("reason");
      }
      expect(() => validate({ ...quiet, requestUpdates: [{ ...open, reason: "Waiting for the second option" }] })).not.toThrow();
      for (const effect of [
        { requestUpdates: [{ ...request, disposition: "fulfilled", reason: "Comparison verified" }] },
        { taskControls: [{ kind: "cancel", appId: "worker", taskId: "job", reason: "No longer needed" }] },
      ]) {
        expect(() => validate({ ...quiet, ...effect })).toThrow();
        expect(() => validate({ ...quiet, ...effect, response: " \n " })).toThrow();
        expect(() => validate({ ...quiet, ...effect, response: "Here is the outcome." })).not.toThrow();
      }
      const handoff = { appId: "worker", input: { kind: "work", data: {} } };
      expect(() => validate({ ...quiet, followUp: handoff })).not.toThrow();
      expect(() => validate({ ...quiet, response: "Delegating.", followUp: handoff, taskControls: [] })).not.toThrow();
      expect(() => validate({
        ...quiet, response: "Delegating and cancelling.", followUp: handoff,
        taskControls: [{ kind: "cancel", appId: "worker", taskId: "job", reason: "No longer needed" }],
      })).toThrow();
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
