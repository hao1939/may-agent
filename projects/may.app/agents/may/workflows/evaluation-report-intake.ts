import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";
import {
  readPublishedEvaluationReport,
  type PublishedReportRequest,
} from "../../../../evaluation.app/agents/evaluator/workflows/evaluation-report-reader.js";
import {
  readSubjectTask,
  type SubjectEvidence,
} from "../../../../evaluation.app/agents/evaluator/workflows/lib/public-task-evidence.js";
import { assessmentContext } from "../../../../evaluation.app/agents/evaluator/workflows/lib/task-assessment-context.js";
import { planReportIntake } from "../../../evaluation-report-intake.js";
import {
  inspectMetricResponse,
  metricResponseKey,
  readMetricLinkedTask,
} from "./metric-response.js";
import { createHash } from "node:crypto";
import {
  readMetricEvidence,
  type MetricReader,
} from "../../../../evaluation.app/agents/evaluator/workflows/lib/metric-evidence.js";

export const name = "evaluation-report-intake";
export const description =
  'Run workflow({action:"run",name:"evaluation-report-intake",input:message.context.publication}); preserve the complete publication object, with appId and taskId or metricId at the top level, not { publication: ... }. Integrity-check that report and reread its canonical current subject.';

const missingPublicationIdentity =
  'Evaluation report intake requires the complete flat publication object. Run workflow({action:"run",name:"evaluation-report-intake",input:message.context.publication}); appId and taskId (or metricId and optional alertId) must be top-level input fields, all publication fields must be preserved, and input.publication is not accepted.';

type Input = PublishedReportRequest;
type SubjectReader = (subject: {
  appId: string;
  taskId: string;
  populationEnd?: number;
}) => Promise<SubjectEvidence>;
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function checkedReportSummary(
  facts: Record<string, unknown>,
): Record<string, unknown> {
  // readPublishedEvaluationReport has already rendered and hash-matched the full
  // report, including the required judgment schema. Keep this boundary focused
  // on transport size rather than duplicating the canonical validator.
  const judgment = object(facts.judgment);
  const complete = Buffer.byteLength(JSON.stringify(judgment)) <= 7_000;
  return {
    judgment: complete ? judgment : null,
    complete,
    ...(complete
      ? {}
      : {
          omission:
            "The integrity-checked judgment exceeds the intake result bound; read the exact retained report before any no-action or repair decision.",
        }),
    source: {
      subject: facts.subject,
      snapshot: facts.snapshot,
      freshness: facts.freshness,
      evaluator: facts.evaluator,
      rubricVersion: facts.rubricVersion,
      sourceRevision: facts.sourceRevision,
    },
  };
}
function finish(
  ctx: WorkflowContext<Input>,
  disposition: string,
  detail: string,
  result: Record<string, unknown> = {},
): ExecutionResult {
  const summary = `Evaluation report intake: ${disposition}. ${detail}`;
  return ctx.done(summary, {
    state:
      disposition === "current-evidence-unavailable" ||
      disposition === "retry-publication"
        ? "incomplete"
        : "converged",
    summary,
    response: summary,
    result: {
      stage: "evaluation-report-intake",
      disposition,
      publication: ctx.input,
      report: {
        facts: ctx.input.facts,
        report: ctx.input.report,
        jsonHash: ctx.input.jsonHash,
        markdownHash: ctx.input.markdownHash,
        ...(ctx.input.reviewer ? { reviewer: ctx.input.reviewer } : {}),
        ...(ctx.input.assessmentPurpose
          ? { assessmentPurpose: ctx.input.assessmentPurpose }
          : {}),
        ...(ctx.input.rubricVersion
          ? { rubricVersion: ctx.input.rubricVersion }
          : {}),
        ...(ctx.input.validityIdentity
          ? { validityIdentity: ctx.input.validityIdentity }
          : {}),
      },
      ...result,
    },
    facts: [
      `evaluation-intake:${disposition}`,
      `evaluation-report:${ctx.input.facts}`,
      `evaluation-subject:${ctx.input.metricId ?? `${ctx.input.appId}/${ctx.input.taskId}`}`,
    ],
    actions: [],
  });
}

