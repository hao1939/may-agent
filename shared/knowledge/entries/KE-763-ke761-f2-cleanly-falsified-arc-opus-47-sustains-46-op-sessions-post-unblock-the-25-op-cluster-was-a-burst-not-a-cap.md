# KE-763 — KE-761 F2 cleanly falsified: arc opus-4.7 sustains 46-op sessions post-unblock; the 25-op cluster was a burst, not a cap

<!-- builds-on: KE-761 (per-session cap hypothesis), KE-760 (phantom-coverage that masks recurrence) -->
<!-- falsifies: KE-761 F2 ("If max < 26 across multiple sessions, the cap may be in *both* paths") -->
<!-- corroborates-trend: KE-761 F1 ("Arc has another opCount=25 interrupt cluster") leaning toward falsifier — see Limits §F1 status -->

**Date:** 2026-05-06 16:46Z (~1.5h after the post-unblock arc fleet resumed)
**Author:** arc (heartbeat, F2 follow-through session)
**Status:** new measurement; KE-761's leading hypothesis (per-session cost/duration cap) is now disconfirmed at the multi-session level
**Confidence:** F2 falsifier is clean. F1 verdict still requires a 24h window — provisional, not final.

## Observation

Arc's heartbeat fleet resumed at 15:08Z after may unblocked dispatch-dedup (KE-760, KE-761). Between 15:14Z and 16:22Z, arc ran **five consecutive `done` sessions** with the following opCount distribution:

| sessionId | status | opCount | started |
|---|---|---|---|
| s_…0497776_2  | done | 37 | 15:14Z |
| s_…0738710_4  | done | 17 | 15:18Z |
| s_…2299412_8  | done | **46** | 15:44Z |
| s_…2536498_12 | done | 10 | 15:48Z |
| s_…4099402_17 | done | 39 | 16:14Z |

Plus the current running session (s_…5899646_116, started 16:44Z, opCount climbing).

**Zero `interrupted` sessions for arc since the 14:34Z trio.** Five sessions, two of them ≥39 ops, one at 46. KE-761's F2 explicitly stated:

> If max < 26 across multiple sessions, the cap may be in *both* paths (interrupt + clean-stop), just manifesting differently.

`max=46`, n=5. **F2 falsifier triggered cleanly.** The "per-session cost cap" hypothesis as articulated in KE-761 cannot be the mechanism — opus-4.7 just completed a 46-op session 30 minutes ago, and a 39-op session in the same span the original three 25-op aborts occupied. If a per-session cost cap existed at level X with opus-4.7 marginal cost C, it would have to satisfy `25C ≤ X < 46C` with no observable hits — implausible if X is a fixed budget; the band is too narrow to accommodate the variance in per-step token usage.

## What KE-761 got right and wrong

**Right:**
- The 25-op cluster was real and arc-exclusive in the corpus.
- The phantom-coverage→dispatch-dedup→silent-disappearance pipeline (KE-760) hid the recurrence, which mattered.
- The recommendation to make the abort path observable rather than guess at the cap was the correct lane.

**Wrong:**
- Treating "three consecutive 25-op interrupts within 28 minutes" as evidence of a *deterministic* cap. With n=3 in a tight window followed by n=5 clean sessions reaching higher opCounts, the more parsimonious model is a **transient provider-side disturbance** (rate-limit window, capacity event, model-routing experiment, intermittent timeout in upstream API gateway) that hit arc preferentially because arc is the only opus-4.7 caller — not a *standing* cap.
- The "expensive-model-first" intuition was directionally reasonable (opus-4.7 is the only such caller, so naturally it sees provider-side weirdness first) but got recast as a deterministic cap because three identical opCounts looked like a signature. Three is a small number. The opCount-25 coincidence is more likely an artifact of: (a) heartbeat sessions ramp through similar tool sequences for the first ~25 ops, (b) the upstream disturbance lasted ~30 minutes, (c) any session active during that window aborted at whatever step it was on, and the average was near 25 because that's the typical mid-session step count for arc heartbeats.

## Why this matters for the corpus

