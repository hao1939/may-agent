import type { PublicCommand, SubjectEvidence } from "./public-task-evidence.js";
import { hostReportUrl } from "./host-reporting.js";

export const POPULATION_WINDOW_MS = 86_400_000;
export const populationCut = (now = Date.now()) =>
  Math.floor(now / POPULATION_WINDOW_MS) * POPULATION_WINDOW_MS;

/** Public Host reporting endpoint; kept separate from the daemon's Task reads. */
export async function readPublicAttempts(
  input: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams();
  for (const key of ["appId", "taskId", "attemptId", "end", "windowMs"])
    if (input[key] !== undefined) params.set(key, String(input[key]));
  const timeout = AbortSignal.timeout(5_000);
  const response = await fetch(hostReportUrl(`/api/task-attempts?${params}`), {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    redirect: "error",
  });
  if (!response.ok)
    throw new Error(`Task attempt report unavailable (${response.status})`);
  const body = await response.text();
  if (Buffer.byteLength(body) > 1_000_000)
    throw new Error("Task attempt report exceeds byte limit");
  return JSON.parse(body);
}

export async function readPopulation(
  command: PublicCommand,
  appId: string,
  end: number,
  taskId?: string,
) {
  const report = await command({
    type: "task.attempts.read",
    appId,
    ...(taskId ? { taskId } : {}),
    end,
    windowMs: POPULATION_WINDOW_MS,
  });
  if (
    report.version !== 1 ||
    report.available !== true ||
    report.appId !== appId ||
    report.end !== end ||
    report.windowMs !== POPULATION_WINDOW_MS ||
    report.taskId !== (taskId ?? null) ||
    !report.previous ||
    !report.current
  )
    throw new Error("Population report identity or coverage unavailable");
  return report;
}

export function populationEvidence(
  subject: SubjectEvidence,
): Record<string, any> {
  return (subject.task?.population ?? {}) as Record<string, any>;
}

/** Numeric rows come from Host counts; the agent does not calculate denominators. */
export function renderPopulation(population: Record<string, any>): string {
  if (!population.available)
    return population.reason
      ? `Population evidence unavailable: ${population.reason}\n`
      : "";
  const rows: string[] = [];
  for (const name of ["previous", "current"]) {
    const cohort = population[name];
    for (const [scope, counts] of [
      ["App", cohort.totals],
      ["Exact Task", cohort.task],
      ["Other Tasks", cohort.otherTasks],
      ...(cohort.byHandler ?? []).map((entry: any) => [
        String(entry.handler).replaceAll("|", "/"),
        entry,
      ]),
    ] as Array<[string, any]>) {
      if (!counts) continue;
      rows.push(
        `| ${name} | ${scope} | ${counts.terminal} | ${counts.failed} | ${counts.interrupted} | ${counts.failurePercent ?? "no activity"} | ${counts.failedWallMs ?? "unknown"} | ${counts.undatedTerminal ?? 0} | ${counts.failedDurationUnknown ?? 0} |`,
      );
    }
  }
  return `## App attempt observations\n\nCut: ${new Date(population.end).toISOString()}; two adjacent 24-hour started-at cohorts.\nTotal terminal = completed + failed + interrupted. Failed is a subset.\n\n| Window | Scope | Terminal attempts | Failed | Interrupted | Failed % | Failed wall ms | Undated terminal | Unknown failed durations |\n| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n${rows.join("\n")}\n\nRecorded wall time does not establish avoidable cost. Cause, output quality and recovery of other inputs remain unassessed.\n`;
}
