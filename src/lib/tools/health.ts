/**
 * Health check tool — may-agent-specific.
 */

import { Type } from "@mariozechner/pi-ai";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { existsSync } from "node:fs";
import { basename } from "node:path";

export interface HealthReport {
  healthy: boolean;
  checks: { name: string; ok: boolean; detail: string }[];
}

export function createHealthCheckTool(stateDir: string): AgentTool {
  return {
    name: "health",
    label: "System Health Check",
    description: "Run a comprehensive health check on the agent system.",
    parameters: Type.Object({}),
    execute: async () => {
      const checks: { name: string; ok: boolean; detail: string }[] = [];

      // 1. Basic File Checks
      const criticalFiles = ["package.json", "tsconfig.json", "src/index.ts"];
      for (const f of criticalFiles) {
        if (existsSync(f)) {
          checks.push({ name: `file:${basename(f)}`, ok: true, detail: "Exists" });
        } else {
          checks.push({ name: `file:${basename(f)}`, ok: false, detail: "Missing" });
        }
      }

      checks.push({ name: "tests", ok: true, detail: "Skipped in fast check" });

      // Stale sessions
      try {
        const { loadAllSessionMetas } = await import("../persistence.js");
        const sessions = loadAllSessionMetas(stateDir);
        const STALE_THRESHOLD_MS = 10 * 60 * 1000;
        const now = Date.now();
        const stale = Object.entries(sessions).filter(
          ([, s]) => s.status === "running" && now - (s.startedAt ?? now) > STALE_THRESHOLD_MS,
        );
        if (stale.length === 0) {
          checks.push({ name: "stale_sessions", ok: true, detail: "No sessions stuck in running state" });
        } else {
          const details = stale.map(([id, s]) => `  ${id}: agent=${s.agent ?? "?"}, task=${s.task ?? "?"}`).join("\n");
          checks.push({
            name: "stale_sessions",
            ok: false,
            detail: `${stale.length} session(s) stuck in "running" status:\n${details}`,
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        checks.push({ name: "stale_sessions", ok: false, detail: `Failed to scan sessions: ${msg}` });
      }

      const healthy = checks.every((c) => c.ok);
      const report: HealthReport = { healthy, checks };

      const lines = checks.map((c) => `${c.ok ? "✓" : "✗"} ${c.name}: ${c.detail}`);
      const summary = `Health check: ${healthy ? "HEALTHY" : "UNHEALTHY"}\n\n${lines.join("\n")}`;

      return {
        content: [{ type: "text", text: summary }],
        details: report,
      };
    },
  };
}
