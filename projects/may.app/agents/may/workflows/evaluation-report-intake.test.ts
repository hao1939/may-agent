import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createTestAppRead,
  createTestAppWorkflowContext,
} from "@may-agent/sdk/testing";
import { intakeEvaluationReport } from "./evaluation-report-intake";
import {
  hashReport,
  markTaskReportPublished,
  renderTaskReportMarkdown,
  resolveTaskReportPath,
  taskReportPaths,
  writeImmutable,
} from "../../../../evaluation.app/agents/evaluator/workflows/lib/task-report-store";
import { assessmentContext } from "../../../../evaluation.app/agents/evaluator/workflows/lib/task-assessment-context";

function fixture(
  appId = "may",
  ongoing = false,
  assessmentNow?: number,
  freshness?: "current" | "stale" | "unavailable",
) {
  const root = mkdtempSync(join(tmpdir(), "may-report-intake-"));
  const detail = {
    appId,
    taskId: "goal/one",
    generation: 3,
    status: "running",
    result: null,
    diagnostics: {
      conditions: ongoing
        ? [
            {
              id: "review",
              condition: {
                spec: { reviewAfterMs: 60_000 },
                status: {
                  state: "false",
                  observedAt: "2026-09-18T12:00:00.000Z",
                },
              },
            },
          ]
        : [],
    },
  };
  const subjectTask = { appTask: { id: detail.taskId, generation: 3 }, detail };
  const subject = {
    disposition: "eligible" as const,
    reason: "verified",
    appId,
    taskId: detail.taskId,
    evidenceHash: "evidence-1",
    task: subjectTask,
  };
  const ongoingAssessment = ongoing
    ? assessmentContext(subject, "ongoing", assessmentNow)
    : null;
  const validityIdentity = ongoingAssessment?.validityIdentity ?? "";
  const rubricVersion = ongoing ? "task-obligation-v1" : "task-outcome-v2";
  const paths = taskReportPaths(
    appId,
    detail.taskId,
    "evidence-1",
    rubricVersion,
    validityIdentity,
  );
  const payload = {
    version: 1,
    rubricVersion,
    sourceRevision: "fixture",
    disposition: "assessed",
    createdAt: 1,
    subject: { appId, taskId: detail.taskId, evidenceHash: "evidence-1" },
    ...(freshness
      ? {
          snapshot: {
            generation: detail.generation,
            evidenceHash: "evidence-1",
            validityIdentity,
          },
          freshness: {
            status: freshness,
            checkedAt: 1,
            currentEvidenceHash:
              freshness === "current" ? "evidence-1" : "evidence-2",
          },
        }
      : {}),
    evidence: subjectTask,
    evaluator: { executionId: "s_eval", cost: "unknown" },
    ...(ongoing
      ? {
          assessment: {
            purpose: "ongoing",
            validityIdentity,
            validity: ongoingAssessment!.validity,
          },
        }
      : {}),
    judgment: {
      disposition: "assessed",
      summary: "finding",
      responsibility: "subject owner",
      findings: [],
      verification: [],
      delivery: "published",
    },
  };
  const facts = resolveTaskReportPath(root, paths.jsonPath);
  const report = resolveTaskReportPath(root, paths.markdownPath);
  writeImmutable(facts, `${JSON.stringify(payload, null, 2)}\n`);
  writeImmutable(report, renderTaskReportMarkdown(payload)!);
  const publication = {
    appId,
    taskId: detail.taskId,
    evidenceHash: "evidence-1",
    executionId: "s_eval",
    report: paths.markdownPath,
    facts: paths.jsonPath,
    jsonHash: hashReport(facts),
    markdownHash: hashReport(report),
    ...(ongoing
      ? {
          assessmentPurpose: "ongoing" as const,
          rubricVersion,
          validityIdentity,
        }
      : {}),
  };
  markTaskReportPublished(root, {
    appId,
    taskId: detail.taskId,
    evidenceHash: publication.evidenceHash,
    executionId: publication.executionId,
    ...(ongoing ? { rubricVersion, validityIdentity } : {}),
    jsonPath: publication.facts,
    markdownPath: publication.report,
    jsonSha256: publication.jsonHash,
    markdownSha256: publication.markdownHash,
  });
  return { root, detail, subjectTask, publication };
}
function context(data: ReturnType<typeof fixture>) {
  return createTestAppWorkflowContext({ input: data.publication });
}
function reader(data: ReturnType<typeof fixture>, evidenceHash = "evidence-1") {
  return async () => ({
    disposition: "eligible" as const,
    reason: "verified",
    appId: data.publication.appId,
    taskId: data.publication.taskId,
    evidenceHash,
    task: data.subjectTask,
  });
}

