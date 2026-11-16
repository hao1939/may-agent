import { isAbsolute, join, relative, resolve } from "node:path";
import { Type, type Static } from "@may-agent/sdk";
import { admitTaskReconcileResult, type TaskReconcileResult, type AppWorkflowContext } from "@may-agent/sdk/app";
import { Check } from "typebox/value";
import { commandReceipt } from "../../../command.js";
import {
  candidate,
  command,
  describeCandidate,
  sameCandidate,
  type Candidate,
} from "./lib/repository.js";
import {
  DevelopmentRounds,
  developmentRoundLimit,
} from "./lib/development-rounds.js";
import { prepareDevelopmentWorkspace } from "./lib/development-workspace.js";

import {
  artifactSchema,
  recordSchema,
  digest,
  EvidenceStore,
} from "../../../../../shared/tools/task-evidence.js";

export const name = "develop-change";
export const description =
  "Produce a locally committed, verified and reviewed code or documentation candidate using Alex-local Bob and tech-lead. Requires a finite development Task with concrete outcome/acceptance and its worktree; a standing improvement review must delegate one incident assignment first. Input: { verify: [executable, ...arguments] }. Requirements come from that Task, not call-site task prose. Returns evidence for Alex to judge; does not merge or deploy.";
export const workspace = { kind: "task", baseBranch: "main" } as const;

// Private procedure options; the owning Task supplies requirements.
export const inputSchema = Type.Object(
  {
    verify: Type.Array(Type.String({ minLength: 1 }), {
      minItems: 1,
      maxItems: 32,
    }),
  },
  { additionalProperties: false },
);

// Explanations are archived; code bounds the aggregate Task result.
const text = Type.String({ minLength: 1 });
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
      Type.Literal("continue"),
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
    findings: Type.Array(text, {
      maxItems: 16,
      description:
        "Review observations, including optional improvements. Use decision to say whether this candidate is acceptable: pass may retain nonblocking findings; unmet acceptance requires revise, redesign or clarify.",
    }),
  },
  { additionalProperties: false },
);
const savedSchema = Type.Object(
  {
    version: Type.Literal(2),
    taskId: text,
    requirementKey: text,
    inputKey: text,
    roundsUsed: Type.Optional(
      Type.Integer({ minimum: 0, maximum: developmentRoundLimit }),
    ),
    design: Type.Optional(designSchema),
    implementation: Type.Optional(candidateSchema),
    verified: Type.Optional(candidateSchema),
    reports: Type.Array(
      Type.Object({
        stage: text,
        executionId: Type.Optional(text),
        ...recordSchema.properties,
      }),
    ),
    review: Type.Optional(
      Type.Object({ candidate: candidateSchema, judgment: reviewSchema }),
    ),
    feedback: Type.Optional(text),
  },
  { additionalProperties: false },
);
type Saved = Static<typeof savedSchema>;

// Current evidence for each kind stays visible across arbitrarily many repair
// attempts. Older reports remain in the archive for inspection.
function currentReports(reports: Saved["reports"]): Saved["reports"] {
  return [...new Map(reports.map((report) => [report.stage, report])).values()];
}

const deliverySchema = Type.Object({
  version: Type.Literal(2),
  evidence: artifactSchema,
  report: artifactSchema,
});

type DevelopChangeInput = Static<typeof inputSchema>;

