import { createHash } from "node:crypto";
import type { SqliteDb } from "./state-db.js";

type Row = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

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
  provenance: "persisted" | "lifecycle" | "correlation";
  declaredByEventId?: number;
};

export type EventGraphDisplayNode = {
  key: string;
  kind:
    | "event"
    | "session"
    | "workflow"
    | "turn"
    | "tool_call"
    | "tool_result"
    | "metric"
    | "notification"
    | "diagnostic"
    | "more";
  role?: "primary" | "detail" | "diagnostic";
  parentKey?: string;
  level?: number;
  visibility: "default" | "detail";
  eventId?: number;
  sessionId?: string;
  workflowRunId?: string;
  turnIndex?: number;
  toolCallId?: string;
  timestamp?: number;
  type?: string;
  label: string;
  summary?: string;
  dataPreview?: Record<string, unknown>;
  refs?: Record<string, string | number | boolean | null>;
  order?: number;
};

export type EventGraphDisplayEdge = {
  key: string;
  sourceKey: string;
  targetKey: string;
  kind: "flow" | "reference" | "closure" | "detail" | "sequence" | "tool_call" | "tool_result";
  label?: string;
  provenance: "persisted" | "lifecycle" | "correlation" | "projection" | "transcript";
  declaredByEventId?: number;
};

export type EventGraphResponse = {
  focusEventId: number;
  traceId?: string;
  revision: string;
  nodes: EventGraphDisplayNode[];
  edges: EventGraphDisplayEdge[];
  eventNodes: EventGraphNode[];
  eventEdges: EventGraphEdge[];
  frontiers?: EventGraphFrontier[];
  eventList?: EventGraphNode[];
  eventListScope?: {
    kind: "session" | "workflow" | "task" | "graph";
    ids: string[];
    label: string;
  };
  diagnostics: string[];
  detailNodeCount?: number;
  review?: EventReview;
};

export type EventGraphFrontier = {
  key: string;
  id: string;
  kind: "more";
  anchorEventId: number;
  parentEventId: number;
  direction: "before" | "after" | "context" | "details";
  scope: "trace" | "workflow" | "task" | "session" | "metric" | "owner";
  count: number;
  hiddenCount: number;
  label: string;
  nodes: EventGraphDisplayNode[];
  edges: EventGraphDisplayEdge[];
  eventNodes: EventGraphNode[];
  eventEdges: EventGraphEdge[];
};

export type EventReviewLifecycle = {
  kind: string;
  id: string;
  status: "closed" | "open" | "orphan" | "overdue" | "unknown";
  relation?: "focused" | "same-workflow" | "same-task" | "related";
  owner?: string;
  openEventId?: number;
  closeEventId?: number;
  openType?: string;
  closeType?: string;
  openedAt?: number;
  expectedCloseAt?: number;
  closedAt?: number;
  summary?: string;
  issues?: string[];
};

export type EventGraphTranscript = {
  sessionId?: string;
  source?: string;
  messages?: Array<Record<string, unknown>>;
};

