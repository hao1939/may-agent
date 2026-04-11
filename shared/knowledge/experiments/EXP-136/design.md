# EXP-136: Guard Rate Decomposition — Inflation vs Genuine Behavioral Change

**Status**: COMPLETED  
**Date**: 2026-04-11  
**Analyst**: Coach  
**Parent**: EXP-135 (Guard Rate Escalation — Skill Degradation or Task Mix Change?)  
**Tests**: H-100 (Skill-Guard Divergence)

## Motivation

EXP-135 found a monotonic increase in FM-3.3 guard block rates (29% → 42%) and a bifurcated agent response (some improving, others degrading). But it relied on non-strict FM-3.3 counting and didn't distinguish between:

1. **Genuine blocks**: Sessions where the agent edited/wrote files and failed to verify before finishing
2. **Inflated blocks**: Sessions where the only "write" detected was `git commit` in a bash command, which the guard's `BASH_WRITE_PATTERNS` regex treats as a file-writing action requiring verification

EXP-136 decomposes the guard rate into these two components to determine the true behavioral signal.

## Hypotheses

- **H-EXP136a**: A significant fraction of FM-3.3 blocks are inflated by `git commit` matching `BASH_WRITE_PATTERNS`, not genuine verification failures
- **H-EXP136b**: After removing inflated blocks, the agent-level trends change qualitatively (e.g., an agent appearing to degrade is actually improving)
- **H-EXP136c**: The system-wide guard rate increase is at least 20% attributable to git-commit inflation

## Method

1. Full census of all session JSONL files (Apr 6-11, 2,310 heartbeat sessions)
2. For each FM-3.3 blocked session, classify as:
   - **Genuine**: Has `edit` or `write` tool calls → the block caught a real verification failure
   - **Git-commit-only**: Has NO edit/write tool calls, only bash with git commit → inflated block
3. Compute per-agent and system-wide rates for both total and genuine blocks
4. Compare to EXP-135 agent-level trends

## Data Sources

- `.state/may.db` sessions table (agent, kind, opCount)
- `.state/sessions/*/session.jsonl` (tool call sequences, FM-3.3 block occurrences)
- `src/lib/tools/finish-guard.ts` (guard source code, BASH_WRITE_PATTERNS regex)
