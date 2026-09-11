import { describe, expect, it } from "bun:test";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";
import {
  RESPONSES_STREAM_TERMINAL_ERROR,
  WORKFLOW_BOUNDED_FINISH_DEFAULT_WINDOW_MS,
  WORKFLOW_BOUNDED_FINISH_TOOL_CALL_THRESHOLD,
  boundedWorkflowFinishPrompt,
  recoverCapturedWorkflowFinish,
  shouldAttemptWorkflowFinishRecovery,
  shouldRequestBoundedWorkflowFinish,
  validateOperationAllowance,
  workflowFinishRecoveryPrompt,
} from "./workflow-finish-recovery.js";

function abortedFinish(arguments_: unknown, id = "finish-captured") {
  return {
    role: "assistant",
    content: [{ type: "toolCall", id, name: "finish", arguments: arguments_ }],
    stopReason: "aborted",
    errorMessage: RESPONSES_STREAM_TERMINAL_ERROR,
  } as any;
}

function finishTool(execute: AgentTool["execute"]): AgentTool {
  return {
    name: "finish",
    label: "finish",
    description: "finish",
    parameters: Type.Object({
      status: Type.Literal("success"),
      summary: Type.String(),
      result: Type.Object({ state: Type.Literal("converged") }),
    }),
    execute,
  } as AgentTool;
}

