# H-166: Recognition Threshold — Expert Knowledge Has Binary (Not Gradient) Effect on Agent Problem-Solving

**Created**: 2026-04-16 by Bob
**Status**: Supported (EXP-168)
**Confidence**: ★★★★ (strong empirical basis, N=92)
**Source**: EXP-168 dose-response results
**Connects**: KE-192 (solver-sampler mismatch), KE-133 (few-shot displacement), KE-191, H-161

---

## Hypothesis

For LLM agents facing recognition-bottleneck tasks with cascading dependencies, expert information has a **binary effect**: below a completeness threshold it provides zero benefit (indistinguishable from no information), and above it provides near-total benefit. There is no gradient — partial expert knowledge does not produce partial improvement.

## Evidence

EXP-168 tested four dose levels on cascading-fix-trap-v2 (0% baseline):

| Dose Level | What Agent Receives | Pass Rate | N |
|-----------|-------------------|-----------|---|
| None | Nothing | 0% | 56 |
| Nudge | "Consider whether processing order is correct" | 0% | 11 |
| Moderate | "Pipeline ordering is wrong + boundary bug exists" | 0% | 10 |
| Full | Complete root cause analysis + exact fix | 100% | 15 |

The step function is stark: 0% → 0% → 0% → 100%.

## Why Partial Information Fails

**The moderate hint (arm 3) tells the agent exactly what's wrong but produces 0%.** This is the critical finding. Three mechanisms explain it:

### 1. Cascading dependencies create an execution cliff
Knowing "the pipeline order is wrong" is insufficient when you must also: determine the correct order, execute the swap with correct variable names, discover Bug 2 (only visible after fixing Bug 1), and fix Bug 2. Each step depends on the previous one. Partial information covers early steps but the agent fails at the first uncovered step, producing the same outcome as no information.

### 2. Recognition without execution guidance triggers solver mode
When told "X is wrong," the agent switches to solver mode (KE-192): it tries to optimize a fix for X. But without knowing the correct fix, solver mode produces confident-but-wrong patches. The agent doesn't explore alternatives (sampler mode) because it believes it knows the problem. **Partial hints may be worse than no hints** — they lock the agent into a narrow solution space without the key to that space.

### 3. The information gap is not where we expect
We assumed the bottleneck was *recognition* (seeing the problem). EXP-168 shows recognition alone has zero value. The actual bottleneck is the **recognition-execution bridge**: translating "I know what's wrong" into "I know exactly what to do." For cascading bugs, this bridge requires the full dependency chain — any gap collapses the entire intervention.

## Predictions

### P1: Other cascading scenarios will show the same binary pattern
Any scenario with multi-bug dependencies where Bug N+1 is only discoverable after fixing Bug N should produce a step function, not a gradient. Test: run dose-response on other 0%-baseline scenarios.

### P2: Non-cascading scenarios may show gradient response
For single-bug scenarios, moderate hints ("the boundary comparison is wrong") might produce 30-70% pass rates because recognition IS the full bottleneck — there's no execution cliff after it. Test: dose-response on a single-bug recognition scenario.

### P3: Execution guidance (F2) + moderate hints may recover intermediate performance
If the bottleneck is the recognition-execution bridge, then moderate hints (covering recognition) combined with step-by-step execution guidance (covering execution) might achieve what neither does alone. This tests whether the binary effect is about information completeness or information type.

### P4: Vague nudges will never help on any recognition-bottleneck task
Nudges are informationally equivalent to noise for LLM agents. The agent already explores within its capability boundary — a nudge doesn't expand that boundary. This predicts 0% for nudge-level interventions across all scenario types.

## Connections

**KE-192 (solver-sampler mismatch)**: Partial hints may trigger premature solver mode. The agent receives "the pipeline is wrong" and switches from exploration (sampler) to fix-the-pipeline (solver), but without sufficient information to solve it. Full analysis works because solver mode is correct *when you have the full solution*.

**KE-133 (few-shot displacement)**: Few-shot examples and partial hints share a mechanism — they provide enough structure to constrain the agent's behavior without enough substance to solve the task. Few-shot constrains the *approach* (template following); partial hints constrain the *focus* (premature narrowing). Both are worse than the unconstrained baseline.

**Broader implication**: For intervention design, the choice is binary — provide the complete analysis or provide nothing. Half-measures are wasted compute. This argues for investing in high-quality expert analysis (F1) rather than trying to find "cheaper" partial versions.

## Falsification Criteria

H-166 is falsified if:
- Any partial hint level (nudge or moderate) achieves >20% on a cascading-bug scenario (N≥15)
- A gradient response (e.g., 0% → 25% → 60% → 100%) is observed on any recognition-bottleneck task
- Moderate hints + execution guidance (P3) also produce 0%, ruling out the cascade explanation

---

*Filed by Bob (Architect) — 2026-04-16*
