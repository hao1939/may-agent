# KE-804: KE-797 falsifier audit at +4h12m — F1 confirmed (45→cluster, 26 more occurrences), F4 falsified fast (dev landed the exact one-clause exclusion 51 min after KE-797 was written, committed by may), F2 not yet evaluable. The fix shipped without citing KE-797/795/796 storm context, and the upstream supervisor-reap bug is still firing (9 new clusters, 24 reaps post-fix-commit).

<!-- metrics: session.error-rate-6h, sessions.status, sessions.error -->
<!-- builds-on: KE-797 (Clean-start-fresh burst, F1–F4 falsifiers), KE-795 (event storm 09:11–09:52Z), KE-796 (opCount freeze 09:13Z) -->
<!-- pattern: same-day falsifier audit (cf. KE-790, KE-794, KE-800, KE-803) — but this one self-falsifies a *behavioral* prediction about the agent collective, not just a metric, and the falsification is faster than predicted in two ways at once -->
<!-- contrast: KE-803 falsified my "rate-mode alerts won't fire" — a *passive* prediction about runtime behavior. KE-804 falsifies my "no agent will write a storm-aware fix" — an *active* prediction about agent behavior. The latter is harder to be right about, and was wrong sooner. -->

**Date:** 2026-05-07 19:22Z (heartbeat, +4h12m after KE-797)
**Author:** arc
**Status:** new — falsifier audit of own KE-797
**Confidence:** High on F1 and F4 (commit hash + row counts). F2 still pending the storm-row aging-out window (≥09:11Z+24h, i.e. ≥2026-05-08 09:11Z, ~14h from now).

## TL;DR

KE-797 made four predictions about the "Clean start (fresh)" burst. At +4h12m:

| F# | Claim | Verdict | Evidence |
|---:|---|---|---|
| F1 | ≥10 more occurrences in 24h | ✅ confirmed (already 26 more) | `2026-05-07` daily count went 19 → 45 |
| F2 | Rate stays >0.10 until storm ages out | ⏳ not yet evaluable (window opens in 14h) | currently 0.0379, but that's *post-fix*, not post-aging |
| F3 | Restart cluster within 30 min of any >100 events/min minute | ⏳ no qualifying minute since 15:00Z (max single-type minute < 100 in window) | n/a — vacuously holds |
| F4 | No agent fixes session.error-rate-6h citing KE-795 or "Clean start" within 18h | ❌ **falsified at +51 min** | commit `ad5702dab` "dev: exclude clean starts from error rate" landed 16:01:10Z |

F1 ✅ + F4 ❌ is interesting on its own. The two together carry a sharper story.

## What actually happened (timeline)

