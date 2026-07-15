import { projectRuntimePaths, resolveTaskTreePath } from "@may-agent/sdk";
import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { taskTreeConfig } from "./task-tree-tools.ts";
import { syncProjectReadout } from "./project-readout-sync.ts";

function expectParitySurfaces(input: {
  projectState: Record<string, any>;
  taskTree: Record<string, any>;
}) {
  const proposalReason =
    input.taskTree.tasks.project.context.current_focus_proposal.reason;
  expect(input.projectState.currentFocus.focusReview.note).toContain(proposalReason);
  expect(input.projectState.focusPlan.summary).toContain(proposalReason);
}

async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "aks-readout-sync-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  await mkdir(join(appDir, "tasks"), { recursive: true });
  await mkdir(join(appDir, ".state"), { recursive: true });
  await mkdir(projectDir, { recursive: true });
  await writeFile(
    join(appDir, "project.json"),
    `${JSON.stringify(
      {
        id: "aks-rp-e2e.app",
        owner: "aks-explorer",
        status: "active",
        type: "project-app",
        currentState: {
          summary: "stale summary",
        },
        currentFocus: {
          summary: "stale focus",
          nextAction: "stale next action",
          focusReview: {
            note: "stale focus review",
          },
        },
        focusPlan: {
          summary: "stale focus plan",
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return { appDir, projectDir };
}

describe("syncProjectReadout", () => {
  test("surfaces the governing approval wait for a blocked-only approval disposition", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: "2026-07-14T11:11:14.262Z",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: [
                "ops/wait-project-approval-owner-return-primary-blocker-20260713",
                "focus-terminal-frontier-finality-reconciliation-20260714",
              ],
              context: {
                current_focus_proposal: {
                  reason: "stale proposal reason",
                },
              },
            },
            "ops/wait-project-approval-owner-return-primary-blocker-20260713": {
              id: "ops/wait-project-approval-owner-return-primary-blocker-20260713",
              parent_id: "project",
              state: "blocked",
              kind: "domain_leaf",
              children: [],
              goal: "Carry the governing owner approval wait.",
              blocker: {
                category: "external-wait",
                owner: "human",
                waiting_for: {
                  type: "project.approval.submitted",
                },
              },
            },
            "focus-terminal-frontier-finality-reconciliation-20260714": {
              id: "focus-terminal-frontier-finality-reconciliation-20260714",
              parent_id: "project",
              state: "blocked",
              kind: "focus_plan",
              children: [],
              goal: "Keep the no-live focus represented behind one governing wait.",
              context: {
                needs_approval: true,
                observations: {
                  frontier_active_leaf_count: 0,
                  frontier_review_leaf_count: 0,
                  frontier_waiting_leaf_count: 0,
                  frontier_runnable_leaf_count: 0,
                },
              },
              blocker: {
                category: "external-wait",
                owner: "human",
                waiting_for: {
                  type: "owner.decision",
                  taskId:
                    "ops/wait-project-approval-owner-return-primary-blocker-20260713",
                  governingWaitTaskId:
                    "ops/wait-project-approval-owner-return-primary-blocker-20260713",
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

    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    syncProjectReadout(config, "2026-07-14T11:22:00.000Z");

    const projectState = JSON.parse(
      await readFile(projectRuntimePaths(appDir).projectStatePath, "utf8"),
    );
    const taskTree = JSON.parse(await readFile(resolveTaskTreePath(appDir), "utf8"));
    expect(projectState.currentState.summary).toContain(
      "approval-gated blocked disposition",
    );
    expect(projectState.currentState.summary).toContain(
      "ops/wait-project-approval-owner-return-primary-blocker-20260713",
    );
    expect(projectState.currentFocus.summary).toContain(
      "focus-terminal-frontier-finality-reconciliation-20260714",
    );
    expect(projectState.currentFocus.summary).toContain(
      "ops/wait-project-approval-owner-return-primary-blocker-20260713",
    );
    expect(projectState.currentFocus.nextAction).toContain(
      "ops/wait-project-approval-owner-return-primary-blocker-20260713",
    );
    expect(projectState.currentFocus.focusReview.note).toContain(
      "approval-gated blocked stewardship",
    );
    expect(projectState.focusPlan.summary).toContain(
      "approval-gated blocked stewardship",
    );
    expect(
      taskTree.tasks.project.context.current_focus_proposal.reason,
    ).toContain("approval-gated blocked stewardship");
    expectParitySurfaces({ projectState, taskTree });
  });

  test("suppresses an active parity-guard repair leaf and keeps blocked-only readout surfaces aligned", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: "2026-07-14T20:20:00.000Z",
          active_task_id: "ops/guard-focus-readout-parity-current-focus-proposal-20260714",
          active_task_ids: [
            "ops/guard-focus-readout-parity-current-focus-proposal-20260714",
          ],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: [
                "ops/wait-project-approval-owner-return-primary-blocker-20260713",
                "focus-terminal-frontier-finality-reconciliation-20260714",
                "ops/guard-focus-readout-parity-current-focus-proposal-20260714",
              ],
              context: {
                current_focus_proposal: {
                  reason: "stale proposal reason active guard leaf leaked into readout",
                },
              },
            },
            "ops/wait-project-approval-owner-return-primary-blocker-20260713": {
              id: "ops/wait-project-approval-owner-return-primary-blocker-20260713",
              parent_id: "project",
              state: "blocked",
              kind: "domain_leaf",
              owner: "app-ops",
              children: [],
              goal: "Carry the governing owner approval wait.",
              blocker: {
                category: "external-wait",
                owner: "human",
                waiting_for: {
                  type: "project.approval.submitted",
                },
              },
            },
            "focus-terminal-frontier-finality-reconciliation-20260714": {
              id: "focus-terminal-frontier-finality-reconciliation-20260714",
              parent_id: "project",
              state: "blocked",
              kind: "focus_plan",
              children: [],
              goal: "Keep the no-live focus represented behind one governing wait.",
              context: {
                needs_approval: true,
                observations: {
                  frontier_active_leaf_count: 0,
                  frontier_review_leaf_count: 0,
                  frontier_waiting_leaf_count: 0,
                  frontier_runnable_leaf_count: 0,
                },
              },
              blocker: {
                category: "external-wait",
                owner: "human",
                waiting_for: {
                  type: "owner.decision",
                  taskId:
                    "ops/wait-project-approval-owner-return-primary-blocker-20260713",
                  governingWaitTaskId:
                    "ops/wait-project-approval-owner-return-primary-blocker-20260713",
                },
              },
            },
            "ops/guard-focus-readout-parity-current-focus-proposal-20260714": {
              id: "ops/guard-focus-readout-parity-current-focus-proposal-20260714",
              parent_id: "project",
              state: "active",
              kind: "domain_leaf",
              owner: "app-ops",
              children: [],
              goal: "Add a durable app-owned parity guard so the supported readout sync keeps project-state currentFocus.focusReview.note and focusPlan.summary aligned with task-tree project.context.current_focus_proposal for the current non-repair frontier while excluding metadata repair leaves.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "app-ops",
      maxConcurrent: 1,
    });
    syncProjectReadout(config, "2026-07-14T20:25:00.000Z");

    const projectState = JSON.parse(
      await readFile(projectRuntimePaths(appDir).projectStatePath, "utf8"),
    );
    const taskTree = JSON.parse(await readFile(resolveTaskTreePath(appDir), "utf8"));
    expect(projectState.currentState.summary).toContain(
      "0 active leaves",
    );
    expect(projectState.currentFocus.activeTaskIds).toEqual([
      "focus-terminal-frontier-finality-reconciliation-20260714",
      "ops/wait-project-approval-owner-return-primary-blocker-20260713",
    ]);
    expect(projectState.currentFocus.proposedTaskIds).toEqual([
      "focus-terminal-frontier-finality-reconciliation-20260714",
      "ops/wait-project-approval-owner-return-primary-blocker-20260713",
    ]);
    expect(projectState.currentFocus.focusReview.note).not.toContain(
      "ops/guard-focus-readout-parity-current-focus-proposal-20260714",
    );
    expect(projectState.focusPlan.summary).not.toContain(
      "ops/guard-focus-readout-parity-current-focus-proposal-20260714",
    );
    expect(
      taskTree.tasks.project.context.current_focus_proposal.reason,
    ).not.toContain("ops/guard-focus-readout-parity-current-focus-proposal-20260714");
    expectParitySurfaces({ projectState, taskTree });
  });

  test("suppresses active app-ops focus/readout metadata repair leaves from live readout", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: "2026-07-14T20:04:23.777Z",
          active_task_id: "ops-apply-readout-repair",
          active_task_ids: ["ops-apply-readout-repair"],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: [
                "ops/review-overdue-network-acns-hubble-owner-return-20260714",
                "wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704",
                "ops-apply-readout-repair",
              ],
              context: {
                current_focus_proposal: {
                  reason: "stale proposal reason active=[none]",
                },
              },
            },
            "ops/review-overdue-network-acns-hubble-owner-return-20260714": {
              id: "ops/review-overdue-network-acns-hubble-owner-return-20260714",
              parent_id: "project",
              state: "active",
              kind: "domain_leaf",
              owner: "app-ops",
              children: [],
              goal: "Review the overdue network acns hubble owner return frontier.",
            },
            "wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704": {
              id: "wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704",
              parent_id: "project",
              state: "blocked",
              kind: "domain_leaf",
              owner: "aks-explorer",
              children: [],
              goal: "Carry the exact blocked wait.",
              blocker: {
                category: "external-wait",
                owner: "human",
                waiting_for: {
                  type: "project.approval.submitted",
                },
              },
            },
            "ops-apply-readout-repair": {
              id: "ops-apply-readout-repair",
              parent_id: "project",
              state: "active",
              kind: "domain_leaf",
              owner: "app-ops",
              children: [],
              goal: "After planner settles reviewed work, refresh/verify runtime focus/readout metadata so the supported app state excludes both metadata repair leaves.",
              context: {
                reviewedTask: {
                  taskId: "prior-readout-repair",
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

    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "app-ops",
      maxConcurrent: 1,
    });
    syncProjectReadout(config, "2026-07-14T20:05:00.000Z");

    const projectState = JSON.parse(
      await readFile(projectRuntimePaths(appDir).projectStatePath, "utf8"),
    );
    const taskTree = JSON.parse(await readFile(resolveTaskTreePath(appDir), "utf8"));
    expect(projectState.currentState.summary).toContain(
      "1 active leaves",
    );
    expect(projectState.currentState.summary).toContain(
      "ops/review-overdue-network-acns-hubble-owner-return-20260714",
    );
    expect(projectState.currentFocus.summary).toContain(
      "ops/review-overdue-network-acns-hubble-owner-return-20260714",
    );
    expect(projectState.currentFocus.activeTaskIds).toEqual([
      "ops/review-overdue-network-acns-hubble-owner-return-20260714",
    ]);
    expect(projectState.currentFocus.proposedTaskIds).toEqual([
      "ops/review-overdue-network-acns-hubble-owner-return-20260714",
      "wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704",
    ]);
    expect(projectState.currentFocus.activeTaskIds).not.toContain(
      "ops-apply-readout-repair",
    );
    expect(projectState.currentState.activeTaskId).toBe(
      "ops/review-overdue-network-acns-hubble-owner-return-20260714",
    );
    expect(projectState.currentFocus.focusReview.note).toContain(
      "active=[ops/review-overdue-network-acns-hubble-owner-return-20260714]",
    );
    expect(projectState.focusPlan.summary).toContain(
      "active=[ops/review-overdue-network-acns-hubble-owner-return-20260714]",
    );
    expect(
      taskTree.tasks.project.context.current_focus_proposal.reason,
    ).toContain("active=[ops/review-overdue-network-acns-hubble-owner-return-20260714]");
    expect(
      taskTree.tasks.project.context.current_focus_proposal.reason,
    ).not.toContain("ops-apply-readout-repair");
    expectParitySurfaces({ projectState, taskTree });
  });

  test("preserves a root-contract readout scope when generic sync sees only the scope-sync repair leaf", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: "2026-07-15T06:03:23.577Z",
          active_task_id: "ops/reconcile-project-root-readout-project-state-scope-sync-20260715",
          active_task_ids: [
            "ops/reconcile-project-root-readout-project-state-scope-sync-20260715",
          ],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: [
                "aks-spec-verification-loop",
                "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
                "ops/reconcile-project-root-readout-project-state-scope-sync-20260715",
              ],
              context: {
                current_root_readout: {
                  updated_at: "2026-07-15T06:03:23.577Z",
                  excludes_task_id:
                    "ops/reconcile-project-root-readout-project-state-scope-sync-20260715",
                  contract_scope:
                    "archived-publication leaf + top-level app-ops follow-through + exact top-level blocked steward waits",
                  active_task_ids_excluding_self: [],
                  active_task_ids_including_self: [
                    "ops/reconcile-project-root-readout-project-state-scope-sync-20260715",
                  ],
                  review_task_ids: [],
                  waiting_task_ids: [],
                  runnable_task_ids: [],
                  blocked_leaf_count: 1,
                  top_level_blocked_ids: [
                    "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
                  ],
                  accepted_publication_leaf_id:
                    "domain/publish-windows-gpu-vmss-successors-visible-20260715",
                  accepted_publication_leaf_live: false,
                  accepted_publication_leaf_archive_file:
                    ".state/tasks/archive/done-leaves-20260715055212450.json",
                  accepted_publication_leaf_archived_at:
                    "2026-07-15T05:52:12.450Z",
                },
                current_focus_proposal: {
                  reason:
                    "stale proposal reason generic sync leaked the scope repair leaf back into focus",
                  context: {
                    active_task_ids: [
                      "ops/reconcile-project-root-readout-project-state-scope-sync-20260715",
                    ],
                    review_task_ids: [],
                    linked_blocked_task_ids: [],
                  },
                },
              },
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "active",
              kind: "workflow_root",
              owner: "app-ops",
              children: ["hold-spec-blocked-leaf"],
            },
            "hold-spec-blocked-leaf": {
              id: "hold-spec-blocked-leaf",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              kind: "domain_leaf",
              owner: "aks-explorer",
              children: [],
              goal: "Represent a lower-level blocked loop child.",
            },
            "wait-shared-westus2-managed-cluster-capacity-family-return-20260703": {
              id: "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
              parent_id: "project",
              state: "blocked",
              kind: "domain_leaf",
              owner: "aks-explorer",
              children: [],
              goal: "Carry the exact top-level blocked wait.",
              blocker: {
                category: "external-wait",
                owner: "human",
                waiting_for: {
                  type: "project.approval.submitted",
                },
              },
            },
            "ops/reconcile-project-root-readout-project-state-scope-sync-20260715": {
              id: "ops/reconcile-project-root-readout-project-state-scope-sync-20260715",
              parent_id: "project",
              state: "active",
              kind: "domain_leaf",
              owner: "app-ops",
              children: [],
              goal: "Reconcile the project root readout and project-state scope sync without letting the repair leaf leak back into the root contract.",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "app-ops",
      maxConcurrent: 1,
    });
    syncProjectReadout(config, "2026-07-15T06:07:29.028Z");

    const projectState = JSON.parse(
      await readFile(projectRuntimePaths(appDir).projectStatePath, "utf8"),
    );
    const taskTree = JSON.parse(await readFile(resolveTaskTreePath(appDir), "utf8"));
    expect(projectState.currentState.summary).toContain("Project-root readout");
    expect(projectState.currentState.summary).toContain(
      "domain/publish-windows-gpu-vmss-successors-visible-20260715 is archived done",
    );
    expect(projectState.currentState.activeTaskId).toBeNull();
    expect(projectState.currentState.metrics.activeLeafCount).toBe(0);
    expect(projectState.currentFocus.summary).toContain(
      "Current root-frontier follow-through is active=[none]",
    );
    expect(projectState.currentFocus.activeTaskIds).toEqual([]);
    expect(projectState.currentFocus.proposedTaskIds).toEqual([
      "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
    ]);
    expect(projectState.currentFocus.focusMission.activeTaskIds).toEqual([]);
    expect(projectState.currentFocus.focusMission.linkedBlockedTaskIds).toEqual([
      "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
    ]);
    expect(
      taskTree.tasks.project.context.current_focus_proposal.reason,
    ).toContain("Current root-contract non-repair frontier is active=[none]");
    expect(
      taskTree.tasks.project.context.current_focus_proposal.reason,
    ).not.toContain("ops/reconcile-project-root-readout-project-state-scope-sync-20260715");
    expect(
      taskTree.tasks.project.context.current_focus_proposal.context.active_task_ids,
    ).toEqual([]);
    expect(
      taskTree.tasks.project.context.current_focus_proposal.context.linked_blocked_task_ids,
    ).toEqual([
      "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
    ]);
    expect(taskTree.tasks.project.summary).toContain("Project-root readout");
    expect(taskTree.tasks.project.summary).toContain(
      "active=[none], review=[none], waiting=[none], runnable=[none], blocked=2",
    );
    expect(taskTree.tasks.project.strategy_context).toContain(
      "Current root-contract non-repair frontier is active=[none], review=[none], waiting=[none], runnable=[none], blocked=2",
    );
    expect(taskTree.tasks.project.progress).toEqual({
      updated_at: "2026-07-15T06:07:29.028Z",
      active_excluding_self: 0,
      active_including_self: 1,
      review: 0,
      waiting: 0,
      runnable: 0,
      blocked: 2,
      done: 0,
      leaf_total: 3,
      top_level_blocked: 1,
    });
    expectParitySurfaces({ projectState, taskTree });
  });

  test("root-contract sync preserves nested review frontier and excludes active focus-state repair leaves", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: "2026-07-15T10:13:54.580Z",
          active_task_id:
            "ops-apply-reconcile-current-focus-proposal-stale-ready-subset-state-20260715-state-repair",
          active_task_ids: [
            "ops-apply-reconcile-current-focus-proposal-stale-ready-subset-state-20260715-state-repair",
          ],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: [
                "aks-feature-compact-loop",
                "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
                "ops-apply-reconcile-current-focus-proposal-stale-ready-subset-state-20260715-state-repair",
              ],
              context: {
                current_focus_proposal: {
                  id: "focus-post-ready-subset-review-blocked-frontier-truth-sync-20260715",
                  title: "Post ready-subset review/blocked frontier truth sync",
                  reason:
                    "stale proposal reason active=[ops-apply-reconcile-current-focus-proposal-stale-ready-subset-state-20260715-state-repair] review=[none]",
                  context: {
                    active_task_ids: [
                      "ops-apply-reconcile-current-focus-proposal-stale-ready-subset-state-20260715-state-repair",
                    ],
                    review_task_ids: [],
                    linked_blocked_task_ids: [
                      "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
                    ],
                  },
                },
                current_root_readout: {
                  updated_at: "2026-07-15T10:13:47.510Z",
                  contract_scope:
                    "compact-loop ready-subset adjudication frontier + exact compact blocked holders",
                  excludes_task_id:
                    "ops/reconcile-project-root-readout-project-state-scope-sync-20260715",
                  active_task_ids_excluding_self: [
                    "ops-apply-reconcile-current-focus-proposal-stale-ready-subset-state-20260715-state-repair",
                  ],
                  active_task_ids_including_self: [
                    "ops-apply-reconcile-current-focus-proposal-stale-ready-subset-state-20260715-state-repair",
                  ],
                  review_task_ids: [],
                  waiting_task_ids: [],
                  runnable_task_ids: [],
                  blocked_leaf_count: 2,
                  top_level_blocked_ids: [
                    "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
                  ],
                  accepted_publication_leaf_id:
                    "domain/spec-windows-ready-subset-followup-20260715",
                  accepted_publication_leaf_live: false,
                },
              },
            },
            "aks-feature-compact-loop": {
              id: "aks-feature-compact-loop",
              parent_id: "project",
              state: "blocked",
              owner: "app-ops",
              children: [
                "wait-ccp-coredns-ready-subset-ado-run-172310245-result",
              ],
              goal: "Compact loop controller root.",
            },
            "wait-ccp-coredns-ready-subset-ado-run-172310245-result": {
              id: "wait-ccp-coredns-ready-subset-ado-run-172310245-result",
              parent_id: "aks-feature-compact-loop",
              state: "review",
              owner: "aks-explorer",
              children: [],
              goal: "Inspect the exact returned ccp-coredns ready-subset run.",
            },
            "wait-shared-westus2-managed-cluster-capacity-family-return-20260703": {
              id: "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
              parent_id: "project",
              state: "blocked",
              owner: "aks-explorer",
              children: [],
              goal: "Carry the exact top-level blocked wait.",
            },
            "ops-apply-reconcile-current-focus-proposal-stale-ready-subset-state-20260715-state-repair": {
              id: "ops-apply-reconcile-current-focus-proposal-stale-ready-subset-state-20260715-state-repair",
              parent_id: "project",
              state: "active",
              owner: "app-ops",
              children: [],
              goal: "Recompute the live non-self frontier after this review, then rewrite project.context.current_focus_proposal and mirrored .state/project-state.json focus surfaces so they no longer claim the archived 2026-07-15 compact ready-subset wave and instead truthfully represent the current review/blocked frontier without widening scope.",
              context: {
                reviewedTask: {
                  taskId:
                    "ops/reconcile-current-focus-proposal-stale-ready-subset-state-20260715",
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

    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "app-ops",
      maxConcurrent: 1,
    });
    syncProjectReadout(config, "2026-07-15T10:13:47.510Z");

    const projectState = JSON.parse(
      await readFile(projectRuntimePaths(appDir).projectStatePath, "utf8"),
    );
    const taskTree = JSON.parse(await readFile(resolveTaskTreePath(appDir), "utf8"));
    expect(projectState.currentState.activeTaskId).toBeNull();
    expect(projectState.currentState.metrics.activeLeafCount).toBe(0);
    expect(projectState.currentState.metrics.reviewLeafCount).toBe(1);
    expect(projectState.currentFocus.summary).toContain(
      "review=[wait-ccp-coredns-ready-subset-ado-run-172310245-result]",
    );
    expect(projectState.currentFocus.summary).not.toContain(
      "ops-apply-reconcile-current-focus-proposal-stale-ready-subset-state-20260715-state-repair",
    );
    expect(projectState.currentFocus.activeTaskIds).toEqual([]);
    expect(projectState.currentFocus.proposedTaskIds).toEqual([
      "wait-ccp-coredns-ready-subset-ado-run-172310245-result",
      "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
    ]);
    expect(projectState.currentFocus.focusMission.activeTaskIds).toEqual([]);
    expect(projectState.currentFocus.focusMission.reviewTaskIds).toEqual([
      "wait-ccp-coredns-ready-subset-ado-run-172310245-result",
    ]);
    expect(taskTree.tasks.project.context.current_root_readout.excludes_task_id).toBe(
      "ops-apply-reconcile-current-focus-proposal-stale-ready-subset-state-20260715-state-repair",
    );
    expect(taskTree.tasks.project.context.current_root_readout.review_task_ids).toEqual([
      "wait-ccp-coredns-ready-subset-ado-run-172310245-result",
    ]);
    expect(
      taskTree.tasks.project.context.current_focus_proposal.reason,
    ).toContain(
      "Current root-contract non-repair frontier is active=[none], review=[wait-ccp-coredns-ready-subset-ado-run-172310245-result]",
    );
    expect(
      taskTree.tasks.project.context.current_focus_proposal.reason,
    ).not.toContain(
      "ops-apply-reconcile-current-focus-proposal-stale-ready-subset-state-20260715-state-repair",
    );
    expect(
      taskTree.tasks.project.context.current_focus_proposal.context.active_task_ids,
    ).toEqual([]);
    expect(
      taskTree.tasks.project.context.current_focus_proposal.context.review_task_ids,
    ).toEqual(["wait-ccp-coredns-ready-subset-ado-run-172310245-result"]);
    expect(taskTree.tasks.project.progress).toEqual({
      updated_at: "2026-07-15T10:13:47.510Z",
      active_excluding_self: 0,
      active_including_self: 1,
      review: 1,
      waiting: 0,
      runnable: 0,
      blocked: 1,
      done: 0,
      leaf_total: 3,
      top_level_blocked: 1,
    });
    expectParitySurfaces({ projectState, taskTree });
  });
});
