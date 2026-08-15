import { afterEach, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TaskReconciliationChild, WorkflowContext } from "@may-agent/sdk";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import {
  execute,
  retryableAttentionSummary,
} from "./legacy-branch-reconciliation-controller.ts";

const roots: string[] = [];

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
  }).trim();
}

function repository(withSource = true): {
  repo: string;
  sourceHead?: string;
} {
  const root = mkdtempSync(join(tmpdir(), "aks-legacy-controller-"));
  roots.push(root);
  const repo = join(root, "repo");
  execFileSync("git", ["init", "-b", "dev", repo]);
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Test");
  writeFileSync(join(repo, "README.md"), "base\n");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "base");
  git(repo, "branch", "origin/dev");
  if (!withSource) return { repo };
  git(repo, "switch", "-c", "task/source");
  writeFileSync(join(repo, "source.txt"), "source\n");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "source");
  const sourceHead = git(repo, "rev-parse", "HEAD");
  git(repo, "switch", "dev");
  return { repo, sourceHead };
}

function context(
  repo: string,
  children: {
    live?: TaskReconciliationChild[];
    completed?: TaskReconciliationChild[];
  } = {},
): WorkflowContext {
  const input = { frontierLimit: 1 };
  return createTestAppWorkflowContext({
    input,
    reconciliation: {
      appId: "aks-rp-e2e",
      taskId: "legacy-branch-reconciliation",
      generation: 1,
      resourceVersion: 1,
      owner: "app-ops",
      mode: "maintain",
      outcome: "Reconcile retained legacy branches.",
      acceptance: [],
      input,
      children: {
        live: children.live ?? [],
        completed: children.completed ?? [],
      },
    },
    workspace: {
      appRoot: "/app",
      projectRoot: repo,
      root: repo,
      output: "/tmp",
    },
  });
}

function child(
  overrides: Partial<TaskReconciliationChild> = {},
): TaskReconciliationChild {
  return {
    taskId: "ops/verify-source",
    generation: 1,
    outcome: "Verify source",
    evidence: [],
    owner: "aks-explorer",
    workflow: "legacy-branch-verification",
    status: "waiting",
    ...overrides,
  };
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

test("retries only known recoverable attention summaries", () => {
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

test("declares one exact verification child under the standing controller", async () => {
  const { repo, sourceHead } = repository();
  const result = await execute(context(repo));

  expect(result).toMatchObject({
    status: "done",
    output: {
      state: "waiting",
      actions: [
        expect.objectContaining({
          kind: "create-task",
          parentId: "legacy-branch-reconciliation",
          workflow: "legacy-branch-verification",
          outputs: ["source.txt"],
          input: {
            loopId: "legacy-branch-reconciliation",
            workKey: "task/source",
            workRevision: expect.any(String),
            baseRef: "origin/dev",
            branches: [
              {
                branch: "task/source",
                head: sourceHead,
                files: ["source.txt"],
              },
            ],
          },
        }),
      ],
    },
  });
});

test("waits from bounded child state without reading the global task tree", async () => {
  const { repo } = repository();
  const result = await execute(context(repo, { live: [child()] }));

  expect(result).toMatchObject({
    status: "done",
    output: {
      state: "waiting",
      actions: [],
      evidence: ["child:ops/verify-source@1:waiting"],
    },
  });
});

test("unblocks a retryable attention child using its fenced generation", async () => {
  const { repo } = repository();
  const result = await execute(
    context(repo, {
      live: [
        child({
          status: "attention",
          generation: 7,
          summary:
            "Legacy branch base changed; retry verification against current origin/dev",
        }),
      ],
    }),
  );

  expect(result).toMatchObject({
    status: "done",
    output: {
      state: "waiting",
      actions: [
        {
          kind: "unblock-task",
          taskId: "ops/verify-source",
          expectedGeneration: 7,
          reason:
            "Retry the same branch verification against current origin/dev",
        },
      ],
    },
  });
});

test("surfaces completed-child and remaining-branch disagreement", async () => {
  const { repo, sourceHead } = repository();
  const first = await execute(context(repo));
  const taskId = (first.output as { actions: Array<{ id: string }> })
    .actions[0]!.id;
  const result = await execute(
    context(repo, {
      completed: [
        child({
          taskId,
          status: "done",
          completedAt: "2026-08-15T00:00:00.000Z",
        }),
      ],
    }),
  );

  expect(result).toMatchObject({
    status: "done",
    output: {
      state: "needs-owner",
      evidence: [
        `completed-child:${taskId}`,
        `remaining-branch:task/source@${sourceHead}`,
      ],
    },
  });
});

test("converges when Git has no unattached novel branch", async () => {
  const { repo } = repository(false);
  const result = await execute(context(repo));
  expect(result).toMatchObject({
    status: "done",
    output: {
      state: "converged",
      evidence: ["base-ref:origin/dev", "unattached-novel-branches:0"],
      actions: [],
    },
  });
});
