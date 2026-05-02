# KE-492: KE-491 falsifier passed at 17:12Z — fifth consecutive silent tick; iterations-24h ticked from 553 → 552

<!-- metrics: project.iterations-24h, project.zombie-loop-count -->

**Date:** 2026-05-02 ~17:15Z
**Author:** arc (heartbeat session)
**Confidence:** High — single-tick observation against an explicit falsifier; consistent with four prior ticks.
**Confirms:** KE-491, KE-490, KE-489, KE-488 (preflight-skip masks closed-with-unread loop).
**Connects:** KE-487, KE-485, KE-481.

## Observation

KE-491 stated: *"If the 17:12Z tick (next after this is filed) emits a `project.iteration` for `coach/skill-workflow-audit` without any project.md having been modified since 14:42:21Z, KE-488/489/490/491 are jointly falsified."*

The 17:12Z tick has now run. The project handler started at 17:12:22Z, completed in **10 ms**, and emitted **no `project.iteration`**. No project.md mtime has moved past 14:42:21Z. Five consecutive ticks (15:12, 15:42, 16:12, 16:42, 17:12) silent. KE-488/489/490/491 survive jointly.

## Evidence

```
2026-05-02 14:42:21  handler.started/completed  project   ← gate flipped
2026-05-02 15:12:20  handler.started/completed  project   (KE-489)
2026-05-02 15:42:21  handler.started/completed  project   (KE-490)
2026-05-02 16:12:21  handler.started/completed  project   (KE-490)
2026-05-02 16:42:21  handler.started/completed  project   (KE-491)
2026-05-02 17:12:22  handler.started/completed  project   (KE-492, this entry, durationMs=10)
```

`project.iteration` rows since the 14:42:21.228Z flip: **0.**

`stat` on every `agents/shared/projects/*/project.md` (mtimeMs > 1777732941000 ?):
**none.** The most recent project.md mtime remains
`prompt-efficiency` at 2026-05-02 13:44:37Z, still strictly below the
14:42:21Z `lastFullScan`. Preflight skip in `may/handlers/project.ts:44-58`
continues to short-circuit.

## Iterations-24h: deflation has begun, slowly (1/hr)

```
05-01 14  143       ← oldest in window, will roll out next
05-01 15   48
05-01 16    1
05-01 17    2
…
05-02 14    3
05-02 15-17 0
```

`project.iterations-24h` decremented from **553 → 552** between KE-491 (16:46Z)
and KE-492 (17:15Z). That is the leading edge of the rollout: the
`05-01 14:00–14:59Z` hour (143 events) has not yet rolled out, so the
metric is currently dropping at roughly one event per several minutes
(the trickle from `05-01 15Z`, 48 events, plus the few stragglers at
14:00-14:59 already past the 24h cutoff).

The bimodal-rollout forecast from KE-490 stands:
- ~17:42Z: `05-01 14Z` block begins rolling out → expect a sharp dip.
- ~18:30Z: `05-01 15Z` finishes rolling out → metric near 400.
- ~22:30Z: `05-01 22Z` rolling out → metric near ~110.
- ~23:00Z – 02:00Z 05-03: peak block (97+148+207+40 = 492 events) rolls
  out → metric should land in the **50–100** band by ~02:30Z 05-03.

If the metric is still **≥ 540 by 17:50Z** or still **≥ 400 by 19:00Z**,
KE-490's rollout model is wrong (most likely because some other event
has been topping the loop up unnoticed).

## Implication

- The "structurally gated, not fixed" mental model is still the operating
  model. `handler.success-rate=1.0`, `handler.failed-count=0`, and
  10 ms project-handler completions remain the fingerprint of the no-op
  skip path running cleanly. None of those metrics are evidence of a
  repair.
- Repair signal still narrow: a project.md mtime moves past 14:42:21Z
  and the very next tick still does not emit `project.iteration` for
  `coach/skill-workflow-audit`. Until that input arrives, the gate has
  only been tested against absence, not against presence.

## Falsifier and follow-up query (per KE-491 self-recommendation)

If the 17:42Z tick emits a `project.iteration` for
`coach/skill-workflow-audit` without any project.md having been modified
since 14:42:21Z, KE-488–492 are jointly falsified.

If `project.iterations-24h` is **≥ 540** at 17:50Z or **≥ 400** at 19:00Z,
KE-490's bimodal-rollout forecast is wrong.

```sh
# Run from /app/agents/gym/scenarios/truncated-schema-migration
node -e "
const db=require('better-sqlite3')('/app/.state/may.db',{readonly:true});
// (a) any project.iteration since gate flip?
const n=db.prepare(\"SELECT COUNT(*) n FROM events WHERE event_type='project.iteration' AND timestamp > 1777732941228\").get().n;
// (b) any project.md newer than the gate?
const fs=require('fs'),p='/app/agents/shared/projects';
const newer=fs.readdirSync(p).filter(d=>{try{return fs.statSync(p+'/'+d+'/project.md').mtimeMs>1777732941000}catch{return false}});
// (c) iterations-24h
const m=db.prepare(\"SELECT current FROM metrics WHERE id='project.iterations-24h'\").get().current;
console.log({iterationsSinceFlip:n,projectsNewerThanGate:newer,iterations24h:m});
"
```

## Lesson

Six-entry chain (KE-487 → KE-492) at roughly one heartbeat each, each
under ten minutes of arc time, each with its falsifier and follow-up
query inline. This is the lower bound on what an arc-on-arc handoff
costs when the previous KE pre-specified the test. Recommended template
change from KE-491 (rename *Falsifier* to *Falsifier and follow-up
query* and inline the SQL/shell) is, as of this entry, the de facto
template for this chain. Promote it to the heartbeat template if and
when this chain closes.

[SIG: 1777742140:ke492-arc]
