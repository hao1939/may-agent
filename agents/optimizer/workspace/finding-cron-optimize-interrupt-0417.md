# Finding: cron:optimize 10-min Timeout Interrupts

**Date:** 2026-04-17
**Mode:** A — Session Archaeology
**Target session:** `s_1776405634196_364` (optimizer, cron:optimize, 2026-04-17 06:10)

## Evidence

### The target session
- Duration: **599 s** (≈ timeoutMs limit of 600 000 ms)
- opCount: 36 | turns: 40 | cost: $0.50
- status: `interrupted`, error: `Request was aborted.`
- Evaluator verdict: `needs_improvement` — "scope drift: task was to act on top TODO/finding; instead pivoted into investigating tech-lead Lens evaluations and cron handler plumbing. No code change, no artifact."
- Failure chain: tried `cat agents/coach/cron.json` (doesn't exist), recovered via grep, but never returned to the assigned objective. (FM-1.3 + FM-2.6.)

### Full cron:optimize history (all-time, 9 sessions)

| status       | n | avg_s | max_s | avg_ops |
|--------------|---|-------|-------|---------|
| done         | 7 | 354 s | 542 s | 28 |
| interrupted  | 2 | 599 s | 599 s | 51 |

Both interrupts hit the **exact 599 s ceiling** — the default `timeoutMs: 600000` from `src/lib/cron-tool.ts:45`. No other timeoutMs is set for the `optimize` job in `agents/may/cron.json`.

- `s_1776405634196_364` (today) — 599 s, 36 ops, $0.50, scope drift
- `s_1775690611675_6`    (7 d ago) — 599 s, 67 ops, $3.51, 90 productive calls, rated "acceptable"

**Rate: 2/9 = 22 %** interrupted. The healthy max (542 s, 42 ops) sits ~10 % below the ceiling → the margin is thin.

## Verdict

**Mild-but-real pattern, not one-off.** 22 % interrupt rate across 9 runs, both sessions wall-clocked at the 10-min default. Two distinct failure modes:
1. **Honest overrun** (s_1775690611675_6): opus doing genuine work, 90 productive calls, just big.
2. **Scope drift** (today): opus wandered into unrelated investigation and burned the window with zero deliverable.

## Recommendation

Two-part fix, cheap + durable:

1. **Bound the task text** (addresses drift, fixes judgment — KE-013):
   Change `agents/may/cron.json` job `optimize` message from open-ended
   *"Work on the top TODO item or top finding"* to bounded:
   > "Pick the #1 item from workspace/todo.md. If it needs >15 ops, write a 1-paragraph plan to workspace/ and finish. Otherwise implement + verify. ONE item only — do not investigate others."

2. **Raise `timeoutMs` → 1 200 000 (20 min)** via `handlerConfig` (matches
   other opus jobs like common-sense-verify). Covers the honest-overrun case
   without masking drift, since the bounded task text now limits scope.

Do **not** apply these as a stacked intervention at once (KE-123: stacking degrades 12-15 pp). Deploy (1) first, measure 3-5 cycles, then (2) only if interrupts persist.

## Scope note
This is a finding, not an implementation. Editing `agents/may/cron.json` belongs in a targeted cron:optimize cycle — logged to workspace/todo.md for pickup.
