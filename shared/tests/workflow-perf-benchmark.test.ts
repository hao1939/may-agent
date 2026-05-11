/**
 * Performance benchmark tests for workflow functions.
 * 
 * Baseline timings (recorded on first run):
 *   - parseInput: ~1-5ms
 *   - project field extraction: ~0.5-2ms
 *   - circuit breaker state transitions: ~0.1-1ms
 *   - dispatch validation: ~0.5-2ms
 *   - output validation: ~0.5-2ms
 *   - budget checkpoint logic: ~0.1-1ms
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkCircuitBreaker,
  recordOutcome,
  resetCircuitBreaker,
} from "../workflows/circuit-breaker.js";
import {
  extractField,
  extractSection,
} from "../workflows/project-helpers.js";
import { validateDispatch, parseProjectDir } from "../workflows/dispatch-validator.js";
import { validateOutput } from "../workflows/output-validator.js";
import {
  shouldBudgetCheckpoint,
  estimateTurnsUsed,
} from "../workflows/budget-checkpoint.js";

const TMP = join(__dirname, "__perf_tmp__");

beforeEach(() => {
  mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

function measure(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

describe("Performance: extractField", () => {
  const projectMd = `# My Project
**Status**: active
**Owner**: orchestrator
**Worker**: code-writer
**Workflow**: project
**Max Iterations**: 10
**Goal**: Build a system that does X, Y, Z with high performance and reliability.

## Plan
- Step 1: Do something
- Step 2: Do something else
- Step 3: Final step

## Context
This is a long context section with many details about the project.
${"Lorem ipsum dolor sit amet. ".repeat(100)}
`;

  it("extracts Status field < 5ms", () => {
    const elapsed = measure(() => {
      for (let i = 0; i < 100; i++) extractField(projectMd, "Status");
    });
    expect(elapsed / 100).toBeLessThan(5);
  });

  it("extracts Owner field < 5ms", () => {
    const elapsed = measure(() => {
      for (let i = 0; i < 100; i++) extractField(projectMd, "Owner");
    });
    expect(elapsed / 100).toBeLessThan(5);
  });

  it("extracts section < 10ms", () => {
    const elapsed = measure(() => {
      for (let i = 0; i < 100; i++) extractSection(projectMd, "Plan");
    });
    expect(elapsed / 100).toBeLessThan(10);
  });

  it("handles large document < 10ms", () => {
    const largeMd = projectMd + "\n" + "More content.\n".repeat(1000);
    const elapsed = measure(() => {
      for (let i = 0; i < 50; i++) extractField(largeMd, "Status");
    });
    expect(elapsed / 50).toBeLessThan(10);
  });
});

describe("Performance: circuit breaker", () => {
  beforeEach(() => {
    // Create agent dirs needed for SIGNAL files and state
    mkdirSync(join(TMP, "shared"), { recursive: true });
    mkdirSync(join(TMP, "test-agent"), { recursive: true });
    mkdirSync(join(TMP, "perf-agent"), { recursive: true });
    mkdirSync(join(TMP, "trip-agent"), { recursive: true });
    mkdirSync(join(TMP, "cycle-agent"), { recursive: true });
    for (let i = 0; i < 50; i++) mkdirSync(join(TMP, `agent-${i}`), { recursive: true });
  });

  it("checkCircuitBreaker < 5ms (no state file)", () => {
    const elapsed = measure(() => {
      for (let i = 0; i < 100; i++) checkCircuitBreaker(TMP, "test-agent");
    });
    expect(elapsed / 100).toBeLessThan(5);
  });

  it("recordOutcome success < 5ms", () => {
    const elapsed = measure(() => {
      for (let i = 0; i < 50; i++) recordOutcome(TMP, "perf-agent", false);
    });
    expect(elapsed / 50).toBeLessThan(5);
  });

  it("recordOutcome error < 5ms", () => {
    const elapsed = measure(() => {
      for (let i = 0; i < 50; i++) recordOutcome(TMP, `agent-${i}`, true);
    });
    expect(elapsed / 50).toBeLessThan(5);
  });

  it("resetCircuitBreaker < 5ms", () => {
    recordOutcome(TMP, "trip-agent", true);
    recordOutcome(TMP, "trip-agent", true);
    recordOutcome(TMP, "trip-agent", true);
    const elapsed = measure(() => {
      resetCircuitBreaker(TMP, "trip-agent");
    });
    expect(elapsed).toBeLessThan(5);
  });

  it("full open/close cycle < 20ms", () => {
    const elapsed = measure(() => {
      recordOutcome(TMP, "cycle-agent", true);
      recordOutcome(TMP, "cycle-agent", true);
      recordOutcome(TMP, "cycle-agent", true);
      checkCircuitBreaker(TMP, "cycle-agent");
      resetCircuitBreaker(TMP, "cycle-agent");
      checkCircuitBreaker(TMP, "cycle-agent");
    });
    expect(elapsed).toBeLessThan(20);
  });
});

describe("Performance: dispatch validation", () => {
  it("validates valid dispatch < 5ms", () => {
    const elapsed = measure(() => {
      for (let i = 0; i < 100; i++) {
        validateDispatch("project: agents/shared/projects/test", TMP);
      }
    });
    expect(elapsed / 100).toBeLessThan(5);
  });

  it("validates missing task < 5ms", () => {
    const elapsed = measure(() => {
      for (let i = 0; i < 100; i++) {
        validateDispatch(undefined, TMP);
      }
    });
    expect(elapsed / 100).toBeLessThan(5);
  });

  it("parseProjectDir < 2ms", () => {
    const elapsed = measure(() => {
      for (let i = 0; i < 1000; i++) {
        parseProjectDir("project: agents/shared/projects/test");
      }
    });
    expect(elapsed / 1000).toBeLessThan(2);
  });
});

describe("Performance: output validation", () => {
  it("validates good output < 5ms", () => {
    const output = "# Summary\nCompleted the task successfully with all tests passing.\n## Deliverables\n- src/main.ts\n";
    const elapsed = measure(() => {
      for (let i = 0; i < 100; i++) validateOutput("report.md", output);
    });
    expect(elapsed / 100).toBeLessThan(5);
  });

  it("validates large output < 10ms", () => {
    const output = "# Report\n" + "Some content line.\n".repeat(500);
    const elapsed = measure(() => {
      for (let i = 0; i < 50; i++) validateOutput("big-report.md", output);
    });
    expect(elapsed / 50).toBeLessThan(10);
  });
});

describe("Performance: budget checkpoint", () => {
  it("shouldBudgetCheckpoint < 2ms", () => {
    const elapsed = measure(() => {
      for (let i = 0; i < 1000; i++) {
        shouldBudgetCheckpoint("proj-" + (i % 10), i, 5);
      }
    });
    expect(elapsed / 1000).toBeLessThan(2);
  });

  it("estimateTurnsUsed < 2ms", () => {
    const elapsed = measure(() => {
      for (let i = 0; i < 1000; i++) estimateTurnsUsed(i, i % 2 === 0);
    });
    expect(elapsed / 1000).toBeLessThan(2);
  });
});
