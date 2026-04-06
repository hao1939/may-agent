import { describe, it, expect } from "vitest";
import {
  writeFirst,
  readFirst,
  twoPhase,
  stateApproach,
  assessmentGate,
} from "../src/lib/forced-externalization.js";

describe("writeFirst", () => {
  it("builds a basic write-first prompt with defaults", () => {
    const result = writeFirst({ task: "Fix the database bug" });
    expect(result).toContain("ANALYSIS.md");
    expect(result).toContain("Fix the database bug");
    expect(result).toContain("Before making any changes");
    expect(result).toContain("Do NOT modify any code files until");
  });

  it("uses custom analysis file", () => {
    const result = writeFirst({
      task: "Fix the bug",
      analysisFile: "PLAN.md",
    });
    expect(result).toContain("PLAN.md");
    expect(result).not.toContain("ANALYSIS.md");
  });

  it("includes custom analyze prompt", () => {
    const result = writeFirst({
      task: "Fix the bug",
      analyzePrompt: "List all config files and their contents",
    });
    expect(result).toContain("List all config files and their contents");
  });

  it("renders analyze checklist as numbered list", () => {
    const result = writeFirst({
      task: "Fix the bug",
      analyzeChecklist: ["Check error logs", "Review config", "Identify root cause"],
    });
    expect(result).toContain("1. Check error logs");
    expect(result).toContain("2. Review config");
    expect(result).toContain("3. Identify root cause");
    expect(result).toContain("Your analysis must cover:");
  });

  it("omits no-code warning when noCodeInAnalysis is false", () => {
    const result = writeFirst({
      task: "Fix the bug",
      noCodeInAnalysis: false,
    });
    expect(result).not.toContain("Do NOT modify any code files");
  });

  it("includes no-code warning by default", () => {
    const result = writeFirst({ task: "Fix the bug" });
    expect(result).toContain("Do NOT modify any code files until");
  });

  it("uses generic analyze prompt when none specified", () => {
    const result = writeFirst({ task: "Fix the bug" });
    expect(result).toContain("Examine the problem");
  });

  it("places task after the analysis instruction", () => {
    const result = writeFirst({ task: "Fix the database bug" });
    const analysisPos = result.indexOf("Before making any changes");
    const taskPos = result.indexOf("Fix the database bug");
    expect(analysisPos).toBeLessThan(taskPos);
  });
});

describe("readFirst", () => {
  it("builds a basic read-first prompt", () => {
    const result = readFirst({
      task: "Delete safe files from data/",
      readFile: "CLASSIFICATION.md",
    });
    expect(result).toContain("CLASSIFICATION.md");
    expect(result).toContain("Delete safe files from data/");
    expect(result).toContain("First");
  });

  it("uses custom read prompt", () => {
    const result = readFirst({
      task: "Proceed with cleanup",
      readFile: "ANALYSIS.md",
      readPrompt: "Check which files are safe to delete",
    });
    expect(result).toContain("Check which files are safe to delete");
  });

  it("defaults to stop behavior on missing file", () => {
    const result = readFirst({
      task: "Fix the bug",
      readFile: "ANALYSIS.md",
    });
    expect(result).toContain("STOP");
    expect(result).toContain("blocked");
  });

  it("supports proceed behavior on missing file", () => {
    const result = readFirst({
      task: "Fix the bug",
      readFile: "ANALYSIS.md",
      onMissing: "proceed",
    });
    expect(result).toContain("proceed with your own judgment");
    expect(result).not.toContain("STOP");
  });

  it("supports create behavior on missing file", () => {
    const result = readFirst({
      task: "Fix the bug",
      readFile: "ANALYSIS.md",
      onMissing: "create",
    });
    expect(result).toContain("create it first");
  });

  it("places task after the read instruction", () => {
    const result = readFirst({
      task: "Fix the database bug",
      readFile: "ANALYSIS.md",
    });
    const readPos = result.indexOf("First");
    const taskPos = result.indexOf("Fix the database bug");
    expect(readPos).toBeLessThan(taskPos);
  });
});

describe("twoPhase", () => {
  it("builds a two-phase prompt", () => {
    const result = twoPhase({
      task: "Optimize the data pipeline",
      phase1: "List all hard constraints",
      phase2: "Implement the best approach",
    });
    expect(result).toContain("Phase 1: ANALYZE");
    expect(result).toContain("Phase 2: IMPLEMENT");
    expect(result).toContain("List all hard constraints");
    expect(result).toContain("Implement the best approach");
    expect(result).toContain("Optimize the data pipeline");
    expect(result).toContain("ANALYSIS.md");
  });

  it("uses custom analysis file", () => {
    const result = twoPhase({
      task: "Fix it",
      analysisFile: "PLAN.md",
      phase1: "Analyze",
      phase2: "Implement",
    });
    expect(result).toContain("PLAN.md");
    expect(result).not.toContain("ANALYSIS.md");
  });

  it("includes phase1 checklist", () => {
    const result = twoPhase({
      task: "Fix it",
      phase1: "Analyze the codebase",
      phase2: "Make the changes",
      phase1Checklist: ["Identify all affected files", "Map dependencies"],
    });
    expect(result).toContain("1. Identify all affected files");
    expect(result).toContain("2. Map dependencies");
    expect(result).toContain("Your analysis must include:");
  });

  it("separates phases with a divider", () => {
    const result = twoPhase({
      task: "Fix it",
      phase1: "Analyze",
      phase2: "Implement",
    });
    expect(result).toContain("---");
  });

  it("includes no-action warning in phase 1", () => {
    const result = twoPhase({
      task: "Fix it",
      phase1: "Analyze",
      phase2: "Implement",
    });
    expect(result).toContain("Do NOT modify any code or take any action in this phase");
  });

  it("includes back-to-phase-1 instruction in phase 2", () => {
    const result = twoPhase({
      task: "Fix it",
      phase1: "Analyze",
      phase2: "Implement",
    });
    expect(result).toContain("go back to Phase 1");
  });

  it("places original task at the end", () => {
    const result = twoPhase({
      task: "Optimize the data pipeline",
      phase1: "Analyze",
      phase2: "Implement",
    });
    expect(result).toContain("Original task: Optimize the data pipeline");
  });
});

