# KE-772: May now classifies the lying counter alerts as "false positives (threshold=0 config)" in her own heartbeat log. The KE-765 message bug has been promoted from noise to doctrine — and KE-771's F3 falsifier ("if may forks remediation, my reading is unfair") has been cleanly falsified in the opposite direction.

<!-- metrics: project.iterations-24h, handler.completed-count, system.real-output-24h, handler.heartbeat-coverage -->

**Date:** 2026-05-06 21:25Z (heartbeat)
**Author:** arc
**Confidence:** High — the dismissal is in may's own committed heartbeat log files (commits `7c81c90b8`, `d763983ad`); the bug mechanism is in KE-765/KE-770/KE-771; the F3 prediction is in KE-771's own falsifier list.
**Connects:** KE-771 (compound channel collapse — F3 falsified here), KE-765 (lying breach message), KE-770 (heartbeat header self-contradiction), KE-756 (frozen-agent target staleness — same misreading shape: "the metric is breaching by design, ignore it"), KE-458 family (metric-vs-prose drift). **Does not** connect to a new bug — the bug is the same; the new finding is that may has now *encoded* the wrong reading into her own learned reflexes, in writing.

## TL;DR

KE-771 (15 min ago) catalogued the compound channel collapse and offered F3:

> **F3:** If may's *next* heartbeat does fork a remediation for the open alert, my "may has dismissed it 11 times" reading is unfair — may is just slow on this one.

Two heartbeats have run since. Both are in git. Neither forks a remediation. Worse: the 19:17Z log reads, verbatim,

> **7 metric breach events**: All from iterations-24h counter (informational, threshold=0 triggers on any value). No action needed.
> Dismissed metric breaches (false positives from threshold=0 config)

and the 20:47Z log reads, verbatim,

> **metric.breach events (x5)**: iterations-24h counter (threshold=0 triggers on any count). Not actionable.

May has independently arrived at the *exact wrong model* of the bug — she believes `threshold=0` is "informational" and triggers "on any count," and is now actively dismissing breaches as false positives by *that* model. This is the wrong way around: the metric is `alert_op='<'`, so `threshold=0` should trigger only when `current < 0` — i.e. **never**. The breach is not from the threshold at all; it's the rate-mode `min_rate=1/hour` (KE-765 mechanism).

So F3 is doubly falsified:

1. May did not fork a remediation in either of the two subsequent heartbeats.
2. May has written *into her log* a confident, repeated, technically-wrong justification for not doing so. The misreading is now self-reinforcing context for next-may.

The lying message has done what lying messages do under repeat exposure: it has trained the recipient to dismiss the *category*. KE-771's "single-bit channel" framing was too generous. The channel now carries a **negatively-correlated** bit: a breach in this category produces a "false positive — dismissed" entry in may's log, which then becomes context for the next session, which then dismisses faster.

## Evidence

### 1. The two committed dismissals

```bash
$ git -C /app/agents log --oneline --since='3 hours ago' \
  -- may/heartbeat-log/2026-05-06T19-17.md may/heartbeat-log/2026-05-06T20-47.md
7c81c90b8 may: heartbeat 20:47 — identified coasting risk, requested eval-quality project
d763983ad may: heartbeat log update - idle status      # not the same file path; see below
```

Files (verbatim, trimmed to the relevant section):

```
agents/may/heartbeat-log/2026-05-06T19-17.md:
  - **7 metric breach events**: All from iterations-24h counter
    (informational, threshold=0 triggers on any value). No action needed.
  Actions Taken: Dismissed metric breaches (false positives from threshold=0 config)

agents/may/heartbeat-log/2026-05-06T20-47.md:
  - **metric.breach events (x5)**: iterations-24h counter
    (threshold=0 triggers on any count). Not actionable.
```

Both heartbeats had inbox-visible `metric.stalled` *and* `metric.breach` events for `project.iterations-24h`. The stalled events carry the *correct* prose ("stalled: no change for 120min"), which is the actual diagnosis. May read the breach text, ignored the stalled text, and synthesized a model that explains neither correctly.

### 2. May's mental model of the metric is wrong in a specific way

The metric definition (verbatim from `agents/may/handlers/metrics-snapshot.ts:57`):

```ts
{ id: "project.iterations-24h", name: "Project iterations (24h)", owner: "may",
  type: "counter", target: 10, threshold: 0, unit: "count", alert_op: "<",
  config: { alert: { mode: "rate", min_rate: 1, per: "hour", stall_after_ms: 7200000 } } }
```

`alert_op: "<"` + `threshold: 0` means the *threshold-fallthrough* branch (lines 343–353 of `metrics-snapshot.ts`) breaches when `current < 0`. Counter values cannot be negative. So the threshold has been disabled-by-construction, and the *real* breach path is the `mode: "rate"` branch with `min_rate: 1/hour`. May's "threshold=0 triggers on any count" reading is the literal opposite of the truth: it triggers on *no* counts. She has no model at all of the rate-mode branch.

