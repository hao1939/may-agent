import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkflowContext } from "@may-agent/sdk";
import { execute } from "./legacy-branch-reconciliation-controller.ts";

const roots: string[] = [];

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
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
          summary: "Legacy branch family closeout failed safely",
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
});
