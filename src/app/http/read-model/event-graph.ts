import type { SqliteDb } from "./state-db.js";

type Row = Record<string, unknown>;

export type EventGraphOptions = {
  depth?: number;
  detail?: boolean;
};

export type EventGraphNode = {
  id: number;
  type: string;
  visibility: "default" | "detail";
  source?: string;
  owner?: string;
  timestamp: number;
  label: string;
  summary?: string;
  dataPreview?: Record<string, unknown>;
};

export type EventGraphEdge = {
  id: string;
  source: number;
  target: number;
  type: "parent" | "reference" | "closure";
  label?: string;
};

export type EventGraphResponse = {
  focusEventId: number;
  traceId?: string;
  nodes: EventGraphNode[];
  edges: EventGraphEdge[];
  diagnostics: string[];
};

function safeAll(db: SqliteDb, sql: string, ...params: unknown[]): Row[] {
  try {
    return db.prepare(sql).all(...params);
  } catch {
    return [];
  }
}

function safeGet(db: SqliteDb, sql: string, ...params: unknown[]): Row | null {
  try {
    return db.prepare(sql).get(...params);
  } catch {
    return null;
  }
}

function numberValue(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseData(row: Row | null | undefined): Record<string, unknown> {
  const raw = row?.data;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function compact(value: unknown, max = 180): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function previewValue(value: unknown): unknown {
  if (typeof value === "string") return compact(value, 160);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return `[${value.length} items]`;
  return undefined;
}

function previewData(data: Record<string, unknown>): Record<string, unknown> | undefined {
  const preferred = [
    "summary",
    "reason",
    "message",
    "status",
    "outcome",
    "projectId",
    "sessionId",
    "workflowRunId",
    "taskId",
    "attemptId",
    "metricId",
    "alertId",
    "escalationId",
  ];
  const out: Record<string, unknown> = {};
  for (const key of preferred) {
    const value = previewValue(data[key]);
    if (value !== undefined) out[key] = value;
  }
  for (const [key, value] of Object.entries(data)) {
    if (Object.keys(out).length >= 8) break;
    if (out[key] != null) continue;
    const preview = previewValue(value);
    if (preview !== undefined) out[key] = preview;
  }
  return Object.keys(out).length ? out : undefined;
}

function nodeFromRow(row: Row): EventGraphNode | null {
  const id = numberValue(row.id);
  const type = stringValue(row.event_type);
  const timestamp = numberValue(row.timestamp);
  if (!id || !type || timestamp == null) return null;
  const data = parseData(row);
  const summary =
    compact(data.summary) ??
    compact(data.reason) ??
    compact(data.message) ??
    compact(data.status) ??
    compact(data.outcome);
  const visibility = row.visibility === "detail" ? "detail" : "default";
  return {
    id,
    type,
    visibility,
    ...(stringValue(row.source) ? { source: stringValue(row.source) } : {}),
    ...(stringValue(row.owner) ? { owner: stringValue(row.owner) } : {}),
    timestamp,
    label: `${type} #${id}`,
    ...(summary ? { summary } : {}),
    ...(previewData(data) ? { dataPreview: previewData(data) } : {}),
  };
}

function edgeKey(edge: EventGraphEdge): string {
  return `${edge.type}:${edge.source}:${edge.target}:${edge.label ?? ""}`;
}

function addEdge(edges: Map<string, EventGraphEdge>, edge: Omit<EventGraphEdge, "id">): void {
  if (!Number.isFinite(edge.source) || !Number.isFinite(edge.target) || edge.source === edge.target) return;
  const withId = { ...edge, id: edgeKey(edge as EventGraphEdge) };
  edges.set(withId.id, withId);
}

function clampDepth(value: unknown): number {
  const depth = Number(value);
  if (!Number.isFinite(depth)) return 3;
  return Math.max(0, Math.min(12, Math.floor(depth)));
}

function visibleIdsFromDepth(focusEventId: number, edges: EventGraphEdge[], maxDepth: number): Set<number> {
  const adjacency = new Map<number, number[]>();
  for (const edge of edges) {
    const a = adjacency.get(edge.source) ?? [];
    a.push(edge.target);
    adjacency.set(edge.source, a);
    const b = adjacency.get(edge.target) ?? [];
    b.push(edge.source);
    adjacency.set(edge.target, b);
  }
  const visible = new Set<number>([focusEventId]);
  const queue: Array<{ id: number; depth: number }> = [{ id: focusEventId, depth: 0 }];
  while (queue.length) {
    const item = queue.shift()!;
    if (item.depth >= maxDepth) continue;
    for (const next of adjacency.get(item.id) ?? []) {
      if (visible.has(next)) continue;
      visible.add(next);
      queue.push({ id: next, depth: item.depth + 1 });
    }
  }
  return visible;
}

function loadTraceRows(db: SqliteDb, traceId: string): Row[] {
  return safeAll(
    db,
    `SELECT e.*, t.trace_id, t.parent_event_id, t.visibility
     FROM event_traces t
     JOIN events e ON e.id = t.event_id
     WHERE t.trace_id = ?
     ORDER BY e.timestamp ASC, e.id ASC
     LIMIT 500`,
    traceId,
  );
}

function loadFallbackPairRows(db: SqliteDb, focusEventId: number): { rows: Row[]; edges: EventGraphEdge[] } {
  const pairs = safeAll(
    db,
    `SELECT pair_name, open_event_id, close_event_id
     FROM event_pair_runs
     WHERE open_event_id = ? OR close_event_id = ?
     LIMIT 50`,
    focusEventId,
    focusEventId,
  );
  const ids = new Set<number>([focusEventId]);
  const edges = new Map<string, EventGraphEdge>();
  for (const pair of pairs) {
    const openEventId = numberValue(pair.open_event_id);
    const closeEventId = numberValue(pair.close_event_id);
    if (openEventId) ids.add(openEventId);
    if (closeEventId) ids.add(closeEventId);
    if (openEventId && closeEventId) {
      addEdge(edges, {
        source: openEventId,
        target: closeEventId,
        type: "closure",
        label: stringValue(pair.pair_name) ?? "event_pair",
      });
    }
  }
  const rows = [...ids].flatMap((id) => {
    const row = safeGet(db, "SELECT *, 'default' as visibility FROM events WHERE id = ?", id);
    return row ? [row] : [];
  });
  return { rows, edges: [...edges.values()] };
}

export function buildEventGraph(db: SqliteDb, focusEventId: number, options: EventGraphOptions = {}): EventGraphResponse {
  const diagnostics: string[] = [];
  const depth = clampDepth(options.depth);
  const includeDetail = options.detail === true;
  const focus = safeGet(db, "SELECT * FROM events WHERE id = ?", focusEventId);
  if (!focus) {
    return { focusEventId, nodes: [], edges: [], diagnostics: [`event ${focusEventId} not found`] };
  }

  const focusTrace = safeGet(db, "SELECT * FROM event_traces WHERE event_id = ?", focusEventId);
  const traceId = stringValue(focusTrace?.trace_id);
  const rowsById = new Map<number, Row>();
  const edges = new Map<string, EventGraphEdge>();

  if (traceId) {
    for (const row of loadTraceRows(db, traceId)) {
      const id = numberValue(row.id);
      if (id) rowsById.set(id, row);
      const parentEventId = numberValue(row.parent_event_id);
      if (id && parentEventId) {
        addEdge(edges, { source: parentEventId, target: id, type: "parent" });
      }
    }
    const traceEventIds = [...rowsById.keys()];
    if (traceEventIds.length) {
      const placeholders = traceEventIds.map(() => "?").join(",");
      const links = safeAll(
        db,
        `SELECT *
         FROM event_trace_links
         WHERE from_event_id IN (${placeholders})
            OR to_event_id IN (${placeholders})
         LIMIT 500`,
        ...traceEventIds,
        ...traceEventIds,
      );
      for (const link of links) {
        const from = numberValue(link.from_event_id);
        const to = numberValue(link.to_event_id);
        const type = link.type === "closure" ? "closure" : "reference";
        if (!from || !to) continue;
        addEdge(edges, { source: from, target: to, type, ...(stringValue(link.label) ? { label: stringValue(link.label) } : {}) });
        for (const id of [from, to]) {
          if (rowsById.has(id)) continue;
          const row = safeGet(
            db,
            `SELECT e.*, COALESCE(t.visibility, 'default') as visibility, t.trace_id, t.parent_event_id
             FROM events e
             LEFT JOIN event_traces t ON t.event_id = e.id
             WHERE e.id = ?`,
            id,
          );
          if (row) rowsById.set(id, row);
        }
      }
    }
  } else {
    diagnostics.push("event has no trace row; using lifecycle pair fallback");
  }

  if (rowsById.size <= 1) {
    const fallback = loadFallbackPairRows(db, focusEventId);
    for (const row of fallback.rows) {
      const id = numberValue(row.id);
      if (id) rowsById.set(id, row);
    }
    for (const edge of fallback.edges) edges.set(edge.id, edge);
    if (fallback.edges.length) diagnostics.push("graph includes event_pair_runs fallback edges");
  }

  if (!rowsById.has(focusEventId)) {
    rowsById.set(focusEventId, { ...focus, visibility: focusTrace?.visibility ?? "default", trace_id: traceId });
  }

  const allEdges = [...edges.values()];
  const visibleIds = visibleIdsFromDepth(focusEventId, allEdges, depth);
  const nodes = [...rowsById.values()]
    .map(nodeFromRow)
    .filter((node): node is EventGraphNode => !!node)
    .filter((node) => visibleIds.has(node.id))
    .filter((node) => includeDetail || node.visibility !== "detail")
    .sort((a, b) => a.timestamp - b.timestamp || a.id - b.id);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const visibleEdges = allEdges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .sort((a, b) => a.source - b.source || a.target - b.target || a.type.localeCompare(b.type));

  if (!nodes.some((node) => node.id === focusEventId)) {
    diagnostics.push("focus event is hidden by current detail filter");
  }

  return {
    focusEventId,
    ...(traceId ? { traceId } : {}),
    nodes,
    edges: visibleEdges,
    diagnostics,
  };
}