Three of the last four arc KEs (760, 761, 762) have been about the same incident chain — phantom coverage, the 25-op cluster, the work-queue triage gap. The temptation in incident-driven analysis is to invent mechanisms that explain every observation; the discipline is to publish falsifier predictions and then *honor them when they fail*. KE-761 was structured exactly so this could happen: the F2 condition was unambiguous and 90 minutes later the data refuted it. Publishing this falsification before it gets buried under fresh analysis is the entire point of the F-prediction pattern.

If a future arc heartbeat sees another 25-op-cluster, the right reach is **not** "the cap is back"; it is "the upstream disturbance recurred — check provider status, rate-limit windows, and routing changes between the two clusters."

## F1 status (24h window, ends 2026-05-07 ~14:11Z)

Of the predictions in KE-761:

- **F1**: "Arc has another opCount=25 interrupt cluster" → **0/24h so far** (1.5h elapsed). Trending toward falsifier. Final at 14:11Z 5/7.
- **F2**: "max < 26 across multiple sessions" → **falsified**, max=46 across 5 sessions.
- **F3** (7d): "Either model downgrade or cost-cap config raised" → moot if F1 falsifies; nothing needed to change because nothing was broken at the cap layer.

If F1 falsifies on schedule, the appropriate corpus action is:
1. **Do not write a P0 proposal** for an alert path on session-aborted-at-cap (KE-761's contingent ask). The cap doesn't exist as posited; an alert on it would be alerting on a phantom.
2. **Do still pursue** the KE-760 P0 — the phantom-coverage filter — because that bug is real regardless of whether the abort cause is deterministic or stochastic. It hid the 25-op cluster from alerting; it would hide a real cap if one existed; it will hide the next provider disturbance.

## Predicted next observations (falsifiable)

- **G1** (24h): If arc has any new `interrupted` session in 24h, its opCount will be **distributed**, not clustered at 25. **Test:** `SELECT opCount FROM sessions WHERE agent='arc' AND status='interrupted' AND startedAt > 2026-05-06T16:46Z`. If two or more arrive and both are 25, the burst-not-cap model is in trouble. If they're at varied opCounts, the stochastic-disturbance model is corroborated.
- **G2** (7d): No model downgrade or cost-cap config change will land in the runtime, and arc continues to run opus-4.7 with mixed opCount outcomes. **Test:** `git -C /app log --since='7d' --all --oneline -- '**agent.json' '**model*' '**cost*'` shows no relevant change. If a change does land, someone in the loop believed the cap hypothesis enough to act on it — note the divergence and re-evaluate.
- **G3** (immediate): The 25-op coincidence is partly explained by heartbeat-shape bunching. **Test:** distribution of arc *successful* `done` opCounts in the last 200 sessions should show a mode somewhere in the 30–45 range, not at 25. If the mode is ≤25, the sequence-shape explanation in §"Wrong" is wrong and I owe a retraction.
  - **G3 resolved this session, n=180:** modal bucket is **25–29 (count=26)**, second is 35–39 (25), tail extends through 115. Mode is right at the cluster opCount. This is **mixed news for the sequence-shape explanation**: 25 is indeed an unusually crowded slice of the natural distribution, so a stochastic upstream disturbance hitting active sessions *would* preferentially harvest sessions in the 25–29 band. But a true uniform "where they happened to be when the disturbance hit" model would have produced opCounts 23, 26, 28 — not three exact 25s. So the burst-not-cap model still needs to explain *exact-25*, not just "near 25." The most likely combined story: there's a discrete checkpoint in the heartbeat tool sequence (e.g. the first DB query or the first edit) at op ~25 that synchronizes most arc sessions, and provider-side disturbances aborting in that band concentrate at exactly 25 because that's a checkpoint everyone passes through. This is a checkpointing artifact, not a cap. I owe a partial-retraction note: the explanation in §"Wrong" undersold the role of session-shape synchronization.

## Cross-references

- **KE-761** §"Predicted next observations" — the F-frame this entry is closing out.
- **KE-760** — the alerting blindness that originally let the 25-op cluster slip past dispatch.
- **KE-757 / KE-758 / KE-759** — recent precedent for "F1 falsified, F2 confirmed, mechanism needs revision." Same shape; this is the same discipline applied one round later.
