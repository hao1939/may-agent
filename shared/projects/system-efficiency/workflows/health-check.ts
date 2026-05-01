interface Metric {
  name: string;
  current: string;
  target: string;
  atTarget: boolean;
}

export function parseMetrics(content: string): Metric[] {
  const lines = content.split("\n").filter(l => l.includes("|"));
  const results: Metric[] = [];
  for (const line of lines) {
    const cells = line.split("|").map(c => c.trim()).filter(Boolean);
    if (cells.length < 3) continue;
    if (cells[0].toLowerCase() === "metric" || cells[0] === "---" || cells[0].startsWith("-")) continue;
    const name = cells[0], current = cells[1], target = cells[2];
    results.push({ name, current, target, atTarget: isAtTarget(current, target) });
  }
  return results;
}

export function isAtTarget(current: string, target: string): boolean {
  if (!current || !target) return false;
  if (current === target) return true;

  // Handle ≥X format
  const geqMatch = target.match(/^[≥>=](\d+)/);
  const tVal = geqMatch ? parseFloat(geqMatch[1]) : null;

  // Handle percentage
  if (current.endsWith("%") && target.endsWith("%")) {
    return parseFloat(current) >= parseFloat(target);
  }
  if (current.endsWith("%") || target.endsWith("%")) {
    if (geqMatch) return parseFloat(current) >= tVal!;
  }

  // Handle fraction
  const fracRe = /^(\d+)\/(\d+)$/;
  const cFrac = current.match(fracRe), tFrac = target.match(fracRe);
  if (cFrac && tFrac) {
    return parseInt(cFrac[1]) / parseInt(cFrac[2]) >= parseInt(tFrac[1]) / parseInt(tFrac[2]);
  }

  // Handle numeric
  const cNum = parseFloat(current), tNum = geqMatch ? tVal! : parseFloat(target);
  if (!isNaN(cNum) && !isNaN(tNum!)) return cNum >= tNum!;

  return false;
}

export function extractLastActivity(content: string): string | null {
  if (!content) return null;
  const isoRe = /\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}Z)?/g;
  const matches = content.match(isoRe);
  if (!matches || matches.length === 0) return null;
  // Return the latest
  return matches.sort().pop()!;
}

const DEFAULT_STALE_MS = 48 * 60 * 60 * 1000; // 48 hours

export function isStalled(lastActivity: string | null, now: Date, threshold: number = DEFAULT_STALE_MS): boolean {
  if (!lastActivity) return true;
  const d = new Date(lastActivity);
  if (isNaN(d.getTime())) return true;
  return now.getTime() - d.getTime() > threshold;
}

interface ProjectAnalysis {
  name: string;
  status: "healthy" | "stalled" | "missing" | "malformed";
  metrics: Metric[];
  issues: string[];
}

export function analyzeProject(name: string, projectContent: string | null, journalContent: string | null, now: Date): ProjectAnalysis {
  if (projectContent === null) return { name, status: "missing", metrics: [], issues: ["No project.md found"] };
  if (projectContent === "") return { name, status: "malformed", metrics: [], issues: ["Empty project.md"] };

  const metrics = parseMetrics(projectContent);
  const allAtTarget = metrics.length > 0 && metrics.every(m => m.atTarget);
  const lastActivity = extractLastActivity(journalContent || "");
  const stalled = isStalled(lastActivity, now);
  const issues: string[] = [];

  if (stalled) issues.push("No recent activity");
  if (!allAtTarget) issues.push("Metrics not at target");

  const status = !stalled && (allAtTarget || metrics.length === 0) ? "healthy" : "stalled";
  return { name, status, metrics, issues };
}

interface HealthReport {
  timestamp: string;
  projects: ProjectAnalysis[];
  summary: { total: number; healthy: number; stalled: number; missing: number; malformed: number };
}

export function checkHealth(projects: { name: string; projectContent: string | null; journalContent: string | null }[], now: Date): HealthReport {
  const analyses = projects.map(p => analyzeProject(p.name, p.projectContent, p.journalContent, now));
  return {
    timestamp: now.toISOString(),
    projects: analyses,
    summary: {
      total: analyses.length,
      healthy: analyses.filter(a => a.status === "healthy").length,
      stalled: analyses.filter(a => a.status === "stalled").length,
      missing: analyses.filter(a => a.status === "missing").length,
      malformed: analyses.filter(a => a.status === "malformed").length,
    },
  };
}
