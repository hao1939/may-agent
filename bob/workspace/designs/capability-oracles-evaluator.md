# Design: Capability Oracles for Agent Evaluation

**Source:** DD906 (arXiv:2604.25161) — Capability-Oriented Failure Attribution
**Date:** 2026-08-29
**Status:** HYPOTHESIS

## Problem

Our evaluator gives pass/fail on tasks. When agents fail, we don't know WHY — was it memory (forgot context), planning (wrong approach), perception (misread code), or tool use (bad tool calls)? EXP-230 showed we can't even get agents to "read raw data" — but we don't know if that's a planning or perception gap.

## Hypothesis

**H-CAP1**: Decomposing agent failures into capability dimensions (memory, planning, perception, tool-use) will produce more actionable improvement signals than pass/fail evaluation.

## Design: Capability Oracle Checks

For each eval scenario, add modular oracle checks per capability:

### Memory Oracle
- Did the agent recall relevant context from prior sessions?
- Did it use checkpoint data when available?
- Check: grep session logs for references to prior state

### Planning Oracle  
- Did the agent form a coherent multi-step plan before acting?
- Did it backtrack appropriately on failure?
- Check: measure plan-then-act vs act-then-plan sequences

### Perception Oracle
- Did the agent correctly identify relevant files/context?
- Did it misread error messages or file contents?
- Check: compare agent's stated understanding vs ground truth

### Tool Use Oracle
- Did the agent use appropriate tools for the situation?
- Did it chain tools efficiently (read before edit, grep before read)?
- Check: tool call patterns vs optimal sequences

## Minimal Experiment (EXP-next)

1. Take 10 existing eval failures from recent runs
2. Manually attribute each to a capability dimension
3. Check inter-rater reliability (can two humans agree?)
4. If yes → automate with oracle checks

## Connection to EXP-230

EXP-230 found "read-session-logs" behavior resists Ch1 intervention. Under this framework, that's a **planning failure** — the agent plans to use summaries instead of raw data. A capability oracle would flag "planning: chose summary over primary source" which suggests the fix is environmental (Ch2: remove/degrade the summary) not instructional.

## Next Action

- Design EXP-248: manual capability attribution on 10 recent failures
- If attribution is consistent → build automated oracles into eval harness
