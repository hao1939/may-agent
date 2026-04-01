# Deep-Dive DD#482: Multi-Agent Collaboration for Automated Research

**Paper**: arXiv:2603.29632
**Authors**: Shen, Yi, Zhao, Sun, Li, Lin, Shi (UTS / SUSTech / SZTU / Tongji)
**Submitted**: 2026-03-31
**Rating**: ★★★★
**GRA Gaps**: Gap 3 (Integration/Coordination), Gap 5 (Benchmarks)

## Core Contribution

Systematic empirical comparison of multi-agent architectures for automated ML research (autoresearch). Tests **single-agent** vs. **subagent** (parallel + consolidation) vs. **agent team** (sequential experts + handoffs) under fixed computational budgets. Discovers a fundamental **stability-deliberation tradeoff**.

## Key Findings

### 1. The Stability-Deliberation Tradeoff
- **Subagent mode**: Parallel exploration → coordinator merges → high throughput, resilient to crashes, broad/shallow search. Dominant under short time budgets (300s).
- **Agent team mode**: Sequential expert chain → shared codebase → deep theoretical alignment but fragile (multi-author code generation causes crashes). Dominant under extended budgets (600s).
- **Single agent**: Linear trial-and-error, plateaus quickly, baseline.

### 2. Quantitative Results (val_bpb reduction)
- T=300s: Subagent achieves 7 effective improvements over 50 rounds; agent team achieves fewer due to deliberation overhead
- T=600s: Agent team catches up and achieves deeper architectural refactoring
- Subagent's coordinator merge only accepted when merged result strictly surpasses best individual agent

### 3. Crash Rate Analysis
- Agent teams: Higher crash rates due to multi-author code editing on shared worktree
- Subagent: Isolated worktrees prevent cross-contamination
- Engineer agent as fallback mechanism for agent teams (conservative debugging)

### 4. Architecture Details
- **Subagent**: K parallel workers in isolated Git worktrees → coordinator merges successful patches → only if merged > best individual
- **Agent team**: 3 fixed experts (Architecture, Optimizer, Efficiency) in sequential chain, 6 conversation turns, shared worktree → Engineer fallback on crash
- Both share: explicit global memory (program_exp.md), structured Search/Replace patch contract, preflight validation

## Methodology Highlights
- Execution-based testbed with Git worktree isolation (no state contamination)
- Strict wall-clock budgets (300s, 600s)
- GLM-4.7 + GLM-4.6v as agent models
- Deterministic patch contract prevents destructive file overwrites
- Explicit memory prevents catastrophic forgetting

## Connection to DD#481 (Drop the Hierarchy)

**Remarkable convergence of findings:**

| Dimension | DD#481 (Dochkina) | DD#482 (Shen et al.) |
|---|---|---|
| Best protocol | Sequential (hybrid: fixed order, autonomous roles) | Depends on time budget: subagent (short) vs. agent team (long) |
| Key mechanism | Completed predecessor outputs provide factual signals | Agent team handoffs provide sequential context enrichment |
| Failure mode | Shared protocol fails (stale memory, no real-time signals) | Agent team fails under time pressure (crash-prone, slow) |
| Scaling | Sub-linear to 256 agents | Not tested beyond K=3 workers |
| Information flow | Sequential agents see predecessors' completed work | Agent team experts see predecessors' code + summaries |

**Critical insight**: DD#481's Sequential protocol IS essentially DD#482's agent team architecture — both use sequential ordering where each agent sees predecessors' completed work. DD#481 finds it definitively superior; DD#482 finds it superior only with sufficient time. The difference: DD#481 tests knowledge work (quality evaluation), DD#482 tests code generation (execution evaluation). Code generation adds fragility (crashes) that knowledge work doesn't have.

## Connection to DD#479 (Reliability Limits)
DD#479's theorem says multi-agent ≤ centralized Bayes without new exogenous signals. DD#482's subagent mode works because parallel exploration generates genuinely new signals (diverse patches from independent search). Agent team mode works because sequential deliberation enriches context. Both create new information — consistent with DD#479.

## Limitations
1. Only 2 models tested (GLM family)
2. Only 1 task domain (neural network optimization)
3. Small agent counts (1, 3 workers)
4. Fixed role assignment in agent team (no self-organization)
5. 3090 GPU may bottleneck differently than H100

## Significance
Provides the missing execution-based complement to DD#481's evaluation-based findings. Together, they establish that **sequential information flow** is the dominant architecture for multi-agent coordination, with the caveat that **fragile execution environments** (code generation) may favor parallel-then-merge under time pressure.
