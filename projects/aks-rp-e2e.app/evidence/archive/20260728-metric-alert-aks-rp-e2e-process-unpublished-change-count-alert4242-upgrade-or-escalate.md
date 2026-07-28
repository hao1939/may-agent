# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 4242)

- Alert id: `4242`
- Judged at: `2026-07-28T10:29:24Z`
- Chosen operation: `upgrade_or_escalate`
- Metric owner: `app-ops`
- Metric priority: `P0`

## Current measurement is still real

Current runtime state is still breaching:

- metric id: `aks-rp-e2e.process.unpublished-change-count`
- `current = 38`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1785247763227`
- `source_command = bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count --json`

Recent snapshots show the breach is current and stable rather than transient:

- `38` at `1785247763227`
- `38` at `1785247438618`
- `38` at `1785247115698`
- `38` at `1785246811064`
- `38` at `1785246460501`
- `38` at `1785246145205`
- `38` at `1785245826735`
- `38` at `1785245494917`
- `38` at `1785245181870`
- `38` at `1785244855979`

A fresh owner-side recompute from `/app/projects/aks-rp-e2e.app` still matches the runtime value:

```json
{"measuredAt":1785248022844,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":38}
```

Current repo truth in `/app/projects/aks-rp-e2e` is a dirty worktree with no local-only commits:

- branch: `dev...origin/dev [behind 80]`
- tracked modified paths: `38`
- local-only commits: `0`

Comparing the dirty paths to `origin/dev` shows this is a mixed surface:

- `35` paths still differ from `origin/dev`, so they are still pipeline-invisible residue
- `3` paths (`README.md`, `features/ccp-coredns/compact/staging.summary.md`, `runner/scenario-lib/azure-resource.ts`) already match `origin/dev`, so the metric is also catching local branch drift that has not been reabsorbed into the checkout

The current 38-path surface is:

- `README.md`
- `3` under `features/ccp-coredns/*`
- `3` under `features/cost-analysis/*`
- `2` under `features/gpu/*`
- `3` under `features/managedsystem-pool/*`
- `3` under `features/master-validation-rp/*`
- `1` under `features/network-cni/*`
- `3` under `features/remediator-node-not-ready-restart/*`
- `3` under `features/rp-cluster-lifecycle/*`
- `3` under `features/rp-master-validation/*`
- `1` under `features/sgx-addon-vm-prerelease-matrix/*`
- `1` under `features/upgrade/*`
- `7` generated `model/knowledge-map/*` outputs
- `4` runner files under `runner/scenario-lib/*` and `runner/vitest-runtime/*`

## Current represented vs unrepresented residue

Several dirty families are still represented by live holders or exact waits:

- `features/cost-analysis/*` remains under app-ops approval wait `ops/request-approval-canonical-root-cost-analysis-compact-residue-cleanup-20260727`
- `features/network-cni/specs/network-acns-security-fqdn-filtering.json` remains under app-ops wait `ops/reconcile-canonical-root-network-acns-security-fqdn-filtering-residue-20260727`
- `features/ccp-coredns/*` currently has live app-ops approval coverage through `ops/request-approval-canonical-root-ccp-coredns-split-frontier-residue-cleanup-20260728` and its exact child condition wait
- `features/remediator-node-not-ready-restart/*` remains under the exact repo-ref wait chain `wait-compact-remediator-node-not-ready-restart-reviewed-exception-origin-dev-advance-*`
- `features/gpu/*` remains under live frontier holder `hold-compact-gpu-reviewed-terminal-and-shared-owner-return-frontier-20260728`
- `features/managedsystem-pool/*` remains under the live publication-absorption wait chain `wait-compact-managedsystem-cli-create-variant-publication-absorption-origin-dev-*`
- `features/rp-master-validation/*` remains under live frontier work, including pending holder `hold-compact-rp-master-validation-ready-package-392e435eb3-20260728`
- `features/upgrade/*` remains under exact wait `compact/repair-compact-feature-upgrade-representation-8b87fd8ad1`
- the four runner files and several knowledge-map outputs are still referenced by the live `wait-compact-egress-lockdown-split-frontier-origin-dev-advance-*` chain

But the current task tree also shows a residue subset that no longer has a truthful live exact holder.

### Unrepresented / stale-holder subset

Current exact path searches in `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` show:

- `features/master-validation-rp/compact/staging.diagnostics.json`
- `features/master-validation-rp/compact/staging.plan.json`
- `features/master-validation-rp/compact/staging.summary.md`
  - only exact task hits are `wait-compact-master-validation-rp-reviewed-terminal-origin-dev-advance-*`
  - every exact hit is phase `converged`
- `features/rp-cluster-lifecycle/compact/staging.diagnostics.json`
- `features/rp-cluster-lifecycle/compact/staging.plan.json`
- `features/rp-cluster-lifecycle/compact/staging.summary.md`
  - the exact path hit is `wait-compact-rp-cluster-lifecycle-reviewed-frontier-origin-dev-advance-99523c2d-20260727`
  - that task is phase `converged`
- `README.md`
  - exact bootstrap/readme-related path hits found by current tree search are historical waits already in phase `converged`

That means the breach is no longer only “real but fully represented.” It is now a mixed condition:

1. some residue is still under exact live ownership;
2. some residue is already published upstream but still counted because the local checkout is behind;
3. and at least the current `README.md`, `features/master-validation-rp/*`, and `features/rp-cluster-lifecycle/*` slices are counted without a current live exact holder.

## Why this requires `upgrade_or_escalate`

This alert now meets the manual’s escalation criteria:

1. it is a real P0 breach now (`38 > 0`);
2. it has repeated across multiple owner sessions without recovery;
3. the owner cannot safely clear it from metric triage because doing so would require either:
   - mutating the live task graph so the unrepresented slices regain exact holders,
   - publishing/reverting shared `aks-rp-e2e` repo residue from the canonical checkout, or
   - fast-forwarding / rebasing a dirty shared checkout to absorb the three already-published local-drift paths;
4. the previous `waiting_with_evidence` posture is no longer truthful for the whole 38-path set because a nontrivial subset is currently counted without a live exact holder.

## Exact escalation / decision needed

Escalate in project context now.

Planner / May / human decision needed:

1. recreate or reopen exact live holders for the currently counted-but-converged residue slices:
   - `README.md`
   - `features/master-validation-rp/compact/staging.{diagnostics,plan,summary}`
   - `features/rp-cluster-lifecycle/compact/staging.{diagnostics,plan,summary}`
2. decide whether the three paths that already match `origin/dev` should be cleared by safe shared-checkout absorption rather than treated as unpublished work:
   - `README.md`
   - `features/ccp-coredns/compact/staging.summary.md`
   - `runner/scenario-lib/azure-resource.ts`
3. or explicitly authorize cleanup/publication of the remaining unrepresented slices if they are stale residue rather than active frontier work.

Without one of those actions, the metric remains a truthful P0 and the earlier wait memo is no longer sufficient project-state evidence.

## Why this is not another operation

- **Not `waiting_with_evidence`**: current counted residue is not fully represented by live holders anymore.
- **Not `resolve_stale`**: the runtime row and fresh recompute both still read `38`.
- **Not `calibrate_metric`**: threshold `0` remains correct because at least `35` paths still differ from `origin/dev` and remain invisible to pipeline runs.
- **Not `fix_root_cause`**: safe correction now requires shared-repo publication / absorption decisions or controller/task-tree repair outside what this triage turn can apply safely with the available tools.
- **Not `document_exception`**: this is active process residue, not an intentionally accepted exception.

## Next validation

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, or sooner if one of these exact changes happens first:

1. a new live holder or exact wait is created for the README / master-validation-rp / rp-cluster-lifecycle slices;
2. the local checkout is safely advanced enough to absorb the three already-published drift-only paths; or
3. those slices are explicitly cleaned, reverted, or published so the recomputed count drops below `38`.
