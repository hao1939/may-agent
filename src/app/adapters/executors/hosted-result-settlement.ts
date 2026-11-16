import type { AppTaskBlockedSettlement } from "@may-agent/sdk/app";
import type { RunResult } from "@may-agent/sdk/standalone";
import type { TaskAgentInput, TaskWorkflowInput } from "../../core/tasks/execution.js";
import { normalizeTaskHandlerResult, type NormalizedTaskHandlerResult, type TaskCapabilityRun } from "../../core/tasks/result.js";

type HostedTaskInput = TaskAgentInput | TaskWorkflowInput;

type TranslationOptions = {
  now?: () => number;
  diagnosticFacts?: readonly string[];
  storageFacts?: unknown;
};

function serializedFact(facts: unknown): string {
  try {
    return `execution-facts:${JSON.stringify(facts)}`;
  } catch {
    return "execution-facts:[unserializable]";
  }
}

function hasDomainProgressFacts(facts: unknown): boolean {
  if (facts === undefined) return false;
  if (typeof facts === "string") return facts.trim().length > 0;
  if (Array.isArray(facts)) {
    return (
      facts.length > 0
      && facts.some((fact) => (typeof fact === "string" ? fact.trim().length > 0 : fact !== undefined))
    );
  }
  return true;
}

function directFactStrings(facts: unknown): string[] {
  if (facts === undefined) return [];
  if (
    Array.isArray(facts)
    && facts.length <= 32
    && facts.every((fact) => typeof fact === "string" && fact.trim().length > 0)
  ) return facts;
  return [serializedFact(facts)];
}

function factStrings(facts: unknown, diagnosticFacts: readonly string[] = []): string[] {
  const directFacts = directFactStrings(facts);
  if (directFacts.length + diagnosticFacts.length <= 32) return [...directFacts, ...diagnosticFacts];
  return [serializedFact(facts), ...diagnosticFacts];
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

const DEFAULT_WAIT_HINT_KEYS = new Set(["retryAfterMs", "conditions", "requests"]);
const TRANSLATED_WAIT_HINT_KEYS = new Set([...DEFAULT_WAIT_HINT_KEYS, "actions", "report", "continue"]);

function isPlainWaitDescriptor(value: unknown): value is AppTaskBlockedSettlement {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function fallbackWaitHint(facts: unknown): AppTaskBlockedSettlement | null | undefined {
  if (!isPlainWaitDescriptor(facts)) return undefined;
  const keys = Object.keys(facts);
  if (!keys.some((key) => DEFAULT_WAIT_HINT_KEYS.has(key))) return undefined;
  if (keys.some((key) => !DEFAULT_WAIT_HINT_KEYS.has(key))) return null;
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

export function translateHostedBlockedContribution(
  input: HostedTaskInput,
  contribution: { summary: string; output?: unknown; facts?: unknown; runId: string | null },
  options: TranslationOptions = {},
): TaskCapabilityRun {
  const { summary, output, facts, runId } = contribution;
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
    const allowedKeys = translator ? TRANSLATED_WAIT_HINT_KEYS : DEFAULT_WAIT_HINT_KEYS;
    if (Object.keys(translatedHint).some((key) => !allowedKeys.has(key))) {
      return rejectedBlockedResult("Blocked result translator wait descriptor contains unsupported fields", runId);
    }
  }
  const hint = translatedHint as AppTaskBlockedSettlement | null | undefined;
  if (
    (hint?.report === true || hint?.continue === true)
    && (facts === undefined || (Array.isArray(facts) && facts.length === 0))
  ) {
    return rejectedBlockedResult(
      "Blocked result report or continuation requires contribution facts; Host diagnostics are not agent evidence",
      runId,
    );
  }
  if (hint && hint.actions !== undefined && !Array.isArray(hint.actions)) {
    return rejectedBlockedResult("Blocked result actions must be an array when supplied", runId);
  }
  if (hint && hint.report !== undefined && hint.report !== true) {
    return rejectedBlockedResult("Blocked result report must be true when supplied", runId);
  }
  if (hint && hint.continue !== undefined && hint.continue !== true) {
    return rejectedBlockedResult("Blocked result continue must be true when supplied", runId);
  }
  if (hint?.report === true && !hasDomainProgressFacts(facts)) {
    return rejectedBlockedResult(
      "Handler result was rejected: report requires waiting or incomplete, true, and non-empty facts",
      runId,
    );
  }
  if (hint?.continue === true && !hasDomainProgressFacts(facts)) {
    return rejectedBlockedResult(
      "Handler result was rejected: continue requires waiting and progress facts",
      runId,
    );
  }

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
      facts: factStrings(options.storageFacts === undefined ? facts : options.storageFacts, options.diagnosticFacts),
      actions: hint?.actions === undefined ? [] : hint.actions,
      ...(hint?.report === true ? { report: true as const } : {}),
      ...(hint?.continue === true ? { continue: true as const } : {}),
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
    return translateHostedBlockedContribution(
      input,
      { summary, output: contribution.output, facts: contribution.facts, runId: resultRunId(result) },
      options,
    );
  }

  const runId = resultRunId(result);
  const handlerResult = normalizeTaskHandlerResult(
    {
      state: "converged",
      summary,
      facts: factStrings(contribution.facts),
      actions: [],
      ...outputResult(contribution.output),
    },
    { type: "done", summary, runId },
    {
      validateAction: input.descriptor.app.tasks?.validateAction,
      validateCondition: input.descriptor.app.tasks?.validateCondition,
    },
  );
  return {
    handlerResult,
    runId,
    ...(handlerResult.state === "converged" ? { hostCompletion: "finite-done" as const } : {}),
  };
}