async function readPriorIntake(
  ctx: WorkflowContext<Input>,
  readLinked = readMetricLinkedTask,
) {
  const publication = ctx.input;
  // Reuse this owner's accepted intake before preparing another handoff. No
  // registry or list scan: the ordinary Task result is the recovery boundary.
  let prior:
    | { evidenceHash: string; disposition: string; linkedTaskId?: string }
    | undefined;
  let priorResult: Record<string, unknown> = {};
  if (ctx.reconciliation?.taskId) {
    try {
      const current = object(
        await ctx.read.tasks.get(ctx.reconciliation.taskId),
      );
      if (current.id !== ctx.reconciliation.taskId)
        throw new Error("Current owner Task unavailable");
      const accepted = object(current.result);
      const candidate =
        accepted.stage === "evaluation-report-intake"
          ? accepted
          : object(accepted.result);
      const previous = object(candidate.publication);
      if (
        candidate.stage === "evaluation-report-intake" &&
        ["investigate", "reuse", "recovered", "no-change"].includes(
          String(candidate.disposition),
        ) &&
        [
          "appId",
          "taskId",
          "metricId",
          "alertId",
          "executionId",
          "evidenceHash",
          "jsonHash",
          "markdownHash",
          "facts",
          "report",
          "reviewer",
          "assessmentPurpose",
          "rubricVersion",
          "validityIdentity",
        ].every((key) => previous[key] === publication[key as keyof Input])
      ) {
        const linkedTaskId =
          typeof candidate.linkedTaskId === "string"
            ? candidate.linkedTaskId
            : undefined;
        if (linkedTaskId) {
          const appId =
            typeof candidate.linkedAppId === "string"
              ? candidate.linkedAppId
              : null;
          const linked = object(
            appId
              ? await readLinked(appId, linkedTaskId)
              : await ctx.read.tasks.get(linkedTaskId),
          );
          if (
            !linked ||
            (linked.taskId ?? linked.id) !== linkedTaskId ||
            (appId && linked.appId !== appId)
          )
            throw new Error("Linked owner Task unavailable");
        }
        priorResult = candidate;
        prior = {
          evidenceHash: publication.evidenceHash,
          disposition: String(candidate.disposition),
          ...(linkedTaskId ? { linkedTaskId } : {}),
        };
      }
    } catch {
      throw new Error(
        "Accepted prior intake or its linked owner could not be read; do not create replacement work.",
      );
    }
  }
  return { prior, priorResult };
}

