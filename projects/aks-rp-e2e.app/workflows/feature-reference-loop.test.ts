import { projectRuntimePaths, resolveTaskTreePath } from "@may-agent/sdk";
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
import {
  featureReferenceCollectorContractVersion,
  loadFeatureReferenceLoopState,
  loadFeatureReferencePackets,
  orderedPendingFeatureKeys,
  saveFeatureReferenceLoopState,
  updateFeatureReferenceItem,
} from "./lib/feature-reference-loop-store.ts";

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
    resolveTaskTreePath(projectDir),
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
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
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
    const treePath = resolveTaskTreePath(projectDir);
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
    const treePath = resolveTaskTreePath(projectDir);
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
    const treePath = resolveTaskTreePath(projectDir);
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

  test("collector promotes agent references into official sections", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "features", "aad-rbac.yaml"),
      `capabilityId: aad-rbac\nstatus: draft\n`,
      "utf8",
    );
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-reference-loop"].children = [
      "collect-feature-reference-aad-rbac",
    ];
    tree.tasks["collect-feature-reference-aad-rbac"] = {
      id: "collect-feature-reference-aad-rbac",
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
      conflict_scope: ["feature-reference:aad-rbac"],
      depends_on: [],
      context: {
        featureKey: "aad-rbac",
        packetPath: "features/aad-rbac.yaml",
        packetKind: "capability",
        stateRef: ".state/feature-reference-loop/state.json",
        loopTaskId: "aks-feature-reference-loop",
        draftDir: "evidence/archive",
        runDate: "20260701",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const assignment = assignTask(config(projectDir), {
      taskId: "collect-feature-reference-aad-rbac",
    });
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
      dispatchEvent() {},
      runAgent: async () => ({
        status: "success",
        message: `API: specification/containerservice/resource-manager/Microsoft.ContainerService/aks/stable/2024-10-01/managedClusters.json proves aadProfile fields.
Docs: https://learn.microsoft.com/en-us/azure/aks/managed-azure-ad proves managed Microsoft Entra integration behavior.`,
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const draft = await readFile(
      join(
        projectDir,
        "evidence",
        "archive",
        "feature-reference-aad-rbac-20260701.md",
      ),
      "utf8",
    );
    expect(draft).toContain("specification/containerservice/resource-manager");
    expect(draft).toContain(
      "https://learn.microsoft.com/en-us/azure/aks/managed-azure-ad",
    );
    const state = JSON.parse(
      await readFile(
        join(projectDir, ".state", "feature-reference-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.features["aad-rbac"].status).toBe("done");
  });

  test("state reload promotes error artifact when linked evidence has required references", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "features", "aad-rbac.yaml"),
      `capabilityId: aad-rbac\nstatus: draft\n`,
      "utf8",
    );
    const statePath = join(
      projectDir,
      ".state",
      "feature-reference-loop",
      "state.json",
    );
    await mkdir(join(projectDir, ".state", "feature-reference-loop"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, "evidence", "archive", "aad-rbac-real.md"),
      `# Real References

## Official API References

- specification/containerservice/resource-manager/Microsoft.ContainerService/aks/stable/2024-10-01/managedClusters.json: aadProfile contract.

## Official Documentation References

- https://learn.microsoft.com/en-us/azure/aks/managed-azure-ad: managed Entra integration.
`,
      "utf8",
    );
    await writeFile(
      join(
        projectDir,
        "evidence",
        "archive",
        "feature-reference-aad-rbac-20260701.md",
      ),
      `# Feature Reference: aad-rbac

## Official API References

- No matching reference found yet.

## Official Documentation References

- No matching reference found yet.

## Collector Agent Notes

Collected refs in evidence/archive/aad-rbac-real.md.
`,
      "utf8",
    );
    await writeFile(
      statePath,
      `${JSON.stringify(
        {
          loopTaskId: "aks-feature-reference-loop",
          windowSize: 5,
          cursor: 0,
          features: {
            "aad-rbac": {
              featureKey: "aad-rbac",
              packetPath: "features/aad-rbac.yaml",
              packetKind: "capability",
              layout: "capability-root",
              capabilityId: "aad-rbac",
              coveredFeatureIds: [],
              status: "error",
              taskId: "collect-feature-reference-aad-rbac",
              attempts: 2,
              lastOutputPath:
                "evidence/archive/feature-reference-aad-rbac-20260701.md",
              lastSummary:
                "Official reference collection for aad-rbac is incomplete.",
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const reloaded = loadFeatureReferenceLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-reference-loop",
      windowSize: 5,
      statePath,
    }).state;

    expect(reloaded.features["aad-rbac"].status).toBe("done");
  });

  test("state reload promotes same-feature public-official evidence when wrapper missed refs", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "features", "workload-autoscaler.yaml"),
      `capabilityId: workload-autoscaler\nstatus: draft\n`,
      "utf8",
    );
    const statePath = join(
      projectDir,
      ".state",
      "feature-reference-loop",
      "state.json",
    );
    await mkdir(join(projectDir, ".state", "feature-reference-loop"), {
      recursive: true,
    });
    await writeFile(
      join(
        projectDir,
        "evidence",
        "archive",
        "feature-reference-workload-autoscaler-20260701.md",
      ),
      `# Feature Reference: workload-autoscaler

## Official API References

- No matching reference found yet.

## Official Documentation References

- No matching reference found yet.
`,
      "utf8",
    );
    await writeFile(
      join(
        projectDir,
        "evidence",
        "archive",
        "workload-autoscaler-public-official-references-20260701.md",
      ),
      `# Public official references

| Reference | Claim |
|---|---|
| specification/containerservice/resource-manager/Microsoft.ContainerService/aks/stable/2025-02-01/managedClusters.json | workloadAutoScalerProfile exists. |
| https://learn.microsoft.com/en-us/azure/aks/keda-about | AKS documents managed KEDA. |
`,
      "utf8",
    );
    await writeFile(
      statePath,
      `${JSON.stringify(
        {
          loopTaskId: "aks-feature-reference-loop",
          windowSize: 5,
          cursor: 0,
          features: {
            "workload-autoscaler": {
              featureKey: "workload-autoscaler",
              packetPath: "features/workload-autoscaler.yaml",
              packetKind: "capability",
              layout: "capability-root",
              capabilityId: "workload-autoscaler",
              coveredFeatureIds: [],
              status: "error",
              taskId: "collect-feature-reference-workload-autoscaler",
              attempts: 2,
              lastOutputPath:
                "evidence/archive/feature-reference-workload-autoscaler-20260701.md",
              lastSummary:
                "Official reference collection for workload-autoscaler is incomplete.",
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const reloaded = loadFeatureReferenceLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-reference-loop",
      windowSize: 5,
      statePath,
    }).state;

    expect(reloaded.features["workload-autoscaler"]).toMatchObject({
      status: "done",
      lastOutputPath:
        "evidence/archive/workload-autoscaler-public-official-references-20260701.md",
    });
  });

  test("controller keeps promoted public-official evidence when stale partial child points to wrapper", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "features", "virtualmachines-auto-zone-single-sku.yaml"),
      `featureId: virtualmachines-auto-zone-single-sku
status: draft
`,
      "utf8",
    );
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-reference-loop"].children = [
      "collect-feature-reference-virtualmachines-auto-zone-single-sku",
    ];
    tree.tasks[
      "collect-feature-reference-virtualmachines-auto-zone-single-sku"
    ] = {
      id: "collect-feature-reference-virtualmachines-auto-zone-single-sku",
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
      conflict_scope: [
        "feature-reference:virtualmachines-auto-zone-single-sku",
      ],
      depends_on: [],
      context: {
        featureKey: "virtualmachines-auto-zone-single-sku",
        packetPath: "features/virtualmachines-auto-zone-single-sku.yaml",
        packetKind: "feature",
        stateRef: ".state/feature-reference-loop/state.json",
        loopTaskId: "aks-feature-reference-loop",
      },
      trace: {
        last_worker_result: "partial",
        last_worker_summary:
          "Official reference collection for virtualmachines-auto-zone-single-sku is incomplete: missing official Microsoft Learn documentation and Azure REST API spec. Draft: evidence/archive/feature-reference-virtualmachines-auto-zone-single-sku-20260701.md.",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    await mkdir(join(projectDir, ".state", "feature-reference-loop"), {
      recursive: true,
    });
    await writeFile(
      join(
        projectDir,
        "evidence",
        "archive",
        "feature-reference-virtualmachines-auto-zone-single-sku-20260701.md",
      ),
      `# Feature Reference: virtualmachines-auto-zone-single-sku

## Official API References

- No matching reference found yet.

## Official Documentation References

- No matching reference found yet.
`,
      "utf8",
    );
    await writeFile(
      join(
        projectDir,
        "evidence",
        "archive",
        "virtualmachines-auto-zone-single-sku-public-official-references-20260701.md",
      ),
      `# Public official references

| Reference | Claim |
|---|---|
| specification/containerservice/resource-manager/Microsoft.ContainerService/aks/stable/2025-02-01/agentPools.json | Agent pools support virtualMachinesProfile. |
| https://learn.microsoft.com/en-us/azure/aks/virtual-machines-node-pools | AKS documents VM node pools. |
`,
      "utf8",
    );
    await writeFile(
      join(projectDir, ".state", "feature-reference-loop", "state.json"),
      `${JSON.stringify(
        {
          loopTaskId: "aks-feature-reference-loop",
          windowSize: 5,
          cursor: 0,
          features: {
            "virtualmachines-auto-zone-single-sku": {
              featureKey: "virtualmachines-auto-zone-single-sku",
              packetPath: "features/virtualmachines-auto-zone-single-sku.yaml",
              packetKind: "feature",
              layout: "migration-root-feature",
              capabilityId: null,
              coveredFeatureIds: [],
              status: "running",
              taskId:
                "collect-feature-reference-virtualmachines-auto-zone-single-sku",
              attempts: 2,
              lastOutputPath:
                "evidence/archive/feature-reference-virtualmachines-auto-zone-single-sku-20260701.md",
              lastSummary:
                "Official reference collection for virtualmachines-auto-zone-single-sku is incomplete.",
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
    expect(
      state.features["virtualmachines-auto-zone-single-sku"],
    ).toMatchObject({
      status: "done",
      lastOutputPath:
        "evidence/archive/virtualmachines-auto-zone-single-sku-public-official-references-20260701.md",
    });
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
    const treePath = resolveTaskTreePath(projectDir);
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
      join(
        projectDir,
        "evidence",
        "archive",
        "feature-reference-aad-rbac-20260626.md",
      ),
      `# Feature Reference: aad-rbac

## Official API References

- azure-rest-api-specs/specification/containerservice/managedClusters.json: ContainerService managedClusters API.

## Official Documentation References

- learn/aks/aad-rbac.md: Microsoft Learn AKS Azure RBAC documentation.
`,
      "utf8",
    );
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
    const treePath = resolveTaskTreePath(projectDir);
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
    expect(result.message).toContain("Accepted 1 recorded collector review");
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
    expect(result.message).toContain(
      "Feature reference loop aks-feature-reference-loop pulse complete.",
    );
    expect(dispatched).toHaveLength(0);
    const state = JSON.parse(
      await readFile(
        join(projectDir, ".state", "feature-reference-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.features.alpha).toMatchObject({
      status: "stale",
      taskId: null,
    });
    expect(state.features.beta).toMatchObject({
      status: "dormant",
      taskId: null,
    });
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
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
      lastPulseCreated: 0,
      lastPulseAssigned: 0,
    });
  });

  test("controller marks no-refill stewardship when only retry-exhausted unresolved backlog remains", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir, { maxDirectAttemptsPerFeature: 2 });
    await writeFile(
      join(projectDir, "features", "alpha.yaml"),
      `featureId: alpha\nstatus: draft\n`,
      "utf8",
    );
    await mkdir(join(projectDir, ".state", "feature-reference-loop"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, ".state", "feature-reference-loop", "state.json"),
      `${JSON.stringify(
        {
          loopTaskId: "aks-feature-reference-loop",
          windowSize: 5,
          cursor: 0,
          features: {
            alpha: {
              featureKey: "alpha",
              packetPath: "features/alpha.yaml",
              packetKind: "feature",
              layout: "migration-root-feature",
              capabilityId: null,
              coveredFeatureIds: [],
              status: "error",
              taskId: null,
              attempts: 2,
              lastOutputPath: null,
              lastSummary: "still unresolved",
              collectorContractVersion:
                featureReferenceCollectorContractVersion,
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
    const updatedTree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(
      updatedTree.tasks["aks-feature-reference-loop"].context.workflowProgress,
    ).toMatchObject({
      completionReady: false,
      pending: 0,
      running: 0,
      error: 1,
      retryBudgetExhausted: 1,
      openChildren: 0,
      noRefillNow: true,
    });
    expect(
      updatedTree.tasks["aks-feature-reference-loop"].context.workflowProgress
        .reason,
    ).toContain("no runnable collector children");
  });

  test("controller keeps completion open when non-held running features remain", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
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
      dormant: 0,
      holdMode: "dormant-backlog-preserved",
      noRefillNow: true,
    });
  });

  test("suppressed accepted ceilings stay done and out of pending refill after reload", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "features", "aad-rbac.yaml"),
      `capabilityId: aad-rbac\nstatus: draft\n`,
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "ccp-metricsserver.yaml"),
      `featureId: ccp-metricsserver\nstatus: draft\n`,
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "airlock.yaml"),
      `featureId: airlock\nstatus: draft\n`,
      "utf8",
    );
    await writeRootTree(projectDir);
    const statePath = join(
      projectDir,
      ".state",
      "feature-reference-loop",
      "state.json",
    );
    await mkdir(join(projectDir, ".state", "feature-reference-loop"), {
      recursive: true,
    });
    const { state } = loadFeatureReferenceLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-reference-loop",
      windowSize: 5,
      statePath,
    });
    updateFeatureReferenceItem(state, "aad-rbac", {
      status: "done",
      taskId: "collect-feature-reference-aad-rbac-retry-202607010158-1",
      lastOutputPath: "evidence/archive/feature-reference-aad-rbac-20260627.md",
      lastSummary:
        "Archived accepted collector evidence already exists for aad-rbac; owner closed the retry as duplicate churn cleanup.",
    });
    updateFeatureReferenceItem(state, "ccp-metricsserver", {
      status: "done",
      taskId:
        "collect-feature-reference-ccp-metricsserver-retry-202607010158-2",
      lastOutputPath:
        "evidence/archive/feature-reference-ccp-metricsserver-20260627.md",
      lastSummary:
        "Accepted supporting-context packet already links the durable public authority for ccp-metricsserver.",
    });
    updateFeatureReferenceItem(state, "airlock", {
      status: "done",
      taskId: "collect-feature-reference-airlock",
      lastOutputPath: "evidence/archive/feature-reference-airlock-20260630.md",
      lastSummary:
        "AAD/app repair wave confirmed airlock remains an exact checked-location public ceiling: adjacent system-pool, Run Command, and securityProfile surfaces are public, but no dedicated public Learn or AKS REST/spec Airlock/VMAgent contract was found.",
    });
    saveFeatureReferenceLoopState(statePath, state);

    const reloaded = loadFeatureReferenceLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-reference-loop",
      windowSize: 5,
      statePath,
    }).state;

    expect(reloaded.features["aad-rbac"]).toMatchObject({
      status: "done",
      taskId: null,
      suppression: expect.objectContaining({ kind: "duplicate-churn" }),
    });
    expect(reloaded.features["ccp-metricsserver"]).toMatchObject({
      status: "done",
      taskId: null,
      suppression: expect.objectContaining({ kind: "supporting-context" }),
    });
    expect(reloaded.features["airlock"]).toMatchObject({
      status: "done",
      taskId: null,
      suppression: expect.objectContaining({ kind: "public-ceiling" }),
    });
    expect(orderedPendingFeatureKeys(reloaded)).not.toContain("aad-rbac");
    expect(orderedPendingFeatureKeys(reloaded)).not.toContain(
      "ccp-metricsserver",
    );
    expect(orderedPendingFeatureKeys(reloaded)).not.toContain("airlock");
  });

  test("reload preserves dormant-backlog hold-state features outside refill candidates", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "features", "storage-csi.yaml"),
      `capabilityId: storage-csi\nstatus: draft\n`,
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "runtime-container.yaml"),
      `featureId: runtime-container\nstatus: draft\n`,
      "utf8",
    );
    await writeRootTree(projectDir);
    const statePath = join(
      projectDir,
      ".state",
      "feature-reference-loop",
      "state.json",
    );
    await mkdir(join(projectDir, ".state", "feature-reference-loop"), {
      recursive: true,
    });
    await writeFile(
      statePath,
      `${JSON.stringify(
        {
          loopTaskId: "aks-feature-reference-loop",
          windowSize: 5,
          cursor: 0,
          holdState: {
            mode: "dormant-backlog-preserved",
            staleFeatureKeys: [],
            dormantFeatureKeys: ["storage-csi", "runtime-container"],
            reopenDefaultFeatureKeys: ["storage-csi"],
            noRefillNow: true,
            note: "drained bookkeeping hold",
            updatedAt: new Date().toISOString(),
          },
          features: {
            "storage-csi": {
              featureKey: "storage-csi",
              packetPath: "features/storage-csi.yaml",
              packetKind: "capability",
              layout: "capability-root",
              capabilityId: "storage-csi",
              coveredFeatureIds: [],
              status: "dormant",
              taskId: null,
              attempts: 3,
              lastOutputPath:
                "evidence/archive/feature-reference-storage-csi-20260630.md",
              lastSummary:
                "Accepted drained-lane hold keeps storage-csi outside refill.",
              updatedAt: new Date().toISOString(),
            },
            "runtime-container": {
              featureKey: "runtime-container",
              packetPath: "features/runtime-container.yaml",
              packetKind: "feature",
              layout: "migration-root-feature",
              capabilityId: null,
              coveredFeatureIds: [],
              status: "dormant",
              taskId: null,
              attempts: 2,
              lastOutputPath:
                "evidence/archive/feature-reference-runtime-container-20260630.md",
              lastSummary:
                "Accepted drained-lane hold keeps runtime-container outside refill.",
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const reloaded = loadFeatureReferenceLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-reference-loop",
      windowSize: 5,
      statePath,
    }).state;

    expect(reloaded.holdState).toMatchObject({
      mode: "dormant-backlog-preserved",
      noRefillNow: true,
      dormantFeatureKeys: ["storage-csi", "runtime-container"],
    });
    expect(reloaded.features["storage-csi"]).toMatchObject({
      status: "dormant",
      taskId: null,
    });
    expect(reloaded.features["runtime-container"]).toMatchObject({
      status: "dormant",
      taskId: null,
    });
    expect(orderedPendingFeatureKeys(reloaded)).not.toContain("storage-csi");
    expect(orderedPendingFeatureKeys(reloaded)).not.toContain(
      "runtime-container",
    );
  });

  test("real unfinished feature references still reopen truthfully after reload", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "features", "app-routing.yaml"),
      `capabilityId: app-routing\nstatus: draft\n`,
      "utf8",
    );
    await writeRootTree(projectDir);
    const statePath = join(
      projectDir,
      ".state",
      "feature-reference-loop",
      "state.json",
    );
    await mkdir(join(projectDir, ".state", "feature-reference-loop"), {
      recursive: true,
    });
    const { state } = loadFeatureReferenceLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-reference-loop",
      windowSize: 5,
      statePath,
    });
    updateFeatureReferenceItem(state, "app-routing", {
      status: "done",
      taskId: "collect-feature-reference-app-routing",
      lastOutputPath:
        "evidence/archive/repair-feature-reference-review-aad-app-surface-wave-20260630.md",
      lastSummary:
        "Repaired capability-root packet with consolidated public authorities plus exact mounted-source paths; root claims stay limited to ingress-profile shell and major documented constraints.",
    });
    saveFeatureReferenceLoopState(statePath, state);

    const reloaded = loadFeatureReferenceLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-reference-loop",
      windowSize: 5,
      statePath,
    }).state;

    expect(reloaded.features["app-routing"].suppression).toBeNull();
    expect(reloaded.features["app-routing"].status).toBe("pending");
    expect(orderedPendingFeatureKeys(reloaded)).toContain("app-routing");
  });

  test("reload plus pulse reconciles the 2026-07-01 stale-active family examples to truthful non-active states", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "features", "node-pool-config.yaml"),
      `featureId: node-pool-config\nstatus: draft\n`,
      "utf8",
    );
    await mkdir(join(projectDir, "features", "node-autoprovision", "packets"), {
      recursive: true,
    });
    await mkdir(join(projectDir, "features", "private-cluster", "packets"), {
      recursive: true,
    });
    await writeFile(
      join(
        projectDir,
        "features",
        "node-autoprovision",
        "packets",
        "create-auto.yaml",
      ),
      `featureId: node-autoprovision-create-auto\nstatus: draft\n`,
      "utf8",
    );
    await writeFile(
      join(
        projectDir,
        "features",
        "private-cluster",
        "packets",
        "authorized-service-tags.yaml",
      ),
      `featureId: private-cluster-vnet-integration-auth-service-tags\nstatus: draft\n`,
      "utf8",
    );
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-reference-loop"].children = [
      "collect-feature-reference-node-pool-config",
      "collect-feature-reference-node-autoprovision-create-auto",
      "collect-feature-reference-private-cluster-vnet-integration-auth-service-tags",
    ];
    tree.tasks["collect-feature-reference-node-pool-config"] = {
      id: "collect-feature-reference-node-pool-config",
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
      conflict_scope: ["feature-reference:node-pool-config"],
      depends_on: [],
      context: {
        featureKey: "node-pool-config",
        packetPath: "features/node-pool-config.yaml",
        packetKind: "feature",
        layout: "migration-root-feature",
        stateRef: ".state/feature-reference-loop/state.json",
        loopTaskId: "aks-feature-reference-loop",
      },
      trace: {
        last_worker_result: "partial",
        last_worker_summary:
          "Official reference collection for node-pool-config is incomplete: missing Azure REST API spec. Draft: evidence/archive/feature-reference-node-pool-config-20260701.md.",
      },
      result:
        "Official reference collection for node-pool-config is incomplete: missing Azure REST API spec. Draft: evidence/archive/feature-reference-node-pool-config-20260701.md.",
    };
    tree.tasks["collect-feature-reference-node-autoprovision-create-auto"] = {
      id: "collect-feature-reference-node-autoprovision-create-auto",
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
      conflict_scope: ["feature-reference:node-autoprovision-create-auto"],
      depends_on: [],
      context: {
        featureKey: "node-autoprovision-create-auto",
        packetPath: "features/node-autoprovision/packets/create-auto.yaml",
        packetKind: "feature",
        layout: "branch-packet",
        capabilityId: "node-autoprovision",
        stateRef: ".state/feature-reference-loop/state.json",
        loopTaskId: "aks-feature-reference-loop",
      },
      trace: {
        last_worker_result: "partial",
        last_worker_summary:
          "Official reference collection for node-autoprovision-create-auto is incomplete: missing official Microsoft Learn documentation and Azure REST API spec. Draft: evidence/archive/feature-reference-node-autoprovision-create-auto-20260701.md.",
      },
      result:
        "Official reference collection for node-autoprovision-create-auto is incomplete: missing official Microsoft Learn documentation and Azure REST API spec. Draft: evidence/archive/feature-reference-node-autoprovision-create-auto-20260701.md.",
    };
    tree.tasks[
      "collect-feature-reference-private-cluster-vnet-integration-auth-service-tags"
    ] = {
      id: "collect-feature-reference-private-cluster-vnet-integration-auth-service-tags",
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
      conflict_scope: [
        "feature-reference:private-cluster-vnet-integration-auth-service-tags",
      ],
      depends_on: [],
      context: {
        featureKey: "private-cluster-vnet-integration-auth-service-tags",
        packetPath:
          "features/private-cluster/packets/authorized-service-tags.yaml",
        packetKind: "feature",
        layout: "branch-packet",
        capabilityId: "private-cluster",
        stateRef: ".state/feature-reference-loop/state.json",
        loopTaskId: "aks-feature-reference-loop",
      },
      trace: {
        last_worker_result: "done",
        last_worker_summary:
          "Collected official feature references for private-cluster-vnet-integration-auth-service-tags: evidence/archive/feature-reference-private-cluster-vnet-integration-auth-service-tags-20260701.md.",
      },
      result:
        "Collected official feature references for private-cluster-vnet-integration-auth-service-tags: evidence/archive/feature-reference-private-cluster-vnet-integration-auth-service-tags-20260701.md.",
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    await mkdir(join(projectDir, ".state", "feature-reference-loop"), {
      recursive: true,
    });
    await writeFile(
      join(
        projectDir,
        "evidence",
        "archive",
        "feature-reference-private-cluster-vnet-integration-auth-service-tags-20260701.md",
      ),
      `# Feature Reference: private-cluster-vnet-integration-auth-service-tags

## Official API References

- azure-rest-api-specs/specification/containerservice/managedClusters.json: Managed cluster API server access profile contract.

## Official Documentation References

- https://learn.microsoft.com/en-us/azure/aks/api-server-service-tags: Service-tag preview guidance.
`,
      "utf8",
    );
    await writeFile(
      join(projectDir, ".state", "feature-reference-loop", "state.json"),
      `${JSON.stringify(
        {
          loopTaskId: "aks-feature-reference-loop",
          windowSize: 5,
          cursor: 0,
          features: {
            "node-pool-config": {
              featureKey: "node-pool-config",
              packetPath: "features/node-pool-config.yaml",
              packetKind: "feature",
              layout: "migration-root-feature",
              capabilityId: null,
              coveredFeatureIds: [],
              status: "running",
              taskId: "collect-feature-reference-node-pool-config",
              attempts: 3,
              lastOutputPath:
                "evidence/archive/feature-reference-node-pool-config-20260630.md",
              lastSummary:
                "Official reference collection for node-pool-config is incomplete: missing official Microsoft Learn documentation and Azure REST API spec. Draft: evidence/archive/feature-reference-node-pool-config-20260630.md.",
              updatedAt: new Date().toISOString(),
            },
            "node-autoprovision-create-auto": {
              featureKey: "node-autoprovision-create-auto",
              packetPath:
                "features/node-autoprovision/packets/create-auto.yaml",
              packetKind: "feature",
              layout: "branch-packet",
              capabilityId: "node-autoprovision",
              coveredFeatureIds: [],
              status: "pending",
              taskId: null,
              attempts: 1,
              lastOutputPath:
                "evidence/archive/feature-reference-node-autoprovision-create-auto-20260630.md",
              lastSummary:
                "Reopened feature-reference collection because Azure REST API spec was missing from the accepted artifact.",
              updatedAt: new Date().toISOString(),
            },
            "private-cluster-vnet-integration-auth-service-tags": {
              featureKey: "private-cluster-vnet-integration-auth-service-tags",
              packetPath:
                "features/private-cluster/packets/authorized-service-tags.yaml",
              packetKind: "feature",
              layout: "branch-packet",
              capabilityId: "private-cluster",
              coveredFeatureIds: [],
              status: "done",
              taskId:
                "collect-feature-reference-private-cluster-vnet-integration-auth-service-tags",
              attempts: 0,
              lastOutputPath:
                "evidence/archive/feature-reference-private-cluster-vnet-integration-auth-service-tags-20260701.md",
              lastSummary:
                "Collected official feature references for private-cluster-vnet-integration-auth-service-tags: evidence/archive/feature-reference-private-cluster-vnet-integration-auth-service-tags-20260701.md.",
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
    expect(state.features["node-pool-config"]).toMatchObject({
      status: "error",
      taskId: "collect-feature-reference-node-pool-config",
      lastOutputPath:
        "evidence/archive/feature-reference-node-pool-config-20260701.md",
    });
    expect(state.features["node-autoprovision-create-auto"]).toMatchObject({
      status: "error",
      taskId: "collect-feature-reference-node-autoprovision-create-auto",
      lastOutputPath:
        "evidence/archive/feature-reference-node-autoprovision-create-auto-20260701.md",
    });
    expect(
      state.features["private-cluster-vnet-integration-auth-service-tags"],
    ).toMatchObject({
      status: "done",
      taskId:
        "collect-feature-reference-private-cluster-vnet-integration-auth-service-tags",
      lastOutputPath:
        "evidence/archive/feature-reference-private-cluster-vnet-integration-auth-service-tags-20260701.md",
    });
    expect(orderedPendingFeatureKeys(state)).toContain("node-pool-config");
    expect(orderedPendingFeatureKeys(state)).toContain(
      "node-autoprovision-create-auto",
    );
    expect(orderedPendingFeatureKeys(state)).not.toContain(
      "private-cluster-vnet-integration-auth-service-tags",
    );

    const updatedTree = JSON.parse(await readFile(treePath, "utf8"));
    expect(
      updatedTree.tasks["collect-feature-reference-node-pool-config"].state,
    ).toBe("done");
    expect(
      updatedTree.tasks[
        "collect-feature-reference-node-autoprovision-create-auto"
      ].state,
    ).toBe("done");
    expect(
      updatedTree.tasks[
        "collect-feature-reference-private-cluster-vnet-integration-auth-service-tags"
      ].state,
    ).toBe("done");
    expect(
      updatedTree.tasks["aks-feature-reference-loop"].context.workflowProgress,
    ).toMatchObject({
      completionReady: false,
      running: 0,
      done: 1,
      error: 2,
    });
  });
});
