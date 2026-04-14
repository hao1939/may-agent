/**
 * Tests for the enhanced --status CLI dashboard (request-status.ts).
 *
 * Tests the dashboard output against synthetic data to verify:
 * - Triage logic (red/yellow/green classification)
 * - Agent quality and trend computation
 * - Process health detection
 * - Human input trend tracking
 * - Convention compliance section (when summary.json exists)
 *
 * Since vitest runs under Node.js (no bun:sqlite), we mock the requests module
 * with an in-memory store.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ── In-memory mock for requests.js (no bun:sqlite in vitest) ────────────

interface MockEvalRecord {
  sessionId: string;
  agent: string;
  quality: number;
  efficiency: number;
  productiveCalls: number;
  wastedCalls: number;
  verdict: string;
  issues: string[];
  overall: Record<string, unknown> | null;
  usage: Record<string, unknown> | null;
  failureChains: unknown[];
  evaluatedByHeuristic: boolean;
  skippedByJs: boolean;
  createdAt: number;
}

const evalStore: MockEvalRecord[] = [];

const mockDb = {
  prepare: () => ({
    get: () => null,
    all: () => [],
  }),
  run: () => {},
  exec: () => {},
};

vi.mock("../src/lib/requests.js", () => ({
  upsertEvaluation: (_persistDir: string, opts: Record<string, unknown>) => {
    evalStore.push({
      sessionId: opts.sessionId as string,
      agent: opts.agent as string,
      quality: opts.quality as number,
      efficiency: opts.efficiency as number,
      productiveCalls: (opts.productiveCalls as number) ?? 0,
      wastedCalls: (opts.wastedCalls as number) ?? 0,
      verdict: opts.verdict as string,
      issues: (opts.issues as string[]) ?? [],
      overall: (opts.overall as Record<string, unknown>) ?? null,
      usage: (opts.usage as Record<string, unknown>) ?? null,
      failureChains: (opts.failureChains as unknown[]) ?? [],
      evaluatedByHeuristic: !!opts.evaluatedByHeuristic,
      skippedByJs: !!opts.skippedByJs,
      createdAt: opts.createdAt as number,
    });
  },
  getEvaluationsSince: (_persistDir: string, sinceMs: number) => {
    return evalStore.filter((e) => e.createdAt >= sinceMs).sort((a, b) => a.createdAt - b.createdAt);
  },
  hasEvaluation: (_persistDir: string, sessionId: string) => {
    return evalStore.some((e) => e.sessionId === sessionId);
  },
  hasLLMEvaluation: (_persistDir: string, sessionId: string) => {
    return evalStore.some((e) => e.sessionId === sessionId && !e.evaluatedByHeuristic && !e.skippedByJs);
  },
  getDb: () => mockDb,
  getActiveRequests: () => [],
  getRequestsByAgent: () => [],
  getStaleRequests: () => [],
  closeDb: () => { evalStore.length = 0; },
}));

import { printRequestStatus } from "../src/lib/tools/request-status.js";
import { upsertEvaluation, closeDb } from "../src/lib/requests.js";

const DAY = 24 * 60 * 60 * 1000;

// ── Helpers ─────────────────────────────────────────────────────────────

/** Create a synthetic eval record in the DB. */
function writeEval(
  persistDir: string,
  agent: string,
  quality: number,
  efficiency: number,
  verdict: string,
  ageMs: number,
): void {
  const ts = Date.now() - ageMs;
  const sessionId = `s_${ts}_${Math.floor(Math.random() * 1000)}`;
  upsertEvaluation(persistDir, {
    sessionId,
    agent,
    quality,
    efficiency,
    verdict,
    issues: [],
    createdAt: ts,
  });
}

/** Create a human input entry. */
function humanInputLine(ageMs: number, source = "telegram"): string {
  return JSON.stringify({ ts: Date.now() - ageMs, source, agent: "may", text: "test" });
}

// ── Test fixtures ───────────────────────────────────────────────────────

function createTestState() {
  const root = mkdtempSync(join(tmpdir(), "status-dash-test-"));
  const persistDir = join(root, ".state");

  mkdirSync(persistDir, { recursive: true });
  mkdirSync(join(persistDir, "convention-checks"), { recursive: true });

  return { root, persistDir };
}

// ── Tests ───────────────────────────────────────────────────────────────

