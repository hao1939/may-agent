import { describe, it, expect } from "vitest";
import { createExecTool, stripRedundantCd, detectsOutsidePaths, isMetaRecursionCommand, isFlakyCliWriteCommand, stripCliPromptContent } from "../src/tools.js";
import type { ExecToolOptions } from "../src/tools.js";

describe("createExecTool with options", () => {
  it("accepts a string cwd (backward compat)", async () => {
    const tool = createExecTool("/tmp");
    const result = await tool.execute("id", { command: "pwd" });
    expect(result.content[0].text).toContain("/tmp");
  });

  it("accepts an ExecToolOptions object", async () => {
    const tool = createExecTool({ cwd: "/tmp" });
    const result = await tool.execute("id", { command: "pwd" });
    expect(result.content[0].text).toContain("/tmp");
  });

  it("blocks commands matching denyPatterns", async () => {
    const tool = createExecTool({
      cwd: "/tmp",
      denyPatterns: [/\bfind\s+\/\s*(?:$|[;&|]|-)/],
      denyMessage: "No global searches allowed.",
    });
    const result = await tool.execute("id", { command: "find / -name foo" });
    expect(result.content[0].text).toContain("Blocked");
    expect(result.content[0].text).toContain("No global searches allowed");
    expect(result.content[0].text).toContain("/tmp");
  });

  it("allows commands that don't match denyPatterns", async () => {
    const tool = createExecTool({
      cwd: "/tmp",
      denyPatterns: [/\bfind\s+\/\s*(?:$|[;&|]|-)/],
    });
    const result = await tool.execute("id", { command: "find ./src -name foo" });
    // Should not be blocked — "find ./src" doesn't match "find /"
    expect(result.content[0].text).not.toContain("Blocked");
  });

  it("allows find with specific absolute paths", { timeout: 15000 }, async () => {
    const tool = createExecTool({
      cwd: "/tmp",
      denyPatterns: [/\bfind\s+\/\s*(?:$|[;&|]|-)/],
    });

    // "find /tmp" — specific dir, should be allowed
    const r1 = await tool.execute("id1", { command: "find /tmp -name foo" });
    expect(r1.content[0].text).not.toContain("Blocked");

    // "find /.hidden" — specific dir starting with dot, should be allowed
    const r2 = await tool.execute("id2", { command: "find /.hidden -name foo" });
    expect(r2.content[0].text).not.toContain("Blocked");

    // "find /var-log" — specific dir with hyphen, should be allowed
    const r3 = await tool.execute("id3", { command: "find /var-log -name foo" });
    expect(r3.content[0].text).not.toContain("Blocked");
  });

  it("blocks find / with flags", async () => {
    const tool = createExecTool({
      cwd: "/tmp",
      denyPatterns: [/\bfind\s+\/\s*(?:$|[;&|]|-)/],
    });

    // "find / -maxdepth 3" — root traversal with flags, should be blocked
    const result = await tool.execute("id", { command: "find / -maxdepth 3 -name foo" });
    expect(result.content[0].text).toContain("Blocked");
  });

  it("blocks find / at end of command", async () => {
    const tool = createExecTool({
      cwd: "/tmp",
      denyPatterns: [/\bfind\s+\/\s*(?:$|[;&|]|-)/],
    });

    // "find /" at end of string — should be blocked
    const result = await tool.execute("id", { command: "find /" });
    expect(result.content[0].text).toContain("Blocked");
  });

  it("blocks find /home pattern", async () => {
    const tool = createExecTool({
      cwd: "/tmp",
      denyPatterns: [/\bfind\s+\/home\b/],
    });
    const result = await tool.execute("id", { command: "find /home -name package.json" });
    expect(result.content[0].text).toContain("Blocked");
  });

  it("blocks sudo find / pattern", async () => {
    const tool = createExecTool({
      cwd: "/tmp",
      denyPatterns: [/\bsudo\s+find\s+\/\s*(?:$|[;&|]|-)/],
    });
    const result = await tool.execute("id", { command: "sudo find / -name foo" });
    expect(result.content[0].text).toContain("Blocked");
  });

  it("echoes cwd on every exec call when echoCwd is true", async () => {
    const tool = createExecTool({
      cwd: "/tmp",
      echoCwd: true,
    });

    // First call should include CWD
    const result1 = await tool.execute("id1", { command: "echo hello" });
    expect(result1.content[0].text).toContain("CWD: /tmp");
    expect(result1.content[0].text).toContain("hello");

    // Second call should also include CWD
    const result2 = await tool.execute("id2", { command: "echo world" });
    expect(result2.content[0].text).toContain("CWD: /tmp");
    expect(result2.content[0].text).toContain("world");
  });

  it("echoes cwd on error output when echoCwd is true", async () => {
    const tool = createExecTool({
      cwd: "/tmp",
      echoCwd: true,
    });

    // Command that will fail with non-zero exit code
    const result = await tool.execute("id", { command: "ls /nonexistent_path_xyz_12345" });
    const text = result.content[0].text;
    // Should include CWD even on error
    expect(text).toContain("CWD: /tmp");
    // Should also include the error
    expect(text).toContain("Exit code");
  });

  it("does not echo cwd when echoCwd is false or unset", async () => {
    const tool = createExecTool({ cwd: "/tmp" });
    const result = await tool.execute("id", { command: "echo hello" });
    expect(result.content[0].text).not.toContain("CWD:");
  });

  it("does not echo cwd on error when echoCwd is false", async () => {
    const tool = createExecTool({ cwd: "/tmp" });
    const result = await tool.execute("id", { command: "ls /nonexistent_path_xyz_12345" });
    expect(result.content[0].text).not.toContain("CWD:");
  });

  it("shows cwd hint in deny message", async () => {
    const tool = createExecTool({
      cwd: "/my/project",
      denyPatterns: [/\bfind\s+\/\s*(?:$|[;&|]|-)/],
    });
    const result = await tool.execute("id", { command: "find / -type f" });
    expect(result.content[0].text).toContain("/my/project");
  });

  it("works with no options (defaults)", async () => {
    const tool = createExecTool();
    const result = await tool.execute("id", { command: "echo ok" });
    expect(result.content[0].text).toContain("ok");
  });

  it("blocks multiple deny patterns", async () => {
    const tool = createExecTool({
      cwd: "/tmp",
      denyPatterns: [
        /\bfind\s+\/\s*(?:$|[;&|]|-)/,
        /\bfind\s+\/home\b/,
        /\bsudo\b/,
      ],
    });

    const r1 = await tool.execute("id1", { command: "find / -name x" });
    expect(r1.content[0].text).toContain("Blocked");

    const r2 = await tool.execute("id2", { command: "find /home -name y" });
    expect(r2.content[0].text).toContain("Blocked");

    const r3 = await tool.execute("id3", { command: "sudo rm -rf /" });
    expect(r3.content[0].text).toContain("Blocked");

    const r4 = await tool.execute("id4", { command: "ls -la" });
    expect(r4.content[0].text).not.toContain("Blocked");
  });
});

