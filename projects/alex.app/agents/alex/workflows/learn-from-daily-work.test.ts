import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWorkflowTest } from "@may-agent/sdk/testing";
import * as learnFromDailyWork from "./learn-from-daily-work.js";

describe("alex/learn-from-daily-work multi-root harvester & synthesizer", () => {
  test("returns a direct converged Task result with a summary when no signals are found", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "daily-learn-empty-"));
    try {
      const run = await runWorkflowTest(learnFromDailyWork, {
        input: { roots: [sandbox] },
        workspace: { projectRoot: sandbox, workRoot: sandbox },
      });

      expect(run.status).toBe("done");
      expect(run.result?.output).toMatchObject({ state: "converged" });
      expect(run.result?.output?.summary).toBeTruthy();
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  test("discovers and deduplicates signals across separate container (.state) and localhost (home) roots", () => {
    const sandbox = mkdtempSync(join(tmpdir(), "daily-learn-roots-"));
    try {
      const containerStateRoot = join(sandbox, "container-app", ".state");
      const localhostHomeRoot = join(sandbox, "localhost-home");

      // 1. Seed a Gemini log in localhostHomeRoot/.gemini/tmp/app/logs.json
      const geminiDir = join(localhostHomeRoot, ".gemini", "tmp", "app");
      mkdirSync(geminiDir, { recursive: true });
      writeFileSync(
        join(geminiDir, "logs.json"),
        JSON.stringify([
          {
            type: "user",
            message:
              "all our benchmark is about judge, we want the agent to made the right decision. we won't provide infomation in the benchmark, which should belong to skill or workflow",
            timestamp: "2026-11-15T01:00:00Z",
          },
        ]),
      );

      // 2. Seed a Codex history.jsonl in containerStateRoot/.codex/history.jsonl
      const codexDir = join(containerStateRoot, ".codex");
      mkdirSync(codexDir, { recursive: true });
      writeFileSync(
        join(codexDir, "history.jsonl"),
        `${JSON.stringify({
          text: "Don't change the test file — the tests are correct. Fix the source code.",
          ts: 1794700000000,
        })}\n`,
      );

      // 3. Seed a Pi session in localhostHomeRoot/.pi/agent/sessions/--app--/s1.jsonl
      const piDir = join(localhostHomeRoot, ".pi", "agent", "sessions", "--app--");
      mkdirSync(piDir, { recursive: true });
      writeFileSync(
        join(piDir, "s1.jsonl"),
        `${JSON.stringify({
          type: "message",
          timestamp: 1794700005000,
          message: {
            role: "user",
            content: "i want the unified api, just make sure it's clear and solid",
          },
        })}\n`,
      );

      const discovered = learnFromDailyWork.discoverSessionSources(
        join(sandbox, "container-app"),
        [containerStateRoot, localhostHomeRoot],
      );
      expect(discovered.geminiLogFiles).toHaveLength(1);
      expect(discovered.codexHistoryFiles).toHaveLength(1);
      expect(discovered.piSessionDirs).toHaveLength(1);

      const signals = learnFromDailyWork.harvestSignalsFromSources(discovered);
      expect(signals).toHaveLength(3);
      expect(signals.map((s) => s.source).sort()).toEqual(["codex", "gemini", "pi"]);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  test("rejects drafted benchmark cases that leak answers or reference system-state.md, and updates cursor", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "daily-learn-wf-"));
    try {
      const geminiDir = join(sandbox, ".gemini", "tmp", "app");
      mkdirSync(geminiDir, { recursive: true });
      writeFileSync(
        join(geminiDir, "logs.json"),
        JSON.stringify([
          {
            type: "user",
            message:
              "why need the stage === 'implementation' when we define the steps? the workflow know the purpose of the step already",
            timestamp: "2026-11-15T02:00:00Z",
          },
        ]),
      );

      const cursorPath = join(sandbox, "cursor.json");
      const outputFile = join(sandbox, "daily-report.json");
      const run = await runWorkflowTest(learnFromDailyWork, {
        input: {
          roots: [sandbox],
          cursorPath,
          outputFile,
        },
        workspace: { projectRoot: sandbox, workRoot: sandbox },
        mocks: {
          bob: {
            status: "done",
            summary: "Extracted 2 lessons (1 valid, 1 leaky)",
            output: {
              summary: "Synthesized daily workflow and benchmark lessons.",
              lessons: [
                {
                  role: "alex",
                  signalKind: "failure_correction",
                  sourceQuote:
                    "why need the stage === 'implementation' when we define the steps?",
                  extractedJudgeRule:
                    "Workflows own step sequence directly; do not pass redundant stage flags into specialist prompts.",
                  recommendedStage: "stage3_workflow",
                  draftBenchmarkCase: {
                    id: "alex-judge-no-redundant-stage-flag",
                    description:
                      "Alex workflows should pass direct step instructions rather than redundant stage flags.",
                    task: "Review the proposed step prompt in `workflows/develop-change.ts`.",
                    expectedHumanAnswer:
                      "Remove the redundant stage === 'implementation' check and pass the step's direct purpose.",
                    requiredConcepts: [["stage", "purpose"], ["remove", "simplify"]],
                  },
                },
                {
                  role: "may",
                  signalKind: "failure_correction",
                  sourceQuote: "leaky case",
                  extractedJudgeRule: "Should be rejected by validator",
                  recommendedStage: "stage1_prompt",
                  draftBenchmarkCase: {
                    id: "bad-leaky-case",
                    description: "Leaky case",
                    task: "Read `system-state.md`. May must block this action.",
                    expectedHumanAnswer: "Block.",
                    requiredConcepts: [["block"]],
                  },
                },
              ],
            },
          },
        },
      });

      expect(run.status).toBe("done");
      expect(run.unconsumedFixtures).toHaveLength(0);
      const out = JSON.parse(readFileSync(outputFile, "utf8")) as {
        signalCount: number;
        acceptedLessonCount: number;
        lessons: Array<{ draftBenchmarkCase: { id: string } }>;
      };
      expect(out.signalCount).toBe(1);
      expect(out.acceptedLessonCount).toBe(1);
      expect(out.lessons[0]?.draftBenchmarkCase.id).toBe(
        "alex-judge-no-redundant-stage-flag",
      );
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
});
