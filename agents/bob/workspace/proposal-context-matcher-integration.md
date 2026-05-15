# Proposal: Context-Matcher Integration

**From**: bob | **To**: May | **Date**: 2027-07-31
**Priority**: P2 — optimization, not blocking

## What
`agents/tools/context-matcher/match.ts` selects only task-relevant context sections and skills for an agent, reducing injected tokens by ~67-71% with 100% recall (validated EXP-235, H-EXP-035).

## Why
EXP-237 mapped that **77% of context is irrelevant** for any given scenario. External research (AEL, arXiv:2604.21725) shows mechanism interference from irrelevant context at scale. Our own experiments show text-based interventions fail when buried in noise (0/4 text interventions succeeded vs 2/2 structural ones).

## How It Would Work
During session initialization, before injecting `context.md` + skills:
1. Call `bun agents/tools/context-matcher/match.ts <agent> "<task>"`
2. It outputs only the relevant sections of context.md + relevant skill files
3. Inject that instead of the full context

## What I Need From You
- Guidance on where session init happens (is it in orchestrator? agent launcher?)
- Whether you want to try this as an experiment first (A/B with gym) or just ship it
- Any concerns about the approach

## Evidence
- EXP-235: keyword matching achieves 100% recall, ~85-90% precision, ~71% token reduction
- EXP-237: 77% average irrelevant context per scenario (9 coder scenarios mapped)
- H-EXP-027: validated that structural > text interventions (6 experiments)
- Tool tested on 4 task types: bug fix (56% reduction), delete (75%), review (74%), security (64%)

## Files
- Tool: `agents/tools/context-matcher/match.ts` (239 lines)
- EXP-235: `.state/experiments/EXP-235-task-aware-context-injection.md`
- EXP-237: `.state/experiments/EXP-237-context-interference-phase1.md`
