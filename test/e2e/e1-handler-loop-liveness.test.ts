/**
 * E1 — Handler loop liveness
 *
 * Bellwether for the whole cron → handler-loader → event-persistence pipeline.
 * Spawns a sandboxed daemon with a single fixture agent ("may") owning a single
 * fixture handler ("e2e-noop") on a 1-second interval. Waits for handler.started
 * + handler.completed + the handler's own emitted e2e.tick events to materialize
 * in the events table.
 *
 * Validates documented behavior of:
 *   - user-guide.md § Cron
 *   - handler-authoring.md § Lifecycle Events
 *
 * Gated behind E2E_LIVE=1; does not require LLM access.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  E2E_LIVE,
  openSandboxDb,
  pollUntil,
  queryEvents,
} from "./lib/live-daemon.js";
import { buildSandbox, type Sandbox } from "./lib/sandbox.js";

describe.skipIf(!E2E_LIVE)("E1: handler loop liveness", () => {
  let sb: Sandbox;
  const t0 = Date.now();

  beforeAll(async () => {
    sb = await buildSandbox({
      fixtureAgents: ["may"],
      fixtureHandlers: { may: ["e2e-noop"] },
      cronJson: {
        may: [
          {
            name: "e2e-noop",
            handler: "e2e-noop",
            intervalMs: 10000,
            agent: "may",
            enabled: true,
          },
        ],
      },
    });
    await sb.daemonReady;
  }, 60_000);

  afterAll(async () => {
    if (sb) await sb.close();
  });

  test(
    "handler fires, completes, and emits domain event",
    async () => {
      const db = openSandboxDb(sb.dbPath);
      try {
        // Wait up to 45s for ≥2 fires (10s interval; first fire after socket-ready,
        // second ~10s later; plus jitter).
        const result = await pollUntil(
          () => {
            const started = queryEvents(db, { types: ["handler.started"], since: t0, limit: 20 })
              .filter((e) => e.source === "e2e-noop" || (e.data ?? "").includes("e2e-noop"));
            const completed = queryEvents(db, { types: ["handler.completed"], since: t0, limit: 20 })
              .filter((e) => e.source === "e2e-noop" || (e.data ?? "").includes("e2e-noop"));
            const ticks = queryEvents(db, { types: ["e2e.tick"], since: t0, limit: 20 });
            if (started.length >= 2 && completed.length >= 2 && ticks.length >= 2) {
              return { started, completed, ticks };
            }
            return null;
          },
          { timeoutMs: 45_000, intervalMs: 500, description: "≥2 handler fire-cycles" },
        );

        // Invariants:
        expect(result.started.length).toBeGreaterThanOrEqual(2);
        expect(result.completed.length).toBeGreaterThanOrEqual(2);
        expect(result.ticks.length).toBeGreaterThanOrEqual(2);

        // No started without matching completed (orphan check).
        // We approximate: completed count should be within 1 of started count.
        expect(result.completed.length).toBeGreaterThanOrEqual(result.started.length - 1);

        // No handler.failed in window.
        const failed = queryEvents(db, { types: ["handler.failed"], since: t0, limit: 20 });
        if (failed.length > 0) {
          throw new Error(
            `handler.failed events present:\n${failed.map((f) => f.data).join("\n")}`,
          );
        }
      } finally {
        db.close();
      }
    },
    60_000,
  );
});
