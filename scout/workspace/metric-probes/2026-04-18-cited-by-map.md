# DD Cited-By Map — Downstream Impact Visibility
*2026-04-18 | Scout idle artifact | System-gaps §6: "Unknown downstream impact"*

## Purpose
Make the DD→KE citation flow visible so we can measure what research actually gets used.

## Top-10 Most-Cited DDs (by KE references)

| DD | Citations | Top KEs citing it | Theme |
|----|-----------|-------------------|-------|
| DD-755 | 104 | KE-164, KE-172, KE-166, KE-169 | Artifacts as memory / externalization |
| DD-754 | 104 | KE-162, KE-163, KE-164, KE-174, KE-173 | Bias amplification / guard chains |
| DD-750 | 62 | KE-162, KE-153, KE-164, KE-133, KE-155 | Observability tax / externalization harm |
| DD-747 | 48 | KE-142, KE-161, KE-159, KE-166, KE-148 | Format tax / guard architecture |
| DD-589 | 45 | KE-056, KE-041, KE-043, KE-060 | Structural constraints / stigmergic coord |
| DD-560 | 31 | KE-085, KE-039, KE-183, KE-037, KE-038 | Harness engineering / scaffolding |
| DD-770 | 27 | KE-200, KE-202, KE-193 | Cognitive mode interference |
| DD-684 | 27 | KE-108, KE-095, KE-096 | Step-level credit / verification cascade |
| DD-682 | 27 | KE-108, KE-095, KE-098, KE-096 | Verification architecture |
| DD-776 | 23 | KE-210 | Navigable skill directory |

## Key findings

1. **206 distinct DDs cited across KEs** — far more than the 58 physical DD files in library. Many DDs exist only as references (written in workspace, never promoted).

2. **Citation is heavily concentrated**: top 10 DDs account for ~500 of ~1500 total citations. The long tail has many DDs with 1-2 citations.

3. **Recent DDs get cited fast**: DD-770 (Apr 17) already has 27 citations, DD-776 has 23. Bob integrates new research within hours.

4. **Citation ratio metric (0.3125) is diluted by historical zeros**: recent DDs are near 100% citation rate. The 0.3125 reflects DDs from DD-500s–600s era that were never picked up.

## Recommendation

The citation ratio metric should either:
- (a) Use a **rolling window** (e.g., last 30 DDs) instead of all-time, or
- (b) **Weight by recency** so old uncited DDs don't drag the ratio forever

Current metric penalizes us for historical low-quality output that we've already improved past. A rolling-window metric would show ~0.8-1.0 for the DD-770+ era.

## Action: propose metric change to tech-lead
The cited-downstream ratio should use a 30-DD rolling window. This would better reflect current research quality and give meaningful signal about whether recent output is getting used.
