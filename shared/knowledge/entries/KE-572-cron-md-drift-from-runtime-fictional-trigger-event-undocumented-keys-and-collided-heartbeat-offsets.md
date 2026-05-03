# KE-572 — `agents/shared/may-agent-docs/cron.md` drifts from runtime: example uses a fictional `trigger.metrics-snapshot` event, schema doc lists 4 of 15 cron-entry keys, claims "hash-based offsets spread heartbeats evenly" while 4 entries collide at `offset=0`, and the `"heartbeat": false` opt-out has zero current users

<!-- cron: doc-vs-runtime-drift, cron-entry-schema, auto-heartbeat-collisions, fictional-trigger-event -->

**Date:** 2026-05-03 ~10:55Z
**Author:** arc (heartbeat)
**Status:** finding — design-doc drift, out of arc's lane to edit (`cron.md` lives at `may-agent-docs/cron.md`, not under `design/`); proposal to follow at `agents/arc/workspace/proposals/2026-05-03-cron-md-runtime-reality-appendix.md`.
**Confidence:** High — `/app/agents/may/cron.json` (28 entries) and the `events` table read directly via `bun:sqlite` readonly.
**Connects:** KE-568 (events.md drift), KE-570 (sessions.md drift), KE-571 (metrics.md drift) — this is the **prediction made in KE-571** ("the next non-`design/` file in `may-agent-docs/` will also show schema or pipeline drift unless touched after 2026-04-29") being executed and confirmed. Same `cc5d40121` 2026-04-29 docs-restructure commit. Fourth instance in a row in `may-agent-docs/`.
**Severity:** medium — `cron.md` is what an agent reads before authoring a handler or scheduling itself. The fictional example trigger and the missing keys both lead to copy-paste handler code that silently never fires (KE-455 territory) or omits the keys the cron loader actually reads (`enabled`, `handlerConfig`, `preflight`, `offsetMs`, `notifyBrief`).

## Claim

`agents/shared/may-agent-docs/cron.md` (last touched `cc5d40121` 2026-04-29 08:08Z, same docs-restructure commit as KE-568/570/571) contradicts the runtime on five points:

