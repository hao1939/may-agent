import { expect, test } from "bun:test";
import { once } from "node:events";
import { renameSync } from "node:fs";
import { createServer, type Socket } from "node:net";
import { publishEvent, sendSocketCommand, SocketCommandError } from "../../packages/control/src/client.js";
import { openSandboxDb, pollUntil, queryEvents } from "./lib/live-daemon.js";
import { buildSandbox } from "./lib/sandbox.js";

test.each([
  ["comment", 202],
  ["input", 202],
  ["history", 503],
  ["collision", 503],
] as const)(
  "lost comment acknowledgments require an App work route: %s",
  async (scenario, status) => {
    const appId = scenario === "collision" ? "comment" : scenario;
    const sb = await buildSandbox({
      fixtureAgents: ["may"],
      fixtureProjects: [`${appId}.app`],
      fixtureWorkflows: { may: ["e2e-noop-workflow"] },
      daemonArgs: ["--socket", "--web"],
    });
    const sockets = new Set<Socket>();
    const dropped: Array<{ key: unknown; eventId: unknown }> = [];
    const errors: unknown[] = [];
    const upstreamPath = `${sb.socketPath}.upstream`;
    const proxy = createServer((socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
      socket.on("error", (error) => errors.push(error));
      socket.setEncoding("utf8");
      let buffer = "";
      let sent = false;
      socket.on("data", async (chunk) => {
        buffer += chunk;
        if (sent || !buffer.includes("\n")) return;
        sent = true;
        const frame = JSON.parse(buffer.slice(0, buffer.indexOf("\n")));
        try {
          if (scenario === "collision" && frame.type === "publish") {
            // Simulate an unknown transport outcome before this publication
            // reaches persistence. An unrelated receipt must not stand in for it.
            return;
          }
          const response = await sendSocketCommand(upstreamPath, frame);
          if (
            (frame.type === "publish" && frame.event?.type === "project.comment.created") ||
            (appId === "input" && frame.type === "app.input.admit")
          ) {
            // Persistence and routing happen in the real daemon. Only its reply
            // is lost; keep the connection open for both real client timeouts.
            dropped.push({ key: frame.event?.idempotencyKey ?? frame.idempotencyKey, eventId: response.eventId });
            return;
          }
          socket.end(`${JSON.stringify(response)}\n`);
        } catch (error) {
          if (error instanceof SocketCommandError && error.kind === "definitive") {
            socket.end(`${JSON.stringify({ type: "error", command: frame.type, message: error.message })}\n`);
          } else {
            errors.push(error);
            socket.destroy();
          }
        }
      });
    });
    try {
      await sb.daemonReady;
      await sb.waitForWeb!();
      const key = "lost-comment-ack";
      if (scenario === "collision") {
        await publishEvent(sb.socketPath, {
          type: "project.approval.submitted",
          target: { appId },
          idempotencyKey: key,
          data: {
            projectPath: `projects/${appId}.app`,
            project: appId,
            comment: "A different request",
            decision: "approve",
          },
        });
      }
      // The web adapter keeps using its normal socket path through the proxy.
      renameSync(sb.socketPath, upstreamPath);
      proxy.listen(sb.socketPath);
      await once(proxy, "listening");

      const response = await fetch(`http://127.0.0.1:${sb.webPort}/api/projects/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: `projects/${appId}.app`, comment: "Review this project", idempotencyKey: key }),
        signal: AbortSignal.timeout(20_000),
      });
      expect(errors).toEqual([]);
      expect(response.status).toBe(status);
      const body = await response.json();
      expect(body).toMatchObject({ ok: status === 202, triggered: status === 202 });
      if (scenario === "collision") {
        expect(body.eventId).toBeUndefined();
        expect(body.retryWithNewKey).not.toBe(true);
        const db = openSandboxDb(sb.dbPath);
        try {
          expect(queryEvents(db, { types: ["project.comment.created"] })).toEqual([]);
          const unrelated = queryEvents(db, { types: ["project.approval.submitted"] });
          expect(unrelated).toHaveLength(1);
          expect(
            db
              .prepare("SELECT app_id, status FROM app_event_admission_commands WHERE event_id = ?")
              .all(unrelated[0].id),
          ).toEqual([{ app_id: appId, status: "admitted" }]);
        } finally {
          db.close();
        }
        return;
      }
      expect(Number.isSafeInteger(body.eventId)).toBe(true);
      expect(dropped).toEqual([
        { key, eventId: body.eventId },
        { key, eventId: body.eventId },
      ]);
      const db = openSandboxDb(sb.dbPath);
      try {
        // The HTTP response recovered this exact event by idempotency key after
        // both replies were dropped; a transport receipt alone cannot pass.
        const events = queryEvents(db, {
          types: [appId === "input" ? "app.input.requested" : "project.comment.created"],
        });
        expect(events).toHaveLength(1);
        expect(events[0].id).toBe(body.eventId);
        const routes = db
          .prepare("SELECT app_id, status FROM app_event_admission_commands WHERE event_id = ?")
          .all(body.eventId);
        if (appId === "input") {
          await pollUntil(
            () => db.prepare("SELECT task_id FROM app_tasks WHERE app_id = ? AND task_id = ?").get(appId, "work/input"),
            { timeoutMs: 15_000, description: "generic input Task" },
          );
        } else if (status === 202) expect(routes).toEqual([{ app_id: appId, status: "admitted" }]);
        else {
          expect(routes).toEqual([]);
          expect(body.error).toContain("no admitted route");
        }
      } finally {
        db.close();
      }
    } finally {
      for (const socket of sockets) socket.destroy();
      if (proxy.listening) await new Promise<void>((resolve) => proxy.close(() => resolve()));
      await sb.close();
    }
  },
  40_000,
);
