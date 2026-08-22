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

function expectReplayProvenance(receipt: Record<string, any>): void {
  const paths = [
    join(import.meta.dir, "codex-learning-intake.ts"),
    join(import.meta.dir, "codex-learning-intake.test.ts"),
  ];
  expect(receipt.applied_overlay).toEqual({
    files: paths.map((path) => ({
      path,
      sha256: createHash("sha256")
        .update(readFileSync(path, "utf8"))
        .digest("hex"),
    })),
    targeted_test_command:
      "bun test ./agents/gym/workflows/codex-learning-intake.test.ts --timeout 30000",
  });
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
  let reviewPrompt = "";
  const projectsRoot = join(root, "projects");
  const ctx = canonicalGymTestContext({
    projectsRoot,
    task: task({ batchSize: 10, maxBatches: 1 }),
    async runAgent(_agent, prompt) {
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
      reviewPrompt = prompt;
      expect(reviewInput.designSources).toEqual([designSource]);
      expect(reviewInput.designSourceAnchors).toEqual([
        { path: designSource, anchors: ["accepted-design"] },
      ]);
      expect(reviewPrompt).toContain(`- ${designSource}`);
      expect(reviewPrompt).toContain("valid Markdown anchors: #accepted-design");
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
    {
      returnedStatus: "success",
      expectedCallStatus: "done",
      disposition: "structurally-invalid",
      diagnosticCode: "invented-anchor",
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
                : variant.diagnosticCode === "invented-anchor"
                  ? [
                      {
                        ...validReview,
                        sourceRefs: [`${designSource}#private-invented-anchor`],
                      },
                    ]
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
      const expectedCode =
        variant.diagnosticCode === "invented-anchor"
          ? "invalid-source-reference"
          : variant.diagnosticCode;
      expect(
        failure.validation_diagnostics.map(
          (diagnostic: { code: string }) => diagnostic.code,
        ),
      ).toContain(expectedCode);
      if (
        variant.diagnosticCode === "invalid-source-reference" ||
        variant.diagnosticCode === "invented-anchor"
      ) {
        expect(failure.validation_diagnostics[0].reason).toBe(
          variant.diagnosticCode === "invented-anchor"
            ? "invalid-anchor"
            : "unlisted-path",
        );
      }
      expect(failure.rejected_output_sha256).toHaveLength(64);
      expect(JSON.stringify(failure)).not.toContain(
        "private unknown candidate",
      );
      expect(JSON.stringify(failure)).not.toContain("private unlisted source");
      expect(JSON.stringify(failure)).not.toContain("private-invented-anchor");
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
      designSourceAnchors: [
        { path: designSource, anchors: ["accepted-design"] },
      ],
      preferences: JSON.parse(catalog).preferences,
    });
    expect(readdirSync(join(stateDir, "scratch"))).toEqual([]);
  }
});

