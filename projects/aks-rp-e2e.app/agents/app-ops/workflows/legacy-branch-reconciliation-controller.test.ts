import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkflowContext } from "@may-agent/sdk";
import {
  execute,
  integratedAttentionSourceReady,
  patchEquivalentAttentionSourceReady,
  retryableAttentionSummary,
} from "./legacy-branch-reconciliation-controller.ts";

const roots: string[] = [];

test("retries hard-admission repair and transient workspace failures", () => {
  expect(
    retryableAttentionSummary(
      "Handler result was rejected: evidence exceeds the 32-entry limit",
    ),
  ).toBe(true);
  expect(
    retryableAttentionSummary(
      "Task workspace preparation failed: git fetch origin dev returned 503",
    ),
  ).toBe(true);
  expect(
    retryableAttentionSummary(
      "Task workspace preparation failed: task branch name is invalid",
    ),
  ).toBe(false);
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
}

function patchEquivalentFixture(prefix: string): {
  root: string;
  repo: string;
  sourceHead: string;
} {
  const root = mkdtempSync(join(tmpdir(), prefix));
  roots.push(root);
  const repo = join(root, "repo");
  execFileSync("git", ["init", "-b", "dev", repo]);
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Test");
  writeFileSync(join(repo, "README.md"), "base\n");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "base");
  git(repo, "switch", "-c", "task/equivalent");
  writeFileSync(join(repo, "one.txt"), "one\n");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "first source change");
  const firstSource = git(repo, "rev-parse", "HEAD");
  writeFileSync(join(repo, "two.txt"), "two\n");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "second source change");
  const sourceHead = git(repo, "rev-parse", "HEAD");
  git(repo, "switch", "dev");
  writeFileSync(join(repo, "base-only.txt"), "diverge hashes\n");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "independent base change");
  git(repo, "cherry-pick", firstSource, sourceHead);
  git(repo, "branch", "origin/dev");
  return { root, repo, sourceHead };
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

test("declares one exact-branch verification from current Git state", async () => {
  const root = mkdtempSync(join(tmpdir(), "aks-legacy-controller-"));
  roots.push(root);
  const repo = join(root, "repo");
  const appDir = join(root, "app");
  execFileSync("git", ["init", "-b", "dev", repo]);
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Test");
  writeFileSync(join(repo, "README.md"), "base\n");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "base");
  git(repo, "branch", "origin/dev");
  git(repo, "switch", "-c", "task/one");
  mkdirSync(join(repo, "features", "localdns", "specs"), { recursive: true });
  writeFileSync(
    join(repo, "features", "localdns", "specs", "one.json"),
    "{}\n",
  );
  git(repo, "add", ".");
  git(repo, "commit", "-m", "localdns change");
  git(repo, "switch", "dev");
  git(repo, "switch", "-c", "task/two");
  mkdirSync(join(repo, "features", "localdns", "specs"), { recursive: true });
  writeFileSync(
    join(repo, "features", "localdns", "specs", "two.json"),
    "{}\n",
  );
  git(repo, "add", ".");
  git(repo, "commit", "-m", "second localdns change");
  git(repo, "switch", "dev");
  mkdirSync(join(appDir, ".state", "tasks"), { recursive: true });
  writeFileSync(
    join(appDir, ".state", "tasks", "tree.json"),
    JSON.stringify({ tasks: {} }),
  );

  const result = await execute({
    task: "frontierLimit: 3",
    agent: "app-ops",
    appDir,
    projectDir: repo,
    workspaceDir: repo,
    done: (summary, output) => ({ type: "done", summary, output }),
  } as WorkflowContext);

  expect(result).toMatchObject({
    type: "done",
    output: {
      state: "converged",
      actions: [
        expect.objectContaining({
          kind: "create-task",
          workflow: "legacy-branch-verification",
          input: expect.objectContaining({
            workKey: "task/one",
            branches: [expect.objectContaining({ branch: "task/one" })],
          }),
        }),
      ],
    },
  });

  writeFileSync(
    join(appDir, ".state", "tasks", "tree.json"),
    JSON.stringify({
      tasks: {
        "ops/retry-localdns": {
          generation: 1,
          phase: "attention",
          summary: "Legacy branch merge conflict requires focused repair",
          input: {
            loopId: "legacy-branch-reconciliation",
            workKey: "localdns",
            branches: [
              {
                branch: "task/one",
                head: git(repo, "rev-parse", "task/one"),
              },
            ],
          },
        },
      },
    }),
  );
  const retry = await execute({
    task: "frontierLimit: 1",
    agent: "app-ops",
    appDir,
    projectDir: repo,
    workspaceDir: repo,
    done: (summary, output) => ({ type: "done", summary, output }),
  } as WorkflowContext);
  expect(retry).toMatchObject({
    type: "done",
    output: {
      actions: [
        {
          kind: "unblock-task",
          taskId: "ops/retry-localdns",
          expectedGeneration: 1,
        },
      ],
    },
  });
  expect(
    (retry as { output?: { actions?: unknown[] } }).output?.actions,
  ).toHaveLength(1);
});

