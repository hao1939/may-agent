# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3702)

Date: 2026-07-14
Owner: app-ops
Chosen operation: `waiting_with_evidence`

## Metric facts checked

- metric id: `aks-rp-e2e.process.unpublished-change-count`
- alert id: `3702`
- runtime metric row at triage time: `current=13`, `threshold=0`, `target=0`, `priority=P0`
- fresh recompute from `/app/projects/aks-rp-e2e.app`: `{"value":16}`
- domain repo branch relation: `dev...origin/dev` with no `[ahead N]` marker and `git rev-list --left-right --count @{upstream}...HEAD = 0 0`

## Live unpublished surface

Current domain repo status in `/app/projects/aks-rp-e2e` is exactly:

```text
 M features/net-integration/packets/multinic-dualstack.yaml
 M features/net-integration/packets/multinic-mixed.yaml
 M features/net-integration/specs/net-integration-multinic-dualstack.json
 M features/net-integration/specs/net-integration-multinic-mixed.json
 M features/net-integration/tests/net-integration-multinic-dualstack.test.ts
 M features/net-integration/tests/net-integration-multinic-dualstack.ts
 M features/net-integration/tests/net-integration-multinic-mixed.test.ts
 M features/net-integration/tests/net-integration-multinic-mixed.ts
 M features/network-cni/specs/network-cni-azure-overlay-ilpip.json
 M features/network-cni/specs/network-cni-vm-prerelease-overlay-cilium-dualstack.json
 M features/network-cni/tests/network-cni-azure-overlay-ilpip.ts
 M features/network-cni/tests/network-cni-vm-prerelease-overlay-cilium-dualstack.test.ts
 M features/network-cni/tests/network-cni-vm-prerelease-overlay-cilium-dualstack.ts
 M features/secops/compact/staging.diagnostics.json
 M features/secops/compact/staging.summary.md
?? features/net-integration/tests/multinic-live-common.ts
```

That is `15` tracked changes plus `1` untracked file, which matches the producer's current `value=16`.

## Exact owner-visible waiting state

This is a real current breach, but it is already represented by exact domain work rather than anonymous repo residue.

### 1. Net-integration multinic carrier authoring

- Task: `domain/author-net-integration-multinic-live-carrier-pair-20260714`
- State: `active`
- Owner: `aks-explorer`
- Goal covers the dirty multinic packet/spec/test files and the new helper file `features/net-integration/tests/multinic-live-common.ts`.
- Session: `s_task_domain_author-net-integration-multinic-live-carrier-pair-20260714`
- Session row currently shows `status='running'`, `source='workflow:task-worker'`, `opCount=88`, and fresh `lastActivityAt`.

### 2. Network-CNI overlay carrier authoring

- Task: `domain/author-network-cni-overlay-live-carrier-pair-20260714`
- State: `review`
- Owner: `aks-explorer`
- Task evidence lists the exact dirty Network-CNI files:
  - `features/network-cni/specs/network-cni-azure-overlay-ilpip.json`
  - `features/network-cni/tests/network-cni-azure-overlay-ilpip.ts`
  - `features/network-cni/specs/network-cni-vm-prerelease-overlay-cilium-dualstack.json`
  - `features/network-cni/tests/network-cni-vm-prerelease-overlay-cilium-dualstack.ts`
  - `features/network-cni/tests/network-cni-vm-prerelease-overlay-cilium-dualstack.test.ts`
- Session `s_task_domain_author-network-cni-overlay-live-carrier-pair-20260714` is already `done` in the sessions table and awaiting planner review/acceptance.

### 3. Secops compact parity reconciliation

- Task: `domain/reconcile-secops-compact-summary-diagnostics-parity-20260714`
- State: `active`
- Owner: `aks-explorer`
- Acceptance text explicitly covers:
  - `features/secops/compact/staging.summary.md`
  - `features/secops/compact/staging.diagnostics.json`
- Session: `s_task_domain_reconcile-secops-compact-summary-diagnostics-parity-20260714_ecops-compact-summary-diagnostics-parity-20260714_20260714181000`
- Session row currently shows `status='running'`, `source='workflow:task-worker'`, `opCount=37`, and fresh `lastActivityAt`.

## Judgment

Choose `waiting_with_evidence`.

Reason: the alert is real and currently worse than the persisted row (`16` live vs `13` stored), but app-ops should not checkpoint, revert, or otherwise publish these repo-local domain edits while they are still inside two active domain tasks and one review-owned domain task. There are no unpublished commits to push, so this is not a simple publication backlog. The smallest truthful next move is to let the represented domain tasks finish and for planner review to accept or reject the review-owned Network-CNI slice before any checkpoint/push decision.

## Not chosen

- Not `fix_root_cause`: there is no safe app-ops-only fix because the remaining surface is uncommitted domain work, not an ahead-of-origin commit backlog.
- Not `resolve_stale`: fresh recompute still breaches and shows `16`.
- Not `calibrate_metric`: threshold `0` remains correct because these repo-local changes are still invisible to pipeline consumers.
- Not `downgrade_priority`: the breach is active and blocks pipeline-visible publication hygiene.
- Not `document_exception`: this is temporary task-owned work, not an accepted long-term exception.
- Not `upgrade_or_escalate`: exact owner paths already exist and no destructive or human-only action is required yet.

## Next validation

Validate on the next `metrics-snapshot`, or sooner after these exact task-state changes:

1. `domain/author-net-integration-multinic-live-carrier-pair-20260714` stops running,
2. `domain/reconcile-secops-compact-summary-diagnostics-parity-20260714` stops running,
3. planner review applies a decision to `domain/author-network-cni-overlay-live-carrier-pair-20260714`.

Recovery is proven only when a fresh recompute returns `0` and `/app/projects/aks-rp-e2e` shows no dirty paths and no ahead commits.