export type EventReview = {
  verdict: {
    status: "healthy" | "warning" | "failed" | "orphaned" | "unknown";
    text: string;
  };
  focus: {
    id: number;
    type: string;
    title: string;
  };
  lifecycles: EventReviewLifecycle[];
  relationKeys: Array<{ kind: string; value: string }>;
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

function eventTitle(type: string): string {
  if (type === "session.start") return "Session started";
  if (type === "session.end") return "Session ended";
  if (type === "session.completed") return "Session completed";
  if (type === "project.task.assigned") return "Task assigned";
  if (type === "project.task.completed") return "Task completed";
  if (type === "project.task.reviewed") return "Task reviewed";
  if (type === "workflow.started") return "Workflow started";
  if (type === "workflow.completed") return "Workflow completed";
  if (type === "workflow.failed") return "Workflow failed";
  if (type === "escalation.created") return "Escalation opened";
  if (type === "escalation.resolved") return "Escalation resolved";
  if (type === "escalation.dismissed") return "Escalation dismissed";
  if (type === "metric.breach") return "Metric breach";
  return type;
}

function defaultVisibilityForType(type: string | undefined): "default" | "detail" {
  if (!type) return "default";
  if (type === "session.start" || type === "session.end") return "default";
  if (type.startsWith("project.task.")) return "default";
  if (type.startsWith("workflow.")) return "default";
  if (type.startsWith("escalation.")) return "default";
  if (type === "metric.breach") return "default";
  if (type.startsWith("cli.task.")) return "default";
  return "detail";
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

function eventNodeKey(eventId: number): string {
  return `event:${eventId}`;
}

function nodeKindForEventType(type: string | undefined): EventGraphDisplayNode["kind"] {
  if (!type) return "event";
  if (type.startsWith("session.")) return "session";
  if (type.startsWith("workflow.") || type.startsWith("handler.workflow_")) return "workflow";
  if (type.startsWith("metric.")) return "metric";
  if (type.startsWith("message.") || type.startsWith("human.") || type.startsWith("telegram.")) return "notification";
  if (type.includes("skipped") || type.includes("guard") || type.includes("orphan")) return "diagnostic";
  return "event";
}

function displayNodeFromEventNode(
  node: EventGraphNode,
  options: { parentKey?: string; level?: number; role?: EventGraphDisplayNode["role"] } = {},
): EventGraphDisplayNode {
  const sessionId = stringValue(node.dataPreview?.sessionId) ?? stringValue(node.dataPreview?.session_id);
  const workflowRunId = stringValue(node.dataPreview?.workflowRunId) ?? stringValue(node.dataPreview?.workflow_run_id);
  const kind = nodeKindForEventType(node.type);
  const role = options.role ?? (kind === "diagnostic" ? "diagnostic" : options.parentKey ? "detail" : "primary");
  return {
    key: eventNodeKey(node.id),
    kind,
    role,
    ...(options.parentKey ? { parentKey: options.parentKey } : {}),
    level: options.level ?? (options.parentKey ? 1 : 0),
    visibility: options.parentKey ? "detail" : node.visibility,
    eventId: node.id,
    ...(sessionId ? { sessionId } : {}),
    ...(workflowRunId ? { workflowRunId } : {}),
    timestamp: node.timestamp,
    type: node.type,
    label: node.label,
    ...(node.summary ? { summary: node.summary } : {}),
    ...(node.dataPreview ? { dataPreview: node.dataPreview } : {}),
    refs: {
      eventId: node.id,
      ...(sessionId ? { sessionId } : {}),
      ...(workflowRunId ? { workflowRunId } : {}),
    },
  };
}

function displayEdgeKey(edge: Omit<EventGraphDisplayEdge, "key">): string {
  return `${edge.kind}:${edge.sourceKey}:${edge.targetKey}:${edge.label ?? ""}`;
}

function displayEdgeFromEventEdge(edge: EventGraphEdge): EventGraphDisplayEdge {
  const kind: EventGraphDisplayEdge["kind"] =
    edge.type === "closure" ? "closure" : edge.type === "reference" ? "reference" : "flow";
  const sourceKey = eventNodeKey(edge.source);
  const targetKey = eventNodeKey(edge.target);
  return {
    key: displayEdgeKey({ sourceKey, targetKey, kind, label: edge.label, provenance: edge.provenance }),
    sourceKey,
    targetKey,
    kind,
    ...(edge.label ? { label: edge.label } : {}),
    provenance: edge.provenance,
    ...(edge.declaredByEventId ? { declaredByEventId: edge.declaredByEventId } : {}),
  };
}

function edgeKey(edge: EventGraphEdge): string {
  return `${edge.type}:${edge.source}:${edge.target}`;
}

function addEdge(edges: Map<string, EventGraphEdge>, edge: Omit<EventGraphEdge, "id">): void {
  if (!Number.isFinite(edge.source) || !Number.isFinite(edge.target) || edge.source === edge.target) return;
  const withId = { ...edge, id: edgeKey(edge as EventGraphEdge) };
  const existing = edges.get(withId.id);
  const rank = { correlation: 0, lifecycle: 1, persisted: 2 } as const;
  if (!existing || rank[withId.provenance] > rank[existing.provenance]) edges.set(withId.id, withId);
}

type RelationKey = { kind: string; value: string };

function addRelationKey(keys: Map<string, RelationKey>, kind: string, value: unknown): void {
  const text = stringValue(value);
  if (!text) return;
  keys.set(`${kind}:${text}`, { kind, value: text });
}

function dataValue(data: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = stringValue(data[key]);
    if (value) return value;
  }
  return undefined;
}

function relationKeysFromData(data: Record<string, unknown>): RelationKey[] {
  const keys = new Map<string, RelationKey>();
  const sessionId = dataValue(data, ["sessionId", "session_id"]);
  const workflowRunId = dataValue(data, ["workflowRunId", "workflow_run_id"]);
  const taskId = dataValue(data, ["taskId", "task_id"]);
  const attemptId = dataValue(data, ["attemptId", "attempt_id"]);
  addRelationKey(keys, "session", sessionId);
  addRelationKey(keys, "sourceSession", dataValue(data, ["sourceSessionId", "source_session_id"]));
  addRelationKey(keys, "workflow", workflowRunId);
  addRelationKey(keys, "task", taskId);
  addRelationKey(keys, "attempt", attemptId);
  addRelationKey(keys, "escalation", dataValue(data, ["escalationId", "escalation_id"]));
  addRelationKey(keys, "metric", dataValue(data, ["metricId", "metric_id"]));
  addRelationKey(keys, "alert", dataValue(data, ["alertId", "alert_id"]));
  if (taskId && attemptId) addRelationKey(keys, "pair", `${taskId}:${attemptId}`);
  return [...keys.values()];
}

function mergeRelationKeys(rows: Row[]): RelationKey[] {
  const keys = new Map<string, RelationKey>();
  for (const row of rows) {
    for (const key of relationKeysFromData(parseData(row))) {
      keys.set(`${key.kind}:${key.value}`, key);
    }
  }
  return [...keys.values()];
}

function rowWithVisibility(row: Row): Row {
  return {
    ...row,
    visibility: row.visibility === "detail" ? "detail" : defaultVisibilityForType(stringValue(row.event_type)),
  };
}

function addRowsByCorrelation(db: SqliteDb, rowsById: Map<number, Row>, relationKeys: RelationKey[]): void {
  const fields: Record<string, string[]> = {
    session: ["$.sessionId", "$.session_id"],
    workflow: ["$.workflowRunId", "$.workflow_run_id"],
    task: ["$.taskId", "$.task_id"],
    attempt: ["$.attemptId", "$.attempt_id"],
    escalation: ["$.escalationId", "$.escalation_id"],
    metric: ["$.metricId", "$.metric_id"],
    alert: ["$.alertId", "$.alert_id"],
  };
  const conditions: string[] = [];
  const params: string[] = [];
  for (const [kind, paths] of Object.entries(fields)) {
    const values = relationKeys.filter((key) => key.kind === kind).map((key) => key.value);
    if (!values.length) continue;
    const placeholders = values.map(() => "?").join(",");
    for (const path of paths) {
      conditions.push(`json_extract(e.data, '${path}') IN (${placeholders})`);
      params.push(...values);
    }
  }
  if (!conditions.length) return;
  const rows = safeAll(
    db,
    `SELECT e.*, COALESCE(t.visibility, 'default') as visibility, t.trace_id, t.parent_event_id
     FROM events e
     LEFT JOIN event_traces t ON t.event_id = e.id
     WHERE json_valid(e.data)
       AND (${conditions.join(" OR ")})
     ORDER BY e.timestamp ASC, e.id ASC
     LIMIT 120`,
    ...params,
  );
  for (const row of rows) {
    const id = numberValue(row.id);
    if (!id || rowsById.has(id)) continue;
    rowsById.set(id, rowWithVisibility(row));
  }
}

function loadRowsByIds(db: SqliteDb, rowsById: Map<number, Row>, ids: number[]): void {
  const missing = [...new Set(ids)].filter((id) => id && !rowsById.has(id));
  if (!missing.length) return;
  const placeholders = missing.map(() => "?").join(",");
  const rows = safeAll(
    db,
    `SELECT e.*, COALESCE(t.visibility, 'default') as visibility, t.trace_id, t.parent_event_id
     FROM events e
     LEFT JOIN event_traces t ON t.event_id = e.id
     WHERE e.id IN (${placeholders})`,
    ...missing,
  );
  for (const row of rows) {
    const id = numberValue(row.id);
    if (id) rowsById.set(id, rowWithVisibility(row));
  }
}

function loadRelatedPairs(db: SqliteDb, eventIds: number[], relationKeys: RelationKey[]): Row[] {
  const ids = [...new Set(eventIds)].filter((id) => Number.isFinite(id) && id > 0);
  const pairKeys = relationKeys
    .filter((key) => ["session", "workflow", "task", "pair", "escalation", "alert"].includes(key.kind))
    .map((key) => key.value);
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(",");
    clauses.push(`p.open_event_id IN (${placeholders})`);
    params.push(...ids);
    clauses.push(`p.close_event_id IN (${placeholders})`);
    params.push(...ids);
  }
  if (pairKeys.length) {
    const placeholders = pairKeys.map(() => "?").join(",");
    clauses.push(`p.correlation_key IN (${placeholders})`);
    params.push(...pairKeys);
  }
  if (!clauses.length) return [];
  return safeAll(
    db,
    `SELECT p.*, oe.event_type as open_type, ce.event_type as close_type
     FROM event_pair_runs p
     LEFT JOIN events oe ON oe.id = p.open_event_id
     LEFT JOIN events ce ON ce.id = p.close_event_id
     WHERE ${clauses.join(" OR ")}
     ORDER BY p.opened_at ASC, p.id ASC
     LIMIT 80`,
    ...params,
  );
}

