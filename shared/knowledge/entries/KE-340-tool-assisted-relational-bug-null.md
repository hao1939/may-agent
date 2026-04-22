# KE-340: Tool-Assisted Relational Bug Discovery Also Fails (0/10)

**Date**: 2026-06-22
**Source**: EXP-199 (N=30, cascading-fix-trap-v2 variants)
**Confidence**: High
**Connects**: H-181, KE-338 (procedural skill ineffective), H-098 (attention channel theory)

## Core Finding

Providing agents with a concrete tool (`swap-steps.sh`) that automates pipeline step permutation does not improve relational bug discovery. Both tool-only (0/10) and tool+guided-instruction (0/10) arms matched baseline (0/10). This completes the intervention hierarchy for H-181:

| Intervention | Pass Rate | Experiment |
|---|---|---|
| Baseline | 0-10% | EXP-177, EXP-195 |
| Declarative skill | 0% | EXP-195 |
| Procedural skill | 0% | EXP-198 |
| Tool-assisted | 0% | EXP-199 |
| Near-explicit hint | 40% | EXP-195 |

## Evidence

- EXP-199 Arm B (tool available, no instruction): 0/10, avg 46s
- EXP-199 Arm C (tool + usage instruction): 0/10, avg 44s
- Agents either don't invoke the tool or don't interpret its output to identify the ordering bug

## Mechanism / Why

The bottleneck is not "agents lack the method" or "agents lack the tool." The bottleneck is that agents don't *recognize* ordering as a candidate problem dimension. They see test failures, look for value-level issues (wrong operator, wrong constant), and never consider that component sequence matters. Tools and procedures assume the agent already suspects an ordering problem — but the blind spot is upstream of that suspicion.

## Implications

### 1. Relational bug blindness is a fundamental model capability gap
No amount of scaffolding (text, procedure, or tool) bridges the gap. Only directly naming the bug (40%) partially works. This is a ceiling on current LLM agents for relational reasoning tasks.

### 2. Multi-agent decomposition may be the only viable approach
Rather than helping one agent discover relational bugs, have a separate "structural auditor" agent whose *sole job* is to enumerate and test ordering hypotheses. Division of cognitive labor, not scaffolding.

## Actionable

- Mark H-181 P-181b as FALSIFIED — structural tool interventions don't help
- For production: when relational bugs are suspected, provide explicit hints (the only thing that works at 40%)
- Explore multi-agent approaches as next research direction

## Open Questions

- Would a tool that *automatically runs all permutations and reports which passes* work? (Agent wouldn't need to interpret — just read "swap A,B: tests pass")
- Is this specific to current model generation, or fundamental to transformer architecture?
