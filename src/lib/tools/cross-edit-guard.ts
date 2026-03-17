/**
 * Cross-edit guard: prevents agents from modifying other agents' protected files.
 *
 * Protected files (per agent): SOUL.md, agent.json
 * LESSONS.md is NOT protected — Coach and Bob need cross-agent access for Growth Cycle and consolidation.
 * Also protected: agents/shared/philosophy.md (only "may" can write)
 *
 * Exception: Agent "may" is exempt from all restrictions.
 */

import { resolve, relative, sep } from "node:path";

const PROTECTED_FILENAMES = new Set(["SOUL.md", "agent.json", "heartbeat.md"]);

/**
 * P98 Evaluation Integrity — Immutable Ruler Principle.
 *
 * These evaluator paths are read-only to ALL agents except "may" and "evaluator" itself.
 * Prevents reward hacking (RewardHackingAgents: agents tamper with evaluation logic 50% of the time).
 *
 * Protected paths (relative to agents/evaluator/):
 *   - knowledge/criteria.md — scoring rubric
 *   - skills/score.md — scoring execution skill
 *   - skills/monitor-session.md — session review skill
 *   - knowledge/adversarial-evaluation.md — adversarial evaluation guidance
 */
const EVALUATOR_PROTECTED_PATHS = new Set([
	"knowledge/criteria.md",
	"skills/score.md",
	"skills/monitor-session.md",
	"knowledge/adversarial-evaluation.md",
	"knowledge/INDEX.md",
]);

export interface CrossEditGuardResult {
	blocked: boolean;
	message?: string;
}

/**
 * Check if a write/edit to the given absolute path should be blocked.
 *
 * @param absolutePath - Resolved absolute path of the file being written/edited
 * @param agentName - Name of the calling agent (undefined = no guard)
 * @param projectRoot - Project root directory (agents/ lives here)
 * @returns { blocked: false } if allowed, { blocked: true, message } if denied
 */
export function checkCrossEditGuard(
	absolutePath: string,
	agentName: string | undefined,
	projectRoot: string,
): CrossEditGuardResult {
	// No agent name = no guard (backwards compat, e.g. default tools)
	if (!agentName) return { blocked: false };

	// May is exempt from all restrictions
	if (agentName.toLowerCase() === "may") return { blocked: false };

	const agentsDir = resolve(projectRoot, "agents");

	// Check if path is under agents/
	if (!absolutePath.startsWith(agentsDir + sep) && absolutePath !== agentsDir) {
		return { blocked: false };
	}

	// Get the path relative to agents/
	const relPath = relative(agentsDir, absolutePath);
	const parts = relPath.split(sep);

	// Need at least <agentOrShared>/<filename>
	if (parts.length < 2) return { blocked: false };

	const targetDir = parts[0];
	const fileName = parts[parts.length - 1];

	const targetDirLower = targetDir.toLowerCase();
	const agentNameLower = agentName.toLowerCase();

	// Guard agents/shared/philosophy.md — only may can write (and may is already exempt above)
	if (targetDir === "shared" && relPath === ["shared", "philosophy.md"].join(sep)) {
		return {
			blocked: true,
			message: `⚠️ WRITE BLOCKED: Agent '${agentName}' cannot modify agents/shared/philosophy.md. Only May can edit this file. Use agents.send() to request changes from May instead.`,
		};
	}

	// P98 Evaluation Integrity — Immutable Ruler
	// Evaluator criteria/scoring files are read-only to all agents except evaluator itself (and may, already exempt above)
	if (targetDir === "evaluator" && agentNameLower !== "evaluator") {
		// Get the path relative to agents/evaluator/
		const evalRelPath = parts.slice(1).join(sep);
		if (EVALUATOR_PROTECTED_PATHS.has(evalRelPath)) {
			return {
				blocked: true,
				message: `⚠️ WRITE BLOCKED (P98 Evaluation Integrity): Agent '${agentName}' cannot modify agents/evaluator/${evalRelPath}. Evaluation criteria and scoring logic are read-only to prevent reward hacking. Only the evaluator or May can modify evaluation files.`,
			};
		}
	}

	// P70: Block self-edits to agent.json (Immutable Self-Config).
	// An agent editing its own agent.json can persist a jailbreak across restarts.
	// Only May (exempt above) or tech-lead may edit agent.json files.
	if (targetDirLower === agentNameLower && fileName === "agent.json") {
		if (agentNameLower !== "tech-lead") {
			return {
				blocked: true,
				message: `⚠️ WRITE BLOCKED (P70): Agent "${agentName}" cannot modify its own agent.json. ` +
					`agent.json defines immutable agent identity/configuration. ` +
					`Self-edits could persist a jailbreak across restarts. ` +
					`Only May or tech-lead may modify agent.json files.`,
			};
		}
	}

	// Allow writes to .lab/ directory (sandbox/fork for agent growth system)
	if (targetDir === ".lab") return { blocked: false };

	// Guard agents/<other-agent>/SOUL.md, agent.json (at any depth)
	// Conservative: block protected filenames even in subdirectories to prevent leaks
	if (targetDirLower !== "shared" && targetDirLower !== agentNameLower) {
		// It's another agent's directory — check if it's a protected filename
		if (PROTECTED_FILENAMES.has(fileName)) {
			// P70: tech-lead may edit other agents' agent.json (manages agent configs)
			if (fileName === "agent.json" && agentNameLower === "tech-lead") {
				return { blocked: false };
			}
			return {
				blocked: true,
				message: `⚠️ WRITE BLOCKED: Agent '${agentName}' cannot modify agents/${targetDir}/${fileName}. Only the owning agent (for SOUL.md), May, or tech-lead (for agent.json) can edit another agent's identity files. Use agents.send() to request changes instead.`,
			};
		}
	}

	return { blocked: false };
}
