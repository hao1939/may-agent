import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { createAppInputAdmission, createHumanResultAppReviewAdmission } from "./app-runtime.js";
import { EVENT_ROW_ID } from "./event-bus.js";

describe("app runtime startup order", () => {
  it("attaches Telegram admission before external ingress and cron work", () => {
    const source = readFileSync(new URL("./app-runtime.ts", import.meta.url), "utf8");
    const admission = source.indexOf("telegramBot = TELEGRAM_ENABLED");
    const externalIngress = source.indexOf("await startInterfaceRuntime(");
    const cronStartup = source.indexOf("await startCronRuntime(");

    expect(admission).toBeGreaterThan(-1);
    expect(admission).toBeLessThan(externalIngress);
    expect(admission).toBeLessThan(cronStartup);
  });

  it("starts the durable App inbox before opening external ingress", () => {
    const source = readFileSync(new URL("./app-runtime.ts", import.meta.url), "utf8");
    const appInbox = source.indexOf("await startAppInboxRuntime({");
    const externalIngress = source.indexOf("await startInterfaceRuntime(");

    expect(appInbox).toBeGreaterThan(-1);
    expect(appInbox).toBeLessThan(externalIngress);
  });

  it("enables App delivery only after human transports are attached", () => {
    const source = readFileSync(new URL("./app-runtime.ts", import.meta.url), "utf8");
    const telegram = source.indexOf("telegramBot = TELEGRAM_ENABLED");
    const externalIngress = source.indexOf("await startInterfaceRuntime(");
    const delivery = source.indexOf("appInboxRuntime?.enableDelivery()");

    expect(delivery).toBeGreaterThan(telegram);
    expect(delivery).toBeGreaterThan(externalIngress);
  });

  it("runs App owners through the shared reconciliation capacity", () => {
    const source = readFileSync(new URL("./app-runtime.ts", import.meta.url), "utf8");
    expect(source).toContain("runOwner: (work) => runWithProjectAppRuntimeCapacity(bus, work)");
  });
});

describe("App input control admission", () => {
  const command = {
    appId: "aks-rp-e2e",
    input: { kind: "message", data: { message: "review" } },
    source: { kind: "human", id: "web-ui:project-comment-17" },
    conversationId: "web-ui:project:aks-rp-e2e",
    channel: "web-ui",
    idempotencyKey: "project-comment-17",
  };

  it("validates against the live App registry before emitting one retry-safe App input", () => {
    const events: Array<Record<string, unknown>> = [];
    const admit = createAppInputAdmission({
      bus: {
        emit: ((event: Record<string, unknown>) => {
          events.push(event);
          Object.defineProperty(event, EVENT_ROW_ID, { value: 91 });
          return event;
        }) as never,
      },
      getRuntime: () => ({ host: { acceptsInput: () => true } }) as never,
    });

    expect(admit(command)).toEqual({ eventId: 91, eventType: "app.input.requested" });
    expect(events).toEqual([
      {
        type: "app.input.requested",
        source: "control-socket",
        owner: "app:aks-rp-e2e",
        data: {
          appId: "aks-rp-e2e",
          input: command.input,
          source: command.source,
          conversationId: command.conversationId,
          conversationSequence: undefined,
          channel: "web-ui",
          channelThreadId: undefined,
          channelMessageId: undefined,
          idempotencyKey: "project-comment-17",
        },
      },
    ]);
  });

  it("rejects an input the registered App schema does not accept", () => {
    const admit = createAppInputAdmission({
      bus: { emit: (() => null) as never },
      getRuntime: () => ({ host: { acceptsInput: () => false } }) as never,
    });
    expect(() => admit(command)).toThrow("does not accept this input");
  });
});

describe("legacy human result App admission", () => {
  const review = {
    appId: "may",
    source: { kind: "human" as const, id: "event:44" },
    input: {
      kind: "message" as const,
      data: {
        message: "Review the legacy project result.",
        context: {
          compatibility: "legacy-human-result" as const,
          eventType: "project.owner.reviewed",
          requestId: "human-result-review:project:sample:owner:17",
          traceId: "trace-human-project",
          projectId: "sample",
        },
      },
    },
    conversationId: "telegram:chat:123:topic:0:agent:may",
    conversationSequence: 44,
    channel: "telegram" as const,
    channelThreadId: "0",
    channelMessageId: 700,
    idempotencyKey: "human-result-review:project:sample:owner:17",
    trace: { traceId: "trace-human-project", parentEventId: 44 },
  };

  it("emits one retry-safe May App input when the runtime accepts it", () => {
    const events: Array<Record<string, unknown>> = [];
    const admit = createHumanResultAppReviewAdmission({
      bus: {
        emit: ((event: Record<string, unknown>) => {
          events.push(event);
          return event;
        }) as never,
      },
      getRuntime: () => ({ host: { acceptsInput: () => true } }) as never,
    });

    expect(admit(review)).toBe(true);
    expect(events).toEqual([
      {
        type: "app.input.requested",
        source: "human-result-follow-through",
        owner: "app:may",
        data: {
          appId: "may",
          source: review.source,
          input: review.input,
          conversationId: review.conversationId,
          conversationSequence: 44,
          channel: "telegram",
          channelThreadId: "0",
          channelMessageId: 700,
          idempotencyKey: review.idempotencyKey,
        },
        trace: review.trace,
      },
    ]);
  });

  it("leaves startup and non-App modes on the compatibility fallback", () => {
    const events: Array<Record<string, unknown>> = [];
    const admit = createHumanResultAppReviewAdmission({
      bus: { emit: ((event: Record<string, unknown>) => events.push(event)) as never },
      getRuntime: () => null,
    });

    expect(admit(review)).toBe(false);
    expect(events).toEqual([]);
  });

  it("reports a live conversation App contract mismatch before using the fallback", () => {
    const events: Array<Record<string, unknown>> = [];
    const admit = createHumanResultAppReviewAdmission({
      bus: {
        emit: ((event: Record<string, unknown>) => {
          events.push(event);
          return event;
        }) as never,
      },
      getRuntime: () => ({ host: { acceptsInput: () => false } }) as never,
    });

    expect(admit(review)).toBe(false);
    expect(events).toEqual([
      {
        type: "info",
        message:
          "[human-result-follow-through] Conversation App may rejected the compatibility input; using the legacy review fallback",
      },
    ]);
  });
});
