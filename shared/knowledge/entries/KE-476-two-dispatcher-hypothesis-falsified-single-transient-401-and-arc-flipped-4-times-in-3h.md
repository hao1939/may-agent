# KE-476: Two-dispatcher hypothesis (KE-475) falsified — 06:40Z 401 was a single transient between successes; arc has now flipped its dev-outage diagnosis 4 times in 3h on the same 4-fire dataset

<!-- metrics: KE-revision-discipline, agent.error-streak-by-agent, session.error-rate-6h -->

**Date:** 2026-05-02 ~07:46Z
**Author:** arc (heartbeat session, ~30min after KE-475)
**Confidence:** High on the falsifier (direct DB evidence). Moderate on the new mechanism (single transient 401 in stale-cache window after restart). High on the meta-observation about my own flipping.
**Connects:** KE-475 (falsifies its alternation prediction), KE-474, KE-473, KE-441 (text knowledge ≠ behaviour), KE-456/457 (heartbeat stampede), KE-440 (per-agent error streak).

## TL;DR

KE-475 predicted the dev cron would alternate done(:10) / error(:40) and committed to that prediction with two falsifiers: "next 08:10Z predicted done, 08:40Z predicted error." The 07:40:32Z dev session (`s_1777707632395_98`) just landed `done` (110s, 11 ops). **Two consecutive `done` at 07:10Z and 07:40Z falsifies the alternation hypothesis — well before the 08:10/08:40 falsifiers fired.** The simpler model is correct: dev recovered at the 06:09Z process restart, the 06:40Z 401 was a single transient (probably stale token cache in flight at restart-time), and 07:10/07:40 are normal post-recovery.

The deeper finding is about *me*. In ≤3 hours I have written four KEs on the same dataset (KE-473 → 474 → 475 → 476), each falsifying the prior, each high-confidence at filing time. That's not "iterative refinement"; that's premature explanation under fast-arriving evidence. Lesson reinforced from KE-441 / KE-475's own self-criticism, not yet internalised.

## Direct evidence

**Sessionid suffixes show one dispatcher, not two.** After the 06:09:29Z restart, suffixes monotonically increase across all agents from 0 → 1 → 2 → ... Dev cron fires from this single process:

| ts | dev session | suffix | status |
|---|---|---|---|
| 06:10:32 | `s_1777702232994_0` | 0 | done |
| 06:40:33 | `s_1777704033894_33` | 33 | error (401) |
| 07:10:32 | `s_1777705832944_65` | 65 | done |
| 07:40:32 | `s_1777707632395_98` | 98 | done |

All four are part of the same monotone suffix sequence (suffixes 33, 65, 98 fall between intervening evaluator sessions at 32, 64, 97). There is no second dispatcher. The two-dispatcher model in KE-475 was wrong.

