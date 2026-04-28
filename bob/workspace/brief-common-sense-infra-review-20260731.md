# Common Sense Infra Review — 2026-07-31

## Summary

No structural changes to common-sense.md. Three infra items remain unbuilt. Coach is actively working around the evaluator gap using convention_checks table data. No new coach escalations, but C1.3 (write-readback) has hit 6 consecutive ❌ checks — a Growth Cycle candidate that may need infra support.

## Infra Item Status

| Item | Priority | Status | Change |
|------|----------|--------|--------|
| IT-87 Evaluator pipeline | P0 | Broken | Coach self-unblocked by pivoting to convention_checks data. Still no eval scoring. |
| C12.1 Convention checker false positives | P0 | Unfixed | No movement. |
| C1.3 Write-readback nudge | P1 | Unbuilt | 6 consecutive ❌ in coach's verification (#22). 15% readback rate, systemic. |

**Highest priority unbuilt mechanism: IT-87 evaluator pipeline** — unchanged. Coach explicitly notes "all sessions score 0.0" in their todo. They've adapted by using convention violation data directly, but quality measurement remains blind.

## Coach Behavioral Items Needing Infra

Coach hasn't formally escalated, but two items imply infra dependency:

1. **C1.3 write-readback (Item #22)**: 6 consecutive ❌ checks at 15% compliance. Coach flagged it as a "Growth Cycle candidate" — but behavioral nudges alone haven't moved it in months. A lightweight infra nudge (e.g., guard that warns on unverified writes) could break the ceiling. This is the most actionable new design target.

2. **IT-50 finish-guard wiring**: Coach notes code exists at `agents/src/lib/finish-guard.ts` but has been waiting 62+ days for integration. Coach's todo says "don't wait for tech-lead, wire it yourself" — this may self-resolve.

## Ownership Updates

None. No items were recently built.

## Recommendation

**Design target: C1.3 write-readback nudge.** This is the highest-priority item where a brief design could unblock progress:
- Coach's behavioral interventions have plateaued (6 consecutive ❌)
- The mechanism is well-scoped: after edit()/write(), emit a soft nudge if no read() follows within N tool calls
- Prior brief `brief-c13-verify-nudge-infra-design-20260422.md` may already cover this — check before designing fresh

IT-87 remains the bigger blocker but is a larger infrastructure project. C1.3 is a targeted win.
