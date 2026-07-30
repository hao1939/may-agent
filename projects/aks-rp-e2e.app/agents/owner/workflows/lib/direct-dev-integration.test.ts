import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { integrateDirectlyIntoDev } from "./direct-dev-integration.js";

const roots: string[] = [];

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed: ${result.stderr || result.stdout}`,
    );
  }
  return (result.stdout ?? "").trim();
}

function commitFile(
  cwd: string,
  path: string,
  content: string,
  message: string,
): string {
  writeFileSync(join(cwd, path), content);
  git(cwd, "add", path);
  git(cwd, "commit", "-m", message);
  return git(cwd, "rev-parse", "HEAD");
}

function setupDivergedTask() {
  const root = mkdtempSync(join(tmpdir(), "direct-dev-integration-"));
  roots.push(root);
  const remote = join(root, "remote.git");
  const seed = join(root, "seed");
  const task = join(root, "task");

  git(root, "init", "--bare", remote);
  git(root, "clone", remote, seed);
  git(seed, "config", "user.name", "Test User");
  git(seed, "config", "user.email", "test@example.com");
  commitFile(seed, "base.txt", "base\n", "base");
  git(seed, "branch", "-M", "dev");
  git(seed, "push", "-u", "origin", "dev");

  git(root, "clone", remote, task);
  git(task, "config", "user.name", "Test User");
  git(task, "config", "user.email", "test@example.com");
  git(task, "checkout", "-b", "task/example", "origin/dev");
  const taskBaseCommit = commitFile(
    task,
    "inherited.txt",
    "must not reach dev\n",
    "inherited stale history",
  );

  const currentDevCommit = commitFile(
    seed,
    "dev.txt",
    "current dev\n",
    "advance dev",
  );
  git(seed, "push", "origin", "dev");

  return { remote, seed, task, taskBaseCommit, currentDevCommit };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("integrateDirectlyIntoDev", () => {
  test("returns a structured replay request when retained source predates the attempt baseline", () => {
    const setup = setupDivergedTask();

    const result = integrateDirectlyIntoDev({
      repoDir: setup.seed,
      workspaceDir: setup.task,
      sourceBranch: "task/example",
      sourceCommit: setup.taskBaseCommit,
      taskBaseCommit: setup.currentDevCommit,
    });

    expect(result).toEqual({
      state: "requires-replay",
      reason: "source-outside-attempt-baseline",
      sourceCommit: setup.taskBaseCommit,
      taskBaseCommit: setup.currentDevCommit,
      targetRef: "origin/dev",
      mergeCommits: [],
    });
  });

  test("replays only commits created by the bounded task turn", () => {
    const setup = setupDivergedTask();
    const sourceCommit = commitFile(
      setup.task,
      "task.txt",
      "bounded task change\n",
      "bounded task change",
    );

    const result = integrateDirectlyIntoDev({
      repoDir: setup.seed,
      workspaceDir: setup.task,
      sourceBranch: "task/example",
      sourceCommit,
      taskBaseCommit: setup.taskBaseCommit,
    });

    expect(result.state).toBe("integrated");
    git(setup.seed, "fetch", "origin", "dev");
    expect(git(setup.seed, "show", "origin/dev:task.txt")).toBe(
      "bounded task change",
    );
    expect(git(setup.seed, "show", "origin/dev:dev.txt")).toBe("current dev");
    const inherited = spawnSync("git", ["show", "origin/dev:inherited.txt"], {
      cwd: setup.seed,
      encoding: "utf8",
    });
    expect(inherited.status).not.toBe(0);
  });

  test("does not replay target commits adopted after a stale attempt baseline", () => {
    const root = mkdtempSync(join(tmpdir(), "direct-dev-integration-"));
    roots.push(root);
    const remote = join(root, "remote.git");
    const seed = join(root, "seed");
    const task = join(root, "task");

    git(root, "init", "--bare", remote);
    git(root, "clone", remote, seed);
    git(seed, "config", "user.name", "Test User");
    git(seed, "config", "user.email", "test@example.com");
    const taskBaseCommit = commitFile(seed, "base.txt", "base\n", "base");
    git(seed, "branch", "-M", "dev");
    git(seed, "push", "-u", "origin", "dev");

    git(root, "clone", remote, task);
    git(task, "config", "user.name", "Test User");
    git(task, "config", "user.email", "test@example.com");
    git(task, "checkout", "-b", "task/example", "origin/dev");

    commitFile(seed, "dev.txt", "current dev\n", "advance dev");
    git(seed, "push", "origin", "dev");
    git(task, "fetch", "origin", "dev");
    git(task, "reset", "--hard", "origin/dev");
    const sourceCommit = commitFile(
      task,
      "task.txt",
      "bounded task change\n",
      "bounded task change",
    );

    const result = integrateDirectlyIntoDev({
      repoDir: seed,
      workspaceDir: task,
      sourceBranch: "task/example",
      sourceCommit,
      taskBaseCommit,
    });

    expect(result.state).toBe("integrated");
    git(seed, "fetch", "origin", "dev");
    expect(git(seed, "show", "origin/dev:task.txt")).toBe(
      "bounded task change",
    );
    expect(git(seed, "show", "origin/dev:dev.txt")).toBe("current dev");
  });

  test("does not publish stale history when the turn created no commit", () => {
    const setup = setupDivergedTask();

    const result = integrateDirectlyIntoDev({
      repoDir: setup.seed,
      workspaceDir: setup.task,
      sourceBranch: "task/example",
      sourceCommit: setup.taskBaseCommit,
      taskBaseCommit: setup.taskBaseCommit,
    });

    expect(result.state).toBe("unchanged");
    git(setup.seed, "fetch", "origin", "dev");
    expect(readFileSync(join(setup.seed, "dev.txt"), "utf8")).toBe(
      "current dev\n",
    );
    const inherited = spawnSync("git", ["show", "origin/dev:inherited.txt"], {
      cwd: setup.seed,
      encoding: "utf8",
    });
    expect(inherited.status).not.toBe(0);
  });
});