function addPairEdges(edges: Map<string, EventGraphEdge>, pairs: Row[]): void {
  for (const pair of pairs) {
    const openEventId = numberValue(pair.open_event_id);
    const closeEventId = numberValue(pair.close_event_id);
    if (!openEventId || !closeEventId) continue;
    addEdge(edges, {
      source: openEventId,
      target: closeEventId,
      type: "closure",
      label: stringValue(pair.pair_name) ?? "lifecycle",
      provenance: "lifecycle",
    });
  }
}

function addCorrelationEdges(edges: Map<string, EventGraphEdge>, rows: Row[]): void {
  const bySession = new Map<string, Row[]>();
  const byTask = new Map<string, Row[]>();
  const byWorkflow = new Map<string, Row[]>();
  for (const row of rows) {
    const data = parseData(row);
    const sessionId = dataValue(data, ["sessionId", "session_id", "sourceSessionId"]);
    const taskId = dataValue(data, ["taskId", "task_id"]);
    const workflowRunId = dataValue(data, ["workflowRunId", "workflow_run_id"]);
    if (sessionId) bySession.set(sessionId, [...(bySession.get(sessionId) ?? []), row]);
    if (taskId) byTask.set(taskId, [...(byTask.get(taskId) ?? []), row]);
    if (workflowRunId) byWorkflow.set(workflowRunId, [...(byWorkflow.get(workflowRunId) ?? []), row]);
  }
  for (const rowsForSession of bySession.values()) {
    const assigned = rowsForSession.find((row) => row.event_type === "project.task.assigned");
    const start = rowsForSession.find((row) => row.event_type === "session.start");
    const end = rowsForSession.find((row) => row.event_type === "session.end");
    const completed = rowsForSession.find((row) => row.event_type === "project.task.completed");
    const sessionCompleted = rowsForSession.find((row) => row.event_type === "session.completed");
    const assignedId = numberValue(assigned?.id);
    const startId = numberValue(start?.id);
    const endId = numberValue(end?.id);
    const completedId = numberValue(completed?.id);
    const sessionCompletedId = numberValue(sessionCompleted?.id);
    if (startId && endId) addEdge(edges, { source: startId, target: endId, type: "closure", label: "session", provenance: "correlation" });
    if (assignedId && startId) addEdge(edges, { source: assignedId, target: startId, type: "reference", label: "session", provenance: "correlation" });
    if (endId && completedId) addEdge(edges, { source: endId, target: completedId, type: "reference", label: "result", provenance: "correlation" });
    if (endId && sessionCompletedId) {
      addEdge(edges, { source: endId, target: sessionCompletedId, type: "reference", label: "completed", provenance: "correlation" });
    }
  }
  for (const rowsForTask of byTask.values()) {
    const completed = rowsForTask.find((row) => row.event_type === "project.task.completed");
    const reviewed = rowsForTask.find((row) => row.event_type === "project.task.reviewed");
    const completedId = numberValue(completed?.id);
    const reviewedId = numberValue(reviewed?.id);
    if (completedId && reviewedId) addEdge(edges, { source: completedId, target: reviewedId, type: "reference", label: "review", provenance: "correlation" });
  }
  for (const rowsForWorkflow of byWorkflow.values()) {
    const starts = rowsForWorkflow
      .filter((row) => row.event_type === "session.start")
      .sort((a, b) =>
        (numberValue(a.timestamp) ?? 0) - (numberValue(b.timestamp) ?? 0) ||
        (numberValue(a.id) ?? 0) - (numberValue(b.id) ?? 0)
      );
    for (let index = 0; index < starts.length - 1; index++) {
      const currentStart = starts[index];
      const nextStart = starts[index + 1];
      const currentSessionId = dataValue(parseData(currentStart), ["sessionId", "session_id"]);
      const currentEnd = rowsForWorkflow.find((row) => row.event_type === "session.end" && dataValue(parseData(row), ["sessionId", "session_id"]) === currentSessionId);
      const source = numberValue(currentEnd?.id) ?? numberValue(currentStart.id);
      const target = numberValue(nextStart.id);
      if (source && target) addEdge(edges, { source, target, type: "reference", label: "same workflow", provenance: "correlation" });
    }
  }
}

function normalizeEdgesForReview(edges: EventGraphEdge[], rowsById: Map<number, Row>): EventGraphEdge[] {
  const timestamp = (eventId: number) => numberValue(rowsById.get(eventId)?.timestamp) ?? 0;
  const eventOrder = (eventId: number) => [timestamp(eventId), eventId] as const;
  const isAfter = (source: number, target: number): boolean => {
    const [sourceTime, sourceId] = eventOrder(source);
    const [targetTime, targetId] = eventOrder(target);
    return sourceTime > targetTime || (sourceTime === targetTime && sourceId > targetId);
  };
  const hasClosure = new Set(edges.filter((edge) => edge.type === "closure").map((edge) => `${edge.source}:${edge.target}`));
  const persistedRelations = new Set(
    edges.filter((edge) => edge.provenance === "persisted").map((edge) => `${edge.source}:${edge.target}`),
  );
  return edges.filter((edge) => {
    if (edge.type === "closure" && isAfter(edge.source, edge.target) && hasClosure.has(`${edge.target}:${edge.source}`)) {
      return false;
    }
    if (edge.type === "parent" && hasClosure.has(`${edge.source}:${edge.target}`)) {
      return false;
    }
    if (edge.provenance === "correlation" && persistedRelations.has(`${edge.source}:${edge.target}`)) {
      return false;
    }
    return true;
  });
}

function isDefaultContextEdge(edge: EventGraphEdge): boolean {
  return edge.type === "reference" && edge.label === "same workflow";
}

function eventIdFromTraceId(traceId: string | undefined): number | undefined {
  const match = traceId?.match(/^event:(\d+)$/);
  return match ? numberValue(match[1]) : undefined;
}

function parentPathIds(focusEventId: number, edges: EventGraphEdge[], rowsById: Map<number, Row>): number[] {
  const parentByChild = new Map<number, EventGraphEdge[]>();
  for (const edge of edges) {
    if (edge.type !== "parent") continue;
    parentByChild.set(edge.target, [...(parentByChild.get(edge.target) ?? []), edge]);
  }
  const path: number[] = [];
  const seen = new Set<number>();
  let current = focusEventId;
  while (Number.isFinite(current) && !seen.has(current)) {
    seen.add(current);
    path.push(current);
    const parents = parentByChild.get(current) ?? [];
    if (!parents.length) break;
    parents.sort((a, b) => {
      const aTime = numberValue(rowsById.get(a.source)?.timestamp) ?? 0;
      const bTime = numberValue(rowsById.get(b.source)?.timestamp) ?? 0;
      return aTime - bTime || a.source - b.source;
    });
    current = parents[0].source;
  }
  return path.reverse();
}

