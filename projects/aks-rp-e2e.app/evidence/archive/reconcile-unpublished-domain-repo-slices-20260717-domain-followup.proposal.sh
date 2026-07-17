#!/usr/bin/env bash
set -euo pipefail
cd /app/projects/aks-rp-e2e.app

# Planner-owned proposal only. Do not execute from worker mode.

bun run ./scripts/task-tree.ts add 'domain/publish-localdns-autodefault-blocked-holder-writeback-20260717' \
  --parent 'project' \
  --kind 'domain_leaf' \
  --priority 'P2' \
  --owner 'aks-explorer' \
  --goal 'Checkpoint the exact LocalDNS omitted-profile blocked-holder writeback already reflected by hold-spec-localdns-autodefault-fresh-create-136-cilium-environment-frontier-20260714, limited to features/localdns/packets/auto-default.yaml plus the 7 regenerated model/knowledge-map files.' \
  --input '../aks-rp-e2e/evidence/archive/reconcile-spec-localdns-autodefault-fresh-create-136-cilium-environment-return-20260717.md' \
  --input '../aks-rp-e2e/evidence/archive/apply-localdns-autodefault-fresh-create-136-cilium-holder-refresh-20260717.md' \
  --input 'live holder: hold-spec-localdns-autodefault-fresh-create-136-cilium-environment-frontier-20260714' \
  --input 'reconciliation memo: ../aks-rp-e2e/evidence/archive/reconcile-unpublished-domain-repo-slices-20260717.md' \
  --output '../aks-rp-e2e/features/localdns/packets/auto-default.yaml' \
  --output '../aks-rp-e2e/model/knowledge-map/model.json' \
  --output '../aks-rp-e2e/model/knowledge-map/views/evidence-index.md' \
  --output '../aks-rp-e2e/model/knowledge-map/views/evidence-matrix.json' \
  --output '../aks-rp-e2e/model/knowledge-map/views/graph-view.json' \
  --output '../aks-rp-e2e/model/knowledge-map/views/model.generated.md' \
  --output '../aks-rp-e2e/model/knowledge-map/views/path-summary.json' \
  --output '../aks-rp-e2e/model/knowledge-map/views/status-summary.json' \
  --output '../aks-rp-e2e/evidence/archive/publish-localdns-autodefault-blocked-holder-writeback-20260717.md' \
  --acceptance 'The isolated publish slice contains exactly the 8 LocalDNS/model files above and no RP-regional-quota or secops residue.' \
  --acceptance 'The model diff remains limited to path.localdns.autodefault-fresh-create-1.36-cilium plus its two new evidence ids.' \
  --acceptance 'The resulting commit/message truthfully says this is a blocked-holder writeback, not a reopened LocalDNS rerun or pass verdict.' \
  --conflict-scope 'file:features/localdns/packets/auto-default.yaml' \
  --conflict-scope 'file:model/knowledge-map/model.json' \
  --conflict-scope 'file:model/knowledge-map/views/evidence-index.md' \
  --conflict-scope 'file:model/knowledge-map/views/evidence-matrix.json' \
  --conflict-scope 'file:model/knowledge-map/views/graph-view.json' \
  --conflict-scope 'file:model/knowledge-map/views/model.generated.md' \
  --conflict-scope 'file:model/knowledge-map/views/path-summary.json' \
  --conflict-scope 'file:model/knowledge-map/views/status-summary.json' \
  --conflict-scope 'path:path.localdns.autodefault-fresh-create-1.36-cilium'

bun run ./scripts/task-tree.ts assign 'domain/publish-localdns-autodefault-blocked-holder-writeback-20260717' --worker 'aks-explorer'

