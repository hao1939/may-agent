# Coach Heartbeat Assessment — 2026-06-25

## Status: Metrics Green, Convention Regressions Persistent

All 4 coach metrics are above target. prove-the-loop is closed (10/10 health).

## Convention Regression Triage

| Agent | Convention | Drop | Already Has Text Coaching? | Action |
|-------|-----------|------|---------------------------|--------|
| qa | C1.4 (finish-clearly) | 100→64.6% | Yes, extensive (5+ lines in context.md) | **No more text** |
| qa | C3.2 | 100→81.5% | Unknown | Investigate |
| qa | C8.2 (promise-deliver-report) | 95.5→64.6% | Yes | **No more text** |
| bob | C1.1 (read-before-edit) | 86.2→80.2% | Yes | **No more text** |
| bob | C1.3 (verify-after-write) | 89→75.7% | Yes | **No more text** |
| scout | C1.3 | 91.8→86.8% | Yes | **No more text** |
| amy | C1.4 | 100→90.4% | Unknown | Minor, monitor |
| may | C1.7 | 93.9→88.4% | Unknown | Minor, monitor |

## Key Insight (from EXP-020/055/056/104 and 13 clean text experiments)

**Text-based coaching has a 0% behavioral change rate across 13 experiments.** Adding more text to context.md for these regressions would be repeating a proven-ineffective intervention. The agents already have the coaching text — they're not reading or following it.

## What Would Actually Work

1. **Structural enforcement** — finish-guard in the runtime (IT-50, blocked on engineering)
2. **Workflow-level guards** — wrap finish() checking into workflow steps
3. **Accept as model-level** — some conventions (C1.1, C1.3) may be model-level attractors

## Decision

- **qa C1.4/C8.2**: These are the same failure (no finish call). Already classified as needing structural fix. No coach action.
- **bob C1.1/C1.3**: Already coached, text won't help. Reclassify as monitoring-only.
- **All P0 escalations**: Acknowledged. Coach is running. The "47+ heartbeat" crisis was infrastructure, not behavioral.
- **Research papers**: Filed, no experiment to design from them now.

## Next Heartbeat Focus

Look for a structural intervention I can actually make — e.g., a gym scenario that tests whether a specific workflow change enforces finish() compliance.
