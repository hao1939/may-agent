# Heartbeat Correction Propagation — Measurement

**Status:** IT-30 resolved  
**Window:** Hao's correction at 2026-04-17T19:04:03Z ("why other agents not working? found nothing to do?") — measured ±6h around that timestamp.  
**Source:** `.state/may.db`, `sessions` table, `kind='job' AND task LIKE '[heartbeat]%' AND status='done'`.

## Hypothesis (from 2026-04-18-00 reflection §3/IT-30)

> "Tech-lead's 19:00Z short HB was corrected by a later heartbeat reading human-inputs. Is this a stable pattern or coincidence?"

Prediction: short-HB rate should DROP in the 6h post-correction window across multiple agents (coach, tech-lead, scout, qa), indicating that verbal corrections propagate without code change.

## Data

| agent | pre_n | pre_short_pct | pre_med_s | post_n | post_short_pct | post_med_s | direction |
|---|---:|---:|---:|---:|---:|---:|---|
| coach     | 12 | 42%  | 193s | 12 | **67%** | 112s | ❌ worse |
| tech-lead | 12 |  8%  | 461s | 12 |   8%   | 295s | ≈ flat (med ↓) |
| scout     | 12 | 58%  | 118s | 12 | **100%**|  34s | ❌ worse |
| qa        | 12 |100%  |  65s | 12 |  92%   |  59s | ≈ flat (floor) |

Short-HB = duration < 120s. Median in seconds. Both windows = 12 heartbeats × 6h = ~30min cadence.

## Finding

**Hypothesis rejected.** A verbal correction directed at one agent (may) did NOT propagate to reduce short-heartbeats across coach/scout/qa. Three of four agents got WORSE or stayed at floor:

- **coach**: 42% → 67% short (worse). Median duration dropped 193s → 112s.
- **scout**: 58% → 100% short (fully regressed). Median 118s → 34s.
- **qa**: already at 100% floor; no movement.
- **tech-lead**: flat at 8% short but median duration dropped 461s → 295s (ops-shrinkage without short-exit cliff).

**Single counter-case:** tech-lead's 19:00Z 78s no-op was self-corrected in the immediately following heartbeat (247s) — but this is a within-agent recovery in the same agent that was observed reading human-inputs, not propagation.

## Interpretation

The reflection's framing "signal propagated without explicit intervention" was **observation bias on a single agent** (tech-lead), generalized without cross-agent data. The db shows:

1. Agents do not reliably read other agents' human-input channels.
2. Short-HB behavior is driven by the agent's OWN `heartbeat.md` Step 4, not by verbal corrections to peers.
3. IT-21/IT-26 (rewrite Step 4 to enforce exit rubric) was the correct intervention; the reflection's hope that verbal signal would substitute for a code fix was unsupported.

## Implication for future interventions

**Behavioral corrections propagate via file edits, not via human-input transcripts.** When a heartbeat anti-pattern is observed in agent A, patch agent A's heartbeat.md directly — do not assume a message to agent B will carry over.

This matches KE-007 (workflow enforcement is the only reliable behavioral intervention) and KE-021 (process skills > knowledge skills).

## Limitations

- n=12 per cell; one correction event; no control (a different day's natural variation).
- Coach's post-correction window OVERLAPS with the reflection session that wrote IT-26 (00:08Z), so the coach 67% includes heartbeats that already had the new Step 4 but hadn't been exercised by later heartbeat runs. Re-measure post 01:00Z once the new Step 4 has been live ≥6h.
- tech-lead's median-duration drop (461→295s) without a short-HB spike is notable but ambiguous — could be reduced workload or reduced effort.

## Next

- At ~07:00Z (post 6h of live IT-26 Step 4), re-run this query for coach only; expect short-HB pct to drop if IT-26 is effective. Target: <30%. Record result as a follow-up note (not a new IT).
