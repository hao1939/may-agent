/**
 * Evaluation Aggregator — computes agent quality metrics
 * Used by optimizer to identify trends.
 */

export interface EvalRecord {
  agent: string;
  sessionId: string;
  quality: number;
  efficiency: number;
  verdict: string;
  issues: string[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    cost: number;
    turns: number;
  };
}

export interface AgentSummary {
  agent: string;
  totalSessions: number;
  meanQuality: number;
  meanEfficiency: number;
  recentTrend: "improving" | "declining" | "stable";
  topIssues: string[];
  totalCost: number;
}

/**
 * Compute summary for a single agent from their evaluations.
 */
export function computeAgentSummary(evals: EvalRecord[]): AgentSummary {
  if (evals.length === 0) {
    return {
      agent: "unknown",
      totalSessions: 0,
      meanQuality: 0,
      meanEfficiency: 0,
      recentTrend: "stable",
      topIssues: [],
      totalCost: 0,
    };
  }

  const agent = evals[0].agent;
  const totalSessions = evals.length;

  // Mean quality — correct
  const meanQuality = evals.reduce((sum, e) => sum + e.quality, 0) / totalSessions;

  // Mean efficiency — correct
  const meanEfficiency = evals.reduce((sum, e) => sum + e.efficiency, 0) / totalSessions;

  // Recent trend — sort by sessionId for chronological order before slicing
  const sorted = [...evals].sort((a, b) => a.sessionId.localeCompare(b.sessionId));
  const windowSize = Math.min(3, Math.floor(totalSessions / 2));
  const early = sorted.slice(0, windowSize);
  const recent = sorted.slice(-windowSize);

  const earlyMean = early.reduce((sum, e) => sum + e.quality, 0) / windowSize;
  const recentMean = recent.reduce((sum, e) => sum + e.quality, 0) / windowSize;

  let recentTrend: "improving" | "declining" | "stable";
  if (recentMean - earlyMean > 0.1) {
    recentTrend = "improving";
  } else if (earlyMean - recentMean > 0.1) {
    recentTrend = "declining";
  } else {
    recentTrend = "stable";
  }

  // Top issues — aggregate across all evals, count frequency by issue type
  const issueCounts = new Map<string, number>();
  for (const e of evals) {
    for (const issue of e.issues) {
      // Extract the issue TYPE from bracket prefix, e.g. "[WASTED_CALL]" from "[WASTED_CALL] read config.ts"
      const match = issue.match(/^\[([^\]]+)\]/);
      const issueType = match ? `[${match[1]}]` : issue;
      issueCounts.set(issueType, (issueCounts.get(issueType) || 0) + 1);
    }
  }

  const topIssues = [...issueCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([issue]) => issue);

  // Total cost
  const totalCost = evals.reduce((sum, e) => sum + e.usage.cost, 0);

  return {
    agent,
    totalSessions,
    meanQuality,
    meanEfficiency,
    recentTrend,
    topIssues,
    totalCost,
  };
}

/**
 * Find agents that need coaching intervention.
 * Returns agents with meanQuality < threshold on recent N sessions.
 */
export function findCoachingTargets(allEvals: EvalRecord[], threshold = 0.5, recentWindow = 10): AgentSummary[] {
  // Group by agent
  const byAgent = new Map<string, EvalRecord[]>();
  for (const e of allEvals) {
    if (!byAgent.has(e.agent)) byAgent.set(e.agent, []);
    byAgent.get(e.agent)!.push(e);
  }

  const targets: AgentSummary[] = [];

  for (const [, agentEvals] of byAgent) {
    // Take recent window — sort by sessionId for chronological order
    const sorted = agentEvals.sort((a, b) => a.sessionId.localeCompare(b.sessionId));
    const recent = sorted.slice(-recentWindow);
    const summary = computeAgentSummary(recent);

    if (summary.meanQuality < threshold) {
      targets.push(summary);
    }
  }

  // Sort by quality (worst first)
  targets.sort((a, b) => a.meanQuality - b.meanQuality);

  return targets;
}
