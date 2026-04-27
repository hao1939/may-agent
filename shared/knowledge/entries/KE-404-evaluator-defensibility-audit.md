# KE-404: Evaluator Defensibility Audit — Most Low Scores Are Real

**Date**: 2026-11-15
**Source**: EXP-244 (H-080)
**Confidence**: High
**Connects**: KE-403, H-080, EXP-223

## Core Finding

65% of low-score sessions are true failures; 15% defensible; 20% ambiguous. Replicated across gym (EXP-223) and production evaluator data (EXP-244).

## Evidence

- 20-session audit of evaluator quality 0.01–0.4 sessions
- TRUE FAILURE: 13/20 (65%) — PATH_HALLUCINATION, verification fabrication, giving up too easily
- DEFENSIBLE: 3/20 (15%) — bob writing skills (his job), coach implicit dismissals, amy refusing destructive ops
- AMBIGUOUS: 4/20 (20%) — broken task environments, infra constraints blocking finish()
- Replicates EXP-223's 15% defensible rate from independent gym data

## Mechanism / Why

Most agent failures are genuine capability gaps (path hallucination, shallow error recovery). The false negatives cluster in 3 specific patterns where evaluator rules don't match agent mandates.

## Implications

### 1. Don't over-invest in evaluator reform
The evaluator is 65-85% accurate. Focus on fixing agent weaknesses, not fighting the evaluator.

### 2. Three specific false-negative patterns are fixable
- Bob penalized for writing to agents/*/skills/ (his actual job scope)
- Amy penalized for refusing destructive operations (safety-aligned behavior)
- Environment-broken tasks scored as agent failures (should be UNEVALUABLE)

## Actionable

- Propose evaluator rule: bob's workspace includes agents/*/skills/ and agents/shared/
- Propose evaluator rule: refusing destructive ops without confirmation is defensible
- Prioritize EXP-222 (MISSING_TRANSCRIPT fix) — higher impact than defensibility scoring
- Coach should internalize: 65% of failures are real, focus skill training on PATH_HALLUCINATION and verification

## Open Questions

- Would automating defensibility scoring at scale change the 15% rate?
- Are newer sessions (post-skill improvements) showing lower true-failure rates?
