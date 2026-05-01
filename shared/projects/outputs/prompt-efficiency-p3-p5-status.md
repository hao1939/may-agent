# Prompt Efficiency P3/P5 Status Report

## P3: Trim qa/coach/evaluator SOUL.md files to <600w

### Status: BLOCKED — Files still exceed 600w

| File | Current Words | Target |
|------|--------------|--------|
| `/app/agents/qa/SOUL.md` | 841 | <600 |
| `/app/agents/coach/SOUL.md` | 793 | <600 |
| `/app/agents/evaluator/SOUL.md` | 787 | <600 |

**Blocker**: Worker agent cannot edit SOUL.md files (protected). Tech-lead has been notified (P0) across 3 iterations but has not yet acted.

### Trimmed proposals already exist at:
- `/app/agents/shared/projects/outputs/soul-trimmed-qa.md`
- `/app/agents/shared/projects/outputs/soul-trimmed-coach.md`
- `/app/agents/shared/projects/outputs/soul-trimmed-evaluator.md`

## P5: Final Measurement — What's Already Done

### SOUL.md word counts (all agents):
| Agent | Words | Under 600w? |
|-------|-------|-------------|
| optimizer | 299 | ✅ |
| scout | 303 | ✅ |
| amy | 329 | ✅ |
| master | 344 | ✅ |
| judge | 346 | ✅ |
| dev | 357 | ✅ |
| tech-lead | 358 | ✅ |
| amy-kimi | 394 | ✅ |
| arc | 418 | ✅ |
| bob | 420 | ✅ |
| may | 598 | ✅ |
| **evaluator** | **787** | ❌ |
| **coach** | **793** | ❌ |
| **qa** | **841** | ❌ |

### Summary
- **11/14 agents** are under 600w target ✅
- **3 agents** remain over target (qa, coach, evaluator) ❌
- Total system words: 6,916 (would be ~5,496 if P3 completed — ~20% reduction)
- Estimated token savings from P3: ~1,420 words × ~1.3 tokens/word ≈ **1,846 tokens per prompt load**

### Recommendation
Tech-lead should apply the trimmed versions from the proposal files. The content is ready — only the file write is needed.
