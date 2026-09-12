/**
 * Cross-edit guard: prevents agents from modifying other agents' protected files.
 *
 * Protected files (per agent): AGENTS.md, agent.json, heartbeat.md
 * Protected-file grants come from trusted tool construction, never agent names.
 * These lexical file-tool checks are not a shell or native-agent sandbox.
 */

import { isAbsolute, resolve, relative, sep } from "node:path";

const PROTECTED_FILENAMES = new Set(["AGENTS.md", "agent.json", "heartbeat.md"]);

/**
 * P98 Evaluation Integrity — Immutable Ruler Principle.
 *
 * Retain the legacy evaluation paths as a protection floor during adoption.
 * No agent name exempts its caller; writes need explicit exact-file grants.
 * File tools must not silently alter retained evaluation truth.
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

export interface FileWriteScope {
  /** Exact installation-relative files, supplied by reviewed agent configuration. No globs or directory grants. */
  protectedFileWrites?: readonly string[];
  /** Canonical writable identity directory; a same-named agent elsewhere is not this agent. */
  agentWriteDirectory?: string;
}

export function validProtectedFileWrites(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(path => typeof path === "string" && path.trim() === path &&
    path.length > 0 && !isAbsolute(path) && !path.includes("\\") && !path.includes("\0") &&
    !/[?*]/.test(path) && path.split("/").every(part => part !== ".." && part !== "." && part !== ""));
}

interface AgentTreePath {
  directory: string;
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
    directory: resolve(agentRoot, parts[0]),
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
 * @param agentName - Calling identity for attribution; never a privileged role
 * @param projectRoot - Project root directory (agents/ and shared/ live here)
 * @returns { blocked: false } if allowed, { blocked: true, message } if denied
 */
export function checkCrossEditGuard(
  absolutePath: string,
  agentName: string | undefined,
  projectRoot: string,
  scope: FileWriteScope = {},
): CrossEditGuardResult {
  if (validProtectedFileWrites(scope.protectedFileWrites) && scope.protectedFileWrites.some(
    path => resolve(projectRoot, path) === resolve(absolutePath),
  )) return { blocked: false };

  const sharedDir = resolve(projectRoot, "shared");

  if (absolutePath.startsWith(sharedDir + sep) || absolutePath === sharedDir) {
    const relSharedPath = relative(sharedDir, absolutePath);
    if (relSharedPath === "philosophy.md" || relSharedPath === "common-sense.md") {
      return {
        blocked: true,
        message: `⚠️ WRITE BLOCKED: Agent "${agentName}" cannot modify shared/${relSharedPath}. An explicit protected-file grant is required.\n\nIf this edit is needed, report the blocked path and reason to your caller; do not bypass the guard.`,
      };
    }
    return { blocked: false };
  }

  const agentPath = findAgentTreePath(absolutePath, projectRoot);
  if (!agentPath) return { blocked: false };

  const { displayPrefix, relPath, parts, targetDir, fileName } = agentPath;
  const displayPath = `${displayPrefix}${sep}${relPath}`;

  const targetDirLower = targetDir.toLowerCase();
  const agentNameLower = agentName?.toLowerCase();
  const ownDirectory = scope.agentWriteDirectory
    ? resolve(scope.agentWriteDirectory) === agentPath.directory
    : targetDirLower === agentNameLower;

  // Shared system guidance always needs an explicit protected-file grant.
  const protectedSharedFiles = new Set([
    ["shared", "philosophy.md"].join(sep),
    ["shared", "common-sense.md"].join(sep),
  ]);
  if (targetDir === "shared" && protectedSharedFiles.has(relPath)) {
    return {
      blocked: true,
      message: `⚠️ WRITE BLOCKED: Agent '${agentName}' cannot modify ${displayPath}. An explicit protected-file grant is required.\n\nIf this edit is needed, report the blocked path and reason to your caller; do not bypass the guard.`,
    };
  }

  // P98 Evaluation Integrity — Immutable Ruler
  // Legacy evaluation truth stays protected even from an agent called evaluator.
  if (targetDir === "evaluator") {
    // Get the path relative to agents/evaluator/
    const evalRelPath = parts.slice(1).join(sep);
    if (EVALUATOR_PROTECTED_PATHS.has(evalRelPath)) {
      return {
        blocked: true,
        message: `⚠️ WRITE BLOCKED (P98 Evaluation Integrity): Agent '${agentName}' cannot modify ${displayPrefix}${sep}evaluator${sep}${evalRelPath}. Evaluation criteria and scoring logic are read-only to prevent reward hacking. An explicit protected-file grant is required.\n\nIf this edit is needed, report the blocked path and reason to your caller; do not bypass the guard.`,
      };
    }
  }

  // P70: Block self-edits to agent.json (Immutable Self-Config).
  // An agent editing its own agent.json can persist a jailbreak across restarts.
  // An explicit protected-file grant is required, including for self-configuration.
  if (ownDirectory && fileName === "agent.json") {
    return {
      blocked: true,
      message:
        `⚠️ WRITE BLOCKED (P70): Agent "${agentName}" cannot modify its own agent.json. ` +
        `An explicit protected-file grant is required for agent configuration. ` +
        `If this edit is needed, report the blocked path and reason to your caller; do not bypass the guard.`,
    };
  }

  // Allow writes to .lab/ directory (sandbox/fork for agent growth system)
  if (targetDir === ".lab") return { blocked: false };

  // Guard agents/<other-agent>/AGENTS.md, agent.json, heartbeat.md (at any depth)
  // Conservative: block protected filenames even in subdirectories to prevent leaks
  if (targetDirLower !== "shared" && !ownDirectory) {
    // It's another agent's directory — check if it's a protected filename
    if (PROTECTED_FILENAMES.has(fileName)) {
      return {
        blocked: true,
        message: `⚠️ WRITE BLOCKED: Agent '${agentName}' cannot modify ${displayPrefix}${sep}${targetDir}${sep}${fileName}. An explicit protected-file grant is required for another agent's identity files.\n\nIf this edit is needed, report the blocked path and reason to your caller; do not bypass the guard.`,
      };
    }
  }

  return { blocked: false };
}
