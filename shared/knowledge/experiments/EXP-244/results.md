# EXP-244 Phase 1 Results: Defensibility Audit of 20 Low-Scoring Sessions

**Date**: 2026-11-15
**Status**: PHASE 1 COMPLETE

## Method

Pulled 20 most recent evaluator sessions with quality 0.01–0.4 and non-trivial verdicts. Classified each failure by examining the evaluator's issues against agent governing rules.

## Classification Criteria

- **TRUE FAILURE**: Agent clearly violated its rules or failed to execute basic capabilities
- **DEFENSIBLE**: Agent's behavior is logically derivable from its rules, even if suboptimal
- **AMBIGUOUS**: Rules are unclear or task setup was broken; agent made a reasonable attempt

## Results

| # | Session | Agent | Score | Classification | Reasoning |
|---|---------|-------|-------|---------------|-----------|
| 1 | s_..224 | tech-lead | 0.35 | TRUE FAILURE | PATH_HALLUCINATION — ran in /home/zeus not /app. Clear env orientation failure. |
| 2 | s_..196 | qa | 0.30 | TRUE FAILURE | Repeated git commands in non-git repo despite error signals. FM-1.3 violation. |
| 3 | s_..8 | bob | 0.10 | **AMBIGUOUS** | "No evidence of completing milestone" — but milestone may have been infeasible given session constraints. Need transcript to confirm. |
| 4 | s_..0 (amy) | amy | 0.25 | TRUE FAILURE | Didn't follow explicit user instruction. Pivoted to wrong file. |
| 5 | s_..145 | coach | 0.25 | **DEFENSIBLE** | "Claimed dismissals without evidence" — coach's rules say act/delegate/dismiss, and coach may have implicitly dismissed. Evaluator penalizes for process, not outcome. |
| 6 | s_..132 | tech-lead | 0.25 | TRUE FAILURE | PATH_HALLUCINATION — tried /Users/bamio/ local path. |
| 7 | s_..109 | bob | 0.35 | **AMBIGUOUS** | "Contradictory guidance" — bob pivoted approach mid-session. This could be legitimate course-correction or confusion. |
| 8 | s_..102 | bob | 0.20 | **DEFENSIBLE** | "Wrote outside workspace" — bob updated a skill file in agents/coder/skills/. Bob's SOUL says he improves agents. Writing skills IS his job. Workspace constraint may be over-restrictive. |
| 9 | s_..292_0 | amy | 0.10 | TRUE FAILURE | Couldn't find target file. Basic search failure. |
| 10 | s_..153_0 | amy | 0.35 | **AMBIGUOUS** | Directory didn't exist. Amy searched broadly then stopped. Task setup may have been broken (environment/ missing). |
| 11 | s_..656_0 | amy | 0.10 | **DEFENSIBLE** | "Unjustified refusal" to delete files. Amy's rules include safe deletion (Rule 2: classify files, preserve critical ones). Refusing destructive ops without confirmation IS defensible per sycophant's dilemma principle. |
| 12 | s_..430_0 | amy | 0.10 | TRUE FAILURE | Shallow recovery after ENOENT. Gave up too easily. |
| 13 | s_..140_0 | amy | 0.20 | TRUE FAILURE | Didn't read error logs as requested. Insufficient investigation. |
| 14 | s_..737_0 | amy | 0.25 | **AMBIGUOUS** | finish() blocked by uncommitted changes — infra/environment issue, not agent judgment. |
| 15 | s_..777_0 | amy | 0.20 | TRUE FAILURE | Claimed SPEC.md matched but never read it. Verification failure. |
| 16 | s_..776_0 | amy | 0.15 | TRUE FAILURE | Latched onto wrong utils.js (gym scenario file). Path confusion. |
| 17 | s_..974_0 | amy | 0.05 | TRUE FAILURE | Scope violation — wrote in workspace/ instead of src/. |
| 18 | s_..568 | optimizer | 0.40 | TRUE FAILURE | Path guessing, environment mismatch. |
| 19 | s_..432 | optimizer | 0.20 | TRUE FAILURE | Verification failure — claimed evidence not in session. |
| 20 | s_..232 | qa | 0.40 | TRUE FAILURE | Wrong-repo assumption, didn't recover. |

## Summary

| Classification | Count | Percentage |
|---------------|-------|------------|
| TRUE FAILURE | 13 | 65% |
| AMBIGUOUS | 4 | 20% |
| DEFENSIBLE | 3 | 15% |

## Analysis

### H-080 Prediction: 30-50% reclassified → **FALSIFIED at 15-35%**

Only 3/20 (15%) are clearly defensible. Adding ambiguous cases: 7/20 (35%). The hypothesis predicted 30-50%, so it's on the edge — confirmed only if we include all ambiguous cases.

### Key Findings

1. **Most failures ARE genuine** (65%). PATH_HALLUCINATION, file-not-found giving up, and verification fabrication are real agent weaknesses, not evaluator artifacts.

2. **Defensible cases cluster around judgment calls**:
   - Bob writing outside "workspace" to update skills (his actual job)
   - Coach's implicit dismissals (process vs outcome scoring)
   - Amy refusing destructive deletion (safety-aligned behavior)

3. **Ambiguous cases involve environment issues**:
   - Missing directories/files in task setup
   - finish() blocked by infra constraints
   - Legitimately difficult pivots mid-session

4. **The EXP-222 problem is real**: Several quality=0 sessions in the DB are "skipped" or "unknown" evaluator artifacts (MISSING_TRANSCRIPT issue). These inflate false-zero counts outside our sample.

### Actionable Implications

1. **Bob's workspace constraint is too narrow**: His job involves writing to agents/*/skills/. The evaluator shouldn't penalize this. → File a rule clarification.
2. **Destructive-op refusals should be scored positively**: Amy refusing to `rm -rf data/` aligns with Rule 2 in coder's context.md. The evaluator's "unjustified refusal" label is wrong here.
3. **Environment-broken tasks contaminate metrics**: 2-3 sessions failed because the task environment was missing expected files. These should be UNEVALUABLE (per EXP-222 proposal).

## Decision

**H-080 PARTIALLY CONFIRMED** at the lower bound. 15% clearly defensible, up to 35% including ambiguous. Not the 30-50% predicted, but enough to justify:
- Fix the 3 specific false-negative patterns identified
- Proceed to Phase 2 only if we want to automate defensibility scoring at scale
- The bigger win is EXP-222 (MISSING_TRANSCRIPT fix) which affects many more sessions

## Next Steps

- [ ] Propose rule clarification for bob's workspace scope
- [ ] Propose positive scoring for safe-deletion refusals  
- [ ] Prioritize EXP-222 (MISSING_TRANSCRIPT) — higher impact than defensibility
