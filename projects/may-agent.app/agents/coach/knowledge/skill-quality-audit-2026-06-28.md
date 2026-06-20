# Skill Quality Audit — 2026-06-28

## Executive Summary

**156 skills exist across the system. The vast majority are unmeasured AND unwired.**

### Counts
- Agent-specific skills: ~98 files across 11 agents
- Shared skills (active): ~49 SKILL.md files
- Shared skills (archived): 17
- Skills with ANY evaluation data: **1** (verification, from 2026-03-19)

### Wiring Audit: Are skills referenced in context.md?

| Agent | Total Skills | Referenced in context.md | Unreferenced |
|-------|-------------|------------------------|-------------|
| amy | 4 | 2 | 2 |
| amy-kimi | 4 | 0 | 4 |
| bob | 14 | 1 | 13 |
| coder | 8 | 1 | 7 |
| coach | 12 | 3 | 9 |
| evaluator | 6 | 2 | 4 |
| may | 8 | 2 | 6 |
| optimizer | 10 | 2 | 8 |
| qa | 8 | 2 | 6 |
| scout | 13 | 1 | 12 |
| tech-lead | 11 | 2 | 9 |
| **TOTAL** | **98** | **18 (18%)** | **80 (82%)** |

### Root Cause

Skills are deployed to `agents/<name>/skills/` but most agent prompts don't load them.
The `skills/` directory is only useful if the agent's prompt or context.md explicitly references or includes it.
**82% of agent-specific skills are effectively dead code.**

### Categories of Unreferenced Skills

Most are "mass-deployed" skills that got pushed to every agent without wiring:
- `reading-metrics` — 0 refs in 10/11 agents
- `closing-the-loop` — 0 refs in 8/11 agents  
- `second-look-verification` — 0 refs in 9/11 agents
- `verify-after-edit` — 0 refs in 8/11 agents
- `evidence-over-narrative` — 0 refs in all agents that have it
- `escalation` — referenced in ~5 agents (best wired skill)

### Recommendations

1. **STOP deploying skills without wiring them.** A skill in `skills/` that isn't in context.md is waste.
2. **Audit which skills agents actually need.** Most agents have 8-14 skills — too many to process even if wired.
3. **Pick 3 high-value skills, wire them, measure impact.** Start with coder (worst quality score).
4. **Archive or delete unwired skills** that have been sitting unused for >30 days.

## Next Action: EXP-165 (Verification Gate)

EXP-165 is designed and ready. It targets coder's #1 failure (confabulation/verification skipping).
This is the highest-impact single experiment we can run.