describe("May Evaluation report intake procedure", () => {
  test("preserves ongoing assessment identity through integrity read and handoff", async () => {
    const data = fixture("may", true);
    const validityIdentity = data.publication.validityIdentity!;
    const execution = await intakeEvaluationReport(
      context(data),
      data.root,
      reader(data),
    );
    const output = (execution.output as any).result;
    expect(output).toMatchObject({
      disposition: "investigate",
      publication: {
        assessmentPurpose: "ongoing",
        rubricVersion: "task-obligation-v1",
        validityIdentity,
      },
      report: {
        assessmentPurpose: "ongoing",
        rubricVersion: "task-obligation-v1",
        validityIdentity,
      },
    });
    const legacy = fixture();
    const legacyResult = await intakeEvaluationReport(
      context(legacy),
      legacy.root,
      reader(legacy),
    );
    expect(output.handoffKey).not.toBe(
      (legacyResult.output as any).result.handoffKey,
    );
  });

  test("marks a crossed ongoing boundary stale without creating another investigation", async () => {
    const beforeDue = Date.parse("2026-09-18T12:00:30.000Z");
    const data = fixture("may", true, beforeDue);
    const execution = await intakeEvaluationReport(
      context(data),
      data.root,
      reader(data),
    );
    const output = (execution.output as any).result;
    expect(output).toMatchObject({
      disposition: "stale",
      handoffKey: null,
      currentEvidence: {
        evidenceHash: data.publication.evidenceHash,
        rubricVersion: "task-obligation-v1",
        validity: { phase: "due" },
      },
    });
    expect(output.currentEvidence.validityIdentity).not.toBe(
      data.publication.validityIdentity,
    );
  });

  test("uses the fresh canonical read when an unavailable-at-publication snapshot is current again", async () => {
    const data = fixture("may", false, undefined, "unavailable");
    const execution = await intakeEvaluationReport(
      context(data),
      data.root,
      reader(data),
    );
    expect(execution.output as any).toMatchObject({
      state: "converged",
      result: {
        disposition: "investigate",
        currentEvidence: { evidenceHash: "evidence-1" },
      },
    });
  });

  test("uses the integrity reader and canonical current subject before producing a stable investigation", async () => {
    const data = fixture();
    const execution = await intakeEvaluationReport(
      context(data),
      data.root,
      reader(data),
    );
    const output = execution.output as {
      summary: string;
      result: Record<string, any>;
      facts: string[];
    };
    expect(output.summary).toContain("investigate");
    expect(output.result).toMatchObject({
      stage: "evaluation-report-intake",
      disposition: "investigate",
      publication: data.publication,
      currentEvidence: {
        appId: "may",
        taskId: "goal/one",
        evidenceHash: "evidence-1",
      },
      report: { facts: data.publication.facts },
    });
    expect(output.result.handoffKey).toMatch(/^[a-f0-9]{64}$/);
    expect(output.facts).toContain(
      `evaluation-report:${data.publication.facts}`,
    );
  });

  test("reuses the accepted intake and exact linked owner through ordinary Task reads", async () => {
    const data = fixture();
    const first = await intakeEvaluationReport(
      context(data),
      data.root,
      reader(data),
    );
    const saved = (first.output as any).result;
    saved.linkedTaskId = "goal/repair";
    const executionOriginRepair = {
      stage: "owner-failure-disposition",
      source: {
        kind: "execution-failure",
        appId: "may",
        taskId: "goal/original",
        attemptId: "r_1_fixture",
        operationId: "op_fixture",
        executionId: "s_fixture",
      },
      disposition: "repair-linked",
      currentImpact: "The original outcome remains blocked.",
      nextStep:
        "Review the isolated candidate; live adoption is still pending.",
    };
    const reads: string[] = [];
    const ctx = createTestAppWorkflowContext({
      input: data.publication,
      reconciliation: {
        appId: "may",
        taskId: "intake/one",
        generation: 1,
        resourceVersion: 1,
        attemptId: "retry",
        outcome: "Read report",
        acceptance: [],
        input: data.publication,
        children: { live: [], completed: [] },
        events: { items: [] },
      } as any,
      read: createTestAppRead({
        tasks: {
          get: async (id) => {
            reads.push(id);
            return {
              id,
              result: id === "intake/one" ? saved : executionOriginRepair,
            } as any;
          },
        },
      }),
    });
    const reused = await intakeEvaluationReport(ctx, data.root, reader(data));
    expect((reused.output as any).result).toMatchObject({
      disposition: "reuse",
      linkedTaskId: "goal/repair",
      handoffKey: saved.handoffKey,
      recovered: false,
      priorRead: "read",
    });
    expect(reads).toEqual(["intake/one", "goal/repair"]);
    saved.publication = { ...data.publication, jsonHash: "different" };
    const changed = await intakeEvaluationReport(ctx, data.root, reader(data));
    expect((changed.output as any).result).toMatchObject({
      disposition: "investigate",
      linkedTaskId: null,
      priorRead: "absent",
    });
  });

  test("missing prior owner stays unresolved rather than creating replacement work", async () => {
    const data = fixture();
    const ctx = createTestAppWorkflowContext({
      input: data.publication,
      reconciliation: { taskId: "intake/one" } as any,
      read: createTestAppRead({
        tasks: {
          get: async (id) =>
            id === "intake/one"
              ? ({
                  id,
                  result: {
                    stage: "evaluation-report-intake",
                    disposition: "investigate",
                    publication: data.publication,
                    linkedTaskId: "missing",
                  },
                } as any)
              : null,
        },
      }),
    });
    const result = await intakeEvaluationReport(ctx, data.root, reader(data));
    expect(result.output as any).toMatchObject({
      state: "incomplete",
      result: {
        disposition: "current-evidence-unavailable",
        handoffKey: null,
        priorRead: "unavailable",
      },
    });
  });

  test("accepted no-change reuses this Task without creating a tracking Task", async () => {
    const data = fixture();
    const ctx = createTestAppWorkflowContext({
      input: data.publication,
      reconciliation: { taskId: "intake/one" } as any,
      read: createTestAppRead({
        tasks: {
          get: async (id) =>
            ({
              id,
              result: {
                stage: "evaluation-report-intake",
                disposition: "no-change",
                publication: data.publication,
              },
            }) as any,
        },
      }),
    });
    const result = await intakeEvaluationReport(ctx, data.root, reader(data));
    expect((result.output as any).result).toMatchObject({
      disposition: "reuse",
      handoffKey: null,
      linkedTaskId: null,
      priorDisposition: "no-change",
    });
    expect((result.output as any).actions).toEqual([]);
  });

  test("keeps a publication race retryable without reading staged bytes", async () => {
    const data = fixture();
    const pendingRoot = mkdtempSync(join(tmpdir(), "may-report-pending-"));
    let subjectReads = 0;
    const execution = await intakeEvaluationReport(
      context(data),
      pendingRoot,
      async () => {
        subjectReads++;
        return reader(data)();
      },
    );
    const output = execution.output as {
      state: string;
      result: Record<string, unknown>;
    };
    expect(output.state).toBe("incomplete");
    expect(output.result).toMatchObject({
      disposition: "retry-publication",
      handoffKey: null,
      currentEvidence: null,
    });
    expect(subjectReads).toBe(0);
  });

  test("uses Evaluation's public identity-checked reader for a Scout subject", async () => {
    const data = fixture("scout");
    let reads = 0;
    const execution = await intakeEvaluationReport(
      context(data),
      data.root,
      async (subject) => {
        reads++;
        expect(subject).toEqual({ appId: "scout", taskId: "goal/one" });
        return reader(data)();
      },
    );
    expect((execution.output as { summary: string }).summary).toContain(
      "investigate",
    );
    expect(reads).toBe(1);
  });

  test("does not treat a terminal status as proof of recovery", async () => {
    const data = fixture();
    data.detail.status = "done";
    const execution = await intakeEvaluationReport(
      context(data),
      data.root,
      reader(data),
    );
    const output = execution.output as { result: Record<string, unknown> };
    expect(output.result).toMatchObject({
      disposition: "investigate",
      recovered: false,
    });
  });

  test("treats a changed canonical evidence hash as stale before candidate preparation", async () => {
    const data = fixture();
    data.detail.status = "done";
    const execution = await intakeEvaluationReport(
      context(data),
      data.root,
      reader(data, "evidence-2"),
    );
    expect((execution.output as { summary: string }).summary).toContain(
      "stale",
    );
  });
});
