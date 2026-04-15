# Tool Removal Proposal — Reduce Agent Tool Bloat

**Date**: 2026-03-16  
**Author**: Optimizer  
**Status**: Ready for implementation by May/Tech-Lead  

## Problem
Agents carry tools they never use. Each unused tool definition costs ~200-500 tokens in the system prompt, confuses the model, and increases the chance of tool misuse errors.

## Proposed Changes

### 1. Remove `coordination` (handoff) from QA
- **Evidence**: 0 handoff calls out of 120 sessions (0%)
- **Rationale**: QA is a leaf node — it reviews code and reports results. It never needs to hand off work.
- **Change**: Remove `"coordination"` from `agents/qa/agent.json` tools array
- **Savings**: ~300 tokens/session × ~120 sessions = ~36K tokens

### 2. Remove `coordination` (handoff) from Coder
- **Evidence**: 0 handoff calls out of 154 sessions (0%)
- **Rationale**: Coder is a leaf node — it writes code and runs tests. Results flow back to tech-lead automatically.
- **Change**: Remove `"coordination"` from `agents/coder/agent.json` tools array
- **Savings**: ~300 tokens/session × ~154 sessions = ~46K tokens

### 3. Remove `coordination` (handoff) from Amy
- **Evidence**: 0 handoff calls out of 793 sessions (0%)
- **Rationale**: Amy researches XHS content and writes findings to workspace files. No cross-agent handoff needed.
- **Change**: Remove `"coordination"` from `agents/amy/agent.json` tools array
- **Savings**: ~300 tokens/session × ~793 sessions = ~238K tokens

### 4. Remove `coordination` (handoff) from Amy-Kimi
- **Evidence**: 1 handoff call out of 671 sessions (0.1%)
- **Rationale**: Nearly identical to Amy. One handoff in 671 sessions is noise, not a pattern.
- **Change**: Remove `"coordination"` from `agents/amy-kimi/agent.json` tools array
- **Savings**: ~300 tokens/session × ~671 sessions = ~201K tokens

### 5. Remove `workflow` from Tech-Lead
- **Evidence**: 3 workflow calls out of 1,194 sessions (0.3%)
- **Rationale**: Tech-Lead uses `agents` tool to delegate to coder/QA directly. Workflow tool adds 800+ tokens to system prompt for near-zero usage.
- **Change**: Remove `"workflow"` from `agents/tech-lead/agent.json` tools array
- **Savings**: ~800 tokens/session × ~1,194 sessions = ~955K tokens

## Summary Table

| Agent | Tool Removed | Usage Rate | Token Savings/Session |
|-------|-------------|-----------|----------------------|
| QA | coordination | 0/120 (0%) | ~300 |
| Coder | coordination | 0/154 (0%) | ~300 |
| Amy | coordination | 0/793 (0%) | ~300 |
| Amy-Kimi | coordination | 1/671 (0.1%) | ~300 |
| Tech-Lead | workflow | 3/1194 (0.3%) | ~800 |

**Total estimated savings**: ~1.5M tokens across historical volume, ~2,000 tokens/session combined across the 5 agents.

## Implementation
Each change is a one-line edit in `agents/<agent>/agent.json` — remove the tool name from the `"tools"` array. No code changes needed. Changes take effect on next session for each agent (agent.json is loaded per-session by agent-loader.ts).

**P70 constraint**: Only May or tech-lead can edit agent.json files. Optimizer cannot make these changes directly.

## Risk Assessment
- **Low risk**: Removing a tool that's never used cannot break existing behavior
- **Reversible**: Add the tool name back to restore
- **No code changes**: Just config file edits
- **One potential concern**: Amy-Kimi used handoff once — if that was important, the 0.1% usage rate suggests it's an edge case that can be handled by having Amy-Kimi write findings to workspace and mention the target agent, rather than formal handoff