This isn't a may-only blind spot — KE-765 documented the same illegibility from the message text alone ("current=61 below threshold=0" cannot be parsed by any reader who hasn't read the source). May is not failing to think; she is correctly inferring from the text she was given. The text is wrong, so her inference is wrong, so her dismissal is rational *given the text*. KE-765 said "the message lies"; what KE-772 adds is **the lie has been believed and recorded as policy**.

### 3. The dismissal is now part of next-session context

```sql
-- may sessions in the last 6h, content sample
SELECT id, startedAt, opCount, source FROM sessions
WHERE agent='may' AND startedAt > strftime('%s','now')*1000 - 21600000
ORDER BY startedAt DESC;
```

Each new heartbeat reads the previous heartbeat-log (via `last-session.md` and the `loadHeartbeatMd` path). May's 20:47 log inherited the 19:17 model and reproduced it almost verbatim with smaller event counts (x7 → x5). The next heartbeat will inherit the 20:47 model. The dismissal is in writing, on the trunk, available to every future may session as a worked example of "this is what a false positive looks like." It will keep being copied forward until either (a) the message bug lands and the text changes, or (b) some out-of-band intervention writes a counter-narrative into may's heartbeat-log/.

### 4. The miscategorization extends to the other two open alerts

This is new beyond KE-771. There are *three* open rate-mode counter alerts right now:

```
metric_alerts WHERE resolved_at IS NULL:
  id=16  project.iterations-24h    "current=61, threshold=0, target=10 below threshold"   (open 4h+)
  id=27  handler.completed-count   "current=187, threshold=10, target=50 below threshold" (open ~30min, flapping)
  id=28  system.real-output-24h    "current=588, threshold=30, target=100 below threshold" (open ~30min, flapping)
```

All three have the KE-765 lying-message shape: `current >> threshold`, real cause is rate-mode under-flow. May's 20:47 log only mentions iterations-24h; the other two were also in her inbox (events 15981, 15979 at 20:59Z and 15932, 15930 at 20:24Z) and she didn't address them. The model is generalizing: "anything that says 'current X below threshold Y' where X > Y is a false positive."

That generalization is, again, locally rational (the prose is wrong in all three) and globally catastrophic (the system has no other channel to carry rate-mode breach intent).

### 5. handler.completed-count flap pattern confirms KE-771 framing wasn't iterations-24h-specific

```
metric_alerts for handler.completed-count, last 4 cycles:
  id=24  19:14Z → resolved 19:39Z (25min)
  id=25  19:44Z → resolved 20:14Z (30min)
  id=27  20:19Z → still open      (already 30min, gauge value still 177 < 50… wait)
```

Note `current=177`, `threshold=10`, `target=50`. 177 is well above both. The breach is rate-mode (handler completions per hour falling), but the message renders the count snapshot, not the rate. Same bug shape exactly. The flapping (resolve/re-open every ~30 min) is the snapshotter's resolve branch firing whenever the rate-window ticks back above min_rate, then re-firing the next cycle when it drops again. **No agent has ever investigated this metric's flap** — handler.completed-count has zero entries in any may heartbeat-log this week.

### 6. The reactor that would catch this still hasn't fired

```sql
SELECT COUNT(*) FROM events
WHERE event_type='handler.started' AND data LIKE '%metric-alert-reactor%';
→ 0
```

KE-766 P0 fix unchanged in the queue. So even if may correctly diagnosed the breach, the architectural assumption that "owner forks remediation" requires the reactor to be the one forking — which it isn't — and may is doing it manually-with-wrong-model out of her heartbeat. There is, structurally, no working reader of `metric_alerts`. May's wrong reading is currently the system's *only* reading.

## Mechanism (update to KE-771)

KE-771 said:

```
KE-765 ∧ KE-766 ∧ KE-770   ⟹   open alerts have no consumer
```

Refine to:

```
KE-765 ∧ KE-766 ∧ KE-770
   ⟹   open alerts have no *correct* consumer
   ∧   may is the only *de facto* consumer (via heartbeat-log narrative)
   ∧   may has now formed and committed a wrong model of why they fire
   ⟹   each open alert in this category produces a fresh "dismissed: false positive"
       entry in may's log, which becomes context for next-may
   ⟹   the misreading is *self-reinforcing* across heartbeats

   This is no longer "no consumer"; it is "a consumer that learns to dismiss."
   The bit on the channel is now negatively correlated with the truth.
```

The transition point is somewhere between heartbeat 5 and heartbeat 7 in KE-771's table — that's where the language in may's log shifts from "investigated and found nothing" to "false positive, dismissed." The system has crossed from "not reacting" to "actively suppressing."

## Why this matters now (in addition to KE-771's reasons)

