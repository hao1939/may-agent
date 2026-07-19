# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.blocked.overdue-unworked-count` alert 4174

- Alert id: `4174`
- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Operation: `fix_root_cause`
- Judged at: `2026-07-19T06:51:26Z`

## Baseline

Direct recompute at triage time still showed a live breach:

```json
{"measuredAt":1784443815193,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":2,"sampleSize":2,"note":"{\"offenderTaskIds\":[\"hold-spec-network-cni-vm-prerelease-calico-eno-row192-196-frontier-20260710\",\"wait-azure-keyvault-secrets-provider-vm-prerelease-dual-pool-ado-run-172839218-result\"]}"}
```

## Judgment

This breach is real, but it is process stewardship debt rather than a new product verdict.

Both offender tasks are still truthful exact blocked waits:

1. `hold-spec-network-cni-vm-prerelease-calico-eno-row192-196-frontier-20260710`
   - the current checked-in repo still does **not** provide a narrower truthful successor for rows `193-196`;
   - `domain-recheck-network-cni-calico-eno-rows193-196-successor-surface-20260718.md` proves row `193` remains the first candidate but still fails local `default-branch-choice` validation on the current checkout;
   - the holder's observation window expired (`fallback_at = 2026-07-19T06:30:00Z`).
2. `wait-azure-keyvault-secrets-provider-vm-prerelease-dual-pool-ado-run-172839218-result`
   - the latest authenticated evidence still shows exact run `172839218` as `notStarted` with zero artifacts and no proof of a shared staging failure;
   - `diagnose-azure-keyvault-secrets-provider-vm-prerelease-dual-pool-run-172839218-environment-gate-20260719.md` concludes the right next step is to keep the same-run wait, not queue a duplicate rerun;
   - this wait's observation window also expired (`fallback_at = 2026-07-19T06:15:00Z`).

So the smallest truthful repair is to refresh both exact waits in place with current evidence-backed wording and fresh review windows.

## Changes made

### 1. Refreshed the Calico→ENO residual holder

- Preserved the exact residual scope: rows `193-196` only.
- Refreshed the holder from the current recheck memo proving no narrower truthful successor exists yet.
- Advanced the blocked-wait observation window so the wait is no longer overdue-unworked.

### 2. Materialized and refreshed the AKV same-run wait

- Wrote the missing wait memo at `evidence/archive/wait-azure-keyvault-secrets-provider-vm-prerelease-dual-pool-ado-run-172839218-result-20260719.md` using the diagnosis memo's authenticated run snapshot.
- Kept the exact same-run wait on run `172839218`.
- Advanced the blocked-wait observation window so the wait is no longer overdue-unworked while preserving the fallback to a single-run queue/admission escalation if a later authenticated refresh still finds `notStarted` + no artifacts.

## Expected validation

After the in-place refreshes, the next direct metric recompute should return:

- `value = 0`
- `sampleSize = 0`
- `offenderTaskIds = []`

The next durable validation signal should be the next `metrics-snapshot` / metric refresh for `aks-rp-e2e.process.blocked.overdue-unworked-count`.
