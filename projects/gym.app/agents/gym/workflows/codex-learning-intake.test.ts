import { afterEach, expect, test } from "bun:test";
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
  const stateDir = join(
    projectsRoot,
    "gym.app",
    ".state",
    "learning",
    "codex",
  );
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