function visibleIdsForDefaultScope(
  focusEventId: number,
  edges: EventGraphEdge[],
  depth: number,
  rowsById: Map<number, Row>,
  traceId: string | undefined,
): Set<number> {
  const visible = visibleIdsFromDepth(focusEventId, edges, depth);
  const rootEventId = eventIdFromTraceId(traceId);
  if (rootEventId && rowsById.has(rootEventId)) visible.add(rootEventId);
  for (const id of parentPathIds(focusEventId, edges, rowsById)) visible.add(id);
  return visible;
}

function moreNodeScope(edge: EventGraphEdge): EventGraphFrontier["scope"] {
  if (edge.label === "same workflow") return "workflow";
  if (edge.label === "session") return "session";
  if (edge.label === "review" || edge.label === "result" || edge.label === "project.task") return "task";
  if (edge.label === "metric" || edge.label === "metric.breach") return "metric";
  return "trace";
}

function moreNodeDirection(edge: EventGraphEdge, visibleId: number, hiddenNode: EventGraphNode): EventGraphFrontier["direction"] {
  if (isDefaultContextEdge(edge)) return "context";
  if (hiddenNode.visibility === "detail") return "details";
  if (edge.type === "parent" && edge.source === hiddenNode.id && edge.target === visibleId) return "before";
  if (edge.type === "closure" || edge.type === "reference") {
    if (edge.source === hiddenNode.id && edge.target === visibleId) return "before";
  }
  return "after";
}

function moreNodeLabel(
  direction: EventGraphFrontier["direction"],
  scope: EventGraphFrontier["scope"],
  count: number,
): string {
  const plural = count === 1 ? "" : "s";
  if (direction === "context" && scope === "workflow") return `... ${count} same-workflow session${plural}`;
  if (direction === "before") return `... ${count} earlier event${plural}`;
  if (direction === "details") return `... ${count} detail event${plural}`;
  if (direction === "context") return `... ${count} related ${scope} event${plural}`;
  return `... ${count} later event${plural}`;
}

function buildFrontiers(
  allNodes: EventGraphNode[],
  allEdges: EventGraphEdge[],
  visibleIds: Set<number>,
): EventGraphFrontier[] {
  const nodeById = new Map(allNodes.map((node) => [node.id, node]));
  const adjacency = new Map<number, number[]>();
  for (const edge of allEdges) {
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
    adjacency.set(edge.target, [...(adjacency.get(edge.target) ?? []), edge.source]);
  }
  const byKey = new Map<string, {
    parentEventId: number;
    direction: EventGraphFrontier["direction"];
    scope: EventGraphFrontier["scope"];
    nodes: Map<number, EventGraphNode>;
  }>();

  for (const edge of allEdges) {
    const sourceVisible = visibleIds.has(edge.source);
    const targetVisible = visibleIds.has(edge.target);
    if (sourceVisible === targetVisible) continue;
    const parentEventId = sourceVisible ? edge.source : edge.target;
    const hiddenEventId = sourceVisible ? edge.target : edge.source;
    const hiddenNode = nodeById.get(hiddenEventId);
    if (!hiddenNode) continue;
    const direction = moreNodeDirection(edge, parentEventId, hiddenNode);
    const scope = moreNodeScope(edge);
    const key = `more:${scope}:${direction}:${parentEventId}`;
    const bucket = byKey.get(key) ?? {
      parentEventId,
      direction,
      scope,
      nodes: new Map<number, EventGraphNode>(),
    };
    bucket.nodes.set(hiddenEventId, hiddenNode);
    byKey.set(key, bucket);
  }

  return [...byKey.entries()]
    .sort(([, a], [, b]) => a.parentEventId - b.parentEventId || a.direction.localeCompare(b.direction) || a.scope.localeCompare(b.scope))
    .map(([key, bucket]) => {
      const hiddenIds = new Set<number>(bucket.nodes.keys());
      const queue = [...hiddenIds];
      while (queue.length) {
        const current = queue.shift()!;
        for (const next of adjacency.get(current) ?? []) {
          if (visibleIds.has(next) || hiddenIds.has(next) || !nodeById.has(next)) continue;
          hiddenIds.add(next);
          queue.push(next);
        }
      }
      const eventNodes = [...hiddenIds]
        .flatMap((id) => nodeById.get(id) ? [nodeById.get(id)!] : [])
        .sort((a, b) => a.timestamp - b.timestamp || a.id - b.id);
      const eventEdges = allEdges.filter((edge) =>
        (hiddenIds.has(edge.source) && hiddenIds.has(edge.target)) ||
        (edge.source === bucket.parentEventId && hiddenIds.has(edge.target)) ||
        (edge.target === bucket.parentEventId && hiddenIds.has(edge.source))
      );
      const display = buildDisplayGraph(bucket.parentEventId, eventNodes, eventEdges, eventNodes);
      const workflowSessionCount = bucket.scope === "workflow"
        ? new Set(eventNodes.map((node) => stringValue(node.dataPreview?.sessionId)).filter(Boolean)).size
        : 0;
      const count = workflowSessionCount || eventNodes.length;
      return {
        key,
        id: key,
        kind: "more" as const,
        anchorEventId: bucket.parentEventId,
        parentEventId: bucket.parentEventId,
        direction: bucket.direction,
        scope: bucket.scope,
        count,
        hiddenCount: count,
        label: moreNodeLabel(bucket.direction, bucket.scope, count),
        nodes: display.displayNodes,
        edges: display.displayEdges,
        eventNodes,
        eventEdges,
      };
    });
}

