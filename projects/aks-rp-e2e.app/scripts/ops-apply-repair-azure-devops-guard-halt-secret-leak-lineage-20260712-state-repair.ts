import { resolve } from "node:path";
import {
  taskTreeConfig,
  saveTaskTreeWithKanbanSnapshot,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const taskId =
  "ops-apply-repair-azure-devops-guard-halt-secret-leak-lineage-20260712-st";
const reviewedTaskId =
  "ops/repair-azure-devops-guard-halt-secret-leak-lineage-20260712";
const attemptId =
  "a_ops-apply-repair-azure-devops-guard-halt-secret-leak-lineage-20260712-st_20260712100531";
const evidencePath =
  "evidence/archive/ops-apply-repair-azure-devops-guard-halt-secret-leak-lineage-20260712-state-repair.md";
const packetPath =
  "evidence/archive/ops-escalate-azure-devops-auth-runtime-provider-for-unpublished-ahead5-20260712-packet.md";
const pathId = "shared-azure-devops-auth-capable-runtime-20260709";
const approvalId =
  "aks-rp-e2e:approval:shared-azure-devops-auth-capable-runtime-20260709:evidence-archive-ops-escalate-azure-devops-auth-runtime-provider-for-unpublished-ahead5-20260712-packet.md";
const waitId =
  "wait:aks-rp-e2e:approval:shared-azure-devops-auth-capable-runtime-20260709:evidence-archive-ops-escalate-azure-devops-auth-runtime-provider-for-unpublished-ahead5-20260712-packet.md";
const checkedAt = new Date().toISOString();
const nextCheckAt = "2026-07-12T20:40:00Z";
const fallbackAt = "2026-07-13T20:40:00Z";

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const result = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const task = tree.tasks[taskId];
  if (!task) throw new Error(`Task not found: ${taskId}`);

  task.goal =
    "Carry the exact returned owner/runtime wait for the 2026-07-12 Azure DevOps auth publication lineage so the current ahead-5 unpublished dev stack stays represented by one truthful blocked wait until a bounded approval return or reviewed auth-capable publication proof lands.";
  task.acceptance = [
    "The live blocker preserves the exact 2026-07-12 Azure DevOps publication approval lineage for pathId shared-azure-devops-auth-capable-runtime-20260709, including packetPath, approvalId, waitId, send-proof events 3080537/3080540, and the bounded resume trigger for a returned owner/runtime decision or reviewed auth-capable publication proof.",
    "The branch remains separate from the combined authenticated artifact-recovery family wait because this blocker is specifically about making the ahead-5 unpublished dev stack truthfully origin-visible on Azure DevOps rather than recovering downstream run artifacts.",
  ];

  task.state = "blocked";
  task.status = "blocked";
  task.result =
    "Applied the truthful next state by restoring this branch as the exact blocked owner/runtime return wait for the unpublished ahead-5 Azure DevOps auth publication lineage.";
  task.blocker = {
    condition:
      "Blocked on returned owner/runtime decision or reviewed auth-capable publication proof for the already-sent 2026-07-12 Azure DevOps auth/runtime escalation covering the current ahead-5 unpublished dev stack. Durable send proof already exists via project.approval.requested 3080537 and message.created 3080540 for pathId shared-azure-devops-auth-capable-runtime-20260709 using packet evidence/archive/ops-escalate-azure-devops-auth-runtime-provider-for-unpublished-ahead5-20260712-packet.md, while the current runtime still fails git push --dry-run origin dev because /app/.state/.local/bin/git-credential-azdevops shells out to az account get-access-token and az is missing. Keep this as one exact publication/auth wait, separate from the combined authenticated artifact-recovery family wait, until the first reviewed owner return or working auth-capable publication path materially changes the ahead-5 publication state.",
    category: "external-wait",
    owner: "human",
    blocked_at: checkedAt,
    waiting_for: {
      type: "project.approval.submitted",
      approvalKind: "approval-packet-dispatch",
      taskId,
      pathId,
      packetPath,
      approvalId,
      waitId,
      acceptedDecisions: ["approve", "adjust", "hold", "decline", "reroute"],
    },
    observed_by: {
      workflow: "project-planner",
      trigger: "project.approval.submitted",
    },
    observation_method:
      "Planner/app-ops should reconcile the returned project.approval.submitted event or equivalent reviewed same-lineage publication proof into this exact publication/auth wait before any further publication planning.",
    next_check_at: nextCheckAt,
    resume_condition:
      "Resume only when project.approval.submitted returns approve, adjust, hold, decline, or reroute for approvalId aks-rp-e2e:approval:shared-azure-devops-auth-capable-runtime-20260709:evidence-archive-ops-escalate-azure-devops-auth-runtime-provider-for-unpublished-ahead5-20260712-packet.md / waitId wait:aks-rp-e2e:approval:shared-azure-devops-auth-capable-runtime-20260709:evidence-archive-ops-escalate-azure-devops-auth-runtime-provider-for-unpublished-ahead5-20260712-packet.md, or when reviewed proof shows both az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798 --query accessToken -o tsv and git push --dry-run origin dev succeed from /app/projects/aks-rp-e2e, or when one approved alternate publication path makes the current ahead-5 stack truthfully origin-visible on dev.",
    resume_at: nextCheckAt,
    fallback_at: fallbackAt,
    fallback_action:
      "If no same-lineage return or reviewed auth-capable publication proof lands by fallback, refresh or escalate the same Azure DevOps publication approval lineage instead of treating the artifact-recovery family wait as a substitute for this unpublished-state blocker.",
  };

  const context =
    task.context && typeof task.context === "object" && !Array.isArray(task.context)
      ? { ...(task.context as Record<string, unknown>) }
      : {};
  task.context = {
    ...context,
    repairedPublicationWait: {
      sourceReviewedTaskId: reviewedTaskId,
      repairedAt: checkedAt,
      evidencePath,
      packetPath,
      pathId,
      approvalId,
      waitId,
      supersededByCombinedArtifactWait: false,
      note:
        "The combined shared auth/runtime artifact-recovery family wait remains separate; this branch restores the unpublished ahead-5 Azure DevOps publication blocker as its own exact owner-return wait.",
    },
  };

  task.trace = {
    ...(task.trace ?? {}),
    current_attempt_id: undefined,
    blocked_wait_refreshed_at: checkedAt,
    blocked_wait_refreshed_by: "app-ops-script",
    blocked_wait_refresh_summary:
      "Restored the unpublished ahead-5 Azure DevOps publication blocker as its own exact approval-return wait on the 2026-07-12 send lineage.",
    previous_nonterminal_status: "active",
    azure_devops_publication_wait_repaired_at: checkedAt,
    azure_devops_publication_wait_repaired_by: "app-ops-script",
    azure_devops_publication_wait_repair_attempt_id: attemptId,
    azure_devops_publication_wait_repair_evidence_path: evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    taskId,
    pathId,
    approvalId,
    waitId,
    evidencePath,
    packetPath,
    nextCheckAt,
    fallbackAt,
    state: task.state,
    status: task.status,
  };
});

console.log(JSON.stringify(result, null, 2));
