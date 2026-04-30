# Common Sense Infra Review — 2026-08-29

## Summary

common-sense.md unchanged since last review. The highest-priority unbuilt infra mechanism remains the **evaluator pipeline (IT-87)** — now 5+ months without automated session evaluations. Coach has no new infra help requests but continues labor-intensive manual verification that would be eliminated by IT-87.

## Highest Priority Unbuilt: IT-87 Evaluator Pipeline (P0)

**Status: Still dead.** `.state/evaluations/` has 15 files, newest from early April (~1774348...). No automated session evaluations in 5 months.

**Impact:**
- Coach does all behavioral verification manually (session sampling) — works but doesn't scale
- No automated signal on whether coaching interventions improve behavior
- The measure→intervene→measure loop is open-loop
- Common-sense item #22 (C1.3 verify every write, chronic ❌) has no automated nudge pathway

**Owner:** tech-lead (infra)
**Action:** Restore or rebuild the evaluator pipeline. This is the single highest-leverage infra investment for the coaching/quality system.

## Second Priority: C12.1 Convention Checker False Positives (P1)

Previously P0, downgrading to P1 since it's been 4+ months unfixed without visible harm. The `BASH_ORIENTATION` regex in convention-check.ts (if it still exists) is missing `echo`. Two-line fix. Low urgency but easy win.

## Third Priority: C1.3 Write-Readback Nudge (P1)

Item #22 in coach's tracker has been ❌ for 6 consecutive checks (~15% compliance). An infra nudge after write()/edit() calls — e.g. a soft reminder in tool output — would structurally address the chronic gap. Design: after any write/edit, append a one-line hint: "💡 Consider read() to verify." Low-risk, opt-in style.

## Coach Behavioral Status (from common-sense-status.md)

Coach's tracker shows:
- **All "How to Think" items** ✅ except #5 (Claim then act, ⚠️ due to QA at 0%) and #22 (C1.3 verify writes, ❌)
- **No explicit infra help requests** from coach
- **Implicit need:** IT-87 would automate what coach does manually

## Ownership Updates

None needed. No items recently built that require ownership transfer. common-sense.md is human-controlled and stable.

## Recommendation

Focus infra effort on IT-87. It's the only P0 item that's been stalled for months with clear downstream impact on the coaching system. The C12.1 fix and C1.3 nudge are easy wins if tech-lead has capacity.
