/**
 * health-check.ts — Automated health check for satellite projects.
 * Reads project.md files, extracts metrics, compares to targets,
 * and returns structured status reports.
 */

export interface MetricInfo {
  name: string;
  current: string;
  target: string;
  atTarget: boolean;
}

export interface ProjectHealth {
  name: string;
  status: "healthy" | "stalled" | "regressing" | "missing" | "malformed";
  metrics: MetricInfo[];
  lastActivity: string | null;
  issues: string[];
}

export interface HealthReport {
  timestamp: string;
  projects: ProjectHealth[];
  summary: {
    total: number;
    healthy: number;
    stalled: number;
    regressing: number;
    missing: number;
    malformed: number;
  };
}

/**
 * Parse metrics from a project.md content string.
 * Expects lines like: `| metric-name | current-value | target-value |`
 */
export function parseMetrics(content: string): MetricInfo[] {
  const metrics: MetricInfo[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    // Match table rows: | name | current | target |
    const match = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
    if (!match) continue;

    const name = match[1].trim();
    const current = match[2].trim();
    const target = match[3].trim();

    // Skip header rows and separator rows
    if (name === "Metric" || name === "metric" || name === "---" || name.startsWith("-")) continue;
    if (current === "---" || current.startsWith("-")) continue;

    metrics.push({
      name,
      current,
      target,
      atTarget: isAtTarget(current, target),
    });
  }

  return metrics;
}

/**
 * Determine if a metric's current value meets its target.
 * Handles numeric comparisons (≥ target), fraction comparisons, and string equality.
 */
export function isAtTarget(current: string, target: string): boolean {
  if (!current || !target) return false;

  // Normalize: remove leading/trailing whitespace
  current = current.trim();
  target = target.trim();

  // Direct string match
  if (current === target) return true;

  // Handle "X/Y" fraction format — current numerator >= target numerator
  const currentFrac = current.match(/^(\d+)\s*\/\s*(\d+)$/);
  const targetFrac = target.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (currentFrac && targetFrac) {
    return parseInt(currentFrac[1]) >= parseInt(targetFrac[1]);
  }

  // Handle percentage: "85%" >= "80%"
  const currentPct = current.match(/^([\d.]+)%$/);
  const targetPct = target.match(/^([\d.]+)%$/);
  if (currentPct && targetPct) {
    return parseFloat(currentPct[1]) >= parseFloat(targetPct[1]);
  }

  // Handle "≥X" target format
  const gteMatch = target.match(/^[≥>=]+\s*([\d.]+)/);
  if (gteMatch) {
    const num = parseFloat(current);
    if (!isNaN(num)) return num >= parseFloat(gteMatch[1]);
  }

  // Plain numeric comparison
  const currentNum = parseFloat(current);
  const targetNum = parseFloat(target);
  if (!isNaN(currentNum) && !isNaN(targetNum)) {
    return currentNum >= targetNum;
  }

  return false;
}

/**
 * Extract the last activity timestamp from journal content.
 * Looks for ISO dates or "## Iteration" headers with timestamps.
 */
export function extractLastActivity(journalContent: string): string | null {
  if (!journalContent || !journalContent.trim()) return null;

  // Match ISO timestamps or common date patterns
  const datePatterns = [
    /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\s]*)/g,
    /(\d{4}-\d{2}-\d{2} \d{2}:\d{2})/g,
    /(\d{4}-\d{2}-\d{2})/g,
  ];

  let latest: string | null = null;

  for (const pattern of datePatterns) {
    let match;
    while ((match = pattern.exec(journalContent)) !== null) {
      const found = match[1];
      if (!latest || found > latest) {
        latest = found;
      }
    }
    if (latest) break; // Use most specific pattern that matches
  }

  return latest;
}

/**
 * Determine if a project is stalled based on last activity.
 * Stalled = no activity in the given threshold (default 24 hours).
 */
export function isStalled(lastActivity: string | null, now: Date, thresholdMs: number = 24 * 60 * 60 * 1000): boolean {
  if (!lastActivity) return true; // No activity at all = stalled

  try {
    const lastDate = new Date(lastActivity);
    if (isNaN(lastDate.getTime())) return true;
    return (now.getTime() - lastDate.getTime()) > thresholdMs;
  } catch {
    return true;
  }
}

/**
 * Analyze a single project's health from its project.md and journal.md content.
 */
export function analyzeProject(
  name: string,
  projectContent: string | null,
  journalContent: string | null,
  now: Date = new Date(),
  stallThresholdMs: number = 24 * 60 * 60 * 1000
): ProjectHealth {
  if (projectContent === null) {
    return { name, status: "missing", metrics: [], lastActivity: null, issues: ["project.md not found"] };
  }

  if (!projectContent.trim()) {
    return { name, status: "malformed", metrics: [], lastActivity: null, issues: ["project.md is empty"] };
  }

  const metrics = parseMetrics(projectContent);
  const lastActivity = extractLastActivity(journalContent || "");
  const issues: string[] = [];

  if (metrics.length === 0) {
    issues.push("No metrics found in project.md");
  }

  const stalled = isStalled(lastActivity, now, stallThresholdMs);
  if (stalled) {
    issues.push(lastActivity ? `No activity since ${lastActivity}` : "No activity timestamps found");
  }

  const metricsAtTarget = metrics.filter(m => m.atTarget).length;
  const totalMetrics = metrics.length;

  let status: ProjectHealth["status"];
  if (stalled && totalMetrics > 0 && metricsAtTarget < totalMetrics) {
    status = "stalled";
  } else if (totalMetrics > 0 && metricsAtTarget === totalMetrics) {
    status = "healthy";
  } else if (totalMetrics > 0 && metricsAtTarget < totalMetrics && !stalled) {
    status = "healthy"; // Active but not all at target yet — still healthy
  } else if (totalMetrics === 0) {
    status = "malformed";
    if (!issues.includes("No metrics found in project.md")) {
      issues.push("No metrics found in project.md");
    }
  } else {
    status = "healthy";
  }

  return { name, status, metrics, lastActivity, issues };
}

/**
 * Run health check across multiple projects.
 * Takes a reader function to abstract filesystem access.
 */
export function checkHealth(
  projects: { name: string; projectContent: string | null; journalContent: string | null }[],
  now: Date = new Date(),
  stallThresholdMs: number = 24 * 60 * 60 * 1000
): HealthReport {
  const results = projects.map(p => analyzeProject(p.name, p.projectContent, p.journalContent, now, stallThresholdMs));

  return {
    timestamp: now.toISOString(),
    projects: results,
    summary: {
      total: results.length,
      healthy: results.filter(p => p.status === "healthy").length,
      stalled: results.filter(p => p.status === "stalled").length,
      regressing: results.filter(p => p.status === "regressing").length,
      missing: results.filter(p => p.status === "missing").length,
      malformed: results.filter(p => p.status === "malformed").length,
    },
  };
}
