import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildAgentSDK } from "./sdk-impl.js";
import type { SDKDeps } from "./sdk-impl.js";
import { EventBus } from "../app/event-bus.js";
import { DbWriter } from "./db-writer.js";
import { closeDb } from "./requests.js";

type EmittedEvent = { type: string; [key: string]: unknown };

function makeSdk() {
  const root = mkdtempSync(join(tmpdir(), "may-sdk-events-"));
  const events: EmittedEvent[] = [];
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  bus.subscribe((event) => events.push(event as EmittedEvent));
  const deps: SDKDeps = {
    bus,
    persistDir: root,
    projectRoot: root,
    agentsRoot: join(root, "agents"),
    sharedRoot: join(root, "shared"),
    projectsRoot: join(root, "projects"),
    agentName: "dev",
  };
  return { sdk: buildAgentSDK(deps), events, root };
}

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  }
});

describe("Host SDK events", () => {
  it("defaults sdk.emit owner to the emitting agent", () => {
    const { sdk, events, root } = makeSdk();
    roots.push(root);

    sdk.emit("handler.skipped", {
      handler: "dev-handler",
      reason: "missing payload",
    });

    expect(events).toContainEqual({
      type: "handler.skipped",
      source: "agent:dev",
      owner: "agent:dev",
      data: {
        handler: "dev-handler",
        reason: "missing payload",
      },
    });
  });

  it("lets sdk.emit override owner explicitly", () => {
    const { sdk, events, root } = makeSdk();
    roots.push(root);

    sdk.emit(
      "metric.breach",
      { metricId: "system.health", message: "check" },
      { owner: "human:operator", urgency: "high" },
    );

    expect(events).toContainEqual({
      type: "metric.breach",
      source: "agent:dev",
      owner: "human:operator",
      urgency: "high",
      data: { metricId: "system.health", message: "check" },
    });
  });

  it("uses only human as the message shorthand for human:operator", () => {
    const { sdk, events, root } = makeSdk();
    roots.push(root);

    sdk.message("human", "Need approval");
    sdk.message("operator", "Operator agent should receive this");

    const messages = events.filter((event) => event.type === "message.created");
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      owner: "human:operator",
      data: expect.objectContaining({ to: "human" }),
    });
    expect(messages[1]).toMatchObject({
      owner: "agent:operator",
      data: expect.objectContaining({ to: "operator" }),
    });
  });
});
