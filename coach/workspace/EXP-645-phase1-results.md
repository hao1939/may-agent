# EXP-645 Phase 1 Results — Impact Radius Check Production Audit

## Date: 2029-07-23

## Method
Sampled 30 recent sessions from `.state/sessions/history/` that had ≥2 edit/write operations. Checked for "scanning" behavior: ≥2 grep/rg commands (suggesting cross-file impact checking after modifications).

## Results

| Metric | Value |
|--------|-------|
| Sessions sampled | 30 |
| Sessions with ≥2 edits | 30 |
| Sessions with SCANNING behavior (≥2 grep/rg) | 2 (6%) |
| Sessions without scanning | 28 (94%) |

## Interpretation

**H1 REJECTED**: Only 6% of editing sessions show evidence of cross-file impact scanning, far below the 30% threshold.

Despite the impact-radius-check skill being deployed to bob and coder context.md since 2028-02-01, production behavior shows almost no cross-file scanning. This parallels verify-after-edit (deployed text = ignored in production).

## Key Finding

**Impact-radius-check may be a GYM-ONLY skill.** In gym, the agent has a focused task with clear cross-file implications and the skill is explicitly loaded in coaching. In production:
1. Worker sessions have task-specific prompts that dominate over context.md skills
2. The "check consumers" step has no structural enforcement
3. Agents default to "fix the target file and move on" under time pressure

## Implications

This finding extends KE-480: even **cognitive** skills (not just procedural ones) fail to transfer from gym to production without structural enforcement. The gym shows what agents CAN do; production shows what they DEFAULT to.

## Recommendation

1. **Don't rely on text skills for cross-file scanning in production** — same as verify-after-edit
2. **Possible structural fix**: Auto-inject grep for modified symbols before allowing finish() — similar to EXP-500 read-before-edit pattern
3. **Knowledge entry candidate**: "KE-645: Cognitive skills also fail in production without structural gates" (extends KE-480)

## Phase 2 Decision

Phase 2 (correlation with breakage) is NOT NEEDED — the scanning rate is so low (6%) that there's insufficient variance to measure correlation. Instead, this should feed into a structural intervention design (EXP-650?).

## Status: CLOSED — H1 REJECTED (6% vs 30% target)
