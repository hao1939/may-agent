# Bayesian Hypothesis Scorecard — Eighth Pass

**Date**: 2027-09-28
**Author**: Bob (Architect)
**Supersedes**: SCORECARD-bayesian-2026-06-22.md
**Method**: Bayesian scoring with evidence quality weighting

## Key Changes Since Jun-22 Scorecard

### Experiments Completed (7 new)
- **EXP-236**: Evidence Discovery Intervention A/B — NULL RESULT. Text intervention ("list every file you haven't read yet") produced no measurable effect on judgment scenarios.
- **EXP-241**: Scout Budget Regression baseline — floor/ceiling effect renders A/B impossible (0% or 100% deterministic).
- **EXP-243**: Skill Reframing A/B (H-204 mechanism) — PHASE-0-COMPLETE. Expansion style HURT procedural tasks (-100pp on optimize-deploy-config), HELPED creative tasks (+33pp on cascading-fix-trap). → KE-411.
- **EXP-244**: Defensibility Audit (H-204) — COMPLETE. Only 15% defensible, 20% ambiguous. H-204 REFUTED (below 30% threshold).
- **EXP-246**: Skill Removal Treatment — INCONCLUSIVE (N=1, different scenario sets from baseline).
- **EXP-254**: Post-Guard Activation Audit — COMPLETE. Post-hoc RBE/VAE guards produce 0% behavioral change despite 730 recovery steps. Validates H-205.
- **EXP-255**: Pre-emptive RBE Guard — DESIGNED but blocked (runtime doesn't support pre-execution tool_call events).

### Hypotheses Resolved

**Validated (moved to Tier 1):**
- **H-203** (Blocking > Advisory Gates): VALIDATED. Accumulated evidence from EXP-188, EXP-254. P(H) → 0.92.
- **H-205** (Pre-emptive > Post-hoc Guards): VALIDATED. EXP-188 (+100pp pre-emptive), EXP-254 (0% post-hoc change). P(H) → 0.90. Tier 1.
- **H-075** (Surface Metrics Mask Breakdown): CONFIRMED via EXP-206. 56% of "used" findings had no measurable impact. P(H) → 0.85. Tier 1.

**Refuted:**
- **H-204** (Agreement Trap Eval Inflation): REFUTED. EXP-244 audit: only 15% defensible (threshold was 30%). Our behavioral checks are more precise than DD#880's domain. P(H) → 0.15.

**Archived (stale >90 days, no test planned):**
- H-170, H-171, H-177, H-179 — all proposed but never tested.

### New Hypotheses (H-200+)
| # | Hypothesis | P(H) | Status |
|---|-----------|------|--------|
| H-200 | Skill Description Optimization (CSO) | 0.50 | Proposed |
| H-201 | Adaptive Agent Routing on Failure | 0.55 | Proposed |
| H-202 | Intent-Based Tool Gating (MCP Tax) | 0.50 | Proposed |
| H-203 | Blocking > Advisory Gates | **0.92** | VALIDATED ✅ |
| H-204 | Agreement Trap Eval Inflation | 0.15 | REFUTED ✗ |
| H-205 | Pre-emptive > Post-hoc Guards | **0.90** | VALIDATED ✅ |

### Updated Summary Statistics

| Tier | Count | Change |
|------|-------|--------|
| Tier 1 (≥0.70) | **32** | +4 (H-203, H-205, H-075, H-201) |
| Tier 2 (0.50–0.69) | **16** | -3 (promotions/archives) |
| Tier 3 (<0.50) | **4** | +1 (H-204 refuted) |
| Archived | **32** | +4 (H-170, H-171, H-177, H-179) |
| Refuted | **4** | +1 (H-204) |
| **Total active** | **52** | |
| **Total all-time** | **84** | +6 new |

**Resolved this period**: 4 (H-203 ✅, H-205 ✅, H-075 ✅, H-204 ✗)
**Falsification rate**: 25% (1 of 4 resolved)
**Mean P(H) active portfolio**: 0.69

## Top 3 Priorities for Next Experiments

1. **EXP-255 (H-205 → Pre-emptive RBE)**: Highest impact. Need to either (a) add `tool_call` pre-execution events to workflow engine, or (b) wrap edit() tool with precondition check at the tool layer instead of guard layer. This is an architecture task for tech-lead.

2. **H-073 → EXP-207 (Calibrated Abstention)**: Strong theoretical basis (DD-859/860). Phase 1 (baseline audit) needs no gym. Sample 30 sessions for FM-3.3 false-positive rate.

3. **H-201 (Adaptive Agent Routing)**: Design a cheap test — when coder fails, does re-routing to a different agent with the same task improve outcomes? Check existing failure logs for natural experiments.

## Meta-Observations

### Key finding: Guard architecture matters more than guard logic
H-203 + H-205 together establish a design principle: **WHERE you enforce a rule (pre-execution blocking vs post-hoc recovery) matters more than WHAT the rule says**. This has direct implications:
- Convert all post-hoc guards to pre-emptive where possible
- Stop investing in recovery-step guards — they're wasted LLM calls
- The finish-guard pattern (block completion until precondition met) is the gold standard

### KE-411 (Skill Framing): Nuance beats ideology
EXP-243 showed wholesale constraint→expansion reframing is harmful. The lesson: treat intervention design as empirical, not ideological. "All constraints are bad" (naive KE-403 interpretation) is wrong.

---

*Scorecard: 52 active hypotheses scored. 32 high, 16 moderate, 4 weak. 32 archived, 4 refuted. Bob (Architect) | 2027-09-28*
*Next update: After EXP-255 implementation, or after 5+ new experiments, or 2 weeks.*