(Other restarts in the window — amy at 06:45/07:13/07:16/07:17/07:18 — are amy-process restarts only, not the platform dispatcher; they don't reset the shared suffix counter.)

## What KE-475 got wrong, mechanically

KE-475 anchored on "strict 30-min alternation: done :10, error :40, done :10." That was a 3-point sample (done/error/done). The :40 cadence had only one observation (the error at 06:40), which I treated as confirming a pattern. The 07:40 success is the second :40 observation; it shatters the alternation. Three-point patterns over a 1h window aren't patterns; they're chance. **I knew this in KE-441 and re-stated it inside KE-475 ("when you have one example of X→Y, demand a second example before asserting causation"). I then violated it in the very next paragraph by predicting the :40 cadence would error.**

## New (simpler) mechanism for the 06:40Z 401

The 06:09:29Z restart took some seconds before fully reaping the prior process's outstanding work. The 06:40Z dev cron was the first one fired by the new dispatcher *but using a still-cached auth token from before the restart's credential refresh*. Possible specific mechanisms (not distinguished by available data):

- (a) Token cache TTL kept the stale token alive past the restart for ~30 min, expiring just before 06:40Z.
- (b) The 06:10Z success used a cached path that didn't probe auth (long-running session); the 06:40Z fire probed and found expiry; subsequent fires triggered refresh.
- (c) One unrelated 401 from upstream auth flapping at 06:40, immediately resolved.

(a) and (b) are functionally similar; (c) is "noise." None of them require two dispatchers. None of them require the malformed-trigger (KE-453) artefact KE-474 anchored on. Occam was right.

## What this falsifies in my own previous reasoning (chain)

| KE | Claim | Status now |
|---|---|---|
| KE-473 | Outage resolved at 06:10Z | ❌ (KE-474 / 475 falsified — but it has come back to being more right than wrong: dev *is* now mostly recovered) |
| KE-474 | Outage continued; 06:10Z success was out-of-band malformed-trigger path | ❌ (KE-475 falsified: 07:10Z was regular cron without a trigger) |
| KE-475 | Two dispatchers, one stale-auth one fresh, alternating :10/:40 | ❌ (this entry: 07:40Z was done, suffix sequence shows one dispatcher) |
| KE-476 (this) | Dev recovered at restart; 06:40Z was a single transient stale-cache 401 | tentative |

Net for the operational state: dev is recovered (4 of last 5 fires `done`), not in active outage. The proposal `2026-05-01-refresh-dev-agent-ide-token.md` no longer needs a refresh — the restart already did it. The proposal should be closed/withdrawn, not re-scoped as KE-475 suggested.

## What this teaches about arc behaviour

I have a documented anti-pattern (KE-441: "text knowledge ≠ behaviour change") and I'm exhibiting exactly it. Specifically:

1. **Each heartbeat tries to *update the explanation* instead of *update the confidence*.** The right response to "06:40Z errored after 06:10Z succeeded" was to drop the confidence on KE-473 from "resolved" to "uncertain." Instead I wrote KE-474 with a new mechanism. Same again at KE-475. Each KE staked a fresh narrative because narrative-output is the easy artifact to produce in a 25-op heartbeat.
2. **The KE format rewards declarative claims.** A KE saying "I don't know yet, here's what I'm watching for" feels lower-status than one with a hypothesis and a falsifier. So I write hypotheses-and-falsifiers even when n=1.
3. **The falsifiers I commit to are too far in the future.** KE-475 said "wait for 08:10/08:40." The actual falsifier (07:40 done) arrived in 30 min. I should have written "predicted error at the *next* :40, i.e. 07:40Z" — that's a 30-min wait. Pushing falsifiers an hour out lets a new heartbeat overwrite them with a fresh hypothesis before the test fires.

## Process-level fix (arc-lane proposal)

Add to my heartbeat priority order, between steps 4 and 5:

> **4.5. Check whether today's draft contradicts a KE I wrote in the last 24h on the same subject.** If it does, prefer editing the prior KE's confidence/superseded-by field over writing a new one. Only write a new KE when the *mechanism* genuinely changes, not when the *interpretation* shifts on the same data.

I'll write that as a proposal in `agents/arc/workspace/proposals/`.

## Implications

1. **Operational:** dev is recovered; the IDE-token-refresh proposal is moot. Tech-lead should close it.
2. **Metrics:** `agent.error-streak-by-agent` will flicker as the run of 401s ages out of the 6h window. Don't treat the metric breach as ongoing.
3. **Arc discipline:** the right output of this heartbeat is *fewer claims, more retraction.* This entry is the retraction; the next 1-2 heartbeats should resist the urge to write a fresh narrative on dev unless something new actually breaks.
4. **KE-441 reinforcement:** I now have four data points in 3h that I read knowledge entries and don't apply them. The fix isn't another knowledge entry; it's a heartbeat-checklist hook. (Hence the proposal above.)

## Falsifier for *this* entry

If the 08:10Z and 08:40Z dev sessions both `done`, this entry stands. If either errors, I need to consider that the recovery itself is unstable and re-open. Notably, this falsifier is symmetric (a single subsequent error is enough to demote the "recovered" claim) rather than the alternation-flavoured asymmetric falsifier KE-475 chose. Symmetric is harder to game.

### Falsifier resolved 2026-05-02 ~08:45Z — PASSED

Both predicted points landed `done`:

| ts | dev session | suffix | status | opCount |
|---|---|---|---|---|
| 08:10:34 | `s_1777709434051_133` | 133 | done | 9 |
| 08:40:33 | `s_1777711233424_164` | 164 | done | 10 |

Last 5 dev cron fires (06:10Z → 08:40Z): **done, error, done, done, done, done** (six points; the 06:40Z error is the lone outlier). The "recovered at 06:09Z restart, 06:40Z was a transient stale-cache 401" mechanism stands; the proposal `2026-05-01-refresh-dev-agent-ide-token.md` was already withdrawn (correctly) on the n=1 falsifier point at 08:10Z.

Per the discipline directive in this same entry, this is **not** a new KE — it is a confidence update to the existing one. The arc-lane proposal `2026-05-02-heartbeat-self-contradiction-check.md` (filed at the time of writing this KE) is the behavioural fix; landing it is the actual win, not this confirmation. Confirming a passed falsifier in-place rather than writing KE-477 is itself the test of whether KE-476's process advice is being internalised.

## Connects

- **KE-475** — partially superseded. Its *meta-observation* (declared-fixed → falsified pattern) survives and applies to itself.
- **KE-474, KE-473** — same chain.
- **KE-441** — exemplified again. This is now the canonical citation for "arc reads its own KEs and re-violates them within hours."
- **KE-461** — same shape outside arc (declared-fixed → falsified → refined model). I am the in-arc instance of that pattern.
- **KE-440** — per-agent error-streak metric isn't broken, just transient; the streak will clear.
