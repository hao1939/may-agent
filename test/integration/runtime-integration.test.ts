import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Cron } from "../../src/app/cron.js";
import { EventBus } from "../../src/app/event-bus.js";
import { DbWriter } from "../../src/lib/db-writer.js";
import { closeDb, getDb } from "../../src/lib/requests.js";
import { buildAgentSDK, type SDKDeps } from "../../src/lib/sdk-impl.js";
import { SubagentManager } from "../../src/lib/manager.js";
import { createWorkflowTool } from "../../src/lib/workflow-tool.js";
import type { WorkflowToolResult } from "../../src/lib/workflow.js";

type RuntimeEvent = { type: string; [key: string]: unknown };

const roots: string[] = [];
const stateDirs: string[] = [];

function makeRoot(prefix: string): { root: string; stateDir: string } {
  const root = mkdtempSync(join(tmpdir(), prefix));
  const stateDir = join(root, ".state");
  mkdirSync(stateDir, { recursive: true });
  roots.push(root);
  stateDirs.push(stateDir);
  return { root, stateDir };
}

function waitForAsyncHandlers(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

afterEach(() => {
  for (const stateDir of stateDirs.splice(0)) closeDb(stateDir);
  for (const root of roots.splice(0)) {
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  }
});

describe("runtime integration", () => {
  it("persists canonical escalation events and delivers the same envelope to cron subscribers", async () => {
    const { root, stateDir } = makeRoot("may-runtime-integration-");
    const configPath = join(root, "cron.json");
    writeFileSync(
      configPath,
      JSON.stringify([
        {
          name: "escalation-reactor",
          enabled: true,
          handler: "escalation-reactor",
          on: ["escalation.created"],
        },
      ]),
      "utf-8",
    );

    const bus = new EventBus();
    const writer = new DbWriter(stateDir);
    const handled: unknown[] = [];
    bus.setPersistenceSubscriber(writer.handler);

    const cron = new Cron(
      configPath,
      {} as never,
      () => "",
      undefined,
      root,
      undefined,
      (event) => bus.emit(event as never),
    );
    cron.load();
    cron.registerHandler("escalation-reactor", async (event) => {
      handled.push(event);
    });
    cron.subscribeToBus(bus);

    bus.emit({
      type: "escalation.created",
      source: "agent:dev",
      owner: "agent:may",
      urgency: "high",
      data: {
        escalationId: "esc_integration",
        sourceAgent: "dev",
        reason: "Need a decision",
        requestedAction: "Decide the rollout window",
        severity: "P1",
      },
    } as never);
    await waitForAsyncHandlers();
    cron.stop();

    const db = getDb(stateDir);
    const row = db
      .prepare("SELECT event_type, source, owner, urgency, data FROM events WHERE event_type = ?")
      .get("escalation.created") as {
      event_type: string;
      source: string;
      owner: string;
      urgency: string;
      data: string;
    };
    expect(row).toMatchObject({
      event_type: "escalation.created",
      source: "agent:dev",
      owner: "agent:may",
      urgency: "high",
    });
    expect(JSON.parse(row.data)).toEqual({
      escalationId: "esc_integration",
      sourceAgent: "dev",
      reason: "Need a decision",
      requestedAction: "Decide the rollout window",
      resumeCondition: "Decide the rollout window",
      severity: "P1",
    });
    expect(JSON.parse(row.data)).not.toHaveProperty("owner");

    expect(handled).toHaveLength(1);
    expect(handled[0]).toMatchObject({
      type: "escalation.created",
      source: "agent:dev",
      owner: "agent:may",
      urgency: "high",
      data: {
        escalationId: "esc_integration",
        reason: "Need a decision",
        resumeCondition: "Decide the rollout window",
      },
    });
  });

  it("persists Host observations and messages without inventing an escalation", () => {
    const { root, stateDir } = makeRoot("may-sdk-runtime-");
    const bus = new EventBus();
    const writer = new DbWriter(stateDir);
    bus.setPersistenceSubscriber(writer.handler);

    const deps: SDKDeps = {
      bus,
      persistDir: stateDir,
      projectRoot: root,
      agentsRoot: join(root, "agents"),
      sharedRoot: join(root, "shared"),
      projectsRoot: join(root, "projects"),
      agentName: "dev",
    };
    const sdk = buildAgentSDK(deps);

    sdk.emit("host.credentials.observed", { available: false });
    sdk.message("reviewer", "Please inspect the migration.");

    const db = getDb(stateDir);
    const observation = db
      .prepare("SELECT source, owner, data FROM events WHERE event_type = ? ORDER BY id ASC LIMIT 1")
      .get("host.credentials.observed") as { source: string; owner: string; data: string };
    expect(observation).toMatchObject({
      source: "agent:dev",
      owner: "agent:dev",
    });
    expect(JSON.parse(observation.data)).toEqual({ available: false });
    expect(db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = ?").get("escalation.created")).toEqual({
      count: 0,
    });

    const messages = db
      .prepare("SELECT source, owner, data FROM events WHERE event_type = ? ORDER BY id ASC")
      .all("message.created") as Array<{ source: string; owner: string; data: string }>;
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ source: "agent:dev", owner: "agent:reviewer" });
    expect(JSON.parse(messages[0].data)).toMatchObject({
      from: "dev",
      to: "reviewer",
      content: "Please inspect the migration.",
    });
  });

  it("sends SDK metric events through the same canonical envelope", () => {
    const { root, stateDir } = makeRoot("may-sdk-metrics-");
    const bus = new EventBus();
    const writer = new DbWriter(stateDir);
    bus.setPersistenceSubscriber(writer.handler);

    const sdk = buildAgentSDK({
      bus,
      persistDir: stateDir,
      projectRoot: root,
      agentsRoot: join(root, "agents"),
      sharedRoot: join(root, "shared"),
      projectsRoot: join(root, "projects"),
      agentName: "dev",
    });

    sdk.metrics.define({
      id: "reviewer.queue-depth",
      threshold: 1,
      target: 0,
      alertOp: ">",
      priority: "P1",
    });
    sdk.metrics.record("reviewer.queue-depth", 2);
    sdk.metrics.evaluate("reviewer.queue-depth");

    const breach = getDb(stateDir)
      .prepare("SELECT source, owner, urgency, data FROM events WHERE event_type = ?")
      .get("metric.breach") as { source: string; owner: string; urgency: string; data: string };
    expect(breach).toMatchObject({
      source: "agent:dev",
      owner: "agent:reviewer",
      urgency: "high",
    });
    expect(JSON.parse(breach.data)).toMatchObject({
      metricId: "reviewer.queue-depth",
      priority: "P1",
    });
    expect(JSON.parse(breach.data)).not.toHaveProperty("owner");
  });

  it("keeps a workflow blocker local instead of manufacturing an external handoff", async () => {
    const { root, stateDir } = makeRoot("may-workflow-boundary-");
    const workflowDir = join(root, "agents", "dev", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(workflowDir, "blocked.ts"),
      `
      export const name = "blocked";
      export const description = "Reports a local blocker without owning a handoff";
      export async function execute(ctx) {
        return ctx.blocked("missing approval", {
          owner: "human:operator",
          requestedAction: "Approve or reject the rollout",
          evidence: { change: "database migration" },
        });
      }
    `,
      "utf-8",
    );

    const bus = new EventBus();
    const writer = new DbWriter(stateDir);
    const runtimeEvents: RuntimeEvent[] = [];
    bus.setPersistenceSubscriber(writer.handler);
    bus.subscribe((event) => runtimeEvents.push(event as RuntimeEvent));

    const manager = new SubagentManager({ persistDir: stateDir });
    const tool = createWorkflowTool({
      manager,
      workflowDir,
      agentName: "dev",
      runtimeCtx: {
        emit: (event: RuntimeEvent) => bus.emit(event as never),
        dispatchEvent: () => {},
        getDb: () => getDb(stateDir),
        query: {} as never,
        log: () => {},
        notify: () => {},
        metrics: {} as never,
        persistDir: stateDir,
        projectRoot: root,
        agentsRoot: join(root, "agents"),
        sharedRoot: join(root, "shared"),
        projectsRoot: join(root, "projects"),
      },
    });

    const result = await tool.execute("tc1", {
      action: "run",
      name: "blocked",
      task: "ship migration",
    });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("blocked");
    expect(runtimeEvents.some((event) => event.type === "escalation.created")).toBe(false);
    const escalations = getDb(stateDir)
      .prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = ?")
      .get("escalation.created") as { count: number };
    expect(escalations.count).toBe(0);
    expect(parsed).toMatchObject({ type: "blocked", reason: "missing approval" });
  });
});
