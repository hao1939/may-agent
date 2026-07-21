import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { legacyBranchInventory } from "./legacy-branch-inventory.ts";

const roots: string[] = [];

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("legacy branch inventory", () => {
  test("returns only unattached branches with patches outside the base and groups by feature", () => {
    const root = mkdtempSync(join(tmpdir(), "aks-legacy-branch-inventory-"));
    roots.push(root);
    const repo = join(root, "repo");
    const attachedPath = join(root, "attached");
    execFileSync("git", ["init", "-b", "dev", repo]);
    git(repo, "config", "user.email", "test@example.com");
    git(repo, "config", "user.name", "Test");
    writeFileSync(join(repo, "README.md"), "base\n");
    git(repo, "add", "README.md");
    git(repo, "commit", "-m", "base");
    git(repo, "branch", "origin/dev");

    git(repo, "switch", "-c", "task/network-change");
    mkdirSync(join(repo, "features", "network-cni", "specs"), {
      recursive: true,
    });
    writeFileSync(
      join(repo, "features", "network-cni", "specs", "one.json"),
      "{}\n",
    );
    git(repo, "add", ".");
    git(repo, "commit", "-m", "network change");
    git(repo, "switch", "dev");

    git(repo, "worktree", "add", "-b", "task/attached", attachedPath, "dev");
    writeFileSync(join(attachedPath, "attached.txt"), "attached\n");
    git(attachedPath, "add", ".");
    git(attachedPath, "commit", "-m", "attached change");

    expect(legacyBranchInventory(repo)).toEqual([
      expect.objectContaining({
        branch: "task/network-change",
        family: "network-cni",
        files: ["features/network-cni/specs/one.json"],
      }),
    ]);
  });
});
