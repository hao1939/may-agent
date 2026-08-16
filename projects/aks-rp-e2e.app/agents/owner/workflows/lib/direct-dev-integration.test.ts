import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import {
  historyOnlyAncestryStrategy,
  integrateDirectlyIntoDev,
  verifyHistoryOnlyAncestryCandidate,
} from "./direct-dev-integration.js";

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
  test("returns a structured replay request when retained source predates the attempt baseline", async () => {
    const setup = setupDivergedTask();

    const result = await integrateDirectlyIntoDev({
      repoDir: setup.seed,
      workspaceDir: setup.task,
      sourceBranch: "task/example",
      sourceCommit: setup.taskBaseCommit,
      taskBaseCommit: setup.currentDevCommit,
      validationCommands: [],
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

  test("replays only commits created by the bounded task turn", async () => {
    const setup = setupDivergedTask();
    const sourceCommit = commitFile(
      setup.task,
      "task.txt",
      "bounded task change\n",
      "bounded task change",
    );

    const result = await integrateDirectlyIntoDev({
      repoDir: setup.seed,
      workspaceDir: setup.task,
      sourceBranch: "task/example",
      sourceCommit,
      taskBaseCommit: setup.taskBaseCommit,
      validationCommands: [],
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

  test("does not replay target commits adopted after a stale attempt baseline", async () => {
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

    const result = await integrateDirectlyIntoDev({
      repoDir: seed,
      workspaceDir: task,
      sourceBranch: "task/example",
      sourceCommit,
      taskBaseCommit,
      validationCommands: [],
    });

    expect(result.state).toBe("integrated");
    git(seed, "fetch", "origin", "dev");
    expect(git(seed, "show", "origin/dev:task.txt")).toBe(
      "bounded task change",
    );
    expect(git(seed, "show", "origin/dev:dev.txt")).toBe("current dev");
  });

  test("does not publish a candidate when a repository validation fails", async () => {
    const setup = setupDivergedTask();
    const sourceCommit = commitFile(
      setup.task,
      "task.txt",
      "bounded task change\n",
      "bounded task change",
    );

    const result = await integrateDirectlyIntoDev({
      repoDir: setup.seed,
      workspaceDir: setup.task,
      sourceBranch: "task/example",
      sourceCommit,
      taskBaseCommit: setup.taskBaseCommit,
      validationCommands: [
        {
          name: "test policy",
          command: process.execPath,
          args: ["-e", "process.stderr.write('rejected'); process.exit(7)"],
        },
      ],
    });

    expect(result).toMatchObject({
      state: "validation-failed",
      replayBaseCommit: setup.currentDevCommit,
      error: "test policy failed: rejected",
    });
    git(setup.seed, "fetch", "origin", "dev");
    expect(git(setup.seed, "rev-parse", "origin/dev")).toBe(
      setup.currentDevCommit,
    );
    expect(
      git(setup.seed, "ls-remote", "--heads", "origin", "task/example"),
    ).toBe("");
  });

  test("does not publish a candidate with whitespace errors", async () => {
    const setup = setupDivergedTask();
    const sourceCommit = commitFile(
      setup.task,
      "task.txt",
      "trailing whitespace  \n",
      "bounded task change",
    );

    const result = await integrateDirectlyIntoDev({
      repoDir: setup.seed,
      workspaceDir: setup.task,
      sourceBranch: "task/example",
      sourceCommit,
      taskBaseCommit: setup.taskBaseCommit,
      validationCommands: [],
    });

    expect(result).toMatchObject({
      state: "validation-failed",
      error: expect.stringContaining("whitespace check failed"),
    });
    git(setup.seed, "fetch", "origin", "dev");
    expect(git(setup.seed, "rev-parse", "origin/dev")).toBe(
      setup.currentDevCommit,
    );
  });

  test("rejects newly tracked runtime evidence without inheriting baseline debt", async () => {
    const setup = setupDivergedTask();
    mkdirSync(join(setup.seed, "evidence", "archive"), { recursive: true });
    const targetCommit = commitFile(
      setup.seed,
      "evidence/archive/reviewed-authority.json",
      "{}\n",
      "retain reviewed authority",
    );
    git(setup.seed, "push", "origin", "dev");
    mkdirSync(join(setup.task, "evidence", "archive"), { recursive: true });
    const sourceCommit = commitFile(
      setup.task,
      "evidence/archive/runtime.json",
      "{}\n",
      "track runtime evidence",
    );

    const result = await integrateDirectlyIntoDev({
      repoDir: setup.seed,
      workspaceDir: setup.task,
      sourceBranch: "task/example",
      sourceCommit,
      taskBaseCommit: setup.taskBaseCommit,
      validationCommands: [],
    });

    expect(result).toMatchObject({
      state: "validation-failed",
      error: expect.stringContaining(
        "candidate newly tracks evidence/archive/runtime.json",
      ),
    });
    git(setup.seed, "fetch", "origin", "dev");
    expect(git(setup.seed, "rev-parse", "origin/dev")).toBe(targetCommit);
  });

  test("keeps the event loop responsive while validation is pending", async () => {
    const setup = setupDivergedTask();
    const sourceCommit = commitFile(
      setup.task,
      "task.txt",
      "bounded task change\n",
      "bounded task change",
    );
    const heartbeats = [Date.now()];
    const heartbeat = setInterval(() => heartbeats.push(Date.now()), 5);

    try {
      expect(
        (
          await integrateDirectlyIntoDev({
            repoDir: setup.seed,
            workspaceDir: setup.task,
            sourceBranch: "task/example",
            sourceCommit,
            taskBaseCommit: setup.taskBaseCommit,
            validationCommands: [
              {
                name: "slow policy",
                command: process.execPath,
                args: ["-e", "setTimeout(() => {}, 300)"],
              },
            ],
          })
        ).state,
      ).toBe("integrated");
    } finally {
      clearInterval(heartbeat);
      heartbeats.push(Date.now());
    }

    const maximumHeartbeatGap = Math.max(
      ...heartbeats.slice(1).map((time, index) => time - heartbeats[index]),
    );
    expect(maximumHeartbeatGap).toBeLessThan(200);
  });

  test("does not publish stale history when the turn created no commit", async () => {
    const setup = setupDivergedTask();

    const result = await integrateDirectlyIntoDev({
      repoDir: setup.seed,
      workspaceDir: setup.task,
      sourceBranch: "task/example",
      sourceCommit: setup.taskBaseCommit,
      taskBaseCommit: setup.taskBaseCommit,
      validationCommands: [],
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

  test("publishes an identical-tree merge with fetched dev first and tested source second", async () => {
    const setup = setupDivergedTask();
    const targetTree = git(
      setup.seed,
      "show",
      "-s",
      "--format=%T",
      "origin/dev",
    );

    const result = await integrateDirectlyIntoDev({
      repoDir: setup.seed,
      workspaceDir: setup.task,
      sourceBranch: "task/example",
      sourceCommit: setup.taskBaseCommit,
      taskBaseCommit: setup.taskBaseCommit,
      validationCommands: [],
      integrationStrategy: historyOnlyAncestryStrategy,
    });

    expect(result.state).toBe("integrated");
    expect(
      result.state === "integrated" && result.historyOnlyProof,
    ).toMatchObject({
      sourceCommit: setup.taskBaseCommit,
      firstParentCommit: setup.currentDevCommit,
      firstParentTree: targetTree,
      integrationTree: targetTree,
      historyOnlyDiff: true,
    });
    git(setup.seed, "fetch", "origin", "dev");
    expect(
      git(setup.seed, "show", "-s", "--format=%P", "origin/dev").split(" "),
    ).toEqual([setup.currentDevCommit, setup.taskBaseCommit]);
    expect(git(setup.seed, "show", "origin/dev:dev.txt")).toBe("current dev");
    expect(
      spawnSync("git", ["show", "origin/dev:inherited.txt"], {
        cwd: setup.seed,
        encoding: "utf8",
      }).status,
    ).not.toBe(0);
  });

  test("rejects a candidate whose merge tree differs from its first parent", async () => {
    const setup = setupDivergedTask();
    git(setup.task, "fetch", "origin", "dev");
    const sourceTree = git(
      setup.task,
      "show",
      "-s",
      "--format=%T",
      setup.taskBaseCommit,
    );
    const changedCandidate = git(
      setup.task,
      "commit-tree",
      sourceTree,
      "-p",
      setup.currentDevCommit,
      "-p",
      setup.taskBaseCommit,
      "-m",
      "unsafe tree-changing merge",
    );

    expect(
      await verifyHistoryOnlyAncestryCandidate({
        workspaceDir: setup.task,
        candidateCommit: changedCandidate,
        expectedFirstParent: setup.currentDevCommit,
        expectedSourceCommit: setup.taskBaseCommit,
      }),
    ).toBeNull();
  });

  test("rebuilds against a newly fetched dev tip after a publication race", async () => {
    const setup = setupDivergedTask();
    const marker = join(setup.seed, "race-marker");
    const raceScript = [
      "const {existsSync,writeFileSync}=require('node:fs');",
      "const {spawnSync}=require('node:child_process');",
      `const cwd=${JSON.stringify(setup.seed)}, marker=${JSON.stringify(marker)};`,
      "if(!existsSync(marker)){writeFileSync(marker,'raced');writeFileSync(cwd+'/race.txt','new dev tip\\n');for(const args of [['add','race.txt'],['commit','-m','race dev'],['push','origin','dev']]){const r=spawnSync('git',args,{cwd,encoding:'utf8'});if(r.status!==0){process.stderr.write(r.stderr||r.stdout);process.exit(r.status||1)}}}",
    ].join("");

    const result = await integrateDirectlyIntoDev({
      repoDir: setup.seed,
      workspaceDir: setup.task,
      sourceBranch: "task/example",
      sourceCommit: setup.taskBaseCommit,
      taskBaseCommit: setup.taskBaseCommit,
      validationCommands: [
        {
          name: "inject one dev race",
          command: process.execPath,
          args: ["-e", raceScript],
        },
      ],
      integrationStrategy: historyOnlyAncestryStrategy,
    });

    expect(result.state).toBe("integrated");
    expect(
      result.state === "integrated" &&
        result.historyOnlyProof?.firstParentCommit,
    ).toBe(git(setup.seed, "rev-parse", "dev"));
    git(setup.seed, "fetch", "origin", "dev");
    expect(git(setup.seed, "show", "origin/dev:race.txt")).toBe("new dev tip");
  });

  test("ordinary direct-dev integration still rejects merge commits", async () => {
    const setup = setupDivergedTask();
    git(setup.task, "fetch", "origin", "dev");
    git(setup.task, "merge", "--no-edit", "origin/dev");
    const mergeCommit = git(setup.task, "rev-parse", "HEAD");

    const result = await integrateDirectlyIntoDev({
      repoDir: setup.seed,
      workspaceDir: setup.task,
      sourceBranch: "task/example",
      sourceCommit: mergeCommit,
      taskBaseCommit: setup.taskBaseCommit,
      validationCommands: [],
    });

    expect(result).toMatchObject({
      state: "requires-replay",
      reason: "attempt-has-merge-commits",
      mergeCommits: [mergeCommit],
    });
  });
});
