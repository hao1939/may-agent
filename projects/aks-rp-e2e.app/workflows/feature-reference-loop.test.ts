import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assignTask,
  peekTaskAssignments,
  taskTreeConfig,
} from "./lib/task-tree-tools.ts";
import { execute as executeCollector } from "./feature-reference-collector.ts";
import { execute as executeController } from "./feature-reference-loop-controller.ts";
import { loadFeatureReferencePackets } from "./lib/feature-reference-loop-store.ts";

async function makeProject() {
  const dir = await mkdtemp(join(tmpdir(), "aks-feature-reference-loop-"));
  await mkdir(join(dir, ".state"), { recursive: true });
  await mkdir(join(dir, "evidence", "archive"), { recursive: true });
  await mkdir(join(dir, "features"), { recursive: true });
  await mkdir(join(dir, "tasks"), { recursive: true });
  await writeFile(join(dir, ".state", "journal.jsonl"), "", "utf8");
  return dir;
}

function eventBlock(event: Record<string, unknown>): string {
  return `## Trigger Event
\`\`\`json
${JSON.stringify(event)}
\`\`\``;
}

function config(projectDir: string, maxConcurrent = 5) {
  return taskTreeConfig({
    appDir: projectDir,
    projectDir,
    worker: "aks-explorer",
    maxConcurrent,
  });
}

