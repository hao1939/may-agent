import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHandoffTool } from "../src/lib/tools/handoff-tool.js";
import type { HandoffToolOptions } from "../src/lib/tools/handoff-tool.js";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ── Test scaffolding ───────────────────────────────────────────────────

let testDir: string;
let projectRoot: string;
let agentsRoot: string;
let signalsPath: string;

function setup() {
  testDir = join(tmpdir(), `handoff-tool-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  projectRoot = testDir;
  agentsRoot = join(testDir, "agents");
  signalsPath = join(agentsRoot, "shared", "SIGNALS.md");

  mkdirSync(join(agentsRoot, "shared"), { recursive: true });
  mkdirSync(join(agentsRoot, "qa", "workspace"), { recursive: true });
  mkdirSync(join(agentsRoot, "bob", "workspace"), { recursive: true });
  mkdirSync(join(testDir, "src", "lib"), { recursive: true });

  // Create a test artifact
  writeFileSync(join(testDir, "src", "lib", "feature.ts"), "export const x = 1;\n", "utf-8");

  // Create initial SIGNALS.md
  writeFileSync(signalsPath, "# Signals\n", "utf-8");
}

function cleanup() {
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

function makeOpts(overrides?: Partial<HandoffToolOptions>): HandoffToolOptions {
  return {
    agentName: "coder",
    agentsRoot,
    projectRoot,
    signalsPath,
    ...overrides,
  };
}

async function execute(opts: HandoffToolOptions, params: Record<string, unknown>) {
  const tool = createHandoffTool(opts);
  const result = await tool.execute("tc_1", params);
  // Extract text from content array
  const content = (result as any).content;
  if (Array.isArray(content) && content.length > 0) {
    return content[0].text as string;
  }
  return "";
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("createHandoffTool", () => {
  beforeEach(setup);
  afterEach(cleanup);

  describe("tool metadata", () => {
    it("has correct name and description", () => {
      const tool = createHandoffTool(makeOpts());
      expect(tool.name).toBe("handoff");
      expect(tool.description).toContain("P82");
      expect(tool.description).toContain("SIGNALS.md");
    });
  });

  describe("validation", () => {
    it("rejects empty target", async () => {
      const text = await execute(makeOpts(), {
        target: "",
        artifact_path: "src/lib/feature.ts",
        context: "Ready for review",
        expectations: "Run tests",
      });
      expect(text).toContain("Handoff aborted");
      expect(text).toContain("target");
    });

    it("rejects whitespace-only target", async () => {
      const text = await execute(makeOpts(), {
        target: "  ",
        artifact_path: "src/lib/feature.ts",
        context: "Ready for review",
        expectations: "Run tests",
      });
      expect(text).toContain("Handoff aborted");
    });

    it("rejects unknown agent when knownAgents is provided", async () => {
      const text = await execute(makeOpts({ knownAgents: ["qa", "bob"] }), {
        target: "nonexistent",
        artifact_path: "src/lib/feature.ts",
        context: "Ready for review",
        expectations: "Run tests",
      });
      expect(text).toContain("Handoff aborted");
      expect(text).toContain("Unknown agent");
      expect(text).toContain("nonexistent");
      expect(text).toContain("qa");
    });

    it("allows any agent when knownAgents is not provided", async () => {
      const text = await execute(makeOpts(), {
        target: "anyone",
        artifact_path: "src/lib/feature.ts",
        context: "Ready for review",
        expectations: "Run tests",
      });
      expect(text).toContain("Handoff complete");
    });

    it("rejects nonexistent artifact", async () => {
      const text = await execute(makeOpts(), {
        target: "qa",
        artifact_path: "src/lib/nonexistent.ts",
        context: "Ready for review",
        expectations: "Run tests",
      });
      expect(text).toContain("Handoff aborted");
      expect(text).toContain("does not exist");
      expect(text).toContain("nonexistent.ts");
    });

    it("rejects empty artifact_path", async () => {
      const text = await execute(makeOpts(), {
        target: "qa",
        artifact_path: "",
        context: "Ready for review",
        expectations: "Run tests",
      });
      expect(text).toContain("Handoff aborted");
      expect(text).toContain("artifact_path");
    });

    it("rejects empty context", async () => {
      const text = await execute(makeOpts(), {
        target: "qa",
        artifact_path: "src/lib/feature.ts",
        context: "",
        expectations: "Run tests",
      });
      expect(text).toContain("Handoff aborted");
      expect(text).toContain("context");
    });

    it("rejects empty expectations", async () => {
      const text = await execute(makeOpts(), {
        target: "qa",
        artifact_path: "src/lib/feature.ts",
        context: "Ready for review",
        expectations: "",
      });
      expect(text).toContain("Handoff aborted");
      expect(text).toContain("expectations");
    });
  });

  describe("SIGNALS.md entry", () => {
    it("writes a structured entry with all required fields", async () => {
      await execute(makeOpts(), {
        target: "qa",
        artifact_path: "src/lib/feature.ts",
        context: "Bug fix ready for review",
        expectations: "Run tests and approve",
      });

      const signals = readFileSync(signalsPath, "utf-8");
      expect(signals).toContain("## Handoff:");
      expect(signals).toContain("- **From**: coder");
      expect(signals).toContain("- **To**: qa");
      expect(signals).toContain("- **Artifact**: `src/lib/feature.ts`");
      expect(signals).toContain("- **Context**: Bug fix ready for review");
      expect(signals).toContain("- **Expectations**: Run tests and approve");
      expect(signals).toContain("- **Status**: PENDING_ACK");
      expect(signals).toContain('- **read_by**: ["qa"]');
    });

    it("auto-populates read_by with target when not provided (P82 compliance)", async () => {
      await execute(makeOpts(), {
        target: "qa",
        artifact_path: "src/lib/feature.ts",
        context: "test",
        expectations: "test",
      });

      const signals = readFileSync(signalsPath, "utf-8");
      // P82: read_by is auto-populated with [target] when omitted
      expect(signals).toMatch(/read_by\*?\*?\s*:\s*\["qa"\]/);
    });

    it("uses explicit read_by when provided", async () => {
      await execute(makeOpts(), {
        target: "qa",
        artifact_path: "src/lib/feature.ts",
        context: "test",
        expectations: "test",
        read_by: ["may", "tech-lead"],
      });

      const signals = readFileSync(signalsPath, "utf-8");
      expect(signals).toContain('- **read_by**: ["may","tech-lead"]');
    });

    it("falls back to [target] when read_by is empty array", async () => {
      await execute(makeOpts(), {
        target: "bob",
        artifact_path: "src/lib/feature.ts",
        context: "test",
        expectations: "test",
        read_by: [],
      });

      const signals = readFileSync(signalsPath, "utf-8");
      expect(signals).toContain('- **read_by**: ["bob"]');
    });

    it("includes --- separator before entry", async () => {
      await execute(makeOpts(), {
        target: "qa",
        artifact_path: "src/lib/feature.ts",
        context: "test",
        expectations: "test",
      });

      const signals = readFileSync(signalsPath, "utf-8");
      expect(signals).toContain("---");
    });

    it("creates SIGNALS.md if it doesn't exist", async () => {
      rmSync(signalsPath);

      await execute(makeOpts(), {
        target: "qa",
        artifact_path: "src/lib/feature.ts",
        context: "test",
        expectations: "test",
      });

      expect(existsSync(signalsPath)).toBe(true);
      const signals = readFileSync(signalsPath, "utf-8");
      expect(signals).toContain("# Signals");
      expect(signals).toContain('- **read_by**: ["qa"]');
    });

    it("preserves existing SIGNALS.md content", async () => {
      writeFileSync(signalsPath, "# Signals\n\n### 🟡 Existing entry\nSome content here.\n", "utf-8");

      await execute(makeOpts(), {
        target: "qa",
        artifact_path: "src/lib/feature.ts",
        context: "test",
        expectations: "test",
      });

      const signals = readFileSync(signalsPath, "utf-8");
      expect(signals).toContain("Existing entry");
      expect(signals).toContain("Some content here");
      expect(signals).toContain("- **From**: coder");
    });

    it("prepends new entries (newest first)", async () => {
      // Write first handoff
      await execute(makeOpts(), {
        target: "qa",
        artifact_path: "src/lib/feature.ts",
        context: "First handoff",
        expectations: "test",
      });

      // Write second handoff
      await execute(makeOpts({ agentName: "optimizer" }), {
        target: "bob",
        artifact_path: "src/lib/feature.ts",
        context: "Second handoff",
        expectations: "test",
      });

      const signals = readFileSync(signalsPath, "utf-8");
      const firstIdx = signals.indexOf("First handoff");
      const secondIdx = signals.indexOf("Second handoff");

      // Second should appear before first (prepended)
      expect(secondIdx).toBeLessThan(firstIdx);
    });

    it("includes timestamp in ISO-ish format", async () => {
      await execute(makeOpts(), {
        target: "qa",
        artifact_path: "src/lib/feature.ts",
        context: "test",
        expectations: "test",
      });

      const signals = readFileSync(signalsPath, "utf-8");
      // Match YYYY-MM-DD HH:MM format
      expect(signals).toMatch(/## Handoff: \d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
    });
  });

  describe("todo notification", () => {
    it("writes todo item to target agent's workspace", async () => {
      await execute(makeOpts(), {
        target: "qa",
        artifact_path: "src/lib/feature.ts",
        context: "Bug fix",
        expectations: "Review",
      });

      const todoPath = join(agentsRoot, "qa", "workspace", "todo.md");
      expect(existsSync(todoPath)).toBe(true);
      const todo = readFileSync(todoPath, "utf-8");
      expect(todo).toContain("[from:coder");
      expect(todo).toContain("pending handoff");
      expect(todo).toContain("src/lib/feature.ts");
      expect(todo).toContain("SIGNALS.md");
    });

    it("appends to existing todo.md", async () => {
      const todoPath = join(agentsRoot, "qa", "workspace", "todo.md");
      writeFileSync(todoPath, "# TODO\n\n- [ ] Existing task\n", "utf-8");

      await execute(makeOpts(), {
        target: "qa",
        artifact_path: "src/lib/feature.ts",
        context: "test",
        expectations: "test",
      });

      const todo = readFileSync(todoPath, "utf-8");
      expect(todo).toContain("Existing task");
      expect(todo).toContain("pending handoff");
    });

    it("creates workspace directory if needed", async () => {
      // Target agent has no workspace yet
      const newAgentRoot = join(agentsRoot, "newagent", "workspace");
      rmSync(newAgentRoot, { recursive: true, force: true });

      await execute(makeOpts(), {
        target: "newagent",
        artifact_path: "src/lib/feature.ts",
        context: "test",
        expectations: "test",
      });

      expect(existsSync(join(newAgentRoot, "todo.md"))).toBe(true);
    });
  });

  describe("heartbeat triggering", () => {
    it("calls triggerHeartbeat callback with target name", async () => {
      let triggeredAgent: string | undefined;
      const text = await execute(
        makeOpts({
          triggerHeartbeat: (name) => {
            triggeredAgent = name;
            return true;
          },
        }),
        {
          target: "qa",
          artifact_path: "src/lib/feature.ts",
          context: "test",
          expectations: "test",
        },
      );

      expect(triggeredAgent).toBe("qa");
      expect(text).toContain("heartbeat triggered");
    });

    it("succeeds even when triggerHeartbeat is not provided", async () => {
      const text = await execute(makeOpts({ triggerHeartbeat: undefined }), {
        target: "qa",
        artifact_path: "src/lib/feature.ts",
        context: "test",
        expectations: "test",
      });

      expect(text).toContain("Handoff complete");
      expect(text).not.toContain("heartbeat");
    });

    it("succeeds even when triggerHeartbeat throws", async () => {
      const text = await execute(
        makeOpts({
          triggerHeartbeat: () => {
            throw new Error("heartbeat failure");
          },
        }),
        {
          target: "qa",
          artifact_path: "src/lib/feature.ts",
          context: "test",
          expectations: "test",
        },
      );

      expect(text).toContain("Handoff complete");
    });
  });

  describe("success response", () => {
    it("confirms handoff with artifact and target", async () => {
      const text = await execute(makeOpts(), {
        target: "qa",
        artifact_path: "src/lib/feature.ts",
        context: "Ready for review",
        expectations: "Run tests",
      });

      expect(text).toContain("Handoff complete");
      expect(text).toContain("src/lib/feature.ts");
      expect(text).toContain("qa");
      expect(text).toContain("SIGNALS.md");
      expect(text).toContain("PENDING_ACK");
    });

    it("mentions todo item when written", async () => {
      const text = await execute(makeOpts(), {
        target: "qa",
        artifact_path: "src/lib/feature.ts",
        context: "test",
        expectations: "test",
      });

      expect(text).toContain("Todo item added");
    });
  });

  describe("P82 compliance (evaluator integration)", () => {
    it("entry contains read_by in content (passes detectProtocolViolations)", async () => {
      // The evaluator's detectProtocolViolations checks that any write to
      // SIGNALS.md includes "read_by:" in the content. The handoff tool
      // uses fs.writeFileSync (not the write tool), so the evaluator won't
      // see this as a tool call. But verify the content contains read_by
      // for auditability.
      await execute(makeOpts(), {
        target: "qa",
        artifact_path: "src/lib/feature.ts",
        context: "test",
        expectations: "test",
      });

      const signals = readFileSync(signalsPath, "utf-8");
      // P82: read_by auto-populated with [target] when not provided
      // The evaluator regex /read_by\s*:/i would match the plain text inside.
      // Verify the field is present in the structured entry.
      expect(signals).toContain("**read_by**:");
      expect(signals).toContain('["qa"]');
    });

    it("entry format is evaluator-parseable", async () => {
      await execute(makeOpts(), {
        target: "qa",
        artifact_path: "src/lib/feature.ts",
        context: "Ready for review",
        expectations: "Run tests and approve",
      });

      const signals = readFileSync(signalsPath, "utf-8");

      // Verify all required fields are present with the expected format
      expect(signals).toMatch(/\*\*From\*\*:\s*\w+/);
      expect(signals).toMatch(/\*\*To\*\*:\s*\w+/);
      expect(signals).toMatch(/\*\*Artifact\*\*:\s*`[^`]+`/);
      expect(signals).toMatch(/\*\*Status\*\*:\s*PENDING_ACK/);
      expect(signals).toMatch(/\*\*read_by\*\*:\s*\["qa"\]/);
    });
  });

  describe("edge cases", () => {
    it("handles artifact path with spaces", async () => {
      const pathWithSpaces = join(testDir, "src", "my feature.ts");
      writeFileSync(pathWithSpaces, "code", "utf-8");

      const text = await execute(makeOpts(), {
        target: "qa",
        artifact_path: "src/my feature.ts",
        context: "test",
        expectations: "test",
      });

      expect(text).toContain("Handoff complete");
    });

    it("handles context with special markdown characters", async () => {
      await execute(makeOpts(), {
        target: "qa",
        artifact_path: "src/lib/feature.ts",
        context: "Fixed **critical** bug with `parser` and [link](url)",
        expectations: "test",
      });

      const signals = readFileSync(signalsPath, "utf-8");
      expect(signals).toContain("Fixed **critical** bug");
    });

    it("handles absolute artifact path", async () => {
      const absPath = join(testDir, "src", "lib", "feature.ts");
      const text = await execute(makeOpts(), {
        target: "qa",
        artifact_path: absPath,
        context: "test",
        expectations: "test",
      });

      expect(text).toContain("Handoff complete");
    });

    it("uses custom signalsPath when provided", async () => {
      const customPath = join(testDir, "custom", "SIGNALS.md");
      mkdirSync(join(testDir, "custom"), { recursive: true });

      await execute(makeOpts({ signalsPath: customPath }), {
        target: "qa",
        artifact_path: "src/lib/feature.ts",
        context: "test",
        expectations: "test",
      });

      expect(existsSync(customPath)).toBe(true);
      const signals = readFileSync(customPath, "utf-8");
      expect(signals).toContain('- **read_by**: ["qa"]');
    });

    it("uses different agentName correctly", async () => {
      await execute(makeOpts({ agentName: "optimizer" }), {
        target: "bob",
        artifact_path: "src/lib/feature.ts",
        context: "Optimization complete",
        expectations: "Review changes",
      });

      const signals = readFileSync(signalsPath, "utf-8");
      expect(signals).toContain("- **From**: optimizer");
    });
  });
});
