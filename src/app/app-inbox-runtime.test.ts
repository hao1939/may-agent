import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, type SqliteDb } from "../lib/db.js";
import { applyDbSchema } from "../lib/db/schema.js";
import { associateAppInboxClaimSession, claimAppInboxItem, createAppInboxItem } from "./app-inbox-store.js";
import { startAppInboxRuntime, type AppInboxRuntime } from "./app-inbox-runtime.js";
import { EVENT_DEDUPLICATED, EVENT_REDELIVERY_REQUIRED, EventBus } from "./event-bus.js";
import type { AppOwnerManager } from "./app-owner-manager-adapter.js";

describe("App inbox runtime", () => {
  let root: string;
  let db: SqliteDb;
  let runtime: AppInboxRuntime | null;

  beforeEach(() => {
    root = join(tmpdir(), `app-inbox-runtime-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const appDir = join(root, "evaluation.app");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(
      join(appDir, "inbox.js"),
      `export default {
        id: "evaluation-canary",
        version: 1,
        owner: "evaluator",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "data"],
          properties: {
            kind: { const: "probe" },
            data: {
              type: "object",
              additionalProperties: false,
              required: ["value"],
              properties: { value: { type: "string" } }
            }
          }
        }
      };\n`,
    );
    db = openDatabase(":memory:");
    applyDbSchema(db);
    runtime = null;
  });

  afterEach(() => {
    runtime?.close();
    db.close();
    rmSync(root, { recursive: true, force: true });
  });

  function manager(calls: string[]): AppOwnerManager {
    return {
      hasAgent: () => true,
      run(_agent, prompt) {
        calls.push(prompt);
        const requestId = JSON.parse(prompt.match(/```json\n([\s\S]*?)\n```/)?.[1] ?? "[]")[0].id;
        return `session:${requestId}`;
      },
      async waitFor(sessionId) {
        return {
          status: "done",
          structuredResult: {
            dispositions: [
              {
                requestId: sessionId.replace(/^session:/, ""),
                disposition: { type: "complete", summary: "canary passed" },
              },
            ],
          },
        };
      },
      cancel() {},
    };
  }

  async function waitUntil(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (predicate()) return;
      await Bun.sleep(5);
    }
    throw new Error("Timed out waiting for App inbox runtime");
  }

  it("admits an explicit App input event exactly once and drives it to completion", async () => {
    const calls: string[] = [];
    const bus = new EventBus();
    runtime = await startAppInboxRuntime({
      projectsRoot: root,
      db,
      manager: manager(calls),
      bus,
      scanIntervalMs: 10_000,
    });
    expect(runtime).not.toBeNull();

    const event = {
      type: "app.input.requested" as const,
      source: "test",
      owner: "agent:evaluator",
      data: {
        appId: "evaluation-canary",
        input: { kind: "probe", data: { value: "first" } },
        source: { kind: "system" as const, id: "canary" },
        idempotencyKey: "canary:1",
      },
    };
    bus.setPersistenceSubscriber((retried) => {
      Object.defineProperty(retried, EVENT_DEDUPLICATED, { value: true, configurable: true });
      Object.defineProperty(retried, EVENT_REDELIVERY_REQUIRED, { value: true, configurable: true });
    });
    bus.emit(event);
    await waitUntil(() => runtime?.host.get("missing") === null && calls.length === 1);
    const row = db.prepare("SELECT id FROM app_inbox_items WHERE app_id = ?").get("evaluation-canary") as {
      id: string;
    };
    await waitUntil(() => runtime?.host.get(row.id)?.status === "done");

    bus.emit(event);
    await Bun.sleep(20);
    expect(calls).toHaveLength(1);
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items").get()).toEqual({ count: 1 });
    expect(runtime?.host.get(row.id)).toMatchObject({
      status: "done",
      result: { summary: "canary passed" },
      sessionId: `session:${row.id}`,
    });
  });

  it("rescans durable unfinished items when the runtime starts", async () => {
    const calls: string[] = [];
    createAppInboxItem(db, {
      id: "restart-probe",
      appId: "evaluation-canary",
      source: { kind: "system", id: "before-restart" },
      input: { kind: "probe", data: { value: "resume" } },
    });
    const oldClaim = claimAppInboxItem(db, "restart-probe", "old-host", 60_000)!;
    associateAppInboxClaimSession(db, oldClaim, "old-session");

    runtime = await startAppInboxRuntime({
      projectsRoot: root,
      db,
      manager: manager(calls),
      bus: new EventBus(),
      scanIntervalMs: 10_000,
    });

    await waitUntil(() => runtime?.host.get("restart-probe")?.status === "done");
    expect(calls).toHaveLength(1);
  });
});
