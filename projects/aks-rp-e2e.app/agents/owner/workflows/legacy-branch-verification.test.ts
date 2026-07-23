import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { WorkflowContext } from "@may-agent/sdk";
import {
  executeWithVerifier,
  type LegacyCandidateVerifier,
  type LegacyRepairAgent,
} from "./legacy-branch-verification.ts";

const roots: string[] = [];

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
  }).trim();
}

function write(repo: string, path: string, content: string): void {
  const target = join(repo, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function commit(repo: string, message: string): string {
  git(repo, "add", ".");
  git(repo, "commit", "-m", message);
  return git(repo, "rev-parse", "HEAD");
}

type Fixture = {
  repo: string;
  workspace: string;
  sourceHead: string;
  baseHead: string;
  context: WorkflowContext;
};

function fixture(options: { devChange?: string } = {}): Fixture {
  const root = mkdtempSync(join(tmpdir(), "aks-legacy-workflow-"));
  roots.push(root);
  const remote = join(root, "remote.git");
  const repo = join(root, "repo");
  const workspace = join(root, "workspace");
  execFileSync("git", ["init", "--bare", remote]);
  execFileSync("git", ["clone", remote, repo]);
  git(repo, "switch", "-c", "dev");
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Test");
  write(repo, "shared.txt", "base\n");
  commit(repo, "base");
  git(repo, "push", "-u", "origin", "dev");
  git(repo, "switch", "-c", "task/source");
  write(repo, "shared.txt", options.devChange ? "source\n" : "base\n");
  write(repo, "candidate.txt", "candidate\n");
  const sourceHead = commit(repo, "source candidate");
  git(repo, "push", "-u", "origin", "task/source");
  git(repo, "switch", "dev");
  if (options.devChange) {
    write(repo, "shared.txt", options.devChange);
    commit(repo, "advance dev with conflicting change");
    git(repo, "push", "origin", "dev");
  }
  const baseHead = git(repo, "rev-parse", "HEAD");
  git(repo, "worktree", "add", "-b", "task/review", workspace, "origin/dev");
  const context = {
    task: `## Reconciliation Task\n\`\`\`json\n${JSON.stringify({ input: { branches: [{ branch: "task/source", head: sourceHead, files: ["candidate.txt"] }] } })}\n\`\`\``,
    agent: "aks-explorer",
    projectDir: repo,
    workspaceDir: workspace,
    done: (summary, output) => ({ type: "done", summary, output }),
    blocked: (reason, context) => ({ type: "blocked", reason, context }),
  } as WorkflowContext;
  return { repo, workspace, sourceHead, baseHead, context };
}

const baseline = () => ({
  scenarioDebt: new Set<string>(),
  runnerDebt: new Set<string>(),
  steps: [],
});

const passingVerifier: LegacyCandidateVerifier = (
  workspaceDir,
  _repo,
  base,
) => ({
  passed: true,
  changedFiles: git(workspaceDir, "diff", "--name-only", base, "HEAD")
    .split("\n")
    .filter(Boolean),
  steps: [
    { label: "fixture", command: "fixture verify", status: 0, output: "pass" },
  ],
});

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("legacy branch verification workflow", () => {
  test("merges a passing branch and removes its source refs", async () => {
    const value = fixture();
    const result = await executeWithVerifier(
      value.context,
      passingVerifier,
      baseline,
    );

    expect(result).toMatchObject({
      type: "done",
      output: { state: "converged" },
    });
    git(value.repo, "fetch", "origin", "dev");
    expect(git(value.repo, "show", "origin/dev:candidate.txt")).toBe(
      "candidate",
    );
    expect(git(value.repo, "branch", "--list", "task/source")).toBe("");
    expect(
      git(value.repo, "ls-remote", "--heads", "origin", "task/source"),
    ).toBe("");
  });

  test("removes an already represented branch without an empty merge", async () => {
    const value = fixture();
    git(value.repo, "merge", "--ff-only", "task/source");
    git(value.repo, "push", "origin", "dev");
    git(value.workspace, "reset", "--hard", "origin/dev");
    const representedHead = git(value.repo, "rev-parse", "dev");

    const result = await executeWithVerifier(
      value.context,
      passingVerifier,
      baseline,
    );

    expect(result).toMatchObject({
      type: "done",
      output: { state: "converged" },
    });
    expect(git(value.repo, "rev-parse", "origin/dev")).toBe(representedHead);
    expect(git(value.repo, "branch", "--list", "task/source")).toBe("");
    expect(
      git(value.repo, "ls-remote", "--heads", "origin", "task/source"),
    ).toBe("");
  });

  test("feeds failed verification back to the agent and verifies the repaired candidate", async () => {
    const value = fixture();
    let verificationCount = 0;
    const repairingVerifier: LegacyCandidateVerifier = () => {
      verificationCount += 1;
      return {
        passed: verificationCount > 1,
        changedFiles: ["candidate.txt", "repair.txt"],
        reason:
          verificationCount > 1
            ? undefined
            : "Verification failed: changed-feature-tests",
        steps: [
          {
            label: "changed-feature-tests",
            command: "bun test ./candidate.test.ts --timeout 30000",
            status: verificationCount > 1 ? 0 : 1,
            output: verificationCount > 1 ? "pass" : "boom",
          },
        ],
      };
    };
    const repairAgent: LegacyRepairAgent = async (request) => {
      expect(request.cause).toBe("verification-failure");
      write(request.workspaceDir, "repair.txt", "fixed\n");
      commit(request.workspaceDir, "repair failing verification");
      return {
        decision: "repaired",
        summary: "Repaired the failing candidate.",
        evidence: ["repair:fixture"],
      };
    };

    const result = await executeWithVerifier(
      value.context,
      repairingVerifier,
      baseline,
      repairAgent,
    );

    expect(result).toMatchObject({
      type: "done",
      output: {
        state: "converged",
        evidence: expect.arrayContaining([
          "repair-iteration:1:repaired:Repaired the failing candidate.",
          "repair:fixture",
        ]),
      },
    });
    expect(git(value.repo, "show", "origin/dev:repair.txt")).toBe("fixed");
    expect(git(value.repo, "branch", "--list", "task/source")).toBe("");
  });

  test("feeds a merge conflict to the agent and verifies the repaired candidate", async () => {
    const value = fixture({ devChange: "dev\n" });
    const repairAgent: LegacyRepairAgent = async (request) => {
      expect(request.cause).toBe("merge-conflict");
      expect(request.conflicts).toEqual(["shared.txt"]);
      write(request.workspaceDir, "shared.txt", "resolved\n");
      git(request.workspaceDir, "add", "shared.txt", "candidate.txt");
      git(request.workspaceDir, "commit", "-m", "resolve source conflict");
      return {
        decision: "repaired",
        summary: "Resolved the current source intent against dev.",
        evidence: ["conflict:shared.txt:resolved"],
      };
    };
    const result = await executeWithVerifier(
      value.context,
      passingVerifier,
      baseline,
      repairAgent,
    );

    expect(result).toMatchObject({
      type: "done",
      output: {
        state: "converged",
        evidence: expect.arrayContaining([
          "repair-iteration:1:repaired:Resolved the current source intent against dev.",
          "conflict:shared.txt:resolved",
        ]),
      },
    });
    expect(git(value.repo, "show", "origin/dev:shared.txt")).toBe("resolved");
    expect(git(value.repo, "branch", "--list", "task/source")).toBe("");
    expect(
      git(value.repo, "ls-remote", "--heads", "origin", "task/source"),
    ).toBe("");
    expect(git(value.workspace, "status", "--porcelain=v1")).toBe("");
  });

  test("tells the repair agent to reject superseded conflict source without committing it", async () => {
    const value = fixture({ devChange: "dev\n" });
    let prompt = "";
    value.context.runAgent = (async (_agent, task) => {
      prompt = task;
      git(value.workspace, "merge", "--abort");
      return {
        status: "done",
        sessionId: "repair-reject",
        structuredResult: {
          decision: "reject",
          summary: "The source is superseded by current dev.",
          evidence: ["source:superseded"],
        },
      };
    }) as WorkflowContext["runAgent"];

    const result = await executeWithVerifier(
      value.context,
      passingVerifier,
      baseline,
    );

    expect(prompt).toContain(
      "If the source is stale, duplicated, incorrect, or superseded, abort the merge and return reject with a clean worktree.",
    );
    expect(prompt).not.toContain("resolve the useful current result, commit it");
    expect(result).toMatchObject({
      type: "done",
      output: {
        state: "converged",
        evidence: expect.arrayContaining(["source:superseded"]),
      },
    });
    expect(git(value.workspace, "status", "--porcelain=v1")).toBe("");
    expect(git(value.repo, "branch", "--list", "task/source")).toBe("");
  });

  test("uses bare needs-owner only after the repair agent cannot decide safely", async () => {
    const value = fixture({ devChange: "dev\n" });
    const result = await executeWithVerifier(
      value.context,
      passingVerifier,
      baseline,
      async () => ({
        decision: "needs-owner",
        summary: "The source intent is ambiguous.",
        evidence: ["ambiguity:shared-contract"],
      }),
    );

    expect(result).toMatchObject({
      type: "done",
      output: {
        state: "needs-owner",
        evidence: expect.arrayContaining(["ambiguity:shared-contract"]),
      },
    });
    expect(
      (result as { output?: { actions?: unknown } }).output?.actions,
    ).toBeUndefined();
    expect(git(value.workspace, "status", "--porcelain=v1")).toBe("");
    expect(git(value.workspace, "rev-parse", "HEAD")).toBe(value.baseHead);
  });
});