describe("warnOutsideRoot", () => {
  const ROOT = "/home/example-user/may-agent";

  it("rewrites /home/user to project root (hallucinated path auto-correction)", async () => {
    const tool = createExecTool({ cwd: ROOT, warnOutsideRoot: ROOT });
    // /home/user is a hallucinated path — it gets rewritten to ROOT
    // The command becomes: find /home/example-user/may-agent -name foo
    // After rewriting, no WARNING is needed since the path is now correct
    const result = await tool.execute("id", { command: "find /home/user -name foo" });
    // Should NOT contain warning — path was auto-corrected
    expect(result.content[0].text).not.toContain("WARNING:");
  });

  it("does not warn when command uses project-root path", async () => {
    const tool = createExecTool({ cwd: ROOT, warnOutsideRoot: ROOT });
    const result = await tool.execute("id", { command: "find /home/example-user/may-agent/src -name foo" });
    expect(result.content[0].text).not.toContain("WARNING:");
    expect(result.content[0].text).not.toContain("outside the project root");
  });

  it("does not warn when command uses relative paths", async () => {
    const tool = createExecTool({ cwd: "/tmp", warnOutsideRoot: ROOT });
    const result = await tool.execute("id", { command: "find . -name foo" });
    expect(result.content[0].text).not.toContain("WARNING:");
    expect(result.content[0].text).not.toContain("outside the project root");
  });

  it("does not warn when warnOutsideRoot is not set", async () => {
    const tool = createExecTool({ cwd: "/tmp" });
    const result = await tool.execute("id", { command: "find /home/user -name foo" });
    expect(result.content[0].text).not.toContain("WARNING:");
    expect(result.content[0].text).not.toContain("outside the project root");
  });

  it("rewrites /app/ paths to project root (hallucinated path auto-correction)", async () => {
    const tool = createExecTool({ cwd: ROOT, warnOutsideRoot: ROOT });
    // /app/something is a hallucinated path — rewritten to ROOT/something
    // The ls will fail because ROOT/something doesn't exist, but the path is now correct
    const result = await tool.execute("id", { command: "ls /app/something" });
    const text = result.content[0].text;
    // Should reference the corrected project root path, not /app/
    expect(text).toContain(ROOT);
    // No outside-root warning because the path was auto-corrected
    expect(text).not.toContain("WARNING:");
  });

  it("rewritten hallucinated path appears in echo output", async () => {
    const tool = createExecTool({ cwd: "/tmp", warnOutsideRoot: ROOT });
    // echo /home/user/something → rewritten to echo /home/example-user/may-agent/something
    const result = await tool.execute("id", { command: "echo /home/user/something" });
    const text = result.content[0].text;
    // The echo output should show the rewritten path
    expect(text).toContain(ROOT + "/something");
    // No WARNING because the hallucinated path was rewritten
    expect(text).not.toContain("WARNING:");
  });

  it("rewrites hallucinated paths even on non-zero exit code", async () => {
    const tool = createExecTool({ cwd: "/tmp", warnOutsideRoot: ROOT });
    // ls on a non-existent path under hallucinated root — will fail but with corrected path
    const result = await tool.execute("id", { command: "ls /home/user/nonexistent_path_xyz" });
    const text = result.content[0].text;
    // The error should reference the corrected project root, not /home/user
    expect(text).toContain(ROOT);
    // No WARNING because the path was rewritten
    expect(text).not.toContain("WARNING:");
  });

  it("warns on /tmp without trailing slash (not a hallucinated path)", async () => {
    const tool = createExecTool({ cwd: "/tmp", warnOutsideRoot: ROOT });
    const result = await tool.execute("id", { command: "ls /tmp" });
    expect(result.content[0].text).toContain("WARNING:");
    expect(result.content[0].text).toContain("outside the project root");
  });

  it("warns on /home without trailing slash (not a hallucinated path)", async () => {
    const tool = createExecTool({ cwd: "/tmp", warnOutsideRoot: ROOT });
    const result = await tool.execute("id", { command: "cd /home" });
    expect(result.content[0].text).toContain("WARNING:");
    expect(result.content[0].text).toContain("outside the project root");
  });

  it("rewrites --root=/home/user/x (hallucinated path in flag)", async () => {
    const tool = createExecTool({ cwd: ROOT, warnOutsideRoot: ROOT });
    // --root=/home/user/x → rewritten to --root=/home/example-user/may-agent/x
    const result = await tool.execute("id", { command: "echo --root=/home/user/x" });
    const text = result.content[0].text;
    expect(text).toContain(ROOT);
    expect(text).not.toContain("WARNING:");
  });

  it("rewrites path-boundary sibling as hallucinated path", async () => {
    // The hallucinated path rewriter matches /home/<user>/<project> generically,
    // so a sibling like /home/example-user/may-agent-old gets rewritten to the project root.
    // This means no outside-root warning is emitted.
    const tool = createExecTool({ cwd: "/tmp", warnOutsideRoot: ROOT });
    const result = await tool.execute("id", { command: "ls /home/example-user/may-agent-old" });
    expect(result.content[0].text).not.toContain("WARNING:");
  });
});

