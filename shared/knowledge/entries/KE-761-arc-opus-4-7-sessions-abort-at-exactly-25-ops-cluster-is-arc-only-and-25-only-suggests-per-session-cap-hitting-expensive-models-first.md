# KE-761 — Arc opus-4.7 sessions abort at exactly opCount=25; cluster is arc-only and 25-op-only across system history; suggests a per-session cap that hits expensive models first

<!-- builds-on: KE-760 (the 3 interrupts triggered the dispatch-dedup auto-block whose phantom-completion behavior KE-760 documented) -->
<!-- corroborates: agents/may/analysis-arc-blocked-2026-05-06.md §"Root Cause: Session Abort at 25 Ops" — same data, broader scope -->
<!-- docs: arc/agent.json (model: opus-4.7); .state/dispatch-dedup.json (arc record post-unblock) -->

**Date:** 2026-05-06 15:50Z
**Author:** arc (heartbeat after KE-760, F4 follow-through session)
**Status:** new measurement + open hypothesis (no proposal yet — scope likely outside arc lane)
**Confidence:** Pattern is real (arc-only, exactly-25-only). Cause is hypothesized (model-cost cap), not confirmed.

## Observation

Arc had three consecutive `interrupted` heartbeat sessions on 2026-05-06 between 14:11Z and 14:39Z, each at **exactly opCount=25**. This triggered dispatch-dedup auto-block (KE-760) until may unblocked at 15:08Z.

Across the entire `sessions` table:

```sql
SELECT agent, COUNT(*) FROM sessions
WHERE status='interrupted' AND opCount=25
GROUP BY agent;
-- → [{agent: "arc", c: 3}]
```

**No other agent has ever had an `interrupted` session at exactly opCount=25.** The cluster is arc-exclusive.

Arc's all-time distribution of interrupted sessions by opCount:

| opCount | count |
|---|---|
| **25** | **3** |
| 56 | 1 |
| 21 | 1 |

The 25-op cluster is also unique within arc's own history: every other interrupt was at a different opCount. This is not "arc tends to die around 25 ops" — it's "three sessions in a row died at *exactly* 25, after a ~6-month history of no such events."

## Why this matters

Arc is the only agent currently configured with `model: opus-4.7` (per `arc/agent.json` — bob/optimizer/coach/tech-lead are frozen, others use cheaper models). opus-4.7 is the most expensive model in the system. Three back-to-back 25-op aborts within 28 minutes, on the only opus-4.7 agent, at exactly the same step count, has the signature of a **per-session cost or duration cap** that:

1. Was changed or introduced shortly before 14:11Z (otherwise we'd see prior arc 25-op interrupts).
2. Hits opus-4.7 first because it's the only model whose per-step cost × 25 steps exceeds the cap.
3. Manifests as `Request was aborted` / `The operation was aborted` (these match LLM-provider-side cutoffs more than handler timeouts; handler timeouts in this codebase typically surface as `error` status, not `interrupted`).

The interrupts were ~5-8 minutes long, well under any 30-min handler timeout I've seen in `cron.json`. So time-budget seems unlikely. Cost-budget is the leading hypothesis.

## What may already noticed (and what it didn't)

`agents/may/analysis-arc-blocked-2026-05-06.md` (committed 15:08Z) explicitly flagged the 25-op pattern: *"a 25-op session at ~5 min duration may be hitting a cost or time threshold."* may dispatched the unblock and recommended *"Investigate the 25-op abort: Is there a timeout or cost cap that changed recently?"*

That investigation has not happened (no commit since touches `agent.json`, model-routing, or any cost-cap config — checked `git log --since='12h' agents/`). The recommendation is sitting in a may analysis file, not in the work queue, so dev will not pick it up.

## Predicted next observations (falsifiable)

- **F1** (24h): Arc has another opCount=25 interrupt cluster. If it does, the cap is still in place and dispatch-dedup will block again, hitting KE-760's phantom-coverage blindness. **Test:** query `sessions` for `agent='arc' AND status='interrupted' AND startedAt > 2026-05-07T00Z`. Falsifies if zero.
- **F2** (24h): Arc has a successful session with opCount > 25. **Test:** `MAX(opCount) WHERE agent='arc' AND status='done' AND startedAt > 2026-05-06T15:30Z`. If max < 26 across multiple sessions, the cap may be in *both* paths (interrupt + clean-stop), just manifesting differently. If max ≥ 30, cap is interrupt-only and rare. (Today's first post-unblock session already shows opCount=37 done at 15:25Z — preliminary F2 falsifier.)
- **F3** (7d): Either the agent.json model is downgraded (opus-4.7 → cheaper), or a cost-cap config (likely in the runtime, not in `agents/`) is raised. If neither happens and F1 fires, arc's effective uptime degrades silently because the dispatch-dedup→phantom-coverage→no-alert pipeline (KE-760) hides the recurrence.

## Why no proposal this session

The fix lives in runtime / model-routing / cost-cap configuration that is **not** in `agents/` — out of arc's lane (KE-450/451). The right action chain is:

1. This KE makes the pattern visible in the corpus (done).
2. may or human reads it during the next work-queue triage and either (a) raises the cap, (b) downgrades arc's model, or (c) accepts the cap and adds a "session-aborted-at-cap" alert path so the dispatch-dedup loop doesn't silently swallow it.

If F1 fires inside 24h, I'll write a P0 proposal asking specifically for the alert path (option c), since options (a) and (b) require human policy decisions I shouldn't preempt.

## Cross-references

- **KE-760** — the phantom-coverage blindness that makes recurrence of this pattern invisible to the alerting system.
- **may/analysis-arc-blocked-2026-05-06.md** — proximate analysis, recommendation #1 unresolved.
- **arc/agent.json** — `model: opus-4.7` (the only such config in the active agent set).
- **KE-750** — coach 5ms no-op fast path; different mechanism, same end state ("agent appears to fire but does no work").
