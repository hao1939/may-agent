import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildAgentSDK, buildWorkflowSDK } from "./sdk-impl.js";
import type { SDKDeps } from "./sdk-impl.js";
import { EventBus } from "../app/event-bus.js";
import { DbWriter } from "./db-writer.js";
import { closeDb } from "./requests.js";

type EmittedEvent = { type: string; [key: string]: unknown };

function makeSdk() {
  const root = mkdtempSync(join(tmpdir(), "may-sdk-escalation-"));
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
    callAgent: async (agent: string) => ({
      sessionId: `s_${agent}`,
      status: "done",
      lastAssistantText: "ok",
    }),
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

describe("AgentSDK escalation", () => {
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

  it("emits canonical escalation.created with envelope fields isolated from data", () => {
    const { sdk, events, root } = makeSdk();
    roots.push(root);

    const ref = sdk.escalate("Missing production decision", {
      owner: "human:operator",
      requestedAction: "Choose whether to deploy now or wait.",
      resumeCondition: "Resume when the deployment owner chooses deploy-now or wait.",
      evidence: { runbook: "deploy.md" },
      severity: "P1",
      projectId: "platform",
      sourceSessionId: "s_123",
      resume: { kind: "session", checkpointRef: "s_123" },
      dedupKey: "deploy:missing-decision",
    });

    const escalation = events.find((event) => event.type === "escalation.created");
    expect(escalation).toBeDefined();
    expect(escalation).toMatchObject({
      type: "escalation.created",
      source: "agent:dev",
      owner: "human:operator",
      urgency: "high",
    });
    expect(escalation).not.toHaveProperty("reason");
    expect(escalation).not.toHaveProperty("projectId");
    expect(escalation).not.toHaveProperty("sourceSessionId");

    const data = escalation?.data as Record<string, unknown>;
    expect(data).toMatchObject({
      sourceAgent: "dev",
      sourceSessionId: "s_123",
      projectId: "platform",
      reason: "Missing production decision",
      requestedAction: "Choose whether to deploy now or wait.",
      resumeCondition: "Resume when the deployment owner chooses deploy-now or wait.",
      evidence: { runbook: "deploy.md" },
      severity: "P1",
      resume: {
        kind: "session",
        checkpointRef: "s_123",
        condition: "Resume when the deployment owner chooses deploy-now or wait.",
      },
      dedupKey: "deploy:missing-decision",
    });
    expect(typeof data.escalationId).toBe("string");
    expect(data.escalationId).toMatch(/^esc_/);
    expect(ref).toEqual({ eventId: expect.any(Number), compatibilityId: data.escalationId });
    expect(data).not.toHaveProperty("owner");
  });

  it("uses a straightforward default for sdk.escalate(reason)", () => {
    const { sdk, events, root } = makeSdk();
    roots.push(root);

    sdk.escalate("Blocked on missing API key");

    const escalation = events.find((event) => event.type === "escalation.created");
    const syntheticMessages = events.filter((event) => event.type === "message.created");
    const data = escalation?.data as Record<string, unknown>;
    expect(escalation).toMatchObject({
      type: "escalation.created",
      source: "agent:dev",
      owner: "agent:may",
      urgency: "normal",
    });
    expect(data).toMatchObject({
      sourceAgent: "dev",
      reason: "Blocked on missing API key",
      requestedAction: "Investigate and resolve or answer this blocker: Blocked on missing API key",
      severity: "P2",
    });
    expect(data.resume).toBeUndefined();
    expect(syntheticMessages).toHaveLength(0);
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

  it("uses owner options for non-default escalation routing", () => {
    const { sdk, events, root } = makeSdk();
    roots.push(root);

    sdk.escalate("Metric breached but fix unclear", { owner: "may" });
    sdk.escalate("Need operator approval", { owner: "human" });

    const escalations = events.filter((event) => event.type === "escalation.created");
    expect(escalations).toHaveLength(2);
    expect(escalations[0]).toMatchObject({ owner: "agent:may" });
    expect(escalations[0].data).toMatchObject({
      reason: "Metric breached but fix unclear",
    });
    expect(escalations[0].data).not.toHaveProperty("evidence");
    expect(escalations[1]).toMatchObject({ owner: "human:operator" });
    expect(escalations[1].data).toMatchObject({
      reason: "Need operator approval",
    });
    expect(escalations[1].data).not.toHaveProperty("evidence");
  });

  it("rejects the removed sdk.escalate(target, reason) shape", () => {
    const { sdk, events, root } = makeSdk();
    roots.push(root);

    expect(() => (sdk.escalate as any)("may", "Metric breached but fix unclear")).toThrow(
      /sdk\.escalate\(reason, opts\?\)/,
    );
    expect(events.some((event) => event.type === "escalation.created")).toBe(false);
  });

  it("does not write a separate escalation side log", () => {
    const { sdk, events, root } = makeSdk();
    roots.push(root);

    sdk.escalate("Build cannot continue");

    expect(events.some((event) => event.type === "escalation.created")).toBe(true);
    expect(existsSync(join(root, "escalations.jsonl"))).toBe(false);
  });
});

describe("WorkflowSDK blocking", () => {
  it("keeps workflow blocked local and does not emit escalation.created", () => {
    const root = mkdtempSync(join(tmpdir(), "may-workflow-sdk-escalation-"));
    roots.push(root);
    const events: EmittedEvent[] = [];
    const finished: unknown[] = [];
    const sdk = buildWorkflowSDK({
      bus: { emit: (event: EmittedEvent) => events.push(event) } as never,
      persistDir: root,
      projectRoot: root,
      agentsRoot: join(root, "agents"),
      sharedRoot: join(root, "shared"),
      projectsRoot: join(root, "projects"),
      agentName: "dev",
      task: "ship migration",
      callAgent: async (agent: string) => ({
        sessionId: `s_${agent}`,
        status: "done",
        lastAssistantText: "ok",
      }),
      finish: (result) => finished.push(result),
    });

    sdk.blocked("missing approval", {
      owner: "human:operator",
      requestedAction: "Approve or reject the rollout",
      evidence: { change: "database migration" },
    });

    expect(events.some((event) => event.type === "escalation.created")).toBe(false);
    expect(events.some((event) => event.type === "message.created")).toBe(false);
    expect(finished).toEqual([{ status: "blocked", summary: "missing approval" }]);
  });
});