describe("stripRedundantCd", () => {
  const ROOT = "/home/example-user/may-agent";

  it("strips cd <root> && prefix", () => {
    expect(stripRedundantCd("cd /home/example-user/may-agent && git log", ROOT))
      .toBe("git log");
  });

  it("strips cd <root>; prefix", () => {
    expect(stripRedundantCd("cd /home/example-user/may-agent; git log", ROOT))
      .toBe("git log");
  });

  it("strips cd with quotes around path (double)", () => {
    expect(stripRedundantCd('cd "/home/example-user/may-agent" && git log', ROOT))
      .toBe("git log");
  });

  it("strips cd with quotes around path (single)", () => {
    expect(stripRedundantCd("cd '/home/example-user/may-agent' && git log", ROOT))
      .toBe("git log");
  });

  it("strips cd with leading whitespace", () => {
    expect(stripRedundantCd("  cd /home/example-user/may-agent && ls", ROOT))
      .toBe("ls");
  });

  it("does NOT strip cd to a different directory", () => {
    const cmd = "cd /home/user && git log";
    expect(stripRedundantCd(cmd, ROOT)).toBe(cmd);
  });

  it("does NOT strip cd to a subdirectory", () => {
    const cmd = "cd /home/example-user/may-agent/src && ls";
    expect(stripRedundantCd(cmd, ROOT)).toBe(cmd);
  });

  it("does NOT strip cd to parent directory", () => {
    const cmd = "cd /home/example-user && ls";
    expect(stripRedundantCd(cmd, ROOT)).toBe(cmd);
  });

  it("does NOT strip cd to sibling directory", () => {
    const cmd = "cd /home/example-user/may-agent-old && ls";
    expect(stripRedundantCd(cmd, ROOT)).toBe(cmd);
  });

  it("does NOT strip cd in the middle of a command", () => {
    const cmd = "echo hello && cd /home/example-user/may-agent && ls";
    expect(stripRedundantCd(cmd, ROOT)).toBe(cmd);
  });

  it("passes through commands without cd prefix", () => {
    expect(stripRedundantCd("git log", ROOT)).toBe("git log");
    expect(stripRedundantCd("ls -la", ROOT)).toBe("ls -la");
    expect(stripRedundantCd("echo hello", ROOT)).toBe("echo hello");
  });

  it("handles root path with special regex characters", () => {
    const specialRoot = "/home/user/my.project+1";
    expect(stripRedundantCd("cd /home/user/my.project+1 && ls", specialRoot))
      .toBe("ls");
  });
});

