# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.blocked.overdue-unworked-count` alert 3861

- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Alert id: `3861`
- Operation: `fix_root_cause`
- Judged at: `2026-07-15T20:57Z`

## Why this was a real breach

The persisted alert snapshot named two offenders, but a fresh live recompute showed the runtime state had drifted further and the metric was still actively breaching:

```json
{"measuredAt":1784147340486,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":6,"sampleSize":6,"note":"{\"offenderTaskIds\":[\"wait-spec-extension-addon-execution-identity-permission-response-20260702\",\"hold-compact-extension-addon-reviewed-exception-frontier\",\"hold-compact-trusted-access-ta-gateway-dns-runtime-frontier-20260705\",\"wait-compact-managedsystem-cli-default-payload-owner-decision-return-20260711\",\"hold-compact-rp-master-validation-ready-spec-frontier-20260715\",\"fix-network-acns-retina-enterprise-run-172310203-domain-followup\"]}"}
```

After refreshing those six exact waits, a second recompute exposed two more expired same-run holders that were not in the original persisted alert payload but were live offenders at triage time:

```json
{"measuredAt":1784147426615,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":2,"sampleSize":2,"note":"{\"offenderTaskIds\":[\"domain/wait-jwt-authenticator-ready-subset-ado-run-172339591-result\",\"wait-rp-master-validation-spot-pool-ado-run-172397034-result\"]}"}
```

## Root cause

This was not a false positive and not missing ownership. The contributing waits were truthful exact holders, but their blocked-wait observation windows had expired, so the metric correctly classified them as overdue blocked waits without fresh active handling.

The live offenders were all same-lineage holders whose `next_check_at` / `resume_at` windows had elapsed even though their exact external wait conditions still held:

- `wait-spec-extension-addon-execution-identity-permission-response-20260702`
- `hold-compact-extension-addon-reviewed-exception-frontier`
- `hold-compact-trusted-access-ta-gateway-dns-runtime-frontier-20260705`
- `wait-compact-managedsystem-cli-default-payload-owner-decision-return-20260711`
- `hold-compact-rp-master-validation-ready-spec-frontier-20260715`
- `fix-network-acns-retina-enterprise-run-172310203-domain-followup`
- `domain/wait-jwt-authenticator-ready-subset-ado-run-172339591-result`
- `wait-rp-master-validation-spot-pool-ado-run-172397034-result`

## Root-cause fix applied

Using the supported task-tree `refreshBlockedWait` path, I refreshed each live offender in place after revalidating that the underlying wait was still the truthful current carrier. I did **not** widen scope, create duplicate reruns, or replace the exact holders.

All eight waits were advanced to a fresh review window:

- new `next_check_at = 2026-07-15T22:00:00Z`
- existing `fallback_at` preserved per task
- `trace.blocked_wait_refreshed_at` and `trace.blocked_wait_refresh_summary` updated on each holder

Representative refreshed holders:

- `wait-spec-extension-addon-execution-identity-permission-response-20260702`
- `wait-compact-managedsystem-cli-default-payload-owner-decision-return-20260711`
- `fix-network-acns-retina-enterprise-run-172310203-domain-followup`
- `domain/wait-jwt-authenticator-ready-subset-ado-run-172339591-result`
- `wait-rp-master-validation-spot-pool-ado-run-172397034-result`

## Immediate validation

A fresh recompute after the in-place blocked-wait refreshes cleared the metric completely:

```json
{"measuredAt":1784147448240,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

Task-tree readback also shows the refreshed summary and the common future `next_check_at` on the repaired waits.

## Why this is `fix_root_cause`

The owner could safely correct the app/process cause directly. The problem was expired blocked-wait stewardship on still-truthful exact holders, and the supported task-tree refresh path repaired that live state immediately.

## Next validation

- Preferred: next runtime `metrics-snapshot` for `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Expected: remain `0` unless a newer blocked wait again passes its review window without refresh, replacement, or active coverage.
