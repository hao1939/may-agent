# Compact Live-Workflow Triage

Generated: 2026-07-02

## One-By-One Findings

| Feature | Run | Real issue | Fix / next action |
|---|---:|---|---|
| bootstrap-profile | 28521299857 | Real staging capacity wait. Live preflight saw westus2 at 161/161 managed clusters before cloud mutation. | Keep as exact capacity wait; rerun only after a westus2 cluster slot is free or quota changes. |
| cloud-provider | 28521371016 | Real staging capacity wait. Live preflight saw westus2 at 161/161 managed clusters before cloud mutation. | Keep as exact capacity wait; rerun only after a westus2 cluster slot is free or quota changes. |
| extension-addon | 28521450004 | Stale live failure from an older branch/runtime: test tried to read `/app/sources/aks-rp/test/e2e/suites/extensionaddon/suggestion.go`. Current checked-in carrier is self-contained and local check passes. | Reset retry budget and dispatch a fresh live proof from current `dev`. |
| remediator-node-not-ready-restart | 28558068783 | Live carrier created a real cluster, performed VM mutations, nodes recovered to Ready, then failed because event validation read the Events API once and missed late `NodeRebootEnd`. | Fixed the carrier to poll for the complete auto-repair event set within a bounded timeout. Local check passes; reset retry budget and dispatch a fresh live proof. |

## Verification

- `bun run execute features/extension-addon/compact/staging.plan.json --check --parallel=50` passed.
- `bun run execute features/remediator-node-not-ready-restart/compact/staging.plan.json --check --parallel=50` passed.

## State Decision

Reset only `extension-addon` and `remediator-node-not-ready-restart`.
Do not reset `bootstrap-profile` or `cloud-provider`; those are environment
capacity waits, not stale workflow failures.
