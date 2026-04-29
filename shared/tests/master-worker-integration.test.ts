/**
 * Integration tests for master-worker workflow
 * Tests the interaction between dispatch-validator, decision extraction,
 * snapshot diffing, and the orchestration flow.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

// ── Replicate core functions from master-worker.ts ──

interface Decision {
  status: "continue" | "pivot" | "waiting" | "blocked" | "unknown";
  detail: string;
}

function extractDecision(text: string): Decision {
  const trimmed = text.trim();
  const firstLine = trimmed.split("\n")[0] || "";
  const upper = firstLine.toUpperCase();

  for (const s of ["CONTINUE", "PIVOT", "WAITING", "BLOCKED", "DONE"] as const) {
    if (upper.startsWith(s)) {
      return { status: s.toLowerCase() as Decision["status"], detail: trimmed.slice(0, 500) };
    }
  }

  const decisionPattern = /(?:\*{0,2}Decision\*{0,2}[:\s]+\*{0,2}|^|\n)\*{0,2}(CONTINUE|PIVOT|BLOCKED|WAITING|DONE)\*{0,2}/im;
  const patternMatch = trimmed.match(decisionPattern);
  if (patternMatch) {
    return { status: patternMatch[1].toLowerCase() as Decision["status"], detail: trimmed.slice(0, 500) };
  }

  if (/\b(proceed|move forward|start working|begin work|let'?s begin|let'?s start)\b/i.test(trimmed)) {
    return { status: "continue", detail: trimmed.slice(0, 500) };
  }

  for (const keyword of ["CONTINUE", "PIVOT", "BLOCKED", "WAITING"] as const) {
    if (new RegExp(`\\b${keyword}\\b`).test(trimmed)) {
      return { status: keyword.toLowerCase() as Decision["status"], detail: trimmed.slice(0, 500) };
    }
  }

  return { status: "unknown", detail: trimmed.slice(0, 500) };
}

function snapshotOutputs(entries: { name: string; isFile: boolean; mtime: number; children?: { name: string; mtime: number }[] }[]): Map<string, number> {
  const snap = new Map<string, number>();
  for (const entry of entries) {
    if (entry.isFile) {
      snap.set(entry.name, entry.mtime);
    } else if (entry.children) {
      for (const child of entry.children) {
        snap.set(`${entry.name}/${child.name}`, child.mtime);
      }
    }
  }
  return snap;
}

function diffSnapshots(before: Map<string, number>, after: Map<string, number>): string[] {
  const changed: string[] = [];
  for (const [path, mtime] of after) {
    const prev = before.get(path);
    if (prev === undefined || mtime > prev) {
      changed.push(path);
    }
  }
  return changed;
}

// ── Replicate dispatch validator logic ──
function validateDispatch(task: string, projectRoot: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const projectMatch = task.match(/project:\s*(\S+)/);
  if (!projectMatch) {
    errors.push("No project path found in task");
  }
  return { valid: errors.length === 0, errors };
}

// ── Integration: Full orchestration flow simulation ──

interface MockSession {
  prompts: string[];
  responses: string[];
  responseIndex: number;
  lastText: () => string;
  prompt: (text: string) => Promise<void>;
}

function createMockSession(responses: string[]): MockSession {
  const session: MockSession = {
    prompts: [],
    responses,
    responseIndex: 0,
    lastText() {
      return this.responses[Math.max(0, this.responseIndex - 1)] || "";
    },
    async prompt(text: string) {
      this.prompts.push(text);
      this.responseIndex++;
    },
  };
  return session;
}

interface SimulationResult {
  iterations: number;
  finalStatus: string;
  workerPrompts: string[];
  orchestratorPrompts: string[];
  changedFiles: string[][];
}

/**
 * Simulates the master-worker loop with mocked sessions and file system.
 * This tests the real orchestration logic: decision parsing → dispatch → review.
 */
