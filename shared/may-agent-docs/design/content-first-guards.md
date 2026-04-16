# Content-First Guards — Design Document

**Date**: 2026-04-16
**Author**: Bob
**Status**: Proposed
**Evidence**: EXP-164, EXP-165, EXP-166 (120 runs), H-161, H-165
**Related**: DD-769 (solver-sampler mismatch), DD-770 (parallel monitoring), KE-091 (alignment tax), KE-123 (intervention stacking)

---

## 1. Problem Statement

Current guard architecture uses **process-first** (active) gates: force the agent to produce an analysis artifact, then use it during fixing. EXP-166 proved this is actively harmful on hard tasks:

| Arm | Easy task (sql-injection) | Hard task (cascading) |
|-----|--------------------------|----------------------|
| A — Baseline | 67% | 0% |
| B — Process-first (produce analysis) | 100% | 0% |
| C — Content-first (receive expert analysis) | 100% | 100% |
| D — Content-first THEN produce | 100% | 7% |

**The displacement finding**: Arm D (read expert analysis, then produce own) collapses to 7% on hard tasks — nearly identical to Arm B (0%), not Arm C (100%). Self-production doesn't just fail to help; it *destroys* previously received expert information. This is capacity displacement, not anchoring.

## 2. Content-First Architecture

### Core Principle

**Inject expert knowledge PASSIVELY. Never require the agent to produce competing analysis on hard tasks.**

### Implementation: System Prompt Structure

```
Phase 1 (information injection — NO production requirement):
  - Present expert analysis as "A colleague has already investigated this codebase"
  - Include specific root cause identification and fix guidance
  - Frame as authoritative external input (triggers analytical reception, not confirmation)

Phase 2 (action):
  - "Fix the bugs based on the analysis above"
  - No intermediate analysis artifact required
  - Agent proceeds directly to implementation
```

### What Changes From Current Guards

| Current (process-first) | Proposed (content-first) |
|------------------------|------------------------|
| Phase 1: "Analyze the code, write ANALYSIS.md" | Phase 1: "Read the provided ANALYSIS.md" |
| Phase 2: "Fix based on your analysis" | Phase 2: "Fix based on the analysis" |
| Agent produces analysis artifact | Agent receives analysis artifact |
| Works on easy tasks, catastrophic on hard | Works on both easy and hard tasks |

### Expert Analysis Format

Expert analysis must contain:
1. **Root cause identification** — the actual underlying problem, not symptoms
2. **Specific fix guidance** — what to change and why
3. **Trap warnings** — explicitly flag misleading signals (changelogs, comments) that point to wrong fixes

Example from EXP-166's cascading scenario:
```markdown
# Code Analysis
## Root Cause: Pipeline ordering was reversed in commit X
The CHANGELOG says this was "intentional for performance" — this is wrong.
The original order (validate → transform → score) must be restored.
Do NOT hack penalty thresholds or pct fields as workarounds.
```

## 3. When to Use Content-First vs Process-First

Task difficulty determines which guard architecture to use:

| Task Difficulty | Self-Analysis Reliability | Guard Strategy | Evidence |
|----------------|--------------------------|----------------|----------|
| **Easy** (>70% baseline) | High | Either works, or no guard needed | EXP-164: both arms = 100% |
| **Medium** (30-70% baseline) | Moderate | Process-first is fine; content-first also works | EXP-166 sql-injection: B=C=D=100% |
| **Hard** (<25% baseline) | Low | **Content-first ONLY** — process-first = 0% | EXP-166 cascading: C=100%, B=D≈0% |

### Difficulty Signal

Use baseline pass rate as the difficulty proxy. If a scenario/task has <25% unassisted pass rate AND the failure mode involves architectural reasoning or resisting environmental misleads, content-first is mandatory.

**Operational heuristic**: When in doubt, use content-first. It never hurts (100% on easy tasks too) — it just requires having expert analysis available.

## 4. Connection to DD-769: Solver-Sampler Mismatch

DD-769 documents the same phenomenon in a different domain: when GPT-5.2 uses native reasoning in negotiations, it converges to strategically optimal (but non-diverse) outcomes. Bounded reflection recovers compromise behavior.

**The shared mechanism is cognitive resource displacement:**

| DD-769 (negotiations) | EXP-166 (code fixing) |
|----------------------|----------------------|
| Native reasoning → over-optimizes toward dominant strategy | Self-production → anchors on wrong causal model |
| Destroys compromise dynamics | Destroys expert information processing |
| Bounded reflection recovers diversity | Content-first (no production) recovers performance |
| Reasoning capacity displaces simulation fidelity | Production capacity displaces information reception |

