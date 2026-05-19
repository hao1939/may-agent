/**
 * growth — Agent forking/promotion utilities.
 *
 * App-only helpers for the coach agent's training-sprint and growth-cycle
 * workflows. Not part of @may-agent/sdk because forking, promoting, and
 * discarding agents are operations on the host filesystem layout that
 * belong to the app, not the SDK.
 *
 * Imported directly by:
 *   - agents/coach/workflows/growth-cycle.ts
 *   - agents/coach/workflows/training-sprint.ts
 *   - shared/tests/growth.test.ts
 */

import { existsSync, mkdirSync, cpSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface GrowthConfig {
  agentsRoot: string;
}

export interface ForkResult {
  forkName: string;
  copiedFrom: string;
  files: string[];
}

export interface PromoteResult {
  promoted: string[];
}

export function forkAgent(
  config: GrowthConfig,
  agentName: string,
  forkName?: string,
): ForkResult {
  const src = join(config.agentsRoot, agentName);
  const name = forkName ?? `${agentName}-fork-${Date.now()}`;
  const dest = join(config.agentsRoot, ".lab", name);

  if (!existsSync(src)) {
    throw new Error(`Agent "${agentName}" not found at ${src}`);
  }

  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });

  const files = readdirSync(dest);
  return { forkName: name, copiedFrom: agentName, files };
}

export function promoteAgent(
  config: GrowthConfig,
  forkName: string,
  targetName: string,
): PromoteResult {
  const src = join(config.agentsRoot, ".lab", forkName);
  const dest = join(config.agentsRoot, targetName);

  if (!existsSync(src)) {
    throw new Error(`Fork "${forkName}" not found at ${src}`);
  }

  // Copy fork files to target
  cpSync(src, dest, { recursive: true });
  const promoted = readdirSync(dest);
  return { promoted };
}

export function discardAgent(config: GrowthConfig, forkName: string): void {
  const dir = join(config.agentsRoot, ".lab", forkName);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function listLabAgents(config: GrowthConfig): string[] {
  const labDir = join(config.agentsRoot, ".lab");
  if (!existsSync(labDir)) return [];
  return readdirSync(labDir).filter((name) => {
    const p = join(labDir, name);
    return existsSync(join(p, "SOUL.md")) || existsSync(join(p, "AGENTS.md")) || existsSync(join(p, "heartbeat.md"));
  });
}
