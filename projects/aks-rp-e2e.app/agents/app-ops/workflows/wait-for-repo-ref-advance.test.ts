import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { name, verify, workflowContract } from "./wait-for-repo-ref-advance.ts";

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
}

function makeRepoFixture() {
  const root = mkdtempSync(join(tmpdir(), "wait-for-repo-ref-advance-"));
  const remote = join(root, "remote.git");
  const projectDir = join(root, "project");
  git(root, "init", "--bare", remote);
  git(root, "init", projectDir);
  git(projectDir, "config", "user.name", "May Agent");
  git(projectDir, "config", "user.email", "may@example.com");
  git(projectDir, "remote", "add", "origin", remote);
  writeFileSync(join(projectDir, "README.md"), "baseline\n", "utf8");
  git(projectDir, "add", "README.md");
  git(projectDir, "commit", "-m", "baseline");
  git(projectDir, "branch", "-M", "main");
  git(projectDir, "push", "-u", "origin", "main");
  const baselineCommit = git(projectDir, "rev-parse", "HEAD");
  writeFileSync(join(projectDir, "README.md"), "advanced\n", "utf8");
  git(projectDir, "commit", "-am", "advance main");
  git(projectDir, "push", "origin", "main");
  const advancedCommit = git(projectDir, "rev-parse", "HEAD");
  git(projectDir, "fetch", "origin", "main");
  return { root, projectDir, baselineCommit, advancedCommit };
}

describe("app-ops wait-for-repo-ref-advance workflow", () => {
  test("is available under the app-ops workflow directory", () => {
    expect(name).toBe("wait-for-repo-ref-advance");
    expect(workflowContract.workflow).toBe("wait-for-repo-ref-advance");
    expect(verify).toBeFunction();
  });

  test("verifies a converged owner handoff after the baseline repo ref has already advanced", async () => {
    const fixture = makeRepoFixture();
    try {
      const verified = await verify(
        {
          appId: "aks-rp-e2e",
          taskId:
            "domain/wait-master-validation-queuewatcher-current-main-publication-after-dev-repair-20260806",
          generation: 1,
          appDir: join(fixture.root, "aks-rp-e2e.app"),
          projectDir: fixture.projectDir,
          workspaceDir: fixture.projectDir,
          intent: {
            id: "domain/wait-master-validation-queuewatcher-current-main-publication-after-dev-repair-20260806",
            parentId: "domain/master-validation-failure/spec.service-platform.queuewatcher",
            outcome: "Wait for origin/main to advance and then recheck the same spec.",
            acceptance: [],
            mode: "achieve",
            owner: "aks-explorer",
            workflow: "wait-for-repo-ref-advance",
            input: {
              baseRef: "origin/main",
              resumeBaselineCommit: fixture.baselineCommit,
              sourceCommit: "ff02817f6925b774325865fac05323fbc9cc1082",
              specId: "spec.service-platform.queuewatcher",
            },
          },
        },
        {
          state: "converged",
          summary:
            `origin/main advanced from baseline ${fixture.baselineCommit} to ${fixture.advancedCommit}; the same spec now needs a refreshed wait keyed to the new head.`,
          evidence: [
            "evidence/archive/recheck-current-main-queuewatcher-publication-after-f941711-20260806.md",
            `repo-ref:origin/main`,
            `resume-baseline:${fixture.baselineCommit}`,
            `current-commit:${fixture.advancedCommit}`,
          ],
          actions: [
            {
              kind: "create-task",
              id: "domain/wait-master-validation-queuewatcher-current-main-publication-after-f941711-20260806",
              parentId:
                "domain/master-validation-failure/spec.service-platform.queuewatcher",
              outcome: "Wait for the next origin/main advance.",
              acceptance: [],
              owner: "aks-explorer",
              workflow: "wait-for-repo-ref-advance",
              input: {
                baseRef: "origin/main",
                resumeBaselineCommit: fixture.advancedCommit,
              },
            },
          ],
        },
      );

      expect(verified).toEqual({
        accepted: true,
        summary:
          `Verified repo-ref wait handoff after origin/main advanced beyond ${fixture.baselineCommit}.`,
        evidence: [
          "repo-ref:origin/main",
          `resume-baseline:${fixture.baselineCommit}`,
          `current-commit:${fixture.advancedCommit}`,
          "deterministic:owner-handoff-postcondition",
        ],
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});