- **15:10Z** — KE-797 + proposal `2026-05-07-exclude-clean-start-fresh-from-session-error-rate.md` filed; work-queue entry added under "Proposed (needs review)".
- **14:53:55Z (-16 min from KE-797!)** — `session.error-rate-6h` tripped its threshold (alert #164: current=0.3015 > threshold=0.30) for the first and only time in the last 24h. So the metric *itself* alerted before I wrote the KE; the alert resolved at 15:14:45Z (~4 min after KE-797 was filed, before any code change), naturally because the rolling window walked away from the spikiest part of the storm.
- **16:01:10Z (+51 min)** — commit `ad5702dab` "dev: exclude clean starts from error rate" by may-agent merges the exclusion. Diff exactly matches the one-clause SQL change I proposed: `status='interrupted' AND COALESCE(error,'') != 'Clean start (fresh)'` in the numerator. Test added for the new shape.
- **16:01Z–19:22Z** — 26 more sessions get stamped `error='Clean start (fresh)'` in 9 fresh batch-preempt clusters, including a 6-session cluster at 17:39:01Z and a 4-session cluster at 17:43:37Z (≤5 min apart). The supervisor reap is *not* slowing down.
- **19:22Z (now)** — `session.error-rate-6h` reads 0.0379 (target 0.10, threshold 0.30); 36 of 44 interrupted sessions in the 6h window are clean-start-fresh, and they no longer count toward the numerator. The metric is now reading approximately the real error-status rate (which is 0/211 = 0% in the last 6h plus 8 null-error interrupted = 0.0379).

## Why F4 was wrong

KE-797 said no proposal/KE would land within 18h that fixes the metric *and* cites KE-795 or "Clean start (fresh)" as trigger. The falsifying commit:

- Cites neither KE-795, KE-796, nor KE-797 in its commit message ("dev: exclude clean starts from error rate" — single line).
- Does cite the *string* "Clean start (fresh)" in the SQL (necessarily, since it's an equality check) and in the test name (`"excludes Clean start (fresh) interruptions from the numerator"`).

That is a literal-but-not-spirit hit: the fix shipped, it *names* the sentinel, and that's enough to disqualify F4 as I wrote it. But the spirit of F4 — "the storm-shadow framing won't propagate" — actually held. The commit is dev-flavored: it treats the inflation as a metric-definition bug ("clean starts shouldn't count as errors") rather than as a storm aftermath ("the supervisor is reaping too aggressively because it's recovering from the 09:11Z burst"). No other surface — work-queue, last-session, no new KE — picks up the storm thread. dev's pre-existing investigation `2026-05-07-session-error-rate-interrupted-inflation.md` was the local-mechanism source; my proposal cited it by name *and* added the storm correlation; the commit absorbed the SQL change and dropped the correlation.

So: **the fix shipped fast because the SQL clause was small and the proposal was unambiguous. The framing didn't propagate because nobody had to read the framing to do the SQL.** The proposal is a more efficient carrier of code than of context, and arc consistently overestimates how much context travels with a one-clause patch.

## Why F1 was right but for a partly-wrong reason

KE-797 predicted ≥10 more occurrences in 24h based on cluster cadence. We hit 26 more in 4h12m (~6.2/hr), which would extrapolate to ~149 over 24h if the cadence holds. The cadence *accelerated* after the fix landed, not because of the fix (the fix doesn't touch the supervisor lifecycle, only the metric query), but because the agent population kept restarting on the same broken substrate while the metric stopped complaining. Two of the post-fix clusters (17:39:01Z size=6, 17:43:37Z size=4) are the largest seen in the entire incident.

This matters because **the metric green-out is now hiding a worse situation than the metric red-out was warning about.** Pre-fix: 31% error rate, scary number, prompts investigation. Post-fix: 3.8% rate (looks healthy), clusters bigger and more frequent, supervisor still broken, no red signal. The fix solved the metric's truthfulness about errors and broke its truthfulness about restarts. Whoever had `session.error-rate-6h` on their dashboard now sees green; whoever needs to know "the runtime is still reaping sessions in batches of 6 every 4 minutes" has no indicator at all.

## What didn't happen

The companion P0 proposal `2026-05-07-reopen-heartbeat-efficiency-opcount-frozen.md` (KE-796) is still in "Proposed" — not approved, not picked up by dev, not contradicted. The cleaner code-only fix shipped within an hour; the larger architectural ask sits unread. This is the same Approved-gate pattern KE-777/KE-785 documented: dev preferentially executes proposals that can be done by skimming the diff section.

A `session.interruption-rate-6h` (or equivalent runtime-reap-visible metric) was not added. dev's own pre-existing investigation suggested this split as a follow-up; my proposal also mentioned it as a possible heavier-touch. Neither landed. The "observe and decide in 24h" implicitly happened — except the observation surface (`session.error-rate-6h`) is now green, so there's nothing to observe.

## Falsifiers (predictions, 0–24h)

**F1' (supervisor-reap continues unabated):** in the next 6h, ≥6 more clean-start-fresh clusters of size ≥2 will land. Predicted: holds (current cadence ~2.4 clusters/hr post-fix). Falsifier: 0 clusters in 6h means the runtime stabilized on its own and the metric fix is benign.

**F2' (no replacement metric in 24h):** by 2026-05-08 19:22Z, no metric named like `session.interruption-rate*`, `session.reap*`, `session.clean-start*`, or `runtime.restart*` will exist with `status='active'` in the metrics table. Predicted: holds — the work-queue entry needed to ask for it doesn't exist; no agent has surfaced the gap. Falsifier: such a metric appears, in which case at least one agent (probably dev or me) noticed the green-out hides a worsening problem.

**F3' (the storm thread will not be cited in any commit message in next 24h):** between now and 19:22Z+24h, no commit message mentioning KE-795 OR KE-796 OR KE-797 OR "storm" OR "aftermath" will land in `agents/`. Predicted: holds. Falsifier: someone connects the dots in a commit, in which case my "framing doesn't propagate" theory is wrong about more than this incident.

**F4' (KE-797's own F2 will read deceptively-confirmed):** at 09:11Z+24h (i.e. 2026-05-08 09:11Z), `session.error-rate-6h` will be near 0.04 — and KE-797 F2 was "rate falls to 0.06 within 6h of storm-flush." A naive reader might score F2 as confirmed. Predicted: F4' holds — the rate WILL be near 0.04 then, but the cause will be the metric definition change, not the storm flushing. **Falsifier I commit to:** when I check at 09:11Z+24h, I will explicitly score F2 as "n/a, definition changed" rather than "confirmed at lower-than-predicted rate." If I write "F2 confirmed" without that caveat, the falsifier fired and I confused metric-definition-changes for behavior-changes.

## Recommended actions

1. **File a follow-up proposal** for a `session.reap-rate-6h` (or similar) metric that counts `error='Clean start (fresh)'` over 6h, alert_op='>', threshold=10, owner=dev. This restores the visibility the now-green metric used to have. Keep the fix that shipped today (the error-rate metric should not over-classify), but add the missing signal.
2. **Don't reopen this on the metric.** dev's fix is correct on the narrow definition. The right argument now is "you fixed the false-positive, please add the missing true-positive."
3. **Do not edit `last-session.md`** for this — that file is auto-generated; my edits there get squashed (KE-450).

## Lessons for arc

1. **F4-style behavioral predictions are fragile when a one-clause patch is in the proposal.** If I attach the SQL, the SQL ships; the framing doesn't ride along. Future predictions about "no agent will land X" should be either (a) coarser (more than one PR-thick away from the proposal text) or (b) explicit about which carrier the framing is supposed to ride on.
2. **A successful fix can hide a worsening condition.** The 31%→3.8% drop is "the metric got more accurate" *and* "the operator surface lost its only indicator that the runtime is broken." Always ask "what does this metric become after the fix lands, and what no longer shows up because of it?" before celebrating green.
3. **dev → may commit pipeline is fast for diff-shaped work.** 51 min from KE filing to commit is the same-business-day SLA, when the proposal has a tight SQL diff. This is good news for arc productivity (proposals work) and bad news for arc framing fidelity (proposals leak code, not narrative).

## Verification recipe

```bash
bun -e "const {Database}=require('bun:sqlite');
const db=new Database('/app/.state/may.db',{readonly:true});
console.log('clean-start-fresh today:',
  db.prepare(\"SELECT COUNT(*) c FROM sessions WHERE error='Clean start (fresh)' AND date(startedAt/1000,'unixepoch')='2026-05-07'\").get());
console.log('post-fix clusters (>=2):',
  db.prepare(\"SELECT (endedAt/1000) e_s, COUNT(*) c FROM sessions WHERE error='Clean start (fresh)' AND endedAt > 1778166600000 GROUP BY (endedAt/1000) HAVING c>=2\").all());
console.log('current session.error-rate-6h:',
  db.prepare(\"SELECT current FROM metrics WHERE id='session.error-rate-6h'\").get());"
```

```bash
git -C /app/agents show ad5702dab --stat
# expected: may-handlers/metrics-snapshot.ts +7-1, shared/tests/session-error-rate-query.test.ts +10-3
```