test("replays the same attention task when its absent source is already integrated", async () => {
  const root = mkdtempSync(join(tmpdir(), "aks-legacy-controller-stale-"));
  roots.push(root);
  const repo = join(root, "repo");
  const appDir = join(root, "app");
  execFileSync("git", ["init", "-b", "dev", repo]);
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Test");
  writeFileSync(join(repo, "README.md"), "base\n");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "base");
  git(repo, "branch", "origin/dev");
  git(repo, "switch", "-c", "task/integrated");
  writeFileSync(join(repo, "integrated.txt"), "integrated\n");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "integrated source");
  const sourceHead = git(repo, "rev-parse", "HEAD");
  git(repo, "switch", "dev");
  git(repo, "merge", "--ff-only", "task/integrated");
  git(repo, "branch", "-f", "origin/dev", "dev");
  git(repo, "branch", "-D", "task/integrated");

  const taskId = "ops/stale-integrated-source";
  const task = {
    generation: 1,
    phase: "attention",
    summary: "Handler result was rejected: evidence exceeds the 32-entry limit",
    input: {
      loopId: "legacy-branch-reconciliation",
      workKey: "task/integrated",
      branches: [{ branch: "task/integrated", head: sourceHead }],
    },
  };
  mkdirSync(join(appDir, ".state", "tasks"), { recursive: true });
  writeFileSync(
    join(appDir, ".state", "tasks", "tree.json"),
    JSON.stringify({ tasks: { [taskId]: task } }),
  );

  expect(integratedAttentionSourceReady(repo, task)).toBe(true);
  const result = await execute({
    task: "frontierLimit: 1",
    agent: "app-ops",
    appDir,
    projectDir: repo,
    workspaceDir: repo,
    done: (summary, output) => ({ type: "done", summary, output }),
  } as WorkflowContext);

  expect(result).toMatchObject({
    type: "done",
    output: {
      actions: [
        {
          kind: "unblock-task",
          taskId,
          expectedGeneration: 1,
          reason:
            "Reconcile the same task after its recorded source commit reached origin/dev",
        },
      ],
    },
  });
});