test("replays an exact frozen design-review input once and commits candidate state atomically", async () => {
  const root = mkdtempSync(join(tmpdir(), "codex-frozen-review-"));
  roots.push(root);
  const projectsRoot = join(root, "projects");
  const stateDir = join(projectsRoot, "gym.app", ".state", "learning", "codex");
  const designSource = join(root, "accepted-design.md");
  writeFileSync(designSource, "# Accepted design\n\nUse direct decisions.\n");
  const frozenPath = join(root, "frozen-review-input.json");
  const frozen = `${JSON.stringify(
    {
      designSources: [designSource],
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
      checkpoint: {
        schema_version: 1,
        source: "codex-history",
        updated_at: "2026-08-19T00:00:00.000Z",
        processed_source_ids: ["frozen-source-1"],
      },
    },
    null,
    2,
  )}\n`;
  writeFileSync(frozenPath, frozen);
  const expectedSha = createHash("sha256").update(frozen).digest("hex");

  const mismatchRoot = join(root, "mismatch-projects");
  const mismatchStateDir = join(
    mismatchRoot,
    "gym.app",
    ".state",
    "learning",
    "codex",
  );
  mkdirSync(mismatchStateDir, { recursive: true });
  const mismatchState = {
    checkpoint: '{"preserved":"checkpoint"}\n',
    catalog: '{"preserved":"catalog"}\n',
    review: '{"preserved":"review"}\n',
  };
  writeFileSync(
    join(mismatchStateDir, "checkpoint.json"),
    mismatchState.checkpoint,
  );
  writeFileSync(join(mismatchStateDir, "catalog.json"), mismatchState.catalog);
  writeFileSync(
    join(mismatchStateDir, "design-review.json"),
    mismatchState.review,
  );
  let mismatchCalls = 0;
  const mismatchCtx = canonicalGymTestContext({
    projectsRoot: mismatchRoot,
    task: task({
      mode: "frozen-design-review-replay",
      frozenInputPath: frozenPath,
      expectedSha256: "0".repeat(64),
      replayKey: "review-20260819",
    }),
    async runAgent() {
      mismatchCalls += 1;
      throw new Error("must not be called");
    },
  });
  const mismatchResult = await runCodexLearningIntake(mismatchCtx);
  expect(mismatchCalls).toBe(0);
  expect((mismatchResult.output as { summary: string }).summary).toBe(
    "Frozen design-review replay hash mismatch.",
  );
  expect(readFileSync(join(mismatchStateDir, "checkpoint.json"), "utf8")).toBe(
    mismatchState.checkpoint,
  );
  expect(readFileSync(join(mismatchStateDir, "catalog.json"), "utf8")).toBe(
    mismatchState.catalog,
  );
  expect(
    readFileSync(join(mismatchStateDir, "design-review.json"), "utf8"),
  ).toBe(mismatchState.review);
  expect(existsSync(join(mismatchStateDir, "replays"))).toBe(false);

  let calls = 0;
  const ctx = canonicalGymTestContext({
    projectsRoot,
    task: task({
      mode: "frozen-design-review-replay",
      frozenInputPath: frozenPath,
      expectedSha256: expectedSha,
      replayKey: "review-20260819",
    }),
    async runAgent() {
      calls += 1;
      return {
        status: "success",
        sessionId: "frozen-design-review",
        structuredResult: {
          summary: "The candidate matches accepted design.",
          reviews: [
            {
              candidateId: "candidate-1",
              alignment: "supported",
              rationale: "The accepted design states the same rule.",
              sourceRefs: [designSource],
              recommendedUse: "lesson-evidence",
            },
          ],
        },
      };
    },
  });

  await runCodexLearningIntake(ctx);
  const checkpoint = readFileSync(join(stateDir, "checkpoint.json"), "utf8");
  const catalog = readFileSync(join(stateDir, "catalog.json"), "utf8");
  const review = readFileSync(join(stateDir, "design-review.json"), "utf8");
  expect(calls).toBe(1);
  expect(JSON.parse(checkpoint).processed_source_ids).toEqual([
    "frozen-source-1",
  ]);
  expect(JSON.parse(catalog).preferences[0].status).toBe("candidate");
  expect(JSON.parse(review).reviews).toHaveLength(1);
  expect(JSON.parse(review).reviews[0].sourceRefs).toEqual([designSource]);
  const receiptPath = join(
    stateDir,
    "replays",
    `review-20260819-${createHash("sha256")
      .update("review-20260819")
      .digest("hex")
      .slice(0, 12)}.json`,
  );
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  expect(receipt.status).toBe("completed");
  expect(receipt.frozen_input).toEqual({
    path: frozenPath,
    sha256: expectedSha,
  });
  expectReplayProvenance(receipt);
  expect(receipt.file_fingerprints.design_sources[designSource]).toHaveLength(
    64,
  );
  expect(receipt.file_fingerprints.checkpoint).toBe(
    createHash("sha256").update(checkpoint).digest("hex"),
  );
  expect(receipt.file_fingerprints.catalog).toBe(
    createHash("sha256").update(catalog).digest("hex"),
  );
  expect(receipt.file_fingerprints.design_review).toBe(
    createHash("sha256").update(review).digest("hex"),
  );

  await runCodexLearningIntake(ctx);
  expect(calls).toBe(1);
  expect(readFileSync(join(stateDir, "checkpoint.json"), "utf8")).toBe(
    checkpoint,
  );
  expect(readFileSync(join(stateDir, "catalog.json"), "utf8")).toBe(catalog);
  expect(readFileSync(join(stateDir, "design-review.json"), "utf8")).toBe(
    review,
  );
});