async function writeRootTree(projectDir: string, loopContext = {}) {
  await writeFile(
    join(projectDir, "tasks", "tree.json"),
    `${JSON.stringify(
      {
        version: 1,
        project: "aks-rp-e2e",
        project_lifecycle: "active",
        root_task_id: "project",
        updated_at: new Date().toISOString(),
        active_task_id: null,
        active_task_ids: [],
        tasks: {
          project: {
            id: "project",
            state: "backlog",
            status: "backlog",
            children: ["aks-feature-reference-loop"],
            goal: "project",
            outputs: ["tasks/tree.json"],
            acceptance: ["done"],
          },
          "aks-feature-reference-loop": {
            id: "aks-feature-reference-loop",
            parent_id: "project",
            state: "backlog",
            status: "backlog",
            workflow: "feature-reference-loop-controller",
            priority: "P2",
            children: [],
            goal: "Collect official feature references.",
            inputs: [],
            outputs: [".state/feature-reference-loop/state.json"],
            acceptance: ["Loop is current"],
            forbidden: [],
            conflict_scope: ["feature-reference-loop"],
            depends_on: [],
            context: {
              windowSize: 1,
              stateRef: ".state/feature-reference-loop/state.json",
              ...loopContext,
            },
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

describe("feature-reference loop", () => {
  test("loads packets from the latest feature-owned layout", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "features", "managedsystem-pool", "packets"), {
      recursive: true,
    });
    await mkdir(join(projectDir, "features", "managedsystem-pool", "specs"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, "features", "managedsystem-pool.yaml"),
      `capabilityId: managedsystem-pool
status: draft
coveredFeatureIds:
  - managedsystem-runtime-restrictions
`,
      "utf8",
    );
    await writeFile(
      join(
        projectDir,
        "features",
        "managedsystem-pool",
        "packets",
        "runtime-restrictions.yaml",
      ),
      `featureId: managedsystem-runtime-restrictions
status: draft
`,
      "utf8",
    );
    await writeFile(
      join(
        projectDir,
        "features",
        "managedsystem-pool",
        "packets",
        "runtime-restrictions-source-packet.yaml",
      ),
      `featureId: managedsystem-runtime-restrictions
sourcePacketId: source-packet-managedsystem-runtime-restrictions
status: source-grounded
`,
      "utf8",
    );
    await writeFile(
      join(
        projectDir,
        "features",
        "managedsystem-pool",
        "specs",
        "runtime-restrictions.json",
      ),
      JSON.stringify({ featureId: "managedsystem-runtime-restrictions" }),
      "utf8",
    );

    const packets = loadFeatureReferencePackets(projectDir);

    expect(packets).toContainEqual(
      expect.objectContaining({
        featureKey: "managedsystem-pool",
        packetPath: "features/managedsystem-pool.yaml",
        packetKind: "capability",
        layout: "capability-root",
        capabilityId: "managedsystem-pool",
      }),
    );
    expect(packets).toContainEqual(
      expect.objectContaining({
        featureKey: "managedsystem-runtime-restrictions",
        packetPath:
          "features/managedsystem-pool/packets/runtime-restrictions.yaml",
        packetKind: "feature",
        layout: "branch-packet",
        capabilityId: "managedsystem-pool",
      }),
    );
    expect(
      packets.filter(
        (packet) => packet.featureKey === "managedsystem-runtime-restrictions",
      ),
    ).toHaveLength(1);
    expect(
      packets.some((packet) => packet.packetPath.includes("source-packet")),
    ).toBeFalse();
    expect(
      packets.some((packet) => packet.packetPath.endsWith(".json")),
    ).toBeFalse();
  });

  test("controller creates bounded collector children from feature packets", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "features", "virtualmachines-agentpool.yaml"),
      `capabilityId: virtualmachines-agentpool
status: draft
coveredFeatureIds:
  - virtualmachines-agentpool
  - virtualmachines-mixed-sku-upgrade
`,
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "localdns.yaml"),
      `featureId: localdns
status: draft
`,
      "utf8",
    );
    await writeRootTree(projectDir, {
      referenceFixtureDir: join(projectDir, "fixtures", "references"),
    });

    const assignment = assignTask(config(projectDir), {
      taskId: "aks-feature-reference-loop",
    });
    const dispatched: Array<Record<string, unknown>> = [];
    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.assigned",
          project: "aks-rp-e2e",
          ...assignment,
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(_type: string, payload: Record<string, unknown>) {
        dispatched.push(payload);
      },
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Created 1 child task");
    const tree = JSON.parse(
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
    );
    const loop = tree.tasks["aks-feature-reference-loop"];
    expect(loop.children).toHaveLength(1);
    const child = tree.tasks[loop.children[0]];
    expect(child.workflow).toBe("feature-reference-collector");
    expect(child.context.featureKey).toBe("localdns");
    expect(child.context.layout).toBe("migration-root-feature");
    expect(child.context.referenceFixtureDir).toContain("fixtures/references");
    expect(loop.context.workflowProgress).toMatchObject({
      completionReady: false,
      pending: 1,
      running: 1,
      lastPulseCreated: 1,
    });
    expect(dispatched).toHaveLength(1);
    expect(
      peekTaskAssignments(config(projectDir)).some(
        (queued) => queued.taskId === child.id,
      ),
    ).toBe(false);
  });

  test("controller requeues orphaned active collector children", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "features", "localdns.yaml"),
      `featureId: localdns
status: draft
`,
      "utf8",
    );
    await writeRootTree(projectDir, {
      orphanedAssignmentMinAgeMs: 0,
    });
    const treePath = join(projectDir, "tasks", "tree.json");
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-reference-loop"].children = [
      "collect-feature-reference-localdns",
    ];
    tree.tasks["collect-feature-reference-localdns"] = {
      id: "collect-feature-reference-localdns",
      parent_id: "aks-feature-reference-loop",
      state: "active",
      status: "active",
      workflow: "feature-reference-collector",
      priority: "P2",
      children: [],
      goal: "Collect official references.",
      inputs: [],
      outputs: [".state/feature-reference-loop/state.json"],
      acceptance: ["Draft packet written"],
      forbidden: [],
      conflict_scope: ["feature-reference:localdns"],
      depends_on: [],
      context: {
        featureKey: "localdns",
        packetPath: "features/localdns.yaml",
        packetKind: "feature",
        stateRef: ".state/feature-reference-loop/state.json",
        loopTaskId: "aks-feature-reference-loop",
        draftDir: "evidence/archive",
      },
      trace: {
        current_attempt_id: "a_collect-feature-reference-localdns_old",
        assigned_at: "2020-01-01T00:00:00.000Z",
      },
    };
    tree.active_task_ids = ["collect-feature-reference-localdns"];
    tree.active_task_id = "collect-feature-reference-localdns";
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const dispatched: Array<Record<string, unknown>> = [];
    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-reference-loop",
          project: "aks-rp-e2e",
          target: { taskId: "aks-feature-reference-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(_type: string, payload: Record<string, unknown>) {
        dispatched.push(payload);
      },
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Requeued 1 orphaned child assignment");
    expect(result.message).toContain("Assigned 1 child task");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].taskId).toBe("collect-feature-reference-localdns");

    const updated = JSON.parse(await readFile(treePath, "utf8"));
    const child = updated.tasks["collect-feature-reference-localdns"];
    expect(child.state).toBe("active");
    expect(child.trace.current_attempt_id).not.toBe(
      "a_collect-feature-reference-localdns_old",
    );
    expect(child.trace.worker_started_attempt_id).toBeUndefined();
    expect(
      updated.tasks["aks-feature-reference-loop"].context.workflowProgress,
    ).toMatchObject({
      running: 1,
      lastPulseAssigned: 1,
    });
  });

  test("controller does not assign non-collector backlog children", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "features", "localdns.yaml"),
      `featureId: localdns
status: draft
`,
      "utf8",
    );
    await writeRootTree(projectDir);
    const treePath = join(projectDir, "tasks", "tree.json");
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-reference-loop"].children = [
      "repair-feature-reference-localdns-20260627",
    ];
    tree.tasks["repair-feature-reference-localdns-20260627"] = {
      id: "repair-feature-reference-localdns-20260627",
      parent_id: "aks-feature-reference-loop",
      state: "backlog",
      status: "backlog",
      priority: "P2",
      children: [],
      goal: "Repair feature reference evidence.",
      inputs: [],
      outputs: ["evidence/archive/feature-reference-localdns-20260627.md"],
      acceptance: ["Evidence repaired"],
      forbidden: [],
      conflict_scope: ["feature-reference:localdns"],
      depends_on: [],
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const dispatched: Array<Record<string, unknown>> = [];
    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-reference-loop",
          project: "aks-rp-e2e",
          target: { taskId: "aks-feature-reference-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(_type: string, payload: Record<string, unknown>) {
        dispatched.push(payload);
      },
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched.map((payload) => payload.taskId)).not.toContain(
      "repair-feature-reference-localdns-20260627",
    );
    const updated = JSON.parse(await readFile(treePath, "utf8"));
    expect(
      updated.tasks["repair-feature-reference-localdns-20260627"].state,
    ).toBe("backlog");
  });

  test("collector writes a draft packet and marks the feature done from fixtures", async () => {
    const projectDir = await makeProject();
    const fixtureDir = join(projectDir, "fixtures", "references");
    await mkdir(join(fixtureDir, "learn", "aks"), { recursive: true });
    await mkdir(
      join(
        fixtureDir,
        "azure-rest-api-specs",
        "specification",
        "containerservice",
      ),
      { recursive: true },
    );
    await writeFile(
      join(projectDir, "features", "virtualmachines-agentpool.yaml"),
      `capabilityId: virtualmachines-agentpool
status: draft
coveredFeatureIds:
  - virtualmachines-agentpool
`,
      "utf8",
    );
    await writeFile(
      join(fixtureDir, "learn", "aks", "virtualmachines-agentpool.md"),
      `# Virtual Machines agent pools

Virtualmachines agentpool documentation defines supported usage scenarios for VM-backed AKS node pools.
`,
      "utf8",
    );
    await writeFile(
      join(
        fixtureDir,
        "azure-rest-api-specs",
        "specification",
        "containerservice",
        "managedClusters.json",
      ),
      JSON.stringify(
        {
          info: { title: "ContainerService managedClusters API" },
          definitions: {
            AgentPool: {
              description:
                "virtualmachines agentpool API shape defines VM set type and agent pool properties.",
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeRootTree(projectDir);
    const treePath = join(projectDir, "tasks", "tree.json");
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-reference-loop"].children = [
      "collect-feature-reference-virtualmachines-agentpool",
    ];
    tree.tasks["collect-feature-reference-virtualmachines-agentpool"] = {
      id: "collect-feature-reference-virtualmachines-agentpool",
      parent_id: "aks-feature-reference-loop",
      state: "backlog",
      status: "backlog",
      workflow: "feature-reference-collector",
      priority: "P2",
      children: [],
      goal: "Collect official references.",
      inputs: [],
      outputs: [".state/feature-reference-loop/state.json"],
      acceptance: ["Draft packet written"],
      forbidden: [],
      conflict_scope: ["feature-reference:virtualmachines-agentpool"],
      depends_on: [],
      context: {
        featureKey: "virtualmachines-agentpool",
        packetPath: "features/virtualmachines-agentpool.yaml",
        packetKind: "capability",
        coveredFeatureIds: ["virtualmachines-agentpool"],
        stateRef: ".state/feature-reference-loop/state.json",
        loopTaskId: "aks-feature-reference-loop",
        draftDir: "evidence/archive",
        referenceFixtureDir: fixtureDir,
        runDate: "20260626",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const assignment = assignTask(config(projectDir), {
      taskId: "collect-feature-reference-virtualmachines-agentpool",
    });
    const completedEvents: Array<Record<string, unknown>> = [];
    const result = await executeCollector({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.assigned",
          project: "aks-rp-e2e",
          ...assignment,
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        if (type === "project.task.completed") completedEvents.push(payload);
      },
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "feature-reference-virtualmachines-agentpool-20260626.md",
    );
    const draft = await readFile(
      join(
        projectDir,
        "evidence",
        "archive",
        "feature-reference-virtualmachines-agentpool-20260626.md",
      ),
      "utf8",
    );
    expect(draft).toContain("Official API References");
    expect(draft).toContain("managedClusters.json");
    expect(draft).toContain("Official Documentation References");
    expect(draft).toContain("virtualmachines-agentpool.md");
    const state = JSON.parse(
      await readFile(
        join(projectDir, ".state", "feature-reference-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.features["virtualmachines-agentpool"]).toMatchObject({
      status: "done",
      lastOutputPath:
        "evidence/archive/feature-reference-virtualmachines-agentpool-20260626.md",
    });
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].result).toBe("done");
  });

  test("controller syncs completed collector children back to done state", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "features", "aad-rbac.yaml"),
      `capabilityId: aad-rbac
status: draft
`,
      "utf8",
    );
    await writeRootTree(projectDir);
    const treePath = join(projectDir, "tasks", "tree.json");
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-reference-loop"].children = [
      "collect-feature-reference-aad-rbac",
    ];
    tree.tasks["collect-feature-reference-aad-rbac"] = {
      id: "collect-feature-reference-aad-rbac",
      parent_id: "aks-feature-reference-loop",
      state: "done",
      status: "done",
      workflow: "feature-reference-collector",
      priority: "P2",
      children: [],
      goal: "Collect official references.",
      inputs: [],
      outputs: [".state/feature-reference-loop/state.json"],
      acceptance: ["Draft packet written"],
      forbidden: [],
      conflict_scope: ["feature-reference:aad-rbac"],
      depends_on: [],
      context: {
        featureKey: "aad-rbac",
        packetPath: "features/aad-rbac.yaml",
        packetKind: "capability",
        stateRef: ".state/feature-reference-loop/state.json",
        loopTaskId: "aks-feature-reference-loop",
        draftDir: "evidence/archive",
      },
      trace: {
        last_worker_result: "done",
        last_worker_summary:
          "Collected official feature references for aad-rbac: evidence/archive/feature-reference-aad-rbac-20260626.md.",
      },
      result:
        "Collected official feature references for aad-rbac: evidence/archive/feature-reference-aad-rbac-20260626.md.",
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    await mkdir(join(projectDir, ".state", "feature-reference-loop"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, ".state", "feature-reference-loop", "state.json"),
      `${JSON.stringify(
        {
          loopTaskId: "aks-feature-reference-loop",
          windowSize: 1,
          cursor: 0,
          features: {
            "aad-rbac": {
              featureKey: "aad-rbac",
              packetPath: "features/aad-rbac.yaml",
              packetKind: "capability",
              layout: "capability-root",
              capabilityId: "aad-rbac",
              coveredFeatureIds: [],
              status: "running",
              attempts: 0,
              lastOutputPath: null,
              lastSummary: null,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-reference-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-reference-loop",
          target: { taskId: "aks-feature-reference-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const state = JSON.parse(
      await readFile(
        join(projectDir, ".state", "feature-reference-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.features["aad-rbac"]).toMatchObject({
      status: "done",
      taskId: "collect-feature-reference-aad-rbac",
      lastOutputPath: "evidence/archive/feature-reference-aad-rbac-20260626.md",
    });
    const updatedTree = JSON.parse(await readFile(treePath, "utf8"));
    expect(
      updatedTree.tasks["aks-feature-reference-loop"].context.workflowProgress,
    ).toMatchObject({
      done: 1,
      running: 0,
    });
  });

  test("controller accepts completed collector reviews", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "features", "aad-rbac.yaml"),
      `capabilityId: aad-rbac
status: draft
`,
      "utf8",
    );
    await writeRootTree(projectDir);
    const treePath = join(projectDir, "tasks", "tree.json");
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-reference-loop"].children = [
      "collect-feature-reference-aad-rbac",
    ];
    tree.tasks["collect-feature-reference-aad-rbac"] = {
      id: "collect-feature-reference-aad-rbac",
      parent_id: "aks-feature-reference-loop",
      state: "review",
      status: "review",
      workflow: "feature-reference-collector",
      priority: "P2",
      children: [],
      goal: "Collect official references.",
      inputs: [],
      outputs: [".state/feature-reference-loop/state.json"],
      acceptance: ["Draft packet written"],
      forbidden: [],
      conflict_scope: ["feature-reference:aad-rbac"],
      depends_on: [],
      result:
        "Collected official feature references for aad-rbac: evidence/archive/feature-reference-aad-rbac-20260627.md.",
      context: {
        featureKey: "aad-rbac",
        packetPath: "features/aad-rbac.yaml",
        packetKind: "capability",
        stateRef: ".state/feature-reference-loop/state.json",
        loopTaskId: "aks-feature-reference-loop",
      },
      trace: {
        last_worker_result: "done",
        last_worker_summary:
          "Collected official feature references for aad-rbac: evidence/archive/feature-reference-aad-rbac-20260627.md.",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-reference-loop",
          project: "aks-rp-e2e",
          target: { taskId: "aks-feature-reference-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Accepted 1 completed collector review");
    const updated = JSON.parse(await readFile(treePath, "utf8"));
    expect(updated.tasks["collect-feature-reference-aad-rbac"].state).toBe(
      "done",
    );
    expect(
      updated.tasks["collect-feature-reference-aad-rbac"].context
        .acceptance_note,
    ).toContain(
      "Feature-reference loop accepted deterministic collector result",
    );
  });

  test("controller releases stale running feature state without an execution child", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "features", "alpha.yaml"),
      `featureId: alpha
status: draft
`,
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "beta.yaml"),
      `featureId: beta
status: draft
`,
      "utf8",
    );
    await writeRootTree(projectDir);
    await mkdir(join(projectDir, ".state", "feature-reference-loop"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, ".state", "feature-reference-loop", "state.json"),
      `${JSON.stringify(
        {
          loopTaskId: "aks-feature-reference-loop",
          windowSize: 1,
          cursor: 0,
          features: {
            alpha: {
              featureKey: "alpha",
              packetPath: "features/alpha.yaml",
              packetKind: "feature",
              layout: "migration-root-feature",
              capabilityId: null,
              coveredFeatureIds: [],
              status: "running",
              taskId: "missing-child",
              attempts: 0,
              lastOutputPath: null,
              lastSummary: null,
              updatedAt: new Date().toISOString(),
            },
            beta: {
              featureKey: "beta",
              packetPath: "features/beta.yaml",
              packetKind: "feature",
              layout: "migration-root-feature",
              capabilityId: null,
              coveredFeatureIds: [],
              status: "pending",
              taskId: null,
              attempts: 0,
              lastOutputPath: null,
              lastSummary: null,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const dispatched: Array<Record<string, unknown>> = [];
    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-reference-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-reference-loop",
          target: { taskId: "aks-feature-reference-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(_type: string, payload: Record<string, unknown>) {
        dispatched.push(payload);
      },
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Released 1 stale running feature");
    expect(dispatched.map((entry) => entry.taskId)).toEqual([
      "collect-feature-reference-alpha",
    ]);
    const state = JSON.parse(
      await readFile(
        join(projectDir, ".state", "feature-reference-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.features.alpha).toMatchObject({
      status: "running",
      taskId: "collect-feature-reference-alpha",
    });
    expect(state.features.beta).toMatchObject({
      status: "pending",
      taskId: null,
    });
  });

  test("controller treats held stale and dormant features as outside active refill progress", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "features", "alpha.yaml"),
      `featureId: alpha
status: draft
`,
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "beta.yaml"),
      `featureId: beta
status: draft
`,
      "utf8",
    );
    await writeRootTree(projectDir);
    await mkdir(join(projectDir, ".state", "feature-reference-loop"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, ".state", "feature-reference-loop", "state.json"),
      `${JSON.stringify(
        {
          loopTaskId: "aks-feature-reference-loop",
          windowSize: 1,
          cursor: 0,
          holdState: {
            mode: "dormant-backlog-preserved",
            staleFeatureKeys: ["alpha"],
            dormantFeatureKeys: ["beta"],
            reopenDefaultFeatureKeys: ["beta"],
            noRefillNow: true,
            note: "hold semantics active",
            updatedAt: new Date().toISOString(),
          },
          features: {
            alpha: {
              featureKey: "alpha",
              packetPath: "features/alpha.yaml",
              packetKind: "feature",
              layout: "migration-root-feature",
              capabilityId: null,
              coveredFeatureIds: [],
              status: "running",
              taskId: "missing-child",
              attempts: 0,
              lastOutputPath: null,
              lastSummary: null,
              updatedAt: new Date().toISOString(),
            },
            beta: {
              featureKey: "beta",
              packetPath: "features/beta.yaml",
              packetKind: "feature",
              layout: "migration-root-feature",
              capabilityId: null,
              coveredFeatureIds: [],
              status: "pending",
              taskId: null,
              attempts: 0,
              lastOutputPath: null,
              lastSummary: null,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const dispatched: Array<Record<string, unknown>> = [];
    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-reference-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-reference-loop",
          target: { taskId: "aks-feature-reference-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(_type: string, payload: Record<string, unknown>) {
        dispatched.push(payload);
      },
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Released 1 stale running feature");
    expect(dispatched).toHaveLength(0);
    const state = JSON.parse(
      await readFile(
        join(projectDir, ".state", "feature-reference-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.features.alpha).toMatchObject({
      status: "pending",
      taskId: null,
    });
    expect(state.features.beta).toMatchObject({
      status: "pending",
      taskId: null,
    });
    const tree = JSON.parse(
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
    );
    expect(
      tree.tasks["aks-feature-reference-loop"].context.workflowProgress,
    ).toMatchObject({
      completionReady: true,
      pending: 0,
      running: 0,
      dormant: 1,
      stale: 1,
      holdMode: "dormant-backlog-preserved",
      noRefillNow: true,
    });
  });

  test("controller keeps completion open when non-held running features remain", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = join(projectDir, "tasks", "tree.json");
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-reference-loop"].children = [
      "collect-feature-reference-beta",
    ];
    tree.tasks["collect-feature-reference-beta"] = {
      id: "collect-feature-reference-beta",
      parent_id: "aks-feature-reference-loop",
      state: "active",
      status: "active",
      workflow: "feature-reference-collector",
      priority: "P2",
      children: [],
      goal: "Collect official feature references for beta.",
      inputs: ["feature:beta"],
      outputs: [".state/feature-reference-loop/state.json"],
      acceptance: ["done"],
      context: {
        featureKey: "beta",
        stateRef: ".state/feature-reference-loop/state.json",
        loopTaskId: "aks-feature-reference-loop",
      },
      trace: {
        current_attempt_id: "attempt-beta",
        worker_started_attempt_id: "attempt-beta",
        worker_started_at: new Date().toISOString(),
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");
    await mkdir(join(projectDir, ".state", "feature-reference-loop"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, ".state", "feature-reference-loop", "state.json"),
      `${JSON.stringify(
        {
          loopTaskId: "aks-feature-reference-loop",
          windowSize: 1,
          cursor: 0,
          holdState: {
            mode: "dormant-backlog-preserved",
            staleFeatureKeys: ["alpha"],
            dormantFeatureKeys: [],
            noRefillNow: true,
            updatedAt: new Date().toISOString(),
          },
          features: {
            alpha: {
              featureKey: "alpha",
              packetPath: "features/alpha.yaml",
              packetKind: "feature",
              layout: "migration-root-feature",
              capabilityId: null,
              coveredFeatureIds: [],
              status: "stale",
              taskId: null,
              attempts: 0,
              lastOutputPath: null,
              lastSummary: null,
              updatedAt: new Date().toISOString(),
            },
            beta: {
              featureKey: "beta",
              packetPath: "features/beta.yaml",
              packetKind: "feature",
              layout: "migration-root-feature",
              capabilityId: null,
              coveredFeatureIds: [],
              status: "running",
              taskId: "collect-feature-reference-beta",
              attempts: 1,
              lastOutputPath: null,
              lastSummary: null,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-reference-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-reference-loop",
          target: { taskId: "aks-feature-reference-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const updatedTree = JSON.parse(await readFile(treePath, "utf8"));
    expect(
      updatedTree.tasks["aks-feature-reference-loop"].context.workflowProgress,
    ).toMatchObject({
      completionReady: false,
      pending: 0,
      running: 1,
      stale: 1,
      holdMode: "dormant-backlog-preserved",
    });
  });
});
