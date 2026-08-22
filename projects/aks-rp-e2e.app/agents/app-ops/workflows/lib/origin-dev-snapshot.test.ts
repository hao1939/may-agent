import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isLiveOriginDevSnapshot,
  withCurrentOriginDevSnapshot,
  withCurrentOriginDevSnapshotAsync,
} from "./origin-dev-snapshot.js";

const roots: string[] = [];

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
}

function repository(): string {
  const root = mkdtempSync(join(tmpdir(), "origin-dev-snapshot-test-"));
  roots.push(root);
  const repo = join(root, "repo");
  execFileSync("git", ["init", "-b", "dev", repo]);
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Test");
  writeFileSync(join(repo, "README.md"), "base\n");
  git(repo, "add", "README.md");
  git(repo, "commit", "-m", "base");
  git(repo, "update-ref", "refs/remotes/origin/dev", "HEAD");
  return repo;
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("origin/dev temporary snapshot lifecycle", () => {
  it("marks a live evidence consumer and removes the worktree after success", () => {
    const repo = repository();
    let snapshot = "";
    withCurrentOriginDevSnapshot(repo, ({ dir }) => {
      snapshot = dir;
      expect(isLiveOriginDevSnapshot(dir)).toBe(true);
      expect(git(repo, "worktree", "list", "--porcelain")).toContain(dir);
    });
    expect(existsSync(snapshot)).toBe(false);
    expect(git(repo, "worktree", "list", "--porcelain")).not.toContain(
      snapshot,
    );
  });

  it("removes the worktree after a failed consumer", () => {
    const repo = repository();
    let snapshot = "";
    expect(() =>
      withCurrentOriginDevSnapshot(repo, ({ dir }) => {
        snapshot = dir;
        writeFileSync(join(dir, "README.md"), "dirty evidence\n");
        throw new Error("consumer failed");
      }),
    ).toThrow("consumer failed");
    expect(existsSync(snapshot)).toBe(false);
    expect(git(repo, "worktree", "list", "--porcelain")).not.toContain(
      snapshot,
    );
  });

  it("removes the worktree after an async timeout/rejection", async () => {
    const repo = repository();
    let snapshot = "";
    await expect(
      withCurrentOriginDevSnapshotAsync(repo, async ({ dir }) => {
        snapshot = dir;
        writeFileSync(join(dir, "README.md"), "partial output\n");
        await Promise.resolve();
        throw new Error("timed out");
      }),
    ).rejects.toThrow("timed out");
    expect(existsSync(snapshot)).toBe(false);
    expect(git(repo, "worktree", "list", "--porcelain")).not.toContain(
      snapshot,
    );
  });

  it("reclaims a dead leased snapshot before allocating another checkout", () => {
    const repo = repository();
    const stale = join(repo, "..", "stale-snapshot");
    git(repo, "worktree", "add", "--detach", stale, "origin/dev");
    const pointer = readFileSync(join(stale, ".git"), "utf8").trim();
    expect(pointer.startsWith("gitdir: ")).toBe(true);
    writeFileSync(
      join(
        pointer.slice("gitdir: ".length),
        "may-origin-dev-snapshot-lease.json",
      ),
      `${JSON.stringify({
        kind: "aks-origin-dev-snapshot",
        path: stale,
        pid: 2_147_483_647,
        createdAt: new Date(0).toISOString(),
      })}\n`,
    );

    withCurrentOriginDevSnapshot(repo, ({ dir }) => {
      expect(isLiveOriginDevSnapshot(dir)).toBe(true);
    });
    expect(existsSync(stale)).toBe(false);
    expect(git(repo, "worktree", "list", "--porcelain")).not.toContain(stale);
  });

  it("removes the worktree when the hosting process exits mid-consumer", () => {
    const repo = repository();
    const receipt = join(repo, "..", "snapshot-path.txt");
    const moduleUrl = new URL("./origin-dev-snapshot.ts", import.meta.url).href;
    execFileSync(
      process.execPath,
      [
        "-e",
        `import { writeFileSync } from "node:fs"; import { withCurrentOriginDevSnapshot } from ${JSON.stringify(moduleUrl)}; withCurrentOriginDevSnapshot(${JSON.stringify(repo)}, ({ dir }) => { writeFileSync(${JSON.stringify(receipt)}, dir); process.exit(0); });`,
      ],
      { cwd: process.cwd() },
    );
    const snapshot = readFileSync(receipt, "utf8");
    expect(existsSync(snapshot)).toBe(false);
    expect(git(repo, "worktree", "list", "--porcelain")).not.toContain(
      snapshot,
    );
  });
});
