import { expect, test } from "bun:test";
import { getEvent, sendSocketCommand } from "../../packages/control/src/client.js";
import { buildSandbox } from "./lib/sandbox.js";

test("HTTP and socket expose operator diagnostics without turning their payloads into public commands", async () => {
  const sandbox = await buildSandbox({ fixtureAgents: ["may"], daemonArgs: ["--socket", "--web"] });
  try {
    await sandbox.daemonReady;
    await sandbox.waitForWeb!(15000);
    const origin = `http://127.0.0.1:${sandbox.webPort}`;
    const fact = {
      type: "project.task.reconcile.profiled",
      data: { project: "sample", taskId: "work/main", providerMs: 12 },
    };
    // Direct operator frames may record diagnostics; normal public publication
    // has a narrower ingress contract. Neither grants Task result authority.
    const receipt = await sendSocketCommand(sandbox.socketPath, { ...fact, source: "fixture", owner: "project:sample" });
    expect(receipt.type).toBe("ok");
    const eventId = Number((receipt as { eventId?: number }).eventId);
    expect(eventId).toBeGreaterThan(0);
    const socketView = await getEvent(sandbox.socketPath, eventId);
    const http = await fetch(`${origin}/api/events/${eventId}`, { signal: AbortSignal.timeout(5000) });
    expect(http.status).toBe(200);
    expect(await http.json()).toEqual(socketView);
    expect(socketView.event).toMatchObject(fact);
    expect(socketView.delivery.state).toBe("recorded");
    const rejected = await fetch(`${origin}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fact),
      signal: AbortSignal.timeout(5000),
    });
    expect(rejected.status).toBe(400);
    expect(await rejected.json()).toMatchObject({ error: expect.stringContaining("not admitted by HTTP") });
    const retired = await fetch(`${origin}/api/agents/may/heartbeat-now`, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
    });
    expect(retired.status).toBe(404);
  } finally {
    await sandbox.close();
  }
}, 30000);
