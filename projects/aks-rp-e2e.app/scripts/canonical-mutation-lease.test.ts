import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  acquireCanonicalMutationLease,
  CanonicalMutationContentionError,
  type CanonicalLeaseHolder,
} from "./lib/canonical-mutation-lease.ts";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]) {
  const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

function fingerprint(repo: string) {
  return {
    head: git(repo, "rev-parse", "HEAD"),
    index: createHash("sha256")
      .update(readFileSync(join(repo, ".git/index")))
      .digest("hex"),
    worktree: createHash("sha256")
      .update(readFileSync(join(repo, "tracked.txt")))
      .digest("hex"),
    status: git(repo, "status", "--porcelain=v1", "--untracked-files=all"),
  };
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "canonical-lease-"));
  roots.push(root);
  const repo = join(root, "repo");
  const leaseRoot = join(root, "leases");
  spawnSync("git", ["init", "-q", repo]);
  git(repo, "config", "user.email", "test@example.invalid");
  git(repo, "config", "user.name", "Test");
  writeFileSync(join(repo, "tracked.txt"), "base\n");
  git(repo, "add", ".");
  git(repo, "commit", "-qm", "base");
  return { root, repo, leaseRoot };
}

const first: CanonicalLeaseHolder = {
  sessionId: "s_first",
  owner: "app-ops",
  taskId: "ops/first",
};
const second: CanonicalLeaseHolder = {
  sessionId: "s_second",
  owner: "app-ops",
  taskId: "ops/second",
};

describe("canonical mutation lease", () => {
  test("two overlapping sessions cannot pass and contention preserves Git bytes", () => {
    const { repo, leaseRoot } = fixture();
    const before = fingerprint(repo);
    const active = () => [first];
    const lease = acquireCanonicalMutationLease({
      projectId: "aks-rp-e2e",
      canonicalPath: repo,
      holder: first,
      leaseRoot,
      activeSessions: active,
      fingerprint: () => fingerprint(repo),
    });

    let receipt: CanonicalMutationContentionError | null = null;
    try {
      acquireCanonicalMutationLease({
        projectId: "aks-rp-e2e",
        canonicalPath: repo,
        holder: second,
        leaseRoot,
        activeSessions: () => [first, second],
        fingerprint: () => fingerprint(repo),
      });
    } catch (error) {
      receipt = error as CanonicalMutationContentionError;
    }
    expect(receipt).toBeInstanceOf(CanonicalMutationContentionError);
    expect(receipt?.receipt.conflictingSession).toBe("s_first");
    expect(receipt?.receipt.condition.subject).toBe("session:s_first");
    expect(fingerprint(repo)).toEqual(before);
    lease.release();
  });

  test("waiter passes only after the exact lease and session contention clears", () => {
    const { repo, leaseRoot } = fixture();
    let active = [first];
    const lease = acquireCanonicalMutationLease({
      projectId: "aks-rp-e2e",
      canonicalPath: repo,
      holder: first,
      leaseRoot,
      activeSessions: () => active,
    });
    expect(() =>
      acquireCanonicalMutationLease({
        projectId: "aks-rp-e2e",
        canonicalPath: repo,
        holder: second,
        leaseRoot,
        activeSessions: () => active,
      }),
    ).toThrow(CanonicalMutationContentionError);
    active = [];
    expect(() =>
      acquireCanonicalMutationLease({
        projectId: "aks-rp-e2e",
        canonicalPath: repo,
        holder: second,
        leaseRoot,
        activeSessions: () => active,
      }),
    ).toThrow(CanonicalMutationContentionError);
    lease.release();
    active = [second];
    const waiter = acquireCanonicalMutationLease({
      projectId: "aks-rp-e2e",
      canonicalPath: repo,
      holder: second,
      leaseRoot,
      activeSessions: () => active,
    });
    waiter.mutate("clean mutation", () =>
      writeFileSync(join(repo, "tracked.txt"), "changed\n"),
    );
    waiter.release();
    expect(readFileSync(join(repo, "tracked.txt"), "utf8")).toBe("changed\n");
  });

  test("post-mutation live-session recheck checkpoints changed facts", () => {
    const { root, repo, leaseRoot } = fixture();
    const checkpointPath = join(root, "checkpoint.jsonl");
    let active = [first];
    const lease = acquireCanonicalMutationLease({
      projectId: "aks-rp-e2e",
      canonicalPath: repo,
      holder: first,
      leaseRoot,
      checkpointPath,
      activeSessions: () => active,
      fingerprint: () => fingerprint(repo),
    });
    expect(() =>
      lease.mutate("change", () => {
        writeFileSync(join(repo, "tracked.txt"), "changed\n");
        active = [first, second];
      }),
    ).toThrow(CanonicalMutationContentionError);
    const receipt = readFileSync(checkpointPath, "utf8");
    expect(receipt).toContain('"decision":"post-mutation-contention"');
    expect(receipt).toContain('"conflictingSession":"s_second"');
    active = [first];
    lease.release();
  });
});
