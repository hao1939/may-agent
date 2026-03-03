import { describe, it, expect } from "vitest";
import { isGitCommitCommand, buildGitCommitContext, warnBlanketGitAdd } from "../src/tools.js";
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function makeGitRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "git-guard-test-"));
  execSync("git init && git config user.email test@test.com && git config user.name Test", {
    cwd: dir,
    stdio: "pipe",
  });
  // Create an initial commit so HEAD exists
  writeFileSync(join(dir, "initial.txt"), "init");
  execSync("git add initial.txt && git commit -m 'initial'", {
    cwd: dir,
    stdio: "pipe",
  });
  return dir;
}

describe("isGitCommitCommand", () => {
  it("detects simple git commit", () => {
    expect(isGitCommitCommand('git commit -m "msg"')).toBe(true);
  });

  it("detects git commit with --amend", () => {
    expect(isGitCommitCommand("git commit --amend")).toBe(true);
  });

  it("detects git commit in compound command", () => {
    expect(isGitCommitCommand('git add -A && git commit -m "msg"')).toBe(true);
  });

  it("detects git commit after cd", () => {
    expect(isGitCommitCommand('cd agents && git commit -m "msg"')).toBe(true);
  });

  it("detects git commit with semicolons", () => {
    expect(isGitCommitCommand('git add .; git commit -m "msg"')).toBe(true);
  });

  it("does NOT match echo containing git commit", () => {
    expect(isGitCommitCommand('echo "git commit -m msg"')).toBe(false);
  });

  it("does NOT match grep for git commit", () => {
    expect(isGitCommitCommand('grep "git commit" file.txt')).toBe(false);
  });

  it("does NOT match comments containing git commit", () => {
    expect(isGitCommitCommand("# git commit -m msg")).toBe(false);
  });

  it("does NOT match plain git add (no commit)", () => {
    expect(isGitCommitCommand("git add -A")).toBe(false);
  });

  it("does NOT match git status", () => {
    expect(isGitCommitCommand("git status")).toBe(false);
  });

  it("does NOT match git diff", () => {
    expect(isGitCommitCommand("git diff --cached")).toBe(false);
  });
});

describe("buildGitCommitContext", () => {
  it("returns empty string when working tree is clean", () => {
    const dir = makeGitRepo();
    try {
      const result = buildGitCommitContext(dir, "git commit -m msg");
      expect(result).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("warns about modified files after commit", () => {
    const dir = makeGitRepo();
    try {
      // Create uncommitted change
      writeFileSync(join(dir, "dirty.txt"), "dirty");
      const result = buildGitCommitContext(dir, "git commit -m msg");
      expect(result).toContain("POST-COMMIT");
      expect(result).toContain("not clean");
      expect(result).toContain("dirty.txt");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("distinguishes modified from untracked files", () => {
    const dir = makeGitRepo();
    try {
      // Modify tracked file
      writeFileSync(join(dir, "initial.txt"), "changed");
      // Create new untracked file
      writeFileSync(join(dir, "new.txt"), "new");
      const result = buildGitCommitContext(dir, "git commit -m msg");
      expect(result).toContain("modified/staged");
      expect(result).toContain("untracked");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not truncate filenames when first status line has leading space", () => {
    const dir = makeGitRepo();
    try {
      // Modify tracked file — git status shows " M initial.txt" with leading space
      // which .trim() on the full output can strip, causing slice(3) to skip a char
      writeFileSync(join(dir, "initial.txt"), "changed");
      const result = buildGitCommitContext(dir, "git commit -m msg");
      // The file list should show full filename after the colon
      expect(result).toMatch(/: initial\.txt/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolves effective cwd from cd prefix in command", () => {
    const dir = makeGitRepo();
    const parent = join(dir, "..");
    try {
      writeFileSync(join(dir, "dirty.txt"), "dirty");
      // Command starts with cd to the repo dir
      const result = buildGitCommitContext(parent, `cd ${dir} && git commit -m msg`);
      expect(result).toContain("dirty.txt");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns empty string for non-git directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "non-git-"));
    try {
      const result = buildGitCommitContext(dir, "git commit -m msg");
      expect(result).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("warnBlanketGitAdd", () => {
  it("warns on git add -A", () => {
    const dir = makeGitRepo();
    try {
      writeFileSync(join(dir, "file1.txt"), "a");
      writeFileSync(join(dir, "file2.txt"), "b");
      const result = warnBlanketGitAdd("git add -A", dir);
      expect(result).toContain("BLANKET GIT ADD");
      expect(result).toContain("file1.txt");
      expect(result).toContain("file2.txt");
      expect(result).toContain("git add <specific-files>");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("warns on git add --all", () => {
    const dir = makeGitRepo();
    try {
      writeFileSync(join(dir, "file1.txt"), "a");
      const result = warnBlanketGitAdd("git add --all", dir);
      expect(result).toContain("BLANKET GIT ADD");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("warns on git add .", () => {
    const dir = makeGitRepo();
    try {
      writeFileSync(join(dir, "file1.txt"), "a");
      const result = warnBlanketGitAdd("git add .", dir);
      expect(result).toContain("BLANKET GIT ADD");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("warns on git add -A in compound command", () => {
    const dir = makeGitRepo();
    try {
      writeFileSync(join(dir, "file1.txt"), "a");
      const result = warnBlanketGitAdd("git add -A && git commit -m msg", dir);
      expect(result).toContain("BLANKET GIT ADD");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("warns on git add -A after cd", () => {
    const dir = makeGitRepo();
    const parent = join(dir, "..");
    try {
      writeFileSync(join(dir, "file1.txt"), "a");
      const result = warnBlanketGitAdd(`cd ${dir} && git add -A && git commit -m msg`, parent);
      expect(result).toContain("BLANKET GIT ADD");
      expect(result).toContain("file1.txt");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does NOT warn on git add with specific files", () => {
    const dir = makeGitRepo();
    try {
      writeFileSync(join(dir, "file1.txt"), "a");
      const result = warnBlanketGitAdd("git add file1.txt", dir);
      expect(result).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does NOT warn on git add with multiple specific files", () => {
    const dir = makeGitRepo();
    try {
      const result = warnBlanketGitAdd("git add src/tools.ts src/index.ts", dir);
      expect(result).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does NOT warn on non-git-add commands", () => {
    const result = warnBlanketGitAdd("git commit -m msg", "/tmp");
    expect(result).toBe("");
  });

  it("does NOT warn on echo/grep containing git add", () => {
    const result = warnBlanketGitAdd('echo "git add -A"', "/tmp");
    expect(result).toBe("");
  });

  it("does NOT warn on comments containing git add", () => {
    const result = warnBlanketGitAdd("# git add -A", "/tmp");
    expect(result).toBe("");
  });

  it("returns empty string when working tree is clean", () => {
    const dir = makeGitRepo();
    try {
      const result = warnBlanketGitAdd("git add -A", dir);
      expect(result).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns empty string for non-git directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "non-git-"));
    try {
      const result = warnBlanketGitAdd("git add -A", dir);
      expect(result).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("shows file count and truncates long lists", () => {
    const dir = makeGitRepo();
    try {
      for (let i = 0; i < 15; i++) {
        writeFileSync(join(dir, `file${i.toString().padStart(2, "0")}.txt`), `content${i}`);
      }
      const result = warnBlanketGitAdd("git add -A", dir);
      expect(result).toContain("15 file(s)");
      expect(result).toContain("+5 more");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