test("replays the same task when every recorded source commit is patch-equivalent", async () => {
  const { root, repo, sourceHead } = patchEquivalentFixture(
    "aks-legacy-controller-equivalent-",
  );
  const appDir = join(root, "app");
  const taskId = "ops/patch-equivalent-source";
  const task = {
    generation: 1,
    phase: "attention",
    summary: "Legacy branch merge conflict requires focused repair",
    input: {
      loopId: "legacy-branch-reconciliation",
      workKey: "task/equivalent",
      branches: [{ branch: "task/equivalent", head: sourceHead }],
    },
  };
  git(repo, "switch", "-c", "task/novel");
  writeFileSync(join(repo, "novel.txt"), "novel\n");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "novel retry source");
  const novelHead = git(repo, "rev-parse", "HEAD");
  git(repo, "switch", "dev");
  mkdirSync(join(appDir, ".state", "tasks"), { recursive: true });
  writeFileSync(
    join(appDir, ".state", "tasks", "tree.json"),
    JSON.stringify({
      tasks: {
        "ops/aaa-ordinary-retry": {
          generation: 1,
          phase: "attention",
          summary: "Legacy branch merge conflict requires focused repair",
          input: {
            loopId: "legacy-branch-reconciliation",
            workKey: "task/novel",
            branches: [{ branch: "task/novel", head: novelHead }],
          },
        },
        [taskId]: task,
      },
    }),
  );

  expect(git(repo, "cherry", "origin/dev", "task/equivalent")).toMatch(
    /(^|\n)- [0-9a-f]{40}/,
  );
  expect(patchEquivalentAttentionSourceReady(repo, task)).toBe(true);
  const result = await execute({
    task: "frontierLimit: 1",
    agent: "app-ops",
    appDir,
    projectDir: repo,
    workspaceDir: repo,
    done: (summary, output) => ({ type: "done", summary, output }),
  } as WorkflowContext);

  expect(result).toMatchObject({
    type: "done",
    output: {
      actions: [
        {
          kind: "unblock-task",
          taskId,
          expectedGeneration: 1,
          reason:
            "Reconcile the same task after its recorded source became patch-equivalent to origin/dev",
        },
      ],
    },
  });
});

test("does not replay a source when any commit is not patch-equivalent", () => {
  const { repo, sourceHead } = patchEquivalentFixture(
    "aks-legacy-controller-partial-",
  );
  git(repo, "switch", "task/equivalent");
  writeFileSync(join(repo, "novel.txt"), "novel\n");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "novel source change");
  const novelHead = git(repo, "rev-parse", "HEAD");
  git(repo, "switch", "dev");

  expect(sourceHead).not.toBe(novelHead);
  expect(
    patchEquivalentAttentionSourceReady(repo, {
      input: {
        branches: [{ branch: "task/equivalent", head: novelHead }],
      },
    }),
  ).toBe(false);
});

test("preserves moved, attached, and dirty patch-equivalent sources", () => {
  const { root, repo, sourceHead } = patchEquivalentFixture(
    "aks-legacy-controller-equivalent-safety-",
  );
  const task = {
    input: {
      branches: [{ branch: "task/equivalent", head: sourceHead }],
    },
  };

  const attached = join(root, "attached-equivalent");
  git(repo, "worktree", "add", attached, "task/equivalent");
  expect(patchEquivalentAttentionSourceReady(repo, task)).toBe(false);
  git(repo, "worktree", "remove", attached);

  const dirty = join(root, "dirty-equivalent");
  git(repo, "worktree", "add", "--detach", dirty, sourceHead);
  writeFileSync(join(dirty, "uncommitted.txt"), "keep\n");
  expect(patchEquivalentAttentionSourceReady(repo, task)).toBe(false);
  git(repo, "worktree", "remove", "--force", dirty);

  git(repo, "branch", "-f", "task/equivalent", "origin/dev");
  expect(patchEquivalentAttentionSourceReady(repo, task)).toBe(false);
});

test("does not replay an absent source without integration proof", () => {
  const root = mkdtempSync(join(tmpdir(), "aks-legacy-controller-absent-"));
  roots.push(root);
  const repo = join(root, "repo");
  execFileSync("git", ["init", "-b", "dev", repo]);
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Test");
  writeFileSync(join(repo, "README.md"), "base\n");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "base");
  git(repo, "branch", "origin/dev");
  git(repo, "switch", "-c", "task/lost");
  writeFileSync(join(repo, "lost.txt"), "lost\n");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "unintegrated source");
  const sourceHead = git(repo, "rev-parse", "HEAD");
  git(repo, "switch", "dev");
  git(repo, "branch", "-D", "task/lost");

  expect(
    integratedAttentionSourceReady(repo, {
      generation: 1,
      phase: "attention",
      input: {
        branches: [{ branch: "task/lost", head: sourceHead }],
      },
    }),
  ).toBe(false);
});

