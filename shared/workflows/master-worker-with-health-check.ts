/**
 * master-worker-with-health-check.ts — Master-worker orchestration with
 * health-check pre-flight. Runs checkHealth() before dispatching work,
 * skipping projects that are stalled or have critical issues.
 */

import {
  checkHealth,
  analyzeProject,
  isStalled,
  type ProjectHealth,
  type HealthReport,
} from "./health-check.js";

export interface DispatchConfig {
  projectPath: string;
  maxIterations: number;
  stalledThresholdMs?: number; // default 24h
  skipOnStalled?: boolean; // default true
  skipOnMissing?: boolean; // default true
  skipOnMalformed?: boolean; // default false — try anyway
}

export interface PreFlightResult {
  proceed: boolean;
  reason: string;
  health: ProjectHealth | null;
}

export interface IterationResult {
  iteration: number;
  success: boolean;
  output: string;
}

export interface WorkflowResult {
  preFlight: PreFlightResult;
  iterations: IterationResult[];
  totalIterations: number;
  aborted: boolean;
  abortReason?: string;
}

/**
 * Run health-check pre-flight for a single project.
 * Returns whether to proceed and the health details.
 */
export function runPreFlight(
  projectContent: string,
  journalContent: string | null,
  config: DispatchConfig,
  now: Date = new Date()
): PreFlightResult {
  const thresholdMs = config.stalledThresholdMs ?? 24 * 60 * 60 * 1000;
  const skipOnStalled = config.skipOnStalled ?? true;
  const skipOnMissing = config.skipOnMissing ?? true;
  const skipOnMalformed = config.skipOnMalformed ?? false;

  // If project content is empty/missing
  if (!projectContent || projectContent.trim() === "") {
    if (skipOnMissing) {
      return {
        proceed: false,
        reason: "Project content is missing or empty",
        health: null,
      };
    }
    return {
      proceed: true,
      reason: "Project content missing but skipOnMissing=false, proceeding",
      health: null,
    };
  }

  const health = analyzeProject(
    config.projectPath,
    projectContent,
    journalContent,
    now,
    thresholdMs
  );

  // Check stalled
  if (health.status === "stalled" && skipOnStalled) {
    return {
      proceed: false,
      reason: `Project is stalled — no activity in ${Math.round(thresholdMs / 3600000)}h`,
      health,
    };
  }

  // Check malformed
  if (health.status === "malformed" && skipOnMalformed) {
    return {
      proceed: false,
      reason: "Project has malformed project.md",
      health,
    };
  }

  // Check missing (analyzeProject detected missing)
  if (health.status === "missing" && skipOnMissing) {
    return {
      proceed: false,
      reason: "Project is missing",
      health,
    };
  }

  // Check for critical issues
  const criticalIssues = health.issues.filter(
    (i) => i.includes("critical") || i.includes("CRITICAL")
  );
  if (criticalIssues.length > 0) {
    return {
      proceed: false,
      reason: `Critical issues detected: ${criticalIssues.join("; ")}`,
      health,
    };
  }

  return {
    proceed: true,
    reason: `Health check passed (status: ${health.status}, ${health.metrics.length} metrics)`,
    health,
  };
}

/**
 * Simulate a worker iteration (in real system, this dispatches to LLM).
 */
export type WorkerFn = (
  iteration: number,
  projectPath: string
) => Promise<IterationResult>;

/**
 * Run the master-worker workflow with health-check pre-flight.
 */
export async function runWithHealthCheck(
  config: DispatchConfig,
  projectContent: string,
  journalContent: string | null,
  workerFn: WorkerFn,
  now: Date = new Date()
): Promise<WorkflowResult> {
  const preFlight = runPreFlight(projectContent, journalContent, config, now);

  if (!preFlight.proceed) {
    return {
      preFlight,
      iterations: [],
      totalIterations: 0,
      aborted: true,
      abortReason: preFlight.reason,
    };
  }

  const iterations: IterationResult[] = [];
  let aborted = false;
  let abortReason: string | undefined;

  for (let i = 1; i <= config.maxIterations; i++) {
    try {
      const result = await workerFn(i, config.projectPath);
      iterations.push(result);

      if (!result.success) {
        // Continue on failure — master-worker is resilient
        continue;
      }
    } catch (err: any) {
      iterations.push({
        iteration: i,
        success: false,
        output: `Error: ${err.message || String(err)}`,
      });
      // If 3 consecutive failures, abort
      const lastThree = iterations.slice(-3);
      if (lastThree.length === 3 && lastThree.every((r) => !r.success)) {
        aborted = true;
        abortReason = "3 consecutive failures — aborting";
        break;
      }
    }
  }

  return {
    preFlight,
    iterations,
    totalIterations: iterations.length,
    aborted,
    abortReason,
  };
}

/**
 * Check health of multiple projects and return which ones are dispatchable.
 */
export function filterDispatchable(
  projects: Array<{
    path: string;
    content: string;
    journal: string | null;
  }>,
  config: Omit<DispatchConfig, "projectPath">,
  now: Date = new Date()
): Array<{ path: string; preFlight: PreFlightResult }> {
  return projects.map((p) => ({
    path: p.path,
    preFlight: runPreFlight(p.content, p.journal, { ...config, projectPath: p.path }, now),
  }));
}
