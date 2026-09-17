import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import { execute } from "./evaluation-feedback-projection.js";

function workspace(): {
  root: string;
  agentDir: string;
  feedbackPath: string;
} {
  const root = mkdtempSync(join(tmpdir(), "evaluation-feedback-"));
  const agentDir = join(root, "agents", "sample");
  mkdirSync(agentDir, { recursive: true });
  writeFileSync(
    join(agentDir, "agent.json"),
    `${JSON.stringify({ name: "sample" })}\n`,
    "utf8",
  );
  return {
    root,
    agentDir,
    feedbackPath: join(agentDir, "last-eval.md"),
  };
}

describe("evaluation feedback projection", () => {
  test("projects a genuine actionable evaluation with source, verdict, finding, and verification context exactly once", async () => {
    const { root, feedbackPath } = workspace();
    const emitted: unknown[] = [];
    const ctx = createTestAppWorkflowContext({
      input: {
        feedbackKey: "sample",
        evaluation: {
          sessionId: "s_latest",
          agent: "sample",
          quality: 0.4,
          verdict: "needs_improvement",
          issues: ["Did not verify the requested result."],
          overall: {
            evidence: ["Test output was not cited in the completion receipt."],
          },
          createdAt: 1_700_000_000_000,
        },
      },
      workspace: { root, output: join(root, ".output") },
      emit: async (event) => {
        emitted.push(event);
      },
    });

    await expect(execute(ctx)).resolves.toMatchObject({
      status: "done",
      output: {
        state: "converged",
        actions: [],
        facts: [
          "evaluated-session:s_latest",
          "feedback-updated:sample",
          "feedback-verified:sample",
        ],
      },
    });
    const output = readFileSync(feedbackPath, "utf8");
    expect(output).toContain("**Latest session:** s_latest");
    expect(output).toContain("**Verdict:** needs_improvement");
    expect(output).toContain("Did not verify the requested result.");
    expect(output).toContain("## Verification Context");
    expect(output).toContain(
      "Test output was not cited in the completion receipt.",
    );

    await expect(execute(ctx)).resolves.toMatchObject({
      status: "done",
      output: {
        state: "converged",
        actions: [],
        evidence: ["evaluated-session:s_latest", "feedback-verified:sample"],
      },
    });
    expect(readFileSync(feedbackPath, "utf8")).toBe(output);
    expect(emitted).toEqual([]);
  });

  test("projects deep-evaluation verification evidence when the durable fact stores it as a string", async () => {
    const { root, feedbackPath } = workspace();
    const evidence =
      "Transcript tool results show origin/dev=9a13415dc5282477f94378d536036c7ab16a4636 and an adapted archive-based check whose result was not persisted.";
    const ctx = createTestAppWorkflowContext({
      input: {
        feedbackKey: "sample",
        evaluation: {
          sessionId: "s_1787394743684_6",
          agent: "sample",
          quality: 0.28,
          verdict: "needs_improvement",
          issues: [
            "INCOMPLETE_OUTPUT: No verified task outcome was delivered.",
          ],
          overall: { evidence },
          createdAt: 1_787_396_707_168,
        },
      },
      workspace: { root, output: join(root, ".output") },
    });

    await expect(execute(ctx)).resolves.toMatchObject({
      status: "done",
      output: {
        state: "converged",
        facts: [
          "evaluated-session:s_1787394743684_6",
          "feedback-updated:sample",
          "feedback-verified:sample",
        ],
      },
    });
    const output = readFileSync(feedbackPath, "utf8");
    expect(output).toContain("## Verification Context");
    expect(output).toContain(`- ${evidence}`);
  });

  test("does not label the exact non-actionable Gym evaluation as an issue or required action", async () => {
    const { root, feedbackPath } = workspace();
    mkdirSync(join(root, "generated", "agent-feedback"), { recursive: true });
    writeFileSync(
      feedbackPath,
      "## Issues Flagged\n\n- stale issue\n\n## Action Required\n",
    );
    const ctx = createTestAppWorkflowContext({
      input: {
        feedbackKey: "sample",
        evaluation: {
          sessionId: "s_1787389211258_10",
          agent: "gym",
          quality: 0.97,
          verdict: "good",
          issues: [
            "No material defect found. Learning signal: the agent used the source router plus claim-specific accepted design documents, then gave concise corrections rather than accepting overbroad candidate wording.",
          ],
          createdAt: 1_787_391_167_037,
        },
      },
      workspace: { root, output: join(root, ".output") },
    });

    await expect(execute(ctx)).resolves.toMatchObject({
      status: "done",
      output: {
        state: "converged",
        actions: [],
        facts: [
          "evaluated-session:s_1787389211258_10",
          "feedback-removed:gym",
          "feedback-verified:gym",
        ],
      },
    });
    expect(existsSync(feedbackPath)).toBe(false);

    await expect(execute(ctx)).resolves.toMatchObject({
      output: {
        actions: [],
        facts: [
          "evaluated-session:s_1787389211258_10",
          "feedback-verified:gym",
        ],
      },
    });
    expect(existsSync(feedbackPath)).toBe(false);
  });

  test("removes stale feedback when the latest evaluation has no issues", async () => {
    const { root, feedbackPath } = workspace();
    await execute(
      createTestAppWorkflowContext({
        input: {
          feedbackKey: "sample",
          evaluation: {
            sessionId: "s_old",
            agent: "sample",
            quality: 0.2,
            verdict: "needs_improvement",
            issues: ["old issue"],
          },
        },
        workspace: { root, output: join(root, ".output") },
      }),
    );
    writeFileSync(feedbackPath, "stale feedback");
    const ctx = createTestAppWorkflowContext({
      input: {
        feedbackKey: "sample",
        evaluation: {
          sessionId: "s_clean",
          agent: "sample",
          quality: 1,
          verdict: "good",
          issues: [],
        },
      },
      workspace: { root, output: join(root, ".output") },
    });

    await expect(execute(ctx)).resolves.toMatchObject({
      output: {
        state: "converged",
        facts: [
          "evaluated-session:s_clean",
          "feedback-removed:sample",
          "feedback-verified:sample",
        ],
      },
    });
    expect(existsSync(feedbackPath)).toBe(false);
  });

  test("does not recreate false feedback when an older evaluation replays after correction", async () => {
    const { root, feedbackPath } = workspace();
    const project = async (
      sessionId: string,
      issues: string[],
      createdAt: number,
    ) =>
      execute(
        createTestAppWorkflowContext({
          input: {
            feedbackKey: "sample",
            evaluation: {
              sessionId,
              agent: "sample",
              quality: issues.length ? 0.32 : 0.8,
              verdict: issues.length ? "needs_improvement" : "good",
              issues,
              createdAt,
            },
          },
          workspace: { root, output: join(root, ".output") },
        }),
      );

    await project(
      "s_resume",
      ["INCOMPLETE_OUTPUT: false interrupted result"],
      100,
    );
    await project("s_resume", [], 200);
    expect(existsSync(feedbackPath)).toBe(false);

    await expect(
      project("s_resume", ["INCOMPLETE_OUTPUT: false interrupted result"], 100),
    ).resolves.toMatchObject({
      output: {
        evidence: ["evaluated-session:s_resume", "feedback-stale:sample"],
      },
    });
    expect(existsSync(feedbackPath)).toBe(false);
  });

  test("repairs the generation-505 false-success mismatch at the canonical app-ops target and exact replay is idempotent", async () => {
    const projectsRoot = mkdtempSync(join(tmpdir(), "evaluation-projects-"));
    const root = join(projectsRoot, "evaluation.app");
    const agentDir = join(projectsRoot, "aks-rp-e2e.app", "agents", "app-ops");
    const canonicalPath = join(agentDir, "last-eval.md");
    const legacyGeneratedPath = join(
      root,
      "generated",
      "agent-feedback",
      "app-ops.md",
    );
    mkdirSync(agentDir, { recursive: true });
    mkdirSync(join(root, "generated", "agent-feedback"), { recursive: true });
    writeFileSync(join(agentDir, "agent.json"), '{"name":"app-ops"}\n');
    writeFileSync(canonicalPath, "stale canonical generation-505 content\n");
    writeFileSync(
      legacyGeneratedPath,
      "legacy generated output that previously caused false success\n",
    );
    const emitted: unknown[] = [];
    const ctx = createTestAppWorkflowContext({
      input: {
        feedbackKey: "app-ops",
        evaluation: {
          sessionId: "s_1787406177203_0",
          agent: "app-ops",
          quality: 0.68,
          verdict: "acceptable",
          issues: [
            "UNSAFE_PATH_VALIDATION: verify the lease path against the enumerated Git worktree and reclaim only on confirmed ESRCH.",
          ],
          overall: {
            evidence: [
              "result.json records the canonical workflow deliverables and structured waiting result.",
              "Bounded transcript evidence shows 741/741 parity, 5 passing tests, typecheck success, and final read-back.",
            ],
          },
          createdAt: 1_787_406_724_401,
        },
      },
      workspace: { root, output: join(root, ".output") },
      emit: async (event) => emitted.push(event),
    });

    await expect(execute(ctx)).resolves.toMatchObject({
      status: "done",
      output: {
        facts: [
          "evaluated-session:s_1787406177203_0",
          "feedback-updated:app-ops",
          "feedback-verified:app-ops",
        ],
      },
    });
    const projected = readFileSync(canonicalPath, "utf8");
    expect(projected).toContain("**Latest session:** s_1787406177203_0");
    expect(projected).toContain("**Verdict:** acceptable (quality: 0.68)");
    expect(projected).toContain("UNSAFE_PATH_VALIDATION");
    expect(projected).toContain("## Verification Context");
    expect(readFileSync(legacyGeneratedPath, "utf8")).toContain(
      "previously caused false success",
    );

    await expect(execute(ctx)).resolves.toMatchObject({
      status: "done",
      output: {
        facts: [
          "evaluated-session:s_1787406177203_0",
          "feedback-verified:app-ops",
        ],
      },
    });
    expect(readFileSync(canonicalPath, "utf8")).toBe(projected);
    expect(emitted).toEqual([]);
  });

  test("a materially changed actionable evaluation updates source-session and verification context", async () => {
    const { root, feedbackPath } = workspace();
    const project = (sessionId: string, evidence: string, createdAt: number) =>
      execute(
        createTestAppWorkflowContext({
          input: {
            feedbackKey: "sample",
            evaluation: {
              sessionId,
              agent: "sample",
              quality: 0.7,
              verdict: "acceptable",
              issues: ["ACTION_REQUIRED: harden canonical read-back."],
              overall: { evidence: [evidence] },
              createdAt,
            },
          },
          workspace: { root, output: join(root, ".output") },
        }),
      );

    await project("s_before", "old verification", 100);
    await expect(
      project("s_changed", "new verification", 200),
    ).resolves.toMatchObject({
      output: {
        facts: [
          "evaluated-session:s_changed",
          "feedback-updated:sample",
          "feedback-verified:sample",
        ],
      },
    });
    const output = readFileSync(feedbackPath, "utf8");
    expect(output).toContain("**Latest session:** s_changed");
    expect(output).toContain("- new verification");
    expect(output).not.toContain("old verification");
  });

  test("delivers exact actionable aks-explorer evaluation through its manifest-declared owner directory without resolving it", async () => {
    const projectsRoot = mkdtempSync(join(tmpdir(), "evaluation-projects-"));
    const root = join(projectsRoot, "evaluation.app");
    const ownerDir = join(projectsRoot, "aks-rp-e2e.app", "agents", "owner");
    const feedbackPath = join(ownerDir, "last-eval.md");
    mkdirSync(root, { recursive: true });
    mkdirSync(ownerDir, { recursive: true });
    writeFileSync(
      join(ownerDir, "agent.json"),
      `${JSON.stringify({ name: "aks-explorer" })}\n`,
    );
    const statePath = join(
      root,
      "generated",
      "agent-feedback",
      ".state",
      "aks-explorer.json",
    );
    mkdirSync(join(root, "generated", "agent-feedback", ".state"), {
      recursive: true,
    });
    writeFileSync(
      statePath,
      `${JSON.stringify({ sessionId: "s_newer_non_actionable", createdAt: 1_787_419_085_425 })}\n`,
    );
    const emitted: unknown[] = [];
    const verification =
      "Transcript and result artifact show the task converged without the required source read-back.";
    const ctx = createTestAppWorkflowContext({
      input: {
        feedbackKey: "aks-explorer",
        exactReplay: true,
        evaluation: {
          sessionId: "s_1787414952089_3",
          agent: "aks-explorer",
          quality: 0.52,
          verdict: "needs_improvement",
          issues: [
            "VERIFICATION_GAP: the claimed source change was not read back.",
          ],
          overall: { evidence: [verification] },
          createdAt: 1_787_415_100_000,
        },
      },
      workspace: { root, output: join(root, ".output") },
      emit: async (event) => emitted.push(event),
    });

    const first = await execute(ctx);
    expect(first).toMatchObject({
      status: "done",
      summary:
        "Delivered evaluation s_1787414952089_3 to aks-explorer's responsible project owner; remediation remains unresolved.",
      output: {
        state: "converged",
        facts: [
          "evaluated-session:s_1787414952089_3",
          "feedback-updated:aks-explorer",
          "feedback-verified:aks-explorer",
        ],
      },
    });
    const delivered = readFileSync(feedbackPath, "utf8");
    expect(delivered).toContain("**Latest session:** s_1787414952089_3");
    expect(delivered).toContain("VERIFICATION_GAP");
    expect(delivered).toContain(`- ${verification}`);
    expect(delivered).toContain(
      "Delivered to the responsible project owner; remediation remains unresolved.",
    );
    const receipt = readFileSync(statePath, "utf8");

    await expect(execute(ctx)).resolves.toMatchObject({
      status: "done",
      summary: expect.stringContaining("exact replay made no mutation"),
      output: {
        facts: [
          "evaluated-session:s_1787414952089_3",
          "feedback-verified:aks-explorer",
        ],
      },
    });
    expect(readFileSync(feedbackPath, "utf8")).toBe(delivered);
    expect(readFileSync(statePath, "utf8")).toBe(receipt);
    expect(emitted).toEqual([]);
  });

  test("generation-737 aks-explorer missing-target good evaluation converges as an idempotent verified no-op", async () => {
    const root = mkdtempSync(join(tmpdir(), "evaluation-feedback-missing-"));
    const emitted: unknown[] = [];
    const ctx = createTestAppWorkflowContext({
      input: {
        feedbackKey: "aks-explorer",
        evaluation: {
          sessionId: "s_1787409721879_11",
          agent: "aks-explorer",
          quality: 0.93,
          verdict: "good",
          issues: [],
          overall: {
            evidence: [
              "result.json records the exact waiting child and verification evidence.",
            ],
          },
          createdAt: 1_787_409_896_450,
        },
      },
      workspace: { root, output: join(root, ".output") },
      emit: async (event) => emitted.push(event),
    });

    const expected = {
      status: "done",
      output: {
        state: "converged",
        actions: [],
        facts: [
          "evaluated-session:s_1787409721879_11",
          "feedback-target:missing:aks-explorer",
          "feedback-target-verified:aks-explorer",
        ],
      },
    };
    const first = await execute(ctx);
    expect(first).toMatchObject(expected);
    expect(first.summary).toContain("no feedback or owner work to deliver");
    expect(first.summary).not.toContain("resolved");
    expect(
      existsSync(join(root, "generated", "agent-feedback", "aks-explorer.md")),
    ).toBe(false);
    const statePath = join(
      root,
      "generated",
      "agent-feedback",
      ".state",
      "aks-explorer.json",
    );
    const receipt = readFileSync(statePath, "utf8");
    expect(JSON.parse(receipt)).toEqual({
      sessionId: "s_1787409721879_11",
      createdAt: 1_787_409_896_450,
    });

    await expect(execute(ctx)).resolves.toMatchObject(expected);
    expect(readFileSync(statePath, "utf8")).toBe(receipt);
    expect(emitted).toEqual([]);
  });

  test("missing-target actionable evaluation remains blocked with finding artifact and verification context", async () => {
    const root = mkdtempSync(join(tmpdir(), "evaluation-feedback-missing-"));
    const verification =
      "Transcript read-back proves the concrete unsafe path remains present.";
    const ctx = createTestAppWorkflowContext({
      input: {
        feedbackKey: "retired-agent",
        evaluation: {
          sessionId: "s_actionable_missing_target",
          agent: "retired-agent",
          quality: 0.3,
          verdict: "needs_improvement",
          issues: ["UNSAFE_PATH: canonical path validation is missing."],
          overall: { evidence: [verification] },
          createdAt: 1_787_409_900_000,
        },
      },
      workspace: { root, output: join(root, ".output") },
    });

    await expect(execute(ctx)).resolves.toMatchObject({
      status: "blocked",
      summary:
        "Actionable evaluation s_actionable_missing_target cannot be delivered because no canonical active feedback target exists for retired-agent; the finding remains unresolved.",
      evidence: [
        "evaluated-session:s_actionable_missing_target",
        "feedback-target:missing:retired-agent",
        "feedback-target-verified:retired-agent",
        `evaluation-verification:${verification}`,
      ],
    });
    expect(
      existsSync(
        join(
          root,
          "generated",
          "agent-feedback",
          ".state",
          "retired-agent.json",
        ),
      ),
    ).toBe(false);
  });

  test("blocks when no bounded App workspace is allocated", async () => {
    const ctx = createTestAppWorkflowContext({
      input: {
        feedbackKey: "sample",
        evaluation: {
          sessionId: "s_latest",
          agent: "sample",
          quality: 0.4,
          verdict: "needs_improvement",
          issues: ["issue"],
        },
      },
    });

    await expect(execute(ctx)).resolves.toMatchObject({
      status: "blocked",
      summary:
        "evaluation-feedback-projection requires an allocated App workspace",
    });
  });

  test("rejects a feedback key that could escape the generated projection directory", async () => {
    const { root } = workspace();
    const ctx = createTestAppWorkflowContext({
      input: {
        feedbackKey: "../may",
        evaluation: {
          sessionId: "s_latest",
          agent: "may",
          quality: 0.4,
          verdict: "needs_improvement",
          issues: ["issue"],
        },
      },
      workspace: { root, output: join(root, ".output") },
    });

    await expect(execute(ctx)).resolves.toMatchObject({
      status: "blocked",
      summary: "Feedback key for may is invalid; no projection changed.",
    });
    expect(existsSync(join(root, "may.md"))).toBe(false);
  });
});
