/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { metricThresholdBreached } from "../../lib/metrics.js";
import { readAgentCapabilityRollups } from "../adapters/reporting/observability-summary.js";
import { listRuntimeAgentDirectories, resolveRuntimeAgentDirectory } from "@may-agent/sdk/runtime";
import type { SqliteDb } from "./read-model/state-db.js";

export function createAgentRouteHandlers(options: {
  stateDir: string;
  agentsRoot: string;
  sharedRoot: string;
  projectsRoot: string;
  getDb: () => SqliteDb;
  json: (data: unknown, status?: number) => Response;
  readProjects: () => Array<{ project: { owner: string; field: (key: string) => string | null | undefined } }>;
}) {
  const {
    stateDir: STATE_DIR,
    agentsRoot: AGENTS_ROOT,
    sharedRoot: SHARED_ROOT,
    projectsRoot: PROJECTS_ROOT,
    getDb: _db,
    json,
    readProjects,
  } = options;

  /**
   * GET /api/agents — list all configured agents with rollups for the
   * Agents tab card grid. One row per agent.
   */
  function handleAgents(): Response {
    try {
      const db = _db();
      const fourHourAgo = Date.now() - 4 * 60 * 60 * 1000;
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

      // 1. Discover agents from agents/ filesystem AND project-local agents (source of truth: agent.json).
      const agents: Array<Record<string, unknown>> = [];
      const seenAgentNames = new Set<string>();

      for (const entry of listRuntimeAgentDirectories(AGENTS_ROOT, PROJECTS_ROOT)) {
        let cfg: Record<string, any>;
        try {
          cfg = JSON.parse(readFileSync(join(entry.dir, "agent.json"), "utf8"));
        } catch {
          continue;
        }
        if (cfg.disabled) continue;
        const name = cfg.name || entry.name;
        if (seenAgentNames.has(name)) continue;
        seenAgentNames.add(name);
        agents.push({
          name,
          description: cfg.description || "",
          domain: cfg.domain || "",
          model: cfg.model || "",
          toolCount: Array.isArray(cfg.tools) ? cfg.tools.length : 0,
        });
      }

      // 2. Per-agent session/metric rollups (single query each, indexed on agent).
      for (const a of agents) {
        const name = a.name as string;

        // Sessions in 4h.
        const sess4h = db
          .prepare(
            `
          SELECT
            COUNT(*) as total,
            MAX(startedAt) as lastStart,
            SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
          FROM sessions WHERE agent = ? AND startedAt >= ?
        `,
          )
          .get(name, fourHourAgo) as any;
        a.sessions4h = sess4h?.total ?? 0;
        a.lastSessionAt = sess4h?.lastStart ?? null;
        a.errors4h = sess4h?.errors ?? 0;

        // Sessions in 24h (for context).
        const sess24h =
          (db.prepare(`SELECT COUNT(*) as c FROM sessions WHERE agent = ? AND startedAt >= ?`).get(name, dayAgo) as any)
            ?.c ?? 0;
        a.sessions24h = sess24h;

        // Owned metrics + breaches.
        const mets = db
          .prepare(
            `
          SELECT id, current, threshold, alert_op FROM metrics WHERE owner = ?
        `,
          )
          .all(name) as Array<{
          id: string;
          current: number | null;
          threshold: number | null;
          alert_op: string | null;
        }>;
        a.metricCount = mets.length;
        a.metricBreached = mets.filter((m) => {
          if (m.threshold == null || m.current == null) return false;
          return metricThresholdBreached({ current: m.current, threshold: m.threshold, alert_op: m.alert_op });
        }).length;
      }

      // 3. Count the same metadata records shown by the Projects page.
      const projByOwner: Record<string, { active: number; total: number }> = {};
      const hidden = new Set(["done", "complete", "closed", "waiting", "blocked", "paused"]);
      for (const { project } of readProjects()) {
        const owner = project.owner.replace(/^agent:/, "");
        const counts = (projByOwner[owner] ??= { active: 0, total: 0 });
        counts.total += 1;
        if (!hidden.has(project.field("status") ?? "unknown")) counts.active += 1;
      }
      const capabilityRollup = readAgentCapabilityRollups(db);
      for (const a of agents) {
        const counts = projByOwner[a.name as string] || { active: 0, total: 0 };
        a.projectsActive = counts.active;
        a.projectsTotal = counts.total;
        Object.assign(a, capabilityRollup(a.name as string));
      }

      // Sort: active first (recent session), then alphabetic.
      agents.sort((a: any, b: any) => {
        const aTime = a.lastSessionAt || 0;
        const bTime = b.lastSessionAt || 0;
        return bTime - aTime || String(a.name).localeCompare(String(b.name));
      });
      return json(agents);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  }

  /**
   * GET /api/agents/:name/about — returns what's actually in the agent's
   * head: the system-prompt-loaded files, separated from supplementary files
   * that exist on disk but aren't auto-injected.
   */
  function handleAgentAbout(agentName: string): Response {
    if (!agentName) return json({ error: "agent required" }, 400);
    const agentDir =
      resolveRuntimeAgentDirectory(AGENTS_ROOT, agentName, PROJECTS_ROOT)?.dir ?? join(AGENTS_ROOT, agentName);
    if (!existsSync(agentDir)) return json({ error: "agent not found" }, 404);
    let agentJson: Record<string, any> | null = null;
    try {
      const cfgPath = join(agentDir, "agent.json");
      if (existsSync(cfgPath)) agentJson = JSON.parse(readFileSync(cfgPath, "utf-8"));
    } catch {
      /* skip */
    }

    const readFile = (path: string, displayName: string, source: string) => {
      if (!existsSync(path)) return null;
      try {
        const content = readFileSync(path, "utf-8");
        return {
          name: displayName,
          path: path.replace(STATE_DIR + "/..", "").replace(/^\//, ""),
          content,
          bytes: content.length,
          source,
        };
      } catch {
        return null;
      }
    };

    const promptFiles: Array<Record<string, unknown>> = [];
    const otherFiles: Array<Record<string, unknown>> = [];

    // explicit systemPrompt overrides file-loading.
    if (agentJson && typeof agentJson.systemPrompt === "string") {
      promptFiles.push({
        name: "<inline systemPrompt>",
        path: `agents/${agentName}/agent.json#systemPrompt`,
        content: agentJson.systemPrompt,
        bytes: agentJson.systemPrompt.length,
        source: "agent.json",
      });
    } else {
      // Standard prompt assembly: shared defaults, then role-specific identity.
      const sharedPath = join(SHARED_ROOT, "common-sense.md");
      const sharedFile = readFile(sharedPath, "shared/common-sense.md", "manager.ts");
      if (sharedFile) promptFiles.push({ ...sharedFile, source: "shared (every agent)" });
      const agentsMd = readFile(join(agentDir, "AGENTS.md"), "AGENTS.md", "identity");
      if (agentsMd) promptFiles.push({ ...agentsMd, source: "agent identity (this agent)" });
    }

    // Other on-disk files (NOT in prompt). Useful for context but not auto-loaded.
    const otherCandidates = ["DOMAIN.md", "heartbeat.md", "context.md", "TOOLS.md", "LESSONS.md"];
    for (const f of otherCandidates) {
      const file = readFile(join(agentDir, f), f, "on-disk only");
      if (file) otherFiles.push(file);
    }

    return json({ name: agentName, agentJson, promptFiles, otherFiles });
  }

  return {
    handleAgents,
    handleAgentAbout,
  };
}