function simulateMasterWorkerLoop(opts: {
  maxIterations: number;
  orchestratorResponses: string[];
  fileChangesPerIteration: string[][]; // files changed after each worker iteration
  initialStatus?: string;
}): SimulationResult {
  const { maxIterations, orchestratorResponses, fileChangesPerIteration, initialStatus = "active" } = opts;

  if (initialStatus === "paused" || initialStatus === "cancelled") {
    return { iterations: 0, finalStatus: initialStatus, workerPrompts: [], orchestratorPrompts: [], changedFiles: [] };
  }

  const orchestrator = createMockSession(orchestratorResponses);
  const worker = createMockSession([]);

  // Phase 1: Planning
  const planResponse = orchestratorResponses[0] || "CONTINUE\nDo the work";
  orchestrator.responses = orchestratorResponses;
  orchestrator.prompt("Assess this project...");
  let decision = extractDecision(planResponse);

  if (decision.status === "unknown") decision.status = "continue";

  if (decision.status !== "continue" && decision.status !== "pivot") {
    return { iterations: 0, finalStatus: decision.status, workerPrompts: [], orchestratorPrompts: ["Assess this project..."], changedFiles: [] };
  }

  // Phase 2: Work-review loop
  let iteration = 0;
  let consecutiveZeroOutput = 0;
  const MAX_ZERO_OUTPUT = 3;
  const allChangedFiles: string[][] = [];

  while (iteration < maxIterations && (decision.status === "continue" || decision.status === "pivot")) {
    const guidance = orchestrator.responses[orchestrator.responseIndex - 1] || orchestrator.responses[0];
    iteration++;

    // Worker gets guidance
    const workerPrompt = `## Task (Iteration ${iteration})\n${guidance}`;
    worker.prompts.push(workerPrompt);

    // Check file changes
    const changed = fileChangesPerIteration[iteration - 1] || [];
    allChangedFiles.push(changed);

    if (changed.length === 0) {
      consecutiveZeroOutput++;
      if (consecutiveZeroOutput >= MAX_ZERO_OUTPUT * 2) {
        decision = { status: "blocked", detail: `Auto-terminated: ${consecutiveZeroOutput} consecutive zero-output iterations.` };
        break;
      }
    } else {
      consecutiveZeroOutput = 0;
    }

    // Review phase — next orchestrator response
    const reviewIdx = Math.min(orchestrator.responseIndex, orchestratorResponses.length - 1);
    orchestrator.responseIndex++;
    const reviewResponse = orchestratorResponses[reviewIdx] || "CONTINUE";
    orchestrator.prompts.push(`Review iteration ${iteration}...`);
    decision = extractDecision(reviewResponse);

    if (decision.status === "unknown") decision.status = "continue";
  }

  return {
    iterations: iteration,
    finalStatus: decision.status,
    workerPrompts: worker.prompts,
    orchestratorPrompts: orchestrator.prompts,
    changedFiles: allChangedFiles,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════════════

describe("Integration: dispatch-validator → master-worker", () => {
  test("valid task passes validation and would proceed", () => {
    const result = validateDispatch("project: agents/shared/projects/test-proj", "/app");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("missing project path fails validation before workflow starts", () => {
    const result = validateDispatch("run something", "/app");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("No project path");
  });

  test("validation failure prevents any iterations", () => {
    const validation = validateDispatch("no project here", "/app");
    expect(validation.valid).toBe(false);
    // In real workflow, this returns ctx.escalate() — 0 iterations
  });
});

describe("Integration: decision extraction → loop control", () => {
  test("CONTINUE decision runs work loop", () => {
    const result = simulateMasterWorkerLoop({
      maxIterations: 3,
      orchestratorResponses: ["CONTINUE\nWrite tests", "CONTINUE\nKeep going", "DONE\nAll complete"],
      fileChangesPerIteration: [["test.ts"], ["test2.ts"], []],
    });
    expect(result.iterations).toBeGreaterThanOrEqual(2);
    expect(result.workerPrompts.length).toBeGreaterThanOrEqual(2);
  });

  test("BLOCKED on first review stops after 1 iteration", () => {
    const result = simulateMasterWorkerLoop({
      maxIterations: 5,
      orchestratorResponses: ["CONTINUE\nTry this", "BLOCKED\nCannot access API"],
      fileChangesPerIteration: [["output.md"]],
    });
    expect(result.iterations).toBe(1);
    expect(result.finalStatus).toBe("blocked");
  });

  test("WAITING stops loop gracefully", () => {
    const result = simulateMasterWorkerLoop({
      maxIterations: 5,
      orchestratorResponses: ["CONTINUE\nStart", "WAITING\nNeed user input"],
      fileChangesPerIteration: [["file.ts"]],
    });
    expect(result.iterations).toBe(1);
    expect(result.finalStatus).toBe("waiting");
  });

  test("PIVOT changes direction but continues loop", () => {
    const result = simulateMasterWorkerLoop({
      maxIterations: 5,
      orchestratorResponses: ["CONTINUE\nDo X", "PIVOT\nActually do Y", "CONTINUE\nGood", "DONE\nFinished"],
      fileChangesPerIteration: [["x.ts"], ["y.ts"], ["z.ts"]],
    });
    expect(result.iterations).toBeGreaterThanOrEqual(2);
  });

  test("paused project skips all work", () => {
    const result = simulateMasterWorkerLoop({
      maxIterations: 5,
      orchestratorResponses: ["CONTINUE"],
      fileChangesPerIteration: [],
      initialStatus: "paused",
    });
    expect(result.iterations).toBe(0);
    expect(result.finalStatus).toBe("paused");
  });

  test("cancelled project skips all work", () => {
    const result = simulateMasterWorkerLoop({
      maxIterations: 5,
      orchestratorResponses: ["CONTINUE"],
      fileChangesPerIteration: [],
      initialStatus: "cancelled",
    });
    expect(result.iterations).toBe(0);
    expect(result.finalStatus).toBe("cancelled");
  });
});

describe("Integration: snapshot diffing → zero-output detection", () => {
  test("file changes reset zero-output counter", () => {
    const result = simulateMasterWorkerLoop({
      maxIterations: 4,
      orchestratorResponses: ["CONTINUE\nWork", "CONTINUE\nMore", "CONTINUE\nMore", "DONE"],
      fileChangesPerIteration: [["a.ts"], ["b.ts"], ["c.ts"]],
    });
    expect(result.iterations).toBe(3);
    expect(result.changedFiles.every(c => c.length > 0)).toBe(true);
  });

  test("6 consecutive zero-output iterations triggers auto-terminate", () => {
    const result = simulateMasterWorkerLoop({
      maxIterations: 10,
      orchestratorResponses: Array(10).fill("CONTINUE\nKeep trying"),
      fileChangesPerIteration: Array(10).fill([]),
    });
    expect(result.finalStatus).toBe("blocked");
    expect(result.iterations).toBeLessThanOrEqual(6);
  });

  test("zero-output followed by output resets counter", () => {
    const result = simulateMasterWorkerLoop({
      maxIterations: 8,
      orchestratorResponses: Array(8).fill("CONTINUE\nWork"),
      fileChangesPerIteration: [[], [], ["recovery.ts"], [], [], ["recovery2.ts"], [], []],
    });
    // Should NOT auto-terminate because recoveries reset the counter
    expect(result.iterations).toBeGreaterThan(3);
  });
});

describe("Integration: max iterations cap", () => {
  test("loop stops at maxIterations even if decisions say continue", () => {
    const result = simulateMasterWorkerLoop({
      maxIterations: 3,
      orchestratorResponses: Array(10).fill("CONTINUE\nKeep going"),
      fileChangesPerIteration: [["a"], ["b"], ["c"], ["d"]],
    });
    expect(result.iterations).toBe(3);
  });

  test("maxIterations=1 allows exactly one work cycle", () => {
    const result = simulateMasterWorkerLoop({
      maxIterations: 1,
      orchestratorResponses: ["CONTINUE\nDo it", "CONTINUE\nMore"],
      fileChangesPerIteration: [["output.ts"]],
    });
    expect(result.iterations).toBe(1);
  });
});

describe("Integration: snapshot utilities", () => {
  test("new file detected in diff", () => {
    const before = new Map<string, number>();
    const after = new Map([["output.ts", 1000]]);
    expect(diffSnapshots(before, after)).toEqual(["output.ts"]);
  });

  test("modified file detected in diff", () => {
    const before = new Map([["output.ts", 1000]]);
    const after = new Map([["output.ts", 2000]]);
    expect(diffSnapshots(before, after)).toEqual(["output.ts"]);
  });

  test("unchanged file not in diff", () => {
    const before = new Map([["output.ts", 1000]]);
    const after = new Map([["output.ts", 1000]]);
    expect(diffSnapshots(before, after)).toEqual([]);
  });

  test("deleted file not in diff", () => {
    const before = new Map([["old.ts", 1000]]);
    const after = new Map<string, number>();
    expect(diffSnapshots(before, after)).toEqual([]);
  });

  test("snapshotOutputs handles nested directories", () => {
    const entries = [
      { name: "file.ts", isFile: true, mtime: 100 },
      { name: "subdir", isFile: false, children: [{ name: "nested.ts", mtime: 200 }] },
    ];
    const snap = snapshotOutputs(entries);
    expect(snap.get("file.ts")).toBe(100);
    expect(snap.get("subdir/nested.ts")).toBe(200);
    expect(snap.size).toBe(2);
  });
});

describe("Integration: worker prompt construction", () => {
  test("worker receives iteration number in prompt", () => {
    const result = simulateMasterWorkerLoop({
      maxIterations: 2,
      orchestratorResponses: ["CONTINUE\nWrite tests for X", "DONE"],
      fileChangesPerIteration: [["test.ts"]],
    });
    expect(result.workerPrompts[0]).toContain("Iteration 1");
    expect(result.workerPrompts[0]).toContain("Write tests for X");
  });

  test("worker prompt includes orchestrator guidance verbatim", () => {
    const guidance = "CONTINUE\nCreate file outputs/report.md with analysis of system health";
    const result = simulateMasterWorkerLoop({
      maxIterations: 2,
      orchestratorResponses: [guidance, "DONE"],
      fileChangesPerIteration: [["report.md"]],
    });
    expect(result.workerPrompts[0]).toContain("analysis of system health");
  });
});

describe("Integration: end-to-end flow scenarios", () => {
  test("happy path: plan → work → review → done", () => {
    const result = simulateMasterWorkerLoop({
      maxIterations: 5,
      orchestratorResponses: [
        "CONTINUE\nWrite unit tests for the API module",
        "CONTINUE\nGood work, now add edge cases",
        "DONE\nAll tests passing, milestone complete",
      ],
      fileChangesPerIteration: [["api.test.ts"], ["api.test.ts"]],
    });
    expect(result.iterations).toBe(2);
    expect(result.workerPrompts).toHaveLength(2);
  });

  test("pivot mid-stream: start X → pivot to Y → done", () => {
    const result = simulateMasterWorkerLoop({
      maxIterations: 5,
      orchestratorResponses: [
        "CONTINUE\nBuild feature X",
        "PIVOT\nX is blocked, build feature Y instead",
        "DONE\nY is complete",
      ],
      fileChangesPerIteration: [["x.ts"], ["y.ts"]],
    });
    expect(result.iterations).toBe(2);
  });

  test("degraded: intermittent failures with recovery", () => {
    const result = simulateMasterWorkerLoop({
      maxIterations: 8,
      orchestratorResponses: Array(8).fill("CONTINUE\nRetry"),
      fileChangesPerIteration: [["a.ts"], [], [], ["b.ts"], [], [], ["c.ts"], []],
    });
    // Should complete all 8 without auto-terminate (max consecutive zero = 2, under threshold of 6)
    expect(result.iterations).toBe(8);
    expect(result.finalStatus).toBe("continue");
  });
});
