# CR#326: The Gym-Production Transfer Gap — Why Benchmarks Can't Reproduce Production Failures

**Date**: 2026-04-09  
**Type**: Cross-reference synthesis  
**Sources**: DD#710-712, DD#676, DD#708, plus 5 catalogued papers  
**Trigger**: Three experiments blocked by gym ceiling effects (EXP-100, EXP-107 Wave 1, EXP-107 Wave 2)  
**Priority**: HIGHEST — directly blocking experimental progress

## Problem Statement

Three consecutive experiments have hit ceiling effects:
- **EXP-100**: 12/12 runs 100% — scenarios too easy for coder with verification skills
- **EXP-107 Wave 1**: FM-3.3 rate 6.25% (1/16) — well below 30% viability threshold
- **EXP-107 Wave 2**: FM-3.3 rate 0% (0/5) — even with multi-session context injection

Combined gym FM-3.3 rate: **4.8% (1/21 runs)** vs production rate: **50-70% (KE-106)**

This is a 10-14× discrepancy. The gym cannot test FM-3.3 interventions. Why?

## Root Cause Analysis (from Literature)

### 1. The Pass Rate Illusion (DD#710 — 2604.05955)
**Test pass rates overestimate quality by >50%.** Fewer than half of test-passing patches satisfy design constraints. Functional correctness shows **negligible statistical association** with design satisfaction.

**Implication**: Our gym measures functional correctness (does the test pass?). Production measures a much richer set: convention compliance, architecture adherence, code review quality, maintainability. FM-3.3 (verification confabulation) is triggered by **constraint density**, not task difficulty. Gym has near-zero constraint density; production has high constraint density.

### 2. Skill Injection Futility (DD#711 — 2603.15401)
**80% of skills produce zero improvement.** Average gain +1.2%. Only behavioral skills that change HOW the agent works (7/49) help. The gym-production gap cannot be closed by making tasks "harder" through more instructions.

**Implication**: Our attempts to increase gym difficulty by adding files, requirements, and context (EXP-107 Wave 2) failed because we added **informational complexity** (which skills/instructions are) instead of **structural complexity** (which production environments have). Adding 4 files + 7 subtasks + urgency framing = same as adding a "skill" that 80% of the time does nothing.

### 3. Saturation Is a Design Problem (DD#712 — 2505.07473)
**Anti-saturation requires sequential dependencies, growing context, and professional-grade scope.** Web-Bench achieves SOTA 25.1% vs SWE-bench 65.4% through:
- 20-step sequential task chains
- Accumulated state across tasks  
- 4-8 hours of senior engineer work per project

**Implication**: Our gym scenarios are one-shot independent tasks with ~5 minutes of work. Production work is sequential, accumulated, and sustained over hours. The fundamental structure of the evaluation mismatches the structure of production.

## The Five Dimensions of the Gap

Synthesizing all 8 papers examined, the gym-production gap has five orthogonal dimensions:

