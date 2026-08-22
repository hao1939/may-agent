import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { createAppInputAdmission, createProjectActionAccess } from "./app-runtime.js";

describe("app runtime startup order", () => {
  it("attaches the Telegram Conversation adapter before external ingress and cron work", () => {
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

  it("does not construct a parallel persistent May chat session", () => {
    const source = readFileSync(new URL("./app-runtime.ts", import.meta.url), "utf8");
    expect(source).not.toContain("ChatSession");
    expect(source).not.toContain("chatSession");
    expect(source).not.toContain("getSessionId: () => taskSessionId");
    expect(source).toContain("startInitialTask");
  });

  it("enters readline only when the console interface is enabled", () => {
    const source = readFileSync(new URL("./app-runtime.ts", import.meta.url), "utf8");
    expect(source).toContain("else if (CONSOLE_ENABLED && process.stdin.isTTY)");
  });

  it("does not couple Task completion to a transport delivery gate", () => {
    const source = readFileSync(new URL("./app-runtime.ts", import.meta.url), "utf8");
    expect(source).not.toContain("enableDelivery");
    expect(source).not.toContain("setEventPublisher");
  });

  it("uses configured Host capacity without an App-owner execution path", () => {
    const source = readFileSync(new URL("./app-runtime.ts", import.meta.url), "utf8");
    expect(source).toContain("const hostCapacity = new HostCapacity");
    expect(source).toContain("process.env.MAY_HOST_MAX_CONCURRENT ?? 4");
    expect(source).toContain("maxConcurrentRequests: configuredHostConcurrency");
    expect(source).not.toContain("runOwner:");
    expect(source).not.toContain("createManagerAppOwnerInvoker");
  });

  it("publishes inbox and canonical task routes in one registry transaction", () => {
    const source = readFileSync(new URL("./app-runtime.ts", import.meta.url), "utf8");
    expect(source).toContain("appTasks.publishGeneration({ snapshot, publish: commit })");
  });

  it("reloads App generations explicitly instead of polling every source file", () => {
    const runtime = readFileSync(new URL("./app-runtime.ts", import.meta.url), "utf8");
    const tasks = readFileSync(new URL("./app-task-runtime.ts", import.meta.url), "utf8");
    expect(runtime).toContain("reloadApps: async () =>");
    expect(runtime).not.toContain("watchGenerations");
    expect(tasks).not.toContain("appTaskHostFingerprint");
    expect(tasks).not.toContain("Auto-reloaded");
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
      events: {
        publish: ((event: Record<string, unknown>, context: Record<string, unknown>) => {
          events.push({ event, context });
          return { eventId: 91, eventType: "app.input.requested", delivery: "accepted" };
        }) as never,
      },
    });

    expect(admit(command)).toEqual({
      eventId: 91,
      eventType: "app.input.requested",
      delivery: "accepted",
    });
    expect(events).toEqual([
      {
        event: {
          type: "app.input.requested",
          target: { appId: "aks-rp-e2e" },
          idempotencyKey: "project-comment-17",
          data: {
            input: command.input,
            conversationId: command.conversationId,
            conversationSequence: undefined,
            channel: "web-ui",
            channelThreadId: undefined,
            channelMessageId: undefined,
          },
        },
        context: { source: "control-socket", inputSource: command.source },
      },
    ]);
  });

  it("rejects an input the registered App schema does not accept", () => {
    const admit = createAppInputAdmission({
      events: {
        publish: (() => {
          throw new Error("App aks-rp-e2e does not accept this input");
        }) as never,
      },
    });
    expect(() => admit(command)).toThrow("does not accept this input");
  });
});

describe("canonical project actions", () => {
  it("admits a canonical action as App input and rejects unknown Apps", () => {
    const admitted: unknown[] = [];
    const access = createProjectActionAccess({
      events: { publish: (() => null) as never },
      getRuntime: () =>
        ({
          host: {
            hasApp: (id: string) => id.replace(/\.app$/, "") === "evaluation",
            describeActions: () => [{ id: "review", description: "Review", inputSchema: { type: "object" } }],
            invokeAction: () => ({ kind: "input", input: { kind: "review", data: { scope: "current" } } }),
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

  it("returns a declared semantic event receipt without creating an App input", () => {
    const emitted: Record<string, unknown>[] = [];
    let admissions = 0;
    const access = createProjectActionAccess({
      events: {
        publish: ((event: Record<string, unknown>, context: Record<string, unknown>) => {
          emitted.push({ event, context });
          return {
            eventId: 73,
            eventType: "evaluation.project.review.requested",
            delivery: "accepted",
            links: [{ kind: "task", id: "evaluation/runtime/project-audit/aks-rp-e2e.app" }],
          };
        }) as never,
      },
      getRuntime: () =>
        ({
          host: {
            hasApp: () => true,
            invokeAction: () => ({
              kind: "event",
              event: {
                type: "evaluation.project.review.requested",
                data: { targetProject: "aks-rp-e2e.app", reason: "manual-proof" },
                target: { appId: "evaluation", project: "evaluation" },
              },
            }),
          },
        }) as never,
      admit: (() => {
        admissions += 1;
        return { eventId: 0, eventType: "app.input.requested" };
      }) as never,
    });

    expect(
      access.invoke({
        projectId: "evaluation.app",
        actionId: "publish-project-review",
        params: { targetProject: "aks-rp-e2e.app", reason: "manual-proof" },
        idempotencyKey: "publish-project-review:73",
      }),
    ).toEqual({
      eventId: 73,
      eventType: "evaluation.project.review.requested",
      delivery: "accepted",
      links: [{ kind: "task", id: "evaluation/runtime/project-audit/aks-rp-e2e.app" }],
    });
    expect(admissions).toBe(0);
    expect(emitted).toEqual([
      {
        event: {
          type: "evaluation.project.review.requested",
          data: {
            targetProject: "aks-rp-e2e.app",
            reason: "manual-proof",
          },
          target: { appId: "evaluation", project: "evaluation" },
          idempotencyKey: "publish-project-review:73",
        },
        context: {
          source: "app:evaluation:action:publish-project-review",
          allowUnregistered: true,
        },
      },
    ]);
  });
});
