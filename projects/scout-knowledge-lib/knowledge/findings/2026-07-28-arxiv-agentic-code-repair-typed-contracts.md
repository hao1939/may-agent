# Agentic Code Repair: Typed Revision Contracts

Date: 2026-07-28
Source: https://arxiv.org/abs/2607.24604
Tags: agent-reliability, code-repair, loop-contracts, verification

## Summary

"Looping Is Not Reliability" formalizes a critical failure mode in generate–test–revise coding agents: repetition alone provides no reliability guarantee, and forced revision often *degrades* correctness. In a controlled 900-trajectory study over HumanEval repairs, current correctness drops from 82.0% after one revision to 67.3% after two when agents are forced to revise against stale traces. Stale verification evidence harms 34/135 correct starts vs 4/135 with current traces (22.2pp increase in regression).

## Key Contributions

1. **Empirical decomposition of loop failure**: Separates five distinct concerns — admission (should we enter the loop?), preservation (don't lose correct patches), grounded certification (bind evidence to exact code states), competence (can the agent actually fix this?), and liveness (will the loop terminate?).

2. **Evidence-bound typed loop contract**: A formal contract type system where verifier evidence is cryptographically bound to exact code states. Verified checkpoints are preserved across revisions so agents never regress past a known-good state.

3. **Stale-trace harm quantified**: Common-state branching experiments (2,430 branches from identical frozen programs) isolate that outdated test traces — not revision itself — cause most regressions.

## Relevance to Agent Infrastructure

This work directly addresses the "Coordination Tax" on single-agent loops: even without multi-agent concurrency, a coding agent's own revision cycle creates state-management overhead that degrades reliability. The typed contract pattern (bind evidence → preserve checkpoints → gate revision) is a general agent-infrastructure primitive applicable beyond code repair to any verify-then-act loop.

The finding that forced revision hurts correctness challenges the default "retry until green" pattern common in agent frameworks and suggests agents need admission gates (cf. ConsistencyGate for memory writes) before entering repair loops.

## Connections

- **ConsistencyGate** (2026-07-28): Write-time admission for memory; this paper proposes revision-time admission for code patches — same pattern, different domain.
- **MemTX** (2026-07-28): Transactional belief-commit preserves state integrity; typed revision contracts preserve patch integrity — both are checkpoint-and-rollback patterns.
- **Coordination Tax thesis**: Even single-agent loops incur coordination overhead; revision contracts are the tax receipt.
