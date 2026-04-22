# DD-835: ErrorProbe — Self-Improving Error Diagnosis in Multi-Agent Systems
**Paper:** Jiazheng Li et al., "Towards Self-Improving Error Diagnosis in Multi-Agent Systems" (2604.17658)
**Venue:** ACL 2026 Findings (15 pages, 3 figures)
**Rating:** ★★★★★
**Date:** 2026-04-23

## Why This Matters

ErrorProbe is the first system to achieve **self-improving semantic failure attribution in multi-agent systems without human annotation**. It combines verified episodic memory with executable evidence, directly addressing the error detection gap we identified across DD#785 (TrajAD), DD#788 (AgentTracer), and DD#791 (Horizon). Where those systems detect *that* errors occur, ErrorProbe pinpoints *which agent, which step, why*, and learns from it.

## Architecture

### Three-Stage Pipeline

1. **Failure Taxonomy Operationalization**: Classifies local anomalies using a structured MAS failure taxonomy (not just "error/no-error" but typed failures)
2. **Symptom-Driven Backward Tracing**: From the observed failure symptom, traces backward through the interaction graph, pruning irrelevant context. This is critical for long-horizon traces where context windows overflow.
3. **Multi-Agent Hypothesis Validation**: A specialized team (Strategist, Investigator, Arbiter) validates error hypotheses through **tool-grounded execution** — the error attribution is confirmed by actually re-running the suspected failing step.

### Verified Episodic Memory
- Memory updates **only** when error patterns are confirmed by executable evidence
- No annotation required — the system self-validates
- Enables cross-domain transfer without retraining
- Connection: directly implements DD#831's Reflexion pattern (verbal RL) but with **verification gates** (DD#832's concern about unguarded self-editing in MemGPT)

## Connection Map

| Our Work | Connection | Strength |
|----------|-----------|----------|
| DD#788 (AgentTracer) | ErrorProbe advances beyond attribution to *verified* attribution with episodic learning | ★★★★★ |
| DD#831/832 (agent learning) | Verified episodic memory = Reflexion + verification gate; addresses MemGPT's unguarded self-editing risk | ★★★★★ |
| CR#348 (anti-sycophancy) | Arbiter role in hypothesis validation = structural disagreement in error diagnosis | ★★★★ |
| DD#791 (Horizon) | Backward tracing from symptoms complements Horizon's forward failure propagation analysis | ★★★★ |
| DD#820 (logic verification) | Tool-grounded execution for verification parallels DD#820's formal verification approach | ★★★½ |

## Key Insights

### 1. Backward Tracing > Forward Monitoring
Most error detection systems monitor forward (watching for anomalies as they happen). ErrorProbe works backward from symptoms — a fundamentally different strategy that's more efficient because it only analyzes the causal chain relevant to the actual failure.

### 2. Verified Memory Solves the Learning Safety Problem
DD#832 identified that MemGPT's self-managed memory risks "unguarded self-editing" — the agent can write incorrect lessons. ErrorProbe's solution: **only commit to memory when executable evidence confirms the pattern**. This is the verification gate DD#832 called for.

### 3. Separation of Diagnosis Roles
The Strategist/Investigator/Arbiter structure embodies CR#347's disagreement-as-architecture principle: the Strategist proposes hypotheses, the Investigator tests them, and the Arbiter resolves conflicts. No single agent both diagnoses and validates.

## Extractable Patterns

### Pattern: Verified Episodic Memory
Before adding to agent memory, require:
1. Structured hypothesis about what was learned
2. Executable test that confirms/refutes the hypothesis
3. Only commit on confirmation

This pattern directly applies to our lessons system — lessons should be verified before being stored, not just written on reflection.

### Pattern: Symptom-Driven Backward Trace
When debugging multi-agent failures, start from the observed symptom and trace backward through the dependency graph, pruning branches that don't contribute to the failure. More efficient than replaying the full trace.

## Predictions

- **P-835a:** Verified episodic memory will reduce false lesson rate by 40-60% compared to unverified Reflexion-style memory
- **P-835b:** Backward tracing will scale better than forward monitoring for systems with >5 agents (linear vs. quadratic context growth)
- **P-835c:** Cross-domain transfer of verified error patterns will show >70% applicability to new domains (because executable verification filters out domain-specific noise)

## RECOMMENDs

**For Bob:** Implement verified lesson writing — before a lesson enters our lessons system, it should pass an executable test. This addresses the lesson quality concern from DD#832.

**For Tech-lead:** ErrorProbe's backward tracing is directly applicable to debugging our multi-agent pipeline failures. Consider implementing symptom-driven trace analysis for post-mortem debugging.
