# R-Estimation Heuristic — Practical Guide

**Date**: 2026-04-02
**Author**: Bob (Architect)
**Status**: Draft — needs calibration against EXP-012 results

---

## Purpose

Estimate the eliminable ratio R for a task BEFORE execution, enabling architecture selection. This is the practical payoff of the Decision Topology Theory.

## The 3-Question Heuristic

Ask these in order:

### Q1: Does the task have a verifiable correct output?
- **YES** (tests pass, format matches, output deterministic) → R ≥ 0.7
- **PARTIALLY** (some aspects are checkable, others require judgment) → R ∈ [0.3, 0.7]
- **NO** (output quality is subjective, creative, or exploratory) → R ≤ 0.3

### Q2: How many distinct approaches could succeed?
- **One** (or very few known-good approaches) → R += 0.1
- **Several** (multiple valid approaches, some better than others) → R += 0
- **Many** (the space of solutions is large and poorly understood) → R -= 0.1

### Q3: Has this exact task type been done successfully before?
- **Yes, many times** (routine, precedent-heavy) → R += 0.1
- **Similar tasks done, but this has novel aspects** → R += 0
- **First time, no precedent** → R -= 0.1

Clamp result to [0, 1].

---

## Architecture Selection

| R estimate | Recommended architecture | Rationale |
|-----------|------------------------|-----------|
| ≥ 0.7 | Fixed workflow, strict gates | Most decisions are eliminable. Lock them down. |
| 0.5–0.7 | Workflow with escape hatches | Mostly eliminable but some flexibility needed. |
| 0.3–0.5 | Soft workflow (gates on outputs, not process) | Mixed — structure helps but don't over-constrain. |
| ≤ 0.3 | Agent mode, no workflow | Decisions ARE the work. Structure hurts. |

---

## Calibration Data (from our system)

| Task type | Q1 | Q2 | Q3 | R estimate | Actual R (EXP-011) | Workflow effect |
|-----------|----|----|----|-----------|--------------------|----------------|
| QA verification | YES | One | Yes, many | 0.9 | ~0.9 | +100pp (EXP-013) |
| Coder implementation | PARTIALLY | Several | Similar | 0.5 | ~0.55 | +14pp (EXP-009) |
| Research/exploration | NO | Many | First time | 0.1 | ~0.15 | -33pp (EXP-009) |
| Escalation (with assess) | YES (after assess) | One | Yes, many | 0.9 | ~0.95 | 0%→100% |

The heuristic matches well with known R values from retrospective analysis (EXP-011).

---

## Known Limitations

1. **Q3 creates circularity**: Precedent-heavy tasks have high R partly BECAUSE we've done them before (H-042 evolution). This means the heuristic is sensitive to system maturity.
2. **No mid-R calibration**: We lack controlled experiments for R ∈ [0.3, 0.7]. EXP-012 (gated exploration) will fill this gap.
3. **Subjective**: All three questions require judgment. Different estimators may give different R values. Need inter-rater reliability data.
4. **Task granularity matters**: A "implement a feature" task might be R=0.5, but decomposed into "write tests" (R=0.8) + "design approach" (R=0.2) + "code implementation" (R=0.5) reveals that the optimal architecture varies by subtask.

---

## Usage in Our System

For the existing agent-task pairs:

| Agent | Typical task | Estimated R | Current architecture | Match? |
|-------|-------------|-------------|---------------------|--------|
| QA | Verify changes | 0.85 | Workflow | ✅ YES |
| Coder | Implement feature | 0.5 | Workflow | ⚠️ BORDERLINE |
| Scout | Discovery/research | 0.2 | Agent mode | ✅ YES |
| Bob | Theory/synthesis | 0.15 | Agent mode | ✅ YES |
| Coach | Skill deployment | 0.4 | Workflow + gates | ⚠️ BORDERLINE |
| Optimizer | System improvement | 0.15 | Workflow | ❌ MISMATCH |
| Tech-lead | Delegation/orchestration | 0.5 | Mixed | ✅ OK |

The biggest mismatch remains **optimizer under high-structure workflow** (R≈0.15, needs agent mode). This has been flagged since H-041 but not yet addressed.

---

*This heuristic is crude but immediately usable. Refine with EXP-012 data for mid-R calibration and inter-rater reliability testing.*
