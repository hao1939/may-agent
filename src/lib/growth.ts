/**
 * Growth lifecycle utilities for the coach's experiment pipeline.
 *
 * Manages promotion and discard of agent forks created during
 * growth-cycle and training-sprint workflows.
 *
 * Forks live in `<agentsRoot>/.lab/<forkName>/` and contain
 * modified copies of agent files (SOUL.md, heartbeat.md, skills/, etc.).
 *
 * - promoteAgent: copies changed files from a fork back to the
 *   canonical agent directory, then removes the fork.
 * - discardAgent: removes a fork directory without applying changes.
 */

import { readdirSync, cpSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";

export interface GrowthConfig {
  /** Root directory containing agent directories (e.g., /app/agents) */
  agentsRoot: string;
}

export interface PromoteResult {
  /** List of relative file paths that were copied from the fork to the target agent */
  promoted: string[];
}

/**
 * Promote a lab fork by copying its files into the canonical agent directory.
 *
 * Walks the fork directory recursively and copies all files to the
 * corresponding location under `<agentsRoot>/<targetAgent>/`.
 * After copying, removes the fork directory.
 *
 * @param config - Growth config with agentsRoot path
 * @param forkName - Name of the fork directory under .lab/
 * @param targetAgent - Name of the canonical agent to overwrite
 * @returns Object with list of promoted file paths
 * @throws If the fork directory doesn't exist
 */
export function promoteAgent(
  config: GrowthConfig,
  forkName: string,
  targetAgent: string,
): PromoteResult {
  const labDir = join(config.agentsRoot, ".lab");
  const forkDir = join(labDir, forkName);
  const targetDir = join(config.agentsRoot, targetAgent);

  if (!existsSync(forkDir)) {
    throw new Error(`Fork not found: ${forkDir}`);
  }

  const promoted: string[] = [];

  // Recursively collect all files in the fork
  function walkDir(dir: string): void {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile()) {
        const relPath = relative(forkDir, fullPath);
        const destPath = join(targetDir, relPath);
        // Ensure parent directory exists (fork may contain nested dirs)
        mkdirSync(dirname(destPath), { recursive: true });
        cpSync(fullPath, destPath, { force: true });
        promoted.push(relPath);
      }
    }
  }

  walkDir(forkDir);

  // Clean up the fork after successful promotion
  rmSync(forkDir, { recursive: true, force: true });

  return { promoted };
}

/**
 * Discard a lab fork by removing its directory.
 *
 * @param config - Growth config with agentsRoot path
 * @param forkName - Name of the fork directory under .lab/
 * @throws If the fork directory doesn't exist
 */
export function discardAgent(
  config: GrowthConfig,
  forkName: string,
): void {
  const labDir = join(config.agentsRoot, ".lab");
  const forkDir = join(labDir, forkName);

  if (!existsSync(forkDir)) {
    throw new Error(`Fork not found: ${forkDir}`);
  }

  rmSync(forkDir, { recursive: true, force: true });
}
