import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { createAppInputAdmission, createProjectActionAccess } from "./app-runtime.js";
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

  it("publishes inbox and compatibility task routes in one registry transaction", () => {
    const source = readFileSync(new URL("./app-runtime.ts", import.meta.url), "utf8");
    expect(source).toContain("appTasks.publishGeneration({ snapshot, publish: commit })");
    expect(source).toContain("appTasks.watchGenerations(() => handleReload({ throwOnError: true }))");
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

describe("canonical project actions", () => {
  it("admits a canonical action as App input and rejects unknown Apps", () => {
    const admitted: unknown[] = [];
    const access = createProjectActionAccess({
      bus: { emit: (() => null) as never },
      getRuntime: () =>
        ({
          host: {
            hasApp: (id: string) => id.replace(/\.app$/, "") === "evaluation",
            describeActions: () => [{ id: "review", description: "Review", inputSchema: { type: "object" } }],
            actionInput: () => ({ kind: "review", data: { scope: "current" } }),
          },
        }) as never,
      admit: (input) => {
        admitted.push(input);
        return { eventId: 1, eventType: "app.input.requested" };
      },
    });

    expect(access.describe("evaluation.app")).toEqual([
      { id: "review", description: "Review", inputSchema: { type: "object" } },
    ]);
    expect(
      access.invoke({ projectId: "evaluation.app", actionId: "review", params: {}, idempotencyKey: "action-1" }),
    ).toEqual({ eventId: 1, eventType: "app.input.requested" });
    expect(admitted).toEqual([
      {
        appId: "evaluation",
        input: { kind: "review", data: { scope: "current" } },
        source: { kind: "human", id: "control-socket:project-action" },
        idempotencyKey: "action-1",
      },
    ]);

    expect(() => access.invoke({ projectId: "legacy", actionId: "run", params: {} })).toThrow(
      "App legacy is not loaded",
    );
  });

  it("emits a staged legacy action's declared semantic event without an App inbox wrapper", () => {
    const events: Array<Record<string, unknown>> = [];
    const admitted: unknown[] = [];
    const access = createProjectActionAccess({
      bus: {
        emit: ((event: Record<string, unknown>) => {
          events.push(event);
          Object.defineProperty(event, EVENT_ROW_ID, { value: 73 });
          return event;
        }) as never,
      },
      getRuntime: () =>
        ({
          host: {
            hasApp: () => true,
            appOwner: () => "evaluator",
            describeActions: () => [],
            actionInput: () => ({
              kind: "legacy-action",
              data: {
                actionId: "review-project-app",
                event: {
                  type: "evaluation.project.review.requested",
                  project: "evaluation",
                  params: { targetProject: "aks-rp-e2e.app", reason: "routing-repair" },
                  data: {},
                },
              },
            }),
          },
        }) as never,
      admit: (input) => {
        admitted.push(input);
        return { eventId: 99, eventType: "app.input.requested" };
      },
    });

    expect(
      access.invoke({
        projectId: "evaluation.app",
        actionId: "review-project-app",
        params: { targetProject: "aks-rp-e2e.app" },
        idempotencyKey: "review-project-app:73",
      }),
    ).toEqual({ eventId: 73, eventType: "evaluation.project.review.requested" });
    expect(admitted).toEqual([]);
    expect(events).toEqual([
      {
        type: "evaluation.project.review.requested",
        project: "evaluation",
        params: { targetProject: "aks-rp-e2e.app", reason: "routing-repair" },
        source: "project-app:evaluation:action:review-project-app",
        owner: "agent:evaluator",
        data: {
          project: "evaluation",
          params: { targetProject: "aks-rp-e2e.app", reason: "routing-repair" },
          idempotencyKey: "review-project-app:73",
        },
      },
    ]);
  });
});
