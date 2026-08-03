import { describe, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  preparedSourceRequirement,
  reconcilePreparedTaskSource,
} from "./spec-live-reconciliation.js";

describe("spec live prepared source", () => {
  test("uses a complete generic source branch and commit pair", () => {
    expect(
      preparedSourceRequirement({
        sourceBranch: "refs/heads/task/prepared",
        sourceCommit: "a".repeat(40),
      }),
    ).toEqual({
      sourceBranch: "task/prepared",
      sourceCommit: "a".repeat(40),
    });
    expect(
      preparedSourceRequirement({ sourceCommit: "a".repeat(40) }),
    ).toBeNull();
    expect(preparedSourceRequirement(undefined)).toBeNull();
  });

  test("merges the exact prepared task source without losing current work", () => {
    const root = mkdtempSync(join(tmpdir(), "spec-live-prepared-source-"));
    const remote = join(root, "remote.git");
    const seed = join(root, "seed");
    const workspace = join(root, "workspace");
    const run = (cwd: string, args: string[]) =>
      execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

    try {
      mkdirSync(seed);
      run(root, ["init", "--bare", remote]);
      run(seed, ["init"]);
      run(seed, ["config", "user.email", "test@example.com"]);
      run(seed, ["config", "user.name", "Test"]);
      writeFileSync(join(seed, "base.txt"), "base\n");
      run(seed, ["add", "base.txt"]);
      run(seed, ["commit", "-m", "base"]);
      run(seed, ["branch", "-M", "dev"]);
      run(seed, ["remote", "add", "origin", remote]);
      run(seed, ["push", "origin", "dev"]);

      run(seed, ["checkout", "-b", "task/prepared"]);
      writeFileSync(join(seed, "prepared.txt"), "prepared builder\n");
      run(seed, ["add", "prepared.txt"]);
      run(seed, ["commit", "-m", "prepared builder"]);
      const preparedCommit = run(seed, ["rev-parse", "HEAD"]);
      run(seed, ["push", "origin", "task/prepared"]);

      run(seed, ["checkout", "dev"]);
      run(seed, ["checkout", "-b", "task/live"]);
      writeFileSync(join(seed, "live.txt"), "live carrier\n");
      run(seed, ["add", "live.txt"]);
      run(seed, ["commit", "-m", "live carrier"]);
      const liveCommit = run(seed, ["rev-parse", "HEAD"]);
      run(seed, ["push", "origin", "task/live"]);

      run(root, ["clone", remote, workspace]);
      run(workspace, ["checkout", "task/live"]);
      run(workspace, ["config", "user.email", "test@example.com"]);
      run(workspace, ["config", "user.name", "Test"]);

      const result = reconcilePreparedTaskSource(workspace, {
        sourceBranch: "task/prepared",
        sourceCommit: preparedCommit,
      });
      expect(result.state).toBe("merged");
      const mergedCommit = run(workspace, ["rev-parse", "HEAD"]);
      expect(
        spawnSync(
          "git",
          ["merge-base", "--is-ancestor", preparedCommit, mergedCommit],
          { cwd: workspace },
        ).status,
      ).toBe(0);
      expect(
        spawnSync(
          "git",
          ["merge-base", "--is-ancestor", liveCommit, mergedCommit],
          { cwd: workspace },
        ).status,
      ).toBe(0);
      expect(existsSync(join(workspace, "prepared.txt"))).toBe(true);
      expect(existsSync(join(workspace, "live.txt"))).toBe(true);
      expect(run(workspace, ["status", "--porcelain"])).toBe("");

      expect(
        reconcilePreparedTaskSource(workspace, {
          sourceBranch: "task/prepared",
          sourceCommit: preparedCommit,
        }).state,
      ).toBe("current");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("rejects a non-task prepared branch", () => {
    const result = reconcilePreparedTaskSource(
      "/tmp/unused",
      {
        sourceBranch: "dev",
        sourceCommit: "a".repeat(40),
      },
      () => ({ status: 0, stdout: "", stderr: "" }),
    );
    expect(result.state).toBe("failed");
    if (result.state !== "failed") throw new Error("expected failure");
    expect(result.error).toContain("dedicated task branch");
  });
});