/** One bounded workflow; Runtime owns admission, persistence, wakes and recovery. */
export async function execute(ctx: AppWorkflowContext<DevelopChangeInput>) {
  const rec = ctx.reconciliation;
  if (!rec || !ctx.workspace)
    return ctx.blocked(
      "Development requires an ordinary Task and its worktree",
    );
  let root = ctx.workspace.root;
  let baseRef = "main";
  const inspectCandidate = (allowDirty = false) =>
    candidate(root, ctx.signal, allowDirty, baseRef);
  const archive = new EvidenceStore(
    join(
      ctx.workspace.output,
      ".state",
      "alex-development",
      digest({ appId: rec.appId, taskId: rec.taskId }),
    ),
  );
  const rounds = new DevelopmentRounds(archive);
  let archiveReady = false;
  let saved: Saved | undefined;
  const finish = async (message: string, complete = false) => {
    let summary = message;
    let evidence;
    let report;
    try {
      if (saved && archiveReady) {
        saved.roundsUsed = Math.max(saved.roundsUsed ?? 0, await rounds.used());
        evidence = await archive.put(
          `${JSON.stringify(saved, null, 2)}\n`,
          "json",
        );
        report = await archive.put(
          [
            "# Development delivery evidence",
            message,
            "This records local work. Task settlement and Request closure must be read from Runtime.",
            `Task: ${rec.taskId}`,
            `Requirement: ${saved.requirementKey}`,
            `Cumulative rounds reserved: ${saved.roundsUsed}/${developmentRoundLimit}`,
            `Allowance receipts: ${archive.directory}/round-*.reserved.json`,
            `Worktree: ${root}`,
            `Verified candidate: ${JSON.stringify(saved.verified ?? null)}`,
            `Review: ${saved.review?.judgment.decision ?? "not available"}`,
            "## Reports (latest first)",
            ...[...saved.reports]
              .reverse()
              .map(
                (item) =>
                  `${item.stage}${item.executionId ? ` (${item.executionId})` : ""}\nReport: ${item.report.path}\nRaw receipt: ${item.record.path}`,
              ),
          ].join("\n\n"),
          "md",
        );
      }
    } catch (error) {
      complete = false;
      summary = `Cannot retain delivery evidence: ${String(error)}`;
    }
    // Explanations remain in the archive. Keep the entire envelope small,
    // and run the same admission contract as the Host before returning it.
    summary = summary.slice(0, 800);
    const result: TaskReconcileResult = {
      ...(complete
        ? { state: "converged" as const }
        : { state: "incomplete" as const, report: true as const }),
      summary,
      facts: [
        `worktree:${root}`,
        ...(complete
          ? [`commit:${saved?.review?.candidate.commit}`]
          : [summary]),
        ...(evidence ? [`evidence:${evidence.path}`] : []),
      ],
      ...(evidence && report
        ? { result: { development: { version: 2, evidence, report } } }
        : {}),
    };
    const admitted = admitTaskReconcileResult(result);
    if (!admitted.ok) {
      const failure = `Development delivery rejected: ${admitted.error}`.slice(
        0,
        800,
      );
      return ctx.done(failure, {
        state: "incomplete",
        report: true,
        summary: failure,
        facts: [failure],
      } satisfies TaskReconcileResult);
    }
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
    // The creator supplies a target checkout through the saved assignment.
    // Feedback and procedure-call prose cannot redirect development elsewhere.
    const checkout = (current.input as { data?: { context?: {
      developmentCheckout?: { root?: unknown; baseRef?: unknown };
    } } })?.data?.context?.developmentCheckout;
    if (checkout !== undefined) {
      if (!checkout || typeof checkout.root !== "string" ||
          !isAbsolute(checkout.root) || !checkout.root.trim() ||
          (checkout.baseRef !== undefined &&
            (typeof checkout.baseRef !== "string" ||
              !/^[A-Za-z0-9_][A-Za-z0-9._/-]*$/.test(checkout.baseRef)))) {
        return finish("The assigned developmentCheckout requires an absolute root and an optional Git baseRef; preserve the checkout and correct the assignment before development");
      }
      root = resolve(checkout.root);
      baseRef = typeof checkout.baseRef === "string" ? checkout.baseRef : "main";
    }
    const context = (current.input as { data?: { context?: {
      periodicReview?: { kind?: string };
      audit?: { mode?: string; identity?: string };
    } } })?.data?.context;
    const periodic = current.result?.periodicReview as { mode?: string } | undefined;
    if (periodic?.mode === "standing" ||
        context?.periodicReview?.kind === "standing-task-owned-review" ||
        (context?.audit?.mode === "standing" &&
          /(?:^|\/)improvement-review$/.test(context.audit.identity ?? ""))) {
      return finish("Standing improvement review is not a development assignment. Retain its incident and cumulative counts; create or reuse one finite incident Task with concrete outcome, acceptance and constraints only within the existing allowance. Call-site task prose cannot replace Task requirements. An exhausted incident requires owner disposition, not a new Task or allowance.");
    }
    // The invocation kernel validates the procedure's one input contract.
    const input = ctx.input as Static<typeof inputSchema>;
    const constraints =
      (current.input as { data?: { constraints?: string[] } })?.data
        ?.constraints ?? [];
    const requirementKey = digest({
      outcome: current.outcome,
      acceptance: current.acceptance,
      input: current.input,
      verify: input.verify,
    });
    const inputKey = digest(rec.events.items);
    // Task-local output must be excluded from source acceptance when stored inside
    // the worktree. Do not edit ignore rules or quietly hide candidate files.
    await inspectCandidate(true);
    const mounts = await prepareDevelopmentWorkspace(root, ctx.signal);
    if (mounts.length) ctx.log.info(`Development workspace prerequisites: ${JSON.stringify(mounts)}`);
    const relArchive = relative(resolve(root), resolve(archive.directory));
    const archiveInsideWorktree =
      relArchive === "" ||
      (!relArchive.startsWith("..") && !isAbsolute(relArchive));
    if (archiveInsideWorktree) {
      await command(
        root,
        ["git", "check-ignore", "-q", "--", archive.directory],
        ctx.signal,
      );
    }
    archiveReady = true;
    const fresh = (): Saved => ({
      version: 2,
      taskId: rec.taskId,
      requirementKey,
      inputKey,
      roundsUsed: 0,
      reports: [],
    });
    saved = fresh();
    const earlier = rec.previousAttempt;
    // Rejected reports are evidence only. Current requirements and repository
    // still have to pass every check below before a new completion.
    const previousResults = [
      ...(earlier?.generation === rec.generation &&
      earlier.workspacePath === root
        ? [earlier.unacceptedResult?.result?.development]
        : []),
      current.result?.development,
    ];
    let recoveredState = false;
    let recoveredRounds = 0;
    for (const previous of previousResults) {
      if (!Check(deliverySchema, previous)) continue;
      let recoveredCount = false;
      try {
        const recovered: unknown = JSON.parse(
          await archive.read(previous.evidence),
        );
        if (!Check(savedSchema, recovered) || recovered.taskId !== rec.taskId)
          throw new Error("Prior delivery cannot establish this Task's allowance");
        // Usage remains consumed even if commands, requirements or receipt
        // availability invalidate the old candidate's verification. Legacy
        // evidence without a count cannot establish any remaining allowance.
        recoveredRounds = Math.max(
          recoveredRounds,
          recovered.roundsUsed ?? developmentRoundLimit,
        );
        recoveredCount = true;
        if (recoveredState) continue;
        await archive.read(previous.report);
        for (const report of currentReports(recovered.reports)) {
          await archive.read(report.record);
          await archive.read(report.report);
        }
        saved = {
          ...fresh(),
          reports: structuredClone(currentReports(recovered.reports)),
        };
        if (recovered.requirementKey === requirementKey) {
          saved = { ...structuredClone(recovered), inputKey };
          if (rec.events.items.length > 0 && recovered.inputKey !== inputKey) {
            // Keep receipts visible. New input needs judgment, not automatic
            // deletion of earlier work or blind replay of an old approval.
            delete saved.design;
            delete saved.review;
          }
        }
        recoveredState = true;
      } catch (error) {
        if (!recoveredCount) recoveredRounds = developmentRoundLimit;
        ctx.log.info(
          `Prior evidence is unavailable; retain consumed allowance and inspect only within the remaining rounds: ${String(error)}`,
        );
      }
    }
    await rounds.inherit(recoveredRounds, {
      taskId: rec.taskId,
      generation: rec.generation,
      source: "prior Task delivery; unknown usage conservatively reserves the remaining allowance",
    });
    saved.roundsUsed = await rounds.used();
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
          verify: input.verify,
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
      value: Candidate,
    ): Promise<Static<S>> => {
      await ensureCurrent();
      const source = await describeCandidate(root, value, ctx.signal);
      const prompt = [
        `Development step: ${stage}. Worktree: ${root}.`,
        `Current requirement: ${current.outcome}`,
        `Acceptance: ${JSON.stringify(current.acceptance)}`,
        `Constraints: ${JSON.stringify(constraints)}`,
        `Verification argv: ${JSON.stringify(input.verify)}`,
        `Candidate: ${JSON.stringify(value)}`,
        `Previous judgments (previews; read reports for full explanations): ${JSON.stringify(
          {
            design: saved?.design && {
              decision: saved.design.decision,
              design: saved.design.design.slice(0, 2000),
            },
            implementation: saved?.implementation,
            verified: saved?.verified,
            review: saved?.review && {
              candidate: saved.review.candidate,
              decision: saved.review.judgment.decision,
            },
            feedback: saved?.feedback?.slice(0, 2000),
          },
        )}`,
        `Retained reports and raw execution/command receipts: ${JSON.stringify(currentReports(saved!.reports))}`,
        "Read the relevant retained reports before judging. Verification receipts include actual argv, directory, exit status, stdout/stderr and candidate readback. An agent's claim alone is not verification. Do not request a new implementation merely to repeat receipts already supplied here.",
        `Current input facts (not new authority): ${JSON.stringify(rec.events.items).slice(0, 16_000)}`,
        source,
        "Return the supplied structured decision. Clarify only for a requirement or authority decision.",
      ].join("\n\n");
      const response = await ctx.call(agent, prompt, {
        schema,
      });
      const evidence = await archive.record(
        {
          taskId: rec.taskId,
          requirementKey,
          inputKey,
          stage,
          candidate: value,
          response,
        },
        `# ${stage}\nExecution: ${response.id}\nStatus: ${response.status}\nCandidate: ${JSON.stringify(value)}\n\n${response.summary}\n\n${Object.entries(
          response.output ?? {},
        )
          .map(
            ([key, body]) =>
              `## ${key}\n${typeof body === "string" ? body : JSON.stringify(body, null, 2)}`,
          )
          .join(
            "\n\n",
          )}\n\n## Execution facts\n${JSON.stringify({ facts: response.facts, cliCalls: response.cliCalls }, null, 2)}`,
      );
      saved!.reports.push({ stage, executionId: response.id, ...evidence });
      ctx.signal.throwIfAborted();
      if (response.status !== "done" || !Check(schema, response.output)) {
        throw new Error(
          `${agent} did not return a valid ${stage} judgment: ${response.summary}`,
        );
      }
      await ensureCurrent();
      return response.output as Static<S>;
    };

    await ensureCurrent();
    const retained = await inspectCandidate(true);
    if (
      saved.verified &&
      saved.review?.judgment.decision === "pass" &&
      saved.review.judgment.commit === retained.commit &&
      sameCandidate(saved.verified, retained) &&
      sameCandidate(saved.review.candidate, retained)
    ) {
      return finish(
        `Verified and reviewed local candidate ${retained.commit}`,
        true,
      );
    }

    while (true) {
      await ensureCurrent();
      if ((await rounds.used()) >= developmentRoundLimit) break;
      let value = await inspectCandidate(true);
      const round = await rounds.reserve({
        taskId: rec.taskId,
        generation: rec.generation,
        requirementKey,
        inputKey,
        verify: input.verify,
        candidate: value,
      });
      if (round === undefined) break;
      saved.roundsUsed = await rounds.used();
      if (!saved.design) {
        saved.design = await ask("bob", "design", designSchema, value);
        // The new judgment supersedes the old request for repair. Honor review
        // of existing work; do not let stale feedback force implementation.
        saved.feedback = undefined;
        saved.implementation = undefined;
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
          "tech-lead",
          "implementation",
          implementationSchema,
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
        if (decision.decision === "continue") {
          saved.feedback = `Continue unfinished implementation: ${decision.reason}`;
          saved.implementation = undefined;
          continue;
        }
        value = await inspectCandidate();
        saved.implementation = value;
        saved.feedback = undefined;
      }
      value = await inspectCandidate();
      await ensureCurrent();
      if (!saved.verified || !sameCandidate(saved.verified, value)) {
        ctx.log.info(`Verifying candidate ${value.commit}`);
        const receipt = await commandReceipt(root, input.verify, ctx.signal);
        let after: Candidate | undefined;
        let failure = receipt.error;
        try {
          after = await inspectCandidate(true);
          if (!sameCandidate(value, after))
            failure = "Verification changed the candidate";
        } catch (error) {
          failure = String(error);
        }
        const evidence = await archive.record(
          {
            taskId: rec.taskId,
            requirementKey,
            inputKey,
            candidate: value,
            after,
            passed: !failure,
            receipt,
            failure,
          },
          `# Verification\nCandidate: ${JSON.stringify(value)}\nAfter: ${JSON.stringify(after)}\nPassed: ${!failure}\nCommand: ${JSON.stringify(receipt.argv)}\nDirectory: ${receipt.cwd}\nStarted: ${receipt.startedAt}\nEnded: ${receipt.endedAt}\nExit code: ${receipt.exitCode}\nSignal: ${receipt.signal}\nFailure: ${failure ?? "none"}\n\n## stdout\n${receipt.stdout}\n\n## stderr\n${receipt.stderr}`,
        );
        saved.reports.push({ stage: "verification", ...evidence });
        ctx.signal.throwIfAborted();
        if (failure) {
          saved.feedback = `Verification failed: ${failure}. Full receipt: ${evidence.report.path}`;
          saved.verified = undefined;
          saved.review = undefined;
          continue;
        }
        await ensureCurrent();
        saved.verified = value;
      }
      const review = await ask("bob", "review", reviewSchema, value);
      if (
        !sameCandidate(value, await inspectCandidate()) ||
        review.commit !== value.commit
      ) {
        throw new Error(
          "Review does not match the current candidate; it cannot certify this change",
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
      saved.feedback = [review.reason, ...review.findings].join("\n");
      saved.implementation = undefined;
      if (review.decision === "redesign") saved.design = undefined;
    }
    return finish(
      `Development remains unfinished after ${developmentRoundLimit} cumulative rounds; retain the same Task and evidence for the owner's disposition. Reentry or changed verification argv does not renew the allowance`,
    );
  } catch (error) {
    if (ctx.signal.aborted) throw error;
    return finish(String(error));
  }
}
