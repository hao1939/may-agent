import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkflowContext } from "@may-agent/sdk";
import { execute } from "./legacy-branch-family-reconciliation.ts";

const roots: string[] = [];

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

    const result = await execute({
      task: `## Reconciliation Task\n\`\`\`json\n${JSON.stringify({ input: { branches: [{ branch: "task/source", head: sourceHead, files: ["features/localdns/change.txt", "features/localdns/already-integrated.txt"] }] } })}\n\`\`\``,
      agent: "aks-explorer",
      projectDir: repo,
      workspaceDir: workspace,
      runAgent: (async () => {
        writeFileSync(
          join(workspace, "features", "localdns", "change.txt"),
          "accepted\n",
        );
        git(workspace, "add", ".");
        git(workspace, "commit", "-m", "integrate remaining source concern");
        return {
          status: "done",
          sessionId: "review-session",
          lastAssistantText: "accepted",
          messages: [],
          duration: "1s",
          outputDir: root,
          structuredResult: {
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
      }) as WorkflowContext["runAgent"],
      done: (summary, output) => ({ type: "done", summary, output }),
      blocked: (reason, context) => ({ type: "blocked", reason, context }),
    } as WorkflowContext);

    expect(result).toMatchObject({
      type: "done",
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

    const result = await execute({
      task: `## Reconciliation Task\n\`\`\`json\n${JSON.stringify({ input: { branches: [{ branch: "task/source", head: sourceHead, files: ["features/app-monitoring/change.txt"] }] } })}\n\`\`\``,
      agent: "aks-explorer",
      projectDir: repo,
      workspaceDir: workspace,
      runAgent: (async () => {
        writeFileSync(join(repo, "README.md"), "base\nnew dev work\n");
        git(repo, "add", ".");
        git(repo, "commit", "-m", "advance dev");
        git(repo, "push", "origin", "HEAD:dev");
        return {
          status: "done",
          sessionId: "review-session",
          lastAssistantText: "rejected",
          messages: [],
          duration: "1s",
          outputDir: root,
          structuredResult: {
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
      }) as WorkflowContext["runAgent"],
      done: (summary, output) => ({ type: "done", summary, output }),
      blocked: (reason, context) => ({ type: "blocked", reason, context }),
    } as WorkflowContext);

    expect(result).toMatchObject({
      type: "done",
      output: {
        state: "needs-owner",
        evidence: expect.arrayContaining([
          `base-commit:${baseHead}`,
          `review-session:review-session`,
        ]),
      },
    });
    expect(git(repo, "branch", "--list", "task/source")).toBe("task/source");
    expect(git(repo, "branch", "-r", "--list", "origin/task/source")).toBe(
      "origin/task/source",
    );
  });
});
