# Compact Package-Partial Status Gate Repair

Generated: 2026-07-02

## Root Cause

Several feature compact packages were complete and live-ready, but the planner
reported `packageStatus=partial` only because the package did not save clusters
or still used dedicated test groups. That confused execution readiness with
efficiency.

The real live-dispatch requirements are:

- all feature-owned specs are selected,
- every selected spec is live-ready,
- generated materialization is ready,
- no shared-fixture carrier gap remains.

Cluster savings remain a metric, not a live admission gate.

## Code Fix

Updated `/app/projects/aks-rp-e2e/runner/feature-compact.ts` so
`packageStatus()` returns `ready` once the real live-dispatch requirements pass.
The live gate no longer blocks solely because candidate routing falls back to
dedicated tests.

## Repaired And Requeued

These features regenerated as `ready` and passed local generated-suite check:

| Feature | Specs | Clusters | Saved | Check result |
|---|---:|---:|---:|---|
| ccp-autoupgrader-variants | 2 | 2 | 0 | passed |
| custom-node-config | 2 | 2 | 0 | passed |
| node-fips-ossku | 2 | 2 | 0 | passed |
| rp-snapshot | 2 | 2 | 0 | passed |
| node-autoprovision | 3 | 3 | 0 | passed |
| node-http-proxy | 3 | 3 | 0 | passed |
| upgrade | 3 | 3 | 0 | passed |
| serverless-schedulerctrl | 4 | 4 | 0 | passed |

These are meaningful retry candidates for live proof after the status-gate fix.

## Still Real Issues

These features did not become ready because they have real carrier gaps:

| Feature | Real issue |
|---|---|
| oidc-issuer | The semantic DAG route compacts 6 specs into one cluster, but the scenario-test carrier does not declare shared fixture support for that shared cluster. |
| workload-identity | The semantic DAG route compacts 9 specs into 3 clusters, but the scenario-test carrier does not declare shared fixture support for two shared clusters. |

Fix path: adapt those scenario tests to consume the generated shared fixture or
generate a compact carrier for the route. Do not reset them as stale package
errors.
