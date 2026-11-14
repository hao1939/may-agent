import { Type } from "typebox";
import { describe, expect, it } from "bun:test";
import type { AgentTool } from "@earendil-works/pi-agent-core";

import { taskAgentResultSchema } from "@may-agent/sdk";
import {
  RESPONSES_STREAM_TERMINAL_ERROR,
  boundedWorkflowFinishPrompt,
  createWorkflowFinishTool,
  recoverCapturedWorkflowFinish,
  shouldAttemptWorkflowFinishRecovery,
  shouldRequestBoundedWorkflowFinish,
  validateOperationAllowance,
  workflowFinishRecoveryPrompt,
} from "@may-agent/sdk/runtime";

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
    expect(prompt).toContain("Continue the original bounded assignment");
    expect(prompt).toContain("App's instructions");
    expect(prompt).toContain("schema-validated result payload");
  });

  it("recovers the captured aborted finish through schema and semantic execution", async () => {
    const messages = [
      abortedFinish({
        status: "success",
        summary: "Facts complete",
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

  it("reuses Task semantic admission for captured finish recovery after schema persistence", async () => {
    let executions = 0;
    const base = finishTool(async () => {
      executions++;
      return { content: [{ type: "text", text: "SUCCESS" }] };
    });
    const finish = createWorkflowFinishTool(base, structuredClone(taskAgentResultSchema));
    const invalidMessages = [
      abortedFinish({
        status: "success",
        summary: "Invalid Task result",
        result: {
          state: "converged",
          summary: "Review is pending",
          reviewAt: Date.now() + 60_000,
          facts: [],
        },
      }),
    ];

    const rejected = await recoverCapturedWorkflowFinish({
      sessionId: "s-task-semantic-invalid",
      messages: invalidMessages,
      tools: [finish],
      reason: RESPONSES_STREAM_TERMINAL_ERROR,
    });
    expect(rejected.disposition).toBe("rejected");
    expect(rejected.error).toContain("reviewAt is valid only for waiting");
    expect(executions).toBe(0);

    const correctedMessages = [
      abortedFinish({
        status: "success",
        summary: "Corrected Task result",
        result: {
          state: "waiting",
          summary: "Review is pending",
          reviewAt: Date.now() + 60_000,
          facts: [],
        },
      }),
    ];
    const recovered = await recoverCapturedWorkflowFinish({
      sessionId: "s-task-semantic-corrected",
      messages: correctedMessages,
      tools: [finish],
      reason: RESPONSES_STREAM_TERMINAL_ERROR,
    });
    expect(recovered.disposition).toBe("recovered");
    expect(executions).toBe(1);
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

  it.each([false, true])("checks raw captured reports before coercion and keeps correction bounded (JSON arguments: %s)", async (serialized) => {
    let executions = 0;
    const schema = JSON.parse(JSON.stringify(Type.Object({
      summary: Type.String(),
      evidence: Type.Optional(Type.Array(Type.String())),
    })));
    const tool = createWorkflowFinishTool(finishTool(async () => {
      executions++;
      return { content: [{ type: "text", text: "Accepted" }] };
    }), schema);
    const invalid = {
      status: "success", summary: "retained-report:" + "x".repeat(100_000),
      result: { summary: 42, evidence: Array.from({ length: 100 }, () => false) },
    };
    const messages = [abortedFinish(serialized ? JSON.stringify(invalid) : invalid)];
    const original = structuredClone(messages[0]);
    const options = { sessionId: "captured-types", messages, tools: [tool], reason: RESPONSES_STREAM_TERMINAL_ERROR };
    const rejected = await recoverCapturedWorkflowFinish(options);
    expect(rejected.disposition).toBe("rejected");
    expect(executions).toBe(0);
    expect(rejected.error).toContain("/result/summary: must be string");
    expect(rejected.error!.length).toBeLessThan(4000);
    expect(rejected.error).not.toContain("retained-report");
    expect(messages[0]).toEqual(original);
    expect(messages.at(-1)).toMatchObject({ toolCallId: "finish-captured", isError: true });
    expect((await recoverCapturedWorkflowFinish(options)).disposition).toBe("already-committed");

    messages.push(abortedFinish({
      status: "success", summary: "Corrected report", result: { summary: "Evidence unavailable" },
    }, "finish-corrected"));
    expect((await recoverCapturedWorkflowFinish(options)).disposition).toBe("recovered");
    expect(executions).toBe(1);
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
          content: [{ type: "text", text: "finish() error: facts are not honest" }],
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

  it("does not request bounded completion when operationAllowance is omitted", () => {
    for (const toolCalls of [0, 23, 24, 34, 10_000]) {
      expect(shouldRequestBoundedWorkflowFinish(true, toolCalls, false)).toBe(false);
      expect(
        shouldRequestBoundedWorkflowFinish(true, toolCalls, false, {
          admittedTimeoutMs: 60_000,
          elapsedMs: 59_999,
        }),
      ).toBe(false);
      expect(
        shouldRequestBoundedWorkflowFinish(true, toolCalls, false, {
          admittedTimeoutMs: 900_000,
          elapsedMs: 899_999,
        }),
      ).toBe(false);
    }
    expect(boundedWorkflowFinishPrompt(Type.Object({ state: Type.String() }))).toContain(
      "schema-validated result field",
    );
  });

  it("requests bounded completion only after an explicit operation allowance is reached", () => {
    for (const operationAllowance of [5, 24, 50]) {
      expect(
        shouldRequestBoundedWorkflowFinish(true, operationAllowance - 1, false, { operationAllowance }),
      ).toBe(false);
      expect(
        shouldRequestBoundedWorkflowFinish(true, operationAllowance, false, {
          operationAllowance,
          admittedTimeoutMs: 900_000,
          elapsedMs: 1,
        }),
      ).toBe(true);
      expect(
        shouldRequestBoundedWorkflowFinish(true, operationAllowance + 1, false, {
          operationAllowance,
          admittedTimeoutMs: 60_000,
          elapsedMs: 59_999,
        }),
      ).toBe(true);
      expect(
        shouldRequestBoundedWorkflowFinish(false, operationAllowance, false, { operationAllowance }),
      ).toBe(false);
      expect(
        shouldRequestBoundedWorkflowFinish(true, operationAllowance, true, { operationAllowance }),
      ).toBe(false);
    }
  });

  it("rejects invalid and non-finite operation allowances", () => {
    for (const value of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => validateOperationAllowance(value)).toThrow("finite positive integer");
      expect(() =>
        shouldRequestBoundedWorkflowFinish(true, 100, false, { operationAllowance: value }),
      ).toThrow("finite positive integer");
    }
    expect(validateOperationAllowance(50)).toBe(50);
    expect(validateOperationAllowance(undefined)).toBeUndefined();
  });
});
