import type { AppTaskBlockedSettlement } from "@may-agent/sdk/app";
import type { RunResult } from "@may-agent/sdk/standalone";
import type { TaskAgentInput, TaskWorkflowInput } from "../../core/tasks/execution.js";
import { normalizeTaskHandlerResult, type NormalizedTaskHandlerResult, type TaskCapabilityRun } from "../../core/tasks/result.js";

type HostedTaskInput = TaskAgentInput | TaskWorkflowInput;

type TranslationOptions = {
  now?: () => number;
};

function factStrings(facts: unknown): string[] {
  if (facts === undefined) return [];
  if (Array.isArray(facts) && facts.every((fact) => typeof fact === "string")) return facts;
  try {
    return [`execution-facts:${JSON.stringify(facts)}`];
  } catch {
    return ["execution-facts:[unserializable]"];
  }
}

function resultRunId(result: RunResult): string | null {
  return result.report.executionId ?? result.childSessions[0]?.sessionId ?? null;
}

function executionFailure(result: RunResult, summary?: string): TaskCapabilityRun {
  const runId = resultRunId(result);
  const reportError = result.report.error?.message;
  const error = result.error instanceof Error ? result.error.message : result.error ? String(result.error) : undefined;
  const cleanup = result.report.cleanup.confirmed
    ? []
    : [`execution-cleanup-unconfirmed:${result.report.cleanup.unconfirmed?.join(",") ?? "unknown"}`];
  return {
    handlerResult: {
      state: "error",
      summary: summary ?? error ?? reportError ?? `Execution ${result.status}`,
      facts: [...(runId ? [`execution-run:${runId}`] : []), ...cleanup],
      actions: [],
    },
    runId,
    executionFailed: true,
  };
}

function outputResult(output: unknown): Pick<NormalizedTaskHandlerResult, "result"> | Record<string, never> {
  if (output === undefined) return {};
  return {
    result: output !== null && typeof output === "object" && !Array.isArray(output)
      ? output as Record<string, unknown>
      : { value: output },
  };
}

const WAIT_HINT_KEYS = new Set(["retryAfterMs", "conditions", "requests"]);

function isPlainWaitDescriptor(value: unknown): value is AppTaskBlockedSettlement {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function fallbackWaitHint(facts: unknown): AppTaskBlockedSettlement | null | undefined {
  if (!isPlainWaitDescriptor(facts)) return undefined;
  const keys = Object.keys(facts);
  if (!keys.some((key) => WAIT_HINT_KEYS.has(key))) return undefined;
  if (keys.some((key) => !WAIT_HINT_KEYS.has(key))) return null;
  return facts;
}

function rejectedBlockedResult(summary: string, runId: string | null): TaskCapabilityRun {
  return {
    handlerResult: {
      state: "error",
      resultRejected: true,
      summary,
      facts: runId ? [`execution-run:${runId}`] : [],
      actions: [],
    },
    runId,
    handlerBlocked: true,
  };
}

function blockedSettlement(
  result: RunResult,
  input: HostedTaskInput,
  summary: string,
  output: unknown,
  facts: unknown,
  options: TranslationOptions,
): TaskCapabilityRun {
  const runId = resultRunId(result);
  const translator = input.descriptor.app.tasks?.translateBlockedResult;
  let translatedHint: unknown;
  try {
    translatedHint = translator
      ? translator({ task: input.attempt.task, summary, output, facts })
      : fallbackWaitHint(facts);
  } catch (error) {
    return rejectedBlockedResult(
      `Blocked result translator failed: ${error instanceof Error ? error.message : String(error)}`,
      runId,
    );
  }
  if (!translator && translatedHint === null) {
    return rejectedBlockedResult("Blocked result wait hint contains unsupported fields", runId);
  }
  if (translator && translatedHint === undefined) {
    return rejectedBlockedResult("Blocked result translator must return null or a wait descriptor", runId);
  }
  if (translatedHint !== undefined && translatedHint !== null) {
    if (!isPlainWaitDescriptor(translatedHint)) {
      return rejectedBlockedResult("Blocked result translator must return null or a plain wait descriptor", runId);
    }
    if (Object.keys(translatedHint).some((key) => !WAIT_HINT_KEYS.has(key))) {
      return rejectedBlockedResult("Blocked result translator wait descriptor contains unsupported fields", runId);
    }
  }
  const hint = translatedHint as AppTaskBlockedSettlement | null | undefined;

  let reviewAt: number | undefined;
  if (hint?.retryAfterMs !== undefined) {
    if (!Number.isSafeInteger(hint.retryAfterMs) || hint.retryAfterMs <= 0) {
      return rejectedBlockedResult("Blocked result retryAfterMs must be a positive safe integer", runId);
    }
    const now = (options.now ?? Date.now)();
    reviewAt = now + hint.retryAfterMs;
    if (!Number.isSafeInteger(now) || !Number.isSafeInteger(reviewAt)) {
      return rejectedBlockedResult("Blocked result retryAfterMs exceeds the Host clock range", runId);
    }
  }

  const handlerResult = normalizeTaskHandlerResult(
    {
      state: "waiting",
      summary,
      facts: factStrings(facts),
      actions: [],
      ...(reviewAt !== undefined ? { reviewAt } : {}),
      ...(hint?.conditions !== undefined ? { conditions: hint.conditions } : {}),
      ...(hint?.requests !== undefined ? { requests: hint.requests } : {}),
      ...outputResult(output),
    },
    { type: "blocked", summary, runId },
    {
      validateAction: input.descriptor.app.tasks?.validateAction,
      validateCondition: input.descriptor.app.tasks?.validateCondition,
    },
  );
  return {
    handlerResult,
    runId,
    handlerBlocked: true,
  };
}

/** Translate the public Task-blind run result at the Host settlement boundary. */
export function translateHostedExecutionResult(
  result: RunResult,
  input: HostedTaskInput,
  options: TranslationOptions = {},
): TaskCapabilityRun {
  if (
    !result.ok ||
    result.status === "error" ||
    result.status === "interrupted" ||
    !result.result ||
    result.report.cleanup.confirmed !== true
  ) {
    return executionFailure(result);
  }
  const contribution = result.result;
  if (contribution.type !== "done" && contribution.type !== "blocked") return executionFailure(result);
  const summary = contribution.type === "done" ? contribution.summary : contribution.reason;
  if (contribution.type === "blocked") {
    return blockedSettlement(result, input, summary, contribution.output, contribution.facts, options);
  }

  return {
    handlerResult: {
      state: "converged",
      summary,
      facts: factStrings(contribution.facts),
      actions: [],
      ...outputResult(contribution.output),
    },
    runId: resultRunId(result),
    hostCompletion: "finite-done",
  };
}
