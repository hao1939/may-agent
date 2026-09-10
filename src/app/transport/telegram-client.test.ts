import { describe, expect, it, spyOn } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb } from "../../lib/db/connection.js";
import { createTelegramClient, splitTelegramMessage } from "./telegram-client.js";

function networkFixture(handler?: (request: Request, call: number) => Response | Promise<Response>) {
  const persistDir = mkdtempSync(join(tmpdir(), "telegram-network-"));
  const arrived = Promise.withResolvers<void>();
  const held = Promise.withResolvers<Response>();
  let calls = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    idleTimeout: 0,
    fetch(request) {
      calls++;
      arrived.resolve();
      return handler ? handler(request, calls) : held.promise;
    },
  });
  const nativeFetch = fetch;
  const messages: string[] = [];
  const client = createTelegramClient({
    token: "fixture-token",
    persistDir,
    emitInfo: (message) => messages.push(message),
    fetchImpl: ((url, init) => nativeFetch(new URL(new URL(String(url)).pathname, server.url), init)) as typeof fetch,
  });
  return {
    client,
    persistDir,
    messages,
    arrived: arrived.promise,
    calls: () => calls,
    close() {
      client.close();
      held.resolve(Response.json({ ok: true, result: [] }));
      server.stop(true);
      closeDb(persistDir);
      rmSync(persistDir, { recursive: true, force: true });
    },
  };
}

