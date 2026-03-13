import { describe, it, expect } from "vitest";
import { checkProtectedPath, checkBashCommand } from "../src/app/agent-loader.js";

const AGENTS_ROOT = "/app/agents";

describe("checkProtectedPath (P53 cross-agent protection)", () => {
  it("allows writes to own agent SOUL.md", () => {
    const result = checkProtectedPath("/app/agents/bob/SOUL.md", "bob", AGENTS_ROOT);
    expect(result).toBeNull();
  });

  it("allows writes to own agent agent.json", () => {
    const result = checkProtectedPath("/app/agents/bob/agent.json", "bob", AGENTS_ROOT);
    expect(result).toBeNull();
  });

  it("allows writes to own agent LESSONS.md", () => {
    const result = checkProtectedPath("/app/agents/bob/LESSONS.md", "bob", AGENTS_ROOT);
    expect(result).toBeNull();
  });

  it("blocks writes to another agent's SOUL.md", () => {
    const result = checkProtectedPath("/app/agents/coder/SOUL.md", "bob", AGENTS_ROOT);
    expect(result).not.toBeNull();
    expect(result).toContain("WRITE BLOCKED");
    expect(result).toContain("P53");
    expect(result).toContain("SOUL.md");
  });

  it("blocks writes to another agent's agent.json", () => {
    const result = checkProtectedPath("/app/agents/may/agent.json", "bob", AGENTS_ROOT);
    expect(result).not.toBeNull();
    expect(result).toContain("agent.json");
  });

  it("blocks writes to another agent's LESSONS.md", () => {
    const result = checkProtectedPath("/app/agents/tech-lead/LESSONS.md", "bob", AGENTS_ROOT);
    expect(result).not.toBeNull();
    expect(result).toContain("LESSONS.md");
  });

  it("allows writes to another agent's workspace files", () => {
    const result = checkProtectedPath("/app/agents/coder/workspace/notes.md", "bob", AGENTS_ROOT);
    expect(result).toBeNull();
  });

  it("allows writes to another agent's knowledge files", () => {
    const result = checkProtectedPath("/app/agents/coder/knowledge/coaching.md", "bob", AGENTS_ROOT);
    expect(result).toBeNull();
  });

  it("allows writes to shared/ directory", () => {
    const result = checkProtectedPath("/app/agents/shared/bulletin.md", "bob", AGENTS_ROOT);
    expect(result).toBeNull();
  });

  it("allows writes outside agents/ entirely", () => {
    const result = checkProtectedPath("/app/src/lib/manager.ts", "bob", AGENTS_ROOT);
    expect(result).toBeNull();
  });

  it("blocks writes to nested protected files (SOUL.md in subdirectory)", () => {
    // agents/coder/knowledge/SOUL.md — the filename matches, so it blocks
    // This is conservative: better to block too aggressively than allow leaks
    const result = checkProtectedPath("/app/agents/coder/knowledge/SOUL.md", "bob", AGENTS_ROOT);
    expect(result).not.toBeNull();
  });

  it("allows own agent's nested protected files", () => {
    const result = checkProtectedPath("/app/agents/bob/knowledge/SOUL.md", "bob", AGENTS_ROOT);
    expect(result).toBeNull();
  });

  it("handles deeply nested agent workspace paths", () => {
    const result = checkProtectedPath(
      "/app/agents/coach/workspace/exercises/tech-lead-regression/session-cleanup.ts",
      "tech-lead",
      AGENTS_ROOT,
    );
    expect(result).toBeNull();
  });

  it("includes the blocked agent name and caller name in the message", () => {
    const result = checkProtectedPath("/app/agents/coder/SOUL.md", "optimizer", AGENTS_ROOT);
    expect(result).toContain("agents/coder/");
    expect(result).toContain('"optimizer"');
    expect(result).toContain("agents/optimizer/");
  });

  it("allows writes to .lab/ fork LESSONS.md (growth system sandbox)", () => {
    const result = checkProtectedPath(
      "/app/agents/.lab/bob-growth-test/LESSONS.md",
      "coach",
      AGENTS_ROOT,
    );
    expect(result).toBeNull();
  });

  it("allows writes to .lab/ fork SOUL.md", () => {
    const result = checkProtectedPath(
      "/app/agents/.lab/bob-growth-test/SOUL.md",
      "coach",
      AGENTS_ROOT,
    );
    expect(result).toBeNull();
  });

  it("allows writes to .lab/ fork agent.json", () => {
    const result = checkProtectedPath(
      "/app/agents/.lab/bob-growth-test/agent.json",
      "coach",
      AGENTS_ROOT,
    );
    expect(result).toBeNull();
  });
});