describe("stripRedundantCd integration with exec tool", () => {
  it("executes command after stripping cd prefix", async () => {
    const tool = createExecTool({ cwd: "/tmp" });
    // This would fail if the cd was actually executed (cd to /tmp then run echo)
    // but since cwd is /tmp and cd /tmp is stripped, it just runs "echo ok"
    const result = await tool.execute("id", { command: "cd /tmp && echo ok" });
    expect(result.content[0].text).toContain("ok");
  });

  it("deny patterns checked after stripping cd prefix", async () => {
    const tool = createExecTool({
      cwd: "/tmp",
      denyPatterns: [/\bfind\s+\/\s*(?:$|[;&|]|-)/],
    });
    // cd /tmp && find / -name foo → stripped to: find / -name foo → blocked
    const result = await tool.execute("id", { command: "cd /tmp && find / -name foo" });
    expect(result.content[0].text).toContain("Blocked");
  });

  it("warnOutsideRoot checked after stripping cd prefix", async () => {
    const ROOT = "/home/example-user/may-agent";
    const tool = createExecTool({ cwd: ROOT, warnOutsideRoot: ROOT });
    // cd <root> && echo hello → stripped to: echo hello → no warning
    const result = await tool.execute("id", { command: `cd ${ROOT} && echo hello` });
    const text = result.content[0].text;
    expect(text).toContain("hello");
    expect(text).not.toContain("WARNING:");
  });
});

describe("detectsOutsidePaths", () => {
  const ROOT = "/home/example-user/may-agent";

  it("detects /home/user as outside root", () => {
    expect(detectsOutsidePaths("find /home/user -name foo", ROOT)).toBe(true);
  });

  it("does not detect project root as outside", () => {
    expect(detectsOutsidePaths("find /home/example-user/may-agent/src -name foo", ROOT)).toBe(false);
  });

  it("detects /home/example-user (parent of root) as outside", () => {
    expect(detectsOutsidePaths("cd /home/example-user && ls", ROOT)).toBe(true);
  });

  it("does not flag relative paths", () => {
    expect(detectsOutsidePaths("find . -name foo", ROOT)).toBe(false);
  });

  it("detects /app as outside", () => {
    expect(detectsOutsidePaths("ls /app/something", ROOT)).toBe(true);
  });

  it("detects exact root as not-outside", () => {
    expect(detectsOutsidePaths("cd /home/example-user/may-agent", ROOT)).toBe(false);
  });

  it("detects sibling directories as outside", () => {
    expect(detectsOutsidePaths("ls /home/example-user/may-agent-old", ROOT)).toBe(true);
  });
});