describe("telegram client", () => {
  it("bounds a stalled response body without retrying an uncertain formatted send", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"ok":'));
      },
    });
    const fixture = networkFixture(() => new Response(stream));
    try {
      const result = fixture.client.sendMessage("chat-1", "*hello*", "Markdown");
      await fixture.arrived;
      await expect(result).resolves.toBeUndefined();
      expect(fixture.calls()).toBe(1);
      expect(fixture.messages.join("\n")).toContain("timed out");
    } finally {
      fixture.close();
    }
  }, 25_000);

  it("gives long polling more than the server wait and aborts it on close", async () => {
    const fixture = networkFixture();
    const timers = spyOn(globalThis, "setTimeout");
    try {
      const pending = fixture.client.apiCall("getUpdates", { timeout: 30 });
      const outcome = pending.catch((error: unknown) => error);
      await fixture.arrived;
      expect(timers.mock.calls.some(([, delay]) => delay === 45_000)).toBe(true);
      fixture.client.close();
      fixture.client.close();
      expect(await outcome).toMatchObject({ name: "AbortError" });
      await expect(fixture.client.apiCall("getMe")).rejects.toThrow("closed");
      await expect(fixture.client.sendMessage("chat-1", "later")).resolves.toBeUndefined();
      expect(fixture.calls()).toBe(1);
    } finally {
      timers.mockRestore();
      fixture.close();
    }
  });

  it("stops remaining chunks on close and retains the confirmed first receipt", async () => {
    const secondArrived = Promise.withResolvers<void>();
    const secondResponse = Promise.withResolvers<Response>();
    const fixture = networkFixture((_request, call) => {
      if (call === 1) return Response.json({ ok: true, result: { message_id: 888 } });
      secondArrived.resolve();
      return secondResponse.promise;
    });
    try {
      const pending = fixture.client.sendMessage("chat-1", "a".repeat(9_000), "Markdown", {
        eventType: "telegram.reply",
      });
      await secondArrived.promise;
      fixture.client.close();
      await expect(pending).resolves.toBeUndefined();
      expect(fixture.calls()).toBe(2);
      const { getNotificationMessage } = await import("../../lib/db/notifications.js");
      expect(getNotificationMessage(fixture.persistDir, 888)?.event_type).toBe("telegram.reply");
    } finally {
      secondResponse.resolve(Response.json({ ok: true, result: {} }));
      fixture.close();
    }
  });

  it("retries plain text only after a confirmed formatting rejection", async () => {
    const bodies: Record<string, unknown>[] = [];
    const fixture = networkFixture(async (request, call) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return call === 1
        ? Response.json(
            { ok: false, error_code: 400, description: "Bad Request: can't parse entities" },
            { status: 400 },
          )
        : Response.json({ ok: true, result: { message_id: 999 } });
    });
    try {
      await expect(fixture.client.sendMessage("chat-1", "*hello", "Markdown")).resolves.toBe(999);
      expect(bodies.map((body) => body.parse_mode)).toEqual(["Markdown", undefined]);
      expect(bodies.map((body) => body.text)).toEqual(["*hello", "*hello"]);
    } finally {
      fixture.close();
    }
  });

  it("does not retry a different provider rejection as plain text", async () => {
    const fixture = networkFixture(() =>
      Response.json(
        {
          ok: false,
          error_code: 400,
          description: "Bad Request: chat not found",
        },
        { status: 400 },
      ),
    );
    try {
      await expect(fixture.client.sendMessage("chat-1", "hello", "Markdown")).resolves.toBeUndefined();
      expect(fixture.calls()).toBe(1);
    } finally {
      fixture.close();
    }
  });

  it("splits long messages without dropping content", () => {
    const chunks = splitTelegramMessage(["one", "two", "three"].join("\n"), 8);
    expect(chunks).toEqual(["one\ntwo", "three"]);
  });

  it("can send a bot message as a reply to keep the Telegram conversation chain", async () => {
    const persistDir = mkdtempSync(join(tmpdir(), "telegram-client-"));
    const bodies: Record<string, unknown>[] = [];
    try {
      const client = createTelegramClient({
        token: "token",
        persistDir,
        emitInfo: () => {},
        fetchImpl: (async (_url: string | URL | Request, init?: RequestInit) => {
          bodies.push(JSON.parse(String(init?.body ?? "{}")));
          return new Response(JSON.stringify({ ok: true, result: { message_id: 321 } }), {
            headers: { "content-type": "application/json" },
          });
        }) as typeof fetch,
      });

      const msgId = await client.sendMessage("chat-1", "Received. May is handling it.", undefined, {
        eventType: "telegram.reply",
        agent: "may",
        data: JSON.stringify({ conversationId: "tg_focus_1" }),
        replyToMessageId: 123,
      });

      expect(msgId).toBe(321);
      expect(bodies).toHaveLength(1);
      expect(bodies[0]).toMatchObject({
        chat_id: "chat-1",
        text: "Received. May is handling it.",
        reply_parameters: {
          message_id: 123,
          allow_sending_without_reply: true,
        },
      });
    } finally {
      closeDb(persistDir);
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("indexes sent-message delivery context independently of its payload", async () => {
    const persistDir = mkdtempSync(join(tmpdir(), "telegram-client-delivery-"));
    try {
      const client = createTelegramClient({
        token: "token",
        persistDir,
        emitInfo: () => {},
        fetchImpl: (async () => {
          return new Response(JSON.stringify({ ok: true, result: { message_id: 654 } }), {
            headers: { "content-type": "application/json" },
          });
        }) as typeof fetch,
      });

      await client.sendMessage("chat-1", "📋 Approval packet dispatch", undefined, {
        eventType: "message.created",
        agent: "aks-explorer",
        projectId: "projects/alpha-project.app",
        data: JSON.stringify({
          approvalId: "approval-123",
          waitId: "wait-123",
          pathId: "path.network.example",
          packetPath: "evidence/archive/example-approval.md",
          conversationId: "approval:approval-123",
          originalIssue: {
            eventType: "project.approval.requested",
            approvalId: "approval-123",
            waitId: "wait-123",
          },
          expectedResponse: {
            type: "project.approval.submitted",
            approvalId: "approval-123",
            waitId: "wait-123",
          },
        }),
      });

      const { getNotificationMessage } = await import("../../lib/db/notifications.js");
      const row = getNotificationMessage(persistDir, 654);
      expect(row).toMatchObject({
        event_type: "message.created",
        agent: "aks-explorer",
        project_id: "projects/alpha-project.app",
      });
      expect(JSON.parse(String(row?.data))).toMatchObject({
        approvalId: "approval-123",
        waitId: "wait-123",
        pathId: "path.network.example",
        packetPath: "evidence/archive/example-approval.md",
        conversationId: "approval:approval-123",
        originalIssue: {
          eventType: "project.approval.requested",
          approvalId: "approval-123",
          waitId: "wait-123",
        },
        expectedResponse: {
          type: "project.approval.submitted",
          approvalId: "approval-123",
          waitId: "wait-123",
        },
      });
    } finally {
      closeDb(persistDir);
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("stores reply context for every chunk of a long message", async () => {
    const persistDir = mkdtempSync(join(tmpdir(), "telegram-client-chunks-"));
    let nextMessageId = 700;
    try {
      const client = createTelegramClient({
        token: "token",
        persistDir,
        emitInfo: () => {},
        fetchImpl: (async () => {
          return new Response(JSON.stringify({ ok: true, result: { message_id: nextMessageId++ } }), {
            headers: { "content-type": "application/json" },
          });
        }) as typeof fetch,
      });

      await client.sendMessage("chat-1", `${"a".repeat(4090)}\n${"b".repeat(40)}`, undefined, {
        eventType: "message.created",
        agent: "may",
        data: JSON.stringify({ conversationId: "approval:chunked" }),
      });

      const { getNotificationMessage } = await import("../../lib/db/notifications.js");
      expect(JSON.parse(String(getNotificationMessage(persistDir, 700)?.data))).toMatchObject({
        conversationId: "approval:chunked",
      });
      expect(JSON.parse(String(getNotificationMessage(persistDir, 701)?.data))).toMatchObject({
        conversationId: "approval:chunked",
      });
    } finally {
      closeDb(persistDir);
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("does not report a multipart send as delivered when any chunk is uncertain", async () => {
    const persistDir = mkdtempSync(join(tmpdir(), "telegram-client-partial-"));
    let attempt = 0;
    try {
      const client = createTelegramClient({
        token: "token",
        persistDir,
        emitInfo: () => {},
        fetchImpl: (async () => {
          attempt += 1;
          if (attempt === 2) throw new Error("connection ended before a response");
          return new Response(JSON.stringify({ ok: true, result: { message_id: 800 } }), {
            headers: { "content-type": "application/json" },
          });
        }) as typeof fetch,
      });

      await expect(client.sendMessage("chat-1", "a".repeat(5_000))).resolves.toBeUndefined();
      expect(attempt).toBe(2);
    } finally {
      closeDb(persistDir);
      rmSync(persistDir, { recursive: true, force: true });
    }
  });
});