describe("workflow finish recovery", () => {
  it("recognizes transient failures, including the exact Responses terminal failure", () => {
    expect(shouldAttemptWorkflowFinishRecovery(RESPONSES_STREAM_TERMINAL_ERROR)).toBe(true);
    expect(shouldAttemptWorkflowFinishRecovery("Agent ended with an empty assistant turn")).toBe(true);
    expect(shouldAttemptWorkflowFinishRecovery("AuthenticationError: HTTP 401 Unauthorized")).toBe(false);
  });

  it("mentions transient failure and schema payload in the corrective prompt", () => {
    const prompt = workflowFinishRecoveryPrompt(Type.Object({ state: Type.String() }), RESPONSES_STREAM_TERMINAL_ERROR);
    expect(prompt).toContain("transient runtime/provider failure");
    expect(prompt).toContain("Do not repeat prior reads");
    expect(prompt).toContain("schema-validated result payload");
  });

  it.each([RESPONSES_STREAM_TERMINAL_ERROR, "Agent ended with an empty assistant turn"])(
    "continues interrupted work instead of forcing an unsupported judgment: %s",
    (reason) => {
      const prompt = workflowFinishRecoveryPrompt(Type.Object({ state: Type.String() }), reason);
      expect(prompt).toContain("Continue the original bounded assignment");
      expect(prompt).toContain("remaining budget");
      expect(prompt).toContain("If no work has been done, begin the assigned work");
      expect(prompt).toContain("not itself a domain blocker");
      expect(prompt).toContain("inspect current state before repeating an uncertain effect");
      expect(prompt).not.toContain("call finish() now");
      expect(prompt).toContain("schema-validated result payload");
    },
  );

  it("recovers the captured aborted finish through schema and semantic execution", async () => {
    const messages = [
      abortedFinish({
        status: "success",
        summary: "Evidence complete",
        result: { state: "converged" },
      }),
    ];
    let executions = 0;
    const recovery = await recoverCapturedWorkflowFinish({
      sessionId: "s_shape_1786168096120",
      messages,
      tools: [
        finishTool(async () => {
          executions++;
          return { content: [{ type: "text", text: "SUCCESS" }], terminate: true };
        }),
      ],
      reason: RESPONSES_STREAM_TERMINAL_ERROR,
    });

    expect(recovery.disposition).toBe("recovered");
    expect(executions).toBe(1);
    expect(messages.at(-1)).toMatchObject({
      role: "toolResult",
      toolCallId: "finish-captured",
      isError: false,
    });
  });

  it("rejects schema-invalid captured arguments and preserves an explicit error", async () => {
    const messages = [abortedFinish({ status: "success", summary: "Missing result" })];
    let executions = 0;
    const recovery = await recoverCapturedWorkflowFinish({
      sessionId: "s-invalid",
      messages,
      tools: [
        finishTool(async () => {
          executions++;
          return { content: [{ type: "text", text: "must not execute" }] };
        }),
      ],
      reason: RESPONSES_STREAM_TERMINAL_ERROR,
    });

    expect(recovery.disposition).toBe("rejected");
    expect(executions).toBe(0);
    expect(messages.at(-1)).toMatchObject({ role: "toolResult", isError: true });
    expect((messages.at(-1) as any).content[0].text).toContain("Captured finish recovery validation failed");
  });

  it("preserves semantic rejection from the normal finish execute path", async () => {
    const messages = [
      abortedFinish({
        status: "success",
        summary: "Looks valid",
        result: { state: "converged" },
      }),
    ];
    const recovery = await recoverCapturedWorkflowFinish({
      sessionId: "s-semantic",
      messages,
      tools: [
        finishTool(async () => ({
          content: [{ type: "text", text: "finish() error: evidence is not honest" }],
        })),
      ],
      reason: RESPONSES_STREAM_TERMINAL_ERROR,
    });

    expect(recovery.disposition).toBe("rejected");
    expect(messages.at(-1)).toMatchObject({ role: "toolResult", isError: true });
  });

  it("executes and appends a captured receipt at most once across concurrent and repeated recovery", async () => {
    const messages = [
      abortedFinish(
        {
          status: "success",
          summary: "Once",
          result: { state: "converged" },
        },
        "finish-stable",
      ),
    ];
    let executions = 0;
    const tool = finishTool(async () => {
      executions++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { content: [{ type: "text", text: "SUCCESS" }], terminate: true };
    });
    const options = { sessionId: "s-stable", messages, tools: [tool], reason: RESPONSES_STREAM_TERMINAL_ERROR };

    await Promise.all([recoverCapturedWorkflowFinish(options), recoverCapturedWorkflowFinish(options)]);
    const repeated = await recoverCapturedWorkflowFinish(options);

    expect(executions).toBe(1);
    expect(messages.filter((message: any) => message.role === "toolResult")).toHaveLength(1);
    expect(repeated.disposition).toBe("already-committed");
  });

  it("does not recover incomplete or unsafe captured calls", async () => {
    for (const message of [
      abortedFinish("{not complete"),
      { ...abortedFinish({ status: "success" }), stopReason: "toolUse" },
      { ...abortedFinish({ status: "success" }), errorMessage: "different failure" },
    ]) {
      const messages = [message];
      const recovery = await recoverCapturedWorkflowFinish({
        sessionId: "s-unsafe",
        messages,
        tools: [finishTool(async () => ({ content: [] }))],
        reason: RESPONSES_STREAM_TERMINAL_ERROR,
      });
      expect(recovery.disposition).toBe("ineligible");
      expect(messages).toHaveLength(1);
    }
  });

  it("requests compact schema-honest completion before extreme tool growth exactly once", () => {
    expect(shouldRequestBoundedWorkflowFinish(true, WORKFLOW_BOUNDED_FINISH_TOOL_CALL_THRESHOLD - 1, false)).toBe(
      false,
    );
    expect(shouldRequestBoundedWorkflowFinish(true, WORKFLOW_BOUNDED_FINISH_TOOL_CALL_THRESHOLD, false)).toBe(true);
    expect(shouldRequestBoundedWorkflowFinish(true, WORKFLOW_BOUNDED_FINISH_TOOL_CALL_THRESHOLD + 10, true)).toBe(
      false,
    );
    expect(boundedWorkflowFinishPrompt(Type.Object({ state: Type.String() }))).toContain(
      "schema-validated result field",
    );
  });

  it("does not force a 900000ms execution solely at 24 calls early in its admitted window", () => {
    expect(
      shouldRequestBoundedWorkflowFinish(true, WORKFLOW_BOUNDED_FINISH_TOOL_CALL_THRESHOLD, false, {
        admittedTimeoutMs: 900_000,
        elapsedMs: 120_000,
      }),
    ).toBe(false);
    expect(
      shouldRequestBoundedWorkflowFinish(true, WORKFLOW_BOUNDED_FINISH_TOOL_CALL_THRESHOLD, false, {
        admittedTimeoutMs: 900_000,
        elapsedMs: 600_000,
      }),
    ).toBe(true);
  });

  it("retains the 24-call guard for absent, default, and smaller admitted windows", () => {
    const atThreshold = WORKFLOW_BOUNDED_FINISH_TOOL_CALL_THRESHOLD;
    expect(shouldRequestBoundedWorkflowFinish(true, atThreshold, false)).toBe(true);
    expect(
      shouldRequestBoundedWorkflowFinish(true, atThreshold, false, {
        admittedTimeoutMs: WORKFLOW_BOUNDED_FINISH_DEFAULT_WINDOW_MS,
        elapsedMs: 1,
      }),
    ).toBe(true);
    expect(
      shouldRequestBoundedWorkflowFinish(true, atThreshold, false, {
        admittedTimeoutMs: 60_000,
        elapsedMs: 1,
      }),
    ).toBe(true);
  });

  it("enforces an explicit allowance above 25 independently of timeout", () => {
    expect(
      shouldRequestBoundedWorkflowFinish(true, 49, false, {
        operationAllowance: 50,
        admittedTimeoutMs: 60_000,
        elapsedMs: 59_999,
      }),
    ).toBe(false);
    expect(
      shouldRequestBoundedWorkflowFinish(true, 50, false, {
        operationAllowance: 50,
        admittedTimeoutMs: 900_000,
        elapsedMs: 1,
      }),
    ).toBe(true);
  });

  it("rejects invalid and non-finite operation allowances", () => {
    for (const value of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => validateOperationAllowance(value)).toThrow("finite positive integer");
    }
    expect(validateOperationAllowance(50)).toBe(50);
    expect(validateOperationAllowance(undefined)).toBeUndefined();
  });
});
