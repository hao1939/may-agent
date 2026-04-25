# Common Sense Infra Review — 2026-06-27

## Summary

common-sense.md unchanged since last review. Two infra items from prior reviews remain unbuilt (C12.1 patch, C1.3 nudge). Coach's latest reflection (Apr 25) flags IT-87 (evaluator pipeline, 63+ days broken) as a new P0 — higher priority than both.

## Highest Priority Unbuilt Mechanism: IT-87 Evaluator Pipeline (P0)

Coach's Apr-25 reflection calls this "the single most damaging infrastructure failure." The evaluator pipeline has been broken since March 24 — no new files in `.state/evaluations/` for 90+ days. Without it, coach can't measure whether behavioral interventions work, making the entire coaching loop open-loop.

**Owner:** May / tech-lead (infra)
**Action:** Restore evaluator pipeline. This blocks all downstream measurement.

## Second Priority: C12.1 Checker False Positives (P0, 2+ months)

Confirmed still present. In `/app/agents/may/handlers/convention-check.ts` line 643:

```ts
const BASH_ORIENTATION = /^(grep|rg|find|ls|cat|head|tail|git|bun)\b/;
```

Missing `echo`. The prefix-strip regex (line 652) handles `&&` but not `;`. Two-line fix:
1. Add `echo` to regex
2. Extend prefix strip to handle `;`

**Status:** Identified April 18. Still unfixed.

## Third Priority: C1.3 Write-Readback Nudge (P1)

C1.3 compliance chronically ~15%. Advisory reminder after `write()` calls would be low-risk, high-impact. Design unchanged from June 25 brief.

## Coach-Flagged Items Needing Infra

From coach reflection 2026-04-25:
1. **IT-87 evaluator pipeline** — explicitly called P0 by coach. 63+ days broken. Coach cannot close the measure→intervene loop without it.
2. **IT-86/90 structural enforcement** — coach notes "NOT STARTED". Bob (me) hasn't designed enforcement mechanisms for behavioral rules that coaching alone can't fix. This is a design gap I should address.

Coach's feedback on common-sense.md (from Apr 17) raised three doc-level items:
- "No production edit without gym A/B first" — behavioral, not infra
- Guard override pathway undocumented — infra gap but low priority
- Time-based pause triggers conflict with "use gym" rule — doc clarification needed

## Ownership Updates

None needed. common-sense.md is human-controlled and unchanged.

## Actions

- [ ] **P0**: Dispatch IT-87 evaluator pipeline restore to tech-lead
- [ ] **P0**: Re-dispatch C12.1 two-line fix to tech-lead
- [ ] **P1**: Dispatch C1.3 write-readback nudge to tech-lead
- [ ] **P2**: Design IT-86/90 structural enforcement brief (bob self-assign)
