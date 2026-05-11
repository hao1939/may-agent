import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { CronEntry } from "../../lib/cron-tool.js";

/**
 * Auto-generate heartbeat cron entries for agents that have a heartbeat
 * workflow but no explicit heartbeat entry in any cron.json.
 *
 * Convention: agents/<name>/workflows/<name>-heartbeat.ts exists -> auto-heartbeat.
 * Opt-out: "heartbeat": false in agent.json.
 */
export function generateAutoHeartbeats(agentsRoot: string): CronEntry[] {
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
      handler: "run-workflow",
      handlerConfig: {
        workflow: `${agentName}-heartbeat`,
        agent: agentName,
        task: `[heartbeat] You are ${agentName}. Read agents/${agentName}/heartbeat.md and work through each section. End with a brief of what you did.`,
        timeoutMs: 1_800_000,
      },
      offsetMs,
      on: ["heartbeat.trigger"],
    });
  }

  return generated;
}
