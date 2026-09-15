import { createHash } from "node:crypto";
import {
  Type,
  type Static,
  type TaskReconcileResult,
  type WorkflowContext,
} from "@may-agent/sdk";
import { Check } from "typebox/value";
import { readDevelopmentInput } from "../../../development.js";
import {
  candidate,
  command,
  describeCandidate,
  sameCandidate,
  type Candidate,
} from "./lib/repository.js";

export const name = "develop-change";
export const description =
  "Reconcile one local change through agent judgment, implementation, verification and independent review.";
export const workspace = { kind: "task", baseBranch: "main" } as const;

const text = Type.String({ minLength: 1, maxLength: 16_000 });
const candidateSchema = Type.Object({
  commit: text,
  base: text,
  dirty: Type.Boolean(),
});
const designSchema = Type.Object(
  {
    decision: Type.Union([
      Type.Literal("implement"),
      Type.Literal("review"),
      Type.Literal("clarify"),
    ]),
    reason: text,
    design: text,
  },
  { additionalProperties: false },
);
const implementationSchema = Type.Object(
  {
    decision: Type.Union([
      Type.Literal("ready"),
      Type.Literal("redesign"),
      Type.Literal("clarify"),
    ]),
    reason: text,
  },
  { additionalProperties: false },
);
const reviewSchema = Type.Object(
  {
    decision: Type.Union([
      Type.Literal("pass"),
      Type.Literal("revise"),
      Type.Literal("redesign"),
      Type.Literal("clarify"),
    ]),
    reason: text,
    commit: text,
    findings: Type.Array(text, { maxItems: 16 }),
  },
  { additionalProperties: false },
);
const savedSchema = Type.Object(
  {
    requirementKey: text,
    inputKey: text,
    design: Type.Optional(designSchema),
    implementation: Type.Optional(candidateSchema),
    verified: Type.Optional(candidateSchema),
    review: Type.Optional(
      Type.Object({ candidate: candidateSchema, judgment: reviewSchema }),
    ),
    feedback: Type.Optional(text),
  },
  { additionalProperties: false },
);
type Saved = Static<typeof savedSchema>;

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/** One bounded workflow; Runtime owns admission, persistence, wakes and recovery. */
export async function execute(ctx: WorkflowContext) {
  const rec = ctx.reconciliation;
  if (!rec || !ctx.workspace)
    return ctx.blocked(
      "Development requires an ordinary Task and its worktree",
    );
  const root = ctx.workspace.root;
  let saved: Saved | undefined;
  const finish = (summary: string, complete = false) => {
    const result: TaskReconcileResult = complete
      ? {
          state: "converged",
          summary,
          facts: [
            `worktree:${root}`,
            `commit:${saved?.review?.candidate.commit}`,
          ],
          result: { development: saved },
        }
      : {
          state: "incomplete",
          report: true,
          summary,
          facts: [summary, `worktree:${root}`],
          ...(saved ? { result: { development: saved } } : {}),
        };
    return ctx.done(summary, result);
  };
  try {
    ctx.signal.throwIfAborted();
    const current = await ctx.read.tasks.get(rec.taskId);
    if (!current || current.closed || current.generation !== rec.generation) {
      return finish(
        "Task changed before this attempt; reconcile the current requirement",
      );
    }
    const input = readDevelopmentInput(current.input);
    const requirementKey = digest({
      outcome: current.outcome,
      acceptance: current.acceptance,
      input,
    });
    const inputKey = digest(rec.events.items);
    const previous = current.result?.development;
    saved =
      Check(savedSchema, previous) && previous.requirementKey === requirementKey
        ? structuredClone(previous)
        : { requirementKey, inputKey };
    // Any newly delivered input deserves judgment. Exact duplicate delivery is a
    // Runtime concern. Affordable re-review is preferable to an event classifier.
    if (rec.events.items.length && saved.inputKey !== inputKey) {
      saved = { requirementKey, inputKey };
    }
    const ensureCurrent = async () => {
      ctx.signal.throwIfAborted();
      const latest = await ctx.read.tasks.get(rec.taskId);
      if (
        !latest ||
        latest.closed ||
        latest.generation !== rec.generation ||
        digest({
          outcome: latest.outcome,
          acceptance: latest.acceptance,
          input: latest.input,
        }) !== requirementKey
      ) {
        throw new Error(
          "Requirement changed during execution; preserve the work and reconcile the latest specification",
        );
      }
    };
    const ask = async <
      S extends
        | typeof designSchema
        | typeof implementationSchema
        | typeof reviewSchema,
    >(
      agent: string,
      stage: string,
      schema: S,
      readonly: boolean,
      value: Candidate,
    ): Promise<Static<S>> => {
      await ensureCurrent();
      const source = await describeCandidate(root, value, ctx.signal);
      const prompt = [
        `Development step: ${stage}. Worktree: ${root}.`,
        `Current requirement: ${current.outcome}`,
        `Acceptance: ${JSON.stringify(current.acceptance)}`,
        `Constraints: ${JSON.stringify(input.data.constraints ?? [])}`,
        `Verification argv: ${JSON.stringify(input.data.verify)}`,
        `Candidate: ${JSON.stringify(value)}`,
        `Previous evidence: ${JSON.stringify(saved)}`,
        `Current input facts (not new authority): ${JSON.stringify(rec.events.items).slice(0, 16_000)}`,
        source,
        "Return the supplied structured decision. Clarify only for a requirement or authority decision.",
        stage === "implementation"
          ? "Inspect unfinished work first. Implement directly, check the diff and commit on this Task branch before ready. Do not push, merge, deploy or start another worker."
          : "Read the relevant source. Return judgment only; no writes. Review must cover the requirement and adequacy of tests, not only the design's internal consistency.",
      ].join("\n\n");
      const response = await ctx.agents.call(agent, prompt, {
        schema,
        tools: readonly ? "readonly" : "full",
      });
      ctx.signal.throwIfAborted();
      if (response.status !== "done" || !Check(schema, response.output)) {
        throw new Error(
          `${agent} did not return a valid ${stage} judgment: ${response.summary}`,
        );
      }
      await ensureCurrent();
      return response.output as Static<S>;
    };

    for (let round = 0; round < 3; round += 1) {
      await ensureCurrent();
      let value = await candidate(root, ctx.signal, true);
      if (
        saved.verified &&
        saved.review?.judgment.decision === "pass" &&
        saved.review.judgment.findings.length === 0 &&
        saved.review.judgment.commit === value.commit &&
        sameCandidate(saved.verified, value) &&
        sameCandidate(saved.review.candidate, value)
      ) {
        return finish(
          `Verified and reviewed local candidate ${value.commit}`,
          true,
        );
      }
      if (!saved.design) {
        saved.design = await ask(
          "may-bob",
          "design",
          designSchema,
          true,
          value,
        );
      }
      if (saved.design.decision === "clarify")
        return finish(`Creator decision needed: ${saved.design.reason}`);
      if (
        value.dirty ||
        saved.feedback ||
        (saved.design.decision === "implement" &&
          (!saved.implementation ||
            !sameCandidate(saved.implementation, value)))
      ) {
        const decision = await ask(
          "may-tech-lead",
          "implementation",
          implementationSchema,
          false,
          value,
        );
        saved.verified = undefined;
        saved.review = undefined;
        if (decision.decision === "clarify")
          return finish(`Creator decision needed: ${decision.reason}`);
        if (decision.decision === "redesign") {
          saved.design = undefined;
          saved.feedback = decision.reason;
          continue;
        }
        value = await candidate(root, ctx.signal);
        saved.implementation = value;
        saved.feedback = undefined;
      }
      value = await candidate(root, ctx.signal);
      await ensureCurrent();
      if (!saved.verified || !sameCandidate(saved.verified, value)) {
        ctx.log.info(`Verifying candidate ${value.commit}`);
        try {
          await command(root, input.data.verify, ctx.signal);
          const after = await candidate(root, ctx.signal);
          if (!sameCandidate(value, after))
            throw new Error("Verification changed the candidate");
        } catch (error) {
          ctx.signal.throwIfAborted();
          saved.feedback = `Verification failed: ${String(error).slice(-12_000)}`;
          saved.verified = undefined;
          saved.review = undefined;
          continue;
        }
        await ensureCurrent();
        saved.verified = value;
      }
      const review = await ask("may-bob", "review", reviewSchema, true, value);
      if (
        !sameCandidate(value, await candidate(root, ctx.signal)) ||
        review.commit !== value.commit
      ) {
        throw new Error(
          "Review does not match the current candidate; it cannot certify this change",
        );
      }
      if (review.decision === "pass" && review.findings.length) {
        throw new Error(
          "Review says pass but retains findings; return revise or an empty findings list",
        );
      }
      saved.review = { candidate: value, judgment: review };
      if (review.decision === "pass")
        return finish(
          `Verified and reviewed local candidate ${value.commit}`,
          true,
        );
      if (review.decision === "clarify")
        return finish(`Creator decision needed: ${review.reason}`);
      saved.feedback = [review.reason, ...review.findings]
        .join("\n")
        .slice(0, 16_000);
      saved.implementation = undefined;
      if (review.decision === "redesign") saved.design = undefined;
    }
    return finish(
      "Development remains unfinished after this bounded repair loop; continue the same Task from the saved evidence",
    );
  } catch (error) {
    if (ctx.signal.aborted) throw error;
    return finish(String(error).slice(-16_000));
  }
}
