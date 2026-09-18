import { describe, expect, test } from "bun:test";
import { appendFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import {
  readEvaluationReports,
  readPublishedEvaluationReport,
} from "./evaluation-report-reader.ts";
import {
  hashReport,
  markTaskReportPublished,
  renderTaskReportMarkdown,
  resolveTaskReportPath,
  taskReportPaths,
  writeImmutable,
} from "./lib/task-report-store.ts";

function publishFixture(
  root: string,
  summary = "report",
  taskId = "goal/one",
  createdAt = 1,
): ReturnType<typeof taskReportPaths> {
  const paths = taskReportPaths("may", taskId, "abc");
  const payload = {
    version: 1,
    rubricVersion: "task-outcome-v2",
    sourceRevision: "test",
    disposition: "assessed",
    createdAt,
    subject: { appId: "may", taskId, evidenceHash: "abc" },
    evidence: {},
    evaluator: { executionId: "s_1", cost: "unknown" },
    judgment: {
      disposition: "assessed",
      summary,
      responsibility: "May owned the outcome.",
      findings: [],
      verification: ["fixture"],
      delivery: "verified",
    },
  };
  const json = resolveTaskReportPath(root, paths.jsonPath);
  const markdown = resolveTaskReportPath(root, paths.markdownPath);
  writeImmutable(json, `${JSON.stringify(payload, null, 2)}\n`);
  writeImmutable(markdown, renderTaskReportMarkdown(payload)!);
  markTaskReportPublished(root, {
    appId: "may",
    taskId,
    evidenceHash: "abc",
    executionId: "s_1",
    jsonPath: paths.jsonPath,
    markdownPath: paths.markdownPath,
    jsonSha256: hashReport(json),
    markdownSha256: hashReport(markdown),
  });
  return paths;
}

describe("evaluation report reader", () => {
  test("keeps legacy outcome Markdown stable and rejects purpose/rubric mismatches both ways", () => {
    const legacy = {
      version: 1,
      rubricVersion: "task-outcome-v2",
      sourceRevision: "test",
      disposition: "assessed",
      createdAt: 1,
      subject: { appId: "may", taskId: "goal/one", evidenceHash: "abc" },
      evidence: {},
      evaluator: { executionId: "s_1", cost: "unknown" },
      judgment: {
        disposition: "assessed",
        summary: "report",
        responsibility: "May owned the outcome.",
        findings: [],
        verification: ["fixture"],
        delivery: "verified",
      },
    };
    const legacyMarkdown = renderTaskReportMarkdown(legacy);
    expect(legacyMarkdown).toContain("- Rubric: `task-outcome-v2`");
    expect(legacyMarkdown).not.toContain("- Purpose:");

    const ongoing = {
      ...legacy,
      rubricVersion: "task-obligation-v1",
      assessment: {
        purpose: "ongoing",
        validityIdentity: "condition-boundaries:none",
        validity: { phase: "unknown", dueAt: null, boundaries: [] },
      },
    };
    const ongoingMarkdown = renderTaskReportMarkdown(ongoing);
    expect(ongoingMarkdown).toContain("- Due boundary: `unavailable`");
    expect(ongoingMarkdown).not.toContain("- Due boundary: `1970-01-01");
    expect(
      renderTaskReportMarkdown({
        ...ongoing,
        rubricVersion: "task-outcome-v2",
      }),
    ).toBeNull();
    expect(
      renderTaskReportMarkdown({
        ...ongoing,
        assessment: { ...ongoing.assessment, purpose: "outcome" },
      }),
    ).toBeNull();
  });

  test("integrity-checks an ongoing publication using its complete report identity", () => {
    const root = mkdtempSync(join(tmpdir(), "report-reader-ongoing-"));
    const validityIdentity = "condition-boundaries:abc";
    const paths = taskReportPaths(
      "may",
      "goal/ongoing",
      "def",
      "task-obligation-v1",
      validityIdentity,
    );
    const payload = {
      version: 1,
      rubricVersion: "task-obligation-v1",
      sourceRevision: "test",
      disposition: "assessed",
      createdAt: 1,
      subject: {
        appId: "may",
        taskId: "goal/ongoing",
        evidenceHash: "def",
      },
      evidence: {},
      assessment: {
        purpose: "ongoing",
        validityIdentity,
        validity: { phase: "unknown", dueAt: null, boundaries: [] },
      },
      evaluator: { executionId: "s_ongoing", cost: "unknown" },
      judgment: {
        disposition: "assessed",
        summary: "ongoing report",
        responsibility: "May owns the obligation.",
        findings: [],
        verification: [],
        delivery: "pending",
      },
    };
    const json = resolveTaskReportPath(root, paths.jsonPath);
    const markdown = resolveTaskReportPath(root, paths.markdownPath);
    writeImmutable(json, `${JSON.stringify(payload, null, 2)}\n`);
    writeImmutable(markdown, renderTaskReportMarkdown(payload)!);
    markTaskReportPublished(root, {
      appId: "may",
      taskId: "goal/ongoing",
      evidenceHash: "def",
      executionId: "s_ongoing",
      rubricVersion: "task-obligation-v1",
      validityIdentity,
      jsonPath: paths.jsonPath,
      markdownPath: paths.markdownPath,
      jsonSha256: hashReport(json),
      markdownSha256: hashReport(markdown),
    });
    const publication = {
      appId: "may",
      taskId: "goal/ongoing",
      evidenceHash: "def",
      executionId: "s_ongoing",
      assessmentPurpose: "ongoing" as const,
      rubricVersion: "task-obligation-v1",
      validityIdentity,
      facts: paths.jsonPath,
      report: paths.markdownPath,
      jsonHash: hashReport(json),
      markdownHash: hashReport(markdown),
    };
    expect(readPublishedEvaluationReport(publication, root).status).toBe(
      "valid",
    );
    expect(
      readPublishedEvaluationReport(
        { ...publication, assessmentPurpose: "outcome" },
        root,
      ).status,
    ).toBe("invalid");
  });

  test("reads an exact older publication after it falls outside the latest 100 reports", async () => {
    const root = mkdtempSync(join(tmpdir(), "report-reader-history-"));
    const paths = publishFixture(root, "older report", "goal/older");
    for (let index = 0; index < 101; index++)
      publishFixture(root, "newer", `goal/newer-${index}`, index + 2);
    const publication = {
      appId: "may",
      taskId: "goal/older",
      evidenceHash: "abc",
      executionId: "s_1",
      facts: paths.jsonPath,
      report: paths.markdownPath,
      jsonHash: hashReport(resolveTaskReportPath(root, paths.jsonPath)),
      markdownHash: hashReport(resolveTaskReportPath(root, paths.markdownPath)),
    };
    expect(readPublishedEvaluationReport(publication, root).status).toBe(
      "valid",
    );
    const read = await readEvaluationReports(
      createTestAppWorkflowContext({
        input: { operation: "read", path: paths.markdownPath },
      }),
      root,
    );
    expect(
      (read.output as { result: { content: string } }).result.content,
    ).toContain("older report");
    expect(
      readPublishedEvaluationReport(
        { ...publication, executionId: "different" },
        root,
      ).status,
    ).toBe("invalid");
  });

  test("lists and reads accepted immutable report pairs without an evaluator call", async () => {
    const root = mkdtempSync(join(tmpdir(), "report-reader-"));
    const paths = publishFixture(root);
    const listed = await readEvaluationReports(
      createTestAppWorkflowContext({
        input: { operation: "list", limit: 5 },
        callAgent: async () => {
          throw new Error("must not call");
        },
      }),
      root,
    );
    const reports = (
      listed.output as { result: { reports: Record<string, unknown>[] } }
    ).result.reports;
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      coverage: "bounded-single-task-snapshot",
      markdownSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(Buffer.byteLength(JSON.stringify(listed.output))).toBeLessThan(
      16_384,
    );
    const read = await readEvaluationReports(
      createTestAppWorkflowContext({
        input: { operation: "read", path: paths.markdownPath },
      }),
      root,
    );
    expect(
      (read.output as { result: { content: string } }).result.content,
    ).toContain("## Summary\n\nreport");
  });

  test("omits published pairs whose deterministic JSON or Markdown bytes were tampered", async () => {
    for (const target of ["jsonPath", "markdownPath"] as const) {
      const root = mkdtempSync(
        join(tmpdir(), `report-reader-tamper-${target}-`),
      );
      const paths = publishFixture(root);
      appendFileSync(resolveTaskReportPath(root, paths[target]), "tampered");
      const listed = await readEvaluationReports(
        createTestAppWorkflowContext({ input: { operation: "list" } }),
        root,
      );
      expect(
        (listed.output as { result: { reports: unknown[] } }).result.reports,
      ).toEqual([]);
    }
  });

  test("returns a bounded preview and continuation for a published report over the Task result budget", async () => {
    const root = mkdtempSync(join(tmpdir(), "report-reader-large-"));
    const paths = publishFixture(root, "x".repeat(20_000));
    const result = await readEvaluationReports(
      createTestAppWorkflowContext({
        input: { operation: "read", path: paths.markdownPath },
      }),
      root,
    );
    const payload = (
      result.output as {
        result: {
          content: string;
          truncated: boolean;
          continuation: unknown;
          bytes: number;
        };
      }
    ).result;
    expect(payload.content.length).toBeGreaterThan(7_000);
    expect(payload.content.length).toBeLessThanOrEqual(8_000);
    expect(payload.truncated).toBeTrue();
    expect(payload.continuation).not.toBeNull();
    expect(payload.bytes).toBeGreaterThan(20_000);
    expect(Buffer.byteLength(JSON.stringify(result.output))).toBeLessThan(
      16_384,
    );
  });

  test("rejects paths outside the configured root and unpublished staged files", async () => {
    const root = mkdtempSync(join(tmpdir(), "report-reader-safe-"));
    const outside = await readEvaluationReports(
      createTestAppWorkflowContext({
        input: { operation: "read", path: "../secret" },
      }),
      root,
    );
    expect(outside.status).toBe("blocked");

    const paths = taskReportPaths("may", "goal/staged", "def");
    writeImmutable(resolveTaskReportPath(root, paths.markdownPath), "staged");
    const staged = await readEvaluationReports(
      createTestAppWorkflowContext({
        input: { operation: "read", path: paths.markdownPath },
      }),
      root,
    );
    expect(staged.status).toBe("blocked");
  });
});
