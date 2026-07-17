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
  expect(input.projectState.currentFocus.focusReview.note).toContain(
    proposalReason,
  );
  expect(input.projectState.focusPlan.summary).toContain(proposalReason);

  const focusMission = input.projectState.currentFocus?.focusMission;
  if (focusMission?.reviewTaskIds) {
    expect(focusMission.liveReviewFrontierTaskIds).toEqual(
      focusMission.reviewTaskIds,
    );
    expect(focusMission.excludedReviewTaskIds ?? []).toEqual([]);
  }

  const proposalContext =
    input.taskTree.tasks.project.context.current_focus_proposal?.context;
  if (proposalContext?.review_task_ids) {
    expect(proposalContext.live_review_frontier_task_ids).toEqual(
      proposalContext.review_task_ids,
    );
    expect(proposalContext.excluded_review_task_ids ?? []).toEqual([]);
  }

  const rootReadout = input.taskTree.tasks.project.context.current_root_readout;
  if (rootReadout?.review_task_ids) {
    expect(rootReadout.live_review_frontier_task_ids).toEqual(
      rootReadout.review_task_ids,
    );
    expect(rootReadout.excluded_review_task_ids ?? []).toEqual([]);
  }
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
    const taskTree = JSON.parse(
      await readFile(resolveTaskTreePath(appDir), "utf8"),
    );
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
          active_task_id:
            "ops/guard-focus-readout-parity-current-focus-proposal-20260714",
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
                  reason:
                    "stale proposal reason active guard leaf leaked into readout",
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
    const taskTree = JSON.parse(
      await readFile(resolveTaskTreePath(appDir), "utf8"),
    );
    expect(projectState.currentState.summary).toContain("0 active leaves");
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
    ).not.toContain(
      "ops/guard-focus-readout-parity-current-focus-proposal-20260714",
    );
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
            "wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704":
              {
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
    const taskTree = JSON.parse(
      await readFile(resolveTaskTreePath(appDir), "utf8"),
    );
    expect(projectState.currentState.summary).toContain("1 active leaves");
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
    ).toContain(
      "active=[ops/review-overdue-network-acns-hubble-owner-return-20260714]",
    );
    expect(
      taskTree.tasks.project.context.current_focus_proposal.reason,
    ).not.toContain("ops-apply-readout-repair");
    expectParitySurfaces({ projectState, taskTree });
  });

  test("suppresses self-scoped focus metadata repair leaves without reviewedTask context", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: "2026-07-17T10:10:59.493Z",
          active_task_id:
            "ops/apply-current-focus-review-frontier-metadata-drift-20260717",
          active_task_ids: [
            "domain/repoll-net-integration-nsg-route-table-in-use-vm-prerelease-run-172659069-terminal-artifact-review-20260717",
            "ops/apply-current-focus-review-frontier-metadata-drift-20260717",
          ],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: [
                "focus-same-spec-verification-fix-forward-followthrough-20260715",
                "domain/repoll-net-integration-nsg-route-table-in-use-vm-prerelease-run-172659069-terminal-artifact-review-20260717",
                "ops/apply-current-focus-review-frontier-metadata-drift-20260717",
              ],
              context: {
                current_focus_proposal: {
                  reason:
                    "stale proposal reason active=[ops/apply-current-focus-review-frontier-metadata-drift-20260717]",
                },
              },
            },
            "focus-same-spec-verification-fix-forward-followthrough-20260715": {
              id: "focus-same-spec-verification-fix-forward-followthrough-20260715",
              parent_id: "project",
              state: "review",
              kind: "focus_plan",
              owner: "aks-explorer",
              children: [],
              goal: "Keep one visible focus branch.",
            },
            "domain/repoll-net-integration-nsg-route-table-in-use-vm-prerelease-run-172659069-terminal-artifact-review-20260717":
              {
                id: "domain/repoll-net-integration-nsg-route-table-in-use-vm-prerelease-run-172659069-terminal-artifact-review-20260717",
                parent_id: "project",
                state: "active",
                kind: "domain_leaf",
                owner: "aks-explorer",
                children: [],
                goal: "Re-poll the returned terminal artifact review.",
              },
            "ops/apply-current-focus-review-frontier-metadata-drift-20260717": {
              id: "ops/apply-current-focus-review-frontier-metadata-drift-20260717",
              parent_id: "project",
              state: "active",
              kind: "domain_leaf",
              owner: "app-ops",
              children: [],
              goal: "Refresh only the current focus metadata surfaces that still advertise stale/nonexistent frontier ids so the focus branch, project.context.current_focus_proposal, and runtime.currentFocus.focusMission match the current live frontier without changing domain truth or launching cloud work.",
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
    syncProjectReadout(config, "2026-07-17T10:15:00.000Z");

    const projectState = JSON.parse(
      await readFile(projectRuntimePaths(appDir).projectStatePath, "utf8"),
    );
    const taskTree = JSON.parse(
      await readFile(resolveTaskTreePath(appDir), "utf8"),
    );

    expect(projectState.currentFocus.activeTaskIds).toEqual([
      "domain/repoll-net-integration-nsg-route-table-in-use-vm-prerelease-run-172659069-terminal-artifact-review-20260717",
    ]);
    expect(projectState.currentFocus.activeTaskIds).not.toContain(
      "ops/apply-current-focus-review-frontier-metadata-drift-20260717",
    );
    expect(projectState.currentFocus.focusMission.activeTaskIds).toEqual([
      "domain/repoll-net-integration-nsg-route-table-in-use-vm-prerelease-run-172659069-terminal-artifact-review-20260717",
    ]);
    expect(
      taskTree.tasks.project.context.current_focus_proposal.reason,
    ).toContain(
      "active=[domain/repoll-net-integration-nsg-route-table-in-use-vm-prerelease-run-172659069-terminal-artifact-review-20260717]",
    );
    expect(
      taskTree.tasks.project.context.current_focus_proposal.reason,
    ).not.toContain(
      "ops/apply-current-focus-review-frontier-metadata-drift-20260717",
    );
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
          active_task_id:
            "ops/reconcile-project-root-readout-project-state-scope-sync-20260715",
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
            "wait-shared-westus2-managed-cluster-capacity-family-return-20260703":
              {
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
            "ops/reconcile-project-root-readout-project-state-scope-sync-20260715":
              {
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
    const taskTree = JSON.parse(
      await readFile(resolveTaskTreePath(appDir), "utf8"),
    );
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
    expect(projectState.currentFocus.focusMission.linkedBlockedTaskIds).toEqual(
      ["wait-shared-westus2-managed-cluster-capacity-family-return-20260703"],
    );
    expect(
      taskTree.tasks.project.context.current_focus_proposal.reason,
    ).toContain("Current root-contract non-repair frontier is active=[none]");
    expect(
      taskTree.tasks.project.context.current_focus_proposal.reason,
    ).not.toContain(
      "ops/reconcile-project-root-readout-project-state-scope-sync-20260715",
    );
    expect(
      taskTree.tasks.project.context.current_focus_proposal.context
        .active_task_ids,
    ).toEqual([]);
    expect(
      taskTree.tasks.project.context.current_focus_proposal.context
        .linked_blocked_task_ids,
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
              owner: "aks-explorer",
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
            "wait-shared-westus2-managed-cluster-capacity-family-return-20260703":
              {
                id: "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
                parent_id: "project",
                state: "blocked",
                owner: "aks-explorer",
                children: [],
                goal: "Carry the exact top-level blocked wait.",
              },
            "ops-apply-reconcile-current-focus-proposal-stale-ready-subset-state-20260715-state-repair":
              {
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
    const taskTree = JSON.parse(
      await readFile(resolveTaskTreePath(appDir), "utf8"),
    );
    expect(projectState.currentState.activeTaskId).toBeNull();
    expect(projectState.currentState.metrics.activeLeafCount).toBe(0);
    expect(projectState.currentState.metrics.reviewLeafCount).toBe(1);
    expect(projectState.currentFocus.summary).toContain(
      "review=[wait-ccp-coredns-ready-subset-ado-run-172310245-result]",
    );
    expect(projectState.currentFocus.summary).toContain(
      "Structural controller project remains active and owned by aks-explorer.",
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
    expect(
      taskTree.tasks.project.context.current_root_readout.controller_task_id,
    ).toBe("project");
    expect(
      taskTree.tasks.project.context.current_root_readout.controller_owner,
    ).toBe("aks-explorer");
    expect(
      taskTree.tasks.project.context.current_root_readout.controller_state,
    ).toBe("active");
    expect(
      taskTree.tasks.project.context.current_root_readout.excludes_task_id,
    ).toBe(
      "ops-apply-reconcile-current-focus-proposal-stale-ready-subset-state-20260715-state-repair",
    );
    expect(
      taskTree.tasks.project.context.current_root_readout.review_task_ids,
    ).toEqual(["wait-ccp-coredns-ready-subset-ado-run-172310245-result"]);
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
      taskTree.tasks.project.context.current_focus_proposal.context
        .active_task_ids,
    ).toEqual([]);
    expect(
      taskTree.tasks.project.context.current_focus_proposal.context
        .review_task_ids,
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

  test("root-contract sync preserves blocked lineage without hiding live work", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: "2026-07-16T02:17:31.360Z",
          active_task_id: "domain/normalize-next-scenario-test-slice-20260716",
          active_task_ids: [
            "domain/normalize-next-scenario-test-slice-20260716",
          ],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: [
                "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
                "ops/wait-project-approval-owner-return-primary-blocker-20260713",
                "domain/normalize-scenario-tests-repo-frontier-20260715",
                "fix-localdns-auto-default-run-172310406",
                "domain/normalize-next-scenario-test-slice-20260716",
                "aks-spec-verification-loop",
                "aks-feature-compact-loop",
              ],
              context: {
                current_focus_proposal: {
                  id: "focus-same-spec-verification-fix-forward-followthrough-20260715",
                  title:
                    "review-only follow-through with exact blocked carriers",
                  reason: "stale proposal reason",
                  context: {
                    active_task_ids: [],
                    review_task_ids: [
                      "domain/normalize-scenario-tests-repo-frontier-20260715",
                      "fix-localdns-auto-default-run-172310406",
                    ],
                    blocked_task_ids: [
                      "fix-network-acns-retina-enterprise-run-172393474",
                      "reconcile-spec-loop-pending-rp-regional-quota",
                      "hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715",
                      "ops/wait-project-approval-owner-return-primary-blocker-20260713",
                      "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
                    ],
                    linked_blocked_task_ids: [
                      "ops/wait-project-approval-owner-return-primary-blocker-20260713",
                      "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
                    ],
                  },
                },
                current_root_readout: {
                  updated_at: "2026-07-16T02:17:31.360Z",
                  contract_scope:
                    "compact-loop ready-subset adjudication frontier + exact compact blocked holders",
                  excludes_task_id:
                    "ops/repair-current-focus-frontier-metadata-drift-20260716b",
                  active_task_ids_excluding_self: [],
                  active_task_ids_including_self: [],
                  review_task_ids: [
                    "domain/normalize-scenario-tests-repo-frontier-20260715",
                    "fix-localdns-auto-default-run-172310406",
                  ],
                  waiting_task_ids: [],
                  runnable_task_ids: [],
                  blocked_leaf_count: 5,
                  top_level_blocked_ids: [
                    "ops/wait-project-approval-owner-return-primary-blocker-20260713",
                    "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
                  ],
                  accepted_publication_leaf_id:
                    "domain/spec-windows-ready-subset-followup-20260715",
                  accepted_publication_leaf_live: false,
                },
              },
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "active",
              kind: "workflow_root",
              children: [
                "fix-network-acns-retina-enterprise-run-172393474",
                "reconcile-spec-loop-pending-rp-regional-quota",
              ],
            },
            "aks-feature-compact-loop": {
              id: "aks-feature-compact-loop",
              parent_id: "project",
              state: "blocked",
              kind: "workflow_root",
              children: [
                "hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715",
              ],
            },
            "domain/normalize-scenario-tests-repo-frontier-20260715": {
              id: "domain/normalize-scenario-tests-repo-frontier-20260715",
              parent_id: "project",
              state: "review",
              owner: "aks-explorer",
              children: [],
              goal: "Review repo-wide scenario normalization changes.",
            },
            "fix-localdns-auto-default-run-172310406": {
              id: "fix-localdns-auto-default-run-172310406",
              parent_id: "project",
              state: "review",
              owner: "aks-explorer",
              children: [],
              goal: "Review localdns auto-default follow-up.",
            },
            "domain/normalize-next-scenario-test-slice-20260716": {
              id: "domain/normalize-next-scenario-test-slice-20260716",
              parent_id: "project",
              state: "active",
              owner: "aks-explorer",
              children: [],
              goal: "Live repo-local normalization frontier that scope metadata must not hide.",
            },
            "fix-network-acns-retina-enterprise-run-172393474": {
              id: "fix-network-acns-retina-enterprise-run-172393474",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              owner: "aks-explorer",
              children: [],
              goal: "Exact blocked carrier for the fix-network follow-through.",
            },
            "reconcile-spec-loop-pending-rp-regional-quota": {
              id: "reconcile-spec-loop-pending-rp-regional-quota",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              owner: "app-ops",
              children: [],
              goal: "Exact blocked public carrier.",
            },
            "hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715":
              {
                id: "hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715",
                parent_id: "aks-feature-compact-loop",
                state: "blocked",
                owner: "aks-explorer",
                children: [],
                goal: "Exact compact blocked lineage carrier.",
              },
            "ops/wait-project-approval-owner-return-primary-blocker-20260713": {
              id: "ops/wait-project-approval-owner-return-primary-blocker-20260713",
              parent_id: "project",
              state: "blocked",
              owner: "app-ops",
              children: [],
              goal: "Carry the exact project approval wait.",
            },
            "wait-shared-westus2-managed-cluster-capacity-family-return-20260703":
              {
                id: "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
                parent_id: "project",
                state: "blocked",
                owner: "aks-explorer",
                children: [],
                goal: "Carry the exact shared capacity wait.",
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
    const syncResult = syncProjectReadout(config, "2026-07-16T02:17:31.360Z");

    const projectState = JSON.parse(
      await readFile(projectRuntimePaths(appDir).projectStatePath, "utf8"),
    );
    const taskTree = JSON.parse(
      await readFile(resolveTaskTreePath(appDir), "utf8"),
    );
    const blockedLineage = [
      "fix-network-acns-retina-enterprise-run-172393474",
      "reconcile-spec-loop-pending-rp-regional-quota",
      "hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715",
      "ops/wait-project-approval-owner-return-primary-blocker-20260713",
      "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
    ];

    expect(syncResult.snapshot).toEqual({
      version: "project-snapshot-v2",
      capturedAt: "2026-07-16T02:17:31.360Z",
      treeUpdatedAt: "2026-07-16T02:17:31.360Z",
    });
    expect(projectState.currentState.snapshot).toEqual(syncResult.snapshot);
    expect(projectState.currentFocus.snapshot).toEqual(syncResult.snapshot);
    expect(
      taskTree.tasks.project.context.current_root_readout.snapshot_version,
    ).toBe("project-snapshot-v2");
    expect(
      taskTree.tasks.project.context.current_root_readout
        .source_tree_updated_at,
    ).toBe("2026-07-16T02:17:31.360Z");

    expect(projectState.currentState.activeTaskId).toBe(
      "domain/normalize-next-scenario-test-slice-20260716",
    );
    expect(projectState.currentState.metrics.activeLeafCount).toBe(1);
    expect(projectState.currentFocus.activeTaskIds).toEqual([
      "domain/normalize-next-scenario-test-slice-20260716",
    ]);
    expect(projectState.currentFocus.proposedTaskIds).toEqual([
      "domain/normalize-next-scenario-test-slice-20260716",
      "domain/normalize-scenario-tests-repo-frontier-20260715",
      "fix-localdns-auto-default-run-172310406",
      ...blockedLineage,
    ]);
    expect(projectState.currentFocus.focusMission.activeTaskIds).toEqual([
      "domain/normalize-next-scenario-test-slice-20260716",
    ]);
    expect(projectState.currentFocus.focusMission.linkedBlockedTaskIds).toEqual(
      blockedLineage,
    );
    expect(projectState.currentFocus.summary).toContain(
      "Preserved blocked carrier lineage remains fix-network-acns-retina-enterprise-run-172393474, reconcile-spec-loop-pending-rp-regional-quota, hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715",
    );
    expect(projectState.focusPlan.summary).toContain(
      "Preserved blocked carrier lineage remains fix-network-acns-retina-enterprise-run-172393474, reconcile-spec-loop-pending-rp-regional-quota, hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715",
    );
    expect(
      taskTree.tasks.project.context.current_focus_proposal.reason,
    ).toContain(
      "Preserved blocked carrier lineage remains fix-network-acns-retina-enterprise-run-172393474, reconcile-spec-loop-pending-rp-regional-quota, hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715",
    );
    expect(
      taskTree.tasks.project.context.current_focus_proposal.context
        .linked_blocked_task_ids,
    ).toEqual(blockedLineage);
    expect(
      taskTree.tasks.project.context.current_focus_proposal.context
        .proposed_task_ids,
    ).toEqual([
      "domain/normalize-next-scenario-test-slice-20260716",
      "domain/normalize-scenario-tests-repo-frontier-20260715",
      "fix-localdns-auto-default-run-172310406",
      ...blockedLineage,
    ]);
    expectParitySurfaces({ projectState, taskTree });
  });

  test("root-contract sync prunes archived review/proposed ghost ids after accepted publication compaction", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const blockedLineage = [
      "fix-network-acns-retina-enterprise-run-172393474",
      "reconcile-spec-loop-pending-rp-regional-quota",
      "hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715",
      "ops/wait-project-approval-owner-return-primary-blocker-20260713",
      "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
    ];
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: "2026-07-16T02:40:00.000Z",
          active_task_id: "domain/normalize-next-scenario-test-slice-20260716",
          active_task_ids: [
            "domain/normalize-next-scenario-test-slice-20260716",
          ],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: [
                "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
                "ops/wait-project-approval-owner-return-primary-blocker-20260713",
                "domain/normalize-scenario-tests-repo-frontier-20260715",
                "fix-localdns-auto-default-run-172310406",
                "domain/normalize-next-scenario-test-slice-20260716",
                "aks-spec-verification-loop",
                "aks-feature-compact-loop",
              ],
              context: {
                current_focus_proposal: {
                  reason:
                    "stale proposal reason archived publication ghost leaked into review/proposed ids",
                  context: {
                    active_task_ids: [],
                    review_task_ids: [
                      "domain/normalize-scenario-tests-repo-frontier-20260715",
                      "fix-localdns-auto-default-run-172310406",
                      "domain/spec-windows-ready-subset-followup-20260715",
                      "ghost-review-archived-20260716",
                    ],
                    blocked_task_ids: blockedLineage,
                    linked_blocked_task_ids: blockedLineage,
                    proposed_task_ids: [
                      "domain/normalize-scenario-tests-repo-frontier-20260715",
                      "fix-localdns-auto-default-run-172310406",
                      "domain/spec-windows-ready-subset-followup-20260715",
                      "ghost-review-archived-20260716",
                      ...blockedLineage,
                    ],
                  },
                },
                current_root_readout: {
                  updated_at: "2026-07-16T02:39:59.000Z",
                  contract_scope:
                    "compact-loop ready-subset adjudication frontier + exact compact blocked holders",
                  excludes_task_id:
                    "ops/repair-current-focus-frontier-metadata-drift-20260716b",
                  active_task_ids_excluding_self: [],
                  active_task_ids_including_self: [],
                  review_task_ids: [
                    "domain/normalize-scenario-tests-repo-frontier-20260715",
                    "fix-localdns-auto-default-run-172310406",
                    "domain/spec-windows-ready-subset-followup-20260715",
                  ],
                  waiting_task_ids: [],
                  runnable_task_ids: [],
                  blocked_leaf_count: 5,
                  top_level_blocked_ids: [
                    "ops/wait-project-approval-owner-return-primary-blocker-20260713",
                    "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
                  ],
                  accepted_publication_leaf_id:
                    "domain/spec-windows-ready-subset-followup-20260715",
                  accepted_publication_leaf_live: false,
                  accepted_publication_leaf_archive_file:
                    ".state/tasks/archive/done-leaves-20260716022753848.json",
                  accepted_publication_leaf_archived_at:
                    "2026-07-16T02:27:53.849Z",
                },
              },
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "active",
              kind: "workflow_root",
              children: [
                "fix-network-acns-retina-enterprise-run-172393474",
                "reconcile-spec-loop-pending-rp-regional-quota",
              ],
            },
            "aks-feature-compact-loop": {
              id: "aks-feature-compact-loop",
              parent_id: "project",
              state: "blocked",
              kind: "workflow_root",
              children: [
                "hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715",
              ],
            },
            "domain/normalize-scenario-tests-repo-frontier-20260715": {
              id: "domain/normalize-scenario-tests-repo-frontier-20260715",
              parent_id: "project",
              state: "review",
              owner: "aks-explorer",
              children: [],
              goal: "Review repo-wide scenario normalization changes.",
            },
            "fix-localdns-auto-default-run-172310406": {
              id: "fix-localdns-auto-default-run-172310406",
              parent_id: "project",
              state: "review",
              owner: "aks-explorer",
              children: [],
              goal: "Review localdns auto-default follow-up.",
            },
            "domain/normalize-next-scenario-test-slice-20260716": {
              id: "domain/normalize-next-scenario-test-slice-20260716",
              parent_id: "project",
              state: "active",
              owner: "aks-explorer",
              children: [],
              goal: "Unrelated repo-local normalization frontier that must not leak into the scoped root contract.",
            },
            "fix-network-acns-retina-enterprise-run-172393474": {
              id: "fix-network-acns-retina-enterprise-run-172393474",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              owner: "aks-explorer",
              children: [],
              goal: "Exact blocked carrier for the fix-network follow-through.",
            },
            "reconcile-spec-loop-pending-rp-regional-quota": {
              id: "reconcile-spec-loop-pending-rp-regional-quota",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              owner: "app-ops",
              children: [],
              goal: "Exact blocked public carrier.",
            },
            "hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715":
              {
                id: "hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715",
                parent_id: "aks-feature-compact-loop",
                state: "blocked",
                owner: "aks-explorer",
                children: [],
                goal: "Exact compact blocked lineage carrier.",
              },
            "ops/wait-project-approval-owner-return-primary-blocker-20260713": {
              id: "ops/wait-project-approval-owner-return-primary-blocker-20260713",
              parent_id: "project",
              state: "blocked",
              owner: "app-ops",
              children: [],
              goal: "Carry the exact project approval wait.",
            },
            "wait-shared-westus2-managed-cluster-capacity-family-return-20260703":
              {
                id: "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
                parent_id: "project",
                state: "blocked",
                owner: "aks-explorer",
                children: [],
                goal: "Carry the exact shared capacity wait.",
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
    syncProjectReadout(config, "2026-07-16T02:40:30.000Z");

    const projectState = JSON.parse(
      await readFile(projectRuntimePaths(appDir).projectStatePath, "utf8"),
    );
    const taskTree = JSON.parse(
      await readFile(resolveTaskTreePath(appDir), "utf8"),
    );

    expect(
      taskTree.tasks.project.context.current_root_readout.review_task_ids,
    ).toEqual([
      "domain/normalize-scenario-tests-repo-frontier-20260715",
      "fix-localdns-auto-default-run-172310406",
    ]);
    expect(
      taskTree.tasks.project.context.current_focus_proposal.context
        .review_task_ids,
    ).toEqual([
      "domain/normalize-scenario-tests-repo-frontier-20260715",
      "fix-localdns-auto-default-run-172310406",
    ]);
    expect(
      taskTree.tasks.project.context.current_focus_proposal.context
        .proposed_task_ids,
    ).toEqual([
      "domain/normalize-next-scenario-test-slice-20260716",
      "domain/normalize-scenario-tests-repo-frontier-20260715",
      "fix-localdns-auto-default-run-172310406",
      ...blockedLineage,
    ]);
    expect(
      taskTree.tasks.project.context.current_focus_proposal.context
        .proposed_task_ids,
    ).not.toContain("domain/spec-windows-ready-subset-followup-20260715");
    expect(
      taskTree.tasks.project.context.current_focus_proposal.context
        .proposed_task_ids,
    ).not.toContain("ghost-review-archived-20260716");
    expect(projectState.currentFocus.proposedTaskIds).toEqual([
      "domain/normalize-next-scenario-test-slice-20260716",
      "domain/normalize-scenario-tests-repo-frontier-20260715",
      "fix-localdns-auto-default-run-172310406",
      ...blockedLineage,
    ]);
    expect(projectState.currentFocus.proposedTaskIds).not.toContain(
      "domain/spec-windows-ready-subset-followup-20260715",
    );
    expect(projectState.currentFocus.proposedTaskIds).toContain(
      "domain/normalize-next-scenario-test-slice-20260716",
    );
    expect(projectState.currentFocus.focusMission.linkedBlockedTaskIds).toEqual(
      blockedLineage,
    );
    expect(taskTree.tasks.project.summary).toContain(
      "domain/spec-windows-ready-subset-followup-20260715 is archived done and absent from the live task map",
    );
    expectParitySurfaces({ projectState, taskTree });
  });

  test("root-contract sync recognizes hyphenated project-root readout repair goals as scoped self exclusions", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: "2026-07-16T04:01:54.736Z",
          active_task_id:
            "ops/repair-project-root-frontier-review-parity-20260716",
          active_task_ids: [
            "domain/reconcile-rp-cluster-lifecycle-update-tags-inline-rewrite-20260716",
            "ops/repair-project-root-frontier-review-parity-20260716",
          ],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: [
                "domain/reconcile-rp-cluster-lifecycle-update-tags-inline-rewrite-20260716",
                "ops/repair-project-root-frontier-review-parity-20260716",
                "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
              ],
              context: {
                current_focus_proposal: {
                  reason:
                    "stale proposal reason active=[domain/reconcile-rp-cluster-lifecycle-update-tags-inline-rewrite-20260716, ops/repair-project-root-frontier-review-parity-20260716]",
                  context: {
                    active_task_ids: [
                      "domain/reconcile-rp-cluster-lifecycle-update-tags-inline-rewrite-20260716",
                      "ops/repair-project-root-frontier-review-parity-20260716",
                    ],
                    review_task_ids: [],
                    linked_blocked_task_ids: [
                      "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
                    ],
                  },
                },
                current_root_readout: {
                  updated_at: "2026-07-16T04:01:54.658Z",
                  contract_scope:
                    "live root frontier after retina-enterprise review redo + exact blocked carrier lineage",
                  excludes_task_id:
                    "ops-apply-repair-root-frontier-readout-post-retina-review-redo-20260716-state-repair",
                  active_task_ids_excluding_self: [
                    "domain/reconcile-rp-cluster-lifecycle-update-tags-inline-rewrite-20260716",
                    "ops/repair-project-root-frontier-review-parity-20260716",
                  ],
                  active_task_ids_including_self: [
                    "domain/reconcile-rp-cluster-lifecycle-update-tags-inline-rewrite-20260716",
                    "ops/repair-project-root-frontier-review-parity-20260716",
                  ],
                  review_task_ids: [],
                  waiting_task_ids: [],
                  runnable_task_ids: [],
                  blocked_leaf_count: 1,
                  top_level_blocked_ids: [
                    "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
                  ],
                  accepted_publication_leaf_id:
                    "domain/spec-windows-ready-subset-followup-20260715",
                  accepted_publication_leaf_live: false,
                },
              },
            },
            "domain/reconcile-rp-cluster-lifecycle-update-tags-inline-rewrite-20260716":
              {
                id: "domain/reconcile-rp-cluster-lifecycle-update-tags-inline-rewrite-20260716",
                parent_id: "project",
                state: "active",
                owner: "aks-explorer",
                children: [],
                goal: "Carry the live non-repair active frontier.",
              },
            "ops/repair-project-root-frontier-review-parity-20260716": {
              id: "ops/repair-project-root-frontier-review-parity-20260716",
              parent_id: "project",
              state: "active",
              owner: "app-ops",
              children: [],
              goal: "Repair the project-root frontier/progress readout so it truthfully reflects the live planning frontier after the 2026-07-16 metric recovery.",
            },
            "wait-shared-westus2-managed-cluster-capacity-family-return-20260703":
              {
                id: "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
                parent_id: "project",
                state: "blocked",
                owner: "aks-explorer",
                children: [],
                goal: "Carry the exact shared capacity wait.",
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
    syncProjectReadout(config, "2026-07-16T04:02:30.000Z");

    const projectState = JSON.parse(
      await readFile(projectRuntimePaths(appDir).projectStatePath, "utf8"),
    );
    const taskTree = JSON.parse(
      await readFile(resolveTaskTreePath(appDir), "utf8"),
    );

    expect(
      taskTree.tasks.project.context.current_root_readout.excludes_task_id,
    ).toBe("ops/repair-project-root-frontier-review-parity-20260716");
    expect(
      taskTree.tasks.project.context.current_root_readout
        .active_task_ids_excluding_self,
    ).toEqual([
      "domain/reconcile-rp-cluster-lifecycle-update-tags-inline-rewrite-20260716",
    ]);
    expect(
      taskTree.tasks.project.context.current_root_readout
        .active_task_ids_including_self,
    ).toEqual([
      "domain/reconcile-rp-cluster-lifecycle-update-tags-inline-rewrite-20260716",
      "ops/repair-project-root-frontier-review-parity-20260716",
    ]);
    expect(
      taskTree.tasks.project.context.current_focus_proposal.context
        .active_task_ids,
    ).toEqual([
      "domain/reconcile-rp-cluster-lifecycle-update-tags-inline-rewrite-20260716",
    ]);
    expect(projectState.currentState.activeTaskId).toBe(
      "domain/reconcile-rp-cluster-lifecycle-update-tags-inline-rewrite-20260716",
    );
    expect(projectState.currentState.metrics.activeLeafCount).toBe(1);
    expect(projectState.currentFocus.activeTaskIds).toEqual([
      "domain/reconcile-rp-cluster-lifecycle-update-tags-inline-rewrite-20260716",
    ]);
    expectParitySurfaces({ projectState, taskTree });
  });

  test("root-contract sync clears stale ghosts without hiding the live active frontier", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const blockedLineage = [
      "fix-network-acns-retina-enterprise-run-172393474",
      "reconcile-spec-loop-pending-rp-regional-quota",
      "hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715",
      "ops/wait-project-approval-owner-return-primary-blocker-20260713",
      "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
    ];
    const reachableBlockedLineage = blockedLineage.slice(-2);
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: "2026-07-16T02:45:00.000Z",
          active_task_id: "domain/normalize-next-scenario-test-slice-20260716",
          active_task_ids: [
            "domain/normalize-next-scenario-test-slice-20260716",
          ],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: [
                "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
                "ops/wait-project-approval-owner-return-primary-blocker-20260713",
                "domain/normalize-scenario-tests-repo-frontier-20260715",
                "fix-localdns-auto-default-run-172310406",
                "domain/normalize-next-scenario-test-slice-20260716",
              ],
              context: {
                current_focus_proposal: {
                  reason:
                    "stale proposal reason active=[none] review-only frontier still carries waiting/runnable ghosts",
                  context: {
                    active_task_ids: [],
                    review_task_ids: [
                      "domain/normalize-scenario-tests-repo-frontier-20260715",
                      "fix-localdns-auto-default-run-172310406",
                      "ghost-review-archived-20260716",
                    ],
                    waiting_task_ids: ["ghost-wait-20260716"],
                    runnable_task_ids: ["ghost-runnable-20260716"],
                    blocked_task_ids: blockedLineage,
                    linked_blocked_task_ids: blockedLineage,
                    proposed_task_ids: [
                      "domain/normalize-scenario-tests-repo-frontier-20260715",
                      "fix-localdns-auto-default-run-172310406",
                      "ghost-review-archived-20260716",
                      "ghost-wait-20260716",
                      "ghost-runnable-20260716",
                      ...blockedLineage,
                    ],
                    success_criteria: [
                      "Focus metadata and mirrored runtime focusMission surfaces represent the current controller-visible root frontier as active=[none], review=[ghost-review-archived-20260716], waiting=[ghost-wait-20260716], runnable=[ghost-runnable-20260716].",
                      "Preserve the rest of the focus contract.",
                    ],
                    progress_review: {
                      answers: {
                        learned_or_verified: [
                          "The current controller-visible frontier is now a narrow 0-active / 3-review branch, not the older domain-heavy packet and not the earlier repair/publication slice seen at the start of this pass.",
                        ],
                        parallel_leafs:
                          "Parallel work is concrete but entirely review-based: 0 active, 3 review, 0 waiting, 0 runnable. Owner-loop throughput should come from processing these exact review leaves.",
                      },
                    },
                  },
                },
                current_root_readout: {
                  updated_at: "2026-07-16T02:44:59.000Z",
                  contract_scope:
                    "compact-loop ready-subset adjudication frontier + exact compact blocked holders",
                  excludes_task_id:
                    "ops/repair-current-focus-frontier-metadata-drift-20260716b",
                  active_task_ids_excluding_self: [],
                  active_task_ids_including_self: [],
                  review_task_ids: [
                    "domain/normalize-scenario-tests-repo-frontier-20260715",
                    "fix-localdns-auto-default-run-172310406",
                    "ghost-review-archived-20260716",
                  ],
                  waiting_task_ids: ["ghost-wait-20260716"],
                  runnable_task_ids: ["ghost-runnable-20260716"],
                  blocked_leaf_count: 5,
                  top_level_blocked_ids: [
                    "ops/wait-project-approval-owner-return-primary-blocker-20260713",
                    "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
                  ],
                  accepted_publication_leaf_id:
                    "domain/spec-windows-ready-subset-followup-20260715",
                  accepted_publication_leaf_live: false,
                },
              },
            },
            "domain/normalize-scenario-tests-repo-frontier-20260715": {
              id: "domain/normalize-scenario-tests-repo-frontier-20260715",
              parent_id: "project",
              state: "review",
              owner: "aks-explorer",
              children: [],
              goal: "Review repo-wide scenario normalization changes.",
            },
            "fix-localdns-auto-default-run-172310406": {
              id: "fix-localdns-auto-default-run-172310406",
              parent_id: "project",
              state: "review",
              owner: "aks-explorer",
              children: [],
              goal: "Review localdns auto-default follow-up.",
            },
            "domain/normalize-next-scenario-test-slice-20260716": {
              id: "domain/normalize-next-scenario-test-slice-20260716",
              parent_id: "project",
              state: "active",
              owner: "aks-explorer",
              children: [],
              goal: "Live repo-local normalization frontier that scope metadata must not hide.",
            },
            "fix-network-acns-retina-enterprise-run-172393474": {
              id: "fix-network-acns-retina-enterprise-run-172393474",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              owner: "aks-explorer",
              children: [],
              goal: "Exact blocked carrier for the fix-network follow-through.",
            },
            "reconcile-spec-loop-pending-rp-regional-quota": {
              id: "reconcile-spec-loop-pending-rp-regional-quota",
              parent_id: "aks-spec-verification-loop",
              state: "blocked",
              owner: "app-ops",
              children: [],
              goal: "Exact blocked public carrier.",
            },
            "hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715":
              {
                id: "hold-compact-rp-regional-quota-source-equivalent-evidence-ceiling-frontier-20260715",
                parent_id: "aks-feature-compact-loop",
                state: "blocked",
                owner: "aks-explorer",
                children: [],
                goal: "Exact compact blocked lineage carrier.",
              },
            "ops/wait-project-approval-owner-return-primary-blocker-20260713": {
              id: "ops/wait-project-approval-owner-return-primary-blocker-20260713",
              parent_id: "project",
              state: "blocked",
              owner: "app-ops",
              children: [],
              goal: "Carry the exact project approval wait.",
            },
            "wait-shared-westus2-managed-cluster-capacity-family-return-20260703":
              {
                id: "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
                parent_id: "project",
                state: "blocked",
                owner: "aks-explorer",
                children: [],
                goal: "Carry the exact shared capacity wait.",
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
    syncProjectReadout(config, "2026-07-16T02:45:30.000Z");

    const projectState = JSON.parse(
      await readFile(projectRuntimePaths(appDir).projectStatePath, "utf8"),
    );
    const taskTree = JSON.parse(
      await readFile(resolveTaskTreePath(appDir), "utf8"),
    );

    expect(
      taskTree.tasks.project.context.current_root_readout.review_task_ids,
    ).toEqual([
      "domain/normalize-scenario-tests-repo-frontier-20260715",
      "fix-localdns-auto-default-run-172310406",
    ]);
    expect(
      taskTree.tasks.project.context.current_root_readout.waiting_task_ids,
    ).toEqual([]);
    expect(
      taskTree.tasks.project.context.current_root_readout.runnable_task_ids,
    ).toEqual([]);
    expect(
      taskTree.tasks.project.context.current_focus_proposal.context
        .review_task_ids,
    ).toEqual([
      "domain/normalize-scenario-tests-repo-frontier-20260715",
      "fix-localdns-auto-default-run-172310406",
    ]);
    expect(
      taskTree.tasks.project.context.current_focus_proposal.context
        .waiting_task_ids,
    ).toEqual([]);
    expect(
      taskTree.tasks.project.context.current_focus_proposal.context
        .runnable_task_ids,
    ).toEqual([]);
    expect(
      taskTree.tasks.project.context.current_focus_proposal.context
        .proposed_task_ids,
    ).toEqual([
      "domain/normalize-next-scenario-test-slice-20260716",
      "domain/normalize-scenario-tests-repo-frontier-20260715",
      "fix-localdns-auto-default-run-172310406",
      ...reachableBlockedLineage,
    ]);
    expect(projectState.currentFocus.activeTaskIds).toEqual([
      "domain/normalize-next-scenario-test-slice-20260716",
    ]);
    expect(projectState.currentFocus.proposedTaskIds).toEqual([
      "domain/normalize-next-scenario-test-slice-20260716",
      "domain/normalize-scenario-tests-repo-frontier-20260715",
      "fix-localdns-auto-default-run-172310406",
      ...reachableBlockedLineage,
    ]);
    expect(projectState.currentFocus.focusMission.activeTaskIds).toEqual([
      "domain/normalize-next-scenario-test-slice-20260716",
    ]);
    expect(projectState.currentFocus.focusMission.reviewTaskIds).toEqual([
      "domain/normalize-scenario-tests-repo-frontier-20260715",
      "fix-localdns-auto-default-run-172310406",
    ]);
    expect(projectState.currentFocus.focusMission.waitingTaskIds).toEqual([]);
    expect(projectState.currentFocus.focusMission.runnableTaskIds).toEqual([]);
    expect(
      taskTree.tasks.project.context.current_focus_proposal.context
        .success_criteria[0],
    ).toBe(
      "Focus metadata and mirrored runtime focusMission surfaces represent the current controller-visible root frontier as active=[domain/normalize-next-scenario-test-slice-20260716], review=[domain/normalize-scenario-tests-repo-frontier-20260715, fix-localdns-auto-default-run-172310406], waiting=[none], runnable=[none].",
    );
    expect(
      taskTree.tasks.project.context.current_focus_proposal.context
        .progress_review.answers.learned_or_verified[0],
    ).toBe(
      "The current controller-visible root frontier is active=[domain/normalize-next-scenario-test-slice-20260716], review=[domain/normalize-scenario-tests-repo-frontier-20260715, fix-localdns-auto-default-run-172310406], waiting=[none], runnable=[none], blocked=2. Summary/frontier/packet should follow these live leaf ids rather than stale completed-review projections.",
    );
    expect(
      taskTree.tasks.project.context.current_focus_proposal.context
        .progress_review.answers.parallel_leafs,
    ).toBe(
      "Parallel work is concrete: 1 active, 2 review, 0 waiting, 0 runnable. Owner-loop throughput should come from these exact live frontier leaves.",
    );
    expect(projectState.currentFocus.focusMission.successCriteria[0]).toBe(
      "Focus metadata and mirrored runtime focusMission surfaces represent the current controller-visible root frontier as active=[domain/normalize-next-scenario-test-slice-20260716], review=[domain/normalize-scenario-tests-repo-frontier-20260715, fix-localdns-auto-default-run-172310406], waiting=[none], runnable=[none].",
    );
    expect(projectState.currentFocus.proposedTaskIds).not.toContain(
      "ghost-review-archived-20260716",
    );
    expect(projectState.currentFocus.proposedTaskIds).not.toContain(
      "ghost-wait-20260716",
    );
    expect(projectState.currentFocus.proposedTaskIds).not.toContain(
      "ghost-runnable-20260716",
    );
    expect(
      taskTree.tasks.project.context.current_focus_proposal.reason,
    ).toContain(
      "Current root-contract non-repair frontier is active=[domain/normalize-next-scenario-test-slice-20260716], review=[domain/normalize-scenario-tests-repo-frontier-20260715, fix-localdns-auto-default-run-172310406], waiting=[none], runnable=[none], blocked=2",
    );
    expectParitySurfaces({ projectState, taskTree });
  });

  test("root-contract sync refreshes the live focus-plan task metadata when its frontier prose drifts", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: "2026-07-17T02:20:00.000Z",
          active_task_id: "domain/live-active-20260717",
          active_task_ids: ["domain/live-active-20260717"],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: [
                "focus-live-frontier-20260717",
                "domain/live-active-20260717",
                "domain/live-review-20260717",
                "ops/wait-project-approval-owner-return-primary-blocker-20260713",
              ],
              context: {
                current_focus_proposal: {
                  reason: "stale proposal reason",
                  context: {
                    blocked_task_ids: [
                      "ops/wait-project-approval-owner-return-primary-blocker-20260713",
                    ],
                    linked_blocked_task_ids: [
                      "ops/wait-project-approval-owner-return-primary-blocker-20260713",
                    ],
                  },
                },
                current_root_readout: {
                  contract_scope: "live focus frontier parity",
                  top_level_blocked_ids: [
                    "ops/wait-project-approval-owner-return-primary-blocker-20260713",
                  ],
                },
              },
            },
            "focus-live-frontier-20260717": {
              id: "focus-live-frontier-20260717",
              parent_id: "project",
              kind: "focus_plan",
              state: "review",
              owner: "aks-explorer",
              children: [],
              goal: "Keep the visible focus branch truthful.",
              acceptance: [
                "This focus branch is the single visible 12-24h mission and truthfully represents the controller-visible current root frontier: active=[none], review=[focus-live-frontier-20260717], waiting=[none], runnable=[none].",
              ],
              context: {
                success_criteria: [
                  "Focus metadata and mirrored runtime focusMission surfaces represent the current controller-visible root frontier as active=[none], review=[focus-live-frontier-20260717], waiting=[none], runnable=[none].",
                ],
                progress_review: {
                  summary:
                    "The focus branch is refreshed to the current controller-visible 0-active/1-review frontier.",
                  evidence: [
                    "Focus progress review refreshed the stale success criteria and lane links to the current controller-visible 0-active/1-review frontier.",
                  ],
                  answers: {
                    learned_or_verified: [
                      "The current controller-visible frontier is now a narrow 0-active / 1-review branch.",
                    ],
                    parallel_leafs:
                      "Parallel work is concrete but entirely review-based: 0 active, 1 review, 0 waiting, 0 runnable. Owner-loop throughput should come from processing these exact review leaves.",
                  },
                },
                observations: {
                  frontier_active_leaf_count: 0,
                  frontier_review_leaf_count: 1,
                  frontier_waiting_leaf_count: 0,
                  frontier_runnable_leaf_count: 0,
                  frontier_blocked_leaf_count: 1,
                  parallel_work_gap:
                    "The current focus is entirely review-based: zero active leaves and no runnable backlog.",
                  structural_status:
                    "Focus metadata mirrors a stale review-only branch.",
                },
              },
            },
            "domain/live-active-20260717": {
              id: "domain/live-active-20260717",
              parent_id: "project",
              state: "active",
              owner: "aks-explorer",
              children: [],
              goal: "Live active branch.",
            },
            "domain/live-review-20260717": {
              id: "domain/live-review-20260717",
              parent_id: "project",
              state: "review",
              owner: "aks-explorer",
              children: [],
              goal: "Live review branch.",
            },
            "ops/wait-project-approval-owner-return-primary-blocker-20260713": {
              id: "ops/wait-project-approval-owner-return-primary-blocker-20260713",
              parent_id: "project",
              state: "blocked",
              owner: "app-ops",
              children: [],
              goal: "Carry the exact project approval wait.",
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
    syncProjectReadout(config, "2026-07-17T02:21:00.000Z");

    const taskTree = JSON.parse(
      await readFile(resolveTaskTreePath(appDir), "utf8"),
    );
    const focusTask = taskTree.tasks["focus-live-frontier-20260717"];

    expect(focusTask.acceptance[0]).toBe(
      "This focus branch is the single visible 12-24h mission and truthfully represents the controller-visible current root frontier: active=[domain/live-active-20260717], review=[domain/live-review-20260717, focus-live-frontier-20260717], waiting=[none], runnable=[none].",
    );
    expect(focusTask.context.success_criteria[0]).toBe(
      "Focus metadata and mirrored runtime focusMission surfaces represent the current controller-visible root frontier as active=[domain/live-active-20260717], review=[domain/live-review-20260717, focus-live-frontier-20260717], waiting=[none], runnable=[none].",
    );
    expect(focusTask.context.progress_review.summary).toBe(
      "The focus branch is refreshed to the current controller-visible root frontier active=[domain/live-active-20260717], review=[domain/live-review-20260717, focus-live-frontier-20260717], waiting=[none], runnable=[none]. The visible branch must track live active/review leaves rather than stale completed-review projections.",
    );
    expect(focusTask.context.progress_review.evidence[0]).toBe(
      "Focus progress review refreshed stale focus-branch frontier metadata to current controller-visible root frontier active=[domain/live-active-20260717], review=[domain/live-review-20260717, focus-live-frontier-20260717], waiting=[none], runnable=[none].",
    );
    expect(focusTask.context.progress_review.answers.parallel_leafs).toBe(
      "Parallel work is concrete: 1 active, 2 review, 0 waiting, 0 runnable. Owner-loop throughput should come from these exact live frontier leaves.",
    );
    expect(focusTask.context.observations.frontier_active_leaf_count).toBe(1);
    expect(focusTask.context.observations.frontier_review_leaf_count).toBe(2);
    expect(focusTask.context.observations.parallel_work_gap).toBe(
      "The current focus carries 1 active, 2 review, 0 waiting, and 0 runnable leaves.",
    );
    expect(focusTask.context.review_task_ids).toEqual([
      "domain/live-review-20260717",
      "focus-live-frontier-20260717",
    ]);
  });
});
