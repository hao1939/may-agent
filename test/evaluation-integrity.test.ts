/**
 * Tests for P98 Evaluation Integrity — Immutable Ruler.
 *
 * Verifies that evaluation criteria and scoring files are read-only
 * to non-evaluator agents, preventing reward hacking.
 *
 * Context: RewardHackingAgents research shows agents tamper with
 * their own evaluation logic 50% of the time if allowed.
 */

import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { checkCrossEditGuard } from "../src/lib/tools/cross-edit-guard.js";

const PROJECT_ROOT = "/app";

function guardPath(relativePath: string, agent: string) {
  const absolutePath = resolve(PROJECT_ROOT, relativePath);
  return checkCrossEditGuard(absolutePath, agent, PROJECT_ROOT);
}

describe("P98 Evaluation Integrity — Immutable Ruler", () => {
  const PROTECTED_EVAL_PATHS = [
    "agents/evaluator/knowledge/criteria.md",
    "agents/evaluator/skills/score.md",
    "agents/evaluator/skills/monitor-session.md",
    "agents/evaluator/knowledge/adversarial-evaluation.md",
    "agents/evaluator/knowledge/INDEX.md",
  ];

  describe("blocks non-evaluator agents from modifying evaluation files", () => {
    for (const path of PROTECTED_EVAL_PATHS) {
      const filename = path.split("/").pop();

      it(`blocks bob from modifying ${filename}`, () => {
        const result = guardPath(path, "bob");
        expect(result.blocked).toBe(true);
        expect(result.message).toContain("P98 Evaluation Integrity");
        expect(result.message).toContain("reward hacking");
      });

      it(`blocks tech-lead from modifying ${filename}`, () => {
        const result = guardPath(path, "tech-lead");
        expect(result.blocked).toBe(true);
        expect(result.message).toContain("P98 Evaluation Integrity");
      });

      it(`blocks optimizer from modifying ${filename}`, () => {
        const result = guardPath(path, "optimizer");
        expect(result.blocked).toBe(true);
      });
    }
  });

  describe("allows evaluator to modify its own evaluation files", () => {
    for (const path of PROTECTED_EVAL_PATHS) {
      const filename = path.split("/").pop();

      it(`allows evaluator to modify ${filename}`, () => {
        const result = guardPath(path, "evaluator");
        expect(result.blocked).toBe(false);
      });
    }
  });

  describe("allows may to modify evaluation files (may is exempt)", () => {
    for (const path of PROTECTED_EVAL_PATHS) {
      const filename = path.split("/").pop();

      it(`allows may to modify ${filename}`, () => {
        const result = guardPath(path, "may");
        expect(result.blocked).toBe(false);
      });
    }
  });

  describe("does not block non-protected evaluator files", () => {
    const NON_PROTECTED_PATHS = [
      "agents/evaluator/workspace/todo.md",
      "agents/evaluator/workspace/journal.md",
      "agents/evaluator/workspace/calibration.md",
      "agents/evaluator/heartbeat.md",
    ];

    for (const path of NON_PROTECTED_PATHS) {
      const filename = path.split("/").slice(-1)[0];

      it(`allows bob to modify evaluator/${filename}`, () => {
        const result = guardPath(path, "bob");
        // These should NOT be blocked by P98 (though some may be blocked
        // by the existing AGENTS.md/LESSONS.md guard)
        if (result.blocked) {
          expect(result.message).not.toContain("P98 Evaluation Integrity");
        }
      });
    }
  });

  describe("existing guards still work alongside P98", () => {
    it("still blocks cross-agent AGENTS.md edits", () => {
      const result = guardPath("agents/evaluator/AGENTS.md", "bob");
      expect(result.blocked).toBe(true);
      expect(result.message).toContain("AGENTS.md");
    });

    it("allows cross-agent LESSONS.md edits (not identity-critical)", () => {
      const result = guardPath("agents/evaluator/LESSONS.md", "bob");
      expect(result.blocked).toBe(false);
    });

    it("still blocks cross-agent agent.json edits", () => {
      const result = guardPath("agents/evaluator/agent.json", "bob");
      expect(result.blocked).toBe(true);
      expect(result.message).toContain("agent.json");
    });

    it("still blocks philosophy.md edits from non-may agents", () => {
      const result = guardPath("agents/shared/philosophy.md", "bob");
      expect(result.blocked).toBe(true);
      expect(result.message).toContain("philosophy.md");
    });
  });
});
