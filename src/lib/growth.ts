/**
 * Agent Growth — Core Logic
 *
 * Pure functions for the Fork/Verify/Promote/Discard cycle.
 * No tool wrappers here — just file operations and validation.
 *
 * Forks live in agents/.lab/<name>/ — an isolated sandbox for experiments.
 * Promotes copy only content files (SOUL.md, knowledge/, skills/, etc.)
 * back to the live agent, preserving the original agent.json identity.
 */

import { resolve, join } from "node:path";
import {
  existsSync,
  mkdirSync,
  cpSync,
  rmSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from "node:fs";

// ── Types ──────────────────────────────────────────────────────────────

export interface GrowthConfig {
  /** Root directory containing agent folders (e.g., "agents/"). */
  agentsRoot: string;
  /** Persist directory for state (memory, sessions). Optional — enables memory copy/cleanup. */
  persistDir?: string;
}

export interface ForkResult {
  sourceDir: string;
  destDir: string;
  name: string;
}

export interface PromoteResult {
  promoted: string[];
  sourceDir: string;
  targetDir: string;
}

// ── Artifacts that get promoted ────────────────────────────────────────

/** Files/directories copied during promote. Order doesn't matter. */
const PROMOTABLE_ARTIFACTS = [
  "SOUL.md",
  "DOMAIN.md",
  "TOOLS.md",
  "LESSONS.md",
  "heartbeat.md",
  "knowledge",
  "skills",
];

// ── Core operations ────────────────────────────────────────────────────

/**
 * Fork an agent into the .lab/ sandbox.
 *
 * Copies the full agent directory, updates agent.json name,
 * and optionally copies memory state.
 */
export function forkAgent(
  config: GrowthConfig,
  sourceName: string,
  targetName: string,
): ForkResult {
  const { agentsRoot } = config;
  const labDir = resolve(agentsRoot, ".lab");
  const sourceDir = resolve(agentsRoot, sourceName);
  const destDir = resolve(labDir, targetName);

  // Validate
  if (!existsSync(sourceDir)) {
    throw new Error(`Source agent "${sourceName}" not found at ${sourceDir}`);
  }
  if (existsSync(destDir)) {
    throw new Error(`Destination "${targetName}" already exists at ${destDir}`);
  }

  // Ensure .lab/ exists
  mkdirSync(labDir, { recursive: true });

  // Copy directory
  cpSync(sourceDir, destDir, { recursive: true });

  // Update agent.json name
  const configPath = join(destDir, "agent.json");
  if (existsSync(configPath)) {
    const agentConfig = JSON.parse(readFileSync(configPath, "utf-8"));
    agentConfig.name = targetName;
    writeFileSync(configPath, JSON.stringify(agentConfig, null, 2));
  }

  // Optional: copy memory
  if (config.persistDir) {
    const srcMemory = resolve(config.persistDir, "memory", `${sourceName}.jsonl`);
    const destMemory = resolve(config.persistDir, "memory", `${targetName}.jsonl`);
    if (existsSync(srcMemory)) {
      mkdirSync(resolve(config.persistDir, "memory"), { recursive: true });
      cpSync(srcMemory, destMemory);
    }
  }

  return { sourceDir, destDir, name: targetName };
}

/**
 * Promote changes from a .lab/ experiment back to the live agent.
 *
 * Only copies content files (SOUL.md, knowledge/, skills/, etc.).
 * Preserves the target's agent.json identity (name, model, tools).
 * Removes the lab fork after promotion.
 */
export function promoteAgent(
  config: GrowthConfig,
  sourceName: string,
  targetName: string,
): PromoteResult {
  const { agentsRoot } = config;
  const labDir = resolve(agentsRoot, ".lab");
  const sourceDir = resolve(labDir, sourceName);
  const targetDir = resolve(agentsRoot, targetName);

  // Validate
  if (!existsSync(sourceDir)) {
    throw new Error(`Source "${sourceName}" not found in .lab/`);
  }
  if (!existsSync(targetDir)) {
    throw new Error(`Target "${targetName}" not found in agents/`);
  }

  // Copy promotable artifacts
  const promoted: string[] = [];
  for (const artifact of PROMOTABLE_ARTIFACTS) {
    const srcPath = join(sourceDir, artifact);
    const destPath = join(targetDir, artifact);
    if (existsSync(srcPath)) {
      cpSync(srcPath, destPath, { recursive: true, force: true });
      promoted.push(artifact);
    }
  }

  // Clean up the lab fork
  rmSync(sourceDir, { recursive: true, force: true });

  return { promoted, sourceDir, targetDir };
}

/**
 * Discard a .lab/ experiment.
 *
 * Removes the fork directory and its memory state.
 */
export function discardAgent(
  config: GrowthConfig,
  agentName: string,
): void {
  const { agentsRoot } = config;
  const labDir = resolve(agentsRoot, ".lab");
  const agentDir = resolve(labDir, agentName);

  if (!existsSync(agentDir)) {
    throw new Error(`Agent "${agentName}" not found in .lab/`);
  }

  // Remove agent directory
  rmSync(agentDir, { recursive: true, force: true });

  // Remove memory state if persistDir is configured
  if (config.persistDir) {
    const memoryFile = resolve(config.persistDir, "memory", `${agentName}.jsonl`);
    if (existsSync(memoryFile)) {
      rmSync(memoryFile, { force: true });
    }
  }
}

/**
 * List all agents currently in the .lab/ sandbox.
 */
export function listLabAgents(agentsRoot: string): string[] {
  const labDir = resolve(agentsRoot, ".lab");
  if (!existsSync(labDir)) return [];

  const entries = readdirSync(labDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}
