import { connect } from "node:net";
import { resolve } from "node:path";

export const SQL_LATENCY_METRIC_ID = "may.daemon-sql-recent-worst-call-ms";
export const SQL_DIAGNOSTIC_MAX_AGE_MS = 10 * 60_000;
export const SQL_DIAGNOSTIC_NOTE_MAX_CHARS = 4_000;
const MAX_RANKED_QUERIES = 6;
const MAX_SHAPE_CHARS = 300;

type RankedQuery = {
  id?: unknown;
  operation?: unknown;
  sql?: unknown;
  calls?: unknown;
  totalMs?: unknown;
  averageMs?: unknown;
  maxMs?: unknown;
};
type QueryWindow = {
  since?: unknown;
  until?: unknown;
  trackedQueries?: unknown;
  topByTotalTime?: unknown;
  topByWorstTime?: unknown;
};

type StatusResponse = Record<string, unknown>;

type RetainedQuery = {
  fingerprint: string;
  operation: string;
  shape: string;
  count: number;
  totalMs: number;
  averageMs: number;
  worstMs: number;
  window: { since: number; until: number };
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function finite(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function rankedRows(window: QueryWindow): RankedQuery[] {
  return [window.topByTotalTime, window.topByWorstTime]
    .flatMap((rows) => (Array.isArray(rows) ? rows : []))
    .filter((row): row is RankedQuery =>
      Boolean(row && typeof row === "object"),
    );
}

/** Convert one existing diagnostic status response into one bounded public sample. */
export function sqlLatencySample(
  response: StatusResponse,
  now = Date.now(),
): { value: number; sampleSize: number; measuredAt: number; note: string } {
  const diagnostics = record(response.diagnostics);
  const sql = record(diagnostics.sql);
  const pid = finite(diagnostics.pid);
  const sqlSince = finite(sql.since);
  const measuredAt = finite(sql.measuredAt);
  if (pid === null || sqlSince === null || measuredAt === null)
    throw new Error("SQL diagnostics identity is unavailable");
  if (measuredAt > now + 30_000 || now - measuredAt > SQL_DIAGNOSTIC_MAX_AGE_MS)
    throw new Error("SQL diagnostics are stale");

  const candidates: RetainedQuery[] = [];
  for (const rawWindow of [sql.queries, sql.previousQueries]) {
    const window = record(rawWindow) as QueryWindow;
    const since = finite(window.since);
    const until = finite(window.until);
    if (
      since === null ||
      until === null ||
      since > until ||
      until > now + 30_000 ||
      now - until > SQL_DIAGNOSTIC_MAX_AGE_MS
    )
      continue;
    for (const row of rankedRows(window)) {
      const count = finite(row.calls);
      const totalMs = finite(row.totalMs);
      const averageMs = finite(row.averageMs);
      const worstMs = finite(row.maxMs);
      if (
        typeof row.id !== "string" ||
        typeof row.operation !== "string" ||
        typeof row.sql !== "string" ||
        count === null ||
        count < 1 ||
        totalMs === null ||
        averageMs === null ||
        worstMs === null
      )
        continue;
      candidates.push({
        fingerprint: row.id.slice(0, 80),
        operation: row.operation.slice(0, 32),
        shape: row.sql.slice(0, MAX_SHAPE_CHARS),
        count,
        totalMs,
        averageMs,
        worstMs,
        window: { since, until },
      });
    }
  }
  if (!candidates.length)
    throw new Error("Recent SQL query rankings are unavailable");

  const byIdentity = new Map<string, RetainedQuery>();
  for (const query of candidates) {
    const key = `${query.window.since}:${query.window.until}:${query.fingerprint}`;
    if (!byIdentity.has(key)) byIdentity.set(key, query);
  }
  const rows = [...byIdentity.values()];
  const selected: RetainedQuery[] = [];
  for (const query of [
    ...[...rows].sort((a, b) => b.totalMs - a.totalMs),
    ...[...rows].sort((a, b) => b.worstMs - a.worstMs),
  ]) {
    if (!selected.includes(query)) selected.push(query);
    if (selected.length === MAX_RANKED_QUERIES) break;
  }
  const value = Math.max(...rows.map((row) => row.worstMs));
  const noteValue = {
    scope:
      "Completed calls in the daemon shared SQLite adapter; workers, raw drivers and sleeps outside SQLite are excluded",
    pid,
    sqlSince,
    measuredAt,
    policy:
      "Recent current/previous five-minute rankings only; process-lifetime maxima do not define this incident",
    coverage: {
      queryLimit: finite(sql.queryLimit),
      untrackedCalls: finite(record(sql.untracked).calls),
      rankedQueries: rows.length,
      retainedQueries: selected.length,
      truncated: rows.length > selected.length,
    },
    queries: selected,
  };
  let note = JSON.stringify(noteValue);
  while (note.length > SQL_DIAGNOSTIC_NOTE_MAX_CHARS && selected.length > 1) {
    selected.pop();
    noteValue.coverage.retainedQueries = selected.length;
    noteValue.coverage.truncated = true;
    note = JSON.stringify(noteValue);
  }
  if (note.length > SQL_DIAGNOSTIC_NOTE_MAX_CHARS)
    throw new Error(
      "Bounded SQL diagnostic evidence exceeds the public note limit",
    );
  return { value, sampleSize: rows.length, measuredAt, note };
}

export function defaultControlSocket(): string {
  const stateDir =
    process.env.STATE_DIR || resolve(process.env.APP_ROOT || "/app", ".state");
  return (
    process.env.MAY_CONTROL_SOCKET ||
    resolve(stateDir, "instances/default/may.sock")
  );
}

export function readDiagnosticStatus(
  socketPath = defaultControlSocket(),
  timeoutMs = 5_000,
): Promise<StatusResponse> {
  return new Promise((resolveResponse, reject) => {
    const socket = connect(socketPath);
    let settled = false;
    let buffer = "";
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      action();
    };
    const timer = setTimeout(
      () =>
        finish(() => reject(new Error("Daemon diagnostic status timed out"))),
      timeoutMs,
    );
    socket.setEncoding("utf8");
    socket.on("connect", () =>
      socket.write(
        `${JSON.stringify({ type: "status", diagnostics: true })}\n`,
      ),
    );
    socket.on("error", (error) => finish(() => reject(error)));
    socket.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        try {
          const response = JSON.parse(line) as StatusResponse;
          if (response.type === "status" && response.command === "status") {
            finish(() => resolveResponse(response));
            return;
          }
        } catch {
          // Ignore connected frames and malformed unrelated output.
        }
      }
    });
    socket.on("close", () =>
      finish(() =>
        reject(new Error("Daemon diagnostic status closed before a response")),
      ),
    );
  });
}

if (import.meta.main) {
  const response = await readDiagnosticStatus();
  console.log(JSON.stringify(sqlLatencySample(response)));
}
