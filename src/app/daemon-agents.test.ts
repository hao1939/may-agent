import { afterEach, describe, expect, it } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "../lib/requests.js";
import { daemonAgentInternals, prepareDaemonAgents } from "./daemon-agents.js";
import { SubagentManager } from "../lib/manager.js";
import { createAgentRun } from "../lib/agent-runner.js";
import { readSessionMeta } from "../lib/persistence.js";
import { createLastSessionWriter } from "../lib/session-subscribers.js";
import { EventBus } from "./core/events/bus.js";
import { AppRegistry } from "./core/apps/registry.js";
import { discoverAppDefinitions } from "./adapters/discovery/app-definitions.js";
import { closeInstalledAppTaskRuntimes } from "./core/tasks/app-task-runtime.js";
import { HostCapacity } from "./core/scheduling/host-capacity.js";
import { fakeModel } from "../../test/fixtures/model.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

describe("daemon Task executor compatibility", () => {
  it.each(["app.ts", "app.js"])("preserves App-local ownership through the %s loader", async (filename) => {
    const root = mkdtempSync(join(tmpdir(), "may-local-owner-"));
    roots.push(root);
    const canonicalProjects = join(root, "projects");
    const appDir = join(canonicalProjects, "sample.app");
    const localDir = join(appDir, "agents", "actual-folder");
    const globalDir = join(root, "agents", "arc");
    for (const dir of [localDir, globalDir, join(root, "shared")]) mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(localDir, "agent.json"),
      JSON.stringify({
        name: "arc",
        description: "Fixture",
        domain: "test",
        model: "fixture",
        tools: [],
      }),
    );
    writeFileSync(
      join(appDir, filename),
      'export default { id: "sample", version: 1, agent: "arc", inputSchema: { type: "object" }, tasks: {} };',
    );
    writeFileSync(join(globalDir, "last-session.md"), "Global history\n");
    const sourceRoot = join(root, "release");
    cpSync(canonicalProjects, join(sourceRoot, "projects"), { recursive: true });
    const bus = new EventBus();
    bus.subscribe(createLastSessionWriter(root));
    const manager = new SubagentManager({
      persistDir: root,
      projectRoot: root,
      bus,
      agentRunFactory: (options) => {
        const run = createAgentRun(options);
        run.prompt = async () => {
          run.state.messages.push({
            role: "assistant",
            content: [{ type: "text", text: "Fixture finished" }],
            stopReason: "stop",
          } as any);
        };
        return run;
      },
    });
    const registry = new AppRegistry(discoverAppDefinitions(join(sourceRoot, "projects"), canonicalProjects));
    await registry.reload();
    try {
      // app.js reaches the real fallback registration; app.ts uses normal discovery.
      // Neither path is replaced by a test-built AgentDirectory.
      await prepareDaemonAgents({
        agentsRoot: join(root, "agents"),
        sharedRoot: join(root, "shared"),
        definitionSharedRoot: join(root, "shared"),
        projectsRoot: join(sourceRoot, "projects"),
        canonicalProjectsRoot: canonicalProjects,
        projectRoot: root,
        persistDir: root,
        models: { fixture: fakeModel() },
        manager,
        bus,
        cronEnabled: false,
        appRegistry: registry,
        hostCapacity: new HostCapacity(1),
        taskRuntimeMode: "manual",
      });
      const definition = manager.getAgentDefinition("arc")!;
      expect(definition).toMatchObject({
        agentDir: join(sourceRoot, "projects/sample.app/agents/actual-folder"),
        agentRelativeDir: "projects/sample.app/agents/actual-folder",
        appLocal: true,
        projectId: "sample",
      });
      writeFileSync(join(appDir, ".disabled"), "");
      const sessionId = manager.run("arc", "Complete accepted work");
      expect((await manager.waitFor(sessionId)).status).toBe("done");
      expect(readSessionMeta(root, sessionId)?.agentRelativeDir).toBe(definition.agentRelativeDir);
      expect(readFileSync(join(localDir, "last-session.md"), "utf8")).toContain(sessionId);
      expect(readFileSync(join(globalDir, "last-session.md"), "utf8")).toBe("Global history\n");
      expect(existsSync(join(definition.agentDir!, "last-session.md"))).toBe(false);
    } finally {
      await closeInstalledAppTaskRuntimes(bus);
    }
  });

  it("retains the trial Codex executor alias only while a Task can still need it", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-daemon-executor-alias-"));
    roots.push(persistDir);
    const db = getDb(persistDir);
    const insert = db.prepare(
      `INSERT INTO app_tasks(
         app_id, task_id, generation, resource_version, observed_generation, phase,
         lane, changed, ready, updated_at, resource_json
       ) VALUES (?, ?, 1, 1, 0, 'pending', 'normal', 0, 0, 1, ?)`,
    );

    expect(daemonAgentInternals.hasRetainedCodexGoalTrialTask(persistDir)).toBeFalse();
    insert.run("sample", "current", JSON.stringify({ spec: { executor: "codex-goal" } }));
    expect(daemonAgentInternals.hasRetainedCodexGoalTrialTask(persistDir)).toBeFalse();
    insert.run("sample", "trial", JSON.stringify({ spec: { executor: "codex-goal-poc" } }));
    expect(daemonAgentInternals.hasRetainedCodexGoalTrialTask(persistDir)).toBeTrue();

    db.prepare("UPDATE app_tasks SET phase = 'converged' WHERE app_id = 'sample' AND task_id = 'trial'").run();
    expect(daemonAgentInternals.hasRetainedCodexGoalTrialTask(persistDir)).toBeTrue();

    db.prepare("UPDATE app_tasks SET resource_json = ? WHERE app_id = 'sample' AND task_id = 'trial'").run(
      JSON.stringify({ spec: { executor: "codex-goal-poc" } }),
    );
    expect(daemonAgentInternals.hasRetainedCodexGoalTrialTask(persistDir)).toBeTrue();

    db.prepare(
      `INSERT INTO app_task_cancellations(app_id, task_id, requested_at, reason, cancellation_json)
       VALUES ('sample', 'trial', 1, 'done', '{}')`,
    ).run();
    expect(daemonAgentInternals.hasRetainedCodexGoalTrialTask(persistDir)).toBeFalse();
  });
});
