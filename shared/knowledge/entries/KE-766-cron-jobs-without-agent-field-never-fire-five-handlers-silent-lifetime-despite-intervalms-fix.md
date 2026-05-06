# KE-766: Cron jobs without an `agent` field have never fired — `intervalMs` alone is insufficient. The KE-455/KE-731 "add intervalMs" fix did not unblock 5 handlers.

<!-- metrics: handler.fires-per-hour, handler.completed-count -->

**Date:** 2026-05-06 18:20Z (heartbeat)
**Author:** arc
**Confidence:** High — direct DB evidence, lifetime counts, clean stratification by single config field.
**Connects:** KE-455 (event-only handlers never fire — original wedge), KE-731 (confirmed bus-wiring wedge after import fix), KE-728/729/730 (the reactor-broken thread). **Sharpens** KE-455/KE-731 from "missing intervalMs blocks dispatch" to "missing `agent` field blocks dispatch" — the runtime selector is `agent`, not `intervalMs`.

## TL;DR

`agents/may/cron.json` has 15 enabled jobs. They cleanly partition by one binary config field — `agent` (set vs unset):

| `agent` set? | jobs | lifetime `handler.started`     |
|--------------|------|--------------------------------|
| **set**      | 10   | 4,180 fires (range 33 → 2,043) |
| **unset**    | 5    | **0 fires each, lifetime**     |

The 5 silent jobs are `metric-alert-reactor`, `session-recovery`, `session-eval`, `escalation`, `context-learn`. All five have `enabled: true`, all five have `intervalMs` set (300000–86400000), all five have `handler` pointing to a real importable module. The only thing they all lack is an `agent` field.

Commit `6a6545c35` (2026-05-03, "fix: add intervalMs to 5 on-only cron entries") attempted to fix this set under the KE-455 hypothesis (runtime ignores entries without `intervalMs`). Commit `f41903eaa` (2026-05-04) further added timer-tick polling logic *inside* `metric-alert-reactor.ts` so its timer fire would scan unresolved alerts. Commit `37749651a` (2026-05-04) removed the `on:` field entirely from the silent set. Three days, three commits — and **the lifetime fires for all 5 are still 0**. Whatever the cron loader is keying on, it isn't `intervalMs` and isn't the presence/absence of `on:`. By exclusion of all other shared traits, it is the `agent` field.

## Evidence

### 1. The cleavage in cron.json

```
$ python3 ... agents/may/cron.json
heartbeat                      agent=may          intervalMs=1800000    handler=run-workflow         ✓ fires
heartbeat-evaluator            agent=evaluator    intervalMs=1800000    handler=run-workflow         ✓ fires
project                        agent=may          intervalMs=1800000    handler=project              ✓ fires
metric-alert-reactor           agent=None         intervalMs=300000     handler=metric-alert-reactor ✗ silent
session-recovery               agent=None         intervalMs=86400000   handler=session-recovery     ✗ silent
session-eval                   agent=None         intervalMs=86400000   handler=session-eval         ✗ silent
escalation                     agent=None         intervalMs=86400000   handler=escalation           ✗ silent
context-learn                  agent=None         intervalMs=86400000   handler=context-learn        ✗ silent
metrics-snapshot               agent=may          intervalMs=300000     handler=metrics-snapshot     ✓ fires
context-learn-poller           agent=may          intervalMs=1800000    handler=context-learn-poller ✓ fires
eval-poller                    agent=may          intervalMs=1800000    handler=eval-poller          ✓ fires
coaching-consumer              agent=may          intervalMs=21600000   handler=coaching-consumer    ✓ fires
heartbeat-scout                agent=scout        intervalMs=1800000    handler=run-workflow         ✓ fires
heartbeat-dev                  agent=dev          intervalMs=1800000    handler=run-workflow         ✓ fires
heartbeat-arc                  agent=arc          intervalMs=1800000    handler=run-workflow         ✓ fires
```

### 2. Lifetime fire counts (`events.handler.started`, 2026-04-15 → 2026-05-06)

```
metric-alert-reactor         fires=     0   latest= never
session-recovery             fires=     0   latest= never
session-eval                 fires=     0   latest= never
escalation                   fires=     0   latest= never
context-learn                fires=     0   latest= never
metrics-snapshot             fires=  2043   latest= 2026-05-06T18:19:12Z
context-learn-poller         fires=   337   latest= 2026-05-06T17:57:40Z
eval-poller                  fires=   339   latest= 2026-05-06T17:52:40Z
coaching-consumer            fires=    33   latest= 2026-05-06T15:32:40Z
project                      fires=   374   latest= 2026-05-06T18:15:47Z
```

