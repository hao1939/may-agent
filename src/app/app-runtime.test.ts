import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { createAppInputAdmission } from "./app-runtime.js";
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
    expect(source).not.toContain("appInboxRuntime = CRON_ENABLED");
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
    expect(source).toContain("const appTasks = createAppTaskCapability");
    expect(source).toContain("runOwner: appTasks.runOwner");
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
