# Gym App

A bounded frozen-comparison App for May and Scout candidates. Read the
[comparison contract](design/frozen-comparison-service.md), the
[report-driven improvement design](design/report-driven-improvement.md), and the
[evidence reliability and maintenance guide](design/evidence-reliability.md).
Source readiness and deployed activation are reported separately. The
[September 18 repair trial](design/evidence-reliability-trial-20260918.md) records
checks, real model outcomes and assisted versus autonomous correction.

The App admits only ordinary `goal` and `message` inputs. The Gym owner may
select the focused `compare-candidate` workflow from the shared workflow catalog.
The workflow reuses standalone Gym frozen baseline/verification primitives and
retains exact identities and command receipts. It never builds, approves,
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
