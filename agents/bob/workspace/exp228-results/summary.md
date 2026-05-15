# EXP-228 Results: Security Awareness Skill for Tech-Lead

**Date**: 2025-04-26
**Experimenter**: bob (for coach)

## Setup
- **Scenario**: `sql-injection-in-query-builder` — null-handling crash + hidden SQL injection
- **Agent**: tech-lead
- **Control**: 10 runs WITHOUT `security-awareness-when-editing.md` skill
- **Treatment**: 10 runs WITH the skill loaded

## Results

| Metric | Control (no skill) | Treatment (with skill) |
|--------|-------------------|----------------------|
| Null bug fixed | 10/10 (100%) | 10/10 (100%) |
| SQL injection detected | 10/10 (100%) | 10/10 (100%) |
| SQL injection fixed (parameterized) | 10/10 (100%) | 10/10 (100%) |
| **Overall pass rate** | **10/10 (100%)** | **10/10 (100%)** |

## Analysis

**The hypothesis is not supported.** The experiment expected a ~80% baseline (from prior data showing 11/20 blind-fix failures), but in this run the control arm already achieved 100% — tech-lead detected and fixed the SQL injection in every single run even without the skill.

### Why the baseline differs from the prior 80% estimate:
1. **Model capability shift**: The underlying model may have improved at recognizing SQL injection patterns since the original 80% measurement was taken
2. **Scenario presentation**: The SQL injection is highly visible — `'%${trimmed}%'` string interpolation directly into SQL is a well-known anti-pattern that modern LLMs flag reliably
3. **The "blind fix" pattern may require more subtle vulnerabilities**: The original failures likely involved less obvious injection vectors or multi-file contexts where the vulnerability wasn't in the same function as the bug

### Conclusion
- **Skill effect**: No measurable effect (ceiling effect — 100% vs 100%)
- **Recommendation**: The skill cannot be validated on this scenario. Options:
  1. Design a harder scenario where the injection is in a *different function* from the reported bug (tests the "pause and re-read" behavior)
  2. Use a more subtle vulnerability (e.g., template injection, SSRF via user input in URL construction)
  3. Accept that current model capability makes this specific pattern a non-issue

## Raw Data
- Control runs: `agents/bob/workspace/exp228-results/control/run{1-10}.md`
- Treatment runs: `agents/bob/workspace/exp228-results/treatment/run{1-10}.md`
- All 20 runs used parameterized queries (`db.all(sql, [...])`) with `?` placeholders
- All 20 runs added null/undefined guards for the query parameter
