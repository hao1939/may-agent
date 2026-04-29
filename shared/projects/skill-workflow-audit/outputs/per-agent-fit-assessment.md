# Per-Agent Skill Fit Assessment

**Date**: 2026-07-02
**Purpose**: Identify which agents have too many skills (context bloat, low compliance) vs too few (gaps causing failures).

## Summary

| Agent | Own Skills | Shared (loaded) | Total Context | Eval Quality | Fit |
|-------|-----------|-----------------|---------------|-------------|-----|
| bob | 18 (92KB) | 79 (483KB) | ~575KB | unknown | OVERLOADED |
| tech-lead | 17 (83KB) | 79 (483KB) | ~566KB | unknown | OVERLOADED |
| coder | 11 (60KB) | 79 (483KB) | ~543KB | unknown | AT RISK |
| amy | 11 (58KB) | 79 (483KB) | ~541KB | unknown | AT RISK |
| coach | 11 (51KB) | 79 (483KB) | ~534KB | 0.45 | AT RISK |
| optimizer | 8 (38KB) | 79 (483KB) | ~521KB | 0.10 | FAILING |
| scout | 9 (23KB) | 79 (483KB) | ~506KB | unknown | OK |
| evaluator | 7 (25KB) | 79 (483KB) | ~508KB | unknown | OK |
| may | 6 (10KB) | 79 (483KB) | ~493KB | unknown | OK |
| qa | 4 (11KB) | 79 (483KB) | ~494KB | unknown | OK |

## Key Findings

### 1. Shared skills dominate context for ALL agents
Every agent loads 79 shared skills (483KB). Per-agent skills are a minor addition. **The biggest leverage is pruning shared skills**, not per-agent ones.

### 2. Optimizer: skills aren't the problem
Optimizer has only 8 own skills but scores 0.10 quality. Its failure mode is non-delivery and looping — these are architectural/instruction issues, not skill gaps. More skills won't help; the agent needs fewer distractions and stronger task-completion enforcement.

### 3. Bob and tech-lead are overloaded
18 and 17 per-agent skills respectively, on top of 79 shared. These agents carry the most total context. Recommend:
- Audit which per-agent skills duplicate shared skills
- Archive per-agent skills that are now covered by shared equivalents

### 4. Coach quality issue (0.45)
Self-assessment shows goal drift and workflow non-compliance. Root cause: attempting too much in single sessions. Not a skill gap — a discipline issue.

## Recommendations

| Priority | Action | Expected Impact |
|----------|--------|----------------|
| P0 | Prune shared skills further (79→~40) | -200KB context for ALL agents |
| P1 | Audit bob's 18 skills for shared duplicates | -30-50KB for bob |
| P1 | Audit tech-lead's 17 skills for shared duplicates | -30-50KB for tech-lead |
| P2 | Optimizer needs architectural fix, not more skills | Quality 0.1→? |

## Next Steps
- [ ] Identify which of the 79 shared skills are actually loaded (some may be in archive/)
- [ ] Cross-reference bob/tech-lead per-agent skills against shared skills for duplicates
- [ ] After eval-revival reaches 50% coverage, correlate skill count with quality scores
