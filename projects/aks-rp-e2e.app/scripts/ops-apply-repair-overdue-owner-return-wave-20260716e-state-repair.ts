import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  refreshBlockedWait,
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
  updateTaskOutputs,
  updateTaskText,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

type MutableRecord = Record<string, unknown>;

type Target = {
  taskId: string;
  outputs: string[];
  condition: string;
  summary: string;
};

type TaskSnapshot = {
  state: string | null;
  result: string | null;
  outputs: string[];
  blocker: MutableRecord | null;
  trace: MutableRecord | null;
};

type FileFingerprint = {
  exists: boolean;
  sha256: string | null;
  size: number | null;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();
const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-repair-overdue-owner-return-wave-20260716e-state-repair_20260716190226";
const sourceMemoPath = "evidence/archive/ops-repair-overdue-owner-return-wave-20260716e.md";
const evidencePath =
  "evidence/archive/ops-apply-repair-overdue-owner-return-wave-20260716e-state-repair.md";
const nextCheckAt = "2026-07-17T18:00:00Z";
const resumeAt = "2026-07-17T18:00:00Z";
const fallbackAt = "2026-07-18T18:00:00Z";

const targets: Target[] = [
  {
    taskId:
      "wait-ccp-security-patch-reviewed-exception-owner-response-20260708",
    outputs: [
      "../aks-rp-e2e/evidence/archive/ops-send-ccp-security-patch-owner-packet-20260708.md",
      "../aks-rp-e2e/evidence/archive/spec-loop-overdue-owner-response-third-contact-packet-20260709.md",
      "../aks-rp-e2e/evidence/archive/domain-review-ccp-security-patch-mariner-v2-mounted-source-rehome-20260712.md",
      sourceMemoPath,
      evidencePath,
    ],
    condition:
      "2026-07-16T18:59:30Z overdue owner-return audit revalidated that mounted /app/sources/aks-rp/test/e2ev3/sigs/ccp/plans/security_patch.go:GetSecurityPatchRunnerScenarios, /app/sources/aks-rp/test/e2ev3/sigs/ccp/suites/plannedmaintenance/security_patch.go, and /app/sources/aks-rp/test/e2ev3/sigs/ccp/suites/runner.go still authorize and route only Ubuntu, AzureLinux, Ubuntu2404, and AzureLinux kubelet-patching prod CCP security-patch scenarios. No authoritative Windows2022 or Windows2025 prod scenario exists in mounted source, and the existing 2026-07-08 owner/source-authority packet plus 2026-07-09 chase lineage still govern this exact Windows-only frontier with no controller-visible returned decision. Keep this one exact Windows source-authority wait; do not reopen unchanged reruns.",
    summary:
      "2026-07-16 apply repair refreshed the exact Windows CCP owner-return wait with reviewed lineage outputs and 2026-07-17/2026-07-18 watch values.",
  },
  {
    taskId:
      "wait-kms-v2-private-kv-konnectivity-feature-flag-return-20260706",
    outputs: [
      "../aks-rp-e2e/evidence/archive/ops-repair-kms-private-kv-konnectivity-owner-ask-lineage-20260710.md",
      sourceMemoPath,
      evidencePath,
    ],
    condition:
      "2026-07-16T18:59:30Z overdue owner-return audit revalidated that spec.kms.v2-enable-on-existing-private-kv-lifecycle is still blocked on the same reviewed execution-subscription capability boundary: Microsoft.ContainerService/AllowEnalbeKMSPrivateKeyVaultKonnectivityTunnel on subscription 26fe00f8-9173-4872-9134-bb1d2e00343a. The exact owner ask lineage already exists in evidence/archive/ops-repair-kms-private-kv-konnectivity-owner-ask-lineage-20260710.md and the approval-dispatch ledger row from 2026-07-01T13:41:21.702Z still proves the packet was routed. No controller-visible returned approval or alternate approved execution subscription is recorded, so keep this exact capability wait and do not reopen an unchanged rerun.",
    summary:
      "2026-07-16 apply repair refreshed the exact KMS private-KV capability wait with reviewed lineage outputs and 2026-07-17/2026-07-18 watch values.",
  },
  {
    taskId: "wait-nap-execution-surface-family-return-20260705",
    outputs: [
      "../aks-rp-e2e/evidence/archive/author-nap-aksmanagedap-owner-approved-carrier-selection-packet-20260705b.md",
      "../aks-rp-e2e/evidence/archive/send-nap-aksmanagedap-caller-surface-owner-approval-handoff-20260705.md",
      "../aks-rp-e2e/evidence/archive/repair-nap-mounted-source-surface-exhaustion-20260705.md",
      sourceMemoPath,
      evidencePath,
    ],
    condition:
      "2026-07-16T18:59:30Z overdue owner-return audit revalidated that the NAP full-cleanup path is still blocked only on the already-sent owner-approved execution-surface ask. evidence/archive/author-nap-aksmanagedap-owner-approved-carrier-selection-packet-20260705b.md still preserves the exact Auto + PutMachine / aksmanagedap gate, evidence/archive/send-nap-aksmanagedap-caller-surface-owner-approval-handoff-20260705.md still proves the 2026-07-05 approval-dispatch handoff was accepted, and evidence/archive/repair-nap-mounted-source-surface-exhaustion-20260705.md still shows no truthful checked-in or mounted local successor. No controller-visible returned approval, decline, or reroute is recorded, so keep this one exact execution-surface wait and do not reopen an unchanged rerun.",
    summary:
      "2026-07-16 apply repair refreshed the exact NAP execution-surface wait with reviewed lineage outputs and 2026-07-17/2026-07-18 watch values.",
  },
  {
    taskId:
      "wait-network-swift-v1-returned-artifacts-28825349625-28825356807-20260710",
    outputs: [
      "../aks-rp-e2e/evidence/archive/ops-review-network-swift-v1-returned-artifacts-wait-20260711.md",
      sourceMemoPath,
      evidencePath,
    ],
    condition:
      "2026-07-16T18:59:30Z overdue owner-return audit revalidated that July 6 network-swift-v1 reruns 28825349625 and 28825356807 still have no locally reviewable returned artifacts. Fresh scans under /app/projects/aks-rp-e2e/workspace, /app/projects/aks-rp-e2e/evidence/archive, and /app/projects/aks-rp-e2e.app/.state found no artifact files/directories for either run id, and live GitHub API recovery with the currently exposed GH_TOKEN still returns HTTP 401 for both run metadata and artifact endpoints. Keep this exact two-run returned-artifact wait; resume only when one exact member becomes reviewable locally or a reviewed same-path successor explicitly supersedes it. Do not queue another unchanged rerun.",
    summary:
      "2026-07-16 apply repair refreshed the exact network-swift returned-artifact wait with reviewed lineage outputs and 2026-07-17/2026-07-18 watch values.",
  },
  {
    taskId:
      "wait-private-cluster-jumpbox-key-execution-surface-return-20260704",
    outputs: [
      "../aks-rp-e2e/evidence/archive/private-cluster-shared-jumpbox-key-execution-surface-owner-packet-20260704.md",
      "../aks-rp-e2e/evidence/archive/ops-send-private-cluster-jumpbox-key-execution-surface-followup-20260710.md",
      "../aks-rp-e2e/evidence/archive/ops-repair-private-cluster-jumpbox-followup-lineage-20260711.md",
      sourceMemoPath,
      evidencePath,
    ],
    condition:
      "2026-07-16T18:59:30Z overdue owner-return audit revalidated that the private-cluster AzurePublicCloud private-path family is still blocked on the same missing prerequisite, AKS_RP_E2E_JUMPBOX_SSH_PRIVATE_KEY, or an owner-approved equivalent execution surface. The original 2026-07-04 handoff proof and the 2026-07-10 follow-up lineage both still exist in approval-dispatch ledger rows and durable evidence notes, including the explicit follow-up approval/wait identifiers, and no controller-visible returned approval, decline, or reroute is recorded. Keep this one exact family wait and do not open duplicate sibling waits or unchanged reruns.",
    summary:
      "2026-07-16 apply repair refreshed the exact private-cluster jumpbox-key wait with reviewed lineage outputs and 2026-07-17/2026-07-18 watch values.",
  },
];

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function asRecord(value: unknown): MutableRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? ({ ...(value as MutableRecord) } as MutableRecord)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}

