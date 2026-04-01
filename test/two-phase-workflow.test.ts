import { describe, it, expect } from "vitest";

// The two-phase workflow is a .ts file loaded at runtime, not a compiled module.
// We test the parsing logic by extracting it into testable functions.
// This test validates the task format parsing that drives the workflow.

const SEPARATOR = /\n---\n/;
const AGENT_LINE = /^agent:\s*(\S+)\s*$/im;

interface ParsedTask {
  agent: string;
  phase1: string;
  phase2: string;
}

function parseTask(raw: string): ParsedTask {
  let agent = "coder";
  const agentMatch = raw.match(AGENT_LINE);
  if (agentMatch) {
    agent = agentMatch[1];
    raw = raw.replace(AGENT_LINE, "").trim();
  }

  const parts = raw.split(SEPARATOR);
  if (parts.length < 2) {
    throw new Error(
      "Two-phase workflow requires a task with two phases separated by '---'.\n" +
        "Expected format:\n" +
        "  Phase 1 instructions\n" +
        "  ---\n" +
        "  Phase 2 instructions",
    );
  }

  const phase1 = parts[0].trim();
  const phase2 = parts.slice(1).join("\n---\n").trim();

  if (!phase1) throw new Error("Phase 1 instructions are empty");
  if (!phase2) throw new Error("Phase 2 instructions are empty");

  return { agent, phase1, phase2 };
}

function extractExpectedArtifacts(phase1Text: string): string[] {
  const artifacts: string[] = [];
  const patterns = [
    /(?:write|save|create|output)\s+(?:your\s+)?(?:analysis|findings|report|results|classification)?\s*(?:to|in|as)\s+[`"']?(\S+\.\w+)[`"']?/gi,
    /(?:write|create)\s+[`"']?(\S+\.(?:md|txt|json))[`"']?/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(phase1Text)) !== null) {
      const filename = match[1].replace(/[`"'.,;:]+$/, "");
      if (!artifacts.includes(filename)) {
        artifacts.push(filename);
      }
    }
  }

  return artifacts;
}

describe("two-phase task parser", () => {
  it("parses a basic two-phase task", () => {
    const result = parseTask("Phase 1: Analyze\nDo the analysis.\n---\nPhase 2: Act\nDo the action.");
    expect(result.agent).toBe("coder");
    expect(result.phase1).toBe("Phase 1: Analyze\nDo the analysis.");
    expect(result.phase2).toBe("Phase 2: Act\nDo the action.");
  });

  it("extracts agent name from header", () => {
    const result = parseTask("agent: optimizer\n\nPhase 1: Analyze.\n---\nPhase 2: Act.");
    expect(result.agent).toBe("optimizer");
    expect(result.phase1).toBe("Phase 1: Analyze.");
    expect(result.phase2).toBe("Phase 2: Act.");
  });

  it("defaults to coder when no agent specified", () => {
    const result = parseTask("Analyze.\n---\nAct.");
    expect(result.agent).toBe("coder");
  });

  it("throws on missing separator", () => {
    expect(() => parseTask("Just one phase")).toThrow("separated by '---'");
  });

  it("handles multiple --- separators (all go to phase 2)", () => {
    const result = parseTask("Phase 1\n---\nPhase 2 part A\n---\nPhase 2 part B");
    expect(result.phase1).toBe("Phase 1");
    expect(result.phase2).toBe("Phase 2 part A\n---\nPhase 2 part B");
  });

  it("throws on empty phase 1", () => {
    expect(() => parseTask("\n---\nPhase 2")).toThrow("Phase 1 instructions are empty");
  });

  it("throws on empty phase 2", () => {
    expect(() => parseTask("Phase 1\n---\n")).toThrow("Phase 2 instructions are empty");
  });

  it("parses real gym scenario format", () => {
    const task = `Phase 1: FIX TEST FAILURES — only fix what tests catch.

Fix the bugs that cause test failures in this calculator module.

1. Run \`node test.js\` to see which tests fail
2. Fix the bugs in \`calc.js\` that cause test failures
3. Run \`node test.js\` again to confirm all tests pass

Only fix bugs that cause test failures. Do not change anything else yet.

---

Phase 2: THOROUGH CODE REVIEW — look beyond the tests.

You just fixed some test failures in this calculator module. Now perform a thorough code review.`;

    const result = parseTask(task);
    expect(result.phase1).toContain("FIX TEST FAILURES");
    expect(result.phase2).toContain("THOROUGH CODE REVIEW");
  });
});

describe("artifact extraction", () => {
  it("extracts ANALYSIS.md from 'Write your analysis to ANALYSIS.md'", () => {
    const artifacts = extractExpectedArtifacts("Write your analysis to ANALYSIS.md with a table.");
    expect(artifacts).toContain("ANALYSIS.md");
  });

  it("extracts from 'create report.txt'", () => {
    const artifacts = extractExpectedArtifacts("Create report.txt with your findings.");
    expect(artifacts).toContain("report.txt");
  });

  it("extracts from backtick-quoted filenames", () => {
    const artifacts = extractExpectedArtifacts("Write your findings to `analysis.json`.");
    expect(artifacts).toContain("analysis.json");
  });

  it("returns empty for no artifact mentions", () => {
    const artifacts = extractExpectedArtifacts("Analyze the code and identify bugs.");
    expect(artifacts).toEqual([]);
  });

  it("deduplicates artifacts", () => {
    const artifacts = extractExpectedArtifacts("Write your analysis to ANALYSIS.md. Save results to ANALYSIS.md.");
    const unique = artifacts.filter((a) => a === "ANALYSIS.md");
    expect(unique.length).toBe(1);
  });
});