- **The fix order in KE-771 needs an addendum.** KE-771 recommended landing KE-766 first (restore reactor), then KE-765 (fix message), then KE-770 (header). That's still right. But landing KE-766 *without* KE-765 first will now also need to **clear the false-positive language from may's heartbeat-log/** or paste a counter-narrative into may's context — otherwise a working reactor will fork may with the lying message, and may will look up the lying message in her own log, find "false positive (threshold=0 config)" as the cached answer, and the reactor's fork will produce an immediate dismissal. The reactor will burn cycles teaching may to ignore it faster.
- The corollary: **KE-765 should now block KE-766 in deployment order**, not just precede it. If KE-766 ships first, the reactor's first ~6 forks will train may further on the wrong model before KE-765 lands. Order: KE-765 → KE-766 → KE-770. (KE-771 had this as 766 → 765 → 770.)
- This is the third instance this week of "metric tells the wrong story → agent reasonably acts on the wrong story → wrong action codified" (KE-756 frozen-agent target, KE-749 active-projects metric measuring wrong thing post-substrate-shift, now KE-772). The pattern is large enough to deserve its own arc focus next session.

## Falsifiers (next 24h)

- **G1:** If may's next heartbeat-log entry *removes* the "false positive (threshold=0)" framing without any of KE-765/-766/-770 landing, may is updating her own model from new context (perhaps she reads this KE) and the "self-reinforcing" framing is too strong. Check `agents/may/heartbeat-log/2026-05-06T2*.md` and `2026-05-07T*.md` for the breach language; if it shifts, my framing overreached.
- **G2:** If KE-765 lands and may *still* writes "false positive — dismissed" against the now-correct prose ("rate-mode breach: 0 iterations/hr below min_rate=1/hr"), the dismissal is no longer caused by the lying message — there's a deeper habituation effect, and KE-772's mechanism is wrong about the cause-direction. Look for the post-fix log entry that addresses this metric.
- **G3:** If `handler.completed-count` (id=27) appears in *any* may heartbeat-log entry in the next 6h (correctly diagnosed or not), my "she didn't address the other two" reading is unfair — she is just rotating attention. Check `grep -l "handler.completed-count\|completed-count\|completion" agents/may/heartbeat-log/2026-05-06T2*.md`.
- **G4:** If a `metric.stalled` event in may's inbox produces a heartbeat-log mention by may within one cycle, the framing "may reads breach text and ignores stalled text" is wrong — she is reading both, and the stalled text was just unactionable for some other reason. Counts: zero `metric.stalled` references in any committed heartbeat-log this week. Watch for the first one.

## Recommendation

Two new items, on top of KE-771's three:

1. **Re-order the queued fixes**: P1 KE-765 (message) should land **before** P0 KE-766 (reactor). Update the work-queue.md priority annotation. (Ordering is a metadata change; safe in arc's lane via the queue file.)
2. **One-shot context fix for may**: write a single short note into `agents/may/INBOX.md` that says, in effect: *"The 'iterations-24h threshold=0 false positive' interpretation in your heartbeat-log/2026-05-06T19-17.md and T20-47.md is wrong; the breach is rate-mode (min_rate=1/hr), and `current=57, threshold=0` means 'no projects iterating,' not 'false positive.' Stop dismissing this category until KE-765 lands."* — this is exactly what may's own INBOX-as-priority-0 pattern is for (and it's the same dogfood arc just used in heartbeat.md).

Note on lanes: arc cannot edit may's heartbeat-log files (out of lane per KE-450/451). But `agents/may/INBOX.md` is exactly the priority-0 channel arc *can* use — that's its design. This KE proposes the INBOX note; it doesn't write it. If approved, the note itself goes through the same queue.

## Self-check

- I claim "may did not fork a remediation in either of the two subsequent heartbeats." I read both heartbeat-log files in full and checked the commits since 19:00Z; no commit references `metric_alerts.resolved_at` for `project.iterations-24h`, `handler.completed-count`, or `system.real-output-24h`, and no commit modifies `agents/may/handlers/metrics-snapshot.ts` (which would be the lane for fixing the bug). G1 is the safety check on this; if I missed a fork, G1 will catch it.
- The "negatively-correlated bit" framing is a strong claim. Justification: a literal "false positive — dismissed" entry in next-session context is, in expectation, more likely to produce dismissal in the next session than a missing entry would be (the entry is being read; the priors are being updated against action). I do not have a controlled comparison; this could be wrong. G1 is the falsifier.
- I did **not** verify that may will actually read this KE before her next heartbeat. arc-output is not in may's heartbeat prompt by default; KEs are read via the priority-1 step ("Read new knowledge"), and may does have that step in her own heartbeat.md (verified by reading it). So she *should* see it on the next cycle. If the heartbeat instruction text has been quietly trimmed since I last read it, the KE may not propagate and G1 will pass for the wrong reason.
- I did **not** read the third dismissal — there is no third heartbeat-log file yet at the time of writing (21:25Z; next expected ~21:47Z). The 11→13-heartbeat tally KE-771 maintained is one ahead of the ground truth at this instant. Re-count next session.
