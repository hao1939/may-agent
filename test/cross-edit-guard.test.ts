import { describe, it, expect } from "vitest";
import { checkCrossEditGuard } from "../src/lib/tools/cross-edit-guard.js";

const ROOT = "/app";

/** Helper: build an absolute path under agents/ */
function agentPath(...parts: string[]): string {
	return [ROOT, "agents", ...parts].join("/");
}

describe("cross-edit-guard", () => {
	// ── May exemption ──────────────────────────────────────

	describe("May exemption", () => {
		it("may can edit any agent's SOUL.md", () => {
			const r = checkCrossEditGuard(agentPath("bob", "SOUL.md"), "may", ROOT);
			expect(r.blocked).toBe(false);
		});

		it("may can edit evaluator criteria", () => {
			const r = checkCrossEditGuard(agentPath("evaluator", "knowledge", "criteria.md"), "may", ROOT);
			expect(r.blocked).toBe(false);
		});

		it("may can edit philosophy.md", () => {
			const r = checkCrossEditGuard(agentPath("shared", "philosophy.md"), "may", ROOT);
			expect(r.blocked).toBe(false);
		});

		it("May exemption is case-insensitive", () => {
			const r = checkCrossEditGuard(agentPath("bob", "SOUL.md"), "May", ROOT);
			expect(r.blocked).toBe(false);
		});
	});

	// ── No agent name (backward compat) ────────────────────

	describe("no agent name", () => {
		it("undefined agentName bypasses all guards", () => {
			const r = checkCrossEditGuard(agentPath("bob", "SOUL.md"), undefined, ROOT);
			expect(r.blocked).toBe(false);
		});
	});

	// ── Own files ──────────────────────────────────────────

	describe("own files", () => {
		it("agent can edit its own SOUL.md", () => {
			const r = checkCrossEditGuard(agentPath("bob", "SOUL.md"), "bob", ROOT);
			expect(r.blocked).toBe(false);
		});

		it("agent can edit files in its own workspace", () => {
			const r = checkCrossEditGuard(agentPath("optimizer", "workspace", "todo.md"), "optimizer", ROOT);
			expect(r.blocked).toBe(false);
		});

		it("agent can edit its own heartbeat.md", () => {
			const r = checkCrossEditGuard(agentPath("coach", "heartbeat.md"), "coach", ROOT);
			expect(r.blocked).toBe(false);
		});
	});

	// ── Cross-agent protected files ────────────────────────

	describe("cross-agent protected files", () => {
		it("blocks writing another agent's SOUL.md", () => {
			const r = checkCrossEditGuard(agentPath("bob", "SOUL.md"), "optimizer", ROOT);
			expect(r.blocked).toBe(true);
			expect(r.message).toContain("optimizer");
			expect(r.message).toContain("bob");
			expect(r.message).toContain("SOUL.md");
		});

		it("blocks writing another agent's heartbeat.md", () => {
			const r = checkCrossEditGuard(agentPath("coder", "heartbeat.md"), "coach", ROOT);
			expect(r.blocked).toBe(true);
			expect(r.message).toContain("heartbeat.md");
		});

		it("blocks writing another agent's agent.json", () => {
			const r = checkCrossEditGuard(agentPath("bob", "agent.json"), "optimizer", ROOT);
			expect(r.blocked).toBe(true);
			expect(r.message).toContain("agent.json");
		});

		it("allows writing non-protected files in another agent's directory", () => {
			const r = checkCrossEditGuard(agentPath("bob", "workspace", "journal.md"), "optimizer", ROOT);
			expect(r.blocked).toBe(false);
		});

		it("allows writing LESSONS.md cross-agent (Coach/Bob growth cycle)", () => {
			const r = checkCrossEditGuard(agentPath("coder", "LESSONS.md"), "coach", ROOT);
			expect(r.blocked).toBe(false);
		});
	});

	// ── Tech-lead agent.json exception ─────────────────────

	describe("tech-lead agent.json exception", () => {
		it("tech-lead can edit other agent's agent.json", () => {
			const r = checkCrossEditGuard(agentPath("bob", "agent.json"), "tech-lead", ROOT);
			expect(r.blocked).toBe(false);
		});

		it("non-tech-lead cannot edit other agent's agent.json", () => {
			const r = checkCrossEditGuard(agentPath("bob", "agent.json"), "coach", ROOT);
			expect(r.blocked).toBe(true);
		});
	});

	// ── P70: Self agent.json immutability ──────────────────

	describe("P70: self agent.json immutability", () => {
		it("blocks agent from editing its own agent.json", () => {
			const r = checkCrossEditGuard(agentPath("bob", "agent.json"), "bob", ROOT);
			expect(r.blocked).toBe(true);
			expect(r.message).toContain("P70");
			expect(r.message).toContain("agent.json");
		});

		it("tech-lead can edit its own agent.json (exception)", () => {
			const r = checkCrossEditGuard(agentPath("tech-lead", "agent.json"), "tech-lead", ROOT);
			expect(r.blocked).toBe(false);
		});

		it("optimizer cannot edit its own agent.json", () => {
			const r = checkCrossEditGuard(agentPath("optimizer", "agent.json"), "optimizer", ROOT);
			expect(r.blocked).toBe(true);
			expect(r.message).toContain("P70");
		});
	});

	// ── P98: Evaluator integrity ───────────────────────────

	describe("P98: evaluator integrity", () => {
		it("blocks non-evaluator from editing evaluator criteria.md", () => {
			const r = checkCrossEditGuard(agentPath("evaluator", "knowledge", "criteria.md"), "optimizer", ROOT);
			expect(r.blocked).toBe(true);
			expect(r.message).toContain("P98");
			expect(r.message).toContain("criteria.md");
		});

		it("blocks non-evaluator from editing evaluator score.md", () => {
			const r = checkCrossEditGuard(agentPath("evaluator", "skills", "score.md"), "bob", ROOT);
			expect(r.blocked).toBe(true);
			expect(r.message).toContain("P98");
		});

		it("blocks non-evaluator from editing evaluator monitor-session.md", () => {
			const r = checkCrossEditGuard(agentPath("evaluator", "skills", "monitor-session.md"), "coach", ROOT);
			expect(r.blocked).toBe(true);
			expect(r.message).toContain("P98");
		});

		it("blocks non-evaluator from editing evaluator adversarial-evaluation.md", () => {
			const r = checkCrossEditGuard(agentPath("evaluator", "knowledge", "adversarial-evaluation.md"), "tech-lead", ROOT);
			expect(r.blocked).toBe(true);
			expect(r.message).toContain("P98");
		});

		it("blocks non-evaluator from editing evaluator INDEX.md", () => {
			const r = checkCrossEditGuard(agentPath("evaluator", "knowledge", "INDEX.md"), "coder", ROOT);
			expect(r.blocked).toBe(true);
			expect(r.message).toContain("P98");
		});

		it("evaluator can edit its own criteria files", () => {
			const r = checkCrossEditGuard(agentPath("evaluator", "knowledge", "criteria.md"), "evaluator", ROOT);
			expect(r.blocked).toBe(false);
		});

		it("allows non-evaluator to edit non-protected evaluator files", () => {
			const r = checkCrossEditGuard(agentPath("evaluator", "workspace", "notes.md"), "optimizer", ROOT);
			expect(r.blocked).toBe(false);
		});
	});

	// ── Philosophy.md protection ───────────────────────────

	describe("philosophy.md protection", () => {
		it("blocks non-may from editing philosophy.md", () => {
			const r = checkCrossEditGuard(agentPath("shared", "philosophy.md"), "bob", ROOT);
			expect(r.blocked).toBe(true);
			expect(r.message).toContain("philosophy.md");
		});

		it("blocks optimizer from editing philosophy.md", () => {
			const r = checkCrossEditGuard(agentPath("shared", "philosophy.md"), "optimizer", ROOT);
			expect(r.blocked).toBe(true);
		});
	});

	// ── shared/ directory ──────────────────────────────────

	describe("shared directory", () => {
		it("allows writing non-protected files in shared/", () => {
			const r = checkCrossEditGuard(agentPath("shared", "common-sense.md"), "optimizer", ROOT);
			expect(r.blocked).toBe(false);
		});

		it("allows writing skills in shared/", () => {
			const r = checkCrossEditGuard(agentPath("shared", "skills", "my-skill", "SKILL.md"), "optimizer", ROOT);
			expect(r.blocked).toBe(false);
		});
	});

	// ── .lab/ directory ────────────────────────────────────

	describe(".lab directory", () => {
		it("allows writes to .lab/ directory", () => {
			const r = checkCrossEditGuard(agentPath(".lab", "experiment", "SOUL.md"), "optimizer", ROOT);
			expect(r.blocked).toBe(false);
		});
	});

	// ── Non-agents paths ───────────────────────────────────

	describe("non-agents paths", () => {
		it("does not guard paths outside agents/", () => {
			const r = checkCrossEditGuard("/app/src/lib/tools/foo.ts", "optimizer", ROOT);
			expect(r.blocked).toBe(false);
		});

		it("does not guard paths in project root", () => {
			const r = checkCrossEditGuard("/app/package.json", "bob", ROOT);
			expect(r.blocked).toBe(false);
		});

		it("does not guard test files", () => {
			const r = checkCrossEditGuard("/app/test/some-test.ts", "coder", ROOT);
			expect(r.blocked).toBe(false);
		});
	});

	// ── Edge cases ─────────────────────────────────────────

	describe("edge cases", () => {
		it("handles path with only one component under agents/", () => {
			const r = checkCrossEditGuard(agentPath("README.md"), "optimizer", ROOT);
			expect(r.blocked).toBe(false);
		});

		it("blocks SOUL.md in subdirectories of other agents", () => {
			// Protected filenames checked at any depth
			const r = checkCrossEditGuard(agentPath("bob", "skills", "SOUL.md"), "optimizer", ROOT);
			expect(r.blocked).toBe(true);
		});

		it("case sensitivity: agent name comparison is case-insensitive", () => {
			// Agent "Bob" should be able to edit their own dir (lowercase "bob")
			const r = checkCrossEditGuard(agentPath("bob", "workspace", "notes.md"), "Bob", ROOT);
			expect(r.blocked).toBe(false);
		});
	});
});
