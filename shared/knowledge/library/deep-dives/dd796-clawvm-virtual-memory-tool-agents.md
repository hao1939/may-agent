# DD#796 — ClawVM: Harness-Managed Virtual Memory for Stateful Tool-Using LLM Agents

**Paper**: Rafique & Bindschaedler (2026). "ClawVM: Harness-Managed Virtual Memory for Stateful Tool-Using LLM Agents." arXiv:2604.10352. EuroMLSys '26.  
**Relevance**: ★★★★★ — Directly models agent state management as virtual memory with typed pages, token budgets, and lifecycle-boundary writeback — mirrors our harness architecture  
**Date**: 2026-04-21  

---

## Core Contribution

**ClawVM** treats the agent context window as working memory and introduces OS-style virtual memory abstractions:
- **Typed pages**: State is segmented into typed, independently-managed pages
- **Minimum-fidelity invariants**: Each page has a guaranteed minimum representation quality
- **Multi-resolution representations**: Pages exist at multiple compression levels under a token budget
- **Validated writeback at lifecycle boundaries**: State persistence is deterministic, not best-effort

## The Problem Solved

Current agent harnesses suffer three recurring failure modes:
1. **Lost state after compaction** — context summarization drops critical state
2. **Bypassed flushes on reset** — session termination loses unflushed working state  
3. **Destructive writeback** — persisting compressed state overwrites higher-fidelity stored state

## Key Design Decisions

- **Harness as enforcement point**: The harness already assembles prompts, mediates tools, and observes lifecycle events → natural place for memory management policy
- **Token budget as memory constraint**: Analogous to physical RAM; pages compete for residency
- **Policy-engine overhead**: Median <50μs per turn (negligible)
- **Deterministic guarantees**: Eliminates all policy-controllable faults when minimum-fidelity set fits in budget

## Evaluation

- 12 real-session traces + synthetic workloads + adversarial stress tests
- **Result**: Eliminates all policy-controllable state faults (confirmed by offline oracle)
- Key constraint: minimum-fidelity set must fit within token budget

## Relevance to Our System

**Extremely high** — this paper formalizes exactly what our harness does informally:
- Our `checkpoint` system = manual page writeback
- Our context compaction = unmanaged page eviction (no fidelity guarantees)
- ClawVM's "lifecycle boundary writeback" = what we need at session end
- The "destructive writeback" failure = our observed issue with compaction losing critical state

**Actionable**: Consider typed-page model for our `.state/` system — separate checkpoint types with different fidelity requirements.

## Limitations

- Evaluated on single-agent scenarios only
- No multi-agent shared memory semantics
- Token budget assumption may not hold for very-long-horizon tasks
- EuroMLSys workshop paper (8 pages) — limited detail on policy algorithms

## Cross-References

- DD#792 ContextCurator: RL approach to same problem (learned policy vs. engineered invariants)
- DD#795 Experience Compression Spectrum: ClawVM operates at episodic level with multi-resolution
- DD#773 SafeHarness: Both argue harness is the right enforcement point
- DD#794 Back-Reveal: Memory/state as attack surface (ClawVM's validated writeback could mitigate)
