# Domain checkpoint — LocalDNS + CCP + generated visible bundle (2026-07-12)

Task: `domain/checkpoint-localdns-ccp-generated-visible-bundle-20260712`
Attempt: `a_domain_checkpoint-localdns-ccp-generated-visible-bundle-20260712_20260712173119`

## Result

Success. I checkpointed the exact combined 19-file bundle as local repo commit:

- **Commit:** `46c3205657cdaa7f123c10fa4fd9c71f6eacf28c`
- **Commit subject:** `checkpoint localdns ccp generated visible bundle`
- **Repo:** `/app/projects/aks-rp-e2e`
- **Branch:** `dev`

This checkpoint intentionally included only:
- 6 LocalDNS files
- 6 CCP MarinerV2 / mounted-source reclassification files
- 7 shared generated knowledge-map files

It intentionally left the blocked RP lifecycle publication slice and the blocked/active `rp-operation-status-polling` residue untouched.

## Scope proof

### 6 LocalDNS files included
1. `features/localdns/compact/staging.diagnostics.json`
2. `features/localdns/compact/staging.plan.json`
3. `features/localdns/compact/staging.summary.md`
4. `features/localdns/specs/localdns-multipool-consistency.json`
5. `features/localdns/tests/localdns-multipool-consistency.test.ts`
6. `features/localdns/tests/localdns-multipool-consistency.ts`

### 6 CCP MarinerV2 files included
1. `features/ccp-security-patch-os-variants/compact/staging.diagnostics.json`
2. `features/ccp-security-patch-os-variants/compact/staging.plan.json`
3. `features/ccp-security-patch-os-variants/compact/staging.summary.md`
4. `features/ccp-security-patch-os-variants/specs/ccp-security-patch-mariner-v2-prod-mtc.json`
5. `features/ccp-security-patch-os-variants/tests/ccp-security-patch-mariner-v2-prod-mtc.test.ts`
6. `features/ccp-security-patch-os-variants/tests/ccp-security-patch-mariner-v2-prod-mtc.ts`

### 7 shared generated knowledge-map files included
1. `model/knowledge-map/model.json`
2. `model/knowledge-map/views/evidence-index.md`
3. `model/knowledge-map/views/evidence-matrix.json`
4. `model/knowledge-map/views/graph-view.json`
5. `model/knowledge-map/views/model.generated.md`
6. `model/knowledge-map/views/path-summary.json`
7. `model/knowledge-map/views/status-summary.json`

## Why this exact bundle was the truthful checkpoint

The unpublished-change lineage reconciliation memo at
`/app/projects/aks-rp-e2e.app/evidence/archive/ops-reconcile-unpublished-change-visible-lineages-p0-20260712.md`
identified the smallest truthful checkpoint candidate as one combined 19-file slice because the generated knowledge-map spillover belonged jointly to:

- the LocalDNS multipool rehome, and
- the CCP MarinerV2 mounted-source reclassification,

while not carrying current RP lifecycle ownership changes.

That memo's current ownership table named:
- LocalDNS multipool rehome = 6 files
- CCP MarinerV2 reclassify = 6 files
- shared generated model/views = 7 files
- total combined checkpoint candidate = 19 files

## RP files explicitly excluded from the checkpoint

After the checkpoint commit, the repo still has only the RP lifecycle residue dirty:

1. `features/rp-cluster-lifecycle/compact/staging.diagnostics.json`
2. `features/rp-cluster-lifecycle/compact/staging.plan.json`
3. `features/rp-cluster-lifecycle/compact/staging.summary.md`
4. `features/rp-cluster-lifecycle/specs/rp-available-agent-pool-versions.json`
5. `features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-create-get-delete.json`
6. `features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-maintenance-state.json`
7. `features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-stop-start.json`
8. `features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-upgrade-k8s-version.json`
9. `features/rp-cluster-lifecycle/specs/rp-operation-status-polling.json`
10. `features/rp-cluster-lifecycle/tests/rp-operation-status-polling.test.ts`
11. `features/rp-cluster-lifecycle/tests/rp-operation-status-polling.ts`

That post-commit state proves no RP lifecycle files were swept into the 19-file checkpoint.

## Concise slice summary

This checkpoint makes the CCP MarinerV2 slice visible as a real checkpoint carrier by landing it together with the already-coupled LocalDNS rehome and the shared generated knowledge-map surfaces. It reduces unpublished-change pressure without mutating the existing RP blocked waits or the active `rp-operation-status-polling` residue lineage.