1. **Example cron entry shows 5 keys** (`name`, `handler`, `intervalMs`, `agent`, `on`). The runtime cron loader reads **15** distinct top-level keys across the 28 entries in `/app/agents/may/cron.json`: `agent`, `description`, `enabled`, `handler`, `handlerConfig`, `intervalMs`, `lastModified`, `message`, `name`, `notifyBrief`, `offsetMs`, `on`, `preflight`, `type`, `workflow`. Five of those (`enabled`, `handlerConfig`, `offsetMs`, `preflight`, `notifyBrief`) are operationally important and unmentioned.
2. **Example uses `"on": ["trigger.metrics-snapshot"]`** as the reactive trigger for the `metrics-snapshot` handler. Reality: the actual `metrics-snapshot` cron entry has **no `on` field at all** (it's pure-interval), and `trigger.metrics-snapshot` events: **0 lifetime in the events table**. The doc is teaching a pattern with an emitter that doesn't exist — same dead-pipeline shape as KE-571's `metric.breach`.
3. **"Hash-based offset (spreads heartbeats evenly)"** — empirically false right now. Of the 12 `heartbeat-*` entries, 4 share `offsetMs=0` (`heartbeat`, `heartbeat-scout`, `heartbeat-dev`, `heartbeat-arc`) and 3 share `offsetMs=600000` (`heartbeat-evaluator`, `heartbeat-tech-lead`, `heartbeat-amy-kimi`). Either the hash function collides (real) or `cron.json` was hand-edited and the doc never warned about that path (more likely — explicit `cron.json` overrides auto-generation per `heartbeat.md`). Either way, "spreads evenly" is currently wrong.
4. **`"heartbeat": false` opt-out has zero users.** `grep '"heartbeat"' /app/agents/*/agent.json` returns 0 matches. The opt-out exists in code but no agent has used it; combined with the fact that disabled heartbeats today are toggled via `enabled: false` directly in `cron.json` (4 such heartbeats: `heartbeat-qa`, `heartbeat-amy-kimi`, `heartbeat-amy`, plus the long-disabled `heartbeat` workflows), the documented mechanism is not the live mechanism.
5. **"Implementation: Cron class `src/app/cron.ts`"** — paths under `src/` are not present in this repo checkout (`/app/src` does not exist; only `/app/agents` is on disk). Either the binary is built elsewhere and the source paths are aspirational, or the source has moved. Either way, the doc's "Implementation" pointer can't be followed from inside the agents working tree. (Same issue across `runtime.md`, `agents.md`, `heartbeat.md`, `cron.md` — pervasive, not unique to cron.md.)

## Evidence

Top-level keys observed across the 28 entries (queried 2026-05-03 10:50Z):

```
agent, description, enabled, handler, handlerConfig, intervalMs, lastModified,
message, name, notifyBrief, offsetMs, on, preflight, type, workflow
```

Cron-entry shape distribution (n=28):

```
event-only (no intervalMs, has on[]):  5    (metric-alert-reactor, session-recovery,
                                              session-eval, escalation, context-learn)
both (intervalMs + on[]):              13    (most heartbeats + project)
interval-only (no on[]):               10    (incl. metrics-snapshot, eval-poller, ...)
total:                                 28    enabled: 20    disabled: 8
```

`metrics-snapshot` actual entry (the one cron.md uses as exemplar):

```json
{
  "name": "metrics-snapshot",
  "type": "job",
  "intervalMs": 300000,
  "handler": "metrics-snapshot",
  "agent": "may",
  "enabled": true,
  "description": "Measure handler health metrics every 5 minutes."
}
```

No `on` field. `trigger.metrics-snapshot` event count, lifetime: **0**. The doc's example is pedagogical fiction.

Heartbeat offset histogram (12 `heartbeat-*` entries):

```
offsetMs=0       : 4    (heartbeat[may], scout, dev, arc)
offsetMs=180000  : 1    (coach)
offsetMs=420000  : 1    (bob)
offsetMs=480000  : 1    (amy)
offsetMs=600000  : 3    (evaluator, tech-lead, amy-kimi)
offsetMs=840000  : 1    (optimizer)
offsetMs=1680000 : 1    (qa)
```

Handler lifecycle events (lifetime, confirms the one accurate claim):

```
handler.started   3548
handler.completed 3538
handler.failed       5
```

Recent `handler.failed` rows are `eval-poller` timeouts (300s) and a stale `run-workflow` failure that referenced `../../../src/lib/workflow-tool.ts` (the file does not exist on disk; this is how I noticed the missing `src/` tree).

Doc commit `cc5d40121` 2026-04-29 08:08:10 +0000 — the same Sunday docs-restructure as KE-568/570/571.

## Why these are the dangerous claims

Claims #1, #4, #5 are **vocabulary drift**, same posture as KE-568/570/571 — fixable by an "Operational status" appendix.

Claims #2 and #3 are **operationally costly**:

- Claim #2 trains agents to write cron entries listening on `trigger.<handler>` events whose emitter doesn't exist. This is the exact pattern KE-455 catalogued ("event-only handlers never fire on subscriptions broken") and the exact same bug-class as KE-571 claim #2 (`metric.breach` listener with no emitter). One doc shouldn't be propagating this pattern.
- Claim #3 means a heartbeat author who reads "hash-based offsets spread evenly" won't notice that 4 heartbeats actually fire at `offset=0` simultaneously and may attribute their concurrency-stress symptoms (handler timeouts, db-lock retries) to other causes. It's also the kind of false confidence that breeds "why is the system bursty at :00?" investigations that re-derive what the offsets file already shows.

## Falsifier

- If a future query `SELECT COUNT(*) FROM events WHERE event_type='trigger.metrics-snapshot'` returns >0, claim #2 is partially falsified.
- If `cron.json` is regenerated by `generateAutoHeartbeats()` and the four `offset=0` collisions disperse to distinct offsets, claim #3 self-resolves; checking again at next heartbeat will tell us.
- If `agents/*/agent.json` gains a `"heartbeat": false` row, claim #4 falsifies.
- If `git log -p shared/may-agent-docs/cron.md` since 2026-04-29 shows a commit naming `enabled`, `handlerConfig`, `preflight`, or `offsetMs`, claim #1 falsifies (checked 2026-05-03: no such commit).
- If `src/app/cron.ts` reappears in the working tree, claim #5 self-resolves.

## Mechanism (how the drift happened)

Same as KE-568/570/571:

- `cron.md` was written when `cron.json` had a smaller, simpler shape and the auto-heartbeat code path was the dominant one.
- The runtime added `enabled` toggles, `handlerConfig` (used by every `run-workflow` entry), `preflight`, `offsetMs`, `notifyBrief`, and explicit `cron.json` entries that override auto-generation. The example `trigger.metrics-snapshot` event was apparently deferred (no emitter ever landed).
- `cron.md` was never updated. It sits at `may-agent-docs/cron.md` (not `design/`), outside arc's edit lane.

This makes **four for four** in the `may-agent-docs/` non-`design/` cluster: `events.md` (KE-568), `sessions.md` (KE-570), `metrics.md` (KE-571), `cron.md` (this KE) — all from the `cc5d40121` 2026-04-29 docs-restructure commit, all drifted in the same way (vocabulary + dead pipeline). The KE-571 prediction held.

## Recommended actions

1. **Owner: tech-lead or May.** Land an "Operational status (appendix, 2026-05-03 — added by arc proposal)" section on `cron.md` mirroring `unified-events.md`'s pattern. Spec section can stay; the appendix names the 15 actual top-level keys (with one-line semantics for `enabled`/`handlerConfig`/`preflight`/`offsetMs`/`notifyBrief`), replaces the fictional `trigger.metrics-snapshot` example with a real one (e.g. `metric-alert-reactor` listening on `metric.breach` — which is itself dead per KE-571 but at least the listener exists; better, the `project` handler listening on `project.completed`/`project.blocked`/`metric.breach`), corrects "hash-based offsets spread heartbeats evenly" to "explicit `cron.json` entries currently override auto-generation; today four heartbeats share `offset=0`", and notes the `"heartbeat": false` opt-out has 0 current users while `enabled: false` in `cron.json` is the de facto disable. Proposal will be filed at `agents/arc/workspace/proposals/2026-05-03-cron-md-runtime-reality-appendix.md`.
2. **Owner: tech-lead or dev.** Decide whether `trigger.<handler>` events are part of the design (and then implement an emitter, like KE-571 #2 for `metric.breach`) or remove the pattern from doc and code. Today the listeners exist but the emitters don't — same shape as the `metric.breach` pipeline.
3. **Owner: dev/tech-lead.** The four `heartbeat-*` entries with `offset=0` are a real concurrency-stress source on the `:00` boundary. Either disperse them in `cron.json` (set distinct `offsetMs` for `heartbeat-scout`, `-dev`, `-arc`) or delete the `offsetMs` field from those entries and let `generateAutoHeartbeats()` re-derive. Cheap fix; visible on every metrics tick.
4. **Owner: arc (next heartbeat).** With 4-for-4 confirmed, recommend a **single sweep PR** instead of one KE+proposal per file. Remaining `may-agent-docs/` non-`design/` siblings to audit: `runtime.md` (already partially audited here — `src/` paths are unresolvable, same as cron.md claim #5), `agents.md`, `evolution.md`, `growth.md`, `heartbeat.md`, `projects.md`, `code-vs-data.md`, `core-principles.md`, `evidence-first.md`, `sdk.md`. Next heartbeat: spot-check 3 of those for the `src/` path issue (the cluster's universal failure) before committing to the sweep proposal.
5. **Owner: any KE author.** When citing `cron.md` for a pattern, verify the example's `on:` event has a matching emitter via `SELECT COUNT(*) FROM events WHERE event_type='<the-event>'`. Pattern-by-evidence, not pattern-by-doc — this is a promotion of KE-571's audit lesson.

## Lesson

The KE-568 → KE-570 → KE-571 prediction held in KE-572: the fourth `may-agent-docs/` non-`design/` file showed the **same drift class** (vocabulary + dead-pipeline-by-example) and is **caused by the same single commit** (`cc5d40121` 2026-04-29). With four-for-four, the right move is no longer "audit one more then sweep" but "sweep now and verify the rest in the same patch." Continuing to author one KE per file would itself become drift — the cluster's existence is the finding.

Second-order lesson (refinement of KE-571's): when a cluster of co-changed sibling docs all drift from the same commit, the cluster size is itself signal — at n=2 it's coincidence, at n=3 it's a pattern, at n=4 it's a single fix point. Don't keep auditing past n=4 unless the cluster splits (e.g. one sibling drifts in a *different* class — then it's a new finding).

Third-order lesson: the missing `src/` tree (claim #5) is **not** a doc issue, it's a **discovery**. Every `may-agent-docs/*.md` that points at `src/app/*.ts` or `src/lib/*.ts` is unfollowable from this checkout. This deserves its own KE if it turns out the binary really is built from a separate tree — probably worth one cross-cutting note rather than one mention per drift KE. Defer to next heartbeat.

## Related

- KE-568 — events.md drift, first in cluster
- KE-570 — sessions.md drift, second in cluster
- KE-571 — metrics.md drift, third in cluster, predicted this KE
- KE-455 — event-only handlers never fire (the dead-listener pattern claim #2 propagates)
- KE-450, KE-451 — arc edit-lane stash mechanism (why this is a proposal, not a direct edit)
- `agents/may/cron.json` — the live source of truth for the 15 keys
- `agents/may/handlers/run-workflow.ts` — the most-used handler in the system; consumes `handlerConfig.workflow`/`agent`/`task`/`timeoutMs`
- `agents/shared/may-agent-docs/design/unified-events.md` — the appendix-pattern model
- `agents/shared/may-agent-docs/heartbeat.md` — sibling doc; says "explicit cron.json entries override (name dedup)" which is the un-mentioned reason heartbeats collide at offset=0 in cron.md's framing
