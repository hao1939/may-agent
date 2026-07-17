# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3834)

- Operation: `waiting_with_evidence`
- Alert id: `3834`
- Metric id: `aks-rp-e2e.process.unpublished-change-count`
- Judged at: `2026-07-15T18:28:00Z`

## Why the breach is still real

Fresh live recompute from `/app/projects/aks-rp-e2e.app`:

```bash
bun scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count --json
```

returned:

```json
{"measuredAt":1784139935885,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":14}
```

Fresh domain-repo status at `/app/projects/aks-rp-e2e` showed the same 14 tracked unpublished paths:

```text
 M design/scenario-test-authoring.md
 M features/network-cni/tests/network-acns-retina-enterprise.ts
 M features/network-cni/tests/network-swift-v1-vnetscale-dual-stack-basic-datapath.ts
 M features/rp-cluster-lifecycle/compact/staging.plan.json
 M features/rp-cluster-lifecycle/packets/api-quartet.yaml
 M features/rp-cluster-lifecycle/packets/preflight-validation.yaml
 M features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-stop-start.json
 M features/rp-cluster-lifecycle/specs/rp-preflight-validation.json
 M features/rp-cluster-lifecycle/tests/rp-cluster-lifecycle-stop-start.test.ts
 D features/rp-cluster-lifecycle/tests/rp-cluster-lifecycle-stop-start.ts
 M features/rp-cluster-lifecycle/tests/rp-preflight-validation.test.ts
 D features/rp-cluster-lifecycle/tests/rp-preflight-validation.ts
 M runner/vitest-runtime/steps.ts
 M scripts/check-scenario-tests.ts
```

So this is not a stale or already-recovered alert.

## Concrete change made during triage

This triage repaired the one live process gap inside the 14-file residue:

1. created and assigned the missing exact carrier task
   `domain/publish-rp-cluster-lifecycle-stop-start-direct-vitest-five-file-slice-20260715`
   under `domain/audit-normalize-scenario-tests`; and
2. refreshed
   `domain/wait-rp-cluster-lifecycle-preflight-validation-ado-run-172348349-result`
   so its blocker no longer points at archived
   `domain/reconcile-rp-cluster-lifecycle-stop-start-local-only-residue-20260715`
   and instead names the live sibling publication carrier.

Those mutations mean the remaining breach is now truthfully represented by live
work and exact waits rather than by an archived residue holder.

## Current file-to-owner mapping

| Unpublished surface | Count | Live holder after triage | State | Why waiting is truthful |
| --- | ---: | --- | --- | --- |
| `design/scenario-test-authoring.md`, `scripts/check-scenario-tests.ts` | 2 | `domain/normalize-scenario-tests-repo-frontier-20260715` | `review` | Repo-wide scenario-test normalization remains in review and explicitly owns these authoring artifacts. |
| `features/network-cni/tests/network-acns-retina-enterprise.ts` | 1 | `fix-network-acns-retina-enterprise-run-172310203` | `review` | Exact fix-forward review leaf owns the patched test carrier and recorded rerun proposal. |
| `features/network-cni/tests/network-swift-v1-vnetscale-dual-stack-basic-datapath.ts` | 1 | `fix-network-swift-v1-vnetscale-dual-stack-basic-datapath-run-172310203` | `review` | Exact fix-forward review leaf owns the patched datapath carrier and pending publish/rerun follow-through. |
| `features/rp-cluster-lifecycle/packets/preflight-validation.yaml`, `features/rp-cluster-lifecycle/specs/rp-preflight-validation.json`, `features/rp-cluster-lifecycle/tests/rp-preflight-validation.test.ts`, `features/rp-cluster-lifecycle/tests/rp-preflight-validation.ts`, `runner/vitest-runtime/steps.ts` | 5 | `domain/wait-rp-cluster-lifecycle-preflight-validation-ado-run-172348349-result` | `blocked` | Exact ADO wait already names the five-file preflight subset, observer, resume condition, and fallback. |
| `features/rp-cluster-lifecycle/compact/staging.plan.json`, `features/rp-cluster-lifecycle/packets/api-quartet.yaml`, `features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-stop-start.json`, `features/rp-cluster-lifecycle/tests/rp-cluster-lifecycle-stop-start.test.ts`, deletion of `features/rp-cluster-lifecycle/tests/rp-cluster-lifecycle-stop-start.ts` | 5 | `domain/publish-rp-cluster-lifecycle-stop-start-direct-vitest-five-file-slice-20260715` | `active` | This was the missing live carrier; triage created and assigned it so the stop-start slice now has an exact publish path instead of only archived lineage. |

Total represented surface: `2 + 1 + 1 + 5 + 5 = 14`.

## Why the final operation is `waiting_with_evidence`

- Not `resolve_stale`: the metric still recomputes to `14`.
- Not `calibrate_metric`: threshold `0` remains correct because these local
  domain-repo changes are still invisible to pipeline runs.
- Not `fix_root_cause`: triage repaired the missing carrier, but the underlying
  unpublished changes are still intentionally open and still require the live
  review/publish/run holders above to complete before the metric can return to
  `0`.
- Not `upgrade_or_escalate`: there is a safe owner action path in flight now.

The correct judgment is therefore to keep the alert in **waiting with evidence**:
real breach, exact live owners, exact observer path, and one repaired task-tree
hole made concrete during this triage.

## Next validation

Validate at the next `metrics-snapshot` for
`aks-rp-e2e.process.unpublished-change-count`, or sooner when any of these
happen:

1. `domain/publish-rp-cluster-lifecycle-stop-start-direct-vitest-five-file-slice-20260715`
   lands or changes state;
2. `domain/wait-rp-cluster-lifecycle-preflight-validation-ado-run-172348349-result`
   receives a returned ADO result; or
3. the two network review leaves or the scenario-test normalization review leaf
   are accepted/published and reduce the dirty surface.
