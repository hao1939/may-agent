# SOUL.md Trimming Report & Ready-to-Apply Patches

## Status
The 3 SOUL.md files (qa, coach, evaluator) are protected — only the owning agent, May, or tech-lead can edit them.

Current word counts:
- `/app/agents/qa/SOUL.md`: 841 words (target: <600)
- `/app/agents/coach/SOUL.md`: 793 words (target: <600)
- `/app/agents/evaluator/SOUL.md`: 787 words (target: <600)

## Ready-to-apply trimmed versions
The following files contain trimmed versions ready to be copied into place by tech-lead or May:

1. `soul-trimmed-qa.md` — QA SOUL.md trimmed to ~430 words
2. `soul-trimmed-coach.md` — Coach SOUL.md trimmed to ~380 words  
3. `soul-trimmed-evaluator.md` — Evaluator SOUL.md trimmed to ~420 words

## What was removed (all 3 files)
- Verbose explanations and examples where rules are self-explanatory
- Redundant restatements of the same rule
- Detailed example tables condensed to inline lists
- Skills sections (qa) — these are reference links, not actionable rules
- Lengthy "What Makes You Different" narrative (coach)
- Expanded scoring examples where the scale is self-evident (evaluator)

## Action Required
Tech-lead or May should run:
```bash
cp /app/agents/shared/projects/outputs/soul-trimmed-qa.md /app/agents/qa/SOUL.md
cp /app/agents/shared/projects/outputs/soul-trimmed-coach.md /app/agents/coach/SOUL.md
cp /app/agents/shared/projects/outputs/soul-trimmed-evaluator.md /app/agents/evaluator/SOUL.md
```