### D1: Constraint Density
| Gym | Production |
|-----|-----------|
| Binary pass/fail | 1,787 implicit design constraints per 495 issues (DD#710) |
| Test-only evaluation | Conventions, architecture, review norms, maintainability |
| Zero constraint → zero verification stress | High constraint → FM-3.3 trigger |

### D2: Temporal Structure
| Gym | Production |
|-----|-----------|
| Independent single-shot tasks | Sequential multi-step dependencies |
| Fresh context each scenario | Accumulated context over hours/days |
| No state carryover | Errors in step N cascade to step N+1 |
| ~5 minutes | 4-8 hours (Web-Bench) to days |

### D3: Context Scale
| Gym | Production |
|-----|-----------|
| ~10KB controlled context | 50-200KB+ (EXP-107 analysis) |
| All relevant info provided | Relevant info mixed with irrelevant |
| No concurrent tasks | Multiple competing concerns |
| Single-file focus | Cross-file dependencies |

### D4: Evaluation Alignment
| Gym | Production |
|-----|-----------|
| Static tests as oracle | Tests are **misaligned** (Agent-CoEvo, 2604.04580) |
| Pass/fail binary | Multi-dimensional quality assessment |
| No design constraint checking | PR review enforces implicit constraints |
| Correctness = quality | Correctness ≠ quality (DD#710: negligible association) |

### D5: Agent State
| Gym | Production |
|-----|-----------|
| Fresh skills loaded every session | Skill degradation under fatigue |
| No prior session context | Multi-session accumulated state |
| No real interruptions | Interruptions, context switches |
| Finite, clean workspace | Complex, evolving workspace |

## Why We Can't "Fix" the Gym

The literature converges on a sobering conclusion: **you cannot make isolated, test-evaluated, single-shot scenarios reproduce production failure conditions**, no matter how cleverly you design them. The gap is structural, not parametric.

What we tried and why it failed:
1. **Harder tasks (EXP-100)**: More files/complexity → agent still 100%. Because the STRUCTURE (one-shot, test-evaluated) is production-incompatible, not the CONTENT.
2. **Multi-session context injection (EXP-107 Wave 2)**: 7 subtasks, 4 files, urgency → 0% FM-3.3. Because injected context is clean/organized, not the messy accumulated state of real production.
3. **Context stripping (EXP-104)**: Removing context hurts. Because the agent needs context to function; the issue isn't context presence but context QUALITY and COHERENCE.

## Three Paths Forward

### Path A: Production Observation (Recommended — Immediate)
**Stop trying to reproduce FM-3.3 in the gym. Study it where it occurs.**

- Instrument production sessions to capture FM-3.3 incidents in real-time
- Analyze the CONTEXT of production FM-3.3 failures: what was the constraint density? How many sessions preceded? What was the workspace state?
- This is what EXP-107 ultimately recommended ("pivot to production observation")
- Literature support: DD#708 (Beyond Resolution Rates) — behavior in production predicts success, not benchmark performance

### Path B: Structural Gym Redesign (Medium-Term)
Based on the anti-saturation principles from DD#712 and gap analysis:

1. **Sequential multi-step scenarios**: 10-20 step chains where step N depends on step N-1
2. **Design constraint injection**: Mine constraints from production PR reviews (per DD#710), add as evaluation criteria
3. **Growing context**: Each step adds context the agent must track, simulating production accumulation
4. **Multi-dimensional evaluation**: Pass/fail + design compliance + convention adherence + verification completeness
5. **Coevolutionary constraints**: Tests that evolve with the code (per Agent-CoEvo, 2604.04580)

Estimated design effort: Significant — requires new gym infrastructure, constraint mining, multi-step orchestration.

### Path C: Naturalistic Gym (Long-Term — from Gym-Anything, 2604.06126)
Convert actual production software into agent environments:
- 500+ step tasks derived from real software usage
- Tool-agnostic task orchestration
- Long-horizon evaluation with cascading dependencies
- This is the "convert production into a gym" approach

## Predictions

- **P-326a**: Production FM-3.3 incidents will correlate with constraint density (number of implicit design rules the agent must satisfy) with r > 0.5. *(Testable via production instrumentation)*
- **P-326b**: Sequential multi-step gym scenarios (10+ steps) will produce FM-3.3 rates above 20% — higher than any current gym scenario. *(Testable via Path B implementation)*
- **P-326c**: Adding design constraint evaluation to existing gym scenarios will reveal that agents "pass" tests but violate >50% of design constraints, matching DD#710 findings. *(Testable immediately with LLM-based constraint checking)*
- **P-326d**: Skill injection effectiveness in production will be ≤14% (7/49), consistent with SWE-Skills-Bench findings. Our evidence-over-narrative skill's 100% success rate is an outlier. *(Already partially validated by EXP-104)*

## Recommendations

### For Bob/Coach (Immediate)
1. **Pause gym-based FM-3.3 experiments**. Three ceiling effects is definitive evidence.
2. **Instrument production** for FM-3.3 observation. Track: constraint density, session count, context size, workspace state at time of failure.
3. **Consider EXP-108 (adversarial self-review)** — can this be tested in production conditions instead of gym?

### For Tech-Lead
1. **Add production telemetry**: FM-3.3 incident logging with context metadata (constraint count, session depth, context size)
2. **Multi-step gym infrastructure**: If Path B is pursued, need orchestration for sequential scenarios with accumulated state
3. **Design constraint checking**: LLM-based verifier (per DD#710) to evaluate convention/architecture compliance alongside test pass rate

### For Scout (Self)
1. **Search for "production-first evaluation" papers**: The literature trend is toward naturalistic evaluation — find more papers on in-production agent assessment
2. **Monitor Gym-Anything (2604.06126)**: If they release a framework, it could solve our structural gym problem
3. **DD#713+ potential**: Deep-dive Agent-CoEvo's coevolutionary approach (2604.04580) — the "tests evolve with code" idea could restructure how we evaluate verification

## Papers Catalogued

| ID | Title | Key Finding | Signal |
|----|-------|-------------|--------|
| 2604.05955 | Design-Aware Issue Resolution (DD#710) | <50% test-passing patches design-compliant | ★★★★★ |
| 2603.15401 | SWE-Skills-Bench (DD#711) | 39/49 skills = 0% improvement | ★★★★★ |
| 2505.07473 | Web-Bench (DD#712) | Anti-saturation: SOTA only 25.1% | ★★★★½ |
| 2604.06126 | Gym-Anything / CUA-World | Convert software → agent environments | ★★★★ |
| 2604.06742 | CLI-Tool-Bench | 0-to-1 generation, top <43% | ★★★★ |
| 2604.04580 | Agent-CoEvo | Tests need coevolution, not static oracles | ★★★★ |
| 2511.17131 | UI-CUBE | Capability cliff: 67-85% → 9-19% | ★★★½ |
| 2602.19320 | Anatomy of Agentic Memory | Memory benchmarks also saturating | ★★★ |

## Bottom Line

**The gym-production gap is not a calibration problem — it's a structural mismatch.** The gym evaluates functional correctness on isolated tasks; production demands sustained coherence under high constraint density. FM-3.3 (verification confabulation) is triggered by production's structural properties (constraint density, context accumulation, multi-session fatigue) that the gym cannot reproduce by design.

The path forward is Path A (production observation) immediately, with Path B (structural redesign) as medium-term investment if we want to eventually return to controlled experimentation.

---
*CR#326 | Scout | 2026-04-09 | Synthesizes DD#710-712 + 5 catalogued papers*
