import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCodexLearningIntake } from "./codex-learning-intake";
import { canonicalGymTestContext } from "./lib/test-context";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function task(input: Record<string, unknown> = {}): string {
  return `## Reconciliation Task\n\n\`\`\`json\n${JSON.stringify({
    taskId: "learning/codex-sessions",
    generation: 1,
    input,
  })}\n\`\`\``;
}

function source(root: string): string {
  const codexHome = join(root, ".codex");
  const sessionId = "session-1";
  const sessionDir = join(codexHome, "sessions", "2026", "07", "27");
  mkdirSync(sessionDir, { recursive: true });
  writeFileSync(
    join(codexHome, "history.jsonl"),
    `${JSON.stringify({
      session_id: sessionId,
      ts: 1_785_000_000,
      text: "private raw preference wording",
    })}\n`,
  );
  writeFileSync(
    join(sessionDir, `rollout-${sessionId}.jsonl`),
    [
      {
        type: "response_item",
        payload: {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "A prior proposal" }],
        },
      },
      {
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: "private raw preference wording" },
          ],
        },
      },
    ]
      .map((row) => JSON.stringify(row))
      .join("\n") + "\n",
  );
  return codexHome;
}

test("keeps only validated strong signals and persists source references without raw turns", async () => {
  const root = mkdtempSync(join(tmpdir(), "codex-learning-intake-"));
  roots.push(root);
  const codexHome = source(root);
  const designSource = join(root, "accepted-design.md");
  writeFileSync(
    designSource,
    "# Accepted design\n\nUse clear direct decision verbs.\n",
  );
  let calls = 0;
  const projectsRoot = join(root, "projects");
  const ctx = canonicalGymTestContext({
    projectsRoot,
    task: task({ batchSize: 10, maxBatches: 1 }),
    async runAgent() {
      calls += 1;
      if (calls === 1) {
        const checkpoint = join(
          projectsRoot,
          "gym.app",
          ".state",
          "learning",
          "codex",
        );
        const batchPath = join(
          checkpoint,
          "scratch",
          readdirSync(join(checkpoint, "scratch"))[0]!,
          "batch-1.json",
        );
        const sourceId = JSON.parse(readFileSync(batchPath, "utf8"))[0]
          .sourceId;
        return {
          status: "success",
          sessionId: "extract",
          structuredResult: {
            signals: [
              {
                sourceIds: [sourceId],
                kind: "preference",
                scope: "global",
                statement: "Use clear direct decision verbs.",
                rationale:
                  "This is an explicit reusable communication preference.",
                strength: "explicit",
                reusable: true,
                confidence: 0.99,
                competencies: ["authority.act-vs-approve"],
              },
              {
                sourceIds: [sourceId],
                kind: "positive-example",
                scope: "task-class",
                statement: "Weak guess",
                rationale: "Uncertain",
                strength: "validated",
                reusable: true,
                confidence: 0.5,
                competencies: [],
              },
            ],
          },
        };
      }
      const evidenceDir = join(
        projectsRoot,
        "gym.app",
        ".state",
        "learning",
        "codex",
        "scratch",
      );
      const runDir = readdirSync(evidenceDir)[0]!;
      if (calls === 2) {
        const input = JSON.parse(
          readFileSync(join(evidenceDir, runDir, "consolidation.json"), "utf8"),
        );
        return {
          status: "success",
          sessionId: "consolidate",
          structuredResult: {
            preferences: [
              {
                statement: "Use clear direct decision verbs.",
                scope: "global",
                rationale: "Hao stated this preference explicitly.",
                evidenceIds: [input.newEvidence[0].evidence_id],
                conflictEvidenceIds: [],
                confidence: 0.99,
                competencies: ["authority.act-vs-approve"],
              },
            ],
          },
        };
      }
      const reviewInput = JSON.parse(
        readFileSync(join(evidenceDir, runDir, "design-review.json"), "utf8"),
      );
      return {
        status: "success",
        sessionId: "design-review",
        structuredResult: {
          summary: "The candidate matches the accepted design.",
          reviews: [
            {
              candidateId: reviewInput.preferences[0].id,
              alignment: "supported",
              rationale: "The accepted design states the same preference.",
              sourceRefs: [`${designSource}#accepted-design`],
              recommendedUse: "lesson-evidence",
            },
          ],
        },
      };
    },
  });

  const result = await runCodexLearningIntake(ctx, {
    codexHome,
    designSources: [designSource],
  });
  expect(result.status).toBe("done");
  expect(calls).toBe(3);
  const stateDir = join(projectsRoot, "gym.app", ".state", "learning", "codex");
  const evidenceFiles = readdirSync(join(stateDir, "evidence"));
  expect(evidenceFiles).toHaveLength(1);
  const evidence = readFileSync(
    join(stateDir, "evidence", evidenceFiles[0]!),
    "utf8",
  );
  expect(evidence).toContain("Use clear direct decision verbs.");
  expect(evidence).not.toContain("private raw preference wording");
  expect(readFileSync(join(stateDir, "catalog.json"), "utf8")).not.toContain(
    "private raw preference wording",
  );
  const designReview = readFileSync(
    join(stateDir, "design-review.json"),
    "utf8",
  );
  expect(designReview).toContain('"alignment": "supported"');
  expect(designReview).not.toContain("private raw preference wording");
  expect(existsSync(join(stateDir, "scratch"))).toBe(true);
  expect(readdirSync(join(stateDir, "scratch"))).toEqual([]);

  await runCodexLearningIntake(ctx, {
    codexHome,
    designSources: [designSource],
  });
  expect(calls).toBe(3);

  writeFileSync(
    designSource,
    "# Accepted design\n\nPrefer direct decision verbs.\n",
  );
  await runCodexLearningIntake(ctx, {
    codexHome,
    designSources: [designSource],
  });
  expect(calls).toBe(4);
});

