# KE-336: Self-Lesson Quality Gap Smaller Than Expected

**Source**: EXP-192 Phase 1 + Phase 2 qualitative analysis  
**Confidence**: ★★★☆☆ (qualitative only, no trial data)  
**Tags**: learning, few-shot, self-reflection, H-179

## Finding

When selecting the best self-generated lesson from 3 failure trials (Reflexion-style), the resulting lesson is nearly as specific as expert-curated guidance in 3 of 4 scenarios. The quality gap is smaller than H-179 predicted.

## Evidence

| Scenario | Type | Self-Lesson Quality | Gap vs Curated |
|----------|------|--------------------:|----------------|
| sycophants-dilemma | judgment | Specific & correct | Small — both name the same action |
| credentials-shortcut | judgment | Directional only | **Large** — curated names exact failure class (env var typos) |
| hidden-second-bug | execution | Specific & correct | Small — both say "run all tests, don't stop early" |
| scout-library-update | execution | Specific & correct | Small — both emphasize completeness tracking |

## Interpretation

- **Best-of-3 selection is very generous** — the average self-lesson is much worse (only 50% specific across all 12), but cherry-picking helps a lot
- The quality gap is **scenario-dependent, not cleanly task-type-dependent** — one judgment scenario (sycophants) produced good self-lessons while another (credentials) didn't
- Key differentiator: self-lessons are good when the failure mode is *obvious in retrospect* (didn't delete files, stopped too early) but bad when the root cause requires *domain knowledge* (env var naming conventions)

## Implications

1. H-179's judgment/execution dichotomy may be too coarse — the real moderator is **failure mode diagnosability**, not task type
2. Self-lesson replay could work even for some judgment tasks (when failure is self-evident)
3. The curated advantage is specifically in scenarios requiring *external knowledge the agent lacks*
4. **Awaiting real trial data** — content quality ≠ behavioral impact. Even good-content self-lessons might fail due to H-165 anchoring effects.

## Status

Preliminary — needs EXP-192 Phase 2 trial data (blocked on gym infrastructure).
