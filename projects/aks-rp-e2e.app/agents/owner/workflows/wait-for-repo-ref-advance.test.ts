import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  decideRepoRefAdvanceGate,
  execute,
  parseReconciliationTaskPayload,
  repoRefWaitExternalProducer,
  verify,
} from "./wait-for-repo-ref-advance.js";

function git(cwd: string, command: string): string {
  const proc = Bun.spawnSync(command.split(" "), {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(Buffer.from(proc.stderr).toString("utf8"));
  }
  return Buffer.from(proc.stdout).toString("utf8").trim();
}

describe("wait-for-repo-ref-advance workflow", () => {
  test("parses the reconciliation payload block", () => {
    const payload =
      parseReconciliationTaskPayload(`prefix\n## Reconciliation Task\n\
\
\
{\n  "taskId": "domain/example",\n  "input": { "baseRef": "origin/dev", "resumeBaselineCommit": "abc" },\n  "paths": { "projectDir": "/tmp/project" }\n}\n`);

    expect(payload).toMatchObject({
      taskId: "domain/example",
      input: {
        baseRef: "origin/dev",
        resumeBaselineCommit: "abc",
      },
      paths: { projectDir: "/tmp/project" },
    });
  });

  test("returns an exact waiting condition while the watched ref is unchanged", () => {
    const result = decideRepoRefAdvanceGate({
      taskId: "domain/example",
      repoRef: "origin/dev",
      baselineCommit: "abc",
      currentCommit: "abc",
      specId: "spec.localdns.vm-prerelease.enable-disable",
      sourceCommit: "def",
      publicationBranch: "aks-explorer/example",
    });

    expect(result).toMatchObject({
      state: "waiting",
      conditions: [
        {
          type: "aks.repo-ref.observed",
          subject: "repoRef:origin/dev",
          expected: { field: "commit", notEquals: "abc" },
        },
      ],
    });
  });

  test("rejects repo-ref waits that cite only generic origin/dev churn", () => {
    expect(
      repoRefWaitExternalProducer({
        taskId:
          "wait-compact-workload-autoscaler-package-partial-origin-dev-advance-780f3d01-20260727",
        repoRef: "origin/dev",
        baselineCommit: "780f3d01",
        specId: "spec.workload-autoscaler.keda-upgrade-survival",
        sourceCommit: "780f3d01",
        publicationBranch: "dev",
      }),
    ).toMatchObject({
      supported: false,
      reason: expect.stringContaining("generic origin/dev churn"),
    });
  });

  test("rejects normalization repo-ref waits that only point back to current dev", () => {
    expect(
      repoRefWaitExternalProducer({
        taskId:
          "wait-spec-network-acns-performance-cilium-upgrade-user-iptables-runtime-frontier-origin-dev-advance-5c252d46-20260727",
        repoRef: "origin/dev",
        baselineCommit: "5c252d46",
        specId: "spec.network-acns.performance-cilium-upgrade",
        sourceCommit: "5c252d46",
        publicationBranch: "dev",
      }),
    ).toMatchObject({
      supported: false,
      reason: expect.stringContaining("generic origin/dev churn"),
      evidence: expect.arrayContaining([
        "task:wait-spec-network-acns-performance-cilium-upgrade-user-iptables-runtime-frontier-origin-dev-advance-5c252d46-20260727",
        "spec-id:spec.network-acns.performance-cilium-upgrade",
      ]),
    });
  });

  test("accepts repo-ref waits that cite a concrete pending publication branch", () => {
    expect(
      repoRefWaitExternalProducer({
        taskId:
          "wait-compact-machines-agentpool-package-partial-origin-dev-advance-780f3d01-20260727",
        repoRef: "origin/dev",
        baselineCommit: "780f3d01",
        specId: "spec.nap.default-machines-pool-cleanup-full",
        sourceCommit: "e9694c11",
        publicationBranch:
          "aks-explorer/reconcile-machines-agentpool-nap-full-cleanup-direct-carrier-current-origin-dev-20260723",
      }),
    ).toMatchObject({
      supported: true,
      evidence: expect.arrayContaining([
        "source-commit:e9694c11",
        "pending-branch:aks-explorer/reconcile-machines-agentpool-nap-full-cleanup-direct-carrier-current-origin-dev-20260723",
      ]),
    });
  });

  test("uses a distinct Condition for each baseline commit", () => {
    const first = decideRepoRefAdvanceGate({
      taskId: "domain/example",
      repoRef: "origin/dev",
      baselineCommit: "abc",
      currentCommit: "abc",
    });
    const second = decideRepoRefAdvanceGate({
      taskId: "domain/example",
      repoRef: "origin/dev",
      baselineCommit: "def",
      currentCommit: "def",
    });

    expect(first.conditions?.[0]?.id).toBeTruthy();
    expect(second.conditions?.[0]?.id).toBeTruthy();
    expect(first.conditions?.[0]?.id).not.toBe(second.conditions?.[0]?.id);
  });

  test("uses a distinct Condition for different tasks on the same baseline", () => {
    const first = decideRepoRefAdvanceGate({
      taskId: "domain/example-a",
      repoRef: "origin/dev",
      baselineCommit: "abc",
      currentCommit: "abc",
    });
    const second = decideRepoRefAdvanceGate({
      taskId: "domain/example-b",
      repoRef: "origin/dev",
      baselineCommit: "abc",
      currentCommit: "abc",
    });

    expect(first.conditions?.[0]?.id).toBeTruthy();
    expect(second.conditions?.[0]?.id).toBeTruthy();
    expect(first.conditions?.[0]?.id).not.toBe(second.conditions?.[0]?.id);
  });

  test("hands the task back to the owner after the watched ref advances", () => {
    const result = decideRepoRefAdvanceGate({
      taskId: "domain/example",
      repoRef: "origin/dev",
      baselineCommit: "abc",
      currentCommit: "def",
      specId: "spec.localdns.vm-prerelease.enable-disable",
    });

    expect(result).toMatchObject({
      state: "needs-owner",
    });
    expect(result).not.toHaveProperty("actions");
    expect(result).not.toHaveProperty("conditions");
    expect(result.summary).toContain("advanced from baseline abc to def");
  });

  test("returns needs-owner for unsupported repo-ref waits before admitting a new Condition", async () => {
    const result = await execute({
      projectDir: "/tmp/project",
      task: `## Reconciliation Task\n${JSON.stringify(
        {
          taskId:
            "wait-compact-workload-autoscaler-package-partial-origin-dev-advance-780f3d01-20260727",
          input: {
            baseRef: "origin/dev",
            resumeBaselineCommit: "780f3d01",
            specId: "spec.workload-autoscaler.keda-upgrade-survival",
            sourceCommit: "780f3d01",
            publicationBranch: "dev",
          },
          paths: { projectDir: "/tmp/project" },
        },
        null,
        2,
      )}`,
      done: (_summary: string, output: Record<string, unknown>) => ({
        type: "done",
        output,
      }),
    } as never);

    expect(result).toMatchObject({
      type: "done",
      output: {
        state: "needs-owner",
        evidence: expect.arrayContaining([
          "workflow:wait-for-repo-ref-advance",
          "task:wait-compact-workload-autoscaler-package-partial-origin-dev-advance-780f3d01-20260727",
          "publication-branch:dev",
          "source-commit:780f3d01",
        ]),
      },
    });
    expect((result as { output: { summary: string } }).output.summary).toContain(
      "generic origin/dev advance",
    );
  });

  test("returns needs-owner for unsupported normalization repo-ref waits before admitting a new Condition", async () => {
    const result = await execute({
      projectDir: "/tmp/project",
      task: `## Reconciliation Task\n${JSON.stringify(
        {
          taskId:
            "wait-spec-network-acns-performance-cilium-upgrade-user-iptables-runtime-frontier-origin-dev-advance-5c252d46-20260727",
          input: {
            baseRef: "origin/dev",
            resumeBaselineCommit: "5c252d46",
            specId: "spec.network-acns.performance-cilium-upgrade",
            sourceCommit: "5c252d46",
            publicationBranch: "dev",
          },
          paths: { projectDir: "/tmp/project" },
        },
        null,
        2,
      )}`,
      done: (_summary: string, output: Record<string, unknown>) => ({
        type: "done",
        output,
      }),
    } as never);

    expect(result).toMatchObject({
      type: "done",
      output: {
        state: "needs-owner",
        evidence: expect.arrayContaining([
          "workflow:wait-for-repo-ref-advance",
          "task:wait-spec-network-acns-performance-cilium-upgrade-user-iptables-runtime-frontier-origin-dev-advance-5c252d46-20260727",
          "spec-id:spec.network-acns.performance-cilium-upgrade",
          "publication-branch:dev",
          "source-commit:5c252d46",
        ]),
      },
    });
    expect((result as { output: { summary: string } }).output.summary).toContain(
      "generic origin/dev advance",
    );
  });

  test("returns needs-owner when the trigger shows a stale satisfied repo-ref wake", async () => {
    const root = mkdtempSync(join(tmpdir(), "wait-for-repo-ref-stale-wake-"));
    const remote = join(root, "remote.git");
    const repo = join(root, "repo");
    try {
      git(root, `git init --bare ${remote}`);
      git(root, `git init ${repo}`);
      git(repo, "git config user.email watcher@example.com");
      git(repo, "git config user.name Repo Watcher");
      writeFileSync(join(repo, "README.md"), "one\n", "utf8");
      git(repo, "git add README.md");
      git(repo, "git commit -m first");
      git(repo, `git remote add origin ${remote}`);
      git(repo, "git branch -M dev");
      git(repo, "git push -u origin dev");
      git(repo, "git fetch origin dev");
      const baselineCommit = git(repo, "git rev-parse --verify origin/dev");

      const result = await execute({
        projectDir: repo,
        task: `## Reconciliation Task\n${JSON.stringify(
          {
            taskId: "domain/example",
            input: {
              baseRef: "origin/dev",
              resumeBaselineCommit: baselineCommit,
              specId: "spec.localdns.vm-prerelease.enable-disable",
              sourceCommit: `${baselineCommit}-pending-fix`,
              publicationBranch:
                "aks-explorer/reconcile-localdns-enable-disable-origin-dev",
            },
            paths: { projectDir: repo },
          },
          null,
          2,
        )}\n## Trigger Observation\n${JSON.stringify(
          {
            type: "aks.repo-ref.observed",
            data: { repoRef: "origin/dev", commit: "different-commit" },
          },
          null,
          2,
        )}`,
        done: (_summary: string, output: Record<string, unknown>) => ({
          type: "done",
          output,
        }),
      } as never);

      expect(result).toMatchObject({
        type: "done",
        output: {
          state: "needs-owner",
          evidence: expect.arrayContaining([
            `repo-ref:origin/dev`,
            `trigger-commit:different-commit`,
            `current-commit:${baselineCommit}`,
          ]),
        },
      });
      expect(
        (result as { output: { summary: string } }).output.summary,
      ).toContain("stale satisfied repo-ref wake");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("uses the canonical project dir and refreshes the watched ref before deciding", async () => {
    const root = mkdtempSync(join(tmpdir(), "wait-for-repo-ref-advance-"));
    const remote = join(root, "remote.git");
    const seed = join(root, "seed");
    const canonical = join(root, "canonical");
    const stale = join(root, "stale");
    try {
      git(root, `git init --bare ${remote}`);
      git(root, `git init ${seed}`);
      git(seed, "git config user.email watcher@example.com");
      git(seed, "git config user.name Repo Watcher");
      writeFileSync(join(seed, "README.md"), "one\n", "utf8");
      git(seed, "git add README.md");
      git(seed, "git commit -m first");
      git(seed, `git remote add origin ${remote}`);
      git(seed, "git branch -M dev");
      git(seed, "git push -u origin dev");
      git(root, `git clone ${remote} ${canonical}`);
      git(root, `git clone ${remote} ${stale}`);
      git(canonical, "git fetch origin dev");
      git(stale, "git fetch origin dev");
      const baselineCommit = git(stale, "git rev-parse --verify origin/dev");

      writeFileSync(join(seed, "README.md"), "two\n", "utf8");
      git(seed, "git add README.md");
      git(seed, "git commit -m second");
      git(seed, "git push origin dev");

      const result = await execute({
        projectDir: stale,
        task: `## Reconciliation Task\n${JSON.stringify(
          {
            taskId: "domain/example",
            input: {
              baseRef: "origin/dev",
              resumeBaselineCommit: baselineCommit,
              specId: "spec.localdns.vm-prerelease.enable-disable",
              sourceCommit: `${baselineCommit}-pending-fix`,
              publicationBranch:
                "aks-explorer/reconcile-localdns-enable-disable-origin-dev",
            },
            paths: { projectDir: canonical },
          },
          null,
          2,
        )}`,
        done: (_summary: string, output: Record<string, unknown>) => ({
          type: "done",
          output,
        }),
      } as never);

      expect(result).toMatchObject({
        type: "done",
        output: {
          state: "needs-owner",
          evidence: expect.arrayContaining([`repo-ref:origin/dev`]),
        },
      });
      expect(
        (result as { output: { summary: string } }).output.summary,
      ).toContain(`advanced from baseline ${baselineCommit}`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("verifies converged owner work once the watched ref has advanced", async () => {
    const root = mkdtempSync(join(tmpdir(), "wait-for-repo-ref-verify-"));
    const remote = join(root, "remote.git");
    const seed = join(root, "seed");
    const repo = join(root, "repo");
    try {
      git(root, `git init --bare ${remote}`);
      git(root, `git init ${seed}`);
      git(seed, "git config user.email watcher@example.com");
      git(seed, "git config user.name Repo Watcher");
      writeFileSync(join(seed, "README.md"), "one\n", "utf8");
      git(seed, "git add README.md");
      git(seed, "git commit -m first");
      git(seed, `git remote add origin ${remote}`);
      git(seed, "git branch -M dev");
      git(seed, "git push -u origin dev");
      git(root, `git clone ${remote} ${repo}`);
      git(repo, "git fetch origin dev");
      const baselineCommit = git(repo, "git rev-parse --verify origin/dev");

      writeFileSync(join(seed, "README.md"), "two\n", "utf8");
      git(seed, "git add README.md");
      git(seed, "git commit -m second");
      git(seed, "git push origin dev");
      git(repo, "git fetch origin dev");
      const currentCommit = git(repo, "git rev-parse --verify origin/dev");

      const verified = await verify(
        {
          appId: "aks-rp-e2e",
          taskId: "domain/example",
          generation: 1,
          appDir: repo,
          projectDir: repo,
          workspaceDir: repo,
          intent: {
            id: "domain/example",
            parentId: "group/domain-work",
            outcome: "Recheck after origin/dev advances.",
            acceptance: [],
            mode: "achieve",
            owner: "aks-explorer",
            workflow: "wait-for-repo-ref-advance",
            input: {
              baseRef: "origin/dev",
              resumeBaselineCommit: baselineCommit,
            },
          },
        },
        {
          state: "converged",
          summary: "Owner rechecked after origin/dev advanced.",
          evidence: [
            "repo-ref:origin/dev",
            `resume-baseline:${baselineCommit}`,
            `current-commit:${currentCommit}`,
          ],
          actions: [],
        },
      );

      expect(verified).toMatchObject({
        accepted: true,
        summary: expect.stringContaining(
          "Verified repo-ref wait handoff after origin/dev advanced beyond",
        ),
        evidence: expect.arrayContaining([
          "repo-ref:origin/dev",
          `resume-baseline:${baselineCommit}`,
          `current-commit:${currentCommit}`,
        ]),
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
