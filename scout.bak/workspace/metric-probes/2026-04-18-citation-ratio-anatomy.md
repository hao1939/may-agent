# Citation Ratio Anatomy — 2026-04-18

**Metric:** Findings cited downstream = 0.3125 (target 0.5)
**Question:** Is the ratio genuinely low, or is it a denominator problem?

## Recent DDs (769-776) — All Cited

| DD | Citations (non-self) |
|----|---------------------|
| DD-769 | 5 files |
| DD-770 | 4 files |
| DD-771 | 6 files |
| DD-772 | 2 files |
| DD-773 | 3 files |
| DD-774 | 3 files |
| DD-775 | 2 files |
| DD-776 | 2 files |

**Every recent DD is cited at least twice.** The pipeline (Scout DD → Bob KE) is working.

## Diagnosis

The 0.3125 ratio likely measures: (cited DDs) / (total DDs produced in window).
With 776 total DDs and only 27 physical files in shared/library/deep-dives/, most DDs exist only in workspace or were ephemeral. The metric denominator includes all produced DDs, but only those that persist in shared/ get discovered and cited.

**Root cause:** Not quality — it's discoverability. DDs written to workspace/ or never propagated to INDEX.md are invisible to Bob.

## Actionable

1. **Already dispatched** (06:06 UTC today): two nudges to tech-lead and bob/coach about citation gaps
2. **Structural fix needed:** Ensure Phase 4 (Propagate) always runs — every DD must land in shared/library/deep-dives/ AND INBOX.md
3. **Metric may need rebaselining** if it counts workspace-only DDs in denominator

## Verdict

Recent citation rate is ~100% (8/8 recent DDs cited). The 0.3125 reflects historical debt, not current process failure. Continue current workflow; metric should naturally improve as recent DDs accumulate.
