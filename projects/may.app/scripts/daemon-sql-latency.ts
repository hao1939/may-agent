import { connect } from "node:net";
import { resolve } from "node:path";

export const SQL_LATENCY_METRIC_ID = "may.daemon-sql-recent-worst-call-ms";
export const SQL_DIAGNOSTIC_MAX_AGE_MS = 10 * 60_000;
export const SQL_DIAGNOSTIC_NOTE_MAX_CHARS = 4_000;
export const SQL_DIAGNOSTIC_ENRICHMENT_THRESHOLD_MS = 1_000;
const MAX_RANKED_QUERIES = 6;
const MAX_PLAN_ROWS = 6;
const MAX_PLAN_DETAIL_CHARS = 200;
const MAX_SHAPE_CHARS = 300;

type RankedQuery = {
  id?: unknown;
  operation?: unknown;
  sql?: unknown;
  calls?: unknown;
  totalMs?: unknown;
  averageMs?: unknown;
  maxMs?: unknown;
  plan?: unknown;
};
type QueryWindow = {
  since?: unknown;
  until?: unknown;
  trackedQueries?: unknown;
  topByTotalTime?: unknown;
  topByWorstTime?: unknown;
};

type StatusResponse = Record<string, unknown>;

type DiagnosticField = {
  status: "available" | "unavailable" | "unsupported" | "error";
  observable?: boolean;
  ownerPid?: number;
  ownerKind?: string;
  journalMode?: string;
  walBytes?: number;
  frames?: number;
  busy?: boolean;
  mode?: string;
  logFrames?: number;
  checkpointedFrames?: number;
  lastAt?: number;
  reason?: "diagnostic read failed";
};