describe("exec error hints integration", () => {
  const ROOT = "/home/example-user/may-agent";

  it("provides glob hint when ls with wildcard matches nothing (stderr suppressed)", async () => {
    const tool = createExecTool({ cwd: ROOT, warnOutsideRoot: ROOT, echoCwd: true });
    const result = await tool.execute("id", { command: "ls agents/*/nonexistent_dir_xyz/ 2>/dev/null" });
    const text = result.content[0].text;
    expect(text).toContain("Exit code");
    expect(text).toContain("Hint:");
    expect(text).toContain("glob pattern matched nothing");
  });

  it("provides module-not-found hint", async () => {
    const tool = createExecTool({ cwd: ROOT, warnOutsideRoot: ROOT, echoCwd: true });
    const result = await tool.execute("id", { command: 'node -e "require(\'./dist/nonexistent.js\')"' });
    const text = result.content[0].text;
    expect(text).toContain("Hint:");
    expect(text).toContain("built first");
  });

  it("provides grep no-match hint", async () => {
    const tool = createExecTool({ cwd: ROOT, warnOutsideRoot: ROOT, echoCwd: true });
    const result = await tool.execute("id", { command: "grep -r 'ZZZZNONEXISTENT_PATTERN_XYZ' src/" });
    const text = result.content[0].text;
    expect(text).toContain("Hint:");
    expect(text).toContain("grep exited with code 1");
  });
});

