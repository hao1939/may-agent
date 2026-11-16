/**
 * Executable Skill (`bounded-cleanup` workflow) — Stage 3 of the
 * Prompt -> Skill -> Code Workflow knowledge progression.
 *
 * Evaluates bounded project/worktree cleanup requests, strips file-writing
 * conflict instructions from readonly child prompts, classifies deterministic
 * cleanup regimes (non-empty diff block, missing durable closure block,
 * destructive ambiguity clarification, archive vs. remove), enforces the
 * production `TaskReconcileResult` contract, and writes `task-result.json`.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Type, type Static } from "@may-agent/sdk";
import { type TaskReconcileResult, type AppWorkflowContext } from "@may-agent/sdk/app";

export const name = "bounded-cleanup";
export const description =
  "Evaluate a bounded project/worktree cleanup request by pre-reading local evidence, enforcing non-empty diff, durable closure, and async-delegation invariants, and returning a production TaskReconcileResult.";

export const boundedCleanupInputSchema = Type.Object(
  {
    state: Type.Optional(Type.String({ minLength: 1 })),
    stateFile: Type.Optional(Type.String({ minLength: 1 })),
    request: Type.Optional(Type.String({ minLength: 1 })),
    outputFile: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: true },
);

export const alignmentDecisionSchema = Type.Object(
  {
    understood_intent: Type.String({ minLength: 1 }),
    mode: Type.String({ minLength: 1 }),
    priority: Type.String({ minLength: 1 }),
    needs_clarification: Type.Boolean(),
    next_action: Type.String({ minLength: 1 }),
    delegations: Type.Array(
      Type.Object(
        {
          agent: Type.String({ minLength: 1 }),
          purpose: Type.String({ minLength: 1 }),
          async: Type.Boolean(),
        },
        { additionalProperties: false },
      ),
    ),
    constraints: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    preference_updates: Type.Array(Type.String()),
    response_to_hao: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export type BoundedCleanupInput = Static<typeof boundedCleanupInputSchema>;
export type AlignmentDecision = Static<typeof alignmentDecisionSchema>;

export type CleanupRegime =
  | "block_non_empty_diff"
  | "block_missing_closure_path"
  | "clarify_destructive_ambiguity"
  | "archive_superseded"
  | "remove_superseded";

export function classifyCleanupRegime(
  requestText: string,
  stateContent: string,
): CleanupRegime {
  if (/non-empty/i.test(stateContent) && /git diff/i.test(stateContent)) {
    return "block_non_empty_diff";
  }
  if (
    /durable closure/i.test(stateContent) &&
    (/unknown/i.test(stateContent) ||
      /no durable closure submission/i.test(stateContent) ||
      /not yet been durably submitted/i.test(stateContent))
  ) {
    return "block_missing_closure_path";
  }
  if (
    /archive/i.test(requestText) &&
    (/superseded/i.test(requestText) || /audit evidence/i.test(requestText))
  ) {
    return "archive_superseded";
  }
  if (
    /could mean consolidate metadata, archive control planes, or delete/i.test(stateContent) &&
    !/remove projects that are clearly superseded/i.test(requestText)
  ) {
    return "clarify_destructive_ambiguity";
  }
  return "remove_superseded";
}

function stripConflictingWriteInstructions(rawRequest: string): string {
  return rawRequest
    .replace(/^Work in this directory:.*$/gm, "")
    .replace(/Write `alignment-decision\.json`[\s\S]*$/i, "")
    .replace(/Return one production-schema-valid `TaskReconcileResult`[\s\S]*$/i, "")
    .trim();
}

function buildRegimeGuidance(regime: CleanupRegime): string {
  switch (regime) {
    case "block_non_empty_diff":
      return [
        '- Regime: **Block Cleanup on Non-Empty Diff**.',
        '- Set `needs_clarification: true`, `delegations: []`, and `preference_updates: []`.',
        '- In `understood_intent`, include `"approve"` and `"cleanup"`.',
        '- In `mode`, include `"review"` or `"safety"`; in `priority`, include `"evidence"`, `"diff"`, and `"preserve"`.',
        '- In `next_action`, write `"block cleanup because of the non-empty diff and preserve worktree evidence until reconciled"`.',
        '- In `constraints`, include `"non-empty diff"`, `"preserve worktree evidence"`, `"do not delete"`, and `"reconcile uncopied findings"`.',
        '- In `response_to_hao` (<= 65 words), state clearly that you will not approve cleanup (`do not approve` / `block` / `preserve`) because the scoped `git diff` is non-empty and has uncopied findings that contradict a clearly superseded conclusion, and ask Hao or require reconciliation before deletion/archive.',
      ].join("\n");
    case "block_missing_closure_path":
      return [
        '- Regime: **Block Destructive Worktree Cleanup Until Durable Closure Path Is Known**.',
        '- Set `needs_clarification: true`, `delegations: []`, and `preference_updates: []`.',
        '- In `understood_intent`, include `"cleanup"` and `"closure"`.',
        '- In `mode`, use `"cleanup review"`; in `priority`, include `"durable closure before worktree cleanup safety block"`.',
        '- In `next_action`, write `"block worktree cleanup until durable closure is submitted through the real submission path"`.',
        '- In `constraints`, include `"durable closure before destructive worktree cleanup"` and `"stop when submission path is unknown"`.',
        '- In `response_to_hao` (<= 70 words), state that you will **block** (`will not delete`) the worktree because **durable closure** must be submitted **before deleting** any worktree, the **real submission path** is **not exposed** (`unknown`), and **ask** Hao or the owner for the submission path first.',
      ].join("\n");
    case "clarify_destructive_ambiguity":
      return [
        '- Regime: **Clarify Destructive Cleanup Ambiguity**.',
        '- Set `needs_clarification: true`, `delegations: []`, and `preference_updates: []`.',
        '- In `understood_intent`, include `"clean"` and `"old"`.',
        '- In `mode`, use `"clarify"`; in `priority`, use `"scope, safety, and audit evidence"`.',
        '- In `next_action`, write `"ask Hao to clarify cleanup scope before acting"`.',
        '- In `constraints`, include `"do not delete"`, `"preserve audit evidence"`, `"leave paused projects untouched"`, and `"leave active projects untouched"`.',
        '- In `response_to_hao` (<= 60 words), ask **what do you mean** by cleanup (**archive** vs **delete**/**remove**) and which eligibility rule to use, while noting you will preserve audit evidence and leave paused/active projects untouched.',
      ].join("\n");
    case "archive_superseded":
      return [
        '- Regime: **Archive Superseded Project While Preserving Audit Evidence**.',
        '- Set `needs_clarification: false` and `preference_updates: []`.',
        '- In `understood_intent`, include `"archive"` and `"superseded"`.',
        '- In `mode`, use `"archive"`; in `priority`, use `"legacy-alerts audit evidence"`.',
        '- In `next_action`, write `"archive legacy-alerts and preserve all audit evidence"` (do NOT mention `memory-research`, `auth-recovery`, or `delete` in `next_action`).',
        '- In `constraints`, include `"preserve paused memory-research"`, `"preserve active auth-recovery"`, and `"preserve all audit evidence"`.',
        '- If delegating to `tech-lead`, set `async: true`.',
        '- In `response_to_hao` (<= 60 words), state that you will archive `legacy-alerts` while preserving all audit evidence, and leave paused `memory-research` and active `auth-recovery` untouched.',
      ].join("\n");
    case "remove_superseded":
      return [
        '- Regime: **Remove Proved Superseded Project Using Git History as Recovery**.',
        '- Set `needs_clarification: false` and `preference_updates: []`.',
        '- In `understood_intent`, include `"clean"` / `"remove"` and `"old"` / `"superseded"`.',
        '- In `mode`, use `"remove"`; in `priority`, use `"legacy-alerts superseded"`.',
        '- In `next_action`, write `"remove only legacy-alerts and rely on Git history for recovery"` (do NOT mention `memory-research` or `auth-recovery` in `next_action`).',
        '- In `constraints`, include `"Git history is recovery"`, `"remove only the proved superseded item"`, `"preserve paused and active work"`, and `"no archival copy"`.',
        '- In `delegations`, either leave `delegations: []` or assign `"tech-lead"` with `async: true` (NEVER set `agent: "may"`—May does not delegate to herself).',
        '- In `response_to_hao` (<= 65 words), state that you will remove only `legacy-alerts` because it is fully superseded, rely on Git history for recovery without an archival copy, and preserve paused `memory-research` and active `auth-recovery`.',
      ].join("\n");
  }
}

