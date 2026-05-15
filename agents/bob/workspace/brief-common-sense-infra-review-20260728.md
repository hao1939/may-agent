# Common Sense Infra Review — 2026-07-28

## Summary

common-sense.md unchanged. Three infra items remain from prior reviews. Coach's behavioral tracker (updated Apr 26) shows all "How to Think" items passing — no new infra help requests from coach. The highest priority unbuilt mechanism remains the evaluator pipeline (IT-87).

## Highest Priority Unbuilt: IT-87 Evaluator Pipeline (P0)

**Status: Still broken.** Last real evaluation file: Mar 24. One `cold-start-fix-eval.md` appeared Apr 20 but no sustained recovery. The `.state/evaluations/` directory has had no new session evaluations in 4+ months.

**Why it matters:** Coach cannot close the measure→intervene loop. All behavioral verification in `common-sense-tracker.md` is done manually by coach via session sampling. Without the evaluator pipeline, coach's interventions are open-loop — no automated signal on whether they work.

**Owner:** May / tech-lead (infra)
**Action needed:** Restore automated evaluation pipeline. This is the single highest-leverage infra fix for the coaching system.

## Second Priority: C12.1 Checker False Positives (P0)

**Status: Still unfixed.** Confirmed in `agents/may/handlers/convention-check.ts`:

```ts
const BASH_ORIENTATION = /^(grep|rg|find|ls|cat|head|tail|git|bun)\b/;
```

Still missing `echo`. Identified April 18 — now 3+ months unfixed. Two-line fix unchanged from prior briefs.

## Third Priority: C1.3 Write-Readback Nudge (P1)

Advisory nudge after `write()` calls. Design unchanged. Low-risk, would address chronic ~15% compliance.

## Coach Behavioral Items — Infra Help Needed?

Reviewed coach's `common-sense-tracker.md` (updated Apr 26):
- All 8 verified behavioral items (**Evidence First**, **One Thing at a Time**, **Context First**, **Simple First**, **Convention over Configuration**, **Follow the Breadcrumbs**, **Ask Questions When Unsure**) show ✅ PASS.
- Coach is doing manual verification via session sampling — labor-intensive but working.
- **No new infra help requests from coach.** The IT-86/90 structural enforcement items from April remain unaddressed but coach hasn't re-escalated.

**Implicit infra need:** Coach's manual verification would be automated if IT-87 (evaluator pipeline) were restored. This reinforces IT-87 as the top priority.

## Ownership Updates

None needed. common-sense.md is human-controlled and unchanged. No items were recently built that need ownership transfer.

## Actions (unchanged from prior reviews)

- [ ] **P0**: IT-87 evaluator pipeline restore → tech-lead
- [ ] **P0**: C12.1 two-line fix (add `echo`, extend prefix strip for `;`) → tech-lead
- [ ] **P1**: C1.3 write-readback nudge → tech-lead
- [ ] **P2**: IT-86/90 structural enforcement design → bob (self-assign, deferred)