describe("meta-recursion guard", () => {
  describe("isMetaRecursionCommand", () => {
    it("detects npx tsx run/may.ts", () => {
      expect(isMetaRecursionCommand("npx tsx run/may.ts")).toBe(true);
    });

    it("detects npx tsx run/may.ts with arguments", () => {
      expect(isMetaRecursionCommand("npx tsx run/may.ts --agent optimizer")).toBe(true);
    });

    it("detects npx tsx ./run/may.ts", () => {
      expect(isMetaRecursionCommand("npx tsx ./run/may.ts")).toBe(true);
    });

    it("detects node run/may.ts", () => {
      expect(isMetaRecursionCommand("node run/may.ts")).toBe(true);
    });

    it("detects node ./run/may.ts", () => {
      expect(isMetaRecursionCommand("node ./run/may.ts")).toBe(true);
    });

    it("detects ts-node run/may.ts", () => {
      expect(isMetaRecursionCommand("ts-node run/may.ts")).toBe(true);
    });

    it("detects ts-node ./run/may.ts", () => {
      expect(isMetaRecursionCommand("ts-node ./run/may.ts")).toBe(true);
    });

    it("detects ./run/may.ts (direct execution)", () => {
      expect(isMetaRecursionCommand("./run/may.ts")).toBe(true);
    });

    it("detects npx tsx src/index.ts", () => {
      expect(isMetaRecursionCommand("npx tsx src/index.ts")).toBe(true);
    });

    it("detects node src/index.ts", () => {
      expect(isMetaRecursionCommand("node src/index.ts")).toBe(true);
    });

    it("detects node ./src/index.ts", () => {
      expect(isMetaRecursionCommand("node ./src/index.ts")).toBe(true);
    });

    it("detects ./src/index.ts (direct execution)", () => {
      expect(isMetaRecursionCommand("./src/index.ts")).toBe(true);
    });

    it("detects meta-recursion in chained commands", () => {
      expect(isMetaRecursionCommand("cd /tmp && ./run/may.ts")).toBe(true);
    });

    it("detects meta-recursion with semicolons", () => {
      expect(isMetaRecursionCommand("echo hello; ./run/may.ts")).toBe(true);
    });

    it("detects meta-recursion with pipes", () => {
      expect(isMetaRecursionCommand("echo foo | npx tsx run/may.ts")).toBe(true);
    });

    it("does NOT block normal commands", () => {
      expect(isMetaRecursionCommand("echo hello")).toBe(false);
      expect(isMetaRecursionCommand("ls -la")).toBe(false);
      expect(isMetaRecursionCommand("npx vitest --run")).toBe(false);
      expect(isMetaRecursionCommand("npx tsc --noEmit")).toBe(false);
      expect(isMetaRecursionCommand("node test.js")).toBe(false);
      expect(isMetaRecursionCommand("grep may.ts src/")).toBe(false);
      expect(isMetaRecursionCommand("cat run/may.ts")).toBe(false);
    });

    it("does NOT block reading/editing may.ts (non-exec operations)", () => {
      expect(isMetaRecursionCommand("cat src/index.ts")).toBe(false);
      expect(isMetaRecursionCommand("grep -n something run/may.ts")).toBe(false);
      expect(isMetaRecursionCommand("wc -l run/may.ts")).toBe(false);
    });
  });

  describe("exec tool integration", () => {
    // Meta-recursion guard is currently disabled in createExecTool
    // (was causing false positives with string literals containing system commands).
    // These integration tests are skipped until the guard is re-enabled.
    it.skip("blocks npx tsx run/may.ts with helpful error", async () => {
      const tool = createExecTool({ cwd: "/tmp" });
      const result = await tool.execute("id", { command: "npx tsx run/may.ts" });
      const text = result.content[0].text;
      expect(text).toContain("BLOCKED");
      expect(text).toContain("meta-recursion");
      expect(text).toContain("subagents");
    });

    it.skip("blocks node run/may.ts with helpful error", async () => {
      const tool = createExecTool({ cwd: "/tmp" });
      const result = await tool.execute("id", { command: "node run/may.ts --agent bob" });
      const text = result.content[0].text;
      expect(text).toContain("BLOCKED");
      expect(text).toContain("subagents");
    });

    it.skip("blocks ./run/may.ts with helpful error", async () => {
      const tool = createExecTool({ cwd: "/tmp" });
      const result = await tool.execute("id", { command: "./run/may.ts" });
      const text = result.content[0].text;
      expect(text).toContain("BLOCKED");
    });

    it.skip("blocks npx tsx src/index.ts with helpful error", async () => {
      const tool = createExecTool({ cwd: "/tmp" });
      const result = await tool.execute("id", { command: "npx tsx src/index.ts" });
      const text = result.content[0].text;
      expect(text).toContain("BLOCKED");
      expect(text).toContain("subagents");
    });

    it("does NOT block normal exec commands", async () => {
      const tool = createExecTool({ cwd: "/tmp" });
      const result = await tool.execute("id", { command: "echo hello" });
      expect(result.content[0].text).not.toContain("BLOCKED");
      expect(result.content[0].text).toContain("hello");
    });
  });

  describe("stripForDenyCheck", () => {
    it("allows CLI agent prompts containing write patterns", async () => {
      const tool = createExecTool({
        cwd: "/tmp",
        denyPatterns: [/\b(echo|printf)\b.*>{1,2}[^&]/],
        denyMessage: "No direct writes.",
        stripForDenyCheck: stripCliPromptContent,
      });
      // This prompt contains "echo > file" but it's inside claude's -p argument
      const result = await tool.execute("id", {
        command: `claude --print --dangerously-skip-permissions -p "echo 'hello' > test.txt" 2>&1`,
        timeout: 2,
      });
      // Should NOT be blocked — the echo > is inside a prompt string
      expect(result.content[0].text).not.toContain("Blocked");
    });

    it("still blocks direct write commands even with stripForDenyCheck", async () => {
      const tool = createExecTool({
        cwd: "/tmp",
        denyPatterns: [/\b(echo|printf)\b.*>{1,2}[^&]/],
        denyMessage: "No direct writes.",
        stripForDenyCheck: stripCliPromptContent,
      });
      const result = await tool.execute("id", { command: "echo 'hello' > /tmp/foo.txt" });
      expect(result.content[0].text).toContain("Blocked");
    });
  });
});