function clampDepth(value: unknown): number {
  const depth = Number(value);
  if (!Number.isFinite(depth)) return 1;
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

function lifecycleStatus(pair: Row, now = Date.now()): EventReviewLifecycle["status"] {
  const status = stringValue(pair.status);
  if (status === "closed") return "closed";
  if (status === "orphan") return "orphan";
  const expected = numberValue(pair.expected_close_at);
  if ((status === "open" || !status) && expected && expected < now) return "overdue";
  if (status === "open") return "open";
  return "unknown";
}

function rowSummary(row: Row | undefined): string | undefined {
  if (!row) return undefined;
  const data = parseData(row);
  return compact(data.summary, 220) ??
    compact(data.reason, 220) ??
    compact(data.message, 220) ??
    compact(data.status, 120) ??
    compact(data.outcome, 120);
}

function buildReviewLifecycle(pair: Row, rowsById: Map<number, Row>): EventReviewLifecycle | null {
  const kind = stringValue(pair.pair_name);
  const id = stringValue(pair.correlation_key);
  if (!kind || !id) return null;
  const openEventId = numberValue(pair.open_event_id);
  const closeEventId = numberValue(pair.close_event_id);
  const status = lifecycleStatus(pair);
  const issues: string[] = [];
  if (status === "orphan") issues.push("Expected close event was not recorded before the lifecycle became orphaned.");
  if (status === "overdue") issues.push("Expected close event is overdue.");
  if (status === "open") issues.push("Lifecycle is still open.");
  return {
    kind,
    id,
    status,
    ...(stringValue(pair.owner) ? { owner: stringValue(pair.owner) } : {}),
    ...(openEventId ? { openEventId } : {}),
    ...(closeEventId ? { closeEventId } : {}),
    ...(stringValue(pair.open_type) ? { openType: stringValue(pair.open_type) } : {}),
    ...(stringValue(pair.close_type) ? { closeType: stringValue(pair.close_type) } : {}),
    ...(numberValue(pair.opened_at) ? { openedAt: numberValue(pair.opened_at) } : {}),
    ...(numberValue(pair.expected_close_at) ? { expectedCloseAt: numberValue(pair.expected_close_at) } : {}),
    ...(numberValue(pair.closed_at) ? { closedAt: numberValue(pair.closed_at) } : {}),
    ...(rowSummary(closeEventId ? rowsById.get(closeEventId) : undefined) ? { summary: rowSummary(closeEventId ? rowsById.get(closeEventId) : undefined) } : {}),
    ...(issues.length ? { issues } : {}),
  };
}

function lifecyclePriority(kind: string): number {
  if (kind === "project.task") return 0;
  if (kind === "workflow") return 1;
  if (kind === "session") return 2;
  if (kind === "escalation") return 3;
  if (kind === "owner_inbox") return 4;
  return 5;
}

function dedupeLifecycles(lifecycles: EventReviewLifecycle[]): EventReviewLifecycle[] {
  const byKey = new Map<string, EventReviewLifecycle>();
  for (const lifecycle of lifecycles) {
    const key = `${lifecycle.kind}:${lifecycle.id}:${lifecycle.closeEventId ?? ""}`;
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, lifecycle);
      continue;
    }
    const lifecycleIsRequested = String(lifecycle.openType || "").endsWith(".requested");
    const currentIsRequested = String(current.openType || "").endsWith(".requested");
    if (lifecycleIsRequested && !currentIsRequested) {
      byKey.set(key, lifecycle);
      continue;
    }
    if (!currentIsRequested && (lifecycle.openedAt ?? Number.MAX_SAFE_INTEGER) < (current.openedAt ?? Number.MAX_SAFE_INTEGER)) {
      byKey.set(key, lifecycle);
    }
  }
  return [...byKey.values()];
}

function focusLifecycle(focusEventId: number, lifecycles: EventReviewLifecycle[]): EventReviewLifecycle | undefined {
  return lifecycles.find((lifecycle) => lifecycle.openEventId === focusEventId || lifecycle.closeEventId === focusEventId) ??
    lifecycles[0];
}

function lifecycleRowValues(lifecycle: EventReviewLifecycle, rowsById: Map<number, Row>, keys: string[]): string[] {
  const values = new Set<string>();
  for (const eventId of [lifecycle.openEventId, lifecycle.closeEventId]) {
    if (!eventId) continue;
    const value = dataValue(parseData(rowsById.get(eventId)), keys);
    if (value) values.add(value);
  }
  return [...values];
}

function markLifecycleRelations(
  lifecycles: EventReviewLifecycle[],
  focusEventId: number,
  focus: Row,
  rowsById: Map<number, Row>,
): EventReviewLifecycle[] {
  const focusData = parseData(focus);
  const focusSessionId = dataValue(focusData, ["sessionId", "session_id"]);
  const focusWorkflowRunId = dataValue(focusData, ["workflowRunId", "workflow_run_id"]);
  const focusTaskId = dataValue(focusData, ["taskId", "task_id"]);
  return lifecycles.map((lifecycle) => {
    let relation: EventReviewLifecycle["relation"] = "related";
    const lifecycleSessionIds = lifecycleRowValues(lifecycle, rowsById, ["sessionId", "session_id"]);
    const lifecycleWorkflowRunIds = lifecycleRowValues(lifecycle, rowsById, ["workflowRunId", "workflow_run_id"]);
    const lifecycleTaskIds = lifecycleRowValues(lifecycle, rowsById, ["taskId", "task_id"]);
    if (
      lifecycle.openEventId === focusEventId ||
      lifecycle.closeEventId === focusEventId ||
      (focusSessionId && lifecycle.kind === "session" && lifecycle.id === focusSessionId) ||
      (focusTaskId && lifecycle.kind === "project.task" && (lifecycle.id === focusTaskId || lifecycle.id.startsWith(`${focusTaskId}:`)))
    ) {
      relation = "focused";
    } else if (focusTaskId && lifecycleTaskIds.includes(focusTaskId)) {
      relation = "same-task";
    } else if (focusWorkflowRunId && lifecycleWorkflowRunIds.includes(focusWorkflowRunId)) {
      relation = "same-workflow";
    }
    return { ...lifecycle, relation };
  });
}

function hasFailedSession(rows: Row[]): boolean {
  return rows.some((row) => {
    if (row.event_type !== "session.end") return false;
    const data = parseData(row);
    const status = String(data.status ?? data.outcome ?? "").toLowerCase();
    return ["error", "failed", "fail", "rejected"].includes(status);
  });
}

function buildVerdict(focusEventId: number, lifecycles: EventReviewLifecycle[], rows: Row[]): EventReview["verdict"] {
  const orphan = lifecycles.find((lifecycle) => lifecycle.status === "orphan");
  if (orphan) {
    if (orphan.kind === "owner_inbox") {
      return {
        status: "orphaned",
        text: `Owner inbox item for ${eventTitle(orphan.openType ?? "event")} is orphaned; ${orphan.owner ?? "the owner"} has not acknowledged it.`,
      };
    }
    return {
      status: "orphaned",
      text: `${eventTitle(orphan.openType ?? orphan.kind)} is orphaned; no ${orphan.closeType ?? "close event"} was recorded.`,
    };
  }
  const overdue = lifecycles.find((lifecycle) => lifecycle.status === "overdue");
  if (overdue) {
    return {
      status: "warning",
      text: `${eventTitle(overdue.openType ?? overdue.kind)} is overdue; expected ${overdue.closeType ?? "a close event"}.`,
    };
  }
  if (hasFailedSession(rows)) {
    return { status: "failed", text: "A related session ended with failure." };
  }
  const open = lifecycles.find((lifecycle) => lifecycle.status === "open");
  if (open) {
    if (open.kind === "escalation") return { status: "warning", text: "Escalation is still open." };
    if (open.kind === "owner_inbox") {
      return {
        status: "warning",
        text: `Owner inbox item for ${eventTitle(open.openType ?? "event")} is still open.`,
      };
    }
    return {
      status: "warning",
      text: `${eventTitle(open.openType ?? open.kind)} is still open.`,
    };
  }
  const primary = focusLifecycle(focusEventId, lifecycles);
  const hasTask = lifecycles.some((lifecycle) => lifecycle.kind === "project.task" && lifecycle.status === "closed");
  const hasSession = lifecycles.some((lifecycle) => lifecycle.kind === "session" && lifecycle.status === "closed");
  if (hasTask && hasSession) return { status: "healthy", text: "Task completed and the worker session completed." };
  if (primary?.kind === "session" && primary.status === "closed") return { status: "healthy", text: "Session completed." };
  if (primary?.status === "closed") return { status: "healthy", text: `${eventTitle(primary.closeType ?? primary.kind)} closed the lifecycle.` };
  return { status: "unknown", text: "No complete lifecycle verdict is available for this event yet." };
}

