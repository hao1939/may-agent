import { projectRuntimePaths, resolveTaskTreePath } from "@may-agent/sdk";
import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assignTask,
  compactDoneLeaves,
  completeTask,
  confirmRunnableBacklogLeaves,
  createTask,
  kanbanTaskTreeState,
  listRunnableBacklogTaskIds,
  markTaskDone,
  planningPacket,
  pruneMissingChildren,
  refreshBlockedWait,
  requeueStaleActiveTasks,
  repairTaskTreeRollups,
  rollupParent,
  saveTaskTreeWithKanbanSnapshot,
  seedModelGapBacklog,
  summarizeTaskTree,
  taskTreeConfig,
  updateAcceptedReviewMetadata,
  updateArchivedTaskOutputs,
  updateArchivedTaskEvidence,
  updateTaskOutputs,
  updateTaskText,
  unblockTask,
} from "./lib/task-tree-tools.ts";
import { readTaskTree } from "./lib/task-tree-store.ts";
import { reopenControllerRootWhenIncomplete } from "./lib/loop-controller-repair.ts";

async function makeProject() {
  const dir = await mkdtemp(join(tmpdir(), "aks-task-tree-tools-"));
  await mkdir(join(dir, ".state"), { recursive: true });
  await mkdir(join(dir, "tasks"), { recursive: true });
  await writeFile(join(dir, ".state", "journal.jsonl"), "", "utf8");
  return dir;
}