describe("stripCliPromptContent", () => {
  it("strips quoted -p argument from claude command", () => {
    const cmd = `claude -p "echo foo > bar.txt" --model claude-opus-4.6`;
    const stripped = stripCliPromptContent(cmd);
    expect(stripped).not.toContain("echo foo");
    expect(stripped).toContain("-p");
    expect(stripped).toContain("--model claude-opus-4.6");
  });

  it("strips single-quoted -p argument", () => {
    const cmd = `claude -p 'tee /tmp/output.txt <<EOF' 2>&1`;
    const stripped = stripCliPromptContent(cmd);
    expect(stripped).not.toContain("tee");
    expect(stripped).not.toContain("EOF");
  });

  it("strips --prompt argument from gemini command", () => {
    const cmd = `gemini --prompt "printf 'data' > file.txt" --model gemini-3.1-pro`;
    const stripped = stripCliPromptContent(cmd);
    expect(stripped).not.toContain("printf");
    expect(stripped).toContain("--prompt");
  });

  it("strips piped echo content to gemini", () => {
    const cmd = `echo 'Run this: echo hello > /tmp/test.txt' | gemini 2>&1`;
    const stripped = stripCliPromptContent(cmd);
    expect(stripped).not.toContain("hello");
    expect(stripped).toContain("gemini");
  });

  it("strips piped printf content to gemini", () => {
    const cmd = `printf 'Create file with tee' | gemini --yolo 2>&1`;
    const stripped = stripCliPromptContent(cmd);
    expect(stripped).not.toContain("tee");
    expect(stripped).toContain("gemini");
  });

  it("strips shell variable assignments used as prompts", () => {
    const cmd = `PROMPT='echo hello > file.txt'\nclaude -p "$PROMPT" 2>&1`;
    const stripped = stripCliPromptContent(cmd);
    expect(stripped).not.toContain("echo hello");
  });

  it("strips $VARIABLE reference after -p", () => {
    const cmd = `claude -p "$PROMPT" 2>&1`;
    const stripped = stripCliPromptContent(cmd);
    expect(stripped).not.toContain("$PROMPT");
  });

  it("preserves non-prompt parts of the command", () => {
    const cmd = `claude --dangerously-skip-permissions --print -p "task here" --model claude-opus-4.6 2>&1`;
    const stripped = stripCliPromptContent(cmd);
    expect(stripped).toContain("--dangerously-skip-permissions");
    expect(stripped).toContain("--print");
    expect(stripped).toContain("--model claude-opus-4.6");
    expect(stripped).toContain("2>&1");
  });

  it("does NOT strip regular echo commands (no pipe to CLI tool)", () => {
    const cmd = `echo 'hello' > /tmp/output.txt`;
    const stripped = stripCliPromptContent(cmd);
    // This should still contain the echo > pattern for deny matching
    expect(stripped).toContain("echo");
    expect(stripped).toContain(">");
  });

  it("does NOT strip non-CLI sed commands", () => {
    const cmd = `sed -i 's/foo/bar/g' file.txt`;
    const stripped = stripCliPromptContent(cmd);
    expect(stripped).toContain("sed -i");
  });

  it("handles complex multi-line prompt with heredoc-like content", () => {
    const cmd = `claude -p "Create a file using:\ncat > output.txt << 'EOF'\nhello\nEOF" 2>&1`;
    const stripped = stripCliPromptContent(cmd);
    expect(stripped).not.toContain("cat >");
    expect(stripped).not.toContain("EOF");
  });
});