test("frozen replay rejection leaves existing candidate state byte-identical", async () => {
  const root = mkdtempSync(join(tmpdir(), "codex-frozen-rejection-"));
  roots.push(root);
  const projectsRoot = join(root, "projects");
  const stateDir = join(projectsRoot, "gym.app", ".state", "learning", "codex");
  mkdirSync(stateDir, { recursive: true });
  const designSource = join(root, "accepted-design.md");
  writeFileSync(designSource, "# Accepted design\n\nUse direct decisions.\n");
  const frozenPath = join(root, "frozen-review-input.json");
  const candidate = {
    id: "candidate-1",
    statement: "Use direct decisions.",
    scope: "global",
    rationale: "Explicit preference.",
    evidenceIds: ["evidence-1"],
    conflictEvidenceIds: [],
    confidence: 0.99,
    competencies: [],
    status: "candidate",
  };
  const frozen = `${JSON.stringify({
    designSources: [designSource],
    preferences: [candidate],
  })}\n`;
  writeFileSync(frozenPath, frozen);
  const originals = {
    checkpoint: '{"old":"checkpoint"}\n',
    catalog: '{"old":"catalog"}\n',
    review: '{"old":"review"}\n',
  };
  writeFileSync(join(stateDir, "checkpoint.json"), originals.checkpoint);
  writeFileSync(join(stateDir, "catalog.json"), originals.catalog);
  writeFileSync(join(stateDir, "design-review.json"), originals.review);
  let calls = 0;
  const ctx = canonicalGymTestContext({
    projectsRoot,
    task: task({
      mode: "frozen-design-review-replay",
      frozenDesignReviewInputPath: frozenPath,
      frozenDesignReviewInputSha256: createHash("sha256")
        .update(frozen)
        .digest("hex"),
      replayKey: "invalid-review",
    }),
    async runAgent() {
      calls += 1;
      return {
        status: "success",
        sessionId: "invalid-review",
        structuredResult: { summary: "Incomplete.", reviews: [] },
      };
    },
  });
  const result = await runCodexLearningIntake(ctx);
  expect(calls).toBe(1);
  expect(readFileSync(join(stateDir, "checkpoint.json"), "utf8")).toBe(
    originals.checkpoint,
  );
  expect(readFileSync(join(stateDir, "catalog.json"), "utf8")).toBe(
    originals.catalog,
  );
  expect(readFileSync(join(stateDir, "design-review.json"), "utf8")).toBe(
    originals.review,
  );
  const output = result.output as { evidence: string[] };
  const terminalReceipt = JSON.parse(readFileSync(output.evidence[0]!, "utf8"));
  expect(terminalReceipt.status).toBe("failed");
  expectReplayProvenance(terminalReceipt);
  expect(terminalReceipt.validation_diagnostics).toEqual([
    {
      code: "omitted-candidate",
      field: "reviews[].candidateId",
      candidate_id: "candidate-1",
    },
  ]);
  expect(terminalReceipt.state_before).toEqual(terminalReceipt.state_after);
  expect(output.evidence.every((path) => existsSync(path))).toBe(true);

  await runCodexLearningIntake(ctx);
  expect(calls).toBe(1);
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