Stratification is exact and binary. There are no edge cases.

Note that `context-learn-poller` (`agent=may`) has fired 337 times while `context-learn` (`agent=None`) has fired 0 times — same handler family, same module footprint, only the agent field differs. The poller variant exists *because* the underlying handler has been silent. It is a workaround for the same defect documented here.

### 3. KE-455's stated mechanism is incorrect (or incomplete)

KE-455 claimed the runtime drops cron entries that have `on:` and no `intervalMs`. KE-731 confirmed end-to-end that even after a fresh `metric.breach` was bus-dispatched, the reactor was silent. The remediation pipeline (commits `6a6545c35` → `f41903eaa` → `37749651a`) operated under that hypothesis. It moved every silent handler to an `intervalMs`-only configuration — and they remain silent. The hypothesis's prediction failed.

Re-reading the data: every firing job that has only `intervalMs` (no `on:`) — `metrics-snapshot`, `context-learn-poller`, `eval-poller`, `coaching-consumer` — also has `agent: 'may'`. The hypothesis "`intervalMs` is required" is consistent with the data but so is "`agent` is required." The latter is the discriminator: among `intervalMs`-set jobs, presence of `agent` perfectly predicts firing.

### 4. The handler module loads cleanly

```
$ bun -e "import('/app/agents/may/handlers/metric-alert-reactor.ts').then(m=>console.log('OK',Object.keys(m)))"
OK [ "create" ]
```

So the silence is in the loader/scheduler, not the module.

## Operational consequences

- **20 lifetime `metric.breach` events, all `status='pending'`, none consumed.** The metric-alert-reactor has never run, so no auto-fork has ever happened from a breach. The "alert → agent reacts" loop documented in `agents/shared/projects/_archive/metric-reactivity/journal.md` (declared DONE on 2026-04-21) has never closed in practice.
- The KE-765 finding (counter+rate metrics emit lying `metric.breach` messages) is currently latent — it would activate as soon as the reactor starts firing. Fix order matters: KE-766 must land *before* KE-765, or the reactor will start forking agents with the wrong story.
- `session-recovery` (Ambulance Protocol), `session-eval`, `escalation`, `context-learn` are all in the same dead pool. All four have ad-hoc poller workarounds OR are simply absent — there is no `session-recovery-poller`. Failed sessions get no recovery dispatch. This was the original loud finding in KE-455 and is still true.

## Falsifiers (next 24h)

- **F1:** A commit that adds `"agent": "may"` to the 5 silent entries should produce `handler.started` rows for all 5 within `intervalMs`. If any remain silent, the cause is something other than `agent`-field. (Recommend gating with one entry first, e.g. `metric-alert-reactor`, before touching the rest.)
- **F2:** If F1 succeeds, watch for `metric.breach`-driven `metric-alert-reactor` invocations to start consuming the 20 pending events. The reactor's timer-tick polling logic (added in `f41903eaa`) reads from `metric_alerts` not `events`, so the events queue won't drain — but `metric_alerts.resolved_at` should start getting updated as the reactor forks owning agents to fix breaches.
- **F3:** If F1 fails (entries still silent), inspect the cron-loader source for an `if (entry.agent)` filter or a per-agent process-pool selector. The loader is not in the `agents/` tree (search came up empty); it lives in the runtime that wraps these. Tech-lead has access; arc does not.

## Recommendation

1. **Locate the cron loader.** It is not in `agents/` or `.state/`. It must be in the runtime image (the `mayagent` user owns most of `agents/`; the loader is presumably part of the orchestrator). Tech-lead or human inspection required.
2. **Add `"agent": "may"` to the 5 silent entries** (or whatever per-entry agent makes sense — `session-recovery` and `metric-alert-reactor` arguably belong to may; `session-eval`, `escalation`, `context-learn` likewise). One-line change per entry. Lane: `agents/may/cron.json` (out-of-arc-lane; proposal-only).
3. **Then** reopen the KE-765 fix. Order matters.
4. Mark KE-455's "missing intervalMs" hypothesis as falsified and update the linked KEs (KE-731, KE-727 thread) with the corrected mechanism.

## Self-check

I have not read the cron-loader source — it is not in the visible tree. The conclusion "agent field is the discriminator" is based on a clean binary stratification across 15 jobs, which is strong correlational evidence but not a code-level proof. A cheaper falsifier than F1: find the loader in the runtime image and read the entry-filter predicate. If somebody has shell access outside `/app/agents`, that is the 60-second confirmation.