type RetainedQuery = {
  fingerprint: string;
  operation: string;
  shape: string;
  shapeTruncated: boolean;
  count: number;
  totalMs: number;
  averageMs: number;
  worstMs: number;
  window: { since: number; until: number };
  plan?: {
    fingerprint: string;
    capturedAt: number;
    rows: Array<{ id: number; parent: number; detail: string }>;
    rowsTruncated: boolean;
    textTruncated: boolean;
  };
  planUnavailable?: boolean;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function boundedString(value: unknown, limit = 160): string | undefined {
  return nonEmptyString(value) ? value.slice(0, limit) : undefined;
}

function diagnosticField(
  value: unknown,
  allowed: readonly string[],
): DiagnosticField {
  if (value === undefined) return { status: "unsupported" };
  if (value === null) return { status: "unavailable" };
  const source = record(value);
  const suppliedStatus = source.status;
  const recognizedStatus =
    suppliedStatus === "available" ||
    suppliedStatus === "unavailable" ||
    suppliedStatus === "unsupported" ||
    suppliedStatus === "error"
      ? suppliedStatus
      : undefined;
  const hasRecognizedValue = allowed.some((key) => source[key] !== undefined);
  const status =
    recognizedStatus ??
    (source.error !== undefined
      ? "error"
      : hasRecognizedValue
        ? "available"
        : "unavailable");
  const result: DiagnosticField = { status };
  for (const key of allowed) {
    const raw = source[key];
    if (key === "observable" || key === "busy") {
      if (typeof raw === "boolean")
        (result as Record<string, unknown>)[key] = raw;
    } else if (
      [
        "ownerPid",
        "walBytes",
        "frames",
        "logFrames",
        "checkpointedFrames",
        "lastAt",
      ].includes(key)
    ) {
      const number = finite(raw);
      if (number !== null) (result as Record<string, unknown>)[key] = number;
    } else {
      const text = boundedString(raw);
      if (text !== undefined) (result as Record<string, unknown>)[key] = text;
    }
  }
  if (status === "error") result.reason = "diagnostic read failed";
  return result;
}

function preferredDiagnostic(primary: unknown, fallback: unknown): unknown {
  return primary === undefined ? fallback : primary;
}

function diagnosticSnapshot(
  diagnostics: Record<string, unknown>,
  measuredAt: number,
) {
  const sql = record(diagnostics.sql);
  const sqlite = record(diagnostics.sqlite);
  return {
    capturedAt: measuredAt,
    source: "daemon-status",
    lockOwner: diagnosticField(
      preferredDiagnostic(sql.lockOwner, sqlite.lockOwner),
      ["observable", "ownerPid", "ownerKind"],
    ),
    wal: diagnosticField(preferredDiagnostic(sql.wal, sqlite.wal), [
      "journalMode",
      "walBytes",
      "frames",
      "busy",
    ]),
    checkpoint: diagnosticField(
      preferredDiagnostic(sql.checkpoint, sqlite.checkpoint),
      ["mode", "busy", "logFrames", "checkpointedFrames", "lastAt"],
    ),
  };
}

function rankedRows(window: QueryWindow): RankedQuery[] {
  return [window.topByTotalTime, window.topByWorstTime]
    .flatMap((rows) => (Array.isArray(rows) ? rows : []))
    .filter((row): row is RankedQuery =>
      Boolean(row && typeof row === "object"),
    );
}

function retainedPlan(
  row: RankedQuery,
  since: number,
  until: number,
): RetainedQuery["plan"] {
  const plan = record(row.plan);
  const capturedAt = finite(plan.capturedAt);
  if (
    plan.fingerprint !== row.id ||
    plan.shape !== row.sql ||
    capturedAt === null ||
    capturedAt < since ||
    capturedAt > until ||
    !Array.isArray(plan.rows)
  )
    return undefined;
  const rows: NonNullable<RetainedQuery["plan"]>["rows"] = [];
  for (const raw of plan.rows) {
    const value = record(raw);
    const id = finite(value.id);
    const parent = finite(value.parent);
    if (id === null || parent === null || typeof value.detail !== "string")
      return undefined;
    rows.push({ id, parent, detail: value.detail });
  }
  return {
    fingerprint: String(plan.fingerprint).slice(0, 80),
    capturedAt,
    rows,
    rowsTruncated: plan.rowsTruncated === true,
    textTruncated: false,
  };
}

function boundedPlan(
  plan: NonNullable<RetainedQuery["plan"]>,
): NonNullable<RetainedQuery["plan"]> {
  const rows = plan.rows.slice(0, MAX_PLAN_ROWS).map((row) => ({
    ...row,
    detail: row.detail.slice(0, MAX_PLAN_DETAIL_CHARS),
  }));
  return {
    ...plan,
    rows,
    rowsTruncated: plan.rowsTruncated || plan.rows.length > rows.length,
    textTruncated: plan.rows.some(
      (row) => row.detail.length > MAX_PLAN_DETAIL_CHARS,
    ),
  };
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
  const windows: Array<Record<string, unknown>> = [];
  for (const [name, rawWindow] of [
    ["current", sql.queries],
    ["previous", sql.previousQueries],
  ] as const) {
    if (rawWindow === undefined) continue;
    if (!rawWindow || typeof rawWindow !== "object" || Array.isArray(rawWindow))
      throw new Error(`SQL ${name} window is malformed`);
    const window = rawWindow as QueryWindow;
    const since = finite(window.since);
    const until = finite(window.until);
    if (since === null || until === null || since > until)
      throw new Error(`SQL ${name} window bounds are malformed`);
    const trackedQueries = finite(window.trackedQueries);
    if (trackedQueries === null)
      throw new Error(`SQL ${name} window trackedQueries is malformed`);
    if (until > now + 30_000 || now - until > SQL_DIAGNOSTIC_MAX_AGE_MS)
      continue;
    const rows = rankedRows(window);
    const rankedUniqueQueries = new Set(
      rows.map((row) => (nonEmptyString(row.id) ? row.id : Symbol())),
    ).size;
    windows.push({
      name,
      since,
      until,
      trackedQueries,
      rankedEntries: rows.length,
      rankedUniqueQueries,
      rankedCoverageTruncated: trackedQueries > rankedUniqueQueries,
    });
    for (const row of rows) {
      const count = finite(row.calls);
      const totalMs = finite(row.totalMs);
      const averageMs = finite(row.averageMs);
      const worstMs = finite(row.maxMs);
      if (
        !nonEmptyString(row.id) ||
        !nonEmptyString(row.operation) ||
        !nonEmptyString(row.sql) ||
        count === null ||
        count < 1 ||
        totalMs === null ||
        averageMs === null ||
        worstMs === null
      )
        throw new Error(`SQL ${name} ranking contains malformed data`);
      const plan = retainedPlan(row, since, until);
      candidates.push({
        fingerprint: row.id.slice(0, 80),
        operation: row.operation.slice(0, 32),
        shape: row.sql.slice(0, MAX_SHAPE_CHARS),
        shapeTruncated: row.sql.length > MAX_SHAPE_CHARS,
        count,
        totalMs,
        averageMs,
        worstMs,
        window: { since, until },
        ...(plan
          ? { plan }
          : row.plan === undefined
            ? {}
            : { planUnavailable: true }),
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
  const worst = [...rows].sort((a, b) => b.worstMs - a.worstMs)[0]!;
  // The scalar witness is mandatory; remaining bounded slots preserve top-total coverage.
  const selected: RetainedQuery[] = [worst];
  for (const query of [...rows].sort((a, b) => b.totalMs - a.totalMs)) {
    if (!selected.includes(query)) selected.push(query);
    if (selected.length === MAX_RANKED_QUERIES) break;
  }
  const value = worst.worstMs;
  const enriched = value >= SQL_DIAGNOSTIC_ENRICHMENT_THRESHOLD_MS;
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
      lifetimeUntrackedCalls: finite(record(sql.untracked).calls),
      windows,
      rankedUniqueQueries: rows.length,
      retainedQueries: selected.length,
      selectedRowsTruncated: rows.length > selected.length,
      shapeTextTruncated: rows.some((row) => row.shapeTruncated),
    },
    ...(enriched
      ? { diagnosticSnapshot: diagnosticSnapshot(diagnostics, measuredAt) }
      : {}),
    queries: selected.map((query) => {
      const { shapeTruncated: _shapeTruncated, ...retained } = query;
      return {
        ...retained,
        ...(query.plan
          ? {
              plan:
                enriched && query === worst
                  ? query.plan
                  : boundedPlan(query.plan),
            }
          : {}),
      };
    }),
  };
  let note = JSON.stringify(noteValue);
  while (note.length > SQL_DIAGNOSTIC_NOTE_MAX_CHARS && selected.length > 1) {
    selected.pop();
    noteValue.queries.pop();
    noteValue.coverage.retainedQueries = selected.length;
    noteValue.coverage.selectedRowsTruncated = true;
    note = JSON.stringify(noteValue);
  }
  const witness = noteValue.queries[0]!;
  if (!enriched) {
    while (
      note.length > SQL_DIAGNOSTIC_NOTE_MAX_CHARS &&
      witness.plan?.rows.length
    ) {
      witness.plan.rows.pop();
      witness.plan.rowsTruncated = true;
      note = JSON.stringify(noteValue);
    }
    if (note.length > SQL_DIAGNOSTIC_NOTE_MAX_CHARS)
      throw new Error(
        "Bounded SQL diagnostic evidence exceeds the public note limit",
      );
  }
  return { value, sampleSize: rows.length, measuredAt, note };
}

export function defaultControlSocket(): string {
  const configured = (value: string | undefined) => value?.trim() || "";
  const explicit = configured(process.env.MAY_CONTROL_SOCKET);
  if (explicit) return explicit;
  const persistDir = configured(process.env.MAY_PERSIST_DIR) || "/app/.state";
  const instance = configured(process.env.MAY_INSTANCE) || "background";
  const interfaceAgent = configured(process.env.MAY_INTERFACE_AGENT) || "may";
  return resolve(persistDir, "instances", instance, `${interfaceAgent}.sock`);
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