function snapshot(task: TaskNode): TaskSnapshot {
  return {
    state: asString(task.state),
    result: asString((task as TaskNode & { result?: unknown }).result),
    outputs: asStringArray(task.outputs),
    blocker: asRecord(task.blocker),
    trace: asRecord(task.trace),
  };
}

function blockerPatch(before: MutableRecord, target: Target): MutableRecord {
  return {
    ...before,
    condition: target.condition,
    next_check_at: nextCheckAt,
    resume_at: resumeAt,
    fallback_at: fallbackAt,
  };
}

function fingerprint(path: string): FileFingerprint {
  if (!existsSync(path)) {
    return { exists: false, sha256: null, size: null };
  }
  const content = readFileSync(path);
  return {
    exists: true,
    sha256: createHash("sha256").update(content).digest("hex"),
    size: content.byteLength,
  };
}

function sameFingerprint(a: FileFingerprint, b: FileFingerprint): boolean {
  return a.exists === b.exists && a.sha256 === b.sha256 && a.size === b.size;
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeEvidence(content: string): void {
  const absolute = resolve(appDir, evidencePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf8");
}

const specLoopPath = resolve(appDir, ".state/spec-loop/state.json");
const featureCompactLoopPath = resolve(appDir, ".state/feature-compact-loop/state.json");
const specLoopBefore = fingerprint(specLoopPath);
const featureCompactBefore = fingerprint(featureCompactLoopPath);

const beforeTree = readTaskTree(config);
const preAuditContributorSet = targets.map((target) => target.taskId).sort((a, b) => a.localeCompare(b));
const beforeSnapshots = Object.fromEntries(
  targets.map((target) => {
    const task = beforeTree.tasks[target.taskId] as TaskNode | undefined;
    assert(task, `Task not found before repair: ${target.taskId}`);
    return [target.taskId, snapshot(task)];
  }),
) as Record<string, TaskSnapshot>;

for (const target of targets) {
  const before = beforeSnapshots[target.taskId];
  assert(before.state === "blocked", `Expected ${target.taskId} to be blocked before repair`);
  assert(before.blocker, `Expected ${target.taskId} to have a structured blocker before repair`);
  const resumeCondition = asString(before.blocker.resume_condition);
  const fallbackAction = asString(before.blocker.fallback_action);
  const category = asString(before.blocker.category) ?? "external-wait";
  const owner = asString(before.blocker.owner) ?? "human";
  assert(resumeCondition, `Expected ${target.taskId} blocker.resume_condition before repair`);
  assert(fallbackAction, `Expected ${target.taskId} blocker.fallback_action before repair`);

  refreshBlockedWait(config, {
    taskId: target.taskId,
    condition: target.condition,
    resumeCondition,
    summary: target.summary,
    category,
    owner,
    nextCheckAt,
    fallbackAt,
    fallbackAction,
  });

  updateTaskText(config, {
    taskId: target.taskId,
    blocker: blockerPatch(before.blocker, target),
  });

  updateTaskOutputs(config, {
    taskId: target.taskId,
    outputs: target.outputs,
  });
}

withTreeLock(config, () => {
  const tree = readTaskTree(config);
  for (const target of targets) {
    const task = tree.tasks[target.taskId] as TaskNode | undefined;
    assert(task, `Task missing during trace patch: ${target.taskId}`);
    const trace = asRecord(task.trace) ?? {};
    task.trace = {
      ...trace,
      blocked_wait_refreshed_at: appliedAt,
      blocked_wait_refreshed_by: worker,
      blocked_wait_refresh_summary: target.summary,
      overdue_owner_return_wave_apply_attempt_id: attemptId,
      overdue_owner_return_wave_apply_evidence_path: evidencePath,
      overdue_owner_return_wave_apply_source_memo_path: sourceMemoPath,
      current_attempt_id: undefined,
    };
  }
  saveTaskTreeWithKanbanSnapshot(config, tree);
});

const afterTree = readTaskTree(config);
const afterSnapshots = Object.fromEntries(
  targets.map((target) => {
    const task = afterTree.tasks[target.taskId] as TaskNode | undefined;
    assert(task, `Task missing after repair: ${target.taskId}`);
    return [target.taskId, snapshot(task)];
  }),
) as Record<string, TaskSnapshot>;

for (const target of targets) {
  const after = afterSnapshots[target.taskId];
  const blocker = after.blocker;
  assert(after.state === "blocked", `Expected ${target.taskId} to remain blocked after repair`);
  assert(after.result === target.summary, `Unexpected result summary for ${target.taskId}`);
  assert(blocker, `Expected ${target.taskId} blocker after repair`);
  assert(blocker.condition === target.condition, `Unexpected blocker.condition for ${target.taskId}`);
  assert(blocker.next_check_at === nextCheckAt, `Unexpected next_check_at for ${target.taskId}`);
  assert(blocker.resume_at === resumeAt, `Unexpected resume_at for ${target.taskId}`);
  assert(blocker.fallback_at === fallbackAt, `Unexpected fallback_at for ${target.taskId}`);
  assert(
    JSON.stringify(after.outputs) === JSON.stringify(target.outputs),
    `Unexpected outputs for ${target.taskId}`,
  );
  const trace = after.trace ?? {};
  assert(
    trace.overdue_owner_return_wave_apply_attempt_id === attemptId,
    `Missing apply attempt trace for ${target.taskId}`,
  );
  assert(
    trace.overdue_owner_return_wave_apply_evidence_path === evidencePath,
    `Missing apply evidence trace for ${target.taskId}`,
  );
}

const specLoopAfter = fingerprint(specLoopPath);
const featureCompactAfter = fingerprint(featureCompactLoopPath);
const postActionRepresentedSet = targets.map((target) => target.taskId).sort((a, b) => a.localeCompare(b));

const evidenceLines: string[] = [
  "# Ops apply repair — overdue owner-return wave `20260716e`",
  "",
  `Task: \`ops-apply-repair-overdue-owner-return-wave-20260716e-state-repair\``,
  `Attempt: \`${attemptId}\``,
  `Applied at: \`${appliedAt}\``,
  `Source memo: \`${sourceMemoPath}\``,
  "Mode: supported app state repair via task-tree helpers only",
  "",
  "## Scope",
  "",
  "Applied the reviewed metadata refresh plan from `evidence/archive/ops-repair-overdue-owner-return-wave-20260716e.md` to these five live blocked holders:",
  "",
  ...targets.map((target, index) => `${index + 1}. \`${target.taskId}\``),
  "",
  "Pre-audit contributor set (computed without suppressing this repair task itself) and post-action represented set are the same five wait ids above; the repair changed lineage metadata and watch windows only.",
  "",
  "## Supported mutation path",
  "",
  "- `refreshBlockedWait(...)` from `workflows/lib/task-tree-tools.ts` refreshed each live blocked wait result/trace and advanced the watch window.",
  "- `updateTaskText(...)` then restored the exact reviewed `blocker.condition`, preserving the existing structured blocker contract while setting `next_check_at`, `resume_at`, and `fallback_at` to the reviewed values.",
  "- `updateTaskOutputs(...)` replaced generic outputs with the exact lineage artifacts plus the reviewed source memo and this repair memo.",
  "- `saveTaskTreeWithKanbanSnapshot(...)` recorded trace lineage for this apply attempt.",
  "- No project/runtime events were emitted. No runtime task-tree file was edited directly.",
  "",
  "## Before → after verification",
  "",
  "| wait id | before outputs count | after outputs count | before next/resume/fallback | after next/resume/fallback | source memo condition applied? | apply trace recorded? |",
  "| --- | ---: | ---: | --- | --- | --- | --- |",
  ...targets.map((target) => {
    const before = beforeSnapshots[target.taskId];
    const after = afterSnapshots[target.taskId];
    const beforeBlocker = before.blocker ?? {};
    const afterBlocker = after.blocker ?? {};
    const beforeWindow = `${asString(beforeBlocker.next_check_at) ?? ""} / ${asString(beforeBlocker.resume_at) ?? ""} / ${asString(beforeBlocker.fallback_at) ?? ""}`;
    const afterWindow = `${asString(afterBlocker.next_check_at) ?? ""} / ${asString(afterBlocker.resume_at) ?? ""} / ${asString(afterBlocker.fallback_at) ?? ""}`;
    const appliedCondition = afterBlocker.condition === target.condition ? "yes" : "no";
    const appliedTrace = after.trace?.overdue_owner_return_wave_apply_attempt_id === attemptId ? "yes" : "no";
    return `| \`${target.taskId}\` | ${before.outputs.length} | ${after.outputs.length} | ${beforeWindow} | ${afterWindow} | ${appliedCondition} | ${appliedTrace} |`;
  }),
  "",
  "## Per-wait repaired outputs",
  "",
  ...targets.flatMap((target) => [
    `### \`${target.taskId}\``,
    "",
    ...target.outputs.map((output) => `- \`${output}\``),
    "",
  ]),
  "## Loop-state touch check",
  "",
  `- \`.state/spec-loop/state.json\`: ${sameFingerprint(specLoopBefore, specLoopAfter) ? "unchanged" : "changed"}`,
  `- \`.state/feature-compact-loop/state.json\`: ${sameFingerprint(featureCompactBefore, featureCompactAfter) ? "unchanged" : "changed"}`,
  "",
  "Fingerprints:",
  "",
  "```json",
  json({
    specLoop: { before: specLoopBefore, after: specLoopAfter },
    featureCompactLoop: {
      before: featureCompactBefore,
      after: featureCompactAfter,
    },
  }).trimEnd(),
  "```",
  "",
  "## Canonical reviewer read commands",
  "",
  ...targets.map(
    (target) =>
      `- \`cd /app/projects/aks-rp-e2e.app && bun run task-tree show ${target.taskId}\``,
  ),
  "",
  "These live reads should show the reviewed blocker text, exact outputs, and `2026-07-17T18:00:00Z` / `2026-07-18T18:00:00Z` watch window values.",
];

writeEvidence(`${evidenceLines.join("\n")}\n`);

console.log(
  JSON.stringify(
    {
      attemptId,
      appliedAt,
      evidencePath,
      sourceMemoPath,
      preAuditContributorSet,
      postActionRepresentedSet,
      loopStateChanges: {
        specLoopChanged: !sameFingerprint(specLoopBefore, specLoopAfter),
        featureCompactLoopChanged: !sameFingerprint(
          featureCompactBefore,
          featureCompactAfter,
        ),
      },
      waits: targets.map((target) => ({
        taskId: target.taskId,
        outputs: afterSnapshots[target.taskId].outputs,
        blocker: afterSnapshots[target.taskId].blocker,
        trace: afterSnapshots[target.taskId].trace,
      })),
    },
    null,
    2,
  ),
);
