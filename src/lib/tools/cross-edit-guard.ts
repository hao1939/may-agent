/**
 * Cross-edit guard: prevents agents from modifying other agents' protected files.
 *
 * Protected files (per agent): SOUL.md, LESSONS.md, agent.json
 * Also protected: agents/shared/philosophy.md (only "may" can write)
 *
 * Exception: Agent "may" is exempt from all restrictions.
 */

import { resolve, relative, sep } from "node:path";

const PROTECTED_FILENAMES = new Set(["SOUL.md", "LESSONS.md", "agent.json"]);

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

	// Guard agents/shared/philosophy.md — only may can write (and may is already exempt above)
	if (targetDir === "shared" && relPath === ["shared", "philosophy.md"].join(sep)) {
		return {
			blocked: true,
			message: `⚠️ WRITE BLOCKED: Agent '${agentName}' cannot modify agents/shared/philosophy.md. Only May can edit this file. Use agents.send() to request changes from May instead.`,
		};
	}

	// Guard agents/<other-agent>/SOUL.md, LESSONS.md, agent.json
	if (targetDir !== "shared" && targetDir !== agentName) {
		// It's another agent's directory — check if it's a protected file
		// Protected files are directly under agents/<name>/, i.e. parts.length === 2
		if (parts.length === 2 && PROTECTED_FILENAMES.has(fileName)) {
			return {
				blocked: true,
				message: `⚠️ WRITE BLOCKED: Agent '${agentName}' cannot modify agents/${targetDir}/${fileName}. Only the owning agent or May can edit another agent's SOUL.md/LESSONS.md/agent.json. Use agents.send() to request changes from the target agent instead.`,
			};
		}
	}

	return { blocked: false };
}
