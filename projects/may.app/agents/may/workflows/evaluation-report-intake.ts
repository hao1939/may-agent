import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";
import {
  readPublishedEvaluationReport,
  type PublishedReportRequest,
} from "../../../../evaluation.app/agents/evaluator/workflows/evaluation-report-reader.js";
import {
  readSubjectTask,
  type SubjectEvidence,
} from "../../../../evaluation.app/agents/evaluator/workflows/lib/public-task-evidence.js";
import { planReportIntake } from "../../../evaluation-report-intake.js";

export const name = "evaluation-report-intake";
export const description =
  "Integrity-check one published Evaluation report and reread its canonical current subject before planning a disposition.";

type Input = PublishedReportRequest;
type SubjectReader = (subject: {
  appId: string;
  taskId: string;
}) => Promise<SubjectEvidence>;
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function taskDetail(task: unknown): Record<string, unknown> {
  const envelope = object(task);
  return Object.keys(object(envelope.detail)).length
    ? object(envelope.detail)
    : envelope;
}
function finish(
  ctx: WorkflowContext<Input>,
  disposition: string,
  detail: string,
): ExecutionResult {
  const summary = `Evaluation report intake: ${disposition}. ${detail}`;
  return ctx.done(summary, {
    state:
      disposition === "current-evidence-unavailable"
        ? "incomplete"
        : "converged",
    summary,
    response: summary,
    facts: [`evaluation-intake:${disposition}`],
    actions: [],
  });
}

export async function intakeEvaluationReport(
  ctx: WorkflowContext<Input>,
  reportRoot?: string,
  subjectReader: SubjectReader = readSubjectTask,
): Promise<ExecutionResult> {
  const publication = ctx.input;
  if (!publication?.appId || !publication.taskId)
    return ctx.blocked(
      "Evaluation report intake requires exact publication identity",
    );
  const read = readPublishedEvaluationReport(publication, reportRoot);
  if (read.status === "publication-pending")
    return finish(
      ctx,
      "retry-publication",
      "The accepted publication marker is not durable yet.",
    );
  if (read.status === "invalid") return finish(ctx, "invalid", read.reason);

  // This is Evaluation's allowlisted public control-plane reader. It verifies
  // App/Task identities and computes the same canonical evidence hash used by
  // task-outcome publication; it is not private or invented cross-App access.
  const subject = await subjectReader({
    appId: publication.appId,
    taskId: publication.taskId,
  });
  if (
    subject.disposition !== "eligible" ||
    !subject.task ||
    !subject.evidenceHash
  )
    return finish(ctx, "current-evidence-unavailable", subject.reason);
  const snapshot = taskDetail(read.facts.evidence);
  const current = taskDetail(subject.task);
  const recovered = snapshot.status !== "done" && current.status === "done";
  const plan = planReportIntake({
    appId: publication.appId,
    taskId: publication.taskId,
    evidenceHash: publication.evidenceHash,
    jsonHash: publication.jsonHash,
    markdownHash: publication.markdownHash,
    read: {
      status: "valid",
      jsonHash: read.jsonHash,
      markdownHash: read.markdownHash,
    },
    currentSubject:
      subject.evidenceHash === publication.evidenceHash
        ? "matches-report"
        : "changed",
    recovered,
  });
  return finish(
    ctx,
    plan.disposition,
    plan.handoffKey
      ? `Stable investigation handoff ${plan.handoffKey}; this is preparation authority, not approval or application authority.`
      : "No candidate preparation or production application was authorized by this report.",
  );
}
export async function execute(
  ctx: WorkflowContext<Input>,
): Promise<ExecutionResult> {
  return intakeEvaluationReport(ctx);
}
