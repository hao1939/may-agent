import { join } from "node:path";
import {
  Type,
  admitTaskReconcileResult,
  type Static,
  type TaskReconcileResult,
  type WorkflowContext,
} from "@may-agent/sdk";
import { Check } from "typebox/value";
import { readDevelopmentInput } from "../../../development.js";
import {
  candidate,
  command,
  commandReceipt,
  describeCandidate,
  sameCandidate,
  type Candidate,
} from "./lib/repository.js";

import {
  artifactSchema,
  recordSchema,
  digest,
  EvidenceStore,
} from "../../../../../shared/tools/task-evidence.js";

export const name = "develop-change";
export const description =
  "Reconcile one local change through agent judgment, implementation, verification and independent review.";
export const workspace = { kind: "task", baseBranch: "main" } as const;

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
    version: Type.Literal(2),
    taskId: text,
    requirementKey: text,
    inputKey: text,
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

/** One bounded workflow; Runtime owns admission, persistence, wakes and recovery. */
export async function execute(ctx: WorkflowContext) {
  const rec = ctx.reconciliation;
  if (!rec || !ctx.workspace)
    return ctx.blocked(
      "Development requires an ordinary Task and its worktree",
    );
  const root = ctx.workspace.root;
  const archive = new EvidenceStore(
    join(
      ctx.workspace.output,
      ".state",
      "may-development",
      digest({ appId: rec.appId, taskId: rec.taskId }),
    ),
  );
  let archiveReady = false;
  let saved: Saved | undefined;
  const finish = async (message: string, complete = false) => {
    let summary = message;
    let evidence;
    let report;
    try {
      if (saved && archiveReady) {
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
    const admitted = admitTaskReconcileResult(result, {
      allowNeedsAgent: false,
    });
    if (!admitted.ok) {
      const failure =
        "Development delivery cannot fit the Host result contract; retained files need inspection";
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
    const input = readDevelopmentInput(current.input);
    const requirementKey = digest({
      outcome: current.outcome,
      acceptance: current.acceptance,
      input,
    });
    const inputKey = digest(rec.events.items);
    // Task-local output must be excluded from source acceptance. Do not edit
    // ignore rules or quietly hide any candidate files in the workflow.
    await candidate(root, ctx.signal, true);
    await command(
      root,
      ["git", "check-ignore", "-q", "--", archive.directory],
      ctx.signal,
    );
    archiveReady = true;
    const fresh = (): Saved => ({
      version: 2,
      taskId: rec.taskId,
      requirementKey,
      inputKey,
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
    for (const previous of previousResults) {
      if (!Check(deliverySchema, previous)) continue;
      try {
        await archive.read(previous.report);
        const recovered: unknown = JSON.parse(
          await archive.read(previous.evidence),
        );
        if (
          !Check(savedSchema, recovered) ||
          recovered.taskId !== rec.taskId ||
          recovered.requirementKey !== requirementKey ||
          (rec.events.items.length > 0 && recovered.inputKey !== inputKey)
        )
          continue;
        for (const report of currentReports(recovered.reports)) {
          await archive.read(report.record);
          await archive.read(report.report);
        }
        saved = structuredClone(recovered);
        break;
      } catch (error) {
        ctx.log.info(
          `Prior evidence is unavailable; inspect the candidate afresh: ${String(error)}`,
        );
      }
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
        stage === "implementation"
          ? "Inspect unfinished work first. Implement directly, check the diff and commit on this Task branch before ready. Do not push, merge, deploy or start another worker."
          : "Read the relevant source. Return judgment only; no writes. Review must cover the requirement and adequacy of tests, not only the design's internal consistency.",
      ].join("\n\n");
      const response = await ctx.agents.call(agent, prompt, {
        schema,
        tools: readonly ? "readonly" : "full",
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
        const receipt = await commandReceipt(
          root,
          input.data.verify,
          ctx.signal,
        );
        let after: Candidate | undefined;
        let failure = receipt.error;
        try {
          after = await candidate(root, ctx.signal, true);
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
      saved.feedback = [review.reason, ...review.findings].join("\n");
      saved.implementation = undefined;
      if (review.decision === "redesign") saved.design = undefined;
    }
    return finish(
      "Development remains unfinished after this bounded repair loop; continue the same Task from the saved evidence",
    );
  } catch (error) {
    if (ctx.signal.aborted) throw error;
    return finish(String(error));
  }
}