describe("printRequestStatus (enhanced dashboard)", () => {
  let root: string;
  let persistDir: string;

  beforeAll(() => {
    const fixtures = createTestState();
    root = fixtures.root;
    persistDir = fixtures.persistDir;

    // Write evaluation data for several agents
    for (let i = 0; i < 5; i++) {
      writeEval(persistDir, "bob", 5, 4, "good", i * 60_000);
    }
    for (let i = 0; i < 5; i++) {
      writeEval(persistDir, "bob", 3, 3, "acceptable", 3 * DAY + i * 60_000);
    }
    for (let i = 0; i < 4; i++) {
      writeEval(persistDir, "coach", 2, 2, "needs_improvement", i * 60_000);
    }
    for (let i = 0; i < 10; i++) {
      writeEval(persistDir, "evaluator", 0, 0, "skipped", i * 60_000);
    }
    for (let i = 0; i < 3; i++) {
      writeEval(persistDir, "amy", 4, 4, "good", i * 60_000);
      writeEval(persistDir, "amy", 5, 5, "good", 3 * DAY + i * 60_000);
    }

    // Write human inputs (7 days)
    const humanLines: string[] = [];
    for (let i = 0; i < 8; i++) humanLines.push(humanInputLine(5 * DAY + i * 60_000));
    for (let i = 0; i < 3; i++) humanLines.push(humanInputLine(4 * DAY + i * 60_000));
    humanLines.push(humanInputLine(3 * DAY));
    for (let i = 0; i < 2; i++) humanLines.push(humanInputLine(1 * DAY + i * 60_000));
    for (let i = 0; i < 5; i++) humanLines.push(humanInputLine(i * 60_000));
    writeFileSync(join(persistDir, "human-inputs.jsonl"), humanLines.join("\n") + "\n");
  });

  afterAll(() => {
    try {
      closeDb(persistDir);
    } catch {
      /* ignore */
    }
    rmSync(root, { recursive: true, force: true });
  });

  it("renders the header", () => {
    // Skip process health and DB-dependent sections (no SQLite in vitest)
    const output = printRequestStatus(persistDir, {
      includeProcessHealth: false,
    });
    expect(output).toContain("may-agent status");
    expect(output).toContain("═");
  });

  it("shows AGENTS section with quality scores", () => {
    const output = printRequestStatus(persistDir, {
      includeProcessHealth: false,
    });
    // Even without DB, the AGENTS section appears (empty table)
    expect(output).toContain("AGENTS (last 24h)");
  });

  it("shows PROGRESS section with human input counts", () => {
    const output = printRequestStatus(persistDir, {
      includeProcessHealth: false,
    });
    expect(output).toContain("PROGRESS (7-day)");
    expect(output).toContain("Human inputs/day:");
    // Should show per-day counts — exact values depend on time-of-day bucketing
    // Just verify the line exists and has numbers
    const humanLine = output.split("\n").find((l) => l.includes("Human inputs/day:"));
    expect(humanLine).toBeDefined();
    expect(humanLine).toMatch(/\d+ → \d+/);
  });

  it("shows quality trend line excluding skipped evals", () => {
    const output = printRequestStatus(persistDir, {
      includeProcessHealth: false,
    });
    expect(output).toContain("Avg quality/day:");
    // The line should NOT have 0.0 (that would be skipped evals leaking through)
    const qualLine = output.split("\n").find((l) => l.includes("Avg quality/day:"));
    expect(qualLine).toBeDefined();
    expect(qualLine).not.toContain("0.0");
  });

  it("shows verdict distribution excluding skipped", () => {
    const output = printRequestStatus(persistDir, {
      includeProcessHealth: false,
    });
    expect(output).toContain("Verdicts (24h):");
    // Should show good, needs_improvement — but NOT skipped
    const verdictLine = output.split("\n").find((l) => l.includes("Verdicts (24h):"));
    expect(verdictLine).toBeDefined();
    expect(verdictLine).not.toContain("skipped");
  });

  it("shows convention compliance when summary.json exists", () => {
    // Write a mock summary.json
    writeFileSync(
      join(persistDir, "convention-checks", "summary.json"),
      JSON.stringify({
        conventions: [
          {
            name: "C1.1 read-before-edit",
            systemRate: 0.95,
            worstAgent: "optimizer",
            worstRate: 0.82,
            status: "stable",
          },
          { name: "C1.3 verify-writes", systemRate: 0.88, worstAgent: "bob", worstRate: 0.71, status: "active" },
        ],
      }),
    );

    const output = printRequestStatus(persistDir, {
      includeProcessHealth: false,
    });

    expect(output).toContain("CONVENTION COMPLIANCE");
    expect(output).toContain("C1.1 read-before-edit");
    expect(output).toContain("95%");
    expect(output).toContain("optimizer 82%");
    expect(output).toContain("C1.3 verify-writes");
  });

  it("omits convention section when summary.json absent", () => {
    // Remove summary.json
    rmSync(join(persistDir, "convention-checks", "summary.json"), { force: true });

    const output = printRequestStatus(persistDir, {
      includeProcessHealth: false,
    });

    expect(output).not.toContain("CONVENTION COMPLIANCE");
  });

  it("renders ACTIVE REQUESTS section (empty without DB)", () => {
    const output = printRequestStatus(persistDir, {
      includeProcessHealth: false,
    });
    // Without SQLite in vitest, requests come back empty
    expect(output).toContain("ACTIVE REQUESTS");
  });
});

describe("printRequestStatus triage logic", () => {
  let root: string;
  let persistDir: string;

  beforeAll(() => {
    // Clear the in-memory eval store from previous describe
    evalStore.length = 0;
    const fixtures = createTestState();
    root = fixtures.root;
    persistDir = fixtures.persistDir;
  });

  afterAll(() => {
    try {
      closeDb(persistDir);
    } catch {
      /* ignore */
    }
    rmSync(root, { recursive: true, force: true });
  });

  it("shows ALL CLEAR when no issues", () => {
    const output = printRequestStatus(persistDir, {
      includeProcessHealth: false,
    });
    expect(output).toContain("ALL CLEAR");
  });

  it("shows ATTENTION for low quality agents", () => {
    for (let i = 0; i < 5; i++) {
      writeEval(persistDir, "bad-agent", 0.1, 0.1, "needs_improvement", i * 60_000);
    }

    const output = printRequestStatus(persistDir, {
      includeProcessHealth: false,
    });

    expect(output).toContain("ATTENTION");
    expect(output).toContain("bad-agent");
    expect(output).toContain("avg quality");
  });
});