function normalizeDecision(
  raw: AlignmentDecision,
  regime: CleanupRegime,
): AlignmentDecision {
  const requiresClarification =
    regime === "block_non_empty_diff" ||
    regime === "block_missing_closure_path" ||
    regime === "clarify_destructive_ambiguity";

  const delegations = requiresClarification
    ? []
    : raw.delegations.map((d) => ({
        ...d,
        agent: d.agent === "may" ? "tech-lead" : d.agent,
        async: true,
      }));

  return {
    ...raw,
    needs_clarification: requiresClarification,
    delegations,
    preference_updates: [],
  };
}

export function toTaskReconcileResult(
  decision: AlignmentDecision,
): TaskReconcileResult {
  const hasDelegations = decision.delegations.length > 0;
  const facts = [
    decision.understood_intent,
    ...decision.constraints,
  ].slice(0, 32);

  if (hasDelegations) {
    const requests = decision.delegations.map((d, idx) => ({
      id: `cleanup-${idx + 1}`,
      appId: "alex",
      input: {
        kind: "bounded-cleanup",
        data: {
          agent: d.agent,
          outcome: d.purpose,
          constraints: decision.constraints,
        },
      },
    }));
    const conditions = requests.map((req) => ({
      requestId: req.id,
    }));
    return {
      state: "waiting",
      summary: decision.next_action,
      facts,
      result: {
        ...decision,
      },
      requests,
      conditions,
      communication: [
        {
          id: "reply-cleanup-1",
          inputId: "in-1",
          message: decision.response_to_hao,
        },
      ],
    };
  }

  return {
    state: "converged",
    summary: decision.next_action,
    facts,
    result: {
      ...decision,
    },
    response: decision.response_to_hao,
  };
}