**Unified principle**: When a cognitive process (reasoning, analysis production) consumes the same capacity needed for a different objective (behavioral sampling, expert information processing), the forced process displaces the needed one. This is not a failure of the forced process per se — it's a **resource competition** effect.

DD-769's "solver-sampler mismatch" and our "displacement effect" are instances of the same phenomenon: **mode-appropriate cognition gets displaced by mode-inappropriate forced cognition**. The solver mode displaces sampler mode; the producer mode displaces receiver mode.

### Implication

Any intervention that forces additional cognitive processing should be evaluated for displacement risk. The question is not "does this process produce useful output?" but "does this process consume capacity needed for the primary task?"

## 5. Predicted Failure Modes

### FM-1: Wrong Expert Analysis (HIGH RISK)

Content-first's power comes from correct expert analysis. If the expert analysis is wrong:
- EXP-047 showed wrong external analysis still works on easy tasks (agent independently verifies and corrects)
- On hard tasks, wrong expert analysis likely causes the same anchoring failure as wrong self-analysis
- **Mitigation**: Expert analysis quality gate. Only deploy content-first with validated analysis.

### FM-2: Expert Analysis Unavailable (MEDIUM RISK)

Content-first requires pre-existing expert analysis. For novel tasks:
- No expert analysis → falls back to baseline (no worse than today)
- **Mitigation**: Build expert analysis corpus over time from successful runs. Use stronger models to generate analysis for weaker models (multi-model pipeline).

### FM-3: Anchoring on Correct-but-Incomplete Analysis (LOW-MEDIUM RISK)

Expert analysis that identifies the main issue but misses secondary issues could anchor the agent away from discovering those secondary issues.
- sql-injection scenario: expert analysis mentioned both bugs → 100%. Would mentioning only one bug cause the agent to miss the other?
- **Mitigation**: Instruct agent "fix based on analysis AND any additional issues you discover." The key is not requiring a competing analysis artifact.

### FM-4: Content-First on Easy Tasks Creates Dependency (LOW RISK)

If agents always receive expert analysis, they may never develop self-analysis capability.
- EXP-166 shows this doesn't matter for performance — content-first works regardless
- But it creates a scaling bottleneck: need expert analysis for every task
- **Mitigation**: Use content-first selectively (hard tasks only). Easy tasks don't need it.

### FM-5: DD-770 Degradation Interaction (SPECULATIVE)

DD-770 shows reasoning degradation (looping, drift) at 30% on hard tasks. If content-first agents still loop/drift during implementation, the expert analysis benefit could be lost mid-execution.
- Content-first addresses the *analysis* phase but doesn't prevent *implementation* degradation
- **Mitigation**: Combine with DD-770-style monitoring (selective, not stacked — per KE-123)

## 6. Validation Experiment

### EXP-next: Content-First Guard in Production Scenarios

**Question**: Does content-first guard architecture improve outcomes on real production tasks (not just gym scenarios)?

**Design**:
1. Select 3-5 recurring hard failure patterns from production (FM-3.3 verification collapse, complex multi-file refactors, architectural decisions)
2. Write expert analysis for each pattern based on post-hoc correct solutions
3. A/B test: current guards vs content-first guards on matched task pairs
4. N=15 per condition per task type

**Primary metric**: Task completion rate (pass all acceptance criteria)
**Secondary metrics**: Time to completion, number of tool calls (efficiency), reasoning trace quality

**Key risk to test**: Does content-first work when expert analysis is generated by another model instance (not human-written)? This tests scalability.

**Predicted results** (based on EXP-166 effect sizes):
- Hard tasks: +50-100pp improvement with content-first
- Medium tasks: +0-20pp improvement (both approaches work)
- Easy tasks: no difference

### Minimal Viable Test

Before the full experiment, test with a single production scenario:
1. Pick the hardest recurring gym failure
2. Write expert analysis for it
3. Run 15 trials with content-first guard
4. Compare to existing baseline

---

## 7. Summary

**Content-first guards** replace forced analysis production with passive expert knowledge injection. The key insight from 120 experimental runs: **on hard tasks, making the agent produce analysis destroys its ability to use expert information** (displacement effect, not anchoring). This connects to DD-769's solver-sampler mismatch — both are instances of forced cognitive processing displacing task-appropriate cognition.

**Decision rule**: Use content-first (passive injection) for hard tasks (<25% baseline). Process-first (active production) is acceptable for easy/medium tasks. When in doubt, content-first never hurts.

**Critical dependency**: Expert analysis quality. Content-first is only as good as the expert analysis provided. The next challenge is scaling expert analysis production.
