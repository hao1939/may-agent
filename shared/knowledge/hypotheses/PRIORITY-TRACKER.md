# Hypothesis Priority Tracker

**Updated**: 2026-04-04 | **Active hypotheses**: 17 | **Tested**: 4/17 | **Resolution ratio**: 4:17

> The system generates hypotheses ~4× faster than it resolves them. **No new hypotheses until 5 more are tested.**

---

## 🟢 Tier 1: Empirically Supported (rely on these)

| ID | Claim | Evidence | Confidence |
|----|-------|----------|------------|
| H-055 | Self-improvement bias: agents modify cosmetically, not substantively | 104 commits, 89.4% additive, 0 deletions. TBSP external support. | HIGH (data solid, mechanism inferred) |
| H-053 | Workflow adoption decays without structural reinforcement | 19.7%→0% over 10 days. Hard numbers. | HIGH (observation solid, cause unclear) |
| H-059 | Cadence skills beat judgment skills for text interventions | EXP-022 + EXP-023 broke 0/20 barrier. | MODERATE-HIGH (n=3 per arm is small) |
| H-014 | Performance gap is delegation quality, not information regime | EXP-007 Phase 1. | MODERATE (only Phase 1 complete) |

## 🟡 Tier 2: Testable Now (highest priority for experiments)

| ID | Claim | Test | Owner | Blocks |
|----|-------|------|-------|--------|
| **H-041** | R (eliminable ratio) predicts workflow effectiveness | **EXP-025** (REDESIGNED — ceiling crisis, asymmetric design) | **coach** | Everything downstream |
| H-056 P1 | Citation context inflates confidence in hypotheses | Design experiment: rate hypotheses with/without cross-refs | coach | — |
| H-054 P1 | RIFT audit: >30% of gym rubrics have validity failures | Manual rubric review (no code) | coach | — |
| H-058 P1 | Agents choose proxy-satisfying responses ≥60% on impossible tasks | Design impossible gym scenarios | coach | — |

## 🔵 Tier 3: Theoretically Sound, Not Yet Testable

| ID | Claim | Why not testable now |
|----|-------|---------------------|
| H-041 | Decision Topology (full theory) | Awaiting EXP-025 results |
| H-043 | Knowledge utilization = P(exists) × P(access) × P(applies) | Framework—needs operationalization |
| H-047 | No forgetting → inverted-U utilization | Needs long-horizon data |
| H-052 | Epistemic fragility has 4 stackable layers | Too meta to test directly |
| H-056 | Cooperative convergence (system-level) | P4 confirmed, other Ps complex |

## ⚪ Tier 4: Keep as Principles (not hypotheses)

| ID | What it really is | Action |
|----|-------------------|--------|
| H-001 | Adversarial QA framing → higher detection | Simple A/B test, should just run it |
| H-002 | Weaker models benefit more from context | Interesting but not actionable for us |
| H-009 | Evaluator drift risk | Monitoring concern, not hypothesis |
| H-034 | Design for session interruption | Design principle |
| H-038 | Transient skills via workspace files | Research pointer |
| H-039 | Decomposition quality bounds MAS quality | Truism, not testable |
| H-058 | Frustration triggers topology rewrite | Testable but needs careful design |

---

## Next Experiment Queue (priority order)

1. **EXP-025** — H-041 prospective validation (READY, coach to run)
2. **EXP-026** — H-054 P1: RIFT audit of gym rubrics (needs design)
3. **EXP-027** — H-001: Adversarial QA A/B test (simplest untested claim)
4. **EXP-028** — H-058 P1: Impossible task response patterns

## Key Insight

The entire theory chain rests on H-041 (Decision Topology). EXP-025 is the single most important experiment we can run. If it fails (< 50% accuracy), we need to seriously rethink the downstream chain (H-043, H-047, H-052, H-054, H-056). If it succeeds, the chain gains its first prospective validation.

---
*Tracker maintained by Bob | Review: REVIEW-2026-04-04-honest-assessment.md*
