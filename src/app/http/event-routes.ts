/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync } from "node:fs";
import { createQueryService } from "../../lib/query-service.js";
import { eventDeliveryContract, getEventView, PUBLIC_EVENT_TYPES } from "../core/events/interface.js";
import { readProjectIngressIdentity } from "./project-metadata.js";
import type { SqliteDb } from "./read-model/state-db.js";

export type EventDaemonFrameResult = {
  ok: boolean;
  error?: string;
  eventId?: number;
  eventType?: string;
  delivery?: "recorded" | "accepted" | "rejected";
  links?: unknown[];
};

export function createEventRouteHandlers(options: {
  getDb: () => SqliteDb;
  json: (data: unknown, status?: number) => Response;
  isAllowedProjectPath: (path: string) => boolean;
  resolveProjectFile: (path: string) => string;
  sendDaemonFrame: (frame: Record<string, unknown>) => Promise<EventDaemonFrameResult>;
  buildEventIngressFrame: (body: Record<string, unknown>) => Record<string, unknown>;
}) {
  const {
    getDb: _db,
    json,
    isAllowedProjectPath,
    resolveProjectFile,
    sendDaemonFrame,
    buildEventIngressFrame,
  } = options;

  function handleEvents(url: URL): Response {
    const db = _db();
    const query = createQueryService({ getDb: () => db });
    try {
      // Keep the legacy row-array shape; shared limits are 1..500, default 100.
      return json(
        query.events({
          owner: url.searchParams.get("owner") || undefined,
          type: url.searchParams.get("type") || undefined,
          limit: parseInt(url.searchParams.get("limit") || "100", 10),
        }).rows,
      );
    } catch {
      return json([]); // table may not exist yet
    }
  }

  function handleEventDeliveryHealth(url: URL): Response {
    const db = _db();
    const query = createQueryService({ getDb: () => db });
    const now = Date.now();
    const lookbackMs =
      Math.max(1, Math.min(24 * 60 * 60_000, Number(url.searchParams.get("lookbackMs") || 6 * 60 * 60_000))) ||
      6 * 60 * 60_000;
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 25)));
    const since = now - lookbackMs;
    try {
      const eventSchema = db.prepare("PRAGMA table_info(events)").all() as Array<{ name?: string }>;
      const eventColumnsSet = new Set(eventSchema.map((row) => row.name).filter(Boolean));
      const pairTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'event_pair_runs'")
        .get();
      if (!eventColumnsSet.has("delivery_status") || !eventColumnsSet.has("delivery_route") || !pairTable) {
        return json({
          now,
          since,
          lookbackMs,
          schemaReady: false,
          note: "event delivery schema is not migrated in this state database yet",
          unhandledEvents: [],
          overduePendingEvents: [],
          orphanPairs: [],
          overdueOpenPairs: [],
        });
      }
      return json({
        ...query.eventDeliveryHealth({ now, lookbackMs, limit }),
        lookbackMs,
        schemaReady: true,
      });
    } catch (error) {
      return json({
        now,
        since,
        lookbackMs,
        schemaReady: false,
        unhandledEvents: [],
        overduePendingEvents: [],
        orphanPairs: [],
        overdueOpenPairs: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function handleEventIngress(req: Request): Promise<Response> {
    try {
      const body = (await req.json()) as Record<string, unknown>;
      const type = typeof body.type === "string" ? body.type.trim() : "";
      if (!type) return json({ error: "type required" }, 400);
      if (!PUBLIC_EVENT_TYPES.has(type)) return json({ error: `Event type '${type}' is not admitted by HTTP` }, 400);
      const data =
        body.data && typeof body.data === "object" && !Array.isArray(body.data)
          ? (body.data as Record<string, unknown>)
          : {};
      const projectPath =
        typeof data.projectPath === "string"
          ? data.projectPath
          : typeof body.projectPath === "string"
            ? body.projectPath
            : "";

      let projectId = typeof data.projectId === "string" ? data.projectId : "";
      if (projectPath) {
        if (!isAllowedProjectPath(projectPath)) return json({ error: "Access denied" }, 403);
        const projectFile = resolveProjectFile(projectPath);
        if (!existsSync(projectFile)) return json({ error: "Project not found" }, 404);
        const identity = readProjectIngressIdentity(projectPath, projectFile);
        projectId = projectId || identity.projectId;
      }

      const trigger = await sendDaemonFrame(buildEventIngressFrame(body));
      if (!trigger.ok) return json({ ok: false, triggered: false, error: trigger.error }, 503);

      return json(
        {
          ok: true,
          triggered: true,
          eventType: trigger.eventType ?? type,
          eventId: trigger.eventId,
          delivery: trigger.delivery ?? "recorded",
          links: trigger.links ?? [],
          reason: typeof data.reason === "string" ? data.reason : null,
          projectId: projectId || null,
        },
        eventDeliveryContract(type) === "required" && trigger.delivery !== "accepted" ? 202 : 201,
      );
    } catch (e: any) {
      return json({ error: e.message }, 500);
    }
  }

  function handleEventView(eventIdText: string): Response {
    // Trusted operator diagnostic view, intentionally broader than POST ingress.\n    // Consumers needing Task results must reread the exact canonical resource.
    const eventId = Number(eventIdText);
    if (!Number.isSafeInteger(eventId) || eventId <= 0) return json({ error: "event id must be positive" }, 400);
    const view = getEventView(_db(), eventId);
    return view ? json(view) : json({ error: `Event ${eventId} not found` }, 404);
  }

  return {
    handleEvents,
    handleEventDeliveryHealth,
    handleEventIngress,
    handleEventView,
  };
}
