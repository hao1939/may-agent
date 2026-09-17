import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";
import { Type } from "typebox";
import {
  readSubjectTask,
  type PublicCommand,
  type SubjectEvidence,
} from "./lib/public-task-evidence.js";
import { taskEmissionKey } from "./lib/task-emission.js";

export const name = "task-outcome-review";
export const description =
  "Review one canonically identified external App Task and publish an immutable evidence report.";

const resultSchema = Type.Object(
  {
    summary: Type.String({ minLength: 1 }),
    findings: Type.Array(Type.String({ minLength: 1 }), { maxItems: 12 }),
    verification: Type.Array(Type.String({ minLength: 1 }), { maxItems: 12 }),
    delivery: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

type Input = { appId?: string; taskId?: string };
type Judgment = {
  summary: string;
  findings: string[];
  verification: string[];
  delivery: string;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function safe(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 120);
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}
function hashFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function reportPaths(appId: string, taskId: string, evidenceHash: string) {
  const base = join(
    "reports",
    "task-outcomes",
    safe(appId),
    `${safe(taskId)}-${evidenceHash.slice(0, 16)}`,
  );
  return { jsonPath: `${base}.json`, markdownPath: `${base}.md` };
}

function resultFacts(
  appId: string,
  taskId: string,
  evidenceHash: string,
  jsonPath: string,
  markdownPath: string,
  executionId: string,
): string[] {
  return [
    "review-disposition:assessed",
    `subject:${appId}/${taskId}`,
    `evidence-hash:${evidenceHash}`,
    `report:${markdownPath}`,
    `report-facts:${jsonPath}`,
    `execution:${executionId}`,
  ];
}

function parsedJudgment(value: unknown): Judgment | null {
  const item = object(value);
  const summary = text(item.summary);
  const findings = strings(item.findings).slice(0, 12);
  const verification = strings(item.verification).slice(0, 12);
  const delivery = text(item.delivery);
  return summary && delivery
    ? { summary, findings, verification, delivery }
    : null;
}

async function acceptedFacts(ctx: WorkflowContext<Input>): Promise<string[]> {
  const taskId = ctx.reconciliation?.taskId;
  if (!taskId) return [];
  try {
    const response = object(await ctx.read.tasks.get(taskId));
    const current = Object.keys(object(response.task)).length
      ? object(response.task)
      : response;
    return strings(current.facts ?? object(current.result).facts);
  } catch {
    return [];
  }
}

function acceptedReport(
  facts: string[],
  subject: SubjectEvidence,
  workspaceRoot: string,
): { jsonPath: string; markdownPath: string; executionId: string } | null {
  const evidenceHash = subject.evidenceHash!;
  if (!facts.includes(`evidence-hash:${evidenceHash}`)) return null;
  const expected = reportPaths(subject.appId, subject.taskId, evidenceHash);
  const jsonPath = facts
    .find((fact) => fact.startsWith("report-facts:"))
    ?.slice(13);
  const markdownPath = facts
    .find((fact) => fact.startsWith("report:"))
    ?.slice(7);
  const executionId = facts
    .find((fact) => fact.startsWith("execution:"))
    ?.slice(10);
  if (
    jsonPath !== expected.jsonPath ||
    markdownPath !== expected.markdownPath ||
    !executionId
  ) {
    return null;
  }
  const staged = readStagedReport(workspaceRoot, subject);
  return staged && staged.executionId === executionId
    ? { jsonPath, markdownPath, executionId }
    : null;
}

function readStagedReport(
  root: string,
  subject: SubjectEvidence,
): {
  judgment: Judgment;
  jsonPath: string;
  markdownPath: string;
  executionId: string;
} | null {
  const paths = reportPaths(
    subject.appId,
    subject.taskId,
    subject.evidenceHash!,
  );
  const json = join(root, paths.jsonPath);
  const markdown = join(root, paths.markdownPath);
  if (!existsSync(json) || !existsSync(markdown)) return null;
  try {
    const payload = object(JSON.parse(readFileSync(json, "utf8")));
    const identity = object(payload.subject);
    const evaluator = object(payload.evaluator);
    const judgment = parsedJudgment(payload.judgment);
    if (
      text(identity.appId) !== subject.appId ||
      text(identity.taskId) !== subject.taskId ||
      text(identity.evidenceHash) !== subject.evidenceHash ||
      !judgment ||
      !text(evaluator.executionId)
    ) {
      return null;
    }
    return {
      judgment,
      ...paths,
      executionId: text(evaluator.executionId),
    };
  } catch {
    return null;
  }
}

async function publish(
  ctx: WorkflowContext<Input>,
  subject: SubjectEvidence,
  report: { jsonPath: string; markdownPath: string; executionId: string },
): Promise<void> {
  const root = ctx.workspace!.root;
  await ctx.events.emit({
    type: "evaluation.task_report_published",
    localKey: taskEmissionKey(
      ctx,
      `task-report-${subject.evidenceHash!.slice(0, 16)}`,
    ),
    data: {
      appId: subject.appId,
      taskId: subject.taskId,
      evidenceHash: subject.evidenceHash,
      executionId: report.executionId,
      report: report.markdownPath,
      facts: report.jsonPath,
      jsonHash: hashFile(join(root, report.jsonPath)),
      markdownHash: hashFile(join(root, report.markdownPath)),
    },
    target: { appId: "evaluation" },
  });
}

function done(
  ctx: WorkflowContext<Input>,
  summary: string,
  facts: string[],
): ExecutionResult {
  return ctx.done(summary, {
    state: "converged",
    summary,
    response: summary,
    facts,
    actions: [],
  });
}

export async function reviewTaskOutcome(
  ctx: WorkflowContext<Input>,
  command?: PublicCommand,
): Promise<ExecutionResult> {
  const appId = text(ctx.input?.appId);
  const taskId = text(ctx.input?.taskId);
  const subject = await readSubjectTask({ appId, taskId }, command);
  if (subject.disposition !== "eligible") {
    const summary = `${subject.disposition}: ${subject.reason}`;
    return done(ctx, summary, [
      `review-disposition:${subject.disposition}`,
      `subject:${appId}/${taskId}`,
    ]);
  }
  if (!ctx.workspace?.root)
    return ctx.blocked(
      "task-outcome-review requires an allocated App workspace",
    );

  const paths = reportPaths(appId, taskId, subject.evidenceHash!);
  const prior = acceptedReport(
    await acceptedFacts(ctx),
    subject,
    ctx.workspace.root,
  );
  if (prior) {
    return done(
      ctx,
      `Reused accepted evaluation for unchanged ${appId}/${taskId}.`,
      resultFacts(
        appId,
        taskId,
        subject.evidenceHash!,
        prior.jsonPath,
        prior.markdownPath,
        prior.executionId,
      ),
    );
  }

  // Files are written before publication. Their content identity lets a retry
  // republish after a rejected/failed event without spending another model call.
  const staged = readStagedReport(ctx.workspace.root, subject);
  if (staged) {
    await publish(ctx, subject, staged);
    return done(
      ctx,
      staged.judgment.summary,
      resultFacts(
        appId,
        taskId,
        subject.evidenceHash!,
        staged.jsonPath,
        staged.markdownPath,
        staged.executionId,
      ),
    );
  }

  const execution = await ctx.agents.call(
    "evaluator",
    [
      "Evaluate the requested outcome represented by this exact public Task snapshot.",
      "Judge requested value, delegation, follow-up, recovery, verification, and delivery. A failed intermediate attempt may precede a good recovery; operator-assisted delivery must be credited accurately.",
      "Do not treat missing evidence as target failure or healthy coverage. Return only the requested structured result.",
      JSON.stringify({
        subject: { appId, taskId, evidenceHash: subject.evidenceHash },
        task: subject.task,
      }),
    ].join("\n\n"),
    { schema: resultSchema },
  );
  if (execution.status !== "done") {
    const summary = `evaluator-failed: ${execution.id} ended ${execution.status}`;
    return done(ctx, summary, [
      "review-disposition:evaluator-failed",
      `subject:${appId}/${taskId}`,
      `execution:${execution.id}`,
    ]);
  }
  const judgment = parsedJudgment(execution.output);
  if (!judgment)
    return ctx.blocked("Evaluator returned an invalid task-outcome judgment.", [
      `execution:${execution.id}`,
    ]);

  const current = await readSubjectTask({ appId, taskId }, command);
  if (
    current.disposition !== "eligible" ||
    current.evidenceHash !== subject.evidenceHash
  ) {
    return done(
      ctx,
      `inconclusive: ${appId}/${taskId} changed while it was being evaluated; no report was published.`,
      [
        "review-disposition:insufficient-evidence",
        `subject:${appId}/${taskId}`,
        `stale-evidence-hash:${subject.evidenceHash}`,
        `execution:${execution.id}`,
      ],
    );
  }

  const payload = {
    version: 1,
    disposition: "assessed",
    subject: { appId, taskId, evidenceHash: subject.evidenceHash },
    evaluator: { executionId: execution.id, cost: "unknown" },
    judgment,
  };
  const absoluteJson = join(ctx.workspace.root, paths.jsonPath);
  const absoluteMarkdown = join(ctx.workspace.root, paths.markdownPath);
  mkdirSync(dirname(absoluteJson), { recursive: true });
  const writeIdentity = `${ctx.reconciliation?.generation ?? 0}-${ctx.reconciliation?.resourceVersion ?? 0}`;
  const temporaryJson = `${absoluteJson}.${writeIdentity}.tmp`;
  const temporaryMarkdown = `${absoluteMarkdown}.${writeIdentity}.tmp`;
  writeFileSync(temporaryJson, `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(
    temporaryMarkdown,
    `# Evaluation report\n\n- Subject: \`${appId}/${taskId}\`\n- Evidence: \`${subject.evidenceHash}\`\n- Evaluator execution: \`${execution.id}\`\n- Cost: unknown\n\n## Summary\n\n${judgment.summary}\n\n## Findings\n\n${judgment.findings.map((item) => `- ${item}`).join("\n") || "- None."}\n\n## Verification and delivery\n\n${judgment.verification.map((item) => `- ${item}`).join("\n") || "- No verification cited."}\n- Delivery: ${judgment.delivery}\n`,
  );
  renameSync(temporaryJson, absoluteJson);
  renameSync(temporaryMarkdown, absoluteMarkdown);
  const report = {
    ...paths,
    executionId: execution.id,
  };
  // Read-back validates subject identity and complete judgment before the event
  // becomes the publication checkpoint.
  if (!readStagedReport(ctx.workspace.root, current)) {
    return ctx.blocked(
      "Written task-outcome report failed identity read-back.",
      [`execution:${execution.id}`],
    );
  }
  await publish(ctx, current, report);
  return done(
    ctx,
    judgment.summary,
    resultFacts(
      appId,
      taskId,
      subject.evidenceHash!,
      paths.jsonPath,
      paths.markdownPath,
      execution.id,
    ),
  );
}

export async function execute(
  ctx: WorkflowContext<Input>,
): Promise<ExecutionResult> {
  return reviewTaskOutcome(ctx);
}
