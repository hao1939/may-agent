# Event receipt expiry: implementation trial — 2026-10-16

**Status:** Published as [Host PR #372](https://github.com/hao1939/may-agent/pull/372); full local CI passed, hosted checks and review pending. Not deployed.
**Supports:** [Event admission](../../2a-design/events.md#admission-state) and
[Host contract improvements](../../proposals/host-contract-improvements-20261016.md).

## Question and value

Can the same unresolved Event reach the same delivery deadline across restart,
without losing independent App admission or inventing obligations for old history?
This makes failure evidence trustworthy and prevents maintenance process lifetime
from deciding which overdue delivery is visible. No token savings are established.

## Source and correction

Baseline: merged Host #370, `a0b153b455e6f94eeb520747eb1c61c9f62690ad`.
Candidate branch: `fix/durable-event-expiry-20261016`, revision `09457950f`.
The source patch builds on main independently; rollout should include the refined
observer-intent PR #371, as explained below.

Remove the writer's process-start cutoff. A non-null `app_admission_pending`
value already distinguishes tracked Events from unclassified legacy history;
all current publications write it, and inspection changes 1 to 0 without removing
that evidence. Existing pending admission plans also establish an obligation.
Keep the existing pending-status, publication-time and TTL checks. This reuses
the durable compatibility boundary instead of adding a timestamp, column or
migration. Expiry does not clear the marker or replay ordinary subscribers.
Accepted receipts, exact-target plan expiry and broad App admission recovery
retain their current behavior.

The mechanism adds no write, scan, timer, public schema or App configuration.
It changes the eligibility predicate within existing maintenance SQL. Old pending
receipts with a durable marker may now become visibly unhandled at their existing
deadline. Rows with neither marker nor pending plan remain unchanged. Such
unclassified history is not retroactively repaired.

## Trials

The new regression initially produced three expected failures: two default/custom
TTL comparisons left the restarted receipt pending while the uninterrupted receipt
expired; a maintenance writer created after failed required delivery also missed
expiry. A fourth test passed, confirming preserved legacy and accepted evidence.
All four pass after the correction.

A production App-input recovery trial publishes before routing, closes and reopens
the database, expires the receipt, and starts ordinary recovery. It proves that
one saved report reaches one App admission, retains Event/input identity on keyed
retry, and performs no ordinary effect replay or model execution. The test uses
the real admission planner and a fake Task attachment boundary; it does not prove
live model behavior or Task completion.

Existing delivery and translation coverage checks pending plans, absent exact
target expiry, accepted global receipts with pending App admission, frozen route
recovery and exhausted recipient behavior. Focused runs passed 56 tests across
expiry/delivery/translation and 21 across expiry/direct-recovery/unroutable-address;
these counts overlap and must not be added as distinct tests.

Reproduce from the candidate checkout:

```sh
bun install --frozen-lockfile
bun test src/lib/event-receipt-expiry.test.ts src/app/event-delivery.test.ts src/app/composition/app-event-translation.test.ts
bun test src/app/composition/direct-event-recovery.test.ts src/app/composition/unroutable-address-recovery.test.ts
bun run ci
```

Full local `bun run ci` passed: 3,750 tests passed, three installation-dependent
skips, zero failures; 21,474 assertions across 338 files in 306.12 seconds.
The browser ran. Design checks passed with zero errors and the existing unclassified
`reports` warning. Hosted checks remain pending.

A combined trial with the initial #371 reproduced a harmless expired observation
remaining unhandled after inspection. The refined #371 now records a known required
failure distinctly from an unresolved timeout; 36 combined observer/replay/bus checks
pass, including housekeeping before startup recovery. Merge/rollout should include
that correction rather than treating the original green individual suites as
integration proof. See the [observer trial](observer-delivery-intent-20261016.md).
The existing best-effort housekeeping cadence remains eventually consistent;
this is not a guarantee of immediate timeout notification. No live deployment,
App activation or external model experiment was used to verify this change.
