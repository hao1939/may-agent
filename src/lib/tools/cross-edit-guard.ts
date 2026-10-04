/** File-tool safeguards. Domain paths and writer grants come from installation policy. */
import { resolve, relative, sep, matchesGlob } from "node:path";
import type { FileWritePolicy } from "./file-write-policy.js";

const PROTECTED_FILENAMES = new Set(["AGENTS.md", "agent.json", "heartbeat.md"]);

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
  if (parts.length < 2 || parts[0].startsWith(".")) return undefined;

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

export function checkCrossEditGuard(
  absolutePath: string,
  agentName: string | undefined,
  projectRoot: string,
  policy?: FileWritePolicy,
): CrossEditGuardResult {
  if (!agentName) return { blocked: false };
  const rel = relative(resolve(projectRoot), resolve(absolutePath)).split(sep).join("/");
  const deny = (): CrossEditGuardResult => ({
    blocked: true,
    message: `WRITE BLOCKED: Agent '${agentName}' has no declared permission to modify ${rel}. Report the blocked path and reason to your caller; do not bypass the guard.`,
  });
  const absolutePaths = [resolve(absolutePath)];
  const execution = policy?.execution;
  if (execution && isInsidePath(resolve(absolutePath), resolve(execution.root))) {
    absolutePaths.push(resolve(execution.sourceRoot, relative(resolve(execution.root), resolve(absolutePath))));
  }
  const paths = [...new Set(absolutePaths)]
    .map((path) => relative(resolve(policy?.root ?? projectRoot), path).split(sep).join("/"))
    .filter((path) => path !== ".." && !path.startsWith("../"));
  // The policy itself is operator-owned. A file-tool grant cannot rewrite its own authority.
  if (paths.includes("shared/file-write-policy.json")) return deny();
  const matches = (patterns: readonly string[]) =>
    patterns.some((pattern) => paths.some((path) => matchesGlob(path, pattern)));
  if (policy?.grants.some((grant) => grant.writers.includes(agentName) && matches(grant.paths)))
    return { blocked: false };
  if (policy && matches(policy.protectedPaths)) return deny();
  if (
    [
      "shared/common-sense.md",
      "shared/philosophy.md",
      "agents/shared/common-sense.md",
      "agents/shared/philosophy.md",
    ].some((path) => paths.includes(path) || rel === path)
  )
    return deny();
  const target =
    (policy?.root ? absolutePaths.map(path => findAgentTreePath(path, policy.root)).find(Boolean) : undefined) ??
    findAgentTreePath(resolve(absolutePath), projectRoot);
  if (!target || !PROTECTED_FILENAMES.has(target.fileName)) return { blocked: false };
  if (target.fileName === "agent.json" || target.targetDir !== agentName) return deny();
  return { blocked: false };
}
