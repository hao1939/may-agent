import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { repoRefChangedEvent, observeRepoRef } from "./repo-ref.js";

function git(cwd: string, command: string): void {
  const proc = Bun.spawnSync(command.split(" "), {
    cwd,
    stdout: "ignore",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(Buffer.from(proc.stderr).toString("utf8"));
  }
}

describe("repo ref watcher", () => {
  test("emits a semantic repo-ref change fact only after a prior commit exists", () => {
    const event = repoRefChangedEvent({
      repoRef: "origin/dev",
      commit: "newcommit",
      previousCommit: "oldcommit",
      changed: true,
    });

    expect(event).toMatchObject({
      type: "aks.repo-ref.changed",
      target: { project: "aks-rp-e2e" },
      data: {
        repoRef: "origin/dev",
        commit: "newcommit",
        previousCommit: "oldcommit",
      },
    });
  });

  test("uses the same semantic fact for origin main advancement", () => {
    expect(
      repoRefChangedEvent({
        repoRef: "origin/main",
        commit: "new-main",
        previousCommit: "old-main",
        changed: true,
      }),
    ).toMatchObject({
      type: "aks.repo-ref.changed",
      data: {
        repoRef: "origin/main",
        commit: "new-main",
        previousCommit: "old-main",
      },
    });
  });

  test("detects current origin/dev movement from a fetched remote-tracking ref", () => {
    const root = mkdtempSync(join(tmpdir(), "repo-ref-watcher-"));
    const remote = join(root, "remote.git");
    const seed = join(root, "seed");
    const clone = join(root, "clone");
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
      git(root, `git clone ${remote} ${clone}`);
      git(clone, "git fetch origin dev");

      const initial = observeRepoRef(clone, "origin/dev");
      expect(initial).toMatchObject({
        repoRef: "origin/dev",
        changed: false,
        previousCommit: null,
      });
      const firstCommit = initial?.commit;
      expect(firstCommit).toBeTruthy();

      writeFileSync(join(seed, "README.md"), "two\n", "utf8");
      git(seed, "git add README.md");
      git(seed, "git commit -m second");
      git(seed, "git push origin dev");

      const changed = observeRepoRef(clone, "origin/dev", firstCommit);
      expect(changed).toMatchObject({
        repoRef: "origin/dev",
        previousCommit: firstCommit,
        changed: true,
      });
      expect(changed?.commit).not.toBe(firstCommit);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