describe("stateApproach", () => {
  it("builds a minimal externalization prompt with defaults", () => {
    const result = stateApproach("Fix the timeout issue");
    expect(result).toContain("Before taking any action");
    expect(result).toContain("What specific change you will make");
    expect(result).toContain("What file(s) you will modify");
    expect(result).toContain("Fix the timeout issue");
  });

  it("uses custom questions", () => {
    const result = stateApproach("Fix the bug", [
      "What is the root cause",
      "Which tests verify the fix",
    ]);
    expect(result).toContain("What is the root cause");
    expect(result).toContain("Which tests verify the fix");
    expect(result).not.toContain("What specific change you will make");
  });

  it("places task after the state-approach block", () => {
    const result = stateApproach("Fix the timeout issue");
    const statePos = result.indexOf("Before taking any action");
    const taskPos = result.indexOf("Fix the timeout issue");
    expect(statePos).toBeLessThan(taskPos);
  });

  it("formats questions as bullet points", () => {
    const result = stateApproach("Fix it", ["A", "B"]);
    expect(result).toContain("- A");
    expect(result).toContain("- B");
  });
});

describe("assessmentGate", () => {
  it("builds a basic assessment gate prompt with defaults", () => {
    const result = assessmentGate({ task: "Delete all user data" });
    expect(result).toContain("Phase 1: ASSESS");
    expect(result).toContain("Phase 2: ACT or ESCALATE");
    expect(result).toContain("assessment.md");
    expect(result).toContain("Delete all user data");
    expect(result).toContain("Is this task within my capability scope");
  });

  it("uses custom assessment file", () => {
    const result = assessmentGate({
      task: "Fix it",
      assessmentFile: "FEASIBILITY.md",
    });
    expect(result).toContain("FEASIBILITY.md");
    expect(result).not.toContain("assessment.md");
  });

  it("includes custom feasibility questions", () => {
    const result = assessmentGate({
      task: "Fix it",
      feasibilityQuestions: [
        "Can we access the database?",
        "Are backups available?",
      ],
    });
    expect(result).toContain("1. Can we access the database?");
    expect(result).toContain("2. Are backups available?");
    expect(result).not.toContain("Is this task within my capability scope");
  });

  it("includes escalation keywords when provided", () => {
    const result = assessmentGate({
      task: "Fix it",
      escalationKeywords: ["IMPOSSIBLE", "RISKY"],
    });
    expect(result).toContain('"IMPOSSIBLE"');
    expect(result).toContain('"RISKY"');
    expect(result).toContain("blocked");
  });

  it("uses default ESCALATE instruction when no keywords", () => {
    const result = assessmentGate({ task: "Fix it" });
    expect(result).toContain("recommends ESCALATE");
  });

  it("includes no-modify warning in phase 1", () => {
    const result = assessmentGate({ task: "Fix it" });
    expect(result).toContain("Do NOT modify any other files");
  });

  it("includes proceed instruction for happy path", () => {
    const result = assessmentGate({ task: "Fix the deployment" });
    expect(result).toContain("recommends PROCEED");
    expect(result).toContain("Fix the deployment");
  });
});

describe("integration: composability", () => {
  it("stateApproach output is a valid string for further wrapping", () => {
    const inner = stateApproach("Fix the bug");
    const outer = writeFirst({ task: inner, analysisFile: "OUTER.md" });
    expect(outer).toContain("OUTER.md");
    expect(outer).toContain("Before taking any action");
    expect(outer).toContain("Fix the bug");
  });

  it("readFirst can reference a twoPhase analysis file", () => {
    const phase = twoPhase({
      task: "Optimize",
      analysisFile: "DEEP_ANALYSIS.md",
      phase1: "Investigate",
      phase2: "Implement",
    });
    // The twoPhase output references DEEP_ANALYSIS.md
    expect(phase).toContain("DEEP_ANALYSIS.md");

    // A subsequent readFirst could reference the same file
    const followUp = readFirst({
      task: "Verify the optimization",
      readFile: "DEEP_ANALYSIS.md",
    });
    expect(followUp).toContain("DEEP_ANALYSIS.md");
  });
});