bun run ./scripts/task-tree.ts add 'domain/reconcile-rp-regional-quota-publication-surface-after-run-172614503-20260717' \
  --parent 'project' \
  --kind 'domain_leaf' \
  --priority 'P2' \
  --owner 'aks-explorer' \
  --goal 'Resolve the unpublished RP regional quota public-create-path repo slice by choosing one truthful publication surface after reviewed run 172614503: either carry the 40/161 environment-wait verdict onto the normalized .test.ts lineage, or explicitly backport it onto the legacy .ts carrier without implying the live run executed that legacy surface.' \
  --input '../aks-rp-e2e/evidence/archive/wait-rp-regional-quota-public-create-path-ado-run-172614503-result-20260717.md' \
  --input 'archived exact wait: /app/projects/aks-rp-e2e.app/.state/tasks/archive/done-leaves-20260717030725024.json#wait-rp-regional-quota-public-create-path-ado-run-172614503-result' \
  --input 'live blocked carrier: reconcile-spec-loop-pending-rp-regional-quota' \
  --input 'workspace/normalize-direct-rp-regional-quota-public-create-path-20260717-wt/' \
  --input 'reconciliation memo: ../aks-rp-e2e/evidence/archive/reconcile-unpublished-domain-repo-slices-20260717.md' \
  --output '../aks-rp-e2e/features/rp-regional-quota.yaml' \
  --output '../aks-rp-e2e/features/rp-regional-quota/notes/public-create-path-target-selection-20260715.md' \
  --output '../aks-rp-e2e/features/rp-regional-quota/specs/rp-regional-quota-public-create-path.json' \
  --output 'one truthful implementation carrier: ../aks-rp-e2e/features/rp-regional-quota/tests/rp-regional-quota-public-create-path.ts or ../aks-rp-e2e/features/rp-regional-quota/tests/rp-regional-quota-public-create-path.test.ts' \
  --output '../aks-rp-e2e/evidence/archive/reconcile-rp-regional-quota-publication-surface-after-run-172614503-20260717.md' \
  --acceptance 'The worker first re-verifies and records that wait-rp-regional-quota-public-create-path-ado-run-172614503-result is absent from the live tree because it was rolled up done at /app/projects/aks-rp-e2e.app/.state/tasks/archive/done-leaves-20260717030725024.json, so run 172614503 must now be represented either by this successor output or by one exact new live wait it explicitly proposes.' \
  --acceptance 'The chosen publish surface matches the reviewed run lineage or explicitly documents why it is a backport rather than the executed carrier.' \
  --acceptance 'The exact 40/161 environment-blocker verdict and rerun condition are preserved without reintroducing the stale 161/161 ready-to-rerun claim.' \
  --acceptance 'The outcome is either one checkpoint-ready exact slice or one exact blocked publication holder with the 4-file affected set and explicit resume condition.' \
  --conflict-scope 'spec:spec.rp-regional-quota.public-create-path' \
  --conflict-scope 'ado-run:172614503' \
  --conflict-scope 'file:features/rp-regional-quota.yaml' \
  --conflict-scope 'file:features/rp-regional-quota/notes/public-create-path-target-selection-20260715.md' \
  --conflict-scope 'file:features/rp-regional-quota/specs/rp-regional-quota-public-create-path.json' \
  --conflict-scope 'file:features/rp-regional-quota/tests/rp-regional-quota-public-create-path.ts' \
  --conflict-scope 'file:features/rp-regional-quota/tests/rp-regional-quota-public-create-path.test.ts'

bun run ./scripts/task-tree.ts assign 'domain/reconcile-rp-regional-quota-publication-surface-after-run-172614503-20260717' --worker 'aks-explorer'

bun run ./scripts/task-tree.ts update-text 'reconcile-spec-loop-pending-rp-regional-quota' \
  --blocker 'Blocked-frontier review and alert 3990 recovery still show run 172346097 as the single truthful exact exhausted-target wait for spec.rp-regional-quota.public-create-path: the reviewed aggregate plus per-spec artifacts stop at preflight.target-usage with managedClusters=40/161, so the decisive managedClusters PUT quota-negative assertion was not reached. Keep this carrier separate from the non-live shared westus2 create-slot/headroom family wait-shared-westus2-managed-cluster-capacity-family-return-20260703; that family steward is not a live governing companion at apply time. The archived done wait wait-rp-regional-quota-public-create-path-ado-run-172614503-result was rolled up at 2026-07-17T03:07:25.024Z and is not a live same-spec companion anymore. The current live same-spec companion follow-up is domain/reconcile-rp-regional-quota-publication-surface-after-run-172614503-20260717, which must either carry the 40/161 environment-blocked result onto one truthful implementation carrier or explicitly propose one exact replacement live wait for run 172614503; any outcome from that same-surface lineage must replace or continue reusing one exact live successor instead of opening another active rerun or fix-forward task.'

bun run ./scripts/task-tree.ts show 'domain/publish-localdns-autodefault-blocked-holder-writeback-20260717'
bun run ./scripts/task-tree.ts show 'domain/reconcile-rp-regional-quota-publication-surface-after-run-172614503-20260717'
bun run ./scripts/task-tree.ts show 'reconcile-spec-loop-pending-rp-regional-quota'
