import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createCommitGuard } from "../src/lib/tools/commit-guard.js";
import type { BeforeToolCallContext } from "@mariozechner/pi-agent-core";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Helper to build a minimal BeforeToolCallContext for testing.
 */
function makeFinishCtx(finishArgs: Record<string, unknown> = {}): BeforeToolCallContext {
  return {
    assistantMessage: {
      role: "assistant",
      content: [{ type: "toolCall" as const, id: "tc_1", name: "finish", arguments: finishArgs }],
      api: "anthropic-messages",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      usage: { input: 0, output: 0, cacheRead: 0 },
      stopReason: "toolCall",
      timestamp: Date.now(),
    },
    toolCall: { type: "toolCall" as const, id: "tc_1", name: "finish", arguments: finishArgs },
    args: finishArgs,
    context: {
      systemPrompt: "test",
      messages: [],
      tools: [],
    },
  };
}

/** Build a non-finish tool call context. */
function makeNonFinishCtx(): BeforeToolCallContext {
  return {
    ...makeFinishCtx({}),
    toolCall: { type: "toolCall" as const, id: "tc_1", name: "read", arguments: { path: "foo" } },
  };
}

function git(cwd: string, args: string[]): void {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed with status ${result.status}: ${result.stderr || result.stdout}`,
    );
  }
}

describe("commit-guard", () => {
  // ── Tests that don't need a real git repo ─────────────────────

  describe("skip conditions", () => {
    it("allows non-finish tool calls through", async () => {
      const guard = createCommitGuard("bob", "/nonexistent");
      const result = await guard(makeNonFinishCtx());
      expect(result).toBeUndefined();
    });

    it("allows finish when agentName is empty", async () => {
      const guard = createCommitGuard("", "/nonexistent");
      const result = await guard(makeFinishCtx({ status: "success", summary: "done" }));
      expect(result).toBeUndefined();
    });

    it("allows finish when agents/.git does not exist", async () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "commit-guard-"));
      try {
        const guard = createCommitGuard("bob", tmpDir);
        const result = await guard(makeFinishCtx({ status: "success", summary: "done" }));
        expect(result).toBeUndefined();
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("allows finish when git command fails (fail-open)", async () => {
      // Point at a dir that exists but has a broken .git
      const tmpDir = mkdtempSync(join(tmpdir(), "commit-guard-"));
      const agentsDir = join(tmpDir, "agents");
      mkdirSync(agentsDir, { recursive: true });
      // Create .git as a file (not a dir) — git commands will fail
      writeFileSync(join(agentsDir, ".git"), "this is not a valid git dir");
      try {
        const guard = createCommitGuard("bob", tmpDir);
        const result = await guard(makeFinishCtx({ status: "success", summary: "done" }));
        expect(result).toBeUndefined();
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  // ── Tests with a real temp git repo ───────────────────────────

  describe("with real git repo", () => {
    let tmpDir: string;
    let agentsDir: string;

    beforeAll(() => {
      tmpDir = mkdtempSync(join(tmpdir(), "commit-guard-"));
      agentsDir = join(tmpDir, "agents");
      mkdirSync(agentsDir, { recursive: true });

      // Initialize a git repo in agents/
      git(agentsDir, ["init"]);
      git(agentsDir, ["config", "user.email", "test@test.com"]);
      git(agentsDir, ["config", "user.name", "Test"]);

      // Create initial commit so git status works cleanly
      writeFileSync(join(agentsDir, ".gitkeep"), "");
      git(agentsDir, ["add", "."]);
      git(agentsDir, ["commit", "-m", "init"]);
    });

    afterAll(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("allows finish when no uncommitted changes exist", async () => {
      const guard = createCommitGuard("bob", tmpDir);
      const result = await guard(makeFinishCtx({ status: "success", summary: "done" }));
      expect(result).toBeUndefined();
    });

    it("blocks finish when agent has uncommitted changes (new file)", async () => {
      // Create a new file in bob's workspace
      const bobDir = join(agentsDir, "bob", "workspace");
      mkdirSync(bobDir, { recursive: true });
      writeFileSync(join(bobDir, "analysis.md"), "# Analysis\nSome content");

      const guard = createCommitGuard("bob", tmpDir);
      const result = await guard(makeFinishCtx({ status: "success", summary: "done" }));

      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect(result!.reason).toContain("uncommitted");
      expect(result!.reason).toContain("bob/");
      expect(result!.reason).toContain("analysis.md");

      // Clean up
      rmSync(join(agentsDir, "bob"), { recursive: true, force: true });
    });

    it("blocks finish when agent has modified tracked file", async () => {
      // Create and commit a file, then modify it
      const coachDir = join(agentsDir, "coach");
      mkdirSync(coachDir, { recursive: true });
      writeFileSync(join(coachDir, "context.md"), "original");
      git(agentsDir, ["add", "coach/"]);
      git(agentsDir, ["commit", "-m", "add coach"]);

      // Now modify it
      writeFileSync(join(coachDir, "context.md"), "modified content");

      const guard = createCommitGuard("coach", tmpDir);
      const result = await guard(makeFinishCtx({ status: "failure", summary: "failed" }));

      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect(result!.reason).toContain("uncommitted");
      expect(result!.reason).toContain("context.md");

      // Clean up — restore file
      git(agentsDir, ["checkout", "--", "coach/"]);
    });

    it("blocks finish with any status (not just success)", async () => {
      const bobDir = join(agentsDir, "bob");
      mkdirSync(bobDir, { recursive: true });
      writeFileSync(join(bobDir, "notes.md"), "some notes");

      const guard = createCommitGuard("bob", tmpDir);

      // Test with status: "partial"
      const result = await guard(makeFinishCtx({ status: "partial", summary: "partial work" }));
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);

      // Clean up
      rmSync(join(agentsDir, "bob"), { recursive: true, force: true });
    });

    it("does not block for changes in a different agent's directory", async () => {
      // Create changes in alice's dir
      const aliceDir = join(agentsDir, "alice");
      mkdirSync(aliceDir, { recursive: true });
      writeFileSync(join(aliceDir, "file.md"), "alice's file");

      // Check as bob — should not be blocked
      const guard = createCommitGuard("bob", tmpDir);
      const result = await guard(makeFinishCtx({ status: "success", summary: "done" }));
      expect(result).toBeUndefined();

      // Clean up
      rmSync(aliceDir, { recursive: true, force: true });
    });

    it("blocks finish when agent has uncommitted changes in shared/", async () => {
      // Create a new file in shared/
      const sharedDir = join(agentsDir, "shared", "knowledge");
      mkdirSync(sharedDir, { recursive: true });
      writeFileSync(join(sharedDir, "entry.md"), "# Knowledge Entry\nSome content");

      const guard = createCommitGuard("bob", tmpDir);
      const result = await guard(makeFinishCtx({ status: "success", summary: "done" }));

      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect(result!.reason).toContain("uncommitted");
      expect(result!.reason).toContain("shared/");
      expect(result!.reason).toContain("entry.md");
      // git add instruction should include shared/
      expect(result!.reason).toContain("git add bob/ shared/");

      // Clean up
      rmSync(join(agentsDir, "shared"), { recursive: true, force: true });
    });

    it("blocks finish when agent has uncommitted changes in .lab/", async () => {
      const labDir = join(agentsDir, ".lab");
      mkdirSync(labDir, { recursive: true });
      writeFileSync(join(labDir, "experiment.md"), "# Experiment");

      const guard = createCommitGuard("bob", tmpDir);
      const result = await guard(makeFinishCtx({ status: "success", summary: "done" }));

      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect(result!.reason).toContain(".lab/");

      // Clean up
      rmSync(labDir, { recursive: true, force: true });
    });

    it("blocks finish when agent has uncommitted changes in gym/", async () => {
      const gymDir = join(agentsDir, "gym", "scenarios");
      mkdirSync(gymDir, { recursive: true });
      writeFileSync(join(gymDir, "scenario.md"), "# Scenario");

      const guard = createCommitGuard("bob", tmpDir);
      const result = await guard(makeFinishCtx({ status: "success", summary: "done" }));

      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect(result!.reason).toContain("gym/");

      // Clean up
      rmSync(join(agentsDir, "gym"), { recursive: true, force: true });
    });

    it("includes both agent dir and shared dir in git add when both have changes", async () => {
      // Create changes in both bob/ and shared/
      const bobDir = join(agentsDir, "bob");
      mkdirSync(bobDir, { recursive: true });
      writeFileSync(join(bobDir, "work.md"), "my work");

      const sharedDir = join(agentsDir, "shared");
      mkdirSync(sharedDir, { recursive: true });
      writeFileSync(join(sharedDir, "protocol.md"), "# Protocol");

      const guard = createCommitGuard("bob", tmpDir);
      const result = await guard(makeFinishCtx({ status: "success", summary: "done" }));

      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      // Should list files from both directories
      expect(result!.reason).toContain("work.md");
      expect(result!.reason).toContain("protocol.md");
      // git add should include both paths
      expect(result!.reason).toContain("git add bob/ shared/");

      // Clean up
      rmSync(join(agentsDir, "bob"), { recursive: true, force: true });
      rmSync(join(agentsDir, "shared"), { recursive: true, force: true });
    });

    it("includes file count and commit instructions in block message", async () => {
      const bobDir = join(agentsDir, "bob", "workspace");
      mkdirSync(bobDir, { recursive: true });
      writeFileSync(join(bobDir, "file1.md"), "content1");
      writeFileSync(join(bobDir, "file2.md"), "content2");

      const guard = createCommitGuard("bob", tmpDir);
      const result = await guard(makeFinishCtx({ status: "success", summary: "done" }));

      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect(result!.reason).toContain("2 uncommitted file(s)");
      expect(result!.reason).toContain("git add -f bob/");
      expect(result!.reason).toContain('git commit -m "bob:');
      expect(result!.reason).toContain("Good messages:");
      expect(result!.reason).toContain("Bad messages:");

      // Clean up
      rmSync(join(agentsDir, "bob"), { recursive: true, force: true });
    });

    it("allows finish after changes are committed", async () => {
      const bobDir = join(agentsDir, "bob");
      mkdirSync(bobDir, { recursive: true });
      writeFileSync(join(bobDir, "work.md"), "my work");

      // First verify it blocks
      const guard = createCommitGuard("bob", tmpDir);
      const blocked = await guard(makeFinishCtx({ status: "success", summary: "done" }));
      expect(blocked).toBeDefined();
      expect(blocked!.block).toBe(true);

      // Now commit the changes
      git(agentsDir, ["add", "bob/"]);
      git(agentsDir, ["commit", "-m", "bob: test commit"]);

      // Should now allow
      const allowed = await guard(makeFinishCtx({ status: "success", summary: "done" }));
      expect(allowed).toBeUndefined();
    });

    it("uses `git add -f` when any uncommitted path is under workspace/ (ignored by agents/.gitignore)", async () => {
      const wsDir = join(agentsDir, "bob", "workspace");
      mkdirSync(wsDir, { recursive: true });
      writeFileSync(join(wsDir, "note.md"), "wip");

      const guard = createCommitGuard("bob", tmpDir);
      const result = await guard(makeFinishCtx({ status: "success", summary: "done" }));

      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect(result!.reason).toContain("git add -f bob/");
      expect(result!.reason).not.toMatch(/git add bob\/(?! )/); // no bare `git add bob/` without -f

      rmSync(join(agentsDir, "bob"), { recursive: true, force: true });
    });

    it("uses plain `git add` (no -f) when no workspace paths are involved", async () => {
      const bobDir = join(agentsDir, "bob");
      mkdirSync(bobDir, { recursive: true });
      writeFileSync(join(bobDir, "top.md"), "top-level");

      const guard = createCommitGuard("bob", tmpDir);
      const result = await guard(makeFinishCtx({ status: "success", summary: "done" }));

      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect(result!.reason).toContain("git add bob/");
      expect(result!.reason).not.toContain("git add -f");

      rmSync(bobDir, { recursive: true, force: true });
    });

    it("detects staged but uncommitted changes", async () => {
      const bobDir = join(agentsDir, "bob", "workspace");
      mkdirSync(bobDir, { recursive: true });
      writeFileSync(join(bobDir, "staged.md"), "staged content");
      git(agentsDir, ["add", "bob/"]);

      const guard = createCommitGuard("bob", tmpDir);
      const result = await guard(makeFinishCtx({ status: "success", summary: "done" }));

      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect(result!.reason).toContain("staged.md");

      // Clean up — unstage and remove
      git(agentsDir, ["reset", "HEAD", "bob/"]);
      rmSync(join(agentsDir, "bob", "workspace"), { recursive: true, force: true });
    });
  });
});
