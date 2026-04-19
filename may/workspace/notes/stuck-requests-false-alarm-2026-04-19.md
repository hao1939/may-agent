# Stuck-requests metric false alarm — 2026-04-19

The injected metric reports:
> [fast] **Stuck requests**: 0 count → target: 0 ⚠️ BELOW THRESHOLD

Value 0 *meets* the target 0 (lower is better). The ⚠️ flag is a comparator bug —
"below threshold" should not fire when value equals target. No action needed on the
underlying system; the alarm is spurious.

Action taken: cancelled stuck coach session s_1776563469482_804 (EXP-186, idle 39min).
Filed: notify optimizer to fix the threshold comparator on the stuck-requests metric.