function buildEventReview(
  focusEventId: number,
  focus: Row,
  rowsById: Map<number, Row>,
  pairs: Row[],
  relationKeys: RelationKey[],
): EventReview {
  const lifecycles = pairs
    .map((pair) => buildReviewLifecycle(pair, rowsById))
    .filter((item): item is EventReviewLifecycle => !!item)
    .reduce<EventReviewLifecycle[]>((items, item) => [...items, item], []);
  const dedupedLifecycles = markLifecycleRelations(dedupeLifecycles(lifecycles), focusEventId, focus, rowsById)
    .sort((a, b) => lifecyclePriority(a.kind) - lifecyclePriority(b.kind) || (a.openedAt ?? 0) - (b.openedAt ?? 0));
  const focusType = stringValue(focus.event_type) ?? "event";
  const rows = [...rowsById.values()];
  return {
    verdict: buildVerdict(focusEventId, dedupedLifecycles, rows),
    focus: {
      id: focusEventId,
      type: focusType,
      title: eventTitle(focusType),
    },
    lifecycles: dedupedLifecycles,
    relationKeys: relationKeys.slice(0, 20),
  };
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

function loadEventListRows(
  db: SqliteDb,
  focus: Row,
  rowsById: Map<number, Row>,
  relationKeys: RelationKey[],
): { rows: Row[]; scope: NonNullable<EventGraphResponse["eventListScope"]> } {
  const focusData = parseData(focus);
  const focusSessionId = dataValue(focusData, ["sessionId", "session_id"]);
  const focusWorkflowRunId = dataValue(focusData, ["workflowRunId", "workflow_run_id"]);
  const focusTaskId = dataValue(focusData, ["taskId", "task_id"]);
  const relationSessionIds = relationKeys.filter((key) => key.kind === "session").map((key) => key.value);
  const relationWorkflowIds = relationKeys.filter((key) => key.kind === "workflow").map((key) => key.value);
  const relationTaskIds = relationKeys.filter((key) => key.kind === "task").map((key) => key.value);

  let kind: NonNullable<EventGraphResponse["eventListScope"]>["kind"] = "graph";
  let ids: string[] = [];
  let paths: string[] = [];

  if (focusSessionId) {
    kind = "session";
    ids = [focusSessionId];
    paths = ["$.sessionId", "$.session_id"];
  } else if (focusWorkflowRunId) {
    kind = "workflow";
    ids = [focusWorkflowRunId];
    paths = ["$.workflowRunId", "$.workflow_run_id"];
  } else if (focusTaskId) {
    kind = "task";
    ids = [focusTaskId];
    paths = ["$.taskId", "$.task_id"];
  } else if (relationSessionIds.length === 1) {
    kind = "session";
    ids = relationSessionIds;
    paths = ["$.sessionId", "$.session_id"];
  } else if (relationWorkflowIds.length === 1) {
    kind = "workflow";
    ids = relationWorkflowIds;
    paths = ["$.workflowRunId", "$.workflow_run_id"];
  } else if (relationTaskIds.length === 1) {
    kind = "task";
    ids = relationTaskIds;
    paths = ["$.taskId", "$.task_id"];
  }

  if (!ids.length || !paths.length) {
    const rows = [...rowsById.values()].sort((a, b) => (numberValue(a.timestamp) ?? 0) - (numberValue(b.timestamp) ?? 0) || (numberValue(a.id) ?? 0) - (numberValue(b.id) ?? 0));
    return {
      rows,
      scope: { kind: "graph", ids: [String(numberValue(focus.id) ?? "")].filter(Boolean), label: "visible graph events" },
    };
  }

  const uniqueIds = [...new Set(ids)];
  const clauses: string[] = [];
  const params: string[] = [];
  for (const path of paths) {
    const placeholders = uniqueIds.map(() => "?").join(",");
    clauses.push(`json_extract(e.data, '${path}') IN (${placeholders})`);
    params.push(...uniqueIds);
  }

  const rows = safeAll(
    db,
    `SELECT e.*, COALESCE(t.visibility, 'default') as visibility, t.trace_id, t.parent_event_id
     FROM events e
     LEFT JOIN event_traces t ON t.event_id = e.id
     WHERE json_valid(e.data)
       AND (${clauses.join(" OR ")})
     ORDER BY e.timestamp ASC, e.id ASC
     LIMIT 300`,
    ...params,
  );

  return {
    rows: rows.map(rowWithVisibility),
    scope: {
      kind,
      ids: uniqueIds,
      label: `${kind} ${uniqueIds.join(", ")}`,
    },
  };
}

function nodeSessionId(node: EventGraphNode | undefined): string | undefined {
  return stringValue(node?.dataPreview?.sessionId) ?? stringValue(node?.dataPreview?.session_id);
}

function nodeWorkflowRunId(node: EventGraphNode | undefined): string | undefined {
  return stringValue(node?.dataPreview?.workflowRunId) ?? stringValue(node?.dataPreview?.workflow_run_id);
}

function detailParentKeyForNode(
  node: EventGraphNode,
  primaryNodes: EventGraphNode[],
  focusEventId: number,
): string {
  const sessionId = nodeSessionId(node);
  if (sessionId) {
    const sessionStart = primaryNodes.find((item) => item.type === "session.start" && nodeSessionId(item) === sessionId);
    if (sessionStart) return eventNodeKey(sessionStart.id);
    const sessionEnd = primaryNodes.find((item) => item.type === "session.end" && nodeSessionId(item) === sessionId);
    if (sessionEnd) return eventNodeKey(sessionEnd.id);
  }

  const workflowRunId = nodeWorkflowRunId(node);
  if (workflowRunId) {
    const workflowNode = primaryNodes.find((item) => nodeWorkflowRunId(item) === workflowRunId && item.type.startsWith("workflow."));
    if (workflowNode) return eventNodeKey(workflowNode.id);
    const sessionNode = primaryNodes.find((item) => nodeWorkflowRunId(item) === workflowRunId && item.type.startsWith("session."));
    if (sessionNode) return eventNodeKey(sessionNode.id);
  }

  return eventNodeKey(focusEventId);
}

function buildDisplayGraph(
  focusEventId: number,
  nodes: EventGraphNode[],
  edges: EventGraphEdge[],
  eventList: EventGraphNode[],
): { displayNodes: EventGraphDisplayNode[]; displayEdges: EventGraphDisplayEdge[] } {
  const displayNodes = new Map<string, EventGraphDisplayNode>();
  const displayEdges = new Map<string, EventGraphDisplayEdge>();
  const primaryIds = new Set(nodes.map((node) => node.id));

  for (const node of nodes) {
    displayNodes.set(eventNodeKey(node.id), displayNodeFromEventNode(node));
  }

  for (const edge of edges) {
    const displayEdge = displayEdgeFromEventEdge(edge);
    displayEdges.set(displayEdge.key, displayEdge);
  }

  for (const node of eventList) {
    if (primaryIds.has(node.id)) continue;
    const parentKey = detailParentKeyForNode(node, nodes, focusEventId);
    const detailNode = displayNodeFromEventNode(node, {
      parentKey,
      level: 1,
      role: nodeKindForEventType(node.type) === "diagnostic" ? "diagnostic" : "detail",
    });
    displayNodes.set(detailNode.key, detailNode);
    const detailEdge: EventGraphDisplayEdge = {
      key: `detail:${parentKey}:${detailNode.key}`,
      sourceKey: parentKey,
      targetKey: detailNode.key,
      kind: "detail",
      label: "detail",
      provenance: "projection",
    };
    displayEdges.set(detailEdge.key, detailEdge);
  }

  const byKey = new Map(displayNodes);
  const chronological = (a: EventGraphDisplayNode, b: EventGraphDisplayNode) =>
    (a.timestamp ?? 0) - (b.timestamp ?? 0) ||
    (a.eventId ?? 0) - (b.eventId ?? 0) ||
    a.key.localeCompare(b.key);
  const levelFor = (node: EventGraphDisplayNode, seen = new Set<string>()): number => {
    if (!node.parentKey || seen.has(node.key)) return 0;
    const parent = byKey.get(node.parentKey);
    if (!parent) return 1;
    seen.add(node.key);
    return levelFor(parent, seen) + 1;
  };
  const ordered = [...displayNodes.values()]
    .sort(chronological)
    .map((node, order) => ({ ...node, level: levelFor(node), order }));

  return {
    displayNodes: ordered,
    displayEdges: [...displayEdges.values()],
  };
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
        provenance: "lifecycle",
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
    return {
      focusEventId,
      revision: `missing:${focusEventId}`,
      nodes: [],
      edges: [],
      eventNodes: [],
      eventEdges: [],
      diagnostics: [`event ${focusEventId} not found`],
    };
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
        addEdge(edges, { source: parentEventId, target: id, type: "parent", provenance: "persisted" });
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
        const source = type === "closure" ? to : from;
        const target = type === "closure" ? from : to;
        addEdge(edges, {
          source,
          target,
          type,
          provenance: "persisted",
          declaredByEventId: from,
          ...(stringValue(link.label) ? { label: stringValue(link.label) } : {}),
        });
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

  let relationKeys = mergeRelationKeys([...rowsById.values()]);
  addRowsByCorrelation(db, rowsById, relationKeys);
  relationKeys = mergeRelationKeys([...rowsById.values()]);
  const relatedPairs = loadRelatedPairs(db, [...rowsById.keys()], relationKeys);
  loadRowsByIds(
    db,
    rowsById,
    relatedPairs.flatMap((pair) => [numberValue(pair.open_event_id), numberValue(pair.close_event_id)]).filter((id): id is number => !!id),
  );
  relationKeys = mergeRelationKeys([...rowsById.values()]);
  addPairEdges(edges, relatedPairs);
  addCorrelationEdges(edges, [...rowsById.values()]);

  const allEdges = normalizeEdgesForReview([...edges.values()], rowsById);
  const traversalEdges = allEdges.filter((edge) => !isDefaultContextEdge(edge));
  const visibleIds = visibleIdsForDefaultScope(focusEventId, traversalEdges, depth, rowsById, traceId);
  const graphNodes = [...rowsById.values()]
    .map(nodeFromRow)
    .filter((node): node is EventGraphNode => !!node)
    .sort((a, b) => a.timestamp - b.timestamp || a.id - b.id);
  const availableNodes = graphNodes.filter((node) => includeDetail || node.visibility !== "detail");
  const detailNodeCount = graphNodes.filter((node) => node.visibility === "detail").length;
  const nodes = availableNodes.filter((node) => visibleIds.has(node.id));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const visibleEdges = traversalEdges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .sort((a, b) => a.source - b.source || a.target - b.target || a.type.localeCompare(b.type));
  const frontiers = buildFrontiers(availableNodes, allEdges, nodeIds);
  const eventListProjection = loadEventListRows(db, focus, rowsById, relationKeys);
  const eventList = eventListProjection.rows
    .map(nodeFromRow)
    .filter((node): node is EventGraphNode => !!node)
    .sort((a, b) => a.timestamp - b.timestamp || a.id - b.id);
  const displayGraph = buildDisplayGraph(focusEventId, nodes, visibleEdges, eventList);
  const latestTimestamp = graphNodes.reduce((latest, node) => Math.max(latest, node.timestamp), 0);
  const revision = `${focusEventId}:${latestTimestamp}:${graphNodes.length}:${allEdges.length}:${includeDetail ? 1 : 0}`;

  if (!nodes.some((node) => node.id === focusEventId)) {
    diagnostics.push("focus event is hidden by current detail filter");
  }

  return {
    focusEventId,
    ...(traceId ? { traceId } : {}),
    revision,
    nodes: displayGraph.displayNodes,
    edges: displayGraph.displayEdges,
    eventNodes: nodes,
    eventEdges: visibleEdges,
    frontiers,
    eventList,
    eventListScope: eventListProjection.scope,
    diagnostics,
    detailNodeCount,
    review: buildEventReview(focusEventId, focus, rowsById, relatedPairs, relationKeys),
  };
}

function transcriptTimestamp(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function transcriptSummary(value: unknown, fallback: string): string {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return compact(text, 180) ?? fallback;
}

function transcriptKeyPart(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function addSessionTranscriptToEventGraph(
  graph: EventGraphResponse,
  sessionId: string,
  transcript: EventGraphTranscript,
): EventGraphResponse {
  const cleanSessionId = sessionId.trim();
  if (!cleanSessionId) return graph;
  const sessionNodes = graph.nodes.filter((node) => node.sessionId === cleanSessionId && node.eventId);
  const start = sessionNodes.find((node) => node.type === "session.start");
  const end = [...sessionNodes].reverse().find((node) => node.type === "session.end");
  const parentKey = start?.key ?? end?.key;
  if (!parentKey) return graph;

  const messages = Array.isArray(transcript.messages) ? transcript.messages : [];
  const projectedNodes: EventGraphDisplayNode[] = [];
  const projectedEdges: EventGraphDisplayEdge[] = [];
  const turnKeys: string[] = [];
  const toolKeys = new Map<string, string>();

  for (let index = 0; index < messages.length; index++) {
    const message = messages[index] ?? {};
    const role = stringValue(message.role) ?? "message";
    if (role === "tool_result" || role === "toolresult") {
      const toolCallId = stringValue(message.toolCallId);
      const toolKey = toolCallId ? toolKeys.get(toolCallId) : undefined;
      if (!toolKey) continue;
      const key = `${toolKey}:result`;
      projectedNodes.push({
        key,
        kind: "tool_result",
        role: message.isError ? "diagnostic" : "detail",
        parentKey: toolKey,
        level: 3,
        visibility: "detail",
        sessionId: cleanSessionId,
        ...(toolCallId ? { toolCallId } : {}),
        timestamp: transcriptTimestamp(message.timestamp),
        type: "tool.result",
        label: stringValue(message.toolName) ?? "tool result",
        summary: transcriptSummary(message.content, message.isError ? "tool failed" : "tool completed"),
        refs: {
          sessionId: cleanSessionId,
          ...(toolCallId ? { toolCallId } : {}),
          ...(numberValue(message.rawLine) ? { rawLine: numberValue(message.rawLine)! } : {}),
          ...(stringValue(message.rawSource) ? { rawSource: stringValue(message.rawSource)! } : {}),
        },
      });
      projectedEdges.push({
        key: `tool_result:${toolKey}:${key}`,
        sourceKey: toolKey,
        targetKey: key,
        kind: "tool_result",
        provenance: "transcript",
      });
      continue;
    }

    if (role !== "user" && role !== "assistant") continue;
    const rawLine = numberValue(message.rawLine) ?? index + 1;
    const key = `session:${cleanSessionId}:turn:${rawLine}`;
    turnKeys.push(key);
    const toolCalls = Array.isArray(message.toolCalls) ? message.toolCalls.filter(isRecord) : [];
    projectedNodes.push({
      key,
      kind: "turn",
      role: "detail",
      parentKey,
      level: 1,
      visibility: "detail",
      sessionId: cleanSessionId,
      turnIndex: turnKeys.length,
      timestamp: transcriptTimestamp(message.timestamp),
      type: `llm.${role}`,
      label: role,
      summary: transcriptSummary(message.text, toolCalls.length ? `${toolCalls.length} tool call${toolCalls.length === 1 ? "" : "s"}` : role),
      refs: {
        sessionId: cleanSessionId,
        rawLine,
        ...(stringValue(message.rawSource) ? { rawSource: stringValue(message.rawSource)! } : {}),
      },
    });

    for (let toolIndex = 0; toolIndex < toolCalls.length; toolIndex++) {
      const toolCall = toolCalls[toolIndex];
      const toolCallId = stringValue(toolCall.id) ?? `${rawLine}:${toolIndex}`;
      const toolKey = `${key}:tool:${transcriptKeyPart(toolCallId)}`;
      toolKeys.set(toolCallId, toolKey);
      projectedNodes.push({
        key: toolKey,
        kind: "tool_call",
        role: "detail",
        parentKey: key,
        level: 2,
        visibility: "detail",
        sessionId: cleanSessionId,
        toolCallId,
        timestamp: transcriptTimestamp(message.timestamp),
        type: "tool.call",
        label: stringValue(toolCall.tool) ?? "tool",
        summary: transcriptSummary(JSON.stringify(toolCall.args ?? {}), "tool call"),
        refs: {
          sessionId: cleanSessionId,
          toolCallId,
          rawLine,
          ...(stringValue(toolCall.rawSource) ? { rawSource: stringValue(toolCall.rawSource)! } : {}),
        },
      });
      projectedEdges.push({
        key: `tool_call:${key}:${toolKey}`,
        sourceKey: key,
        targetKey: toolKey,
        kind: "tool_call",
        provenance: "transcript",
      });
    }
  }

  const turnNodes = projectedNodes.filter((node) => node.kind === "turn");
  const startTime = start?.timestamp;
  const endTime = end?.timestamp;
  for (let index = 0; index < turnNodes.length; index++) {
    if (turnNodes[index].timestamp != null) continue;
    if (startTime != null && endTime != null && endTime > startTime) {
      turnNodes[index].timestamp = startTime + ((endTime - startTime) * (index + 1)) / (turnNodes.length + 1);
    } else if (startTime != null) {
      turnNodes[index].timestamp = startTime + index + 1;
    } else if (endTime != null) {
      turnNodes[index].timestamp = endTime - (turnNodes.length - index);
    }
  }
  const projectedByKey = new Map(projectedNodes.map((node) => [node.key, node]));
  for (const node of projectedNodes) {
    if (node.timestamp != null || !node.parentKey) continue;
    node.timestamp = projectedByKey.get(node.parentKey)?.timestamp;
  }

  if (turnKeys.length) {
    projectedEdges.push({
      key: `detail:${parentKey}:${turnKeys[0]}`,
      sourceKey: parentKey,
      targetKey: turnKeys[0],
      kind: "detail",
      label: "transcript",
      provenance: "transcript",
    });
    for (let index = 0; index < turnKeys.length - 1; index++) {
      projectedEdges.push({
        key: `sequence:${turnKeys[index]}:${turnKeys[index + 1]}`,
        sourceKey: turnKeys[index],
        targetKey: turnKeys[index + 1],
        kind: "sequence",
        provenance: "transcript",
      });
    }
    if (end && end.key !== parentKey) {
      projectedEdges.push({
        key: `detail:${turnKeys[turnKeys.length - 1]}:${end.key}`,
        sourceKey: turnKeys[turnKeys.length - 1],
        targetKey: end.key,
        kind: "detail",
        label: "returns",
        provenance: "transcript",
      });
    }
  }

  const nodesByKey = new Map(graph.nodes.map((node) => [node.key, node]));
  for (const node of projectedNodes) nodesByKey.set(node.key, node);
  const edgesByKey = new Map(graph.edges.map((edge) => [edge.key, edge]));
  for (const edge of projectedEdges) edgesByKey.set(edge.key, edge);
  const nodes = [...nodesByKey.values()].map((node, order) => ({ ...node, order }));
  return {
    ...graph,
    revision: `${graph.revision}:session:${cleanSessionId}:${messages.length}`,
    nodes,
    edges: [...edgesByKey.values()],
  };
}
