# Cycle 2: Skill Freshness & Context Cost Audit

**Date**: 2026-07-01
**Iteration**: 52

## Summary

- **38 active shared skills** (catalog, delivered via `context_files`)
- **107 agent-local skills** across 11 agents
- **Total: 145 skill files** in the system (down from 203 reported earlier — archiving worked)

## Per-Agent Skill Counts

| Agent | Local Skills | Risk |
|-------|-------------|------|
| bob | 18 | ⚠️ High — context bloat likely |
| tech-lead | 17 | ⚠️ High |
| amy | 11 | Medium |
| coach | 11 | Medium |
| coder | 11 | Medium |
| scout | 9 | OK |
| optimizer | 8 | OK |
| evaluator | 7 | OK |
| may | 6 | OK |
| amy-kimi | 5 | OK |
| qa | 4 | OK |

## Key Finding: Shared Skills Are a Dead Catalog

The DELIVERY-GUIDE.md confirms: skills only work when delivered via `context_files` in task messages. The 38 shared skills in `agents/shared/skills/` are NOT automatically loaded into any agent's context. They exist as a catalog for delegation.

**Question**: Are any of these 38 shared skills ever actually passed via `context_files`? If not, they're dead weight in the repo.

## Recommendations (Next Steps)

1. **Audit `context_files` usage**: grep codebase for `context_files.*skill` to see which shared skills are actually delivered
2. **Bob & tech-lead skill pruning**: 17-18 local skills is likely too many for context. Audit which are actually influencing behavior.
3. **Staleness check**: All shared skills have same mtime (repo clone artifact). Need to check git log for actual last-modified dates.
4. **Skill bloat-ratio**: Estimate % of skills with zero evidence of impact → target metric < 0.5

## Context Cost Estimate

Assuming ~3KB average per skill file:
- bob: 18 × 3KB = ~54KB of skill context (significant)
- tech-lead: 17 × 3KB = ~51KB
- Total system: 145 × 3KB = ~435KB of skill content

At ~4 tokens/word and ~200 words/KB, that's ~800 tokens per skill on average. Bob carries ~14,400 tokens of skills — roughly 10-15% of a typical context window.
