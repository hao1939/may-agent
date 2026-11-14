import { describe, expect, test } from "bun:test";
import { createTaskInputHandler } from "./task-input.js";

const target = { appId: "example", taskId: "support/version", generation: 3, status: "running", terminal: false };
const input = {
  appId: target.appId,
  taskId: target.taskId,
  message: "Include Windows version gates.",
  expectedGeneration: 3,
  idempotencyKey: "message-1",
};
function fixture(task: unknown = target) {
  const frames: Record<string, unknown>[] = [];
  const handler = createTaskInputHandler({
    daemonRead: async (frame) => {
      expect(frame).toEqual({ type: "task.get", appId: target.appId, taskId: target.taskId });
      return { type: "ok", task };
    },
    admit: async (frame) => {
      frames.push(frame);
      return { type: "ok", eventId: 17, requestId: "input-17", created: frames.length === 1 };
    },
    json: (body, status = 200) => Response.json(body, { status }),
  });
  return { handler, frames };
}
function request(body: unknown = input, headers: Record<string, string> = {}) {
  return new Request("https://example.test/api/task/input", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("Task-scoped human feedback", () => {
  test("addresses the existing Task with server-owned human attribution and preserves retry identity", async () => {
    const f = fixture();
    const first = await f.handler(request({ ...input, source: { kind: "app", id: "forged" }, threadId: "foreign" }));
    expect(first.status).toBe(202);
    expect(await first.json()).toMatchObject({ accepted: true, eventId: 17, inboxId: "input-17", replayed: false });
    const replay = await f.handler(request());
    expect(await replay.json()).toMatchObject({ accepted: true, replayed: true });
    expect(f.frames[0]).toEqual(f.frames[1]);
    expect(f.frames[0]).toEqual({
      type: "publish",
      event: {
        type: "app.input.requested",
        target: { appId: "example" },
        data: {
          targetTaskId: "support/version",
          input: {
            kind: "message",
            data: {
              message: input.message,
              context: { intent: "task-feedback", taskId: "support/version", expectedGeneration: 3 },
            },
          },
          source: { kind: "human", id: "web-task:message-1" },
          channel: "web-ui",
        },
        idempotencyKey: "web-task:7:example:15:support/version:message-1",
      },
    });
  });
  test("the App selects its accepted input kind without changing Task identity", async () => {
    const f = fixture();
    expect((await f.handler(request({ ...input, inputKind: "owner-review" }))).status).toBe(202);
    expect((f.frames[0].event as any).data.input).toMatchObject({ kind: "owner-review", data: { message: input.message } });
  });
  test("refuses stale scope, a foreign returned Task, and closed or missing work before admission", async () => {
    for (const [task, status] of [
      [{ ...target, generation: 4 }, 409],
      [{ ...target, appId: "foreign" }, 409],
      [{ ...target, terminal: true }, 409],
      [null, 404],
    ] as const) {
      const f = fixture(task);
      expect((await f.handler(request())).status).toBe(status);
      expect(f.frames).toHaveLength(0);
    }
  });
  test("refuses cross-origin writes, invalid JSON, missing retry identity and oversized input", async () => {
    const f = fixture();
    expect((await f.handler(request(input, { origin: "https://foreign.test" }))).status).toBe(403);
    expect((await f.handler(request({ ...input, idempotencyKey: "" }))).status).toBe(400);
    expect((await f.handler(request({ ...input, expectedGeneration: 0 }))).status).toBe(400);
    expect((await f.handler(request({ ...input, message: "x".repeat(17_000) }))).status).toBe(400);
    expect((await f.handler(request({ ...input, message: "x".repeat(34_000) }))).status).toBe(413);
    expect(
      (
        await f.handler(
          new Request("https://example.test/api/task/input", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{",
          }),
        )
      ).status,
    ).toBe(400);
    expect(f.frames).toHaveLength(0);
  });
  test("reports lost admission acknowledgement as unknown and does not claim delivery", async () => {
    const handler = createTaskInputHandler({
      daemonRead: async () => ({ type: "ok", task: target }),
      admit: async () => {
        throw new Error("Socket timeout");
      },
      json: (body, status = 200) => Response.json(body, { status }),
    });
    const response = await handler(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ delivery: "unknown" });
  });
  test("confirms exact admitted input after a lost acknowledgement without reading or admitting again", async () => {
    let recorded: Record<string, unknown> | undefined;
    let admissions = 0;
    let reads = 0;
    const handler = createTaskInputHandler({
      daemonRead: async () => {
        reads++;
        return { type: "ok", task: target };
      },
      confirm: (frame) => (JSON.stringify(frame) === JSON.stringify(recorded) ? { eventId: 24 } : undefined),
      admit: async (frame) => {
        admissions++;
        recorded = frame;
        throw new Error("Socket timeout after publication");
      },
      json: (body, status = 200) => Response.json(body, { status }),
    });
    expect((await handler(request())).status).toBe(503);
    const retry = await handler(request());
    expect(retry.status).toBe(202);
    expect(await retry.json()).toMatchObject({ accepted: true, replayed: true, eventId: 24, generation: 3 });
    expect(admissions).toBe(1);
    expect(reads).toBe(1);
  });

  test("refuses recorded-but-undelivered responses and encodes colon-containing taskIds unambiguously", async () => {
    const seenKeys: string[] = [];
    const handler = createTaskInputHandler({
      daemonRead: async (frame) => ({
        type: "ok",
        task: { appId: frame.appId, taskId: frame.taskId, generation: 1, status: "running", terminal: false },
      }),
      admit: async (frame) => {
        seenKeys.push(frame.event.idempotencyKey);
        if (seenKeys.length === 1) return { type: "ok", eventId: 41, eventType: "app.input.requested", delivery: "recorded" };
        return { type: "ok", eventId: 40 + seenKeys.length, eventType: "app.input.requested", delivery: "accepted", inboxId: `in-${seenKeys.length}` };
      },
      json: (body, status = 200) => Response.json(body, { status }),
    });

    const unconfirmed = await handler(
      request({ appId: "example", taskId: "support:version", message: "First", expectedGeneration: 1, idempotencyKey: "feedback-1" }),
    );
    expect(unconfirmed.status).toBe(503);
    const unconfirmedBody = await unconfirmed.json();
    expect(unconfirmedBody.accepted).toBeUndefined();
    expect(unconfirmedBody).toMatchObject({ delivery: "recorded", eventId: 41 });

    const firstAccepted = await handler(
      request({ appId: "example", taskId: "support:version", message: "First", expectedGeneration: 1, idempotencyKey: "feedback-1" }),
    );
    const secondAccepted = await handler(
      request({ appId: "example", taskId: "support", message: "Second", expectedGeneration: 1, idempotencyKey: "version:feedback-1" }),
    );
    expect(firstAccepted.status).toBe(202);
    expect(secondAccepted.status).toBe(202);
    expect(seenKeys[1]).toBe("web-task:7:example:15:support:version:feedback-1");
    expect(seenKeys[2]).toBe("web-task:7:example:7:support:version:feedback-1");
    expect(seenKeys[1]).not.toBe(seenKeys[2]);

    const bomAccepted = await handler(
      new Request("https://example.test/api/task/input", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: `\uFEFF${JSON.stringify({
          appId: "example",
          taskId: "support",
          message: "BOM-prefixed feedback",
          expectedGeneration: 1,
          idempotencyKey: "bom-feedback-1",
        })}`,
      }),
    );
    expect(bomAccepted.status).toBe(202);
  });
});
