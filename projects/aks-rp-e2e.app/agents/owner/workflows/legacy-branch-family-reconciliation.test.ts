import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkflowContext } from "@may-agent/sdk";
import { execute } from "./legacy-branch-family-reconciliation.ts";

const roots: string[] = [];

function context(input: {
  repo: string;
  workspace: string;
  taskInput: Record<string, unknown>;
  agent: WorkflowContext["agents"]["call"];
}) {
  return {
    input: input.taskInput,
    reconciliation: {
      appId: "aks-rp-e2e",
      taskId: "ops/legacy-family",
      generation: 1,
      resourceVersion: 1,
      owner: "aks-explorer",
      mode: "achieve",
      outcome: "Reconcile one legacy branch family",
      acceptance: ["The represented refs are closed safely."],
      input: input.taskInput,
      children: { live: [], completed: [] },
    },
    workspace: {
      appRoot: `${input.repo}.app`,
      projectRoot: input.repo,
      root: input.workspace,
      output: input.workspace,
    },
    agents: { call: input.agent },
    done(summary: string, output?: unknown) {
      return {
        id: "workflow:test",
        kind: "workflow",
        status: "done",
        summary,
        output,
      };
    },
    blocked(reason: string, evidence?: unknown) {
      return {
        id: "workflow:test",
        kind: "workflow",
        status: "blocked",
        summary: reason,
        evidence,
      };
    },
  } as WorkflowContext;
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("legacy branch family reconciliation", () => {
  test("fast-forwards dev and removes represented source refs after review", async () => {
    const root = mkdtempSync(join(tmpdir(), "aks-legacy-family-"));
    roots.push(root);
    const remote = join(root, "remote.git");
    const repo = join(root, "repo");
    const workspace = join(root, "workspace");
    execFileSync("git", ["init", "--bare", remote]);
    execFileSync("git", ["clone", remote, repo]);
    git(repo, "switch", "-c", "dev");
    git(repo, "config", "user.email", "test@example.com");
    git(repo, "config", "user.name", "Test");
    writeFileSync(join(repo, "README.md"), "base\n");
    git(repo, "add", ".");
    git(repo, "commit", "-m", "base");
    git(repo, "push", "-u", "origin", "dev");
    git(repo, "switch", "-c", "task/source");
    mkdirSync(join(repo, "features", "localdns"), { recursive: true });
    writeFileSync(
      join(repo, "features", "localdns", "change.txt"),
      "accepted\n",
    );
    writeFileSync(
      join(repo, "features", "localdns", "already-integrated.txt"),
      "already integrated\n",
    );
    git(repo, "add", ".");
    git(repo, "commit", "-m", "accepted change");
    const sourceHead = git(repo, "rev-parse", "HEAD");
    git(repo, "push", "-u", "origin", "task/source");
    git(repo, "switch", "dev");
    mkdirSync(join(repo, "features", "localdns"), { recursive: true });
    writeFileSync(
      join(repo, "features", "localdns", "already-integrated.txt"),
      "already integrated\n",
    );
    git(repo, "add", ".");
    git(repo, "commit", "-m", "integrate one source concern independently");
    git(repo, "push", "origin", "dev");
    git(repo, "worktree", "add", "-b", "task/review", workspace, "origin/dev");

    const taskInput = {
      branches: [
        {
          branch: "task/source",
          head: sourceHead,
          files: [
            "features/localdns/change.txt",
            "features/localdns/already-integrated.txt",
          ],
        },
      ],
    };
    const result = await execute(
      context({
        repo,
        workspace,
        taskInput,
        agent: async () => {
          writeFileSync(
            join(workspace, "features", "localdns", "change.txt"),
            "accepted\n",
          );
          git(workspace, "add", ".");
          git(workspace, "commit", "-m", "integrate remaining source concern");
          return {
            status: "done",
            id: "review-session",
            kind: "agent",
            summary: "accepted",
            output: {
              decision: "integrate",
              summary: "Accepted the localdns change.",
              evidence: ["features/localdns/change.txt"],
              verification: ["fixture-pass"],
              branchDecisions: [
                {
                  branch: "task/source",
                  head: sourceHead,
                  disposition: "represented",
                  reason: "The reviewed patch is the final coherent change.",
                },
              ],
            },
          };
        },
      }),
    );

    expect(result).toMatchObject({
      status: "done",
      output: { state: "converged" },
    });
    git(repo, "fetch", "origin", "dev");
    expect(git(repo, "rev-parse", "origin/dev")).toBe(
      git(workspace, "rev-parse", "HEAD"),
    );
    expect(git(repo, "branch", "--list", "task/source")).toBe("");
    expect(git(repo, "branch", "-r", "--list", "origin/task/source")).toBe("");
  });

  test("hands back to owner when origin dev advances during review", async () => {
    const root = mkdtempSync(join(tmpdir(), "aks-legacy-family-"));
    roots.push(root);
    const remote = join(root, "remote.git");
    const repo = join(root, "repo");
    const workspace = join(root, "workspace");
    execFileSync("git", ["init", "--bare", remote]);
    execFileSync("git", ["clone", remote, repo]);
    git(repo, "switch", "-c", "dev");
    git(repo, "config", "user.email", "test@example.com");
    git(repo, "config", "user.name", "Test");
    writeFileSync(join(repo, "README.md"), "base\n");
    git(repo, "add", ".");
    git(repo, "commit", "-m", "base");
    git(repo, "push", "-u", "origin", "dev");
    const baseHead = git(repo, "rev-parse", "HEAD");
    git(repo, "switch", "-c", "task/source");
    mkdirSync(join(repo, "features", "app-monitoring"), { recursive: true });
    writeFileSync(
      join(repo, "features", "app-monitoring", "change.txt"),
      "candidate\n",
    );
    git(repo, "add", ".");
    git(repo, "commit", "-m", "candidate change");
    const sourceHead = git(repo, "rev-parse", "HEAD");
    git(repo, "push", "-u", "origin", "task/source");
    git(repo, "switch", "dev");
    git(repo, "worktree", "add", "-b", "task/review", workspace, "origin/dev");

    const result = await execute(
      context({
        repo,
        workspace,
        taskInput: {
          branches: [
            {
              branch: "task/source",
              head: sourceHead,
              files: ["features/app-monitoring/change.txt"],
            },
          ],
        },
        agent: async () => {
          writeFileSync(join(repo, "README.md"), "base\nnew dev work\n");
          git(repo, "add", ".");
          git(repo, "commit", "-m", "advance dev");
          git(repo, "push", "origin", "HEAD:dev");
          return {
            status: "done",
            id: "review-session",
            kind: "agent",
            summary: "rejected",
            output: {
              decision: "reject",
              summary: "Rejected stale app-monitoring branch.",
              evidence: ["features/app-monitoring/change.txt"],
              verification: ["fixture-pass"],
              branchDecisions: [
                {
                  branch: "task/source",
                  head: sourceHead,
                  disposition: "rejected",
                  reason: "The candidate is superseded by current coverage.",
                },
              ],
            },
          };
        },
      }),
    );

    expect(result).toMatchObject({
      status: "done",
      output: {
        state: "needs-owner",
        evidence: expect.arrayContaining([
          `base-commit:${baseHead}`,
          `review-execution:review-session`,
        ]),
      },
    });
    expect(git(repo, "branch", "--list", "task/source")).toBe("task/source");
    expect(git(repo, "branch", "-r", "--list", "origin/task/source")).toBe(
      "origin/task/source",
    );
  });
});
