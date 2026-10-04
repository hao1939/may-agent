# Gym App

A bounded frozen-comparison App for May and Scout candidates. Read the
[comparison contract](design/frozen-comparison-service.md), the
[report-driven improvement design](design/report-driven-improvement.md), and the
[evidence reliability and maintenance guide](design/evidence-reliability.md).
Source readiness and deployed activation are reported separately. The
[September 18 repair trial](design/evidence-reliability-trial-20260918.md) records
checks, real model outcomes and assisted versus autonomous correction. The
[September 26 comparison trial](design/efficiency-comparison-trial-20260926.md)
records declared duration objectives, separate quality observations and the
checks through the baseline, verification and receipt path.

The App admits only ordinary `goal` and `message` inputs. The Gym owner may
select the focused `compare-candidate` workflow from the shared workflow catalog.
The workflow reuses standalone Gym frozen baseline/verification primitives and
retains exact identities and command receipts. The default objective measures
quality improvement; a predeclared duration objective can measure faster
execution while keeping quality checks and timing coverage separate. It never builds, approves,
applies, merges or deploys a candidate.

There are no active schedules, legacy learning subscriptions, approval-event
routes or autonomous improvement actions. The former `improve-agent` source is
retained under `archive/` for history and is excluded from bundle/discovery.

Before first activation, follow the retained-task procedure in the design:
quiesce old sessions and confirm absent old workflow bindings using public
reads. Do not alter the live DB.

```bash
bun --cwd=projects/gym.app run check
```

For local deployment, merge the Gym runner and App together, run
`bun install --frozen-lockfile --ignore-scripts` at the workspace root, then
reload App definitions. Gym is a local package-manager workspace, so installation
links its source rather than copying its runtime data. This dependency makes `@may-agent/gym/comparison`
available to frozen workflows; the App's development TypeScript path alone is
not enough. Verify the frozen workflow import as well as the accepted reload
revision. No Host binary or container update is needed for this change.
