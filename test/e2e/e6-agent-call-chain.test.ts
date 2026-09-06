/** E6 — Host maintenance is mechanical and cannot launch App work. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { openSandboxDb, pollUntil, queryEvents, querySessions } from "./lib/live-daemon.js";
import { buildSandbox, type Sandbox } from "./lib/sandbox.js";

describe("E6: Host maintenance capabilities", () => {
  let sandbox: Sandbox;

  beforeAll(async () => {
    sandbox = await buildSandbox({
      fixtureAgents: ["may", "worker"],
      fixtureHandlers: { may: ["e2e-call-worker"] },
      cronJson: {
        may: [
          {
            name: "e2e-call-worker",
            handler: "e2e-call-worker",
            intervalMs: 10_000,
            offsetMs: 1, // This checks capabilities, not randomized startup delay.
            agent: "may",
            enabled: true,
          },
        ],
        worker: [],
      },
    });
    await sandbox.daemonReady;
  }, 60_000);

  afterAll(async () => {
    if (sandbox) await sandbox.close();
  });

  test("file handlers cannot launch agents, workflows, or escalations", async () => {
    const db = openSandboxDb(sandbox.dbPath);
    try {
      const events = await pollUntil(
        () => {
          const rows = queryEvents(db, {
            types: ["e2e.handler-capabilities.checked"],
            limit: 5,
          });
          return rows.length ? rows : null;
        },
        {
          timeoutMs: 30_000,
          intervalMs: 250,
          description: "Host handler capability report",
        },
      );
      expect(JSON.parse(events[0].data)).toMatchObject({
        hasRunAgent: false,
        hasRunWorkflow: false,
        hasEscalate: false,
      });
      expect(querySessions(db, { agents: ["worker"], limit: 20 })).toEqual([]);
    } finally {
      db.close();
    }
  }, 60_000);
});
