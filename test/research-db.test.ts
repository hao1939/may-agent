/**
 * research-db.test.ts — Tests for research-db.ts markdown→SQLite sync.
 *
 * Uses real SQLite (node:sqlite or bun:sqlite via db.ts adapter) with
 * a temp directory for test data. No mocks — tests the full pipeline
 * from markdown files to SQL queries.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { openDatabase } from "../src/lib/db.js";
import type { SqliteDb } from "../src/lib/db.js";
import {
  syncKnowledgeEntries,
  syncHypotheses,
  syncExperiments,
  syncAll,
  queryKnowledge,
  getExperimentsByStatus,
  getHypothesesByStatus,
} from "../src/lib/research-db.js";

// ── Schema (must match what requests.ts creates) ──────────────────────

const RESEARCH_SCHEMA = `
CREATE TABLE IF NOT EXISTS knowledge_entries (
  id              TEXT PRIMARY KEY,
  title           TEXT,
  status          TEXT,
  claim           TEXT,
  evidence_refs   TEXT,
  discovered      TEXT,
  last_verified   TEXT,
  raw_content     TEXT NOT NULL,
  synced_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ke_status ON knowledge_entries(status);

CREATE TABLE IF NOT EXISTS hypotheses (
  id              TEXT PRIMARY KEY,
  title           TEXT,
  status          TEXT,
  priority        TEXT,
  proposed_by     TEXT,
  hypothesis      TEXT,
  raw_content     TEXT NOT NULL,
  synced_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hyp_status   ON hypotheses(status);
CREATE INDEX IF NOT EXISTS idx_hyp_priority ON hypotheses(priority);

CREATE TABLE IF NOT EXISTS experiments (
  id              TEXT PRIMARY KEY,
  title           TEXT,
  status          TEXT,
  hypothesis_ref  TEXT,
  result_summary  TEXT,
  raw_content     TEXT NOT NULL,
  synced_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exp_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_exp_hyp    ON experiments(hypothesis_ref);
`;

// ── Test Fixtures ─────────────────────────────────────────────────────

const KE_SAMPLE = `# KE-001: Context learning works for environmental knowledge only

**Status**: verified
**Evidence**: EXP-001
**Discovered**: 2026-03-27
**Last verified**: 2026-04-04

## Claim

Agents reliably internalize environmental facts (which tools to use, which commands
to avoid) from context.md files. They do NOT internalize behavioral patterns
(how to approach problems, when to escalate) from the same mechanism.

## Evidence

EXP-001 showed context.md entries about npx avoidance were followed 100% of the time.
EXP-002 showed behavioral entries (like "always run tests before finishing") had
only 30% compliance.

## Links

- **tested by** → EXP-001
- **refines** → H-002
`;

const KE_SIMPLE = `# KE-010: Most gym scenarios hit ceiling — agents pass at baseline

**Status**: observed
**Evidence**: 15+ ceiling observations across 106 scenarios tested

## Claim

The majority of gym scenarios are too easy — agents pass them on first attempt
with no skill/workflow intervention needed. This makes the gym a weak discriminator
for measuring improvement.
`;

const H_STANDARD = `# H-001: Adversarial QA framing increases issue detection rate

**Status**: untested
**Priority**: high
**Proposed by**: Hao/pi (from KE-005 analysis)

## Hypothesis

If QA agents are given an adversarial framing ("find problems, not confirm correctness"),
their issue detection rate will increase from 14% to >30%.

## Motivation

KE-005 showed QA rubber-stamps. The hypothesis is that the framing, not the capability,
is the bottleneck.
`;

const H_NON_STANDARD_ID = `# H004: Evaluator Drift is Our Biggest Unmonitored Risk

**Author:** Bob (Architect)
**Date:** 2026-04-01
**Status:** Proposed
**Priority:** medium

## Hypothesis

Evaluator scoring drifts over time as the heuristic is tweaked, making
longitudinal comparisons meaningless.
`;

const EXP_DESIGN_MD = `# EXP-030: On-Demand Skill Discovery via Common-Sense Nudge

**Status**: COMPLETED — hypothesis rejected (0% discovery rate). See results.md

## Hypothesis
Testing whether a one-line nudge causes skill discovery.

## Design
Two-arm experiment with 12 runs total.
`;

const EXP_RESULTS_MD = `# EXP-030 Results

## Summary

The nudge had zero effect. 0/6 treatment sessions read LIBRARY.md.
Agents ignore text-level interventions consistently (converges with EXP-028).

## Verdict

Hypothesis rejected. On-demand discovery does not work via nudges.
`;

const EXP_DESIGN_JSON = `{
  "hypothesis": "H-context-environmental",
  "description": "Does context.md prevent npx usage?",
  "arms": {
    "control": { "scenario": "context-npx-avoidance" },
    "treatment": { "scenario": "context-npx-avoidance" }
  },
  "runs_per_arm": 3,
  "metrics": ["passed", "check_no-npx-attempt"]
}`;

const EXP_RESULTS_JSON_EXP = `# EXP-001: Workflow Effectiveness Evaluation

## Summary of Findings

### Headline: Workflows do NOT improve outcomes — they cost more and fail more.

Workflows complete more reliably (89% vs 76%) but have worse verdicts and 2.7x cost.
`;

// ── Test Infrastructure ───────────────────────────────────────────────

let db: SqliteDb;
let testDir: string;

function setupTestDir(): string {
  const dir = join(tmpdir(), `research-db-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(dir, "entries"), { recursive: true });
  mkdirSync(join(dir, "hypotheses"), { recursive: true });
  mkdirSync(join(dir, "experiments"), { recursive: true });
  return dir;
}

function setupDb(): SqliteDb {
  const dbDir = join(tmpdir(), `research-db-test-db-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dbDir, { recursive: true });
  const database = openDatabase(join(dbDir, "test.db"));
  database.exec(RESEARCH_SCHEMA);
  return database;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("research-db", () => {
  beforeEach(() => {
    db = setupDb();
    testDir = setupTestDir();
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      /* cleanup best-effort */
    }
  });

  // ── Knowledge Entries ─────────────────────────────────────────────

  describe("syncKnowledgeEntries", () => {
    it("syncs a standard KE entry with all fields", () => {
      writeFileSync(join(testDir, "entries", "KE-001.md"), KE_SAMPLE);

      const result = syncKnowledgeEntries(db, join(testDir, "entries"));

      expect(result.synced).toBe(1);
      expect(result.errors).toHaveLength(0);

      const rows = db
        .prepare("SELECT * FROM knowledge_entries WHERE id = ?")
        .all("KE-001") as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toBe(
        "Context learning works for environmental knowledge only"
      );
      expect(rows[0].status).toBe("verified");
      expect(rows[0].evidence_refs).toBe("EXP-001");
      expect(rows[0].discovered).toBe("2026-03-27");
      expect(rows[0].claim).toContain("environmental facts");
      expect(rows[0].synced_at).toBeGreaterThan(0);
    });

    it("syncs a simpler KE entry with observed status", () => {
      writeFileSync(join(testDir, "entries", "KE-010.md"), KE_SIMPLE);

      const result = syncKnowledgeEntries(db, join(testDir, "entries"));

      expect(result.synced).toBe(1);
      const rows = db
        .prepare("SELECT * FROM knowledge_entries WHERE id = ?")
        .all("KE-010") as any[];
      expect(rows[0].status).toBe("observed");
      expect(rows[0].title).toContain("ceiling");
    });

    it("syncs multiple entries in one call", () => {
      writeFileSync(join(testDir, "entries", "KE-001.md"), KE_SAMPLE);
      writeFileSync(join(testDir, "entries", "KE-010.md"), KE_SIMPLE);

      const result = syncKnowledgeEntries(db, join(testDir, "entries"));

      expect(result.synced).toBe(2);
      expect(result.errors).toHaveLength(0);

      const count = db
        .prepare("SELECT COUNT(*) as n FROM knowledge_entries")
        .all() as any[];
      expect(count[0].n).toBe(2);
    });

    it("is idempotent — re-syncing updates without duplicating", () => {
      writeFileSync(join(testDir, "entries", "KE-001.md"), KE_SAMPLE);

      syncKnowledgeEntries(db, join(testDir, "entries"));
      syncKnowledgeEntries(db, join(testDir, "entries"));

      const count = db
        .prepare("SELECT COUNT(*) as n FROM knowledge_entries")
        .all() as any[];
      expect(count[0].n).toBe(1);
    });

    it("returns error for non-existent directory", () => {
      const result = syncKnowledgeEntries(
        db,
        "/tmp/research-db-test-nonexistent-" + Date.now()
      );
      expect(result.synced).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Directory not found");
    });

    it("ignores non-md files", () => {
      writeFileSync(join(testDir, "entries", "KE-001.md"), KE_SAMPLE);
      writeFileSync(join(testDir, "entries", "README.txt"), "ignore me");

      const result = syncKnowledgeEntries(db, join(testDir, "entries"));
      expect(result.synced).toBe(1);
    });
  });

  // ── Hypotheses ────────────────────────────────────────────────────

  describe("syncHypotheses", () => {
    it("syncs a standard hypothesis with all fields", () => {
      writeFileSync(join(testDir, "hypotheses", "H-001.md"), H_STANDARD);

      const result = syncHypotheses(db, join(testDir, "hypotheses"));

      expect(result.synced).toBe(1);
      expect(result.errors).toHaveLength(0);

      const rows = db
        .prepare("SELECT * FROM hypotheses WHERE id = ?")
        .all("H-001") as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toContain("Adversarial QA");
      expect(rows[0].status).toBe("untested");
      expect(rows[0].priority).toBe("high");
      expect(rows[0].proposed_by).toBe("Hao/pi (from KE-005 analysis)");
      expect(rows[0].hypothesis).toContain("adversarial framing");
    });

    it("normalizes non-standard H IDs (H004 → H-004)", () => {
      writeFileSync(
        join(testDir, "hypotheses", "H-009-evaluator-drift.md"),
        H_NON_STANDARD_ID
      );

      const result = syncHypotheses(db, join(testDir, "hypotheses"));

      expect(result.synced).toBe(1);
      // H004 from H1 gets normalized to H-004
      const rows = db
        .prepare("SELECT * FROM hypotheses WHERE id = ?")
        .all("H-004") as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toContain("Evaluator Drift");
      expect(rows[0].proposed_by).toBe("Bob (Architect)");
    });

    it("syncs multiple hypotheses", () => {
      writeFileSync(join(testDir, "hypotheses", "H-001.md"), H_STANDARD);
      writeFileSync(
        join(testDir, "hypotheses", "H-009-evaluator-drift.md"),
        H_NON_STANDARD_ID
      );

      const result = syncHypotheses(db, join(testDir, "hypotheses"));
      expect(result.synced).toBe(2);
    });

    it("is idempotent", () => {
      writeFileSync(join(testDir, "hypotheses", "H-001.md"), H_STANDARD);
      syncHypotheses(db, join(testDir, "hypotheses"));
      syncHypotheses(db, join(testDir, "hypotheses"));

      const count = db
        .prepare("SELECT COUNT(*) as n FROM hypotheses")
        .all() as any[];
      expect(count[0].n).toBe(1);
    });
  });

  // ── Experiments ───────────────────────────────────────────────────

  describe("syncExperiments", () => {
    it("syncs an experiment with design.md + results.md", () => {
      const expDir = join(testDir, "experiments", "EXP-030");
      mkdirSync(expDir, { recursive: true });
      writeFileSync(join(expDir, "design.md"), EXP_DESIGN_MD);
      writeFileSync(join(expDir, "results.md"), EXP_RESULTS_MD);

      const result = syncExperiments(db, join(testDir, "experiments"));

      expect(result.synced).toBe(1);
      expect(result.errors).toHaveLength(0);

      const rows = db
        .prepare("SELECT * FROM experiments WHERE id = ?")
        .all("EXP-030") as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toContain("On-Demand Skill Discovery");
      expect(rows[0].status).toBe("completed");
      expect(rows[0].result_summary).toContain("zero effect");
      expect(rows[0].raw_content).toContain("On-Demand Skill Discovery");
      expect(rows[0].raw_content).toContain("Results");
    });

    it("syncs an experiment with design.json", () => {
      const expDir = join(testDir, "experiments", "EXP-001");
      mkdirSync(expDir, { recursive: true });
      writeFileSync(join(expDir, "design.json"), EXP_DESIGN_JSON);
      writeFileSync(join(expDir, "results.md"), EXP_RESULTS_JSON_EXP);

      const result = syncExperiments(db, join(testDir, "experiments"));

      expect(result.synced).toBe(1);

      const rows = db
        .prepare("SELECT * FROM experiments WHERE id = ?")
        .all("EXP-001") as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].hypothesis_ref).toBe("H-context-environmental");
      expect(rows[0].raw_content).toContain("[design.json]");
    });

    it("handles experiments with only results.md (no design)", () => {
      const expDir = join(testDir, "experiments", "EXP-002");
      mkdirSync(expDir, { recursive: true });
      writeFileSync(join(expDir, "results.md"), "# Results\n\nSome results here.");

      const result = syncExperiments(db, join(testDir, "experiments"));

      expect(result.synced).toBe(1);
      const rows = db
        .prepare("SELECT * FROM experiments WHERE id = ?")
        .all("EXP-002") as any[];
      expect(rows[0].raw_content).toContain("Results");
    });

    it("handles empty experiment directories", () => {
      const expDir = join(testDir, "experiments", "EXP-099");
      mkdirSync(expDir, { recursive: true });

      const result = syncExperiments(db, join(testDir, "experiments"));

      expect(result.synced).toBe(1);
      const rows = db
        .prepare("SELECT * FROM experiments WHERE id = ?")
        .all("EXP-099") as any[];
      expect(rows[0].raw_content).toContain("Empty experiment");
    });

    it("ignores non-EXP directories", () => {
      mkdirSync(join(testDir, "experiments", "archive"), { recursive: true });
      mkdirSync(join(testDir, "experiments", "EXP-001"), { recursive: true });
      writeFileSync(
        join(testDir, "experiments", "EXP-001", "results.md"),
        "# Results\nTest"
      );

      const result = syncExperiments(db, join(testDir, "experiments"));
      expect(result.synced).toBe(1);
    });

    it("is idempotent", () => {
      const expDir = join(testDir, "experiments", "EXP-030");
      mkdirSync(expDir, { recursive: true });
      writeFileSync(join(expDir, "design.md"), EXP_DESIGN_MD);

      syncExperiments(db, join(testDir, "experiments"));
      syncExperiments(db, join(testDir, "experiments"));

      const count = db
        .prepare("SELECT COUNT(*) as n FROM experiments")
        .all() as any[];
      expect(count[0].n).toBe(1);
    });
  });

  // ── Query Functions ───────────────────────────────────────────────

  describe("queryKnowledge", () => {
    it("searches across title, claim, and raw_content", () => {
      writeFileSync(join(testDir, "entries", "KE-001.md"), KE_SAMPLE);
      writeFileSync(join(testDir, "entries", "KE-010.md"), KE_SIMPLE);
      syncKnowledgeEntries(db, join(testDir, "entries"));

      // Search by claim content
      const results = queryKnowledge(db, "environmental");
      expect(results).toHaveLength(1);
      expect((results[0] as any).id).toBe("KE-001");
    });

    it("returns empty array for no match", () => {
      writeFileSync(join(testDir, "entries", "KE-001.md"), KE_SAMPLE);
      syncKnowledgeEntries(db, join(testDir, "entries"));

      const results = queryKnowledge(db, "nonexistent-keyword-xyz");
      expect(results).toHaveLength(0);
    });
  });

  describe("getExperimentsByStatus", () => {
    it("filters experiments by normalized status", () => {
      const expDir = join(testDir, "experiments", "EXP-030");
      mkdirSync(expDir, { recursive: true });
      writeFileSync(join(expDir, "design.md"), EXP_DESIGN_MD);
      syncExperiments(db, join(testDir, "experiments"));

      const completed = getExperimentsByStatus(db, "completed");
      expect(completed).toHaveLength(1);
      expect((completed[0] as any).id).toBe("EXP-030");

      const designing = getExperimentsByStatus(db, "designed");
      expect(designing).toHaveLength(0);
    });
  });

  describe("getHypothesesByStatus", () => {
    it("filters hypotheses by status", () => {
      writeFileSync(join(testDir, "hypotheses", "H-001.md"), H_STANDARD);
      syncHypotheses(db, join(testDir, "hypotheses"));

      const untested = getHypothesesByStatus(db, "untested");
      expect(untested).toHaveLength(1);
      expect((untested[0] as any).id).toBe("H-001");
    });
  });

  // ── syncAll ───────────────────────────────────────────────────────

  describe("syncAll", () => {
    it("syncs all artifact types in one call", () => {
      // Set up all three types
      writeFileSync(join(testDir, "entries", "KE-001.md"), KE_SAMPLE);
      writeFileSync(join(testDir, "hypotheses", "H-001.md"), H_STANDARD);
      const expDir = join(testDir, "experiments", "EXP-030");
      mkdirSync(expDir, { recursive: true });
      writeFileSync(join(expDir, "design.md"), EXP_DESIGN_MD);

      const result = syncAll(db, testDir);

      expect(result.knowledgeEntries.synced).toBe(1);
      expect(result.hypotheses.synced).toBe(1);
      expect(result.experiments.synced).toBe(1);
      expect(result.knowledgeEntries.errors).toHaveLength(0);
      expect(result.hypotheses.errors).toHaveLength(0);
      expect(result.experiments.errors).toHaveLength(0);
    });
  });

  // ── Integration with real data ────────────────────────────────────

  describe("integration: real knowledge base", () => {
    it("syncs the actual knowledge base without errors", { timeout: 30_000 }, () => {
      const realBase = "agents/shared/knowledge";
      const result = syncAll(db, realBase);

      // Should sync >0 of each type
      expect(result.knowledgeEntries.synced).toBeGreaterThan(0);
      expect(result.hypotheses.synced).toBeGreaterThan(0);
      expect(result.experiments.synced).toBeGreaterThan(0);

      // Should have very few errors (some files may have non-standard format)
      const totalErrors = [
        ...result.knowledgeEntries.errors,
        ...result.hypotheses.errors,
        ...result.experiments.errors,
      ];
      // Allow up to 5 errors across 120+ files
      expect(totalErrors.length).toBeLessThanOrEqual(5);
    });

    it("can query real knowledge entries by keyword", () => {
      syncKnowledgeEntries(db, "agents/shared/knowledge/entries");
      const results = queryKnowledge(db, "context");
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
