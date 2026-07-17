# domain/repair-rp-cluster-lifecycle-preflight-validation-compact-direct-path-20260716

- Task: `domain/repair-rp-cluster-lifecycle-preflight-validation-compact-direct-path-20260716`
- Attempt: `a_domain_repair-rp-cluster-lifecycle-preflight-validation-compact-direct-path-20260716_20260716120816`
- Scope: repo-local compact-surface hygiene only for `spec.rp-cluster-lifecycle.preflight-validation`
- Non-rerun: true
- Checked: 2026-07-16

## What changed

Updated the committed compact artifact at:

- `features/rp-cluster-lifecycle/compact/staging.plan.json`

for the `spec.rp-cluster-lifecycle.preflight-validation` operation so both of these fields now point to the direct normalized scenario test path:

- `scenarioTestPath: features/rp-cluster-lifecycle/tests/rp-preflight-validation.test.ts`
- `replay: features/rp-cluster-lifecycle/tests/rp-preflight-validation.test.ts`

This is compact-surface hygiene on already-final path `path.rp-cluster-lifecycle.preflight-validation`, not rerun authority.

## Non-rerun verification

Repo checks after the edit:

```bash
cd /app/projects/aks-rp-e2e && \
  grep -nE 'rp-preflight-validation\.(test\.ts|ts)' \
    features/rp-cluster-lifecycle/compact/staging.plan.json \
    features/rp-cluster-lifecycle/specs/rp-preflight-validation.json \
    features/rp-cluster-lifecycle/packets/preflight-validation.yaml \
    features/rp-cluster-lifecycle/tests/rp-preflight-validation.test.ts && \
  test ! -e features/rp-cluster-lifecycle/tests/rp-preflight-validation.ts
```

Observed repo truth:

- `features/rp-cluster-lifecycle/compact/staging.plan.json:1736` now uses `.test.ts`
- `features/rp-cluster-lifecycle/compact/staging.plan.json:1737` now uses `.test.ts`
- `features/rp-cluster-lifecycle/specs/rp-preflight-validation.json:19` keeps `.test.ts`
- `features/rp-cluster-lifecycle/specs/rp-preflight-validation.json:21` keeps `.test.ts`
- `features/rp-cluster-lifecycle/packets/preflight-validation.yaml:184` keeps `.test.ts`
- `features/rp-cluster-lifecycle/tests/rp-preflight-validation.test.ts:59-60` still self-check the `.test.ts` contract
- legacy plain carrier `features/rp-cluster-lifecycle/tests/rp-preflight-validation.ts` is absent

Additional string-count check on the compact artifact:

```bash
cd /app/projects/aks-rp-e2e && node -e "const fs=require('fs');const text=fs.readFileSync('features/rp-cluster-lifecycle/compact/staging.plan.json','utf8');console.log('OLD_PLAIN_TS_COUNT=' + (text.match(/features\\/rp-cluster-lifecycle\\/tests\\/rp-preflight-validation\\.ts/g)||[]).length);console.log('NEW_TEST_TS_COUNT=' + (text.match(/features\\/rp-cluster-lifecycle\\/tests\\/rp-preflight-validation\\.test\\.ts/g)||[]).length);"
```

Observed:

- `OLD_PLAIN_TS_COUNT=0`
- `NEW_TEST_TS_COUNT=2`

## Explicit non-actions

- Did not launch a cloud rerun.
- Did not change spec ownership, packet intent, or path verdict surfaces.
- Did not propose this compact artifact as verdict-driving evidence; it is a review-surface repair only.

## Event proposal

No project/runtime event emission was performed from this worker session. No event proposal is required beyond normal reviewer acceptance of the repaired repo artifact.
