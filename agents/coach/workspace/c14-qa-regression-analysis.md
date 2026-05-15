# C1.4 QA Regression Analysis

**Convention**: C1.4 = "last tool call should be finish()"  
**Date**: 2026-04-14  
**Analyst**: Coach

## Summary

QA has the **worst C1.4 compliance** of all agents at **74.3%** overall (489/658). The next worst is `unknown` at 76.8%. Most agents are 96%+.

## Two Distinct Failure Populations

### Population 1: Call Sessions (98.1% fail — 52/53)
- **All historical** (pre-April 8), zero recent failures
- These are `Phase 1: DIAGNOSE` sub-sessions from the `verify-wrap` workflow
- The workflow calls QA as a child agent for review — the child sessions don't use finish() because the workflow framework handles completion
- **Verdict**: Structural artifact. NOT a QA behavioral issue. The convention checker shouldn't count workflow child calls the same way. This is a **false positive** in the convention check.

### Population 2: Job Sessions (19.3% fail — 117/605)
- **All heartbeat sessions** (116/117)
- These are the real behavioral failures
- QA completes its review work (reads commits, runs tests, writes journal), then **stops without calling finish()**

## Root Cause Analysis (Job Failures)

### What happens in failing sessions:
| Last tool | Count | % of failures |
|-----------|-------|---------------|
| bash()    | 46    | 39% |
| read()    | 42    | 36% |
| edit()    | 23    | 20% |
| write()   | 6     | 5% |

### Ops budget is NOT the issue:
- Average ops on failures: **5.6** (vs 7.2 on passes)
- Failures use FEWER ops than passes — they're not hitting a ceiling
- Ops range: 0-17, spread across all values

### What QA is doing before stopping:
Looking at recent failures with session digests, QA:
1. Reads the latest commit/diff ✓
2. Runs test/typecheck gates (bash) ✓  
3. Writes findings to journal (edit) ✓
4. **Stops here** — doesn't proceed to finish() ✗

The pattern: QA treats the **journal append as the closing action**. After edit()ing the journal, it generates a text summary instead of calling finish(). The heartbeat says "Do NOT stop here. You MUST continue to Step 4" but QA interprets the journal append as completion.

### Weekly Trend:
| Week | Rate |
|------|------|
| W12 (Mar 16-22) | 43.7% (!!!) |
| W13 (Mar 23-29) | 92.0% |
| W14 (Mar 30-Apr 5) | 86.7% |
| W15 (Apr 6-12) | 93.4% |

W12 was catastrophic but things improved dramatically in W13+. Current rate is ~93% for jobs only, which is decent. The overall 74.3% figure is dragged down by (a) the historical call session false positives and (b) the W12 disaster.

### Daily recent trend (jobs only):
| Date | Fail/Total |
|------|------------|
| Apr 14 | 1/17 |
| Apr 13 | 4/59 |
| Apr 12 | 11/45 |
| Apr 11 | 5/25 |
| Apr 10 | 7/38 |
| Apr 9  | 1/47 |
| Apr 8  | 2/34 |

Apr 12 had a spike but otherwise trending okay at ~6-7% failure rate.

## Diagnosis

### Is this skill-addressable?
**Partially.** The behavioral pattern is clear: QA conflates "journal written" with "session complete." A process skill could reinforce the finish() requirement. However:

1. **KE-006 warning**: Skills targeting reasoning patterns don't change tool-calling patterns. The issue IS a tool-calling pattern (not calling finish()).
2. The heartbeat already has strong "MUST call finish()" language — and QA still fails ~7% of the time.
3. The actual compliance for recent jobs (~93%) is already decent.

### Structural fixes needed:
1. **Convention checker should exclude workflow child calls** — 52 false positives from `call` kind sessions in verify-wrap workflow. These aren't expected to call finish().
2. **Reduce the journal append friction** — QA spends ops on the complex journal append (wc → read tail → edit), which eats into budget and becomes the natural stopping point.

## Recommendations

### Priority 1: Fix convention checker (structural)
Exclude `kind='call'` sessions from C1.4 checks, or at minimum exclude sessions whose task starts with "Phase 1: DIAGNOSE". This alone would improve QA's reported rate from 74.3% to **80.6%** (489/(658-53)).

### Priority 2: Simplify journal append (structural)
The 3-step journal append process (wc → read tail → edit) uses 3 ops and becomes the natural stopping point. Consider:
- Making journal append a single bash command (echo >> file)
- Or moving journal append AFTER finish() (impossible with current conventions)

### Priority 3: Process skill (behavioral) — LOW CONFIDENCE
A skill could help, but given KE-006 (skills don't change tool-call patterns), I have **low confidence** this would work. If attempted, it should be:
- A **simple checklist skill** that says: "After writing journal, you have one more required step: finish()"
- NOT a reasoning/analysis skill — those don't affect tool behavior
- Test via gym before deploying

### Do NOT do:
- Don't restructure the heartbeat (KE-008)
- Don't add multiple interventions (KE-123 — stacking degrades performance)
- Don't add few-shot examples of finish() calls (KE-133 — templates harm open-ended tasks)

## Conclusion

The C1.4 regression has **two causes**: 52 false-positive call sessions and ~117 genuine heartbeat failures. The genuine failures are improving (93% recent vs 43.7% in W12). The most impactful fix is **structural** (fix convention checker to exclude workflow calls), not behavioral. A skill is unlikely to help given KE-006.
