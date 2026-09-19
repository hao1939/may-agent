import { expect, test } from "bun:test";
import { once } from "node:events";
import { renameSync } from "node:fs";
import { createServer, type Socket } from "node:net";
import { sendSocketCommand, SocketCommandError } from "../../packages/control/src/client.js";
import { buildAppAdmissionCommand } from "../../src/app/http/server.js";
import { openSandboxDb, pollUntil, queryEvents } from "./lib/live-daemon.js";
import { buildSandbox } from "./lib/sandbox.js";

test.each([
  ["comment", 503],
  ["input", 202],
  ["history", 503],
  ["collision", 503],
] as const)(
  "comment admission preserves exact receipts and rejects unsupported input: %s",
  async (scenario, status) => {
    const appId = scenario === "collision" ? "input" : scenario;
    const sb = await buildSandbox({
      fixtureAgents: ["may"],
      fixtureProjects: [`${appId}.app`],
      fixtureWorkflows: { may: ["e2e-noop-workflow"] },
      daemonArgs: ["--socket", "--web"],
    });
    const sockets = new Set<Socket>();
    const dropped: Array<{ key: unknown; eventId: unknown }> = [];
    const errors: unknown[] = [];
    const frames: string[] = [];
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
        frames.push(frame.type);
        try {
          if (scenario === "collision" && frame.type === "app.input.admit") {
            // Simulate an unknown transport outcome before this publication
            // reaches persistence. An unrelated receipt must not stand in for it.
            return;
          }
          const response = await sendSocketCommand(upstreamPath, frame);
          if (frame.type === "app.input.admit") {
            // Persistence and routing happen in the real daemon. Only its reply
            // is lost; keep the connection open for both real client timeouts.
            dropped.push({ key: frame.idempotencyKey, eventId: response.eventId });
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
        await sendSocketCommand(
          sb.socketPath,
          buildAppAdmissionCommand({
            projectId: appId,
            projectPath: `projects/${appId}.app`,
            comment: "A different request",
            idempotencyKey: key,
          }),
        );
      }
      // The web adapter keeps using its normal socket path through the proxy.
      renameSync(sb.socketPath, upstreamPath);
      proxy.listen(sb.socketPath);
      await once(proxy, "listening");

      const body = await (async () => {
        try {
          const response = await fetch(`http://127.0.0.1:${sb.webPort}/api/projects/comment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              path: `projects/${appId}.app`,
              comment: "Review this project",
              idempotencyKey: key,
            }),
            signal: AbortSignal.timeout(20_000),
          });
          expect(errors).toEqual([]);
          expect(response.status).toBe(status);
          const responseBody = await response.json();
          expect(responseBody).toMatchObject({ ok: status === 202, triggered: status === 202 });
          expect(frames).toEqual(
            status === 202 || scenario === "collision" ? ["app.input.admit", "app.input.admit"] : ["app.input.admit"],
          );
          return responseBody;
        } catch (error) {
          const cause = error instanceof Error ? error.cause : undefined;
          const daemonLogs = sb.getLogs();
          const logLimit = 16_000;
          console.error("project comment recovery failure", {
            scenario,
            url: `http://127.0.0.1:${sb.webPort}/api/projects/comment`,
            webPort: sb.webPort,
            daemonPid: sb.daemonPid,
            error,
            errorCode: error && typeof error === "object" && "code" in error ? error.code : undefined,
            cause,
            causeCode: cause && typeof cause === "object" && "code" in cause ? cause.code : undefined,
            frames,
            dropped,
            proxyErrors: errors,
            daemonLogs: daemonLogs.slice(-logLimit),
            daemonLogCharactersOmitted: Math.max(0, daemonLogs.length - logLimit),
          });
          throw error;
        }
      })();
      const db = openSandboxDb(sb.dbPath);
      try {
        expect(queryEvents(db, { types: ["project.comment.created"] })).toEqual([]);
        if (scenario === "collision") {
          expect(body.eventId).toBeUndefined();
          const unrelated = queryEvents(db, { types: ["app.input.requested"] });
          expect(unrelated).toHaveLength(1);
          expect(JSON.parse(unrelated[0].data!)).toMatchObject({
            input: { data: { message: "A different request" } },
          });
          return;
        }
        if (status !== 202) {
          expect(body.eventId).toBeUndefined();
          expect(body.error).toContain("does not accept this input");
          expect(dropped).toEqual([]);
          expect(queryEvents(db, { types: ["app.input.requested"] })).toEqual([]);
          expect(db.prepare("SELECT task_id FROM app_tasks").all()).toEqual([]);
          return;
        }
        expect(Number.isSafeInteger(body.eventId)).toBe(true);
        expect(dropped).toEqual([
          { key, eventId: body.eventId },
          { key, eventId: body.eventId },
        ]);
        // The HTTP response recovered this exact event by idempotency key after
        // both replies were dropped; a transport receipt alone cannot pass.
        const events = queryEvents(db, {
          types: ["app.input.requested"],
        });
        expect(events).toHaveLength(1);
        expect(events[0].id).toBe(body.eventId);
        await pollUntil(
          () => db.prepare("SELECT task_id FROM app_tasks WHERE app_id = ? AND task_id = ?").get(appId, "work/input"),
          { timeoutMs: 15_000, description: "generic input Task" },
        );
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
