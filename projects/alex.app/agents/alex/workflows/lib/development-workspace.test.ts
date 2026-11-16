import { afterEach, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareDevelopmentWorkspace } from "./development-workspace.js";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const signal = () => new AbortController().signal;

function fixture(ignoreRules = "node_modules\n/projects/may-agent\n") {
  const root = mkdtempSync(join(tmpdir(), "alex-workspace-test-")); roots.push(root);
  const source = join(root, "source"), worktree = join(root, "candidate"); mkdirSync(source);
  const git = (...args: string[]) => execFileSync("git", ["-C", source, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
  git("init", "-b", "main"); git("config", "user.name", "Workspace test"); git("config", "user.email", "test@example.invalid");
  writeFileSync(join(source, ".gitignore"), ignoreRules);
  writeFileSync(join(source, "package.json"), JSON.stringify({ dependencies: { "@may-agent/sdk": "file:projects/may-agent/bundle/sdk-current" } }));
  mkdirSync(join(source, "projects")); writeFileSync(join(source, "projects/.gitkeep"), "");
  git("add", "."); git("commit", "-m", "Apps checkout"); git("worktree", "add", "-b", "candidate", worktree);
  mkdirSync(join(source, "node_modules/typescript/bin"), { recursive: true }); writeFileSync(join(source, "node_modules/typescript/bin/tsc"), "existing compiler");
  const prepareRuntime = () => {
    mkdirSync(join(source, "projects/may-agent/packages/sdk/src"), { recursive: true });
    writeFileSync(join(source, "projects/may-agent/packages/sdk/src/task-contract.ts"), "export const paired = true;\n");
  };
  return { source, worktree, prepareRuntime, git };
}

test("linked Apps worktree reuses paired dependencies without changing source; concurrent setup is safe", async () => {
  const t = fixture(); t.prepareRuntime();
  const results = await Promise.all(Array.from({ length: 4 }, () => prepareDevelopmentWorkspace(t.worktree, signal())));
  expect(results.every(mounts => mounts.length === 2)).toBe(true);
  for (const path of ["node_modules", "projects/may-agent"])
    expect(realpathSync(join(t.worktree, path))).toBe(realpathSync(join(t.source, path)));
  expect(execFileSync("git", ["-C", t.worktree, "status", "--porcelain"], { encoding: "utf8" })).toBe("");
  expect((await prepareDevelopmentWorkspace(t.worktree, signal())).every(m => !m.created)).toBe(true);
});

test("missing paired Runtime fails before either dependency link is created", async () => {
  const t = fixture();
  await expect(prepareDevelopmentWorkspace(t.worktree, signal())).rejects.toThrow("prepare the paired Runtime");
  expect(existsSync(join(t.worktree, "node_modules"))).toBe(false);
  expect(existsSync(join(t.worktree, "projects/may-agent"))).toBe(false);
});

test("an existing broken dependency link is preserved and reported", async () => {
  const t = fixture(); t.prepareRuntime();
  const original = join(t.source, "missing-installation"); symlinkSync(original, join(t.worktree, "node_modules"));
  await expect(prepareDevelopmentWorkspace(t.worktree, signal())).rejects.toThrow("preserve the existing path");
  expect(readlinkSync(join(t.worktree, "node_modules"))).toBe(original);
  expect(existsSync(join(t.worktree, "projects/may-agent"))).toBe(false);
});

test.each(["", "node_modules/\n/projects/may-agent/\n"])("unsafe ignore rules cause no dependency writes: %j", async (rules) => {
  const t = fixture(rules); t.prepareRuntime();
  await expect(prepareDevelopmentWorkspace(t.worktree, signal())).rejects.toThrow("must be ignored before linking");
  expect(existsSync(join(t.worktree, "node_modules"))).toBe(false);
  expect(existsSync(join(t.worktree, "projects/may-agent"))).toBe(false);
});