describe("checkBashCommand (P53 bash guard)", () => {
  // --- Blocked commands ---

  it("blocks bash command writing to SOUL.md", () => {
    const result = checkBashCommand('echo "evil" > agents/coder/SOUL.md', "tech-lead");
    expect(result).not.toBeNull();
    expect(result).toContain("BASH BLOCKED");
    expect(result).toContain("P53");
    expect(result).toContain("SOUL.md");
  });

  it("blocks bash command with sed editing agent.json", () => {
    const result = checkBashCommand('sed -i "s/old/new/" agents/bob/agent.json', "coder");
    expect(result).not.toBeNull();
    expect(result).toContain("BASH BLOCKED");
    expect(result).toContain("agent.json");
  });

  it("allows read-only bash command referencing LESSONS.md", () => {
    const result = checkBashCommand("cat agents/may/LESSONS.md | wc -l", "optimizer");
    expect(result).toBeNull();
  });

  it("blocks bash command referencing philosophy.md", () => {
    const result = checkBashCommand("cp /tmp/evil.md agents/shared/philosophy.md", "coder");
    expect(result).not.toBeNull();
    expect(result).toContain("philosophy.md");
  });

  it("allows grep (read-only) commands referencing SOUL.md", () => {
    const result = checkBashCommand('grep -r "something" agents/*/SOUL.md', "bob");
    expect(result).toBeNull();
  });

  it("blocks piped commands referencing protected files", () => {
    const result = checkBashCommand('cat something | tee agents/coder/SOUL.md', "bob");
    expect(result).not.toBeNull();
    expect(result).toContain("BASH BLOCKED");
  });

  it("blocks rm commands on protected files", () => {
    const result = checkBashCommand("rm agents/coder/agent.json", "optimizer");
    expect(result).not.toBeNull();
    expect(result).toContain("BASH BLOCKED");
  });

  it("blocks mv commands targeting protected files", () => {
    const result = checkBashCommand("mv /tmp/evil.md agents/coder/SOUL.md", "bob");
    expect(result).not.toBeNull();
    expect(result).toContain("BASH BLOCKED");
  });

  // --- Allowed commands ---

  it("allows normal bash commands without protected file references", () => {
    const result = checkBashCommand("ls -la src/lib/", "coder");
    expect(result).toBeNull();
  });

  it("allows running tests", () => {
    const result = checkBashCommand("npx vitest run test/path-guard.test.ts", "tech-lead");
    expect(result).toBeNull();
  });

  it("allows reading source code with cat", () => {
    const result = checkBashCommand("cat src/lib/manager.ts", "coder");
    expect(result).toBeNull();
  });

  it("allows tsc compilation", () => {
    const result = checkBashCommand("npx tsc --noEmit 2>&1", "tech-lead");
    expect(result).toBeNull();
  });

  it("allows grep in source files", () => {
    const result = checkBashCommand('grep -rn "function" src/lib/', "coder");
    expect(result).toBeNull();
  });

  it("allows writing to workspace files", () => {
    const result = checkBashCommand('echo "notes" > agents/bob/workspace/notes.md', "bob");
    expect(result).toBeNull();
  });

  // --- Exemptions ---

  it("allows may to reference SOUL.md in bash (supervisor exemption)", () => {
    const result = checkBashCommand("cat agents/coder/SOUL.md", "may");
    expect(result).toBeNull();
  });

  it("allows may to reference agent.json in bash (supervisor exemption)", () => {
    const result = checkBashCommand('grep "model" agents/*/agent.json', "may");
    expect(result).toBeNull();
  });

  it("allows may to reference philosophy.md in bash (supervisor exemption)", () => {
    const result = checkBashCommand("cat agents/shared/philosophy.md", "may");
    expect(result).toBeNull();
  });

  it("allows may to reference LESSONS.md in bash (supervisor exemption)", () => {
    const result = checkBashCommand("wc -l agents/bob/LESSONS.md", "may");
    expect(result).toBeNull();
  });

  // --- Edge cases ---

  it("allows find+cat (read-only) even when protected filename is mid-command", () => {
    const result = checkBashCommand('find . -name "SOUL.md" -exec cat {} \\;', "coder");
    expect(result).toBeNull();
  });

  it("allows variable assignment (read-only) with protected filename", () => {
    const result = checkBashCommand('FILE="SOUL.md"; echo "$FILE"', "coder");
    expect(result).toBeNull();
  });

  it("allows commands with empty string", () => {
    const result = checkBashCommand("", "coder");
    expect(result).toBeNull();
  });

  // --- Blocked: interpreter-based write bypass (P53 hardening) ---

  it("blocks python3 write targeting SOUL.md", () => {
    const result = checkBashCommand('python3 -c "open(\'SOUL.md\',\'w\').write(\'evil\')"', "coder");
    expect(result).not.toBeNull();
    expect(result).toContain("BASH BLOCKED");
    expect(result).toContain("SOUL.md");
  });

  it("blocks node -e write targeting agent.json", () => {
    const result = checkBashCommand('node -e "require(\'fs\').writeFileSync(\'agents/bob/agent.json\',\'{}\')"', "coder");
    expect(result).not.toBeNull();
    expect(result).toContain("BASH BLOCKED");
    expect(result).toContain("agent.json");
  });

  it("blocks php write targeting LESSONS.md", () => {
    const result = checkBashCommand('php -r "file_put_contents(\'LESSONS.md\',\'evil\');"', "coder");
    expect(result).not.toBeNull();
    expect(result).toContain("BASH BLOCKED");
    expect(result).toContain("LESSONS.md");
  });

  it("blocks awk write targeting philosophy.md", () => {
    const result = checkBashCommand('awk \'BEGIN{print "evil"}\' > philosophy.md', "coder");
    expect(result).not.toBeNull();
    expect(result).toContain("BASH BLOCKED");
    expect(result).toContain("philosophy.md");
  });

  it("blocks ruby write targeting SOUL.md", () => {
    const result = checkBashCommand('ruby -e "File.write(\'SOUL.md\',\'evil\')"', "coder");
    expect(result).not.toBeNull();
    expect(result).toContain("BASH BLOCKED");
    expect(result).toContain("SOUL.md");
  });

  it("blocks dd targeting LESSONS.md", () => {
    const result = checkBashCommand('dd if=/dev/zero of=LESSONS.md bs=1 count=10', "coder");
    expect(result).not.toBeNull();
    expect(result).toContain("BASH BLOCKED");
  });
});