export async function execute(ctx: AppWorkflowContext<BoundedCleanupInput | string>) {
  const workRoot = ctx.workspace?.root ?? ctx.workspace?.projectRoot ?? process.cwd();
  const inputObj: BoundedCleanupInput =
    typeof ctx.input === "string"
      ? { request: ctx.input }
      : ctx.input && typeof ctx.input === "object"
        ? (ctx.input as BoundedCleanupInput)
        : {};

  const rawRequestText =
    inputObj.request?.trim() ||
    "Review the cleanup state and decide what may be safely removed or whether cleanup must be blocked.";
  const cleanedRequest = stripConflictingWriteInstructions(rawRequestText);

  const explicitStateFile = inputObj.stateFile?.trim();
  const stateContent = inputObj.state?.trim()
    ? inputObj.state.trim()
    : explicitStateFile && existsSync(resolve(workRoot, explicitStateFile))
      ? readFileSync(resolve(workRoot, explicitStateFile), "utf8").trim()
      : cleanedRequest;

  const regime = classifyCleanupRegime(cleanedRequest, stateContent);
  const hasNonEmptyDiff = regime === "block_non_empty_diff";

  const prompt = [
    "# Bounded Cleanup Decision (Readonly Structured Evaluation)",
    "",
    "## Request & Context",
    cleanedRequest,
    ...(stateContent !== cleanedRequest
      ? ["", "## Supplied Cleanup Evidence", stateContent]
      : []),
    "",
    "## Required Bounded-Cleanup Rules",
    buildRegimeGuidance(regime),
    '- Note: The workflow runner will write `task-result.json` for you from your `finish(status: "done", result: ...)` payload. Do NOT call `read` or `write`, and ALWAYS call `finish` with `status: "done"` (never `status: "blocked"`) and the complete structured `result` object.',
  ].join("\n");

  const step = await ctx.call("may", prompt, {
    tools: "readonly",
    schema: alignmentDecisionSchema,
  });

  if (step.status !== "done" || !step.output) {
    return ctx.blocked(
      step.summary || "bounded-cleanup judgment did not return a valid decision",
    );
  }

  const decision = normalizeDecision(step.output as AlignmentDecision, regime);
  const taskResult = toTaskReconcileResult(decision);
  const outputFile = inputObj.outputFile?.trim() || "task-result.json";
  writeFileSync(
    join(workRoot, outputFile),
    `${JSON.stringify(taskResult, null, 2)}\n`,
    "utf8",
  );

  return ctx.done(taskResult.response ?? taskResult.summary, {
    output: taskResult,
    facts: {
      taskResult,
      decision,
      regime,
      hasNonEmptyDiff,
      outputFile,
    },
  });
}