export async function intakeEvaluationReport(
  ctx: WorkflowContext<Input>,
  reportRoot?: string,
  subjectReader: SubjectReader = readSubjectTask,
  metricReader: MetricReader = readMetricEvidence,
  linkedTaskReader = readMetricLinkedTask,
): Promise<ExecutionResult> {
  const publication = ctx.input;
  if (
    (!publication?.appId && !publication?.metricId) ||
    (!publication.taskId && !publication.metricId)
  )
    return ctx.blocked(missingPublicationIdentity);
  const read = readPublishedEvaluationReport(publication, reportRoot);
  if (read.status === "publication-pending")
    return finish(
      ctx,
      "retry-publication",
      "The accepted publication marker is not durable yet.",
      { currentEvidence: null, handoffKey: null },
    );
  if (read.status === "invalid")
    return finish(ctx, "invalid", read.reason, {
      currentEvidence: null,
      handoffKey: null,
    });
  const checkedReport = checkedReportSummary(read.facts);
  if (publication.metricId) {
    let current, handling, retained;
    try {
      current = await metricReader(
        publication.metricId,
        Date.now(),
        publication.alertId,
      );
      handling = await inspectMetricResponse(
        current,
        publication.alertId ?? null,
        linkedTaskReader,
      );
      retained = await readPriorIntake(ctx, linkedTaskReader);
    } catch (error) {
      return finish(ctx, "current-evidence-unavailable", String(error), {
        checkedReport,
        currentEvidence: null,
        handoffKey: null,
      });
    }
    const currentEvidence = {
      metricId: current.metricId,
      end: current.end,
      metric: current.metric,
      responsibility: current.responsibility,
      alerts: current.alerts,
      latest: current.latest,
      freshness: current.freshness,
      comparison: current.comparison,
    };
    const complete =
      Buffer.byteLength(JSON.stringify(currentEvidence)) <= 3_500;
    return finish(
      ctx,
      retained.prior ? "reuse" : "investigate",
      "The report assesses its pinned metric window. Judge its current relevance and reuse linked work when appropriate; neither an improved metric nor a delivered report proves original input recovery.",
      {
        checkedReport,
        priorRead: retained.prior ? "read" : "absent",
        priorDisposition: retained.prior?.disposition ?? null,
        linkedTaskId: handling.prior
          ? (handling.prior.decision?.linkedTask?.taskId ?? null)
          : (retained.prior?.linkedTaskId ?? null),
        linkedAppId: handling.prior
          ? (handling.prior.decision?.linkedTask?.appId ?? null)
          : (retained.priorResult.linkedAppId ?? null),
        handling:
          Buffer.byteLength(JSON.stringify(handling)) <= 3000
            ? { ...handling, complete: true }
            : {
                key: handling.key,
                complete: false,
                omission:
                  "Read metric-response for exact retained handling before a decision",
              },
        currentEvidence: complete
          ? { ...currentEvidence, complete: true }
          : {
              metricId: current.metricId,
              end: current.end,
              complete: false,
              omission:
                "Current metric evidence exceeds the intake result bound; reread this metric at the returned cut before any no-action or repair decision.",
            },
        handoffKey: createHash("sha256")
          .update(metricResponseKey(publication.metricId, publication.alertId))
          .digest("hex"),
        followUpKey: metricResponseKey(
          publication.metricId,
          publication.alertId,
        ),
        nextOwner: "app:may",
        nextAction:
          "Review this report even when the breach already has linked work. Use metric-response to prepare the supported decision and retain its metric-disposition fact in the current Task result. Reuse an investigation only when its scope fits; a recovered metric does not settle its requests. Missing or truncated history does not prove no investigation exists.",
      },
    );
  }

  // This is Evaluation's allowlisted public control-plane reader. It verifies
  // App/Task identities and computes the same canonical evidence hash used by
  // task-outcome publication; it is not private or invented cross-App access.
  const subject = await subjectReader({
    appId: publication.appId!,
    taskId: publication.taskId!,
    ...(Number.isSafeInteger(object(object(read.facts.evidence).population).end)
      ? {
          populationEnd: Number(
            object(object(read.facts.evidence).population).end,
          ),
        }
      : {}),
  });
  if (
    subject.disposition !== "eligible" ||
    !subject.task ||
    !subject.evidenceHash
  )
    return finish(ctx, "current-evidence-unavailable", subject.reason, {
      checkedReport,
      currentEvidence: {
        appId: subject.appId,
        taskId: subject.taskId,
        disposition: subject.disposition,
        evidenceHash: subject.evidenceHash ?? null,
        reason: subject.reason,
      },
      handoffKey: null,
    });
  const currentAssessment =
    publication.assessmentPurpose === "ongoing"
      ? assessmentContext(subject, "ongoing")
      : null;
  const currentSubjectMatches =
    subject.evidenceHash === publication.evidenceHash &&
    (!currentAssessment ||
      (currentAssessment.rubricVersion === publication.rubricVersion &&
        currentAssessment.validityIdentity === publication.validityIdentity));
  if (!currentSubjectMatches)
    return finish(
      ctx,
      "stale",
      "The report remains an immutable judgment of its inspected snapshot. Current evidence changed and is returned for May's explicit relevance and value judgment; the report alone does not certify current health or authorize action.",
      {
        checkedReport,
        handoffKey: null,
        nextOwner: "app:may",
        nextAction:
          "Judge the historical finding's present relevance from the returned current evidence before any current-health claim or action.",
        currentEvidence: {
          appId: subject.appId,
          taskId: subject.taskId,
          disposition: subject.disposition,
          evidenceHash: subject.evidenceHash,
          reason: subject.reason,
          ...(currentAssessment
            ? {
                rubricVersion: currentAssessment.rubricVersion,
                validityIdentity: currentAssessment.validityIdentity,
                validity: currentAssessment.validity,
              }
            : {}),
        },
      },
    );

  let retained;
  try {
    retained = await readPriorIntake(ctx, linkedTaskReader);
  } catch (error) {
    return finish(ctx, "current-evidence-unavailable", String(error), {
      handoffKey: null,
      priorRead: "unavailable",
    });
  }
  const { prior, priorResult } = retained;
  // A terminal status is a lifecycle receipt, not proof that the evaluated
  // finding was recovered. Recovery remains an evidence-backed May judgment.
  // This intake only verifies report bytes and current subject identity.
  const recovered = false;
  const plan = planReportIntake({
    appId: publication.appId!,
    taskId: publication.taskId!,
    evidenceHash: publication.evidenceHash,
    jsonHash: publication.jsonHash,
    markdownHash: publication.markdownHash,
    ...(publication.assessmentPurpose === "ongoing"
      ? {
          assessmentIdentity: `${publication.rubricVersion ?? ""}\0${publication.validityIdentity ?? ""}`,
        }
      : {}),
    read: {
      status: "valid",
      jsonHash: read.jsonHash,
      markdownHash: read.markdownHash,
    },
    currentSubject: currentSubjectMatches ? "matches-report" : "changed",
    recovered,
    prior,
  });
  return finish(
    ctx,
    plan.disposition,
    plan.handoffKey
      ? `Stable investigation handoff ${plan.handoffKey}; this is preparation authority, not approval or application authority.`
      : "No candidate preparation or production application was authorized by this report.",
    {
      checkedReport,
      handoffKey:
        plan.handoffKey ??
        (plan.disposition === "reuse"
          ? (priorResult.handoffKey ?? null)
          : null),
      linkedTaskId: plan.linkedTaskId ?? null,
      priorRead: prior ? "read" : "absent",
      priorDisposition: prior?.disposition ?? null,
      currentEvidence: {
        appId: subject.appId,
        taskId: subject.taskId,
        disposition: subject.disposition,
        evidenceHash: subject.evidenceHash,
        reason: subject.reason,
        ...(currentAssessment
          ? {
              rubricVersion: currentAssessment.rubricVersion,
              validityIdentity: currentAssessment.validityIdentity,
              validity: currentAssessment.validity,
            }
          : {}),
      },
      recovered,
    },
  );
}
export async function execute(
  ctx: WorkflowContext<Input>,
): Promise<ExecutionResult> {
  return intakeEvaluationReport(ctx);
}
