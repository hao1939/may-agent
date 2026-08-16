import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import type { CronEntry } from "../../lib/cron-tool.js";

/**
 * Auto-generate heartbeat cron entries for agents that have a heartbeat
 * workflow but no explicit heartbeat entry in any cron.json.
 *
 * Convention: agents/<name>/workflows/<name>-heartbeat.ts exists -> auto-heartbeat.
 * Opt-out: "heartbeat": false in agent.json.
 *
 * @param agentsRoot  The agents/ directory to scan
 * @param projectId   Optional App ID. When the agentsRoot belongs to a
 *   App (e.g. projects/scout-knowledge-lib.app/agents), pass the
 *   App ID so the heartbeat handler includes `projectId` and the SDK's
 *   `agentWorkflowDirForApp` can locate the workflow.
 */
export function generateAutoHeartbeats(agentsRoot: string, projectId?: string): CronEntry[] {
  const generated: CronEntry[] = [];
  const entries = readdirSync(agentsRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "shared" || entry.name.startsWith("_")) continue;

    const agentDir = resolve(agentsRoot, entry.name);
    const agentName = entry.name;

    const agentJsonPath = resolve(agentDir, "agent.json");
    if (!existsSync(agentJsonPath)) continue;

    try {
      const config = JSON.parse(readFileSync(agentJsonPath, "utf-8"));
      if (config.heartbeat === false) continue;
    } catch {
      continue;
    }

    const workflowPath = resolve(agentDir, "workflows", `${agentName}-heartbeat.ts`);
    if (!existsSync(workflowPath)) continue;

    const cronPath = resolve(agentDir, "cron.json");
    if (existsSync(cronPath)) {
      try {
        const cronEntries = JSON.parse(readFileSync(cronPath, "utf-8")) as CronEntry[];
        if (cronEntries.some((e) => e.name === `heartbeat-${agentName}` || e.name === "heartbeat")) continue;
      } catch {
        /* proceed */
      }
    }

    let hash = 0;
    for (let i = 0; i < agentName.length; i++) {
      hash = ((hash << 5) - hash + agentName.charCodeAt(i)) | 0;
    }
    const offsetMs = Math.abs(hash % 1_500_000) + 60_000;

    generated.push({
      name: `heartbeat-${agentName}`,
      intervalMs: 1_800_000,
      agent: agentName,
      message: `[heartbeat] ${agentName} heartbeat (auto-generated).`,
      enabled: true,
      description: `Auto-generated heartbeat for ${agentName}.`,
      handler: {
        workflow: `${agentName}-heartbeat`,
        agent: agentName,
        ...(projectId ? { projectId } : {}),
        task: `[heartbeat] You are ${agentName}. Read ${heartbeatPath(agentsRoot, agentName, projectId)} and work through each section. End with a brief of what you did.`,
        timeoutMs: 2_700_000, // 45 min — 1.5× interval to avoid timeout on long-tail sessions
      },
      offsetMs,
      on: ["heartbeat.trigger"],
    });
  }

  return generated;
}

function heartbeatPath(agentsRoot: string, agentName: string, projectId?: string): string {
  if (!projectId) return `agents/${agentName}/heartbeat.md`;

  const root = resolve(agentsRoot);
  const appDirName = basename(resolve(root, ".."));
  if (appDirName.endsWith(".app")) {
    return `projects/${appDirName}/agents/${agentName}/heartbeat.md`;
  }

  return `projects/${projectId}/agents/${agentName}/heartbeat.md`;
}
