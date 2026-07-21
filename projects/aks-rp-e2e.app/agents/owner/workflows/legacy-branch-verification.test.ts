import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { WorkflowContext } from "@may-agent/sdk";
import {
  executeWithVerifier,
  type LegacyCandidateVerifier,
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

  test("keeps source refs and restores a clean workspace on conflict", async () => {
    const value = fixture({ devChange: "dev\n" });
    const result = await executeWithVerifier(
      value.context,
      passingVerifier,
      baseline,
    );

    expect(result).toMatchObject({
      type: "blocked",
      reason: "Legacy branch merge conflict requires focused repair",
      context: { conflicts: ["shared.txt"] },
    });
    expect(git(value.repo, "branch", "--list", "task/source")).toBe(
      "task/source",
    );
    expect(
      git(value.repo, "ls-remote", "--heads", "origin", "task/source"),
    ).not.toBe("");
    expect(git(value.workspace, "status", "--porcelain=v1")).toBe("");
    expect(git(value.workspace, "rev-parse", "HEAD")).toBe(value.baseHead);
  });
});
