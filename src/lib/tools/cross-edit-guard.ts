/**
 * Cross-edit guard: prevents agents from modifying other agents' protected files.
 *
 * Protected files (per agent): AGENTS.md, agent.json, heartbeat.md
 * LESSONS.md is NOT protected — Coach and Bob need cross-agent access for Growth Cycle and consolidation.
 * Also protected: shared/philosophy.md and shared/common-sense.md (only "may" can write)
 *
 * Exception: Agent "may" is exempt from all restrictions.
 */

import { resolve, relative, sep } from "node:path";

const PROTECTED_FILENAMES = new Set(["AGENTS.md", "agent.json", "heartbeat.md"]);

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

interface AgentTreePath {
  displayPrefix: string;
  relPath: string;
  parts: string[];
  targetDir: string;
  fileName: string;
}

function isInsidePath(absolutePath: string, parentPath: string): boolean {
  return absolutePath === parentPath || absolutePath.startsWith(parentPath + sep);
}

function splitPath(path: string): string[] {
  return path.split(sep).filter(Boolean);
}

function agentTreePathFromRoot(
  absolutePath: string,
  agentRoot: string,
  displayPrefix: string,
): AgentTreePath | undefined {
  if (!isInsidePath(absolutePath, agentRoot)) return undefined;

  const relPath = relative(agentRoot, absolutePath);
  const parts = splitPath(relPath);
  if (parts.length < 2) return undefined;

  return {
    displayPrefix,
    relPath,
    parts,
    targetDir: parts[0],
    fileName: parts[parts.length - 1],
  };
}

function findAgentTreePath(absolutePath: string, projectRoot: string): AgentTreePath | undefined {
  const root = resolve(projectRoot);

  const globalAgentPath = agentTreePathFromRoot(absolutePath, resolve(root, "agents"), "agents");
  if (globalAgentPath) return globalAgentPath;

  const projectsDir = resolve(root, "projects");
  if (!isInsidePath(absolutePath, projectsDir)) return undefined;

  const projectParts = splitPath(relative(projectsDir, absolutePath));

  // V3 app-local agents: projects/<project>.app/agents/<agent>/...
  if (projectParts.length >= 4 && projectParts[1] === "agents") {
    return agentTreePathFromRoot(
      absolutePath,
      resolve(projectsDir, projectParts[0], "agents"),
      ["projects", projectParts[0], "agents"].join(sep),
    );
  }

  // Legacy embedded app agents: projects/<project>/.app/agents/<agent>/...
  if (projectParts.length >= 5 && projectParts[1] === ".app" && projectParts[2] === "agents") {
    return agentTreePathFromRoot(
      absolutePath,
      resolve(projectsDir, projectParts[0], ".app", "agents"),
      ["projects", projectParts[0], ".app", "agents"].join(sep),
    );
  }

  return undefined;
}

/**
 * Check if a write/edit to the given absolute path should be blocked.
 *
 * @param absolutePath - Resolved absolute path of the file being written/edited
 * @param agentName - Name of the calling agent (undefined = no guard)
 * @param projectRoot - Project root directory (agents/ and shared/ live here)
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

  const sharedDir = resolve(projectRoot, "shared");

  if (absolutePath.startsWith(sharedDir + sep) || absolutePath === sharedDir) {
    const relSharedPath = relative(sharedDir, absolutePath);
    if (relSharedPath === "philosophy.md" || relSharedPath === "common-sense.md") {
      return {
        blocked: true,
        message: `⚠️ WRITE BLOCKED: Agent "${agentName}" cannot modify shared/${relSharedPath}. Only May can edit shared system-level guidance.\n\nCannot resolve? Escalate to May via message({ to: "may", content: ... }).`,
      };
    }
    return { blocked: false };
  }

  const agentPath = findAgentTreePath(absolutePath, projectRoot);
  if (!agentPath) return { blocked: false };

  const { displayPrefix, relPath, parts, targetDir, fileName } = agentPath;
  const displayPath = `${displayPrefix}${sep}${relPath}`;

  const targetDirLower = targetDir.toLowerCase();
  const agentNameLower = agentName.toLowerCase();

  // Guard shared system-level prompt/philosophy files — only may can write (and may is already exempt above)
  const protectedSharedFiles = new Set([
    ["shared", "philosophy.md"].join(sep),
    ["shared", "common-sense.md"].join(sep),
  ]);
  if (targetDir === "shared" && protectedSharedFiles.has(relPath)) {
    return {
      blocked: true,
      message: `⚠️ WRITE BLOCKED: Agent '${agentName}' cannot modify ${displayPath}. Only May can edit shared system-level guidance.\n\nCan't resolve? Escalate to May via message({ to: "may", content: ... }).`,
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
        message: `⚠️ WRITE BLOCKED (P98 Evaluation Integrity): Agent '${agentName}' cannot modify ${displayPrefix}${sep}evaluator${sep}${evalRelPath}. Evaluation criteria and scoring logic are read-only to prevent reward hacking. Only the evaluator or May can modify evaluation files.\n\nCan't resolve? Escalate to May via message({ to: "may", content: ... }).`,
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
        message:
          `⚠️ WRITE BLOCKED (P70): Agent "${agentName}" cannot modify its own agent.json. ` +
          `agent.json defines immutable agent identity/configuration. ` +
          `Self-edits could persist a jailbreak across restarts. ` +
          `Only May or tech-lead may modify agent.json files.\n\nCan't resolve? Escalate to May via message({ to: "may", content: ... }).`,
      };
    }
  }

  // Allow writes to .lab/ directory (sandbox/fork for agent growth system)
  if (targetDir === ".lab") return { blocked: false };

  // Guard agents/<other-agent>/AGENTS.md, agent.json, heartbeat.md (at any depth)
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
        message: `⚠️ WRITE BLOCKED: Agent '${agentName}' cannot modify ${displayPrefix}${sep}${targetDir}${sep}${fileName}. Only the owning agent, May, or tech-lead (for agent.json) can edit another agent's identity files.\n\nCan't resolve? Escalate to May via message({ to: "may", content: ... }).`,
      };
    }
  }

  return { blocked: false };
}
