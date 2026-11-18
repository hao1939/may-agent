import { Type } from "typebox";
import { describe, expect, it } from "bun:test";
import type { AgentTool } from "@earendil-works/pi-agent-core";

import { taskAgentResultSchema } from "@may-agent/sdk/app";
import {
  RESPONSES_STREAM_TERMINAL_ERROR,
  createWorkflowFinishTool,
  recoverCapturedWorkflowFinish,
  shouldAttemptWorkflowFinishRecovery,
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
      status: Type.Literal("done"),
      summary: Type.String(),
      output: Type.Object({ state: Type.Literal("converged") }),
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
    expect(prompt).toContain("schema-validated output payload");
    expect(prompt).not.toContain("blocked/partial");
  });

  it("recovers the captured aborted finish through schema and semantic execution", async () => {
    const messages = [
      abortedFinish({
        status: "done",
        summary: "Facts complete",
        output: { state: "converged" },
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

  it("uses only the persisted TypeBox shape during captured finish recovery", async () => {
    let executions = 0;
    const base = finishTool(async () => {
      executions++;
      return { content: [{ type: "text", text: "SUCCESS" }] };
    });
    const finish = createWorkflowFinishTool(base, structuredClone(taskAgentResultSchema));
    const invalidMessages = [
      abortedFinish({
        status: "done",
        summary: "Invalid Task result",
        output: {
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
    expect(rejected.disposition).toBe("recovered");
    expect(executions).toBe(1);

    const correctedMessages = [
      abortedFinish({
        status: "done",
        summary: "Corrected Task result",
        output: {
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
    expect(executions).toBe(2);
  });

  it("rejects schema-invalid captured arguments and preserves an explicit error", async () => {
    const messages = [abortedFinish({ status: "done", summary: "Missing result" })];
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
      status: "done", summary: "retained-report:" + "x".repeat(100_000),
      output: { summary: 42, evidence: Array.from({ length: 100 }, () => false) },
    };
    const messages = [abortedFinish(serialized ? JSON.stringify(invalid) : invalid)];
    const original = structuredClone(messages[0]);
    const options = { sessionId: "captured-types", messages, tools: [tool], reason: RESPONSES_STREAM_TERMINAL_ERROR };
    const rejected = await recoverCapturedWorkflowFinish(options);
    expect(rejected.disposition).toBe("rejected");
    expect(executions).toBe(0);
    expect(rejected.error).toContain("/output/summary: must be string");
    expect(rejected.error!.length).toBeLessThan(4000);
    expect(rejected.error).not.toContain("retained-report");
    expect(messages[0]).toEqual(original);
    expect(messages.at(-1)).toMatchObject({ toolCallId: "finish-captured", isError: true });
    expect((await recoverCapturedWorkflowFinish(options)).disposition).toBe("already-committed");

    messages.push(abortedFinish({
      status: "done", summary: "Corrected report", output: { summary: "Evidence unavailable" },
    }, "finish-corrected"));
    expect((await recoverCapturedWorkflowFinish(options)).disposition).toBe("recovered");
    expect(executions).toBe(1);
  });

  it("preserves semantic rejection from the normal finish execute path", async () => {
    const messages = [
      abortedFinish({
        status: "done",
        summary: "Looks valid",
        output: { state: "converged" },
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
          status: "done",
          summary: "Once",
          output: { state: "converged" },
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
      { ...abortedFinish({ status: "done" }), stopReason: "toolUse" },
      { ...abortedFinish({ status: "done" }), errorMessage: "different failure" },
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

  it("rejects the retired operation allowance instead of silently restoring finish guidance", () => {
    expect(validateOperationAllowance(undefined)).toBeUndefined();
    for (const value of [1, 24, 50, Number.POSITIVE_INFINITY]) {
      expect(() => validateOperationAllowance(value)).toThrow(
        "operationAllowance is retired; use timeoutMs or deadlineAt for a real execution limit",
      );
    }
  });

});
