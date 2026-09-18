import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import { intakeEvaluationReport } from "./evaluation-report-intake";
import {
  hashReport,
  markTaskReportPublished,
  renderTaskReportMarkdown,
  resolveTaskReportPath,
  taskReportPaths,
  writeImmutable,
} from "../../../../evaluation.app/agents/evaluator/workflows/lib/task-report-store";

function fixture(appId = "may") {
  const root = mkdtempSync(join(tmpdir(), "may-report-intake-"));
  const detail = {
    appId,
    taskId: "goal/one",
    generation: 3,
    status: "running",
    result: null,
  };
  const subjectTask = { appTask: { id: detail.taskId, generation: 3 }, detail };
  const paths = taskReportPaths(appId, detail.taskId, "evidence-1");
  const payload = {
    version: 1,
    rubricVersion: "task-outcome-v2",
    sourceRevision: "fixture",
    disposition: "assessed",
    createdAt: 1,
    subject: { appId, taskId: detail.taskId, evidenceHash: "evidence-1" },
    evidence: subjectTask,
    evaluator: { executionId: "s_eval", cost: "unknown" },
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
  };
  markTaskReportPublished(root, {
    appId,
    taskId: detail.taskId,
    evidenceHash: publication.evidenceHash,
    executionId: publication.executionId,
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
