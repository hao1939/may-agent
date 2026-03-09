/**
 * Tests for collectCoachingReport() from coaching-report handler.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { collectCoachingReport } from "../../agents/may/handlers/coaching-report.js";

describe("collectCoachingReport", () => {
  let dir: string;
  let persistDir: string;
  let agentsRoot: string;

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), "coaching-report-"));
    persistDir = resolve(dir, ".state");
    agentsRoot = resolve(dir, "agents");
    mkdirSync(resolve(persistDir, "evaluations"), { recursive: true });
    mkdirSync(resolve(agentsRoot, "coach", "workspace"), { recursive: true });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function writeEval(sessionId: string, agent: string, quality: number, efficiency: number, verdict: string) {
    writeFileSync(
      resolve(persistDir, "evaluations", `${sessionId}.json`),
      JSON.stringify({ agent, quality, efficiency, verdict }),
    );
  }

  it("produces message when no evaluations exist", () => {
    const report = collectCoachingReport({ persistDir, agentsRoot });
    expect(report).toContain("Coaching Report");
    expect(report).toContain("No evaluations found");
  });

  it("produces per-agent breakdown with evaluations", () => {
    writeEval("s_1", "coder", 0.8, 0.7, "good");
    writeEval("s_2", "coder", 0.6, 0.5, "acceptable");
    writeEval("s_3", "bob", 0.3, 0.4, "needs_improvement");

    const report = collectCoachingReport({ persistDir, agentsRoot });
    expect(report).toContain("Coaching Report");
    expect(report).toContain("coder");
    expect(report).toContain("bob");
    expect(report).toContain("3 total evaluations");
    expect(report).toContain("2 agents");
  });

  it("sorts agents by quality (worst first)", () => {
    writeEval("s_1", "coder", 0.8, 0.7, "good");
    writeEval("s_2", "bob", 0.2, 0.3, "needs_improvement");

    const report = collectCoachingReport({ persistDir, agentsRoot });
    const bobIdx = report.indexOf("bob");
    const coderIdx = report.indexOf("coder");
    // bob (0.2) should appear before coder (0.8)
    expect(bobIdx).toBeLessThan(coderIdx);
  });

  it("flags agents needing attention (>50% needs_improvement)", () => {
    writeEval("s_1", "bob", 0.2, 0.3, "needs_improvement");
    writeEval("s_2", "bob", 0.3, 0.2, "needs_improvement");
    writeEval("s_3", "bob", 0.7, 0.6, "good");

    const report = collectCoachingReport({ persistDir, agentsRoot });
    expect(report).toContain("Needs Attention");
    expect(report).toContain("67%"); // 2/3 = 67%
  });

  it("reads coach todo backlog count", () => {
    writeEval("s_1", "coder", 0.8, 0.7, "good");
    writeFileSync(resolve(agentsRoot, "coach", "workspace", "todo.md"), `# TODO

- [ ] Coach scout graduation
- [ ] Coach bob safe-edit
- [x] Already done

# Tracking
- [ ] This should not count
`);

    const report = collectCoachingReport({ persistDir, agentsRoot });
    expect(report).toContain("Coach backlog: 2");
  });

  it("handles missing coach workspace gracefully", () => {
    rmSync(resolve(agentsRoot, "coach"), { recursive: true, force: true });
    writeEval("s_1", "coder", 0.8, 0.7, "good");

    const report = collectCoachingReport({ persistDir, agentsRoot });
    expect(report).toContain("Coach backlog: 0");
  });

  it("shows good/needs_improvement counts per agent", () => {
    writeEval("s_1", "scout", 0.7, 0.6, "good");
    writeEval("s_2", "scout", 0.3, 0.4, "needs_improvement");
    writeEval("s_3", "scout", 0.8, 0.7, "good");

    const report = collectCoachingReport({ persistDir, agentsRoot });
    expect(report).toContain("good: 2");
    expect(report).toContain("needs_improvement: 1");
    expect(report).toContain("33%"); // 1/3 = 33%
  });
});
