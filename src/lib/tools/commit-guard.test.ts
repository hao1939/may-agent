import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { BeforeToolCallContext } from "./compose-guards.js";
import { createCommitGuard } from "./commit-guard.js";

let tmpRoots: string[] = [];

function setupRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "may-commit-guard-"));
  tmpRoots.push(root);
  const agentsDir = join(root, "agents");
  mkdirSync(join(agentsDir, "shared"), { recursive: true });
  mkdirSync(join(agentsDir, "may"), { recursive: true });
  execFileSync("git", ["init"], { cwd: agentsDir, stdio: "ignore" });
  return root;
}

function setupAppRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "may-commit-guard-app-"));
  tmpRoots.push(root);
  mkdirSync(join(root, "agents", "may"), { recursive: true });
  mkdirSync(join(root, "projects"), { recursive: true });
  mkdirSync(join(root, "shared"), { recursive: true });
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  return root;
}

function finishContext(deliverables: string[], writePaths: string[] = []): BeforeToolCallContext {
  return {
    toolCall: { name: "finish", id: "finish-1" },
    args: {
      status: "success",
      deliverables: deliverables.map((path) => ({ path, description: "test" })),
    },
    context: {
      messages: [
        {
          role: "assistant",
          content: writePaths.map((path, index) => ({
            type: "toolCall",
            name: index % 2 === 0 ? "edit" : "write",
            arguments: { path },
          })),
        },
      ],
    },
  };
}

afterEach(() => {
  for (const root of tmpRoots) rmSync(root, { recursive: true, force: true });
  tmpRoots = [];
});

describe("commit-guard", () => {
  test("blocks only files matching deliverables or direct writes", async () => {
    const root = setupRepo();
    writeFileSync(join(root, "agents/shared/owned.md"), "owned");
    writeFileSync(join(root, "agents/shared/unrelated.md"), "unrelated");

    const guard = createCommitGuard("may", root);
    const result = await guard(finishContext(["agents/shared/owned.md"]));

    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("shared/owned.md");
    expect(result?.reason).toContain("Not blocking on unrelated dirty file");
    expect(result?.reason).toContain("shared/unrelated.md");
    expect(result?.reason).toContain("git add -- 'shared/owned.md'");
    expect(result?.reason).not.toContain("git add shared/");
  });

  test("warns instead of blocking when dirty shared files are unrelated", async () => {
    const root = setupRepo();
    writeFileSync(join(root, "agents/shared/unrelated.md"), "unrelated");

    const guard = createCommitGuard("may", root);
    const result = await guard(finishContext(["agents/shared/owned.md"]));

    expect(result?.block).toBe(false);
    expect(result?.reason).toContain("none match this session");
  });

  test("falls back to agent directory when no deliverables or direct writes are known", async () => {
    const root = setupRepo();
    writeFileSync(join(root, "agents/may/note.md"), "note");
    writeFileSync(join(root, "agents/shared/unrelated.md"), "unrelated");

    const guard = createCommitGuard("may", root);
    const result = await guard(finishContext([]));

    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("may/note.md");
    expect(result?.reason).toContain("Not blocking on unrelated dirty file");
    expect(result?.reason).toContain("shared/unrelated.md");
    expect(result?.reason).toContain("git add -- 'may/note.md'");
  });

  test("uses the app-root repo layout when .git lives at project root", async () => {
    const root = setupAppRepo();
    mkdirSync(join(root, "projects/demo/outputs"), { recursive: true });
    mkdirSync(join(root, "agents/may/workspace"), { recursive: true });
    writeFileSync(join(root, "projects/demo/outputs/result.md"), "result");
    writeFileSync(join(root, "agents/may/workspace/note.md"), "note");

    const guard = createCommitGuard("may", root);
    const result = await guard(finishContext(
      ["projects/demo/outputs/result.md"],
      ["/app/agents/may/workspace/note.md"],
    ));

    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("projects/demo/outputs/result.md");
    expect(result?.reason).toContain("agents/may/workspace/note.md");
    expect(result?.reason).toContain(`cd ${root}`);
    expect(result?.reason).toContain("git add -f --");
    expect(result?.reason).toContain("'projects/demo/outputs/result.md'");
    expect(result?.reason).toContain("'agents/may/workspace/note.md'");
  });
});