test("preserves attached and dirty source recovery worktrees", () => {
  const root = mkdtempSync(join(tmpdir(), "aks-legacy-controller-recovery-"));
  roots.push(root);
  const repo = join(root, "repo");
  execFileSync("git", ["init", "-b", "dev", repo]);
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Test");
  writeFileSync(join(repo, "README.md"), "base\n");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "base");
  git(repo, "switch", "-c", "task/source");
  writeFileSync(join(repo, "source.txt"), "source\n");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "source");
  const sourceHead = git(repo, "rev-parse", "HEAD");
  git(repo, "switch", "dev");
  git(repo, "merge", "--ff-only", "task/source");
  git(repo, "branch", "origin/dev");
  const task = {
    generation: 1,
    phase: "attention",
    input: { branches: [{ branch: "task/source", head: sourceHead }] },
  };

  const attached = join(root, "attached");
  git(repo, "worktree", "add", attached, "task/source");
  expect(integratedAttentionSourceReady(repo, task)).toBe(false);
  git(repo, "worktree", "remove", attached);
  git(repo, "branch", "-D", "task/source");

  const dirty = join(root, "dirty");
  git(repo, "worktree", "add", "--detach", dirty, sourceHead);
  writeFileSync(join(dirty, "uncommitted.txt"), "keep\n");
  expect(integratedAttentionSourceReady(repo, task)).toBe(false);
});

test("retries connection-error review when legacy verification already produced same-task owner judgment", async () => {
  const root = mkdtempSync(join(tmpdir(), "aks-legacy-controller-connection-"));
  roots.push(root);
  const repo = join(root, "repo");
  const appDir = join(root, "app");
  execFileSync("git", ["init", "-b", "dev", repo]);
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Test");
  writeFileSync(join(repo, "README.md"), "base\n");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "base");
  git(repo, "branch", "origin/dev");
  git(repo, "switch", "-c", "task/one");
  mkdirSync(join(repo, "features", "localdns", "specs"), { recursive: true });
  writeFileSync(
    join(repo, "features", "localdns", "specs", "one.json"),
    "{}\n",
  );
  git(repo, "add", ".");
  git(repo, "commit", "-m", "localdns change");
  git(repo, "switch", "dev");

  mkdirSync(join(appDir, ".state", "tasks"), { recursive: true });
  const taskId = "ops/retry-connection-error";
  writeFileSync(
    join(appDir, ".state", "tasks", "tree.json"),
    JSON.stringify({
      tasks: {
        [taskId]: {
          generation: 1,
          phase: "attention",
          summary: "Connection error.",
          input: {
            loopId: "legacy-branch-reconciliation",
            workKey: "task/one",
            branches: [
              {
                branch: "task/one",
                head: git(repo, "rev-parse", "task/one"),
              },
            ],
          },
        },
      },
    }),
  );
  writeFileSync(
    join(appDir, ".state", "tasks", "state.json"),
    JSON.stringify({
      attempts: {
        r_needs_owner: {
          taskId,
          handler: "workflow:legacy-branch-verification",
          summary:
            "Legacy branch merge conflict requires owner judgment in the same task.",
          failureReason: "needs-owner",
        },
        r_connection: {
          taskId,
          handler: "owner:aks-explorer",
          summary: "Connection error.",
          failureReason: "handler-blocked",
        },
      },
    }),
  );

  const retry = await execute({
    task: "frontierLimit: 1",
    agent: "app-ops",
    appDir,
    projectDir: repo,
    workspaceDir: repo,
    done: (summary, output) => ({ type: "done", summary, output }),
  } as WorkflowContext);

  expect(retry).toMatchObject({
    type: "done",
    output: {
      actions: [
        {
          kind: "unblock-task",
          taskId,
          expectedGeneration: 1,
        },
      ],
    },
  });
});
