import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineApp, Type } from "@may-agent/sdk";
import { buildTools, type ToolsetLoaderOptions } from "./toolset-loader.js";
import type { AgentConfig } from "./agent-config.js";
import { listConfiguredAgentNames } from "./agent-discovery.js";
import { AppRegistry } from "../core/apps/registry.js";
import { EventBus } from "../core/events/bus.js";
import { HostCapacity } from "../core/scheduling/host-capacity.js";
import { closeInstalledAppTaskRuntimes, installAppTaskRuntimes } from "../core/tasks/app-task-runtime.js";
import { startAppInboxRuntime, type AppInboxRuntime } from "../composition/app-inbox-runtime.js";
import { DbWriter } from "../../lib/db-writer.js";
import { closeDb, getDb } from "../../lib/db/connection.js";
import { runWithAgentSessionContext } from "../../lib/agent-session-context.js";
import { fakeTaskAttacher } from "../../../test/fixtures/task-attachment.js";
import { prepareDaemonAgents } from "../daemon-agents.js";
import { SubagentManager } from "../../lib/manager.js";
import { fakeModel } from "../../../test/fixtures/model.js";

test("message tools use loaded App destinations while helpers remain discoverable", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-message-targets-"));
  const bus = new EventBus();
  const db = getDb(root);
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  let runtime: AppInboxRuntime | undefined;
  let peer = "recipient";
  const definition = (id: string, agent = id) => defineApp({
    id, version: 1, agent,
    inputSchema: Type.Object({ kind: Type.Literal("message"), data: Type.Object({ message: Type.String() }) }),
    tasks: {},
    task: ({ id: inputId }) => ({ kind: "desired", intent: {
      id: `work/${inputId}`, parentId: "root", outcome: "Read the notification", acceptance: ["Considered"],
    } }),
  });
  const registry = new AppRegistry(async () => [
    { appDir: join(root, "sender.app"), definition: definition("sender") },
    { appDir: join(root, "peer.app"), definition: definition("peer", peer) },
    { appDir: join(root, "no-handler.app"), definition: { ...definition("no-handler"), task: undefined } },
  ]);
  try {
    const helperDir = join(root, "agents", "helper");
    mkdirSync(helperDir, { recursive: true });
    writeFileSync(join(helperDir, "agent.json"), JSON.stringify({ name: "helper", tools: [] }));
    expect(listConfiguredAgentNames(join(root, "agents"), root)).toContain("helper");
    await registry.reload();
    await installAppTaskRuntimes({
      bus, persistDir: root, projectRoot: root, projectsRoot: root,
      appRegistry: registry, hostCapacity: new HostCapacity(1), taskAppIds: ["sender"],
      installControllers: false, syncReadModels: false,
    }, { deferRecovery: true });
    expect(registry.messageTargets()).toEqual(["recipient", "sender"]);
    runtime = await startAppInboxRuntime({
      bus, db, registry, persistDir: root, schedulesEnabled: false,
      attachTask: fakeTaskAttacher(db, ({ attachment }) => ({ taskId: attachment.intent.id })),
    });
    const tools = await buildTools({ name: "sender", tools: ["message"] } as AgentConfig, {
      agentsRoot: join(root, "agents"), sharedRoot: root, projectsRoot: root, projectRoot: root,
      persistDir: root, bus, manager: { activeSessions: new Map() }, cronEnabled: false,
      appRegistry: registry,
      getAgentSessionId: () => "wrong-same-name-session",
    } as unknown as ToolsetLoaderOptions);
    const tool = tools.find(({ name }) => name === "message")!;
    const call = async (to: string) => runWithAgentSessionContext("sender", "exact-caller", async () => {
      const result = await tool.execute("notify", { to, content: "Current evidence" });
      return JSON.parse((result.content[0] as { text: string }).text);
    });
    for (const target of ["helper", "no-handler", "removed-owner"]) {
      const result = await call(target);
      expect(result.error).toContain("Unknown message target");
      expect(result.hint).toContain("follow-up");
      expect(result.allowedTargets).toEqual(["human", "recipient", "sender"]);
    }
    expect(db.prepare("SELECT COUNT(*) AS n FROM events WHERE event_type='message.created'").get()?.n).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS n FROM app_inbox_items").get()?.n).toBe(0);
    expect((await call("recipient")).delivery).toContain("recorded");
    const admitted = db.prepare("SELECT app_id, input_data FROM app_inbox_items").get();
    expect(admitted?.app_id).toBe("peer");
    expect(JSON.parse(String(admitted?.input_data)).context.sourceSessionId).toBe("exact-caller");
    expect(db.prepare("SELECT COUNT(*) AS n FROM events WHERE event_type='subscriber.failed'").get()?.n).toBe(0);

    // The existing tool follows registry replacement; no agent rediscovery or
    // new tool construction is required. The old recipient is unavailable.
    runtime.close();
    peer = "replacement";
    await registry.reload();
    expect(registry.messageTargets()).toEqual(["replacement", "sender"]);
    expect((await call("recipient")).error).toContain("Unknown message target");
    expect((await call("recipient")).allowedTargets).toContain("replacement");
    expect((await call("human")).delivery).toContain("recorded");
    expect(db.prepare("SELECT COUNT(*) AS n FROM events WHERE event_type='subscriber.failed'").get()?.n).toBe(0);
  } finally {
    runtime?.close();
    await closeInstalledAppTaskRuntimes(bus);
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("a non-background sender can notify a loaded peer without installing Task runtimes", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-message-no-tasks-"));
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const db = getDb(root);
  let runtime: AppInboxRuntime | undefined;
  try {
    const agentsRoot = join(root, "agents");
    const sharedRoot = join(root, "shared");
    const projectsRoot = join(root, "projects");
    for (const dir of [join(agentsRoot, "sender"), sharedRoot, projectsRoot]) mkdirSync(dir, { recursive: true });
    writeFileSync(join(agentsRoot, "sender", "agent.json"), JSON.stringify({
      name: "sender", description: "Fixture sender", domain: "test", model: "fixture", tools: ["message"],
    }));
    const registry = new AppRegistry(async () => [{
      appDir: join(projectsRoot, "peer.app"),
      definition: defineApp({
        id: "peer", version: 1, agent: "recipient",
        inputSchema: Type.Object({ kind: Type.Literal("message"), data: Type.Object({ message: Type.String() }) }),
        tasks: {},
        task: ({ id }) => ({ kind: "desired", intent: {
          id: `work/${id}`, parentId: "root", outcome: "Read the notification", acceptance: ["Considered"],
        } }),
      }),
    }]);
    await registry.reload();
    const manager = new SubagentManager({ persistDir: root, projectRoot: root, bus });
    const prepared = await prepareDaemonAgents({
      agentsRoot, sharedRoot, definitionSharedRoot: sharedRoot, projectsRoot,
      projectRoot: root, persistDir: root, models: { fixture: fakeModel() }, manager, bus,
      cronEnabled: false, appRegistry: registry, hostCapacity: new HostCapacity(1), taskRuntimeMode: "none",
    });
    expect(prepared.appTaskOptions).toBeUndefined();
    runtime = await startAppInboxRuntime({
      bus, db, registry, persistDir: root, schedulesEnabled: false,
      attachTask: fakeTaskAttacher(db, ({ attachment }) => ({ taskId: attachment.intent.id })),
    });
    const tool = manager.getAgentDefinition("sender")!.tools!.find(({ name }) => name === "message")!;
    const result = await tool.execute("notify", { to: "recipient", content: "Current evidence" });
    expect(JSON.parse((result.content[0] as { text: string }).text).delivery).toContain("recorded");
    expect(db.prepare("SELECT app_id FROM app_inbox_items").get()?.app_id).toBe("peer");
    expect(db.prepare("SELECT COUNT(*) AS n FROM events WHERE event_type='subscriber.failed'").get()?.n).toBe(0);
  } finally {
    runtime?.close();
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