async function writeSpecLoopState(
  projectDir: string,
  specs: Record<string, Record<string, unknown>>,
) {
  await mkdir(join(projectDir, ".state", "spec-loop"), { recursive: true });
  await writeFile(
    join(projectDir, ".state", "spec-loop", "state.json"),
    `${JSON.stringify(
      {
        loopTaskId: "aks-spec-verification-loop",
        windowSize: 5,
        cursor: 0,
        prioritySpecIds: [],
        specs,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function config(projectDir: string) {
  return taskTreeConfig({
    appDir: projectDir,
    projectDir,
    worker: "aks-explorer",
    maxConcurrent: 3,
  });
}

describe("task tree tools", () => {
  test("open Condition ownership mechanically rejects generic task and registry mutations", async () => {
    const projectDir = await makeProject();
    const taskId = "wait-condition-owned";
    const conditionId = "condition:pipeline:ado:172500001:terminal";
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify({
        version: 1,
        project: "aks-rp-e2e",
        root_task_id: "project",
        tasks: {
          project: {
            id: "project",
            state: "backlog",
            children: [taskId, "unrelated"],
          },
          [taskId]: {
            id: taskId,
            revision: 1,
            parent_id: "project",
            state: "blocked",
            children: [],
            goal: "Wait for the exact run.",
            outputs: ["runs/test-results/"],
            acceptance: ["Review the terminal artifact."],
            context: { controlPlaneVersion: 2, conditionId },
            blocker: {
              condition_id: conditionId,
              condition: "Wait for run 172500001.",
            },
          },
          unrelated: {
            id: "unrelated",
            parent_id: "project",
            state: "backlog",
            children: [],
            goal: "Unrelated work.",
            outputs: ["evidence/unrelated.md"],
            acceptance: ["Done."],
          },
        },
        conditions: {
          [conditionId]: {
            version: "project-condition-v2",
            id: conditionId,
            status: "open",
            subject: { kind: "task", id: taskId, revision: 1 },
          },
        },
      })}\n`,
      "utf8",
    );
    const treeConfig = config(projectDir);
    const ownershipError = `owned by open Condition ${conditionId}`;

    expect(() =>
      updateTaskText(treeConfig, {
        taskId,
        goal: "Generic replacement goal.",
      }),
    ).toThrow(ownershipError);
    expect(() =>
      refreshBlockedWait(treeConfig, {
        taskId,
        condition: "Refresh the wait generically.",
        resumeCondition: "Run is terminal.",
        summary: "Generic refresh.",
      }),
    ).toThrow(ownershipError);
    expect(() =>
      unblockTask(treeConfig, {
        taskId,
        reason: "Generic unblock.",
      }),
    ).toThrow(ownershipError);
    expect(() =>
      markTaskDone(treeConfig, {
        taskId,
        taskRevision: 1,
        summary: "Generic closure.",
        resolution: "replaced",
      }),
    ).toThrow(ownershipError);

    const directTree = readTaskTree(treeConfig);
    directTree.conditions![conditionId] = {
      ...(directTree.conditions![conditionId] as Record<string, unknown>),
      status: "resolved",
    };
    expect(() =>
      saveTaskTreeWithKanbanSnapshot(treeConfig, directTree),
    ).toThrow(ownershipError);
    expect(() =>
      saveTaskTreeWithKanbanSnapshot(treeConfig, directTree, {
        kind: "project-condition-v2",
        conditionId,
        taskId,
        taskRevision: 1,
        action: "generic-refresh",
      } as any),
    ).toThrow(ownershipError);

    expect(
      updateTaskText(treeConfig, {
        taskId: "unrelated",
        goal: "Updated unrelated work.",
      }).goal,
    ).toBe("Updated unrelated work.");
    const stored = readTaskTree(treeConfig);
    expect(stored.tasks[taskId].goal).toBe("Wait for the exact run.");
    expect(
      (stored.conditions![conditionId] as Record<string, unknown>).status,
    ).toBe("open");
  });

  test("planning packet derives its frontier and generation from ProjectSnapshotV2", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: "2026-07-16T06:00:00.000Z",
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: ["structural-parent", "live-review"],
              context: {
                current_root_readout: {
                  review_task_ids: ["ghost-review"],
                },
              },
            },
            "structural-parent": {
              id: "structural-parent",
              parent_id: "project",
              state: "blocked",
              children: [],
            },
            "blocked-child": {
              id: "blocked-child",
              parent_id: "structural-parent",
              state: "blocked",
              children: [],
            },
            "live-review": {
              id: "live-review",
              parent_id: "project",
              state: "review",
              children: [],
              goal: "Review the live result.",
              outputs: ["evidence/live.md"],
              acceptance: ["Review is applied."],
            },
            "disconnected-container": {
              id: "disconnected-container",
              state: "blocked",
              kind: "work",
              children: [],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));
    expect(packet.frontier.review).toEqual(["live-review"]);
    expect(packet.frontier.blocked).toEqual(["blocked-child"]);
    expect(packet.counts.blocked).toBe(1);
    expect(packet.total).toBe(4);
    expect(packet.project_snapshot).toMatchObject({
      version: "project-snapshot-v2",
      tree_updated_at: "2026-07-16T06:00:00.000Z",
      frontier_counts: { review: 1, blocked: 1, total: 4 },
    });
    const kanban = kanbanTaskTreeState(config(projectDir)).kanban;
    expect(kanban.tree_total).toBe(4);
    expect(kanban.card_ids_by_column.review).toEqual([
      "blocked-child",
      "live-review",
    ]);
    expect(kanban.card_ids_by_column.blocked).toEqual([]);
    expect(kanban.card_ids_by_column.review).not.toContain("structural-parent");
    expect(kanban.card_ids_by_column.review).not.toContain(
      "disconnected-container",
    );
  });

  test("planning packet reports ready-path frontier materialization gaps from current live carriers", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "model", "knowledge-map", "views"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, "model", "knowledge-map", "views", "path-summary.json"),
      `${JSON.stringify(
        {
          generatedAt: "2026-07-17T12:35:54.702Z",
          paths: [
            {
              id: "path.feature-a.ready",
              featureId: "feature-a",
              specId: "spec.feature-a.ready",
              status: "ready",
            },
            {
              id: "path.feature-b.ready",
              featureId: "feature-b",
              specId: "spec.feature-b.ready",
              status: "ready",
            },
            {
              id: "path.feature-c.pass",
              featureId: "feature-c",
              specId: "spec.feature-c.pass",
              status: "pass",
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: "2026-07-17T13:00:00.000Z",
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: ["wait-feature-a"],
              goal: "project",
            },
            "wait-feature-a": {
              id: "wait-feature-a",
              parent_id: "project",
              state: "blocked",
              kind: "domain_leaf",
              children: [],
              goal: "Wait for spec.feature-a.ready to return.",
              conflict_scope: ["path:path.feature-a.ready"],
              outputs: ["evidence/archive/feature-a.md"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));
    expect(packet.ready_path_frontier_materialization).toEqual({
      status: "gap",
      generated_at: "2026-07-17T12:35:54.702Z",
      ready_count: 2,
      represented_ready_path_ids: ["path.feature-a.ready"],
      unrepresented_ready_path_ids: ["path.feature-b.ready"],
    });
  });

  test("allows owner-decided ordinary task creation directly under root", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: [],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const task = createTask(config(projectDir), {
      id: "dated-frontier-20260615",
      parentId: "project",
      goal: "owner-decided root work",
      outputs: ["evidence/archive/root-work.md"],
      acceptance: ["done"],
    });

    expect(task.parent_id).toBe("project");
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks.project.children).toEqual(["dated-frontier-20260615"]);
  });

  test("rejects temporary operating work from replacing the configured project goal", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "project.json"),
      `${JSON.stringify({ goal: "Deliver durable AKS verification outcomes." })}\n`,
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: [],
              goal: "Deliver durable AKS verification outcomes.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    expect(() =>
      updateTaskText(config(projectDir), {
        taskId: "project",
        goal: "Refresh blocked-wait metadata forever.",
      }),
    ).toThrow("Project root goal is immutable");
  });

  test("repair-rollups restores a drifted root goal from project.json", async () => {
    const projectDir = await makeProject();
    const goal = "Deliver durable AKS verification outcomes.";
    await writeFile(
      join(projectDir, "project.json"),
      `${JSON.stringify({ goal })}\n`,
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: [],
              goal: "Maintain feedback-loop bookkeeping.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = repairTaskTreeRollups(config(projectDir));
    expect(result.repairedProjectRootGoal).toBe(true);
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks.project.goal).toBe(goal);
    expect(tree.tasks.project.trace.previous_project_goal).toBe(
      "Maintain feedback-loop bookkeeping.",
    );
  });

  test("refreshes the legacy task snapshot when runtime task-tree writes land", async () => {
    const projectDir = await makeProject();
    const runtimeTreePath = resolveTaskTreePath(projectDir);
    const legacyTreePath = join(projectDir, "tasks", "tree.json");
    await writeFile(
      runtimeTreePath,
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: [],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      legacyTreePath,
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: "stale-task",
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: [],
              goal: "stale project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    createTask(config(projectDir), {
      id: "dated-frontier-20260615",
      parentId: "project",
      goal: "owner-decided root work",
      outputs: ["evidence/archive/root-work.md"],
      acceptance: ["done"],
    });

    const runtimeTree = JSON.parse(await readFile(runtimeTreePath, "utf8"));
    const legacyTree = JSON.parse(await readFile(legacyTreePath, "utf8"));
    expect(legacyTree).toEqual(runtimeTree);
    expect(legacyTree.tasks.project.children).toEqual([
      "dated-frontier-20260615",
    ]);
    expect(legacyTree.active_task_id).toBeNull();
  });

  test("preserves supplied structured blocker objects when creating blocked tasks", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: [],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    createTask(config(projectDir), {
      id: "blocked-frontier-holder",
      parentId: "project",
      state: "blocked",
      goal: "Keep one exact timeout frontier visible.",
      outputs: ["evidence/archive/blocked-frontier-holder.md"],
      acceptance: ["resume only when the timeout surface changes"],
      blocker: {
        condition: "Blocked on the exact timeout frontier.",
        category: "external-wait",
        owner: "aks-explorer",
        blocked_at: "2026-07-08T21:16:29.910Z",
        waiting_for: {
          type: "environment.available",
          taskId: "blocked-frontier-holder",
          sourceRunId: "171365996",
        },
        observed_by: {
          workflow: "project-planner",
          schedule: "blocked-frontier-app-ops-review",
          trigger: "project.owner.requested",
        },
        observation_method:
          "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
        next_check_at: "2026-07-08T21:31:29.521Z",
        resume_condition:
          "Resume when the stated blocker condition is no longer true and the owner records the concrete evidence.",
        fallback_at: "2026-07-09T21:21:29.521Z",
        fallback_action:
          "If the wait is still true at fallback time, create or reuse an owner recovery/escalation task, or update the blocked wait with fresh evidence.",
      },
    });

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["blocked-frontier-holder"].blocker).toMatchObject({
      condition: "Blocked on the exact timeout frontier.",
      category: "external-wait",
      owner: "aks-explorer",
      waiting_for: {
        type: "environment.available",
        taskId: "blocked-frontier-holder",
        sourceRunId: "171365996",
      },
      observed_by: {
        workflow: "project-planner",
        schedule: "blocked-frontier-app-ops-review",
        trigger: "project.owner.requested",
      },
      next_check_at: "2026-07-08T21:31:29.521Z",
      fallback_at: "2026-07-09T21:21:29.521Z",
      fallback_action:
        "If the wait is still true at fallback time, create or reuse an owner recovery/escalation task, or update the blocked wait with fresh evidence.",
    });
  });

  test("refreshes a terminal review leaf back to a blocked wait and strips old run metadata", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["hold-compact-feature-frontier"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "hold-compact-feature-frontier": {
              id: "hold-compact-feature-frontier",
              parent_id: "project",
              state: "review",
              status: "review",
              kind: "domain_leaf",
              priority: "P2",
              owner: "operator",
              children: [],
              goal: "Hold an exact compact frontier.",
              outputs: ["task tree"],
              acceptance: ["wait is exact"],
              context: {
                terminalPipelineWaitReview: {
                  runId: "171715936",
                  runStatus: "completed",
                },
              },
              trace: {
                terminal_pipeline_wait_run_id: "171715936",
                terminal_github_wait_run_id: "171715936",
                previous_blocker_before_terminal_pipeline_wait_review: {
                  condition: "old pipeline run 171715936 text",
                },
                previous_blocker_before_terminal_github_wait_review: {
                  condition: "old run 171715936 text",
                },
              },
              result: "Azure DevOps pipeline run 171715936 is terminal.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const task = refreshBlockedWait(config(projectDir), {
      taskId: "hold-compact-feature-frontier",
      condition: "Resume only when the compact frontier changes.",
      resumeCondition: "Resume when accepted evidence narrows the frontier.",
      summary: "Terminal run review produced no promotion; keep exact wait.",
      waitingFor: {
        type: "frontier.changed",
        featureKey: "rp-cluster-lifecycle",
      },
    });

    expect(task.state).toBe("blocked");
    expect(task.status).toBe("blocked");
    expect(task.result).toContain("Terminal run review produced no promotion");
    expect(task.blocker.condition).toContain("compact frontier changes");
    expect(task.blocker.waiting_for).toEqual({
      type: "frontier.changed",
      featureKey: "rp-cluster-lifecycle",
    });
    expect(task.context.terminalPipelineWaitReview).toBeUndefined();
    expect(task.trace.terminal_pipeline_wait_run_id).toBeUndefined();
    expect(task.trace.terminal_github_wait_run_id).toBeUndefined();
    expect(
      task.trace.previous_blocker_before_terminal_pipeline_wait_review,
    ).toBeUndefined();
    expect(
      task.trace.previous_blocker_before_terminal_github_wait_review,
    ).toBeUndefined();
    expect(task.trace.previous_nonterminal_status).toBe("review");
  });

  test("refresh-blocked-wait preserves existing structured approval wait metadata when no new wait target is provided", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: ["primary-approval-wait"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "primary-approval-wait": {
              id: "primary-approval-wait",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Keep one exact project-level approval-return wait.",
              outputs: ["evidence/archive/wait.md"],
              acceptance: ["approval return reviewed"],
              blocker: {
                condition:
                  "Blocked on the returned project approval decision for the exact focus/shared owner-return lineage.",
                category: "external-wait",
                owner: "app-ops",
                blocked_at: "2026-07-13T00:41:43.626Z",
                waiting_for: {
                  type: "project.approval.submitted",
                  taskId: "primary-approval-wait",
                  lineages: [
                    {
                      pathId:
                        "focus-review-off_track-approval-refresh-20260712",
                      approvalId:
                        "aks-rp-e2e:approval:focus-review-off_track-approval-refresh-20260712:evidence-archive-ops-repair-focus-review-off-track-approval-refresh-20260712.md",
                      waitId:
                        "wait:aks-rp-e2e:approval:focus-review-off_track-approval-refresh-20260712:evidence-archive-ops-repair-focus-review-off-track-approval-refresh-20260712.md",
                    },
                    {
                      pathId:
                        "shared-authenticated-artifact-result-recovery-family-20260712",
                      approvalId:
                        "aks-rp-e2e:approval:shared-authenticated-artifact-result-recovery-family-20260712:evidence-archive-ops-escalate-shared-auth-runtime-and-github-artifact-owner-return-family-20260712.md",
                      waitId:
                        "wait:aks-rp-e2e:approval:shared-authenticated-artifact-result-recovery-family-20260712:evidence-archive-ops-escalate-shared-auth-runtime-and-github-artifact-owner-return-family-20260712.md",
                    },
                  ],
                },
                observed_by: {
                  workflow: "project-planner",
                  trigger: "project.approval.submitted",
                },
                observation_method:
                  "Planner/app-ops handles the returned approval event or reviewed same-lineage evidence for this exact family carrier.",
                next_check_at: "2026-07-14T00:40:00Z",
                resume_condition:
                  "Resume when a matching returned approval decision lands for one of the governed lineages.",
                fallback_at: "2026-07-14T06:04:00Z",
                fallback_action:
                  "If no decision lands, refresh the same family carrier with sharper reviewed evidence.",
              },
              trace: {
                created_at: "2026-07-13T00:41:43.626Z",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const task = refreshBlockedWait(config(projectDir), {
      taskId: "primary-approval-wait",
      condition:
        "Blocked on refreshed reviewed evidence for the exact focus/shared owner-return lineage while no returned decision is controller-visible.",
      resumeCondition:
        "Resume immediately if a matching project.approval.submitted decision lands for one of the governed lineages.",
      summary:
        "Refreshed the exact project-level approval-return wait without changing its structured wait target.",
      nextCheckAt: "2026-07-14T12:40:00Z",
      fallbackAt: "2026-07-14T18:40:00Z",
      fallbackAction:
        "If no decision lands, refresh the same family carrier again with sharper reviewed evidence.",
    });

    expect(task.blocker.waiting_for).toEqual({
      type: "project.approval.submitted",
      taskId: "primary-approval-wait",
      lineages: [
        {
          pathId: "focus-review-off_track-approval-refresh-20260712",
          approvalId:
            "aks-rp-e2e:approval:focus-review-off_track-approval-refresh-20260712:evidence-archive-ops-repair-focus-review-off-track-approval-refresh-20260712.md",
          waitId:
            "wait:aks-rp-e2e:approval:focus-review-off_track-approval-refresh-20260712:evidence-archive-ops-repair-focus-review-off-track-approval-refresh-20260712.md",
        },
        {
          pathId:
            "shared-authenticated-artifact-result-recovery-family-20260712",
          approvalId:
            "aks-rp-e2e:approval:shared-authenticated-artifact-result-recovery-family-20260712:evidence-archive-ops-escalate-shared-auth-runtime-and-github-artifact-owner-return-family-20260712.md",
          waitId:
            "wait:aks-rp-e2e:approval:shared-authenticated-artifact-result-recovery-family-20260712:evidence-archive-ops-escalate-shared-auth-runtime-and-github-artifact-owner-return-family-20260712.md",
        },
      ],
    });
    expect(task.blocker.observed_by).toEqual({
      workflow: "project-planner",
      trigger: "project.approval.submitted",
    });
    expect(task.blocker.observation_method).toBe(
      "Planner/app-ops handles the returned approval event or reviewed same-lineage evidence for this exact family carrier.",
    );
    expect(task.blocker.next_check_at).toBe("2026-07-14T12:40:00Z");
    expect(task.blocker.fallback_at).toBe("2026-07-14T18:40:00Z");
  });

  test("updateTaskText preserves structured approval wait metadata after refresh even when a blocker patch carries null structured fields", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: ["primary-approval-wait"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "primary-approval-wait": {
              id: "primary-approval-wait",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Keep one exact project-level approval-return wait.",
              outputs: ["evidence/archive/wait.md"],
              acceptance: ["approval return reviewed"],
              blocker: {
                condition:
                  "Blocked on the returned project approval decision for the exact focus/shared owner-return lineage.",
                category: "external-wait",
                owner: "app-ops",
                blocked_at: "2026-07-13T00:41:43.626Z",
                waiting_for: {
                  type: "project.approval.submitted",
                  taskId: "primary-approval-wait",
                  lineages: [
                    {
                      pathId:
                        "focus-review-off_track-approval-refresh-20260712",
                      approvalId:
                        "aks-rp-e2e:approval:focus-review-off_track-approval-refresh-20260712:evidence-archive-ops-repair-focus-review-off-track-approval-refresh-20260712.md",
                    },
                  ],
                },
                observed_by: {
                  workflow: "project-planner",
                  trigger: "project.approval.submitted",
                },
                observation_method:
                  "Planner/app-ops handles the returned approval event or reviewed same-lineage evidence for this exact family carrier.",
                next_check_at: "2026-07-14T00:40:00Z",
                resume_condition:
                  "Resume when a matching returned approval decision lands for one of the governed lineages.",
                fallback_at: "2026-07-14T06:04:00Z",
                fallback_action:
                  "If no decision lands, refresh the same family carrier with sharper reviewed evidence.",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    refreshBlockedWait(config(projectDir), {
      taskId: "primary-approval-wait",
      condition:
        "Blocked on refreshed reviewed evidence for the exact focus/shared owner-return lineage while no returned decision is controller-visible.",
      resumeCondition:
        "Resume immediately if a matching project.approval.submitted decision lands for one of the governed lineages.",
      summary:
        "Refreshed the exact project-level approval-return wait without changing its structured wait target.",
      nextCheckAt: "2026-07-14T12:40:00Z",
      fallbackAt: "2026-07-14T18:40:00Z",
    });

    const updated = updateTaskText(config(projectDir), {
      taskId: "primary-approval-wait",
      blocker: {
        condition:
          "Accepted the three RP lifecycle review leaves and kept the same governing approval-return family wait.",
        waiting_for: null,
        observed_by: null,
      },
      nextCheckAt: "2026-07-14T22:00:00Z",
      fallbackAt: "2026-07-15T04:00:00Z",
      fallbackAction:
        "If no decision lands, refresh the same family carrier again with sharper reviewed evidence.",
    });

    expect(updated.blocker.waiting_for).toEqual({
      type: "project.approval.submitted",
      taskId: "primary-approval-wait",
      lineages: [
        {
          pathId: "focus-review-off_track-approval-refresh-20260712",
          approvalId:
            "aks-rp-e2e:approval:focus-review-off_track-approval-refresh-20260712:evidence-archive-ops-repair-focus-review-off-track-approval-refresh-20260712.md",
        },
      ],
    });
    expect(updated.blocker.observed_by).toEqual({
      workflow: "project-planner",
      trigger: "project.approval.submitted",
    });
    expect(updated.blocker.next_check_at).toBe("2026-07-14T22:00:00Z");
    expect(updated.blocker.fallback_at).toBe("2026-07-15T04:00:00Z");
  });

  test("refresh-blocked-wait syncs feature-compact projection timing when state points at the holder", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, ".state", "feature-compact-loop"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, ".state", "feature-compact-loop", "state.json"),
      `${JSON.stringify(
        {
          loopTaskId: "aks-feature-compact-loop",
          windowSize: 5,
          cursor: 0,
          features: {
            "bootstrap-profile": {
              featureKey: "bootstrap-profile",
              capabilityId: "bootstrap-profile",
              packetPath: null,
              specsDir: "features/bootstrap-profile/specs",
              specCount: 1,
              status: "blocked",
              taskId:
                "hold-compact-bootstrap-profile-byo-acr-create-cache-acr0-runtime-frontier-20260711b",
              frontierTaskIds: [],
              attempts: 0,
              lastPlanPath: null,
              lastSummaryPath: null,
              lastDiagnosticsPath: null,
              lastResultPath: null,
              lastWorkflowRunId: null,
              lastWorkflowRunUrl: null,
              lastWorkflowLoopKey: null,
              lastDispatchMetadataPath: null,
              lastLiveProofVersion: null,
              lastSummary: null,
              nextCheckAt: "2026-07-13T18:00:00Z",
              fallbackAt: "2026-07-14T18:00:00Z",
              updatedAt: "2026-07-11T03:46:20.626Z",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: ["aks-feature-compact-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-feature-compact-loop": {
              id: "aks-feature-compact-loop",
              parent_id: "project",
              state: "blocked",
              children: [
                "hold-compact-bootstrap-profile-byo-acr-create-cache-acr0-runtime-frontier-20260711b",
              ],
              goal: "Maintain compact projection state.",
              outputs: [".state/feature-compact-loop/state.json"],
              acceptance: ["projection kept current"],
            },
            "hold-compact-bootstrap-profile-byo-acr-create-cache-acr0-runtime-frontier-20260711b":
              {
                id: "hold-compact-bootstrap-profile-byo-acr-create-cache-acr0-runtime-frontier-20260711b",
                parent_id: "aks-feature-compact-loop",
                state: "blocked",
                children: [],
                goal: "Preserve one exact compact-facing bootstrap-profile frontier.",
                outputs: [".state/feature-compact-loop/state.json"],
                acceptance: ["timing stays current"],
                blocker: {
                  condition: "Old condition.",
                  category: "external-wait",
                  owner: "human",
                  blocked_at: "2026-07-11T03:36:38.120Z",
                  waiting_for: {
                    type: "blocker.resolved",
                    taskId:
                      "hold-compact-bootstrap-profile-byo-acr-create-cache-acr0-runtime-frontier-20260711b",
                  },
                  observed_by: {
                    workflow: "project-planner",
                    trigger: "project.owner.requested",
                  },
                  observation_method: "Observe the exact same wait.",
                  next_check_at: "2026-07-14T18:00:00Z",
                  resume_condition: "Old resume condition.",
                  fallback_at: "2026-07-15T18:00:00Z",
                  fallback_action: "Old fallback action.",
                },
              },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    refreshBlockedWait(config(projectDir), {
      taskId:
        "hold-compact-bootstrap-profile-byo-acr-create-cache-acr0-runtime-frontier-20260711b",
      condition: "Blocked on newer same-lineage evidence.",
      resumeCondition: "Resume when the create-cache-acr0 frontier moves.",
      summary: "Refreshed the bootstrap-profile runtime frontier hold.",
      nextCheckAt: "2026-07-14T18:00:00Z",
      fallbackAt: "2026-07-15T18:00:00Z",
    });

    const state = JSON.parse(
      await readFile(
        join(projectDir, ".state", "feature-compact-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.features["bootstrap-profile"].nextCheckAt).toBe(
      "2026-07-14T18:00:00Z",
    );
    expect(state.features["bootstrap-profile"].fallbackAt).toBe(
      "2026-07-15T18:00:00Z",
    );
  });

  test("refresh-blocked-wait advances fallback when a refresh would otherwise leave next-check at or after fallback", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: ["pipeline-wait"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "pipeline-wait": {
              id: "pipeline-wait",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Keep one exact pipeline wait.",
              outputs: [],
              acceptance: ["wait window stays truthful"],
              blocker: {
                condition: "Waiting for Azure DevOps run 123456789.",
                category: "external-wait",
                owner: "ado",
                blocked_at: "2026-07-15T11:20:00Z",
                waiting_for: {
                  type: "ado.pipeline_run.completed",
                  runId: "123456789",
                },
                observed_by: {
                  workflow: "project-execution-watchdog",
                  trigger: "project.watchdog.check.requested",
                },
                observation_method: "Watch the same exact ADO run.",
                next_check_at: "2026-07-15T11:24:00Z",
                resume_condition:
                  "Resume when the exact run becomes terminal and its artifacts are available.",
                fallback_at: "2026-07-15T11:35:00Z",
                fallback_action:
                  "If the run is still nonterminal at fallback, refresh the same wait in place.",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const task = refreshBlockedWait(config(projectDir), {
      taskId: "pipeline-wait",
      condition: "The exact ADO run is still nonterminal.",
      resumeCondition:
        "Resume when a fresh observation records the exact run as terminal.",
      summary:
        "Refreshed the same exact pipeline wait without queueing a rerun.",
      nextCheckAt: "2026-07-15T11:52:00Z",
    });

    expect(task.blocker.next_check_at).toBe("2026-07-15T11:52:00Z");
    expect(task.blocker.fallback_at).toBe("2026-07-15T12:02:00.000Z");
    expect(Date.parse(task.blocker.next_check_at)).toBeLessThan(
      Date.parse(task.blocker.fallback_at),
    );
  });

  test("model gap seeding does not fall back to root when parents are missing", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "model", "knowledge-map"), {
      recursive: true,
    });
    await mkdir(join(projectDir, "specs"), { recursive: true });
    await mkdir(join(projectDir, "replays"), { recursive: true });
    await writeFile(
      join(projectDir, "model", "knowledge-map", "model.json"),
      `${JSON.stringify({
        featurePaths: [
          {
            id: "path.feature-a.create",
            featureId: "feature-a",
            status: "unknown",
          },
        ],
      })}\n`,
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: [],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = seedModelGapBacklog(config(projectDir), { limit: 1 });

    expect(result.created).toEqual([]);
    expect(result.skipped).toEqual([
      { pathId: "path.feature-a.create", reason: "no-parent-task" },
    ]);
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks.project.children).toEqual([]);
  });

  test("model gap seeding skips execution-variant metadata paths", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "model", "knowledge-map"), {
      recursive: true,
    });
    await mkdir(join(projectDir, "specs"), { recursive: true });
    await mkdir(join(projectDir, "replays"), { recursive: true });
    await writeFile(
      join(projectDir, "model", "knowledge-map", "model.json"),
      `${JSON.stringify({
        featurePaths: [
          {
            id: "path.feature-a.execution-variant",
            featureId: "feature-a",
            status: "unknown",
            variantOfSpecId: "spec.feature-a",
            executionVariantId: "variant.feature-a.exec",
            specCoverage: {
              type: "execution-variant",
              specId: "spec.feature-a",
              variantId: "variant.feature-a.exec",
            },
          },
        ],
      })}\n`,
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["spec-runner-and-replays"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "spec-runner-and-replays": {
              id: "spec-runner-and-replays",
              parent_id: "project",
              state: "backlog",
              children: [],
              goal: "runner lane",
              outputs: ["runs/executions/"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = seedModelGapBacklog(config(projectDir), { limit: 1 });

    expect(result.created).toEqual([]);
    expect(result.skipped).toEqual([
      {
        pathId: "path.feature-a.execution-variant",
        reason: "execution-variant-metadata",
      },
    ]);
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["spec-runner-and-replays"].children).toEqual([]);
  });

  test("planning packet warns when retry work references terminal model paths", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "model", "knowledge-map"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, "model", "knowledge-map", "model.json"),
      `${JSON.stringify(
        {
          featurePaths: [
            {
              id: "path.feature-a.retry-me",
              status: "blocked",
              terminal: true,
              verdictFinal: true,
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: ["retry-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "retry-task": {
              id: "retry-task",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Retry path.feature-a.retry-me after source repair.",
              outputs: ["evidence/archive/retry.md"],
              acceptance: ["path.feature-a.retry-me can be reverified"],
              blocker: "model terminal verdict may be stale",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.project_hygiene_warnings).toEqual([
      expect.objectContaining({
        kind: "stale-terminal-retry",
        taskId: "retry-task",
        pathId: "path.feature-a.retry-me",
      }),
    ]);
  });

  test("planning packet suppresses warning for exact blocked prerequisite holder matching terminal resume contract", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "model", "knowledge-map"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, "model", "knowledge-map", "model.json"),
      `${JSON.stringify(
        {
          featurePaths: [
            {
              id: "path.feature-a.retry-me",
              status: "blocked",
              terminal: true,
              verdictFinal: true,
              retestCondition:
                "Provide SHARED_IDENTITY_RESOURCE_ID on the gate-open host and rerun the exact replay.",
            },
            {
              id: "path.feature-b.retry-me",
              status: "blocked",
              terminal: true,
              verdictFinal: true,
              retestCondition:
                "Set AKS_RP_E2E_ASSIGN_IDENTITY to a valid user-assigned identity resource ID and rerun the dedicated row-185 replay without broadening coverage.",
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: ["holder-task", "holder-task-paraphrased"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "holder-task": {
              id: "holder-task",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Keep path.feature-a.retry-me visible as an exact environment blocker; resume only when Provide SHARED_IDENTITY_RESOURCE_ID on the gate-open host and rerun the exact replay.",
              outputs: ["evidence/archive/holder.md"],
              acceptance: ["holder remains precise"],
              blocker:
                "External unblock required: blocked until Provide SHARED_IDENTITY_RESOURCE_ID on the gate-open host and rerun the exact replay.",
            },
            "holder-task-paraphrased": {
              id: "holder-task-paraphrased",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Hold path.feature-b.retry-me on the exact shared-identity prerequisite; rerun is meaningful only after the dedicated row-185 branch has AKS_RP_E2E_ASSIGN_IDENTITY set to a user-assigned identity resource ID.",
              outputs: ["evidence/archive/holder-b.md"],
              acceptance: ["holder remains precise"],
              blocker:
                "External unblock required: provide AKS_RP_E2E_ASSIGN_IDENTITY as a user-assigned identity resource id so the dedicated row-185 replay can proceed without broadening coverage.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.project_hygiene_warnings).toBeUndefined();
  });

  test("planning packet suppresses warning for explicit sibling subpath refinement work", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "model", "knowledge-map"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, "model", "knowledge-map", "model.json"),
      `${JSON.stringify(
        {
          featurePaths: [
            {
              id: "path.private-cluster-private-endpoint-connections",
              status: "pass",
              verdictFinal: true,
            },
            {
              id: "path.private-cluster-private-endpoint-connections-lifecycle",
              status: "blocked",
              verdictFinal: false,
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: "lifecycle-execute",
          active_task_ids: ["lifecycle-execute"],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: ["lifecycle-execute"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "lifecycle-execute": {
              id: "lifecycle-execute",
              parent_id: "project",
              state: "active",
              children: [],
              goal: "Run one bounded live execute attempt for the distinct subpath path.private-cluster-private-endpoint-connections-lifecycle only, explicitly preserving the accepted final-pass verdict for sibling path.private-cluster-private-endpoint-connections.",
              outputs: ["evidence/archive/lifecycle.md"],
              acceptance: [
                "The distinct subpath path.private-cluster-private-endpoint-connections-lifecycle stays separate from sibling path.private-cluster-private-endpoint-connections.",
              ],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.project_hygiene_warnings).toBeUndefined();
  });

  test("planning packet suppresses warning for explicit non-rerun compact-surface hygiene on a final path", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "model", "knowledge-map"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, "model", "knowledge-map", "model.json"),
      `${JSON.stringify(
        {
          featurePaths: [
            {
              id: "path.rp-cluster-lifecycle.preflight-validation",
              status: "pass",
              verdictFinal: true,
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: "compact-direct-path-repair",
          active_task_ids: ["compact-direct-path-repair"],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: ["compact-direct-path-repair"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "compact-direct-path-repair": {
              id: "compact-direct-path-repair",
              parent_id: "project",
              state: "active",
              children: [],
              goal: "Refresh the repo-local rp-cluster-lifecycle compact review surfaces for spec.rp-cluster-lifecycle.preflight-validation so committed compact artifacts point at features/rp-cluster-lifecycle/tests/rp-preflight-validation.test.ts instead of the deleted plain .ts path, without rerunning the already-final pass path or widening into unrelated rp-cluster-lifecycle specs.",
              outputs: [
                "../aks-rp-e2e/features/rp-cluster-lifecycle/compact/staging.plan.json",
              ],
              acceptance: [
                "features/rp-cluster-lifecycle/specs/rp-preflight-validation.json and features/rp-cluster-lifecycle/packets/preflight-validation.yaml continue to point at features/rp-cluster-lifecycle/tests/rp-preflight-validation.test.ts, and evidence explains this is compact-surface hygiene on already-final path path.rp-cluster-lifecycle.preflight-validation rather than rerun authority.",
                "The worker records exact non-rerun repo verification for the repaired compact artifact and does not launch a cloud rerun from this leaf.",
              ],
              conflict_scope: [
                "spec:spec.rp-cluster-lifecycle.preflight-validation",
                "path:path.rp-cluster-lifecycle.preflight-validation",
                "file:features/rp-cluster-lifecycle/compact/staging.plan.json",
              ],
              context: {
                repairSurface: "compact-direct-path",
                nonRerun: true,
                scenario: "spec.rp-cluster-lifecycle.preflight-validation",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.project_hygiene_warnings).toBeUndefined();
  });

  test("planning packet suppresses warning for final-path hygiene warning repair tasks", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "model", "knowledge-map"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, "model", "knowledge-map", "model.json"),
      `${JSON.stringify(
        {
          featurePaths: [
            {
              id: "path.rp-cluster-lifecycle.preflight-validation",
              status: "pass",
              verdictFinal: true,
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: "warning-repair",
          active_task_ids: ["warning-repair"],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: ["warning-repair"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "warning-repair": {
              id: "warning-repair",
              parent_id: "project",
              state: "active",
              children: [],
              goal: "Repair the task-tree/planner integrity shape that flags final-path compact-surface hygiene as stale retry planning so non-rerun file-only follow-up work on an already-final path stops emitting stale-terminal-retry warnings.",
              outputs: ["evidence/archive/warning-repair.md"],
              acceptance: [
                "The next packet no longer flags the bounded compact-direct-path hygiene leaf as retry planning on a final path.",
              ],
              conflict_scope: [
                "ops:task-tree-integrity:final-path-hygiene-warning",
              ],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.project_hygiene_warnings).toBeUndefined();
  });

  test("planning packet model_status_summary prefers featurePaths over stale mirror paths", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "model", "knowledge-map"), {
      recursive: true,
    });
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: [],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      join(projectDir, "model", "knowledge-map", "model.json"),
      `${JSON.stringify(
        {
          featurePaths: [
            {
              id: "path.serverless-virtual-nodes.multi-pod-burst",
              status: "blocked",
              rootCauseClass: "runtime",
            },
            {
              id: "path.private-cluster-none-dns-zone-v3",
              status: "unknown",
              rootCauseClass: "none",
            },
          ],
          paths: [
            {
              id: "path.serverless-virtual-nodes.multi-pod-burst",
              status: "unknown",
              rootCauseClass: "source-grounded-check-replay-execute-capable",
            },
            {
              id: "path.private-cluster-none-dns-zone-v3",
              status: "unknown",
              rootCauseClass: "none",
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));
    expect(packet.model_status_summary).toBeDefined();
    expect(packet.model_status_summary!.total).toBe(2);
    expect(packet.model_status_summary!.non_passing).toBe(2);

    const burstPath = packet.model_status_summary!.non_passing_paths.find(
      (path) => path.id === "path.serverless-virtual-nodes.multi-pod-burst",
    );
    expect(burstPath).toEqual(
      expect.objectContaining({
        id: "path.serverless-virtual-nodes.multi-pod-burst",
        status: "blocked",
        rootCauseClass: "runtime",
      }),
    );

    const privateClusterPath =
      packet.model_status_summary!.non_passing_paths.find(
        (path) => path.id === "path.private-cluster-none-dns-zone-v3",
      );
    expect(privateClusterPath).toEqual(
      expect.objectContaining({
        id: "path.private-cluster-none-dns-zone-v3",
        status: "unknown",
        rootCauseClass: "none",
      }),
    );
  });

  test("planning packet flags passive response waits and source-exactness overblocks", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: [
                "ask-response-await",
                "source-exactness-blocker",
                "real-env-blocker",
              ],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "ask-response-await": {
              id: "ask-response-await",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Wait for source-holder response.",
              outputs: ["evidence/archive/ask-response.md"],
              acceptance: ["response is routed"],
              blocker:
                "External human/source-holder response required. The packet is send-ready-only and there is still no durable proof-of-send or owner handoff.",
            },
            "source-exactness-blocker": {
              id: "source-exactness-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Provide an exact handwritten source excerpt before authoring the replay.",
              outputs: ["evidence/archive/source.md"],
              acceptance: ["source semantics are pinned"],
              blocker:
                "External/source unblock required: provide an exact handwritten/native source-body excerpt or source-equivalent proof.",
            },
            "real-env-blocker": {
              id: "real-env-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Wait for registered preview feature.",
              outputs: ["evidence/archive/env.md"],
              acceptance: ["preview feature registered"],
              blocker:
                "External environment capability required: retry only after Microsoft.ContainerService/MachinesPreview is Registered.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "response-await-without-send-proof",
        taskId: "ask-response-await",
      }),
      expect.objectContaining({
        kind: "environment-overblock",
        taskId: "real-env-blocker",
      }),
      expect.objectContaining({
        kind: "source-exactness-overblock",
        taskId: "source-exactness-blocker",
      }),
    ]);
  });

  test("planning packet suppresses environment-overblock warning for exact human-owned external waits", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: ["exact-human-holder", "real-env-blocker"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "exact-human-holder": {
              id: "exact-human-holder",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Preserve the exact authorization wait for the private cluster path; resume only when human approval returns with explicit subscription and location.",
              outputs: ["evidence/archive/exact-holder.md"],
              acceptance: ["exact holder remains visible"],
              blocker: {
                condition:
                  "Blocked on owner approval and explicit subscription/location tuple; resume only when the human operator returns the exact execute authorization.",
                category: "external-wait",
                owner: "human",
              },
            },
            "real-env-blocker": {
              id: "real-env-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Wait for registered preview feature.",
              outputs: ["evidence/archive/env.md"],
              acceptance: ["preview feature registered"],
              blocker:
                "External environment capability required: retry only after Microsoft.ContainerService/MachinesPreview is Registered.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "environment-overblock",
        taskId: "real-env-blocker",
      }),
    ]);
  });

  test("planning packet suppresses environment-overblock warning for focus-plan approval waits", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: ["focus-approval", "real-env-blocker"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "focus-approval": {
              id: "focus-approval",
              parent_id: "project",
              state: "blocked",
              kind: "focus_plan",
              children: [],
              goal: "Keep the no-live RP lifecycle focus waiting only for human approval.",
              outputs: ["tasks/tree.json"],
              acceptance: ["approval returns"],
              context: {
                needs_approval: true,
              },
              blocker: {
                condition:
                  "Focus plan is waiting for human approval of the proposed 12-24h direction change and staging risk envelope.",
                category: "human-approval",
                owner: "human",
                waiting_for: {
                  type: "project.approval.submitted",
                  approvalKind: "focus-plan",
                  taskId: "focus-approval",
                },
              },
            },
            "real-env-blocker": {
              id: "real-env-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Wait for registered preview feature.",
              outputs: ["evidence/archive/env.md"],
              acceptance: ["preview feature registered"],
              blocker:
                "External environment capability required: retry only after Microsoft.ContainerService/MachinesPreview is Registered.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "environment-overblock",
        taskId: "real-env-blocker",
      }),
    ]);
  });

  test("planning packet suppresses environment-overblock warning for approval-governed focus child holders", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: ["focus-child-holder", "real-env-blocker"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "focus-child-holder": {
              id: "focus/rp-cluster-ready-trio-packetize-no-live-20260714",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Assemble one repo-local execution/approval packet for spec.rp-cluster-lifecycle.list-credentials without launching cloud work.",
              outputs: ["evidence/archive/focus-child-holder.md"],
              acceptance: ["no live execution starts"],
              blocker: {
                condition:
                  "Blocked until the owner approves or adjusts the no-live focus branch. This leaf must not start before that focus decision lands.",
                category: "human-approval",
                owner: "human",
                waiting_for: {
                  type: "project.approval.submitted",
                  taskId:
                    "ops/wait-project-approval-owner-return-primary-blocker-20260713",
                  approvalKind: "focus-plan",
                  focusTaskId:
                    "focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711",
                },
                observation_method:
                  "Start only after the owner returns a bounded focus-plan decision through the existing project approval wait.",
                resume_condition:
                  "Resume only after the governing focus approval wait resolves and this exact leaf remains in scope.",
              },
            },
            "real-env-blocker": {
              id: "real-env-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Wait for registered preview feature.",
              outputs: ["evidence/archive/env.md"],
              acceptance: ["preview feature registered"],
              blocker:
                "External environment capability required: retry only after Microsoft.ContainerService/MachinesPreview is Registered.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "environment-overblock",
        taskId: "real-env-blocker",
      }),
    ]);
  });

  test("planning packet suppresses environment-overblock warning for prewindow app-ops execution waits", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: ["future-review-wave", "real-env-blocker"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "future-review-wave": {
              id: "ops/execute-localdns-blocked-frontier-review-wave-app-ops-20260712i",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "At or after 2099-07-12T16:55:00Z, execute the LocalDNS blocked-frontier review if still needed.",
              outputs: ["evidence/archive/localdns-review.md"],
              acceptance: ["review executes at or after the named window"],
              blocker: {
                condition:
                  "Future-window app-ops blocked-frontier review leaf; do not start before the 2099-07-12T16:55:00Z LocalDNS review window opens.",
                category: "external-wait",
                owner: "app-ops",
                waiting_for: {
                  type: "blocker.resolved",
                  taskId:
                    "ops/execute-localdns-blocked-frontier-review-wave-app-ops-20260712i",
                },
                observed_by: {
                  workflow: "project-planner",
                  schedule: "blocked-frontier-app-ops-review",
                  trigger: "project.owner.requested",
                },
                observation_method:
                  "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
                resume_at: "2099-07-12T16:55:00Z",
                next_check_at: "2099-07-12T16:55:00Z",
                fallback_at: "2099-07-12T21:55:00Z",
                fallback_action:
                  "If still unstarted after the review window opens and no worker has acted, refresh or reassign this exact review leaf rather than creating a duplicate.",
              },
            },
            "real-env-blocker": {
              id: "real-env-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Wait for registered preview feature.",
              outputs: ["evidence/archive/env.md"],
              acceptance: ["preview feature registered"],
              blocker:
                "External environment capability required: retry only after Microsoft.ContainerService/MachinesPreview is Registered.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "environment-overblock",
        taskId: "real-env-blocker",
      }),
    ]);
  });

  test("planning packet suppresses environment-overblock warning for watched app-ops external waits", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: ["watched-auth-wait", "real-env-blocker"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "watched-auth-wait": {
              id: "watched-auth-wait",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Keep the dependent branch blocked on the shared worker auth-capability family.",
              outputs: ["evidence/archive/watched-auth-wait.md"],
              acceptance: ["one family-level wait remains visible"],
              blocker: {
                condition:
                  "Blocked on a shared worker auth capability outage; do not create duplicate per-branch environment repair work.",
                category: "external-wait",
                owner: "app-ops",
                waiting_for: {
                  type: "frontier.changed",
                  taskId: "watched-auth-wait",
                },
                observed_by: {
                  workflow: "project-planner",
                  trigger: "blocked-frontier-app-ops-review",
                },
                observation_method:
                  "Scheduled app-ops review checks this wait and must unblock, replace, escalate, or keep the wait with fresh evidence.",
                resume_at: "2099-07-13T12:00:00Z",
                next_check_at: "2099-07-13T12:00:00Z",
                fallback_at: "2099-07-14T12:00:00Z",
                fallback_action:
                  "If the shared auth family is still unresolved, refresh the exact wait instead of creating duplicate passive environment blockers.",
              },
            },
            "real-env-blocker": {
              id: "real-env-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Wait for registered preview feature.",
              outputs: ["evidence/archive/env.md"],
              acceptance: ["preview feature registered"],
              blocker:
                "External environment capability required: retry only after Microsoft.ContainerService/MachinesPreview is Registered.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "environment-overblock",
        taskId: "real-env-blocker",
      }),
    ]);
  });

  test("planning packet suppresses environment-overblock warning for exact Azure DevOps completion waits", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: ["ado-run-wait", "real-env-blocker"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "ado-run-wait": {
              id: "ado-run-wait",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Preserve the exact in-flight ADO completion wait for run 172009175 while the staged rerun remains queued.",
              outputs: ["evidence/archive/ado-run-wait.md"],
              acceptance: ["the exact run wait remains visible"],
              blocker: {
                condition:
                  "Blocked on the exact Azure DevOps pipeline wait after the self-contained same-path repair was queued for staging. Resume only when run 172009175 is terminal and artifacts are available.",
                category: "external-wait",
                owner: "ado",
                waiting_for: {
                  type: "ado.pipeline_run.completed",
                  runId: "172009175",
                  runUrl:
                    "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172009175",
                },
                observed_by: {
                  workflow: "project-execution-watchdog",
                  trigger: "project.task.reviewed",
                },
                observation_method:
                  "Watchdog checks the named Azure DevOps run and moves this wait to review when the run is terminal; the reviewer then consumes artifacts and records the exact result.",
                next_check_at: "2099-07-13T16:25:00Z",
                fallback_at: "2099-07-13T18:15:00Z",
                fallback_action:
                  "If the run is still not reviewable at fallback, refresh this exact wait with current ADO status or escalate the artifact/reachability issue.",
              },
            },
            "real-env-blocker": {
              id: "real-env-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Wait for registered preview feature.",
              outputs: ["evidence/archive/env.md"],
              acceptance: ["preview feature registered"],
              blocker:
                "External environment capability required: retry only after Microsoft.ContainerService/MachinesPreview is Registered.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "environment-overblock",
        taskId: "real-env-blocker",
      }),
    ]);
  });

  test("planning packet suppresses environment-overblock warning for refreshed frontier-changed exact Azure DevOps waits", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: [
                "wait-rp-nodepool-multi-agentpool-runner-ado-run-172009175",
                "real-env-blocker",
              ],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "wait-rp-nodepool-multi-agentpool-runner-ado-run-172009175": {
              id: "wait-rp-nodepool-multi-agentpool-runner-ado-run-172009175",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Preserve the exact in-flight Azure DevOps completion wait for run 172009175 on spec.rp-nodepool-lifecycle.multi-agentpool-runner so this lineage resumes only when the queued artifacts are terminal and reviewable.",
              outputs: [".state/spec-loop/artifacts/172009175"],
              acceptance: [
                "The blocked leaf keeps the exact queued-run metadata for pipeline 467665 / run 172009175 on refs/heads/dev at source commit 40ab1483a08b47b83195437a9464d392bab1cb0f, plus the current next-check and fallback review triggers.",
                "Resume only when run 172009175 is terminal and artifacts are available for inspection; until then this leaf carries wait-only meaning and does not substitute for environment diagnosis or completed artifact review.",
              ],
              blocker: {
                condition:
                  "2026-07-13 blocked-frontier review revalidated that this leaf is not a passive environment/capability blocker: domain/repair-rp-nodepool-multi-agentpool-runner-self-contained-20260713 already queued the exact same-spec ADO rerun 172009175 on pipeline 467665 at commit 40ab1483a08b47b83195437a9464d392bab1cb0f, so the truthful next action remains waiting for terminal artifacts. Keep this as the single exact ADO completion wait for spec.rp-nodepool-lifecycle.multi-agentpool-runner until the run is terminal and reviewable; do not replace it with generic environment diagnosis or duplicate approval-lineage waits.",
                category: "external-wait",
                owner: "aks-explorer",
                blocked_at: "2026-07-13T16:25:54.058Z",
                waiting_for: {
                  type: "frontier.changed",
                  taskId:
                    "wait-rp-nodepool-multi-agentpool-runner-ado-run-172009175",
                  source: "task-tree.refresh-blocked-wait",
                },
                observed_by: {
                  workflow: "project-planner",
                  trigger: "task-tree.refresh-blocked-wait",
                },
                observation_method:
                  "Planner/app-ops refreshed this wait after reviewing returned evidence; controller ticks should keep it blocked until the named frontier changes.",
                next_check_at: "2099-07-13T18:00:00Z",
                resume_condition:
                  "Resume only when Azure DevOps pipeline 467665 run 172009175 becomes terminal and its artifacts/logs are available for review, or when accepted same-lineage evidence proves the queued run was superseded, cancelled, or otherwise changed in a way that makes a different exact successor truthful.",
                fallback_at: "2099-07-14T18:00:00Z",
                fallback_action:
                  "If run 172009175 is still non-terminal at fallback, refresh this exact ADO completion wait from the latest same-run status and keep one single artifact-completion holder; do not queue another unchanged rerun or replace it with a generic environment wait.",
              },
              trace: {
                blocked_wait_refresh_summary:
                  "Repair the malformed exact ADO completion wait by attaching explicit watch metadata so blocked-frontier review preserves this queued-run holder instead of flagging it as a passive environment blocker.",
              },
            },
            "real-env-blocker": {
              id: "real-env-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Wait for registered preview feature.",
              outputs: ["evidence/archive/env.md"],
              acceptance: ["preview feature registered"],
              blocker:
                "External environment capability required: retry only after Microsoft.ContainerService/MachinesPreview is Registered.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "environment-overblock",
        taskId: "real-env-blocker",
      }),
    ]);
  });

  test("planning packet suppresses environment-overblock warning for represented split frontiers", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: ["represented-frontier", "real-env-blocker"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "represented-frontier": {
              id: "represented-frontier",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Preserve one exact split-frontier representation for windows while the mixed family remains represented by exact carriers rather than a fake shared environment family.",
              outputs: ["evidence/archive/represented-frontier.md"],
              acceptance: [
                "The holder cites exact represented carriers and resumes only when one represented blocker materially changes.",
              ],
              blocker: {
                condition:
                  "Blocked-frontier review confirmed this split mixed-family holder is represented by exact carriers: westus2 capacity still controls one member, two others remain the exact staging carrier, and the pipeline-only holder remains the exact residual carrier. No merged environment task would move those carriers honestly now.",
                category: "blocked-wait",
                owner: "aks-explorer",
                resume_condition:
                  "Resume only when one exact represented blocker materially changes or a new current-head review reclassifies one member.",
              },
            },
            "real-env-blocker": {
              id: "real-env-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Wait for registered preview feature.",
              outputs: ["evidence/archive/env.md"],
              acceptance: ["preview feature registered"],
              blocker:
                "External environment capability required: retry only after Microsoft.ContainerService/MachinesPreview is Registered.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "environment-overblock",
        taskId: "real-env-blocker",
      }),
    ]);
  });

  test("planning packet suppresses source-exactness-overblock warning for represented split frontiers", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: [
                "represented-source-frontier",
                "source-exactness-blocker",
              ],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "represented-source-frontier": {
              id: "represented-source-frontier",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Keep the exact split-frontier holder visible while the remaining source-equivalent member is represented by exact carriers rather than a fake shared missing-source blocker.",
              outputs: ["evidence/archive/represented-source-frontier.md"],
              acceptance: [
                "The holder cites exact represented carriers and resumes only when one represented blocker materially changes.",
              ],
              blocker: {
                condition:
                  "Blocked-frontier review confirmed this split-frontier holder is represented by exact carriers: one member remains the exact reviewed runtime holder, and the other remains represented by accepted source-equivalent evidence-ceiling carriers. No merged source task would move those carriers honestly now.",
                category: "blocked-wait",
                owner: "aks-explorer",
                resume_condition:
                  "Resume only when one exact represented blocker materially changes or a new current-head review reclassifies one member.",
              },
            },
            "source-exactness-blocker": {
              id: "source-exactness-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Provide an exact handwritten source excerpt before authoring the replay.",
              outputs: ["evidence/archive/source.md"],
              acceptance: ["source semantics are pinned"],
              blocker:
                "External/source unblock required: provide an exact handwritten/native source-body excerpt or source-equivalent proof.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "source-exactness-overblock",
        taskId: "source-exactness-blocker",
      }),
    ]);
  });

  test("planning packet suppresses environment-overblock warning for compact residual waits already split into active remediation plus exact residual lineage", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: ["windows-residual-holder", "real-env-blocker"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "windows-residual-holder": {
              id: "hold-compact-windows-eligibility-residual-frontier-20260717",
              parent_id: "aks-feature-compact-loop",
              state: "blocked",
              children: [],
              goal: "Preserve one exact compact residual Windows eligibility holder covering only the still-blocked compact members while excluding the now-rerun-ready Windows Calico member and the archived Windows GPU legacy boundary; keep controller-visible Windows compact state truthful without reopening a broad rerun.",
              outputs: ["evidence/archive/windows-residual-holder.md"],
              acceptance: [
                "The holder records only the still-blocked compact residual members: spec.windows.mixed-os-combination-virtualmachines, spec.windows.node-pool-create-virtualmachines-gen2, and spec.windows.runner-pipeline-harness-virtualmachines.",
                "The holder cites only current truthful downstream lineage: wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704 for the repaired Windows auth-capable rerun members, ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s-owner-normalized for the separate create-surface owner-return lineage, and domain/reclassify-windows-runner-pipeline-harness-mounted-source-boundary-20260717 for the runner-harness mounted-source residual.",
              ],
              blocker: {
                condition:
                  "2026-07-17 blocked-frontier owner review split the stale four-member Windows holder into one exact residual wait plus active remediation. Keep this residual holder blocked only while active task domain/rerun-windows-calico-vm-prerelease-containerd-westus2-recovery-20260717 executes the now-rerun-ready Windows Calico branch, active task domain/reclassify-windows-runner-pipeline-harness-mounted-source-boundary-20260717 resolves the runner-harness residual, and the live shared GitHub auth / owner-arbitration waits preserve the remaining blocked members. Do not widen back into a broad Windows rerun or cite archived successor ids as live blockers.",
                category: "blocked-wait",
                owner: "aks-explorer",
                resume_condition:
                  "Resume only when domain/rerun-windows-calico-vm-prerelease-containerd-westus2-recovery-20260717, domain/reclassify-windows-runner-pipeline-harness-mounted-source-boundary-20260717, wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704, or ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s-owner-normalized materially changes the exact residual Windows member set or yields a runnable next step.",
              },
            },
            "real-env-blocker": {
              id: "real-env-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Wait for registered preview feature.",
              outputs: ["evidence/archive/env.md"],
              acceptance: ["preview feature registered"],
              blocker:
                "External environment capability required: retry only after Microsoft.ContainerService/MachinesPreview is Registered.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "environment-overblock",
        taskId: "real-env-blocker",
      }),
    ]);
  });

  test("planning packet suppresses source-exactness-overblock warning for exact human-owned external waits", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: [
                "exact-human-source-holder",
                "source-exactness-blocker",
              ],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "exact-human-source-holder": {
              id: "exact-human-source-holder",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Preserve the exact authoritative owner/source wait for the LocalDNS reviewed-exception pair until the human owner returns a narrowed answer.",
              outputs: ["evidence/archive/exact-human-source-holder.md"],
              acceptance: ["exact holder remains visible"],
              blocker: {
                condition:
                  "Blocked on returned authoritative owner/source decision after source-equivalent evidence was exhausted; resume only when the human owner returns one exact narrowed source answer.",
                category: "external-wait",
                owner: "human",
                waiting_for: {
                  type: "evidence.available",
                  taskId: "exact-human-source-holder",
                },
              },
            },
            "source-exactness-blocker": {
              id: "source-exactness-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Provide an exact handwritten source excerpt before authoring the replay.",
              outputs: ["evidence/archive/source.md"],
              acceptance: ["source semantics are pinned"],
              blocker:
                "External/source unblock required: provide an exact handwritten/native source-body excerpt or source-equivalent proof.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "source-exactness-overblock",
        taskId: "source-exactness-blocker",
      }),
    ]);
  });

  test("planning packet suppresses source-exactness-overblock warning for watched app-ops external waits", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: ["watched-source-wait", "source-exactness-blocker"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "watched-source-wait": {
              id: "watched-source-wait",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Keep the exact same-run queue-family holder visible after the source-equivalent replay repair was already queued.",
              outputs: ["evidence/archive/watched-source-wait.md"],
              acceptance: ["one family-level wait remains visible"],
              blocker: {
                condition:
                  "Blocked on the exact queue-family frontier after a source-equivalent replay repair was already queued; do not create a second passive source-holder while app-ops keeps the shared approval proof active.",
                category: "external-wait",
                owner: "app-ops",
                waiting_for: {
                  type: "frontier.changed",
                  taskId: "watched-source-wait",
                },
                observed_by: {
                  workflow: "project-planner",
                  trigger: "task-tree.refresh-blocked-wait",
                },
                observation_method:
                  "Scheduled app-ops review checks this wait and must unblock, replace, escalate, or keep the wait with fresh evidence.",
                resume_at: "2099-07-13T12:00:00Z",
                next_check_at: "2099-07-13T12:00:00Z",
                fallback_at: "2099-07-14T12:00:00Z",
                fallback_action:
                  "If the shared family is still unresolved, refresh this exact wait instead of creating duplicate passive source blockers.",
              },
            },
            "source-exactness-blocker": {
              id: "source-exactness-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Provide an exact handwritten source excerpt before authoring the replay.",
              outputs: ["evidence/archive/source.md"],
              acceptance: ["source semantics are pinned"],
              blocker:
                "External/source unblock required: provide an exact handwritten/native source-body excerpt or source-equivalent proof.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "source-exactness-overblock",
        taskId: "source-exactness-blocker",
      }),
    ]);
  });

  test("planning packet suppresses source-exactness-overblock warning for exact Azure DevOps completion waits", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: ["ado-source-wait", "source-exactness-blocker"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "ado-source-wait": {
              id: "ado-source-wait",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Preserve the exact in-flight ADO completion wait after the source-equivalent repair replay was queued.",
              outputs: ["evidence/archive/ado-source-wait.md"],
              acceptance: ["the exact run wait remains visible"],
              blocker: {
                condition:
                  "Blocked on the exact Azure DevOps pipeline wait after a source-equivalent repair replay was queued. Resume only when run 172009175 is terminal and artifacts are available.",
                category: "external-wait",
                owner: "ado",
                waiting_for: {
                  type: "ado.pipeline_run.completed",
                  runId: "172009175",
                  runUrl:
                    "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172009175",
                },
                observed_by: {
                  workflow: "project-execution-watchdog",
                  trigger: "project.task.reviewed",
                },
                observation_method:
                  "Watchdog checks the named Azure DevOps run and moves this wait to review when the run is terminal; the reviewer then consumes artifacts and records the exact result.",
                next_check_at: "2099-07-13T16:25:00Z",
                fallback_at: "2099-07-13T18:15:00Z",
                fallback_action:
                  "If the run is still not reviewable at fallback, refresh this exact wait with current ADO status or escalate the artifact/reachability issue.",
              },
            },
            "source-exactness-blocker": {
              id: "source-exactness-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Provide an exact handwritten source excerpt before authoring the replay.",
              outputs: ["evidence/archive/source.md"],
              acceptance: ["source semantics are pinned"],
              blocker:
                "External/source unblock required: provide an exact handwritten/native source-body excerpt or source-equivalent proof.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "source-exactness-overblock",
        taskId: "source-exactness-blocker",
      }),
    ]);
  });

  test("planning packet suppresses blocked-action warnings for review-gated publication waits", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: ["review-gated-publication-holder", "real-env-blocker"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "review-gated-publication-holder": {
              id: "domain/publish-rp-regional-quota-review-visible-20260716",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Keep the accepted rp-regional-quota repo slice unpublished until the live review lineage returns a publication-safe decision, then publish that exact accepted slice to a pipeline-visible branch/head or replace it with the reviewer-requested successor without widening into new rp-regional-quota authoring from this holder.",
              outputs: [
                "evidence/archive/publish-rp-regional-quota-review-visible-20260716.md",
              ],
              acceptance: [
                "Consume the structured publication-safe decision produced by the live rp-regional-quota redo/review chain before publishing or superseding any repo slice.",
              ],
              blocker: {
                condition:
                  "Reviewer-gated publication holder only. This task is not the westus2 managedClusters quota/capacity blocker: that exact environment wait remains carried by reconcile-spec-loop-pending-rp-regional-quota. This holder should unblock only on a reviewer decision for fix-rp-regional-quota-public-create-path-run-172346097 or an accepted same-lineage successor that makes publication safe.",
                resume_condition:
                  "Resume only when the project.task.reviewed decision for fix-rp-regional-quota-public-create-path-run-172346097, or an accepted same-lineage successor, returns the exact publication-safe decision for this rp-regional-quota slice.",
                category: "external-wait",
                owner: "aks-explorer",
                waiting_for: {
                  type: "blocker.resolved",
                  taskId:
                    "domain/publish-rp-regional-quota-review-visible-20260716",
                },
                observed_by: {
                  workflow: "project-planner",
                  schedule: "blocked-frontier-app-ops-review",
                  trigger: "project.owner.requested",
                },
                observation_method:
                  "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
              },
            },
            "real-env-blocker": {
              id: "real-env-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Wait for registered preview feature.",
              outputs: ["evidence/archive/env.md"],
              acceptance: ["preview feature registered"],
              blocker:
                "External environment capability required: retry only after Microsoft.ContainerService/MachinesPreview is Registered.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "environment-overblock",
        taskId: "real-env-blocker",
      }),
    ]);
  });

  test("planning packet suppresses environment-overblock warning for feature-compact exact non-environment frontiers", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: [
                "compact-owner-frontier",
                "compact-pipeline-frontier",
                "real-env-blocker",
              ],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "compact-owner-frontier": {
              id: "compact-owner-frontier",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Hold compact feature defender-profile on exact reviewed-exception wait until the named condition changes.",
              outputs: ["evidence/archive/defender.md"],
              acceptance: ["owner frontier remains visible"],
              context: {
                featureCompactExactWait: true,
                featureKey: "defender-profile",
                errorClass: "reviewed-exception",
                target: "staging",
              },
              blocker: {
                condition:
                  "Feature compact package is blocked by compact-eligibility frontier, not by compact check failure. Execute-ready promotion frontier remains after request/runtime proof, and owner promotion or reclassification is still required before live-ready eligibility changes.",
                category: "external-wait",
                owner: "operator",
                waiting_for: {
                  type: "owner.decision",
                  featureKey: "defender-profile",
                  target: "staging",
                  errorClass: "reviewed-exception",
                  scope: "feature-compact",
                },
              },
            },
            "compact-pipeline-frontier": {
              id: "compact-pipeline-frontier",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Hold compact feature aad-rbac on exact package-partial wait until the named condition changes.",
              outputs: ["evidence/archive/aad-rbac.md"],
              acceptance: ["mixed frontier remains visible"],
              context: {
                featureCompactExactWait: true,
                featureKey: "aad-rbac",
                errorClass: "package-partial",
                target: "staging",
              },
              blocker: {
                condition:
                  "Reviewed same-path pass run cleared one member, and the remaining compact frontier is only the residual reviewed-exception trio under the live-ready filter. One carrier is a capacity family, one is an owner contradiction, and one is a run-command authorization ceiling.",
                category: "external-wait",
                owner: "operator",
                waiting_for: {
                  type: "pipeline.result.or.artifact.available",
                  featureKey: "aad-rbac",
                  target: "staging",
                  errorClass: "package-partial",
                  scope: "feature-compact",
                },
              },
            },
            "real-env-blocker": {
              id: "real-env-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Wait for registered preview feature.",
              outputs: ["evidence/archive/env.md"],
              acceptance: ["preview feature registered"],
              blocker:
                "External environment capability required: retry only after Microsoft.ContainerService/MachinesPreview is Registered.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "environment-overblock",
        taskId: "real-env-blocker",
      }),
    ]);
  });

  test("planning packet suppresses environment-overblock warning for compact reviewed-exception live-ready policy waits", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: [
                "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
                "real-env-blocker",
              ],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "wait-compact-reviewed-exception-live-ready-policy-family-20260702":
              {
                id: "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
                parent_id: "project",
                state: "blocked",
                children: [],
                goal: "Represent the shared residual reviewed-exception/live-ready policy wait for ccp-coredns, ccp-metricsserver, kms-etcd-encryption, planned-maintenance, and ossku-migration until accepted member reclassification or an intentional compact live-ready policy change occurs.",
                outputs: ["evidence/archive/compact-policy-family.md"],
                acceptance: ["shared family wait stays visible"],
                context: {
                  featureCompactExactWait: true,
                  familyFeatureKeys: [
                    "ccp-coredns",
                    "ccp-metricsserver",
                    "kms-etcd-encryption",
                    "ossku-migration",
                    "planned-maintenance",
                  ],
                },
                blocker: {
                  condition:
                    "Blocked only while the residual reviewed-exception members across ccp-coredns, ccp-metricsserver, kms-etcd-encryption, ossku-migration, and planned-maintenance remain intentionally excluded from the compact live-ready subset.",
                  category: "external-wait",
                  owner: "aks-explorer",
                  waiting_for: {
                    type: "compact.live-ready.policy",
                    scope: "reviewed-exception-live-ready-family",
                    taskId:
                      "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
                    featureKeys: [
                      "ccp-coredns",
                      "ccp-metricsserver",
                      "kms-etcd-encryption",
                      "ossku-migration",
                      "planned-maintenance",
                    ],
                    target: "staging",
                  },
                },
              },
            "real-env-blocker": {
              id: "real-env-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Wait for registered preview feature.",
              outputs: ["evidence/archive/env.md"],
              acceptance: ["preview feature registered"],
              blocker:
                "External environment capability required: retry only after Microsoft.ContainerService/MachinesPreview is Registered.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "environment-overblock",
        taskId: "real-env-blocker",
      }),
    ]);
  });

  test("planning packet suppresses environment-overblock warning for compact exact capacity waits", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: ["compact-capacity-frontier", "real-env-blocker"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "compact-capacity-frontier": {
              id: "compact-capacity-frontier",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Hold compact feature ccp-vpa-os-arch-variants only while the exact CCP pipeline / ARM64 capacity boundary remains unchanged.",
              outputs: ["evidence/archive/compact-capacity-frontier.md"],
              acceptance: ["capacity frontier remains visible"],
              context: {
                featureCompactExactWait: true,
                featureKey: "ccp-vpa-os-arch-variants",
                errorClass: "reviewed-exception",
                target: "staging",
              },
              blocker: {
                condition:
                  "Do not rerun unchanged. Compact check already passes and the only remaining compact member still depends on the same exact external execution boundary: CCP pipeline infrastructure in project staging or ARM64 node pools with Kubernetes >= 1.34 in the test subscription.",
                category: "external-wait",
                owner: "product-owner",
                waiting_for: {
                  type: "azure.capacity.available",
                  featureKey: "ccp-vpa-os-arch-variants",
                  target: "staging",
                  errorClass: "reviewed-exception",
                  scope: "feature-compact",
                },
              },
            },
            "real-env-blocker": {
              id: "real-env-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Wait for registered preview feature.",
              outputs: ["evidence/archive/env.md"],
              acceptance: ["preview feature registered"],
              blocker:
                "External environment capability required: retry only after Microsoft.ContainerService/MachinesPreview is Registered.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "environment-overblock",
        taskId: "real-env-blocker",
      }),
    ]);
  });

  test("planning packet suppresses environment-overblock warning for compact exact environment prerequisite waits", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: ["compact-env-frontier", "real-env-blocker"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "compact-env-frontier": {
              id: "compact-env-frontier",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Hold compact feature cost-analysis only on the exact shared underlay/runtime-input family wait until the named frontier materially changes.",
              outputs: ["evidence/archive/compact-env-frontier.md"],
              acceptance: ["environment prerequisite frontier remains visible"],
              context: {
                featureCompactExactWait: true,
                featureKey: "cost-analysis",
                errorClass: "reviewed-exception",
                target: "staging",
              },
              blocker: {
                condition:
                  "Do not regenerate a generic compact-error repair leaf. The exact surviving blocker is the shared underlay/runtime-input family wait, and any future live proof first depends on returned underlay/runtime inputs plus owner review of that carrier.",
                category: "external-wait",
                owner: "operator",
                waiting_for: {
                  type: "environment.prerequisite.ready",
                  featureKey: "cost-analysis",
                  target: "staging",
                  errorClass: "reviewed-exception",
                  scope: "feature-compact",
                },
              },
            },
            "real-env-blocker": {
              id: "real-env-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Wait for registered preview feature.",
              outputs: ["evidence/archive/env.md"],
              acceptance: ["preview feature registered"],
              blocker:
                "External environment capability required: retry only after Microsoft.ContainerService/MachinesPreview is Registered.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "environment-overblock",
        taskId: "real-env-blocker",
      }),
    ]);
  });

  test("planning packet suppresses environment-overblock warning for legacy feature-compact exact wait holders", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: ["aks-feature-compact-loop", "real-env-blocker"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-feature-compact-loop": {
              id: "aks-feature-compact-loop",
              parent_id: "project",
              state: "blocked",
              children: ["legacy-compact-frontier"],
              goal: "compact loop",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "legacy-compact-frontier": {
              id: "legacy-compact-frontier",
              parent_id: "aks-feature-compact-loop",
              state: "blocked",
              children: [],
              goal: "Hold compact feature private-cluster on the exact compact-facing package-partial frontier until one named condition changes.",
              outputs: ["evidence/archive/private-cluster.md"],
              acceptance: ["package-partial frontier remains visible"],
              conflict_scope: [
                "feature-compact:private-cluster",
                "feature:private-cluster",
                "feature-compact-wait:private-cluster:package-partial",
              ],
              blocker: {
                condition:
                  "The compact projection is blocked by a mixed residual frontier. Do not rerun unchanged; resume only when the represented owner-decision or pipeline-artifact carrier changes.",
                category: "external-wait",
                owner: "operator",
                waiting_for: {
                  type: "pipeline.result.or.artifact.available",
                  featureKey: "private-cluster",
                  target: "staging",
                  errorClass: "package-partial",
                  scope: "feature-compact",
                },
              },
            },
            "real-env-blocker": {
              id: "real-env-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Wait for registered preview feature.",
              outputs: ["evidence/archive/env.md"],
              acceptance: ["preview feature registered"],
              blocker:
                "External environment capability required: retry only after Microsoft.ContainerService/MachinesPreview is Registered.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "environment-overblock",
        taskId: "real-env-blocker",
      }),
    ]);
  });

  test("planning packet suppresses environment-overblock warning for compact holders already backed by an exact shared-family wait plus no-local-successor judgment", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: [
                "aad-rbac-reviewed-exception-trio",
                "real-env-blocker",
              ],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aad-rbac-reviewed-exception-trio": {
              id: "hold-compact-aad-rbac-reviewed-exception-trio-frontier",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Preserve only the exact aad-rbac reviewed-exception compact trio: the capacity-family wait for spec.aad-rbac.azure-rbac-automatic-sku, the row-37 owner contradiction holder for spec.aad-rbac.managed-v2-lifecycle, and the reviewed-exception/domain-evidence ceiling for spec.aad-rbac.run-command-access.",
              outputs: ["evidence/archive/aad-rbac-trio.md"],
              acceptance: [
                "The holder preserves only the reviewed-exception trio and records the exact surviving downstream lineage: wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702, hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705, and reviewed-exception/domain evidence for spec.aad-rbac.run-command-access.",
              ],
              context: {
                featureCompactExactWait: true,
                featureKey: "aad-rbac",
                errorClass: "reviewed-exception",
                target: "staging",
              },
              blocker: {
                condition:
                  "Blocked only as the reviewed-exception compact trio holder after the domain review confirmed that wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702 still remains the only truthful live carrier for spec.aad-rbac.azure-rbac-automatic-sku. No sharper setup, alternate-environment, escalation, or bounded same-surface retry is truthful now. The other exact downstream carriers remain hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705 for spec.aad-rbac.managed-v2-lifecycle and the reviewed-exception/domain evidence ceiling for spec.aad-rbac.run-command-access.",
                category: "external-wait",
                owner: "aks-explorer",
                waiting_for: {
                  type: "blocker.resolved",
                  taskId:
                    "hold-compact-aad-rbac-reviewed-exception-trio-frontier",
                },
                observed_by: {
                  workflow: "project-planner",
                  schedule: "blocked-frontier-app-ops-review",
                  trigger: "project.owner.requested",
                },
                observation_method:
                  "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
              },
            },
            "real-env-blocker": {
              id: "real-env-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Wait for registered preview feature.",
              outputs: ["evidence/archive/env.md"],
              acceptance: ["preview feature registered"],
              blocker:
                "External environment capability required: retry only after Microsoft.ContainerService/MachinesPreview is Registered.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "environment-overblock",
        taskId: "real-env-blocker",
      }),
    ]);
  });

  test("planning packet suppresses environment-overblock warning for compact projections governed by exact shared waits even when the shared wait uses approval or environment waiting types", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: ["aks-feature-compact-loop", "real-env-blocker"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-feature-compact-loop": {
              id: "aks-feature-compact-loop",
              parent_id: "project",
              state: "blocked",
              children: [
                "cost-analysis-shared-projection",
                "trusted-access-shared-projection",
              ],
              goal: "compact loop",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "cost-analysis-shared-projection": {
              id: "hold-compact-cost-analysis-reviewed-exception-frontier",
              parent_id: "aks-feature-compact-loop",
              state: "blocked",
              children: [],
              goal: "Preserve compact feature cost-analysis only as the compact-facing projection of the shared underlay/runtime-input family wait, without reopening a feature-local environment blocker or broad rerun.",
              outputs: ["evidence/archive/cost-analysis.md"],
              acceptance: [
                "The compact-facing holder points at wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708 as the governing family wait for spec.cost-analysis.vm-prerelease-source-seed.",
                "Do not broad-rerun cost-analysis unchanged and do not carry a duplicate feature-local environment wait while the shared family wait remains current.",
              ],
              context: {
                featureCompactExactWait: true,
                featureKey: "cost-analysis",
                errorClass: "reviewed-exception",
                target: "staging",
                frontierTaskIds: [
                  "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
                ],
                compactFrontierTaskIds: [
                  "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
                ],
              },
              blocker: {
                condition:
                  "This compact cost-analysis holder remains only the projection of wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708. Keep one shared family reconciliation path rather than a cost-analysis-only environment umbrella or unchanged rerun.",
                category: "external-wait",
                owner: "operator",
                waiting_for: {
                  type: "project.approval.submitted",
                  taskId:
                    "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
                },
                observed_by: {
                  workflow: "feature-compact-loop-controller",
                  trigger: "project.task.tick",
                },
                observation_method:
                  "On each compact-loop tick, refresh the exact feature frontier and keep it blocked until the named shared family wait changes.",
              },
            },
            "trusted-access-shared-projection": {
              id: "hold-compact-trusted-access-ta-gateway-dns-runtime-frontier-20260705",
              parent_id: "aks-feature-compact-loop",
              state: "blocked",
              children: [],
              goal: "Preserve compact feature trusted-access only as the compact-facing projection of the shared TA gateway DNS/runtime family wait, without reopening a feature-local environment blocker or broad rerun.",
              outputs: ["evidence/archive/trusted-access.md"],
              acceptance: [
                "The compact-facing holder points at wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711 as the governing family wait for spec.trusted-access.dataplane-token-gateway-runtime.",
                "Do not broad-rerun trusted-access unchanged and do not carry a duplicate feature-local environment wait while the shared family wait remains current.",
              ],
              context: {
                featureCompactExactWait: true,
                featureKey: "trusted-access",
                errorClass: "package-partial",
                target: "staging",
                frontierTaskIds: [
                  "wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711",
                ],
                compactFrontierTaskIds: [
                  "wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711",
                ],
              },
              blocker: {
                condition:
                  "This compact trusted-access holder remains only the projection of wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711. Keep one shared family reconciliation path rather than a trusted-access-only environment umbrella or unchanged rerun.",
                category: "external-wait",
                owner: "product-owner",
                waiting_for: {
                  type: "environment.available",
                  taskId:
                    "wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711",
                },
                observed_by: {
                  workflow: "project-planner",
                  trigger: "task-tree.refresh-blocked-wait",
                },
                observation_method:
                  "Planner refresh keeps the compact/shared exact pair blocked until the named shared family wait materially changes.",
              },
            },
            "real-env-blocker": {
              id: "real-env-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Wait for registered preview feature.",
              outputs: ["evidence/archive/env.md"],
              acceptance: ["preview feature registered"],
              blocker:
                "External environment capability required: retry only after Microsoft.ContainerService/MachinesPreview is Registered.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "environment-overblock",
        taskId: "real-env-blocker",
      }),
    ]);
  });

  test("planning packet suppresses environment-overblock warning for refreshed aad-rbac trio holders that explicitly reject a missing review leaf as the mover", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: [
                "aad-rbac-reviewed-exception-trio",
                "real-env-blocker",
              ],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aad-rbac-reviewed-exception-trio": {
              id: "hold-compact-aad-rbac-reviewed-exception-trio-frontier",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Preserve only the exact aad-rbac reviewed-exception compact trio: the capacity-family wait for spec.aad-rbac.azure-rbac-automatic-sku, the row-37 owner contradiction holder for spec.aad-rbac.managed-v2-lifecycle, and the reviewed-exception/domain-evidence ceiling for spec.aad-rbac.run-command-access.",
              outputs: ["evidence/archive/aad-rbac-trio.md"],
              acceptance: [
                "The holder preserves only the reviewed-exception trio and records the exact surviving downstream lineage: wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702, hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705, and reviewed-exception/domain evidence for spec.aad-rbac.run-command-access.",
                "The old broad package-partial frontage is retired; the compact leaf now truthfully describes a reviewed-exception trio only.",
              ],
              context: {
                featureCompactExactWait: true,
                featureKey: "aad-rbac",
                errorClass: "reviewed-exception",
                target: "staging",
              },
              blocker: {
                condition:
                  "2026-07-16T11:15Z metric-breach repair revalidated that this compact frontier is only a passive trio representation: wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702 remains the single live shared Automatic/ManagedSystem capacity-family wait for spec.aad-rbac.azure-rbac-automatic-sku; hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705 remains the exact owner-contradiction holder for spec.aad-rbac.managed-v2-lifecycle; and the accepted reviewed-exception/domain evidence ceiling still governs spec.aad-rbac.run-command-access. The previously named review leaf domain/recheck-automatic-managedsystem-capacity-family-recovery-20260716 is not present in the current tree, so do not treat it as the mover.",
                category: "external-wait",
                owner: "aks-explorer",
                waiting_for: {
                  type: "blocker.resolved",
                  taskId:
                    "hold-compact-aad-rbac-reviewed-exception-trio-frontier",
                },
                observed_by: {
                  workflow: "project-planner",
                  schedule: "blocked-frontier-app-ops-review",
                  trigger: "project.planning.requested",
                },
                observation_method:
                  "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
                resume_condition:
                  "Resume when wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702 returns reviewed Automatic/ManagedSystem capacity recovery evidence for the aad-rbac automatic-sku member, when the row-37 owner adjudication changes, or when stronger direct run-command-access evidence materially changes the reviewed-exception ceiling.",
                fallback_action:
                  "If fallback review still sees the same trio, keep one exact compact trio holder aligned to wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702 and the row-37 owner-response state instead of restoring a broad package-partial wait.",
              },
            },
            "real-env-blocker": {
              id: "real-env-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Wait for registered preview feature.",
              outputs: ["evidence/archive/env.md"],
              acceptance: ["preview feature registered"],
              blocker:
                "External environment capability required: retry only after Microsoft.ContainerService/MachinesPreview is Registered.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "environment-overblock",
        taskId: "real-env-blocker",
      }),
    ]);
  });

  test("planning packet still warns on blocker.resolved environment holders that lack exact shared-family plus no-local-successor evidence", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: ["vague-holder"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "vague-holder": {
              id: "hold-compact-vague-environment-frontier",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Keep one compact environment holder visible while quota remains blocked in staging.",
              outputs: ["evidence/archive/vague-holder.md"],
              acceptance: ["holder remains visible"],
              context: {
                featureCompactExactWait: true,
                featureKey: "vague-feature",
                errorClass: "reviewed-exception",
                target: "staging",
              },
              blocker: {
                condition:
                  "Blocked on staging quota/capacity and environment setup. Review later and decide whether alternate environment or escalation work is needed.",
                category: "external-wait",
                owner: "aks-explorer",
                waiting_for: {
                  type: "blocker.resolved",
                  taskId: "hold-compact-vague-environment-frontier",
                },
                observed_by: {
                  workflow: "project-planner",
                  schedule: "blocked-frontier-app-ops-review",
                  trigger: "project.owner.requested",
                },
                observation_method:
                  "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "environment-overblock",
        taskId: "hold-compact-vague-environment-frontier",
      }),
    ]);
  });

  test("planning packet suppresses source-exactness-overblock warning for feature-compact exact non-environment frontiers", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: [
                "compact-owner-frontier",
                "compact-pipeline-frontier",
                "source-exactness-blocker",
              ],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "compact-owner-frontier": {
              id: "compact-owner-frontier",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Keep the compact workload-autoscaler split frontier visible while source-equivalent evidence remains the exact carrier.",
              outputs: ["evidence/archive/workload-autoscaler-owner.md"],
              acceptance: ["owner frontier remains visible"],
              context: {
                featureCompactExactWait: true,
                featureKey: "workload-autoscaler",
                errorClass: "package-partial",
                target: "staging",
              },
              blocker: {
                condition:
                  "Do not rerun unchanged; the compact package remains partial on an exact two-member frontier. One member is already preserved by bounded mounted-source/public-doc source-equivalent evidence, not by an unresolved exact-source wait, and the other remains the reviewed runtime frontier until owner reclassification changes the split.",
                category: "external-wait",
                owner: "aks-explorer",
                waiting_for: {
                  type: "owner.decision",
                  featureKey: "workload-autoscaler",
                  target: "staging",
                  errorClass: "package-partial",
                  scope: "feature-compact",
                },
              },
            },
            "compact-pipeline-frontier": {
              id: "compact-pipeline-frontier",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Keep the compact aad-rbac residual frontier visible while exact carriers remain unchanged.",
              outputs: ["evidence/archive/aad-rbac-source.md"],
              acceptance: ["mixed frontier remains visible"],
              context: {
                featureCompactExactWait: true,
                featureKey: "aad-rbac",
                errorClass: "package-partial",
                target: "staging",
              },
              blocker: {
                condition:
                  "The compact frontier remains blocked on exact carriers, including a source-backed authorization ceiling and a capacity family member, until one represented carrier materially changes.",
                category: "external-wait",
                owner: "operator",
                waiting_for: {
                  type: "pipeline.result.or.artifact.available",
                  featureKey: "aad-rbac",
                  target: "staging",
                  errorClass: "package-partial",
                  scope: "feature-compact",
                },
              },
            },
            "source-exactness-blocker": {
              id: "source-exactness-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Provide an exact handwritten source excerpt before authoring the replay.",
              outputs: ["evidence/archive/source.md"],
              acceptance: ["source semantics are pinned"],
              blocker:
                "External/source unblock required: provide an exact handwritten/native source-body excerpt or source-equivalent proof.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "source-exactness-overblock",
        taskId: "source-exactness-blocker",
      }),
    ]);
  });

  test("planning packet suppresses source-exactness-overblock warning for compact superseded source-witness carriers already blocked behind an exact public wait", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: [
                "compact-source-witness-carrier",
                "source-exactness-blocker",
              ],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "compact-source-witness-carrier": {
              id: "compact-source-witness-carrier",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Keep the rp-regional-quota compact package blocked only behind the single public-create-path exact wait; represent the multi-cluster source-equivalent alias only as a superseded nonlive source witness, not as pending review debt.",
              outputs: ["evidence/archive/compact-source-witness-carrier.md"],
              acceptance: [
                "spec.rp-regional-quota.multi-cluster-source-equivalent is represented only as superseded raw-file/source-witness lineage and no longer appears as live review debt.",
                "spec.rp-regional-quota.public-create-path remains the only active compact frontier and is blocked only through reconcile-spec-loop-pending-rp-regional-quota.",
              ],
              context: {
                featureCompactExactWait: true,
                featureKey: "rp-regional-quota",
                errorClass: "compact-error",
                target: "staging",
              },
              blocker: {
                condition:
                  "Compact package excludes superseded raw-file lineage spec.rp-regional-quota.multi-cluster-source-equivalent; the only active compact frontier is spec.rp-regional-quota.public-create-path, which is already preserved as the exact blocked westus2 exhaustion wait on reconcile-spec-loop-pending-rp-regional-quota.",
                category: "external-wait",
                owner: "aks-explorer",
                waiting_for: {
                  type: "blocker.resolved",
                  taskId: "compact-source-witness-carrier",
                },
                observed_by: {
                  workflow: "project-planner",
                  schedule: "blocked-frontier-app-ops-review",
                  trigger: "project.owner.requested",
                },
                observation_method:
                  "Scheduled blocked-frontier review checks the compact summary/diagnostics plus the named public carrier and either keeps this exact compact wait or restores the next truthful compact frontier.",
                resume_condition:
                  "Resume only when reconcile-spec-loop-pending-rp-regional-quota changes the accepted public frontier or when the compact live-ready filter contract itself materially changes.",
              },
            },
            "source-exactness-blocker": {
              id: "source-exactness-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Provide an exact handwritten source excerpt before authoring the replay.",
              outputs: ["evidence/archive/source.md"],
              acceptance: ["source semantics are pinned"],
              blocker:
                "External/source unblock required: provide an exact handwritten/native source-body excerpt or source-equivalent proof.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "source-exactness-overblock",
        taskId: "source-exactness-blocker",
      }),
    ]);
  });

  test("planning packet suppresses source-exactness-overblock warning for exact quota-headroom waits with isolated alternative-target work", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: ["quota-headroom-wait", "source-exactness-blocker"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "quota-headroom-wait": {
              id: "quota-headroom-wait",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Carry the single exact westus2 quota-headroom wait for spec.rp-regional-quota.public-create-path. The only remaining blocker is current staging managedClusters headroom; any alternative-target or source-equivalent question is already isolated and must not spawn duplicate blocked work.",
              outputs: ["evidence/archive/quota-headroom-wait.md"],
              acceptance: [
                "This task remains the only live blocked carrier while westus2 managedClusters headroom prevents the decisive quota-negative create assertion; lack of a new exact source witness alone must not block progress.",
                "Resume only when the same staging subscription+region is again exhausted enough for the decisive managedClusters PUT quota-negative assertion, or when another reviewed same-surface exhausted target is accepted for this exact carrier.",
                "If the active alternative-target check proves no truthful successor exists, keep this exact wait as the sole family holder.",
              ],
              blocker: {
                condition:
                  "Reviewed run 172346097 proves the repaired carrier now stops only because staging westus2 managedClusters headroom is 40/161 rather than exhausted, so the decisive quota-negative create assertion was not reached.",
                category: "external-wait",
                owner: "aks-explorer",
                waiting_for: {
                  type: "azure.quota.exhausted",
                  taskId: "quota-headroom-wait",
                  specId: "spec.rp-regional-quota.public-create-path",
                  subscriptionId: "26fe00f8-9173-4872-9134-bb1d2e00343a",
                  location: "westus2",
                },
                observed_by: {
                  workflow: "project-planner",
                  schedule: "blocked-frontier-app-ops-review",
                  trigger: "project.owner.requested",
                },
                observation_method:
                  "Blocked-frontier review checks reviewed same-surface quota/headroom evidence for the named subscription+region and either keeps the wait, restores one bounded rerun task, or records an accepted replacement exhausted target.",
                next_check_at: "2099-07-16T03:35:33.203Z",
                fallback_at: "2099-07-16T13:35:33.203Z",
                resume_condition:
                  "Resume only when the same staging subscription+region is again exhausted enough for the decisive managedClusters PUT quota-negative assertion, or when another reviewed same-surface exhausted target is accepted for this exact carrier.",
                fallback_action:
                  "If no reviewed same-surface exhaustion proof appears by the next review window, refresh this exact wait from current quota/headroom evidence; do not rerun unchanged and do not revive the superseded multi-cluster source witness.",
              },
            },
            "source-exactness-blocker": {
              id: "source-exactness-blocker",
              parent_id: "project",
              state: "blocked",
              children: [],
              goal: "Provide an exact handwritten source excerpt before authoring the replay.",
              outputs: ["evidence/archive/source.md"],
              acceptance: ["source semantics are pinned"],
              blocker:
                "External/source unblock required: provide an exact handwritten/native source-body excerpt or source-equivalent proof.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.blocked_action_warnings).toEqual([
      expect.objectContaining({
        kind: "source-exactness-overblock",
        taskId: "source-exactness-blocker",
      }),
    ]);
  });

  test("planning packet excludes durable loop roots from task_tree_hygiene compaction candidates", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: ["aks-feature-reference-loop", "exact-open-wait"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
              context: {
                archived_done_leaf_count: 5,
                rollup_summary:
                  "Project parent already summarizes retained durable loop context.",
              },
            },
            "aks-feature-reference-loop": {
              id: "aks-feature-reference-loop",
              parent_id: "project",
              state: "done",
              status: "done",
              workflow: "feature-reference-loop-controller",
              priority: "P1",
              children: [],
              goal: "Keep official feature references current.",
              outputs: [".state/feature-reference-loop/state.json"],
              acceptance: ["Loop remains present until explicitly retired."],
              context: {
                workflowProgress: {
                  completionReady: true,
                  reason:
                    "feature-reference loop state has no pending, running, or error features",
                  pending: 0,
                  running: 0,
                  done: 305,
                  error: 0,
                  openChildren: 0,
                },
              },
            },
            "exact-open-wait": {
              id: "exact-open-wait",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              children: [],
              goal: "Wait for exact external proof return.",
              outputs: ["evidence/archive/wait.md"],
              acceptance: ["proof returned"],
              blocker: {
                condition: "external proof required",
                category: "external-wait",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const packet = planningPacket(config(projectDir));

    expect(packet.task_tree_hygiene).toEqual({
      safe_done_leaf_count: 0,
      protected_done_leaf_count: 1,
      compaction_candidates: [],
    });
  });

  test("repairs parent rollups and lifecycle from active leaves", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "closed",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "done",
              children: ["model-feedback"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "model-feedback": {
              id: "model-feedback",
              parent_id: "project",
              state: "done",
              children: ["feature-status-reconciliation"],
              goal: "update model",
              outputs: ["model/"],
              acceptance: ["views consistent"],
            },
            "feature-status-reconciliation": {
              id: "feature-status-reconciliation",
              parent_id: "model-feedback",
              state: "active",
              children: [],
              goal: "reconcile feature statuses",
              outputs: ["model/knowledge-map/feature-summary.json"],
              acceptance: ["feature status rolls up from paths"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = repairTaskTreeRollups(config(projectDir));

    expect(result).toMatchObject({
      changed: true,
      lifecycle: "active",
      active_task_ids: ["feature-status-reconciliation"],
      reopenedDurableLoopRoots: [],
      repairedChildBlockedParentResults: [],
      repairedLegacyFocusApprovalStates: [],
      repairedProjectRootGoal: false,
      repaired: [{ taskId: "model-feedback", from: "done", to: "active" }],
    });

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.project_lifecycle).toBe("closed");
    expect(tree.active_task_id).toBeNull();
    expect(tree.active_task_ids).toEqual([]);
    expect(tree.tasks.project.state).toBe("done");
    expect(tree.tasks["model-feedback"].state).toBe("done");
    expect(tree.tasks["feature-status-reconciliation"].state).toBe("active");
    expect(tree.tasks.project.status).toBeUndefined();
  });

  test("prunes missing child references from a named parent", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "review",
              children: ["live-child", "missing-child"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "live-child": {
              id: "live-child",
              parent_id: "project",
              state: "done",
              children: [],
              goal: "remaining child",
              outputs: ["evidence/archive/live-child.md"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = pruneMissingChildren(config(projectDir), {
      parentId: "project",
    });

    expect(result).toMatchObject({
      changed: true,
      parentId: "project",
      removedChildIds: ["missing-child"],
      remainingChildIds: ["live-child"],
      active_task_ids: [],
    });

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks.project.children).toEqual(["live-child"]);
  });

  test("task saves automatically repair parent rollups and snapshot", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: "leaf",
          active_task_ids: ["leaf"],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: ["lane"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            lane: {
              id: "lane",
              parent_id: "project",
              state: "active",
              children: ["leaf"],
              goal: "lane",
              outputs: ["model/"],
              acceptance: ["done"],
            },
            leaf: {
              id: "leaf",
              parent_id: "lane",
              state: "active",
              children: [],
              goal: "do work",
              outputs: ["model/output.json"],
              acceptance: ["work complete"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    completeTask(config(projectDir), {
      taskId: "leaf",
      claim: "done",
      summary: "worker says done",
    });

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.project_lifecycle).toBe("active");
    expect(tree.active_task_id).toBeNull();
    expect(tree.active_task_ids).toEqual([]);
    expect(tree.tasks.leaf.state).toBe("review");
    expect(tree.tasks.lane.state).toBe("active");
    expect(tree.tasks.project.state).toBe("active");

    const kanban = JSON.parse(
      await readFile(projectRuntimePaths(projectDir).kanbanPath, "utf8"),
    );
    expect(kanban.tree_updated_at).toBe(tree.updated_at);
    expect(kanban.kanban.column_counts.review).toBe(1);
  });

  test("compacts done leaves from legacy array trees while preserving dependencies", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "tasks", "archive"), { recursive: true });
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: [
            {
              id: "project",
              state: "backlog",
              children: ["lane"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            {
              id: "lane",
              parent_id: "project",
              state: "backlog",
              children: ["done-free", "done-needed", "open"],
              goal: "lane",
              outputs: ["model/"],
              acceptance: ["done"],
            },
            {
              id: "done-free",
              parent_id: "lane",
              state: "done",
              children: [],
              goal: "historical completed work",
              outputs: ["evidence/archive/free.md"],
              acceptance: ["archivable"],
            },
            {
              id: "done-needed",
              parent_id: "lane",
              state: "done",
              children: [],
              goal: "completed dependency",
              outputs: ["evidence/archive/needed.md"],
              acceptance: ["must remain while referenced"],
            },
            {
              id: "open",
              parent_id: "lane",
              state: "backlog",
              children: [],
              depends_on: ["done-needed"],
              goal: "open work",
              outputs: ["evidence/archive/open.md"],
              acceptance: ["dependency remains satisfiable"],
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = compactDoneLeaves(config(projectDir), {
      limit: 10,
      reason: "test compaction",
    });

    expect(result).toMatchObject({
      changed: true,
      archived: 1,
      protected: 1,
      remainingTotal: 4,
    });
    expect(result.archivePath).toMatch(
      /^\.state\/tasks\/archive\/done-leaves-/,
    );

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(Array.isArray(tree.tasks)).toBe(false);
    expect(tree.tasks["done-free"]).toBeUndefined();
    expect(tree.tasks["done-needed"]).toBeDefined();
    expect(tree.tasks.open.depends_on).toEqual(["done-needed"]);
    expect(tree.tasks.lane.children).toEqual(["done-needed", "open"]);
    expect(tree.tasks.lane.context.archived_done_leaf_count).toBe(1);

    const archive = JSON.parse(
      await readFile(join(projectDir, result.archivePath!), "utf8"),
    );
    expect(archive.tasks.map((task: { id: string }) => task.id)).toEqual([
      "done-free",
    ]);
  });

  test("marks review work done and unlocks dependent backlog", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "review",
              children: ["lane"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            lane: {
              id: "lane",
              parent_id: "project",
              state: "review",
              children: ["review-leaf", "dependent-leaf"],
              goal: "lane",
              outputs: ["model/"],
              acceptance: ["done"],
            },
            "review-leaf": {
              id: "review-leaf",
              parent_id: "lane",
              state: "review",
              children: [],
              goal: "review worker output",
              outputs: ["evidence/archive/review.md"],
              acceptance: ["review accepted"],
              trace: {
                last_worker_result: "done",
                last_worker_summary: "worker output is valid",
              },
            },
            "dependent-leaf": {
              id: "dependent-leaf",
              parent_id: "lane",
              state: "backlog",
              children: [],
              goal: "run after review",
              outputs: ["runs/executions/"],
              acceptance: ["done"],
              depends_on: ["review-leaf"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    markTaskDone(config(projectDir), {
      taskId: "review-leaf",
      summary: "accepted worker output",
    });

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["review-leaf"].state).toBe("done");
    expect(tree.tasks["review-leaf"].context.acceptance_note).toBe(
      "accepted worker output",
    );
    expect(tree.tasks["dependent-leaf"].state).toBe("backlog");
    expect(tree.tasks.lane.state).toBe("review");
    expect(tree.tasks.project.state).toBe("review");

    const kanban = JSON.parse(
      await readFile(projectRuntimePaths(projectDir).kanbanPath, "utf8"),
    );
    expect(kanban.kanban.column_counts.backlog).toBe(1);
    expect(kanban.kanban.column_counts.done).toBe(1);
  });

  test("requeue-stale-active atomically clears prior attempt liveness before one fresh assignment", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: "active-leaf",
          active_task_ids: ["active-leaf"],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: ["active-leaf"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "active-leaf": {
              id: "active-leaf",
              parent_id: "project",
              state: "active",
              status: "active",
              kind: "domain_leaf",
              children: [],
              goal: "repair one worker assignment",
              outputs: ["evidence/archive/requeue.md"],
              acceptance: ["done"],
              owner: "aks-explorer",
              session_id: "s_task_active-leaf_attempt-old",
              session_history: ["s_task_active-leaf_attempt-old"],
              trace: {
                current_attempt_id: "attempt-old",
                worker_started_attempt_id: "attempt-old",
                worker_started_at: "2026-07-16T15:57:00.000Z",
                last_worker_result: "partial",
                last_worker_summary: "Old attempt left reviewable evidence.",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    expect(
      requeueStaleActiveTasks(config(projectDir), {
        taskIds: ["active-leaf"],
        reason: "runtime session was replaced",
        freshSession: true,
      }),
    ).toEqual(["active-leaf"]);

    const requeued = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(requeued.tasks["active-leaf"].state).toBe("backlog");
    expect(requeued.tasks["active-leaf"].session_id).toBeUndefined();
    expect(requeued.tasks["active-leaf"].trace).toMatchObject({
      previous_attempt_id: "attempt-old",
      previous_session_id: "s_task_active-leaf_attempt-old",
      stale_active_fresh_session: true,
      stale_active_requeue_reason: "runtime session was replaced",
      last_worker_result: "partial",
      last_worker_summary: "Old attempt left reviewable evidence.",
    });
    expect(
      requeued.tasks["active-leaf"].trace.current_attempt_id,
    ).toBeUndefined();
    expect(
      requeued.tasks["active-leaf"].trace.worker_started_attempt_id,
    ).toBeUndefined();
    expect(
      requeued.tasks["active-leaf"].trace.worker_started_at,
    ).toBeUndefined();
    expect(requeued.active_task_ids).toEqual([]);

    const assignment = assignTask(config(projectDir), {
      taskId: "active-leaf",
      attemptId: "attempt-new",
      worker: "aks-explorer",
    });
    expect(assignment.attemptId).toBe("attempt-new");

    const reassigned = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(reassigned.active_task_ids).toEqual(["active-leaf"]);
    expect(reassigned.tasks["active-leaf"].session_id).toBe(
      assignment.sessionId,
    );
    expect(reassigned.tasks["active-leaf"].trace).toMatchObject({
      current_attempt_id: "attempt-new",
      previous_attempt_id: "attempt-old",
      previous_session_id: "s_task_active-leaf_attempt-old",
      last_worker_result: "partial",
      last_worker_summary: "Old attempt left reviewable evidence.",
    });
    expect(
      reassigned.tasks["active-leaf"].trace.worker_started_attempt_id,
    ).toBeUndefined();
    expect(
      reassigned.tasks["active-leaf"].trace.worker_started_at,
    ).toBeUndefined();
    expect(reassigned.tasks["active-leaf"].session_history).toEqual([
      "s_task_active-leaf_attempt-old",
      assignment.sessionId,
    ]);
  });

  test("refuses to mark review task done when latest reviewer decision is redo", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, ".state"), { recursive: true });
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          root_task_id: "project",
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["review-leaf"],
              goal: "project",
              outputs: [],
              acceptance: [],
            },
            "review-leaf": {
              id: "review-leaf",
              parent_id: "project",
              state: "review",
              children: [],
              goal: "review one worker claim",
              outputs: ["evidence/archive/review.md"],
              acceptance: ["review accepted"],
              trace: {
                current_attempt_id: "attempt-1",
                last_worker_result: "done",
                last_worker_summary: "worker output is stale",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      join(projectDir, ".state", "task-reviewer-runs.jsonl"),
      `${JSON.stringify({
        ts: "2026-07-11T00:04:04.858Z",
        workflow: "task-reviewer",
        result: "project.task.reviewed",
        task_id: "review-leaf",
        attempt_id: "attempt-1",
        decision: "redo",
        confidence: "high",
      })}\n`,
      "utf8",
    );

    expect(() =>
      markTaskDone(config(projectDir), {
        taskId: "review-leaf",
        summary: "planner accepted from parallel wake",
      }),
    ).toThrow(/latest reviewer decision redo/);
  });

  test("allows mark done when applying the same non-redo reviewer decision", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          root_task_id: "project",
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["review-leaf"],
              goal: "project",
              outputs: [],
              acceptance: [],
            },
            "review-leaf": {
              id: "review-leaf",
              parent_id: "project",
              state: "review",
              children: [],
              goal: "review one worker claim",
              outputs: ["evidence/archive/review.md"],
              acceptance: ["review accepted"],
              trace: {
                current_attempt_id: "attempt-1",
                last_worker_result: "done",
                last_worker_summary: "worker output is valid",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      join(projectDir, ".state", "task-reviewer-runs.jsonl"),
      `${JSON.stringify({
        ts: "2026-07-11T00:04:04.858Z",
        workflow: "task-reviewer",
        result: "project.task.reviewed",
        task_id: "review-leaf",
        attempt_id: "attempt-1",
        decision: "accept",
        confidence: "high",
      })}\n`,
      "utf8",
    );

    const task = markTaskDone(config(projectDir), {
      taskId: "review-leaf",
      summary: "accepted by reviewer",
      reviewDecision: "accept",
    });

    expect(task.state).toBe("done");
  });

  test("refuses to close spec-loop follow-up when represented retry-drained specs lack an open owner", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["review-leaf"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "review-leaf": {
              id: "review-leaf",
              parent_id: "project",
              state: "review",
              status: "review",
              children: [],
              goal: "review spec-loop follow-up",
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["review accepted"],
              conflict_scope: ["spec-loop-followup:pending:cost-analysis"],
              inputs: ["spec:spec.cost-analysis.vm-prerelease-source-seed"],
              context: {
                specLoopFollowup: true,
                status: "pending",
                featureFamily: "cost-analysis",
                representedSpecIds: [
                  "spec.cost-analysis.vm-prerelease-source-seed",
                ],
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeSpecLoopState(projectDir, {
      "spec.cost-analysis.vm-prerelease-source-seed": {
        status: "pending",
        attempts: 3,
        taskId: "review-leaf",
        lastRunId: null,
        lastRunUrl: "https://github.example/runs/1",
        lastResultPath: "runs/test-results/cost-analysis.json",
        lastPrUrl: null,
        updatedAt: new Date().toISOString(),
        successorDisposition: "environment-blocker-pending-followup",
        resumeCondition: "underlay kubeconfig is available",
        review: { decision: "blocked" },
      },
    });

    expect(() =>
      markTaskDone(config(projectDir), {
        taskId: "review-leaf",
        summary: "mentions an environment wait but does not create one",
      }),
    ).toThrow(/cannot be marked done/);
  });

  test("allows closing spec-loop follow-up when exact pending residue is self-represented in spec-loop state", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["review-leaf"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "review-leaf": {
              id: "review-leaf",
              parent_id: "project",
              state: "review",
              status: "review",
              children: [],
              goal: "review spec-loop follow-up",
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["review accepted"],
              conflict_scope: ["spec-loop-followup:pending:secops-fips"],
              inputs: ["spec:spec.secops-fips.advanced"],
              context: {
                specLoopFollowup: true,
                status: "pending",
                featureFamily: "secops-fips",
                representedSpecIds: ["spec.secops-fips.advanced"],
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeSpecLoopState(projectDir, {
      "spec.secops-fips.advanced": {
        status: "pending",
        attempts: 3,
        taskId: null,
        lastRunId: "171461207",
        lastRunUrl: "https://dev.azure.example/runs/171461207",
        lastResultPath: "runs/test-results/secops-fips-advanced.json",
        lastPrUrl: null,
        updatedAt: new Date().toISOString(),
        successorDisposition: "repaired-ready-residue-no-new-leaf",
        resumeCondition:
          "Resume only if the owner explicitly selects one bounded same-spec live rerun from the repaired carrier or a metadata decision materially changes this spec's posture.",
        review: { decision: "pending", classification: "repaired_ready" },
      },
    });

    const done = markTaskDone(config(projectDir), {
      taskId: "review-leaf",
      summary:
        "state residue is already exact and should not require another broad holder",
    });

    expect(done.state).toBe("done");
  });

  test("allows closing spec-loop follow-up when an exact open holder owns the represented spec", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["review-leaf", "wait-leaf"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "review-leaf": {
              id: "review-leaf",
              parent_id: "project",
              state: "review",
              status: "review",
              children: [],
              goal: "review spec-loop follow-up",
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["review accepted"],
              conflict_scope: ["spec-loop-followup:pending:defender-profile"],
              inputs: ["spec:spec.defender-profile.vm-prerelease-matrix"],
              context: {
                specLoopFollowup: true,
                status: "pending",
                featureFamily: "defender-profile",
                representedSpecIds: [
                  "spec.defender-profile.vm-prerelease-matrix",
                ],
              },
            },
            "wait-leaf": {
              id: "wait-leaf",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              children: [],
              goal: "Wait for GitHub auth-preflight repair.",
              outputs: ["tasks/tree.json"],
              acceptance: ["auth preflight repaired"],
              conflict_scope: [
                "spec:spec.defender-profile.vm-prerelease-matrix",
              ],
              blocker: { category: "external-wait" },
              resumeCondition: "GitHub auth preflight succeeds.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeSpecLoopState(projectDir, {
      "spec.defender-profile.vm-prerelease-matrix": {
        status: "pending",
        attempts: 3,
        taskId: null,
        lastRunId: null,
        lastRunUrl: "https://github.example/runs/2",
        lastResultPath: "runs/test-results/defender.json",
        lastPrUrl: null,
        updatedAt: new Date().toISOString(),
        successorDisposition: "workflow-auth-preflight-blocker",
        resumeCondition: "GitHub auth preflight succeeds.",
        review: { decision: "blocked" },
      },
    });

    const done = markTaskDone(config(projectDir), {
      taskId: "review-leaf",
      summary: "exact holder owns the remaining wait",
    });

    expect(done.state).toBe("done");
  });

  test("replaces outputs on an existing task and preserves other metadata", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["promotion-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "promotion-task": {
              id: "promotion-task",
              parent_id: "project",
              state: "done",
              kind: "domain_leaf",
              priority: "P2",
              owner: "aks-explorer",
              children: [],
              goal: "repair malformed outputs metadata",
              outputs: [
                "evidence/archive/old.md,features/wrong.yaml,specs/extra.json",
              ],
              acceptance: ["outputs repaired"],
              conflict_scope: ["feature:managedsystem"],
              trace: {
                created_at: "2026-06-17T00:00:00.000Z",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const updated = updateTaskOutputs(config(projectDir), {
      taskId: "promotion-task",
      outputs: [
        "evidence/archive/managedsystem-create-time-initial-pool-feature-packet-promotion-20260617.md",
        "features/managedsystem-pool/create-time-initial-pool.yaml",
      ],
    });

    expect(updated.outputs).toEqual([
      "evidence/archive/managedsystem-create-time-initial-pool-feature-packet-promotion-20260617.md",
      "features/managedsystem-pool/create-time-initial-pool.yaml",
    ]);
    expect(updated.goal).toBe("repair malformed outputs metadata");
    expect(updated.acceptance).toEqual(["outputs repaired"]);
    expect(updated.conflict_scope).toEqual(["feature:managedsystem"]);

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["promotion-task"].outputs).toEqual([
      "evidence/archive/managedsystem-create-time-initial-pool-feature-packet-promotion-20260617.md",
      "features/managedsystem-pool/create-time-initial-pool.yaml",
    ]);
    expect(tree.tasks["promotion-task"].goal).toBe(
      "repair malformed outputs metadata",
    );
    expect(tree.tasks["promotion-task"].acceptance).toEqual([
      "outputs repaired",
    ]);

    const journal = await readFile(
      join(projectDir, ".state", "journal.jsonl"),
      "utf8",
    );
    expect(journal).toContain('"kind":"task_outputs_updated"');
    expect(journal).toContain('"task_id":"promotion-task"');
  });

  test("replaces outputs on an archived done-leaf task and preserves other metadata", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "tasks", "archive"), { recursive: true });
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: [],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      join(projectDir, "tasks", "archive", "done-leaves-test.json"),
      `${JSON.stringify(
        {
          version: 1,
          generated_at: "2026-06-20T00:00:00.000Z",
          reason: "owner rolled up completed child tasks",
          parent_id: "project",
          summary: "test archive",
          archived: 1,
          tasks: [
            {
              id: "archived-promotion-task",
              parent_id: "project",
              state: "done",
              kind: "domain_leaf",
              priority: "P2",
              owner: "aks-explorer",
              children: [],
              goal: "repair archived outputs metadata",
              outputs: ["evidence/archive/old-archived.md"],
              acceptance: ["outputs repaired"],
              conflict_scope: ["feature:managedsystem"],
              trace: {
                created_at: "2026-06-17T00:00:00.000Z",
              },
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const updated = updateArchivedTaskOutputs(config(projectDir), {
      taskId: "archived-promotion-task",
      outputs: [
        "evidence/archive/managedsystem-create-time-initial-pool-feature-packet-promotion-20260617.md",
        "features/managedsystem-pool/create-time-initial-pool.yaml",
      ],
    });

    expect(updated.beforeOutputs).toEqual(["evidence/archive/old-archived.md"]);
    expect(updated.afterOutputs).toEqual([
      "evidence/archive/managedsystem-create-time-initial-pool-feature-packet-promotion-20260617.md",
      "features/managedsystem-pool/create-time-initial-pool.yaml",
    ]);
    expect(updated.archiveFile).toContain("done-leaves-test.json");
    expect(updated.changed).toBe(true);
    expect(updated.task.outputs).toEqual([
      "evidence/archive/managedsystem-create-time-initial-pool-feature-packet-promotion-20260617.md",
      "features/managedsystem-pool/create-time-initial-pool.yaml",
    ]);
    expect(updated.task.goal).toBe("repair archived outputs metadata");
    expect(updated.task.acceptance).toEqual(["outputs repaired"]);
    expect(updated.task.conflict_scope).toEqual(["feature:managedsystem"]);

    const archive = JSON.parse(
      await readFile(
        join(projectDir, "tasks", "archive", "done-leaves-test.json"),
        "utf8",
      ),
    );
    expect(archive.tasks[0].outputs).toEqual([
      "evidence/archive/managedsystem-create-time-initial-pool-feature-packet-promotion-20260617.md",
      "features/managedsystem-pool/create-time-initial-pool.yaml",
    ]);
    expect(archive.tasks[0].goal).toBe("repair archived outputs metadata");
    expect(archive.tasks[0].acceptance).toEqual(["outputs repaired"]);

    const journal = await readFile(
      join(projectDir, ".state", "journal.jsonl"),
      "utf8",
    );
    expect(journal).toContain('"kind":"archived_task_outputs_updated"');
    expect(journal).toContain('"task_id":"archived-promotion-task"');
  });

  test("rejects archived output updates when the same task id appears in multiple archive bundles", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "tasks", "archive"), { recursive: true });
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: [],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    const duplicateTask = {
      id: "duplicate-archived-task",
      parent_id: "project",
      state: "done",
      status: "done",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "duplicate archived task",
      outputs: ["evidence/archive/old.md"],
      acceptance: ["outputs repaired"],
    };
    await writeFile(
      join(projectDir, "tasks", "archive", "done-leaves-a.json"),
      `${JSON.stringify({ tasks: [duplicateTask] }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      join(projectDir, "tasks", "archive", "done-leaves-b.json"),
      `${JSON.stringify({ tasks: [duplicateTask] }, null, 2)}\n`,
      "utf8",
    );

    expect(() =>
      updateArchivedTaskOutputs(config(projectDir), {
        taskId: "duplicate-archived-task",
        outputs: ["evidence/archive/new.md"],
      }),
    ).toThrow(/appears in more than one archive bundle/);
  });

  test("updates archived outputs when duplicate ids exist but a specific archive bundle is requested", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "tasks", "archive"), { recursive: true });
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: [],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    const duplicateTask = {
      id: "duplicate-archived-task",
      parent_id: "project",
      state: "done",
      status: "done",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "duplicate archived task",
      outputs: ["evidence/archive/old.md"],
      acceptance: ["outputs repaired"],
    };
    await writeFile(
      join(projectDir, "tasks", "archive", "done-leaves-a.json"),
      `${JSON.stringify({ tasks: [duplicateTask] }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      join(projectDir, "tasks", "archive", "done-leaves-b.json"),
      `${JSON.stringify({ tasks: [duplicateTask] }, null, 2)}\n`,
      "utf8",
    );

    const updated = updateArchivedTaskOutputs(config(projectDir), {
      taskId: "duplicate-archived-task",
      archiveFile: "tasks/archive/done-leaves-b.json",
      outputs: ["evidence/archive/new.md", "replays/example.ts"],
    });

    expect(updated.archiveFile).toContain("done-leaves-b.json");
    expect(updated.afterOutputs).toEqual([
      "evidence/archive/new.md",
      "replays/example.ts",
    ]);

    const archiveA = JSON.parse(
      await readFile(
        join(projectDir, "tasks", "archive", "done-leaves-a.json"),
        "utf8",
      ),
    );
    const archiveB = JSON.parse(
      await readFile(
        join(projectDir, "tasks", "archive", "done-leaves-b.json"),
        "utf8",
      ),
    );
    expect(archiveA.tasks[0].outputs).toEqual(["evidence/archive/old.md"]);
    expect(archiveB.tasks[0].outputs).toEqual([
      "evidence/archive/new.md",
      "replays/example.ts",
    ]);
  });

  test("rejects archived output updates when the archived task id is missing", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "tasks", "archive"), { recursive: true });
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: [],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      join(projectDir, "tasks", "archive", "done-leaves-test.json"),
      `${JSON.stringify({ tasks: [] }, null, 2)}\n`,
      "utf8",
    );

    expect(() =>
      updateArchivedTaskOutputs(config(projectDir), {
        taskId: "missing-archived-task",
        outputs: ["evidence/archive/new.md"],
      }),
    ).toThrow(/Archived task not found/);
  });

  test("rejects archived output updates when the archived task is not done", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "tasks", "archive"), { recursive: true });
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: [],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      join(projectDir, "tasks", "archive", "done-leaves-test.json"),
      `${JSON.stringify(
        {
          tasks: [
            {
              id: "archived-not-done-task",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              kind: "domain_leaf",
              priority: "P2",
              owner: "aks-explorer",
              children: [],
              goal: "should not update",
              outputs: ["evidence/archive/old.md"],
              acceptance: ["outputs repaired"],
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    expect(() =>
      updateArchivedTaskOutputs(config(projectDir), {
        taskId: "archived-not-done-task",
        outputs: ["evidence/archive/new.md"],
      }),
    ).toThrow(/Archived task is not done/);
  });

  test("updates archived evidence and last_worker_evidence for a done archived task", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "tasks", "archive"), { recursive: true });
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: [],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      join(projectDir, "tasks", "archive", "done-leaves-test.json"),
      `${JSON.stringify(
        {
          tasks: [
            {
              id: "archived-evidence-task",
              parent_id: "project",
              state: "done",
              status: "done",
              kind: "domain_leaf",
              priority: "P2",
              owner: "app-ops",
              children: [],
              goal: "repair archived evidence metadata",
              outputs: ["../aks-rp-e2e/evidence/archive/example.md"],
              evidence: ["evidence/archive/example.md"],
              acceptance: ["evidence repaired"],
              trace: {
                created_at: "2026-07-09T00:00:00.000Z",
                last_worker_evidence: ["evidence/archive/example.md"],
              },
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const updated = updateArchivedTaskEvidence(config(projectDir), {
      taskId: "archived-evidence-task",
      evidence: ["../aks-rp-e2e/evidence/archive/example.md"],
    });

    expect(updated.beforeEvidence).toEqual(["evidence/archive/example.md"]);
    expect(updated.afterEvidence).toEqual([
      "../aks-rp-e2e/evidence/archive/example.md",
    ]);
    expect(updated.beforeLastWorkerEvidence).toEqual([
      "evidence/archive/example.md",
    ]);
    expect(updated.afterLastWorkerEvidence).toEqual([
      "../aks-rp-e2e/evidence/archive/example.md",
    ]);
    expect(updated.changed).toBe(true);
    expect(updated.task.evidence).toEqual([
      "../aks-rp-e2e/evidence/archive/example.md",
    ]);
    expect(updated.task.trace?.last_worker_evidence).toEqual([
      "../aks-rp-e2e/evidence/archive/example.md",
    ]);

    const archive = JSON.parse(
      await readFile(
        join(projectDir, "tasks", "archive", "done-leaves-test.json"),
        "utf8",
      ),
    );
    expect(archive.tasks[0].evidence).toEqual([
      "../aks-rp-e2e/evidence/archive/example.md",
    ]);
    expect(archive.tasks[0].trace.last_worker_evidence).toEqual([
      "../aks-rp-e2e/evidence/archive/example.md",
    ]);

    const journal = await readFile(
      join(projectDir, ".state", "journal.jsonl"),
      "utf8",
    );
    expect(journal).toContain('"kind":"archived_task_evidence_updated"');
    expect(journal).toContain('"task_id":"archived-evidence-task"');
  });

  test("updates archived outputs when duplicate ids exist but a specific archive bundle is requested", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "tasks", "archive"), { recursive: true });
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: [],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    const duplicateTask = {
      id: "duplicate-archived-task",
      parent_id: "project",
      state: "done",
      status: "done",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "duplicate archived task",
      outputs: ["evidence/archive/old.md"],
      acceptance: ["outputs repaired"],
    };
    await writeFile(
      join(projectDir, "tasks", "archive", "done-leaves-a.json"),
      `${JSON.stringify({ tasks: [duplicateTask] }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      join(projectDir, "tasks", "archive", "done-leaves-b.json"),
      `${JSON.stringify({ tasks: [duplicateTask] }, null, 2)}\n`,
      "utf8",
    );

    const updated = updateArchivedTaskOutputs(config(projectDir), {
      taskId: "duplicate-archived-task",
      archiveFile: "tasks/archive/done-leaves-b.json",
      outputs: ["evidence/archive/new.md", "replays/example.ts"],
    });

    expect(updated.archiveFile).toContain("done-leaves-b.json");
    expect(updated.afterOutputs).toEqual([
      "evidence/archive/new.md",
      "replays/example.ts",
    ]);

    const archiveA = JSON.parse(
      await readFile(
        join(projectDir, "tasks", "archive", "done-leaves-a.json"),
        "utf8",
      ),
    );
    const archiveB = JSON.parse(
      await readFile(
        join(projectDir, "tasks", "archive", "done-leaves-b.json"),
        "utf8",
      ),
    );
    expect(archiveA.tasks[0].outputs).toEqual(["evidence/archive/old.md"]);
    expect(archiveB.tasks[0].outputs).toEqual([
      "evidence/archive/new.md",
      "replays/example.ts",
    ]);
  });

  test("updates existing task text fields and preserves outputs/conflict scope", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["blocked-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "blocked-task": {
              id: "blocked-task",
              parent_id: "project",
              state: "blocked",
              kind: "domain_leaf",
              priority: "P2",
              owner: "aks-explorer",
              children: [],
              goal: "old goal",
              outputs: ["evidence/archive/blocked.md"],
              acceptance: ["old acceptance"],
              blocker: "old blocker",
              conflict_scope: ["feature:test"],
              trace: {
                created_at: "2026-06-18T00:00:00.000Z",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const updated = updateTaskText(config(projectDir), {
      taskId: "blocked-task",
      goal: "new goal",
      acceptance: ["new acceptance"],
      blocker: "new blocker",
    });

    expect(updated.goal).toBe("new goal");
    expect(updated.acceptance).toEqual(["new acceptance"]);
    expect(updated.blocker).toBe("new blocker");
    expect(updated.outputs).toEqual(["evidence/archive/blocked.md"]);
    expect(updated.conflict_scope).toEqual(["feature:test"]);

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["blocked-task"].goal).toBe("new goal");
    expect(tree.tasks["blocked-task"].acceptance).toEqual(["new acceptance"]);
    expect(tree.tasks["blocked-task"].blocker).toBe("new blocker");
    expect(tree.tasks["blocked-task"].outputs).toEqual([
      "evidence/archive/blocked.md",
    ]);

    const journal = await readFile(
      join(projectDir, ".state", "journal.jsonl"),
      "utf8",
    );
    expect(journal).toContain('"kind":"task_text_updated"');
    expect(journal).toContain('"task_id":"blocked-task"');
  });

  test("updates only accepted-review metadata fields on an existing task", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "review",
              children: ["accepted-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "accepted-task": {
              id: "accepted-task",
              parent_id: "project",
              state: "done",
              kind: "domain_leaf",
              priority: "P2",
              owner: "aks-explorer",
              children: [],
              goal: "keep all non-review fields untouched",
              outputs: ["evidence/archive/original.md"],
              acceptance: ["accepted wording is synced"],
              conflict_scope: ["tooling:task-tree-review-metadata"],
              trace: {
                created_at: "2026-06-18T00:00:00.000Z",
                reviewed_by: "task-tree-tool",
                review_summary: "old accepted summary",
              },
              context: {
                acceptance_note: "old accepted note",
                keep: "preserve-me",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const updated = updateAcceptedReviewMetadata(config(projectDir), {
      taskId: "accepted-task",
      reviewSummary: "fresh review summary",
      acceptanceNote: "fresh acceptance note",
    });

    expect(updated.state).toBe("done");
    expect(updated.goal).toBe("keep all non-review fields untouched");
    expect(updated.outputs).toEqual(["evidence/archive/original.md"]);
    expect(updated.acceptance).toEqual(["accepted wording is synced"]);
    expect(updated.trace?.review_summary).toBe("fresh review summary");
    expect(
      (updated.context as { acceptance_note?: string; keep?: string })
        .acceptance_note,
    ).toBe("fresh acceptance note");
    expect((updated.context as { keep?: string }).keep).toBe("preserve-me");

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["accepted-task"].state).toBe("done");
    expect(tree.tasks["accepted-task"].goal).toBe(
      "keep all non-review fields untouched",
    );
    expect(tree.tasks["accepted-task"].outputs).toEqual([
      "evidence/archive/original.md",
    ]);
    expect(tree.tasks["accepted-task"].acceptance).toEqual([
      "accepted wording is synced",
    ]);
    expect(tree.tasks["accepted-task"].trace.review_summary).toBe(
      "fresh review summary",
    );
    expect(tree.tasks["accepted-task"].context.acceptance_note).toBe(
      "fresh acceptance note",
    );
    expect(tree.tasks["accepted-task"].context.keep).toBe("preserve-me");

    const journal = await readFile(
      join(projectDir, ".state", "journal.jsonl"),
      "utf8",
    );
    expect(journal).toContain('"kind":"task_accepted_review_metadata_updated"');
    expect(journal).toContain('"task_id":"accepted-task"');
  });

  test("refuses normal done review when workflow progress says acceptance is incomplete", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["workflow-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "workflow-task": {
              id: "workflow-task",
              parent_id: "project",
              state: "review",
              status: "review",
              workflow: "example-controller",
              priority: "P1",
              children: [],
              goal: "Keep workflow work moving.",
              outputs: [".state/example/state.json"],
              acceptance: ["All queued work has a reviewed disposition."],
              context: {
                workflowProgress: {
                  completionReady: false,
                  reason: "example workflow still has queued work",
                  pending: 12,
                  running: 1,
                },
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    expect(() =>
      markTaskDone(config(projectDir), {
        taskId: "workflow-task",
        summary: "incorrectly accepting the controller",
      }),
    ).toThrow(/cannot be marked done/);

    const replaced = markTaskDone(config(projectDir), {
      taskId: "workflow-task",
      summary: "intentionally replaced by a newer workflow task",
      resolution: "replaced",
    });
    expect(replaced.state).toBe("done");
    expect(replaced.resolution).toBe("replaced");
  });

  test("refuses parent rollup for an incomplete workflow controller", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["workflow-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "workflow-task": {
              id: "workflow-task",
              parent_id: "project",
              state: "done",
              status: "done",
              workflow: "example-controller",
              priority: "P1",
              children: [],
              goal: "Keep workflow work moving.",
              outputs: [".state/example/state.json"],
              acceptance: ["All queued work has a reviewed disposition."],
              context: {
                workflowProgress: {
                  completionReady: false,
                  reason: "example workflow still has queued work",
                  pending: 12,
                  running: 1,
                },
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    expect(() =>
      rollupParent(config(projectDir), {
        parentId: "project",
        summary: "incorrectly archive the controller",
        taskIds: ["workflow-task"],
      }),
    ).toThrow(/cannot be archived by parent rollup/);

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["workflow-task"]).toBeDefined();
    expect(tree.tasks.project.children).toEqual(["workflow-task"]);
  });

  test("allows parent rollup for a completed workflow controller", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["workflow-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "workflow-task": {
              id: "workflow-task",
              parent_id: "project",
              state: "done",
              status: "done",
              workflow: "example-controller",
              priority: "P1",
              children: [],
              goal: "Keep workflow work moving.",
              outputs: [".state/example/state.json"],
              acceptance: ["All queued work has a reviewed disposition."],
              context: {
                workflowProgress: {
                  completionReady: true,
                  reason: "example workflow has no queued work",
                  pending: 0,
                  running: 0,
                },
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = rollupParent(config(projectDir), {
      parentId: "project",
      summary: "archive the completed controller",
      taskIds: ["workflow-task"],
    });

    expect(result.archivedTaskIds).toEqual(["workflow-task"]);
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["workflow-task"]).toBeUndefined();
    expect(tree.tasks.project.children).toEqual([]);
  });

  test("rollup-parent refreshes parent summary while preserving done durable loop roots", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: [
                "aks-feature-reference-loop",
                "wait-external-owner-signal",
              ],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-feature-reference-loop": {
              id: "aks-feature-reference-loop",
              parent_id: "project",
              state: "done",
              status: "done",
              workflow: "feature-reference-loop-controller",
              priority: "P1",
              children: [],
              goal: "Keep official feature references current.",
              outputs: [".state/feature-reference-loop/state.json"],
              acceptance: ["Loop remains present until explicitly retired."],
              context: {
                workflowProgress: {
                  completionReady: true,
                  reason: "feature-reference loop has no active refill work",
                  pending: 0,
                  running: 0,
                },
              },
            },
            "wait-external-owner-signal": {
              id: "wait-external-owner-signal",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              children: [],
              goal: "Wait for owner signal.",
              outputs: ["evidence/archive/wait.md"],
              acceptance: ["signal returns"],
              blocker: {
                condition: "external owner signal required",
                category: "external-wait",
                owner: "operator",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = rollupParent(config(projectDir), {
      parentId: "project",
      summary: "refresh project summary without archiving durable loop roots",
    });

    expect(result).toMatchObject({
      changed: true,
      archived: 0,
      protected: 1,
      parentId: "project",
      archivedTaskIds: [],
    });
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["aks-feature-reference-loop"]).toBeDefined();
    expect(tree.tasks["wait-external-owner-signal"]).toBeDefined();
    expect(tree.tasks.project.children).toEqual([
      "aks-feature-reference-loop",
      "wait-external-owner-signal",
    ]);
    expect(tree.tasks.project.context.rollup_summary).toBe(
      "refresh project summary without archiving durable loop roots",
    );
  });

  test("refuses parent rollup for durable loop roots even when completion-ready", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["aks-feature-reference-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-feature-reference-loop": {
              id: "aks-feature-reference-loop",
              parent_id: "project",
              state: "done",
              workflow: "feature-reference-loop-controller",
              priority: "P1",
              children: [],
              goal: "Keep official feature references current.",
              outputs: [".state/feature-reference-loop/state.json"],
              acceptance: ["Loop remains present until explicitly retired."],
              context: {
                workflowProgress: {
                  completionReady: true,
                  reason: "feature-reference loop has no active refill work",
                  pending: 0,
                  running: 0,
                },
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    expect(() =>
      rollupParent(config(projectDir), {
        parentId: "project",
        summary: "incorrectly archive durable loop",
        taskIds: ["aks-feature-reference-loop"],
      }),
    ).toThrow(/durable loop root/);

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["aks-feature-reference-loop"]).toBeDefined();
    expect(tree.tasks.project.children).toEqual(["aks-feature-reference-loop"]);
  });

  test("repair-rollups reopens durable loop roots with incomplete progress", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["aks-feature-reference-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-feature-reference-loop": {
              id: "aks-feature-reference-loop",
              parent_id: "project",
              state: "done",
              status: "done",
              workflow: "feature-reference-loop-controller",
              priority: "P1",
              children: [],
              goal: "Keep official feature references current.",
              outputs: [".state/feature-reference-loop/state.json"],
              acceptance: ["Loop remains present until explicitly retired."],
              context: {
                workflowProgress: {
                  completionReady: false,
                  reason: "feature-reference loop state still has work",
                  pending: 26,
                  running: 164,
                },
              },
              resolution: "completed",
              done_at: "2026-06-29T00:00:00.000Z",
              done_by: "task-tree-tool",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = repairTaskTreeRollups(config(projectDir));

    expect(result.reopenedDurableLoopRoots).toEqual([
      "aks-feature-reference-loop",
    ]);
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    const task = tree.tasks["aks-feature-reference-loop"];
    expect(task.state).toBe("backlog");
    expect(task.status ?? task.state).toBe("backlog");
    expect(task.blocker).toBeUndefined();
    expect(task.done_at).toBeUndefined();
    expect(task.resolution).toBeUndefined();
    expect(task.trace.reopened_by).toBe("task-tree-repair");
  });

  test("repair-rollups leaves incomplete durable loop roots reopened after generic rollup repair", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "review",
              status: "review",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["wait-spec-external-signal", "review-followup"],
              goal: "Keep spec verification moving.",
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop stays truthful."],
              context: {
                workflowProgress: {
                  completionReady: false,
                  reason:
                    "spec-loop frontier remains narrow while residue is still nonterminal",
                  pending: 172,
                  running: 0,
                  unrepresentedNonTerminalCount: 0,
                  blockedWaitChildren: 1,
                  openChildren: 1,
                  activeChildren: 0,
                  reviewChildren: 1,
                  waitingChildren: 0,
                  backlogChildren: 0,
                },
              },
              result: "Waiting for child review.",
            },
            "wait-spec-external-signal": {
              id: "wait-spec-external-signal",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              status: "blocked",
              goal: "Wait for exact signal.",
              outputs: ["evidence/archive/wait-spec.md"],
              acceptance: ["Signal returned"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
            "review-followup": {
              id: "review-followup",
              parent_id: "aks-spec-verification-loop",
              state: "review",
              status: "review",
              goal: "Review exact follow-up.",
              outputs: ["evidence/archive/review.md"],
              acceptance: ["Reviewed"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = repairTaskTreeRollups(config(projectDir));

    expect(result.reopenedDurableLoopRoots).toEqual([
      "aks-spec-verification-loop",
    ]);
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    const task = tree.tasks["aks-spec-verification-loop"];
    expect(task.trace.reopened_by).toBe("task-tree-repair");
    expect(summarizeTaskTree(config(projectDir)).frontier.review).toEqual([
      "review-followup",
    ]);
  });

  test("repair-rollups reopens stale durable wait roots that omit unrepresented residue", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["wait-spec-external-signal"],
              goal: "Keep spec verification moving.",
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop stays truthful."],
              context: {
                workflowProgress: {
                  completionReady: false,
                  noRefillNow: true,
                  reason:
                    "old controller snapshot reported exact waits before unrepresented counts existed",
                  pending: 123,
                  running: 0,
                  blockedWaitChildren: 1,
                  openChildren: 0,
                  openSpecVerifierChildren: 0,
                  openFollowups: 0,
                  activeChildren: 0,
                  reviewChildren: 0,
                  waitingChildren: 0,
                  backlogChildren: 0,
                },
              },
            },
            "wait-spec-external-signal": {
              id: "wait-spec-external-signal",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              status: "blocked",
              goal: "Wait for exact signal.",
              outputs: ["evidence/archive/wait-spec.md"],
              acceptance: ["Signal returned"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = repairTaskTreeRollups(config(projectDir));

    // SDK rollup promotes blocked->backlog before durable-loop reopen runs,
    // so reopenedDurableLoopRoots may be empty (already promoted by SDK).
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    const task = tree.tasks["aks-spec-verification-loop"];
    expect(task.state).toBe("backlog");
    expect(task.blocker).toBeUndefined();
  });

  test("repair-rollups preserves blocked-only durable loop wait stewardship roots", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: [
                "aks-feature-compact-loop",
                "aks-spec-verification-loop",
              ],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-feature-compact-loop": {
              id: "aks-feature-compact-loop",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              workflow: "feature-compact-loop-controller",
              priority: "P1",
              children: ["wait-compact-external-signal"],
              goal: "Keep compact loop moving.",
              outputs: [".state/feature-compact-loop/state.json"],
              acceptance: ["Loop is current"],
              context: {
                workflowProgress: {
                  completionReady: false,
                  dispatchHeld: true,
                  dispatchHold:
                    "feature-compact loop live dispatch held because 1 GitHub workflow run(s) are already in progress on dev; limit=1",
                  reason:
                    "feature-compact loop live dispatch held because 1 GitHub workflow run(s) are already in progress on dev; limit=1",
                  pending: 5,
                  running: 0,
                  error: 69,
                  unrepresentedNonTerminalCount: 0,
                  blockedWaitChildren: 1,
                  openChildren: 0,
                  openSupportChildren: 0,
                  activeGithubRuns: 1,
                  githubActiveRunLimit: 1,
                },
              },
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["wait-spec-external-signal"],
              goal: "Keep spec verification moving.",
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop stays truthful."],
              context: {
                workflowProgress: {
                  completionReady: false,
                  noRefillNow: true,
                  reason:
                    "spec-loop execution residue is drained and the remaining frontier is exact wait stewardship: 0 active child leaf/leaves, 0 review child leaf/leaves, 0 waiting child leaf/leaves, 0 backlog child leaf/leaves, 1 blocked wait leaf/leaves, 0 backlog follow-up leaf/leaves",
                  pending: 123,
                  running: 0,
                  unrepresentedNonTerminalCount: 0,
                  blockedWaitChildren: 1,
                  openChildren: 0,
                  openSpecVerifierChildren: 0,
                  openFollowups: 0,
                  activeChildren: 0,
                  reviewChildren: 0,
                  waitingChildren: 0,
                  backlogChildren: 0,
                },
              },
            },
            "wait-compact-external-signal": {
              id: "wait-compact-external-signal",
              parent_id: "aks-feature-compact-loop",
              state: "blocked",
              status: "blocked",
              goal: "Wait for exact signal.",
              outputs: ["evidence/archive/wait-compact.md"],
              acceptance: ["Signal returned"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
            "wait-spec-external-signal": {
              id: "wait-spec-external-signal",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              status: "blocked",
              goal: "Wait for exact signal.",
              outputs: ["evidence/archive/wait-spec.md"],
              acceptance: ["Signal returned"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = repairTaskTreeRollups(config(projectDir));

    expect(result.reopenedDurableLoopRoots).toEqual([]);
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["aks-feature-compact-loop"].state).toBe("blocked");
    expect(tree.tasks["aks-spec-verification-loop"].state).toBe("blocked");
    expect(tree.tasks["aks-feature-compact-loop"].blocker).toBeUndefined();
    expect(tree.tasks["aks-spec-verification-loop"].blocker).toBeUndefined();
    expect(
      tree.tasks["aks-feature-compact-loop"].trace?.reopened_by,
    ).toBeUndefined();
    expect(
      tree.tasks["aks-spec-verification-loop"].trace?.reopened_by,
    ).toBeUndefined();
  });

  test("repair-rollups preserves durable loop child-blocked stewardship when progress open counters are stale", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["aks-feature-compact-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-feature-compact-loop": {
              id: "aks-feature-compact-loop",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              workflow: "feature-compact-loop-controller",
              priority: "P1",
              children: ["wait-compact-external-signal"],
              goal: "Keep compact loop moving.",
              outputs: [".state/feature-compact-loop/state.json"],
              acceptance: ["Loop is current"],
              context: {
                workflowProgress: {
                  completionReady: false,
                  reason:
                    "feature-compact loop state still has non-terminal features",
                  pending: 0,
                  running: 0,
                  error: 3,
                  unrepresentedNonTerminalCount: 0,
                  openChildren: 0,
                  openSupportChildren: 1,
                  blockedWaitChildren: 1,
                },
              },
            },
            "wait-compact-external-signal": {
              id: "wait-compact-external-signal",
              parent_id: "aks-feature-compact-loop",
              state: "blocked",
              status: "blocked",
              goal: "Wait for exact signal.",
              outputs: ["evidence/archive/wait.md"],
              acceptance: ["Signal returned"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = repairTaskTreeRollups(config(projectDir));

    expect(result.reopenedDurableLoopRoots).toEqual([]);
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["aks-feature-compact-loop"].state).toBe("blocked");
    expect(
      tree.tasks["aks-feature-compact-loop"].trace?.reopened_by,
    ).toBeUndefined();
  });

  test("repair-rollups reblocks review roots after refreshing stale spec-loop child counters", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "review",
              status: "review",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["wait-spec-external-signal"],
              goal: "Keep spec verification moving.",
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop stays truthful."],
              context: {
                workflowProgress: {
                  completionReady: false,
                  reason:
                    "spec-loop frontier remains narrow while residue is still nonterminal: 1 active child leaf/leaves, 0 review child leaf/leaves, 0 waiting child leaf/leaves, 0 backlog child leaf/leaves, 1 blocked wait leaf/leaves, 0 backlog follow-up leaf/leaves; residue pending=42 (dispatchable=0, stranded=42), residue running=0, residue error=0, residue fail=0",
                  pending: 42,
                  dispatchablePending: 0,
                  strandedPending: 42,
                  running: 0,
                  activeChildren: 1,
                  reviewChildren: 0,
                  waitingChildren: 0,
                  backlogChildren: 0,
                  openChildren: 1,
                  openSpecVerifierChildren: 0,
                  openFollowups: 0,
                  blockedWaitChildren: 1,
                  unrepresentedNonTerminalCount: 0,
                },
              },
            },
            "wait-spec-external-signal": {
              id: "wait-spec-external-signal",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              status: "blocked",
              goal: "Wait for exact signal.",
              outputs: ["evidence/archive/wait-spec.md"],
              acceptance: ["Signal returned"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = repairTaskTreeRollups(config(projectDir));

    expect(result.reopenedDurableLoopRoots).toEqual([
      "aks-spec-verification-loop",
    ]);
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["aks-spec-verification-loop"]).toMatchObject({
      state: "blocked",
      blocker: {
        category: "child-blocked",
      },
      context: {
        workflowProgress: {
          activeChildren: 0,
          openChildren: 0,
          blockedWaitChildren: 1,
          noRefillNow: true,
          reason:
            "spec-loop execution is drained and the remaining frontier is exact wait stewardship: 0 active child leaf/leaves, 0 review child leaf/leaves, 0 waiting child leaf/leaves, 0 backlog child leaf/leaves, 1 blocked wait leaf/leaves, 0 backlog follow-up leaf/leaves; stranded pending=42",
        },
      },
    });
  });

  test("repair-rollups refreshes child-blocked parent result text", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["focus"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            focus: {
              id: "focus",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              priority: "P1",
              children: ["done-child", "wait-child"],
              goal: "Keep focus truthful.",
              outputs: ["tasks/tree.json"],
              acceptance: ["wait is explicit"],
              result: "Child review pending: done-child.",
              blocker: {
                condition: "Child blocked: wait-child.",
                category: "child-blocked",
              },
            },
            "done-child": {
              id: "done-child",
              parent_id: "focus",
              state: "done",
              status: "done",
              goal: "Already accepted.",
              outputs: ["evidence/archive/done.md"],
              acceptance: ["done"],
            },
            "wait-child": {
              id: "wait-child",
              parent_id: "focus",
              state: "blocked",
              status: "blocked",
              goal: "Wait for exact signal.",
              outputs: ["evidence/archive/wait.md"],
              acceptance: ["signal returned"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    repairTaskTreeRollups(config(projectDir));

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks.focus.result).toBe(
      "Blocked on child task(s): wait-child.",
    );
  });

  test("repair-rollups refreshes stale child-review result text after review children were archived", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "active",
              status: "active",
              children: ["normalization-frontier"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "normalization-frontier": {
              id: "normalization-frontier",
              parent_id: "project",
              state: "review",
              status: "review",
              children: ["publication-holder", "ado-wait-a", "ado-wait-b"],
              goal: "Keep the direct-normalization frontier truthful.",
              outputs: ["tasks/tree.json"],
              acceptance: ["frontier reflects live waits"],
              context: {
                rollup_summary:
                  "No live review children remain; next motion comes from the publication holder or exact ADO waits.",
              },
              result:
                "Child review pending: archived-review-a, archived-review-b.",
            },
            "publication-holder": {
              id: "publication-holder",
              parent_id: "normalization-frontier",
              state: "blocked",
              status: "blocked",
              goal: "Hold downstream publication until the dependency clears.",
              outputs: ["evidence/archive/publication-holder.md"],
              acceptance: ["dependency clears"],
              blocker: {
                condition: "wait for publication dependency",
                category: "external-wait",
              },
            },
            "ado-wait-a": {
              id: "ado-wait-a",
              parent_id: "normalization-frontier",
              state: "blocked",
              status: "blocked",
              goal: "Wait for exact ADO result A.",
              outputs: ["evidence/archive/ado-a.md"],
              acceptance: ["result returns"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
            "ado-wait-b": {
              id: "ado-wait-b",
              parent_id: "normalization-frontier",
              state: "blocked",
              status: "blocked",
              goal: "Wait for exact ADO result B.",
              outputs: ["evidence/archive/ado-b.md"],
              acceptance: ["result returns"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = repairTaskTreeRollups(config(projectDir));

    expect(result.repairedChildReviewParentResults).toContain(
      "normalization-frontier",
    );
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["normalization-frontier"].result).toBe(
      "Blocked on child task(s): publication-holder, ado-wait-a, ado-wait-b.",
    );
  });

  test("repair-rollups refreshes parent result text that still uses blocked-child wording after replacement", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "active",
              status: "active",
              children: ["loop", "old-wait", "new-wait"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
              result: "Blocked on child task(s): old-wait, new-wait.",
            },
            loop: {
              id: "loop",
              parent_id: "project",
              state: "review",
              status: "review",
              children: ["spec-wait"],
              goal: "loop",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
              result: "Blocked on child task(s): spec-old-wait, spec-wait.",
            },
            "old-wait": {
              id: "old-wait",
              parent_id: "project",
              state: "done",
              status: "done",
              goal: "old wait replaced",
              outputs: ["evidence/archive/old.md"],
              acceptance: ["done"],
              resolution: "replaced",
            },
            "new-wait": {
              id: "new-wait",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              goal: "current wait",
              outputs: ["evidence/archive/new.md"],
              acceptance: ["wait"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
            "spec-old-wait": {
              id: "spec-old-wait",
              parent_id: "loop",
              state: "done",
              status: "done",
              goal: "spec wait replaced",
              outputs: ["evidence/archive/spec-old.md"],
              acceptance: ["done"],
              resolution: "replaced",
            },
            "spec-wait": {
              id: "spec-wait",
              parent_id: "loop",
              state: "blocked",
              status: "blocked",
              goal: "spec current wait",
              outputs: ["evidence/archive/spec-new.md"],
              acceptance: ["wait"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = repairTaskTreeRollups(config(projectDir));

    expect(result.repairedChildBlockedParentResults).toEqual(
      expect.arrayContaining(["project", "loop"]),
    );
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks.project.result).toBe(
      "Blocked on child task(s): new-wait.",
    );
    expect(tree.tasks.loop.result).toBe("Blocked on child task(s): spec-wait.");
  });

  test("reopenControllerRootWhenIncomplete adds observer and fallback metadata for child-blocked stewardship", () => {
    const task = {
      id: "aks-spec-verification-loop",
      owner: "aks-explorer",
      workflow: "spec-loop-controller",
      state: "review",
      status: "review",
      children: ["wait-alpha", "wait-beta"],
      trace: {},
    } as any;
    const progress: Record<string, unknown> = {
      completionReady: false,
      noRefillNow: true,
      reason:
        "spec-loop execution is drained and the remaining frontier is exact wait stewardship",
      blockedWaitChildren: 2,
      unrepresentedNonTerminalCount: 0,
      running: 0,
      openChildren: 0,
      openSpecVerifierChildren: 0,
      openFollowups: 0,
      activeChildren: 0,
      reviewChildren: 0,
      waitingChildren: 0,
      backlogChildren: 0,
    };

    const reopened = reopenControllerRootWhenIncomplete({
      task,
      progress,
      reason: "controller root must stay blocked as an exact wait steward",
    });

    expect(reopened).toBe(true);
    expect(task.state).toBe("blocked");
    expect(task.blocker).toMatchObject({
      category: "child-blocked",
      waiting_for: {
        type: "child.task.blocked",
        taskId: "aks-spec-verification-loop",
        childTaskIds: ["wait-alpha", "wait-beta"],
      },
      observed_by: {
        workflow: "spec-loop-controller",
        trigger: "project.task.tick",
      },
    });
    expect(
      (task.blocker as Record<string, unknown>).next_check_at,
    ).toBeTruthy();
    expect((task.blocker as Record<string, unknown>).fallback_at).toBeTruthy();
    expect(
      (task.blocker as Record<string, unknown>).fallback_action,
    ).toBeTruthy();
  });

  test("repair-rollups reopens blocked durable loop root when a child is active", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: "active-spec-followup",
          active_task_ids: ["active-spec-followup"],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["wait-spec-external-signal", "active-spec-followup"],
              goal: "Keep spec verification moving.",
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop stays truthful."],
              context: {
                workflowProgress: {
                  completionReady: false,
                  noRefillNow: true,
                  reason:
                    "spec-loop execution residue is drained and the remaining frontier is exact wait stewardship",
                  unrepresentedNonTerminalCount: 0,
                  blockedWaitChildren: 1,
                  activeChildren: 0,
                  reviewChildren: 0,
                  backlogChildren: 0,
                },
              },
            },
            "wait-spec-external-signal": {
              id: "wait-spec-external-signal",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              status: "blocked",
              goal: "Wait for exact signal.",
              outputs: ["evidence/archive/wait-spec.md"],
              acceptance: ["Signal returned"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
            "active-spec-followup": {
              id: "active-spec-followup",
              parent_id: "aks-spec-verification-loop",
              state: "active",
              status: "active",
              goal: "Repair a spec.",
              outputs: ["evidence/archive/active-spec.md"],
              acceptance: ["Repair reviewed"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = repairTaskTreeRollups(config(projectDir));

    expect(result.reopenedDurableLoopRoots).toEqual([
      "aks-spec-verification-loop",
    ]);
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["aks-spec-verification-loop"].state).toBe("backlog");
    expect(tree.tasks["aks-spec-verification-loop"].blocker).toBeUndefined();
    expect(tree.tasks["aks-spec-verification-loop"].trace?.reopened_by).toBe(
      "task-tree-repair",
    );
  });

  test("suppresses runnable durable loop roots when active children already carry the live spec frontier", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: "active-spec-followup",
          active_task_ids: ["active-spec-followup"],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["wait-spec-external-signal", "active-spec-followup"],
              goal: "Keep spec verification moving.",
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop stays truthful."],
              context: {
                workflowProgress: {
                  completionReady: false,
                  reason:
                    "spec-loop frontier remains narrow while residue is still nonterminal: 1 active child leaf/leaves, 0 review child leaf/leaves, 0 waiting child leaf/leaves, 0 backlog child leaf/leaves, 1 blocked wait leaf/leaves, 0 backlog follow-up leaf/leaves; residue pending=42 (dispatchable=0, stranded=42), residue running=0, residue error=0, residue fail=0",
                  pending: 42,
                  dispatchablePending: 0,
                  strandedPending: 42,
                  running: 0,
                  activeChildren: 1,
                  reviewChildren: 0,
                  waitingChildren: 0,
                  backlogChildren: 0,
                  openChildren: 1,
                  openSpecVerifierChildren: 0,
                  openFollowups: 0,
                  blockedWaitChildren: 1,
                  unrepresentedNonTerminalCount: 0,
                },
              },
            },
            "wait-spec-external-signal": {
              id: "wait-spec-external-signal",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              status: "blocked",
              goal: "Wait for exact signal.",
              outputs: ["evidence/archive/wait-spec.md"],
              acceptance: ["Signal returned"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
            "active-spec-followup": {
              id: "active-spec-followup",
              parent_id: "aks-spec-verification-loop",
              state: "active",
              status: "active",
              goal: "Repair a spec.",
              outputs: ["evidence/archive/active-spec.md"],
              acceptance: ["Repair reviewed"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    repairTaskTreeRollups(config(projectDir));

    const summary = summarizeTaskTree(config(projectDir));
    expect(summary.frontier.runnable).toEqual([]);
    expect(summary.frontier.active).toEqual(["active-spec-followup"]);

    expect(confirmRunnableBacklogLeaves(config(projectDir), 10)).toEqual([]);

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["aks-spec-verification-loop"].state).toBe("backlog");
    expect(
      tree.tasks["aks-spec-verification-loop"].trace?.promoted_by,
    ).toBeUndefined();
  });

  test("repair-rollups preserves blocked-only durable loop wait stewardship roots even with active/review/waiting/backlog counters explicitly zero", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: [
                "aks-feature-compact-loop",
                "aks-spec-verification-loop",
              ],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-feature-compact-loop": {
              id: "aks-feature-compact-loop",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              workflow: "feature-compact-loop-controller",
              priority: "P1",
              children: ["wait-compact-external-signal"],
              goal: "Keep compact loop moving.",
              outputs: [".state/feature-compact-loop/state.json"],
              acceptance: ["Loop is current"],
              context: {
                workflowProgress: {
                  completionReady: false,
                  dispatchHeld: true,
                  reason:
                    "feature-compact loop live dispatch held because residue remains but the child frontier is exact blocked waits only",
                  pending: 9,
                  running: 0,
                  error: 66,
                  unrepresentedNonTerminalCount: 0,
                  blockedWaitChildren: 1,
                  openChildren: 0,
                  openSupportChildren: 0,
                  activeChildren: 0,
                  reviewChildren: 0,
                  waitingChildren: 0,
                  backlogChildren: 0,
                },
              },
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["wait-spec-external-signal"],
              goal: "Keep spec verification moving.",
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop stays truthful."],
              context: {
                workflowProgress: {
                  completionReady: false,
                  noRefillNow: true,
                  reason:
                    "spec-loop execution residue is drained and the remaining frontier is exact wait stewardship",
                  pending: 123,
                  running: 0,
                  unrepresentedNonTerminalCount: 0,
                  blockedWaitChildren: 1,
                  openChildren: 0,
                  openSpecVerifierChildren: 0,
                  openFollowups: 0,
                  activeChildren: 0,
                  reviewChildren: 0,
                  waitingChildren: 0,
                  backlogChildren: 0,
                },
              },
            },
            "wait-compact-external-signal": {
              id: "wait-compact-external-signal",
              parent_id: "aks-feature-compact-loop",
              state: "blocked",
              status: "blocked",
              goal: "Wait for exact signal.",
              outputs: ["evidence/archive/wait-compact.md"],
              acceptance: ["Signal returned"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
            "wait-spec-external-signal": {
              id: "wait-spec-external-signal",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              status: "blocked",
              goal: "Wait for exact signal.",
              outputs: ["evidence/archive/wait-spec.md"],
              acceptance: ["Signal returned"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = repairTaskTreeRollups(config(projectDir));

    expect(result.reopenedDurableLoopRoots).toEqual([]);
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["aks-feature-compact-loop"].state).toBe("blocked");
    expect(tree.tasks["aks-spec-verification-loop"].state).toBe("blocked");
    expect(
      tree.tasks["aks-feature-compact-loop"].trace?.reopened_by,
    ).toBeUndefined();
    expect(
      tree.tasks["aks-spec-verification-loop"].trace?.reopened_by,
    ).toBeUndefined();
  });

  test("assigns incomplete non-leaf workflow controller roots", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["aks-feature-compact-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-feature-compact-loop": {
              id: "aks-feature-compact-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "feature-compact-loop-controller",
              priority: "P1",
              children: ["wait-compact-external-signal"],
              goal: "Keep compact loop moving.",
              outputs: [".state/feature-compact-loop/state.json"],
              acceptance: ["Loop is current"],
              context: {
                workflowProgress: {
                  completionReady: false,
                  reason: "feature-compact loop still has non-terminal work",
                  pending: 3,
                  running: 0,
                },
              },
            },
            "wait-compact-external-signal": {
              id: "wait-compact-external-signal",
              parent_id: "aks-feature-compact-loop",
              state: "blocked",
              status: "blocked",
              goal: "Wait for exact signal.",
              outputs: ["evidence/archive/wait.md"],
              acceptance: ["Signal returned"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const assignment = assignTask(config(projectDir), {
      taskId: "aks-feature-compact-loop",
    });

    expect(assignment.taskId).toBe("aks-feature-compact-loop");
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["aks-feature-compact-loop"].state).toBe("active");
    expect(tree.active_task_ids).toEqual(["aks-feature-compact-loop"]);
  });

  test("suppresses paused durable controllers from runnable backlog", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
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
              priority: "P1",
              children: ["wait-feature-reference-signal"],
              goal: "Keep official feature references current.",
              outputs: [".state/feature-reference-loop/state.json"],
              acceptance: ["Loop remains present until explicitly retired."],
              context: {
                workflowProgress: {
                  completionReady: false,
                  reason:
                    "feature-reference loop has no active refill work; dormant backlog is preserved outside the workflow guard path",
                  pending: 0,
                  running: 0,
                  holdMode: "dormant-backlog-preserved",
                  noRefillNow: true,
                },
              },
            },
            "wait-feature-reference-signal": {
              id: "wait-feature-reference-signal",
              parent_id: "aks-feature-reference-loop",
              state: "blocked",
              status: "blocked",
              goal: "Wait for exact source refresh signal.",
              outputs: ["evidence/archive/wait-feature-reference.md"],
              acceptance: ["Signal returned"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    expect(() =>
      assignTask(config(projectDir), {
        taskId: "aks-feature-reference-loop",
      }),
    ).toThrow(/not a leaf/);
  });

  test("suppresses active durable loop roots from frontier.active when an active descendant already carries live work", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: "leaf-review-fix",
          active_task_ids: ["leaf-review-fix"],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: ["aks-feature-compact-loop", "leaf-review-fix"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-feature-compact-loop": {
              id: "aks-feature-compact-loop",
              parent_id: "project",
              state: "active",
              status: "active",
              workflow: "feature-compact-loop-controller",
              priority: "P1",
              children: ["hold-compact-split-frontier"],
              goal: "Keep compact loop moving.",
              outputs: [".state/feature-compact-loop/state.json"],
              acceptance: ["Loop remains truthful."],
              context: {
                workflowProgress: {
                  completionReady: false,
                  reason:
                    "feature-compact loop still has represented non-terminal work",
                  pending: 0,
                  running: 0,
                  blocked: 1,
                  unrepresentedNonTerminalCount: 0,
                  openChildren: 0,
                  openSupportChildren: 1,
                  blockedWaitChildren: 1,
                },
              },
            },
            "hold-compact-split-frontier": {
              id: "hold-compact-split-frontier",
              parent_id: "aks-feature-compact-loop",
              state: "active",
              status: "active",
              children: ["leaf-review-fix"],
              goal: "Represent one exact active successor slice.",
              outputs: ["evidence/archive/compact-split.md"],
              acceptance: ["exact slice remains visible"],
            },
            "leaf-review-fix": {
              id: "leaf-review-fix",
              parent_id: "hold-compact-split-frontier",
              state: "active",
              status: "active",
              children: [],
              goal: "Do the live exact repair slice.",
              outputs: ["evidence/archive/live-fix.md"],
              acceptance: ["fix completed"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const summary = summarizeTaskTree(config(projectDir));
    expect(summary.frontier.active).toEqual(["leaf-review-fix"]);
  });

  test("suppresses dispatch-held compact loop roots from runnable frontier while review backlog remains represented", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["aks-feature-compact-loop", "regular-backlog-fix"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-feature-compact-loop": {
              id: "aks-feature-compact-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "feature-compact-loop-controller",
              priority: "P1",
              children: [
                "domain/compact-ready-subset-review",
                "wait-compact-external-signal",
              ],
              goal: "Keep compact loop moving.",
              outputs: [".state/feature-compact-loop/state.json"],
              acceptance: ["Loop remains truthful."],
              context: {
                workflowProgress: {
                  completionReady: false,
                  dispatchHeld: true,
                  reason:
                    "feature-compact loop live dispatch held because review/application backlog is still open",
                  pending: 0,
                  running: 0,
                  blocked: 1,
                  error: 0,
                  unrepresentedNonTerminalCount: 0,
                  openChildren: 0,
                  openSupportChildren: 1,
                  blockedWaitChildren: 1,
                },
              },
            },
            "domain/compact-ready-subset-review": {
              id: "domain/compact-ready-subset-review",
              parent_id: "aks-feature-compact-loop",
              state: "review",
              status: "review",
              children: [],
              goal: "Review the returned compact subset evidence.",
              outputs: ["evidence/archive/compact-review.md"],
              acceptance: ["reviewed"],
            },
            "wait-compact-external-signal": {
              id: "wait-compact-external-signal",
              parent_id: "aks-feature-compact-loop",
              state: "blocked",
              status: "blocked",
              children: [],
              goal: "Wait for exact signal.",
              outputs: ["evidence/archive/wait.md"],
              acceptance: ["Signal returned"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
            "regular-backlog-fix": {
              id: "regular-backlog-fix",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              children: [],
              goal: "Normal runnable backlog work.",
              outputs: ["evidence/archive/regular-backlog-fix.md"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const summary = summarizeTaskTree(config(projectDir));
    expect(summary.frontier.runnable).toEqual(["regular-backlog-fix"]);

    const packet = planningPacket(config(projectDir));
    expect(packet.frontier.runnable).toEqual(["regular-backlog-fix"]);
    expect(packet.frontier_details.runnable.map((task) => task.id)).toEqual([
      "regular-backlog-fix",
    ]);
    expect(packet.frontier.review).toEqual([
      "domain/compact-ready-subset-review",
    ]);

    expect(listRunnableBacklogTaskIds(config(projectDir), 10)).toEqual([
      "regular-backlog-fix",
    ]);
    expect(confirmRunnableBacklogLeaves(config(projectDir), 10)).toEqual([
      "regular-backlog-fix",
    ]);

    const updatedTree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(
      updatedTree.tasks["aks-feature-compact-loop"].trace?.promoted_by,
    ).toBeUndefined();
    expect(updatedTree.tasks["regular-backlog-fix"].trace?.promoted_by).toBe(
      "task-tree-tool",
    );
  });

  test("explains structural active contributors when tree_counts.active exceeds live active leaves", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: "leaf-fix",
          active_task_ids: ["leaf-fix"],
          tasks: {
            project: {
              id: "project",
              state: "active",
              owner: "aks-explorer",
              children: ["leaf-fix"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "leaf-fix": {
              id: "leaf-fix",
              parent_id: "project",
              state: "active",
              status: "active",
              children: [],
              goal: "repair active parity evidence",
              outputs: ["evidence/archive/leaf-fix.md"],
              acceptance: ["done"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const summary = summarizeTaskTree(config(projectDir)) as {
      tree_counts: Record<string, number>;
      counts: Record<string, number>;
      frontier: { active: string[] };
      active_structural_task_ids?: string[];
      active_structural_tasks?: Array<{
        id: string;
        owner: string | null;
        state: string;
      }>;
      active_count_explanation?: string;
    };
    expect(summary.tree_counts.active).toBe(2);
    expect(summary.counts.active).toBe(1);
    expect(summary.frontier.active).toEqual(["leaf-fix"]);
    expect(summary.active_structural_task_ids).toEqual(["project"]);
    expect(summary.active_structural_tasks).toEqual([
      expect.objectContaining({
        id: "project",
        owner: "aks-explorer",
        state: "active",
      }),
    ]);
    expect(summary.active_count_explanation).toContain(
      "project(owner=aks-explorer)",
    );
    expect(summary.active_count_explanation).toContain("tree_counts.active");
  });

  test("explains structural backlog contributors when tree_counts.backlog exceeds executable backlog leaves", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["aks-feature-compact-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-feature-compact-loop": {
              id: "aks-feature-compact-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "feature-compact-loop-controller",
              children: ["wait-compact-external-signal"],
              goal: "Keep compact loop moving.",
              outputs: [".state/feature-compact-loop/state.json"],
              acceptance: ["Loop stays truthful."],
              context: {
                workflowProgress: {
                  completionReady: false,
                  noRefillNow: true,
                  pending: 0,
                  running: 0,
                  blocked: 1,
                  error: 0,
                  retryBudgetExhausted: 0,
                  unrepresentedNonTerminalCount: 0,
                  openChildren: 0,
                  openSupportChildren: 0,
                  blockedWaitChildren: 1,
                },
              },
            },
            "wait-compact-external-signal": {
              id: "wait-compact-external-signal",
              parent_id: "aks-feature-compact-loop",
              state: "blocked",
              status: "blocked",
              children: [],
              goal: "Wait for exact signal.",
              outputs: ["evidence/archive/wait-compact.md"],
              acceptance: ["Signal returned"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const summary = summarizeTaskTree(config(projectDir)) as {
      tree_counts: Record<string, number>;
      counts: Record<string, number>;
      frontier: { runnable: string[]; waiting: string[] };
      backlog_structural_task_ids?: string[];
      backlog_count_explanation?: string;
    };
    expect(summary.tree_counts.backlog).toBe(2);
    expect(summary.counts.backlog).toBe(0);
    expect(summary.frontier.runnable).toEqual([]);
    expect(summary.frontier.waiting).toEqual([]);
    expect(summary.backlog_structural_task_ids).toEqual([
      "aks-feature-compact-loop",
      "project",
    ]);
    expect(summary.backlog_count_explanation).toContain(
      "aks-feature-compact-loop",
    );
    expect(summary.backlog_count_explanation).toContain(
      "frontier.runnable + frontier.waiting",
    );
  });

  test("suppresses blocked structural durable loop roots and explains blocked count parity", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["wait-spec-external-signal"],
              goal: "Keep spec verification moving.",
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop stays truthful."],
              context: {
                workflowProgress: {
                  completionReady: false,
                  noRefillNow: true,
                  reason:
                    "spec-loop execution is drained and the remaining frontier is exact wait stewardship",
                  pending: 1,
                  running: 0,
                  unrepresentedNonTerminalCount: 0,
                  blockedWaitChildren: 1,
                  openChildren: 0,
                  openSpecVerifierChildren: 0,
                  openFollowups: 0,
                  activeChildren: 0,
                  reviewChildren: 0,
                  waitingChildren: 0,
                  backlogChildren: 0,
                },
              },
            },
            "wait-spec-external-signal": {
              id: "wait-spec-external-signal",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              status: "blocked",
              children: [],
              goal: "Wait for exact signal.",
              outputs: ["evidence/archive/wait-spec.md"],
              acceptance: ["Signal returned"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const summary = summarizeTaskTree(config(projectDir)) as {
      tree_counts: Record<string, number>;
      counts: Record<string, number>;
      frontier: { blocked: string[] };
      blocked_structural_task_ids?: string[];
      blocked_count_explanation?: string;
    };
    expect(summary.tree_counts.blocked).toBe(2);
    expect(summary.counts.blocked).toBe(1);
    expect(summary.frontier.blocked).toEqual(["wait-spec-external-signal"]);
    expect(summary.frontier.blocked).not.toContain(
      "aks-spec-verification-loop",
    );
    expect(summary.blocked_structural_task_ids).toEqual([
      "aks-spec-verification-loop",
    ]);
    expect(summary.blocked_count_explanation).toContain(
      "aks-spec-verification-loop",
    );
    expect(summary.blocked_count_explanation).toContain("tree_counts.blocked");

    const packet = planningPacket(config(projectDir));
    expect(packet.frontier.blocked).toEqual(["wait-spec-external-signal"]);
  });

  test("repair-rollups converts hidden focus-plan approval backlog into a blocked approval wait", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["focus-hidden-backlog"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "focus-hidden-backlog": {
              id: "focus-hidden-backlog",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              kind: "focus_plan",
              goal: "Propose the next focus mission.",
              outputs: ["evidence/archive/focus-hidden-backlog.md"],
              acceptance: ["Owner reviews the plan."],
              context: {
                needs_approval: true,
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const before = summarizeTaskTree(config(projectDir));
    expect(before.counts.backlog).toBe(1);
    expect(before.frontier.runnable).toEqual([]);
    expect(before.frontier.waiting).toEqual([]);
    expect(confirmRunnableBacklogLeaves(config(projectDir), 10)).toEqual([]);

    const result = repairTaskTreeRollups(config(projectDir));
    expect(result.repairedLegacyFocusApprovalStates).toEqual([
      "focus-hidden-backlog",
    ]);

    const after = summarizeTaskTree(config(projectDir));
    expect(after.counts.backlog).toBe(0);
    expect(after.frontier.runnable).toEqual([]);
    expect(after.frontier.waiting).toEqual([]);
    expect(after.frontier.blocked).toEqual(["focus-hidden-backlog"]);
    expect(confirmRunnableBacklogLeaves(config(projectDir), 10)).toEqual([]);

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(tree.tasks["focus-hidden-backlog"].state).toBe("blocked");
    expect(tree.tasks["focus-hidden-backlog"].blocker).toMatchObject({
      category: "human-approval",
      owner: "human",
      waiting_for: {
        type: "project.approval.submitted",
        taskId: "focus-hidden-backlog",
      },
    });
    expect(
      tree.tasks["focus-hidden-backlog"].context
        ?.approval_wait_normalization_note,
    ).toContain("stale hidden backlog state");
  });

  test("repair-rollups reopens spec-loop stranded exhausted residue", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["wait-spec-external-signal"],
              goal: "Keep spec verification moving.",
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop stays truthful."],
              context: {
                workflowProgress: {
                  completionReady: false,
                  executionDrained: true,
                  noRefillNow: true,
                  strandedExhaustedResidueOnly: true,
                  reason:
                    "spec-loop execution is drained and only exact blocked waits plus stranded exhausted residue remain",
                  pending: 123,
                  dispatchablePending: 0,
                  strandedPending: 123,
                  running: 0,
                  error: 203,
                  retryBudgetExhausted: 203,
                  unrepresentedNonTerminalCount: 203,
                  blockedWaitChildren: 1,
                  openChildren: 0,
                  openSpecVerifierChildren: 0,
                  openFollowups: 0,
                  activeChildren: 0,
                  reviewChildren: 0,
                  waitingChildren: 0,
                  backlogChildren: 0,
                },
              },
            },
            "wait-spec-external-signal": {
              id: "wait-spec-external-signal",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              status: "blocked",
              goal: "Wait for exact signal.",
              outputs: ["evidence/archive/wait-spec.md"],
              acceptance: ["Signal returned"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = repairTaskTreeRollups(config(projectDir));

    // SDK rollup promotes blocked->backlog before durable-loop reopen runs
    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    const task = tree.tasks["aks-spec-verification-loop"];
    expect(task.state).toBe("backlog");
    expect(task.blocker).toBeUndefined();
  });
});
