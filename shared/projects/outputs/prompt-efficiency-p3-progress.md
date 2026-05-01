# Prompt Efficiency P3 Progress Report

**Date**: 2026-07-02
**Task**: Trim verbose SOUL.md guidance (P3 of prompt-efficiency project)

## Work Done

### Optimizer SOUL.md Trimmed (53% reduction)
- **Before**: 1556 words (~2022 tokens)
- **After**: 733 words (~952 tokens)
- **Savings**: 823 words (~1070 tokens per invocation)

Changes made:
1. Condensed "What Makes You Different" — removed redundant elaboration
2. Condensed "Your Research Focus / Tools" — collapsed bullet list into single paragraph
3. Removed "Current workflows to evaluate" list (stale)
4. Condensed "Your Starting Point" and "Accountability" 
5. Condensed "Analysis Protocol" to one line
6. Condensed "Code Hygiene" from 15 lines to 2
7. Condensed "Workflow System" from 6 lines to 2
8. Condensed "Failure Mode Guards" from 30 lines to 6 (kept all rules, removed sub-bullets)
9. Trimmed Reference section (removed lab runner, agent tool config)

## Current Metrics

### SOUL.md Average Size
- **Before this work**: ~921 tokens avg
- **After this work**: ~880 tokens avg  
- **Target**: <800 tokens
- **Gap**: 80 tokens (10% above target)

### Blocker: Ownership Restrictions
Cannot edit other agents' SOUL.md files (bob: 1552, master: 1354, amy: 1272, tech-lead: 1106, qa: 1093, coach: 1030, evaluator: 1023). These need to be trimmed by their owners or by May/tech-lead.

### Context.md Average Size
- **Current**: ~778 tokens avg
- **Target**: <600 tokens
- **Bloated files** (>1500 tok): may (2017), coach (1916), bob (1595), tech-lead (1449)

## Remaining Work to Hit Targets

| Action | Owner | Token savings est. |
|--------|-------|-------------------|
| Trim bob SOUL.md (same pattern as optimizer) | bob/May | ~500 tokens |
| Trim master SOUL.md | master/May | ~400 tokens |
| Trim amy SOUL.md | amy/May | ~300 tokens |
| Clean coach context.md (stale facts) | coach/May | ~600 tokens |
| Clean may context.md | May | ~700 tokens |
| Clean bob context.md | bob/May | ~400 tokens |

## Recommendation

The prompt-efficiency project needs **May or tech-lead to trim the remaining SOUL.md files** using the same pattern applied to optimizer: condense verbose explanations into single actionable lines, collapse bullet lists, remove examples. The optimizer trim demonstrates the pattern and proves it can achieve 50%+ reduction without losing any rules.

## Metric Status (prompt-efficiency project)

| Metric | Baseline | Target | Current | Status |
|--------|----------|--------|---------|--------|
| SOUL.md avg (tokens) | ~950 | <800 | ~880 | Improved but not at target |
| Context.md avg | ~783 | <600 | ~778 | Not yet addressed |
| Duplicate rules | 3×5-8 agents | 0 | 2×5-8 agents | Partially done (P2) |
| Bloated context (>1500tok) | 4 agents | 0 | 4 agents | Not addressed |
