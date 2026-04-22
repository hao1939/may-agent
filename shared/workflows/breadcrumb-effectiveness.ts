/// <reference path="../../../src/lib/workflow-defs.d.ts" />
/**
 * Breadcrumb Effectiveness Measurement
 * 
 * Queries session transcripts to measure how often agents follow breadcrumb
 * "Quick check" commands when metrics are breaching. This is the key metric
 * for the breadcrumb-gap project.
 * 
 * Usage: import { measureBreadcrumbEffectiveness } from "./breadcrumb-effectiveness.js";
 *        const results = measureBreadcrumbEffectiveness(db);
 */

interface BreadcrumbResult {
  agent: string;
  sessionId: string;
  metricId: string;
  breadcrumbType: "source_command" | "source_query";
  breadcrumbContent: string;
  followed: boolean;
  timestamp: number;
}

interface EffectivenessReport {
  totalBreachesWithBreadcrumbs: number;
  breadcrumbsFollowed: number;
  followRate: number;
  byAgent: Record<string, { total: number; followed: number; rate: number }>;
  details: BreadcrumbResult[];
}

/**
 * Analyze recent heartbeat sessions to see if agents followed breadcrumb hints.
 * 
 * A breadcrumb is "followed" if the session transcript contains evidence that
 * the agent ran the suggested command or query.
 */
export function measureBreadcrumbEffectiveness(db: any, lookbackHours = 72): EffectivenessReport {
  const cutoff = Date.now() - lookbackHours * 3600_000;
  
  // Get metrics with breadcrumbs (source_command or source_query)
  const metrics = db.prepare(`
    SELECT id, owner, source_command, source_query 
    FROM metrics 
    WHERE status = 'active' 
      AND (source_command IS NOT NULL OR source_query IS NOT NULL)
  `).all() as any[];
  
  // Get recent heartbeat sessions
  const sessions = db.prepare(`
    SELECT id, agent, transcript, created_at
    FROM sessions
    WHERE created_at > ?
      AND workflow LIKE '%heartbeat%'
    ORDER BY created_at DESC
  `).all(cutoff) as any[];
  
  const details: BreadcrumbResult[] = [];
  
  for (const session of sessions) {
    const transcript = session.transcript || "";
    
    for (const metric of metrics) {
      if (metric.owner !== session.agent) continue;
      
      // Check if this metric was breaching during this session
      // (look for the metric ID + "BELOW TARGET" in transcript context)
      if (!transcript.includes(metric.id) || !transcript.includes("BELOW TARGET")) continue;
      
      const breadcrumbType = metric.source_command ? "source_command" : "source_query";
      const breadcrumbContent = metric.source_command || metric.source_query;
      
      // Check if the breadcrumb was followed
      let followed = false;
      if (metric.source_command) {
        // Check if the command (or a significant part of it) appears in a bash tool call
        const cmdKey = metric.source_command.split(" ").slice(0, 3).join(" ");
        followed = transcript.includes(cmdKey);
      }
      if (metric.source_query) {
        // Check if the query (or table name from it) appears in the transcript
        const tableMatch = metric.source_query.match(/FROM\s+(\w+)/i);
        if (tableMatch) {
          followed = transcript.includes(tableMatch[1]);
        }
      }
      
      details.push({
        agent: session.agent,
        sessionId: session.id,
        metricId: metric.id,
        breadcrumbType,
        breadcrumbContent,
        followed,
        timestamp: session.created_at,
      });
    }
  }
  
  const totalBreachesWithBreadcrumbs = details.length;
  const breadcrumbsFollowed = details.filter(d => d.followed).length;
  
  const byAgent: Record<string, { total: number; followed: number; rate: number }> = {};
  for (const d of details) {
    if (!byAgent[d.agent]) byAgent[d.agent] = { total: 0, followed: 0, rate: 0 };
    byAgent[d.agent].total++;
    if (d.followed) byAgent[d.agent].followed++;
  }
  for (const a of Object.values(byAgent)) {
    a.rate = a.total > 0 ? a.followed / a.total : 0;
  }
  
  return {
    totalBreachesWithBreadcrumbs,
    breadcrumbsFollowed,
    followRate: totalBreachesWithBreadcrumbs > 0 ? breadcrumbsFollowed / totalBreachesWithBreadcrumbs : 0,
    byAgent,
    details,
  };
}