test("design-review failures preserve durable diagnostics without advancing candidate state", async () => {
  const variants = [
    {
      returnedStatus: "error",
      expectedCallStatus: "error",
      disposition: "not-validated-call-failed",
      diagnosticCode: null,
    },
    {
      returnedStatus: "interrupted",
      expectedCallStatus: "interrupted",
      disposition: "not-validated-call-failed",
      diagnosticCode: null,
    },
    {
      returnedStatus: "success",
      expectedCallStatus: "done",
      disposition: "structurally-invalid",
      diagnosticCode: "omitted-candidate",
    },
    {
      returnedStatus: "success",
      expectedCallStatus: "done",
      disposition: "structurally-invalid",
      diagnosticCode: "duplicate-candidate",
    },
    {
      returnedStatus: "success",
      expectedCallStatus: "done",
      disposition: "structurally-invalid",
      diagnosticCode: "unknown-candidate",
    },
    {
      returnedStatus: "success",
      expectedCallStatus: "done",
      disposition: "structurally-invalid",
      diagnosticCode: "invalid-source-reference",
    },
  ] as const;

  for (const variant of variants) {
    const root = mkdtempSync(join(tmpdir(), "codex-learning-review-failure-"));
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const stateDir = join(
      projectsRoot,
      "gym.app",
      ".state",
      "learning",
      "codex",
    );
    const evidenceDir = join(stateDir, "evidence");
    mkdirSync(evidenceDir, { recursive: true });
    const designSource = join(root, "accepted-design.md");
    writeFileSync(designSource, "# Accepted design\n\nUse direct decisions.\n");

    const checkpoint = `${JSON.stringify(
      {
        schema_version: 1,
        source: "codex-history",
        updated_at: "2026-01-01T00:00:00.000Z",
        processed_source_ids: ["already-processed"],
      },
      null,
      2,
    )}\n`;
    const catalog = `${JSON.stringify(
      {
        schema_version: 1,
        owner: "hao",
        updated_at: "2026-01-01T00:00:00.000Z",
        preferences: [
          {
            id: "candidate-1",
            statement: "Use direct decisions.",
            scope: "global",
            rationale: "Explicit preference.",
            evidenceIds: ["evidence-1"],
            conflictEvidenceIds: [],
            confidence: 0.99,
            competencies: [],
            status: "candidate",
          },
        ],
      },
      null,
      2,
    )}\n`;
    const priorReview = `${JSON.stringify(
      {
        schema_version: 1,
        status: "candidate-review",
        reviewed_at: "2026-01-01T00:00:00.000Z",
        design_fingerprint: "stale",
        catalog_fingerprint: "stale",
        summary: "Prior candidate review.",
        reviews: [],
      },
      null,
      2,
    )}\n`;
    const evidenceRow = '{"evidence_id":"evidence-1","status":"candidate"}\n';
    writeFileSync(join(stateDir, "checkpoint.json"), checkpoint);
    writeFileSync(join(stateDir, "catalog.json"), catalog);
    writeFileSync(join(stateDir, "design-review.json"), priorReview);
    writeFileSync(join(evidenceDir, "evidence-1.json"), evidenceRow);

    const ctx = canonicalGymTestContext({
      projectsRoot,
      task: task(),
      async runAgent() {
        const validReview = {
          candidateId: "candidate-1",
          alignment: "supported",
          rationale: "Matches accepted design.",
          sourceRefs: [`${designSource}#accepted-design`],
          recommendedUse: "lesson-evidence",
        };
        const reviews =
          variant.diagnosticCode === "duplicate-candidate"
            ? [validReview, validReview]
            : variant.diagnosticCode === "unknown-candidate"
              ? [{ ...validReview, candidateId: "private unknown candidate" }]
              : variant.diagnosticCode === "invalid-source-reference"
                ? [{ ...validReview, sourceRefs: ["private unlisted source"] }]
                : [];
        return {
          status: variant.returnedStatus,
          sessionId: `review-${variant.returnedStatus}-${variant.diagnosticCode}`,
          structuredResult:
            variant.returnedStatus === "success"
              ? { summary: "Rejected structured review.", reviews }
              : undefined,
        };
      },
    });

    const result = await runCodexLearningIntake(ctx, {
      designSources: [designSource],
      scan: async () => ({
        turns: [],
        totalHistoryRows: 1,
        newHistoryRows: 0,
        rolloutFilesRead: 0,
        malformedLines: 0,
      }),
    });

    expect(result.status).toBe("done");
    const output = result.output as { evidence: string[] };
    expect(output.evidence).toHaveLength(2);
    expect(output.evidence.every((path) => existsSync(path))).toBe(true);
    expect(output.evidence.some((path) => path.includes("/scratch/"))).toBe(
      false,
    );
    expect(readFileSync(join(stateDir, "checkpoint.json"), "utf8")).toBe(
      checkpoint,
    );
    expect(readFileSync(join(stateDir, "catalog.json"), "utf8")).toBe(catalog);
    expect(readFileSync(join(stateDir, "design-review.json"), "utf8")).toBe(
      priorReview,
    );
    expect(readdirSync(evidenceDir)).toEqual(["evidence-1.json"]);
    expect(readFileSync(join(evidenceDir, "evidence-1.json"), "utf8")).toBe(
      evidenceRow,
    );

    const failure = JSON.parse(readFileSync(output.evidence[0]!, "utf8"));
    const snapshot = readFileSync(output.evidence[1]!, "utf8");
    expect(failure.session_id).toBe(
      `review-${variant.returnedStatus}-${variant.diagnosticCode}`,
    );
    expect(failure.call_status).toBe(variant.expectedCallStatus);
    expect(failure.validation_disposition).toBe(variant.disposition);
    if (variant.diagnosticCode) {
      expect(
        failure.validation_diagnostics.map(
          (diagnostic: { code: string }) => diagnostic.code,
        ),
      ).toContain(variant.diagnosticCode);
      expect(failure.rejected_output_sha256).toHaveLength(64);
      expect(JSON.stringify(failure)).not.toContain(
        "private unknown candidate",
      );
      expect(JSON.stringify(failure)).not.toContain("private unlisted source");
    } else {
      expect(failure.validation_diagnostics).toBeUndefined();
      expect(failure.rejected_output_sha256).toBeUndefined();
    }
    expect(failure.input_snapshot.path).toBe(output.evidence[1]);
    expect(failure.input_snapshot.sha256).toBe(
      createHash("sha256").update(snapshot).digest("hex"),
    );
    expect(JSON.parse(snapshot)).toEqual({
      designSources: [designSource],
      preferences: JSON.parse(catalog).preferences,
    });
    expect(readdirSync(join(stateDir, "scratch"))).toEqual([]);
  }
});

test("advances the checkpoint when review finds no strong signal", async () => {
  const root = mkdtempSync(join(tmpdir(), "codex-learning-intake-"));
  roots.push(root);
  const codexHome = source(root);
  let calls = 0;
  const projectsRoot = join(root, "projects");
  const ctx = canonicalGymTestContext({
    projectsRoot,
    task: task(),
    async runAgent() {
      calls += 1;
      return {
        status: "success",
        sessionId: "extract",
        structuredResult: { signals: [] },
      };
    },
  });

  await runCodexLearningIntake(ctx, { codexHome });
  await runCodexLearningIntake(ctx, { codexHome });
  expect(calls).toBe(1);
  const checkpoint = JSON.parse(
    readFileSync(
      join(
        projectsRoot,
        "gym.app",
        ".state",
        "learning",
        "codex",
        "checkpoint.json",
      ),
      "utf8",
    ),
  );
  expect(checkpoint.processed_source_ids).toHaveLength(1);
});