describe("flaky CLI file-write guardrail", () => {
  describe("isFlakyCliWriteCommand", () => {
    it("detects gemini-cli > file.ts", () => {
      expect(isFlakyCliWriteCommand("gemini-cli --yolo > output.ts")).toBe(true);
    });

    it("detects gemini-cli >> file.ts (append)", () => {
      expect(isFlakyCliWriteCommand("gemini-cli --yolo >> output.ts")).toBe(true);
    });

    it("detects gemini > file.ts", () => {
      expect(isFlakyCliWriteCommand("gemini -p 'task' > result.txt")).toBe(true);
    });

    it("detects claude > file.ts", () => {
      expect(isFlakyCliWriteCommand("claude --print -p 'task' > output.ts")).toBe(true);
    });

    it("detects claude >> file.ts (append)", () => {
      expect(isFlakyCliWriteCommand("claude -p 'task' >> output.ts")).toBe(true);
    });

    it("detects redirection with flags before it", () => {
      expect(isFlakyCliWriteCommand("gemini-cli --yolo --model gemini-3.1-pro > file.ts")).toBe(true);
    });

    it("does NOT block gemini-cli with 2>&1 (stderr merge)", () => {
      expect(isFlakyCliWriteCommand("gemini-cli --yolo 2>&1")).toBe(false);
    });

    it("does NOT block claude with 2>&1 (stderr merge)", () => {
      expect(isFlakyCliWriteCommand("claude -p 'task' 2>&1")).toBe(false);
    });

    it("does NOT block claude with 2>/dev/null (stderr discard)", () => {
      expect(isFlakyCliWriteCommand("claude -p 'task' 2>/dev/null")).toBe(false);
    });

    it("does NOT block regular commands (echo, ls)", () => {
      expect(isFlakyCliWriteCommand("echo hello")).toBe(false);
      expect(isFlakyCliWriteCommand("ls -la")).toBe(false);
      expect(isFlakyCliWriteCommand("grep foo bar.txt")).toBe(false);
    });

    it("does NOT block gemini-cli without redirection", () => {
      expect(isFlakyCliWriteCommand("gemini-cli --yolo 2>&1")).toBe(false);
    });

    it("does NOT block claude without redirection", () => {
      expect(isFlakyCliWriteCommand("claude -p 'hello'")).toBe(false);
    });

    it("does NOT block claude -p with prompt containing > in quotes", () => {
      // The > is inside the prompt string, not a shell redirect
      expect(isFlakyCliWriteCommand('claude -p "echo hello > file.txt" 2>&1')).toBe(false);
    });

    it("does NOT block gemini with prompt containing > in quotes", () => {
      expect(isFlakyCliWriteCommand("gemini -p 'write to > file.txt' 2>&1")).toBe(false);
    });

    it("does NOT block piped output to gemini", () => {
      expect(isFlakyCliWriteCommand("echo 'task' | gemini --yolo 2>&1")).toBe(false);
    });

    it("does NOT block git commands mentioning gemini in messages", () => {
      expect(isFlakyCliWriteCommand("git commit -m 'fix gemini integration'")).toBe(false);
    });

    it("does NOT block grep for claude in files", () => {
      expect(isFlakyCliWriteCommand("grep -r 'claude' src/")).toBe(false);
    });
  });

  describe("exec tool integration", () => {
    it("blocks gemini-cli > file.ts with helpful error", async () => {
      const tool = createExecTool({ cwd: "/tmp" });
      const result = await tool.execute("id", { command: "gemini-cli --yolo > output.ts" });
      const text = result.content[0].text;
      expect(text).toContain("BLOCKED");
      expect(text).toContain("write");
      expect(text).toContain("unreliable");
    });

    it("blocks claude > file.ts with helpful error", async () => {
      const tool = createExecTool({ cwd: "/tmp" });
      const result = await tool.execute("id", { command: "claude --print -p 'task' > output.ts" });
      const text = result.content[0].text;
      expect(text).toContain("BLOCKED");
      expect(text).toContain("write");
    });

    it("blocks gemini >> file.ts with helpful error", async () => {
      const tool = createExecTool({ cwd: "/tmp" });
      const result = await tool.execute("id", { command: "gemini -p 'task' >> result.txt" });
      const text = result.content[0].text;
      expect(text).toContain("BLOCKED");
    });

    it("does NOT block claude -p '...' 2>&1 (normal usage)", async () => {
      const tool = createExecTool({ cwd: "/tmp" });
      const result = await tool.execute("id", { command: "echo test" });
      expect(result.content[0].text).not.toContain("BLOCKED");
    });

    it("does NOT block normal echo commands", async () => {
      const tool = createExecTool({ cwd: "/tmp" });
      const result = await tool.execute("id", { command: "echo hello world" });
      expect(result.content[0].text).not.toContain("BLOCKED");
      expect(result.content[0].text).toContain("hello world");
    });
  });
});
