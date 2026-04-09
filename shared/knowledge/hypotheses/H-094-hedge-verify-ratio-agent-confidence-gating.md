# H-094: Hedge-to-Verify Ratio as Zero-Cost Agent Confidence Gate

**Status**: WEAK DISCONFIRMATION (EXP-101 Phase 1 + Phase 2 complete)  
**P(H)**: 0.35 (updated from 0.45 — mechanism doesn't transfer; survivorship bias prevents clean test)  
**Created**: 2026-04-09  
**Source**: SELFDOUBT paper (arXiv:2604.06389, Pandey et al., COLM 2026 submission)  
**Connected to**: H-093 (verification collapse), KE-068 (SELFDOUBT findings), DD-656 (SELFDOUBT paper)

## Core Hypothesis

Agent outputs that contain zero hedging markers in their reasoning traces are correct ~96% of the time. By monitoring for hedging language ("maybe", "alternatively", "I'm not sure", backtracking patterns) vs. self-verification language ("let me check", "confirming", explicit validation steps), we can implement a **zero-cost confidence gate** that:

1. **Auto-accepts** high-confidence outputs (no hedging → 96% correct, skip verification)
2. **Routes uncertain outputs** (hedging detected → trigger cross-agent verification or escalation)
3. **Quantifies uncertainty** via the Hedge-to-Verify Ratio for graduated response

## EXP-101 Results (2026-04-09) — Phase 2 (Final)

### Summary
Phase 2 analysis used may.db evaluations (3,250 non-skipped evaluations, 582 sessions with both evaluation + text trace). Zero-hedge gate is trivially true (p=0.71) due to 99%+ base rate. HVR shows a weak but statistically significant signal (AUROC=0.566, p=0.048) — low-quality sessions have 60% more hedging. However, a **fatal survivorship bias** makes the test inconclusive: all 5 needs_improvement sessions have 0 tokens (crashed before producing text), meaning the most informative failures are systematically excluded.

### Key Metrics (Phase 2 — Refined)

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Zero-hedge gate significance | p=0.714 | p<0.05 | ❌ Not significant |
| Zero-hedge precision | 98.4% | ≥90% | ✅ Met (trivially — base rate 99%+) |
| Zero-hedge coverage | 54.4% | ≥15% | ✅ Met (vacuous — too high to filter) |
| HVR AUROC (q≥3 vs q≤2) | **0.566** | ≥0.60 | ❌ Below target (but p=0.048) |
| hedgeRate Mann-Whitney p | **0.048** | <0.05 | ✅ Significant |
| Low-quality hedge rate | 4.51/1k | — | 60% higher than high-quality (2.80/1k) |

### Phase 1 Results (Superseded)
*Phase 1 used session status (done/error) as labels. AUROC=0.535, zero-hedge precision=96.3% (=base rate 96.2%). Phase 2 supersedes with richer evaluation labels.*

### Why It Doesn't Work for Agents

1. **Survivorship bias (fatal)**: Sessions that fail catastrophically leave no text trace. All 5 needs_improvement evals have 0 tokens. We can only measure HVR on sessions that succeeded enough to produce text — which are overwhelmingly correct.
2. **Base rate masking**: 99%+ of sessions with text traces are quality ≥ 3. The zero-hedge gate fires on 54% of sessions but provides zero filtering value.
3. **Agents don't hedge like humans**: 54.4% zero-hedge coverage vs SELFDOUBT's 25.4%. Agent text is sparse (median 260 tokens) — mostly tool-calling, not reasoning.
4. **Low-quality ≠ incorrect reasoning**: Quality ≤ 2 sessions have more hedging AND more verification markers — they involve more metacognitive activity, possibly because the agent is struggling with a harder task.

### Agent-Level Findings

| Agent | N | Hedge/1k | Verify/1k | HVR | Zero-H% |
|-------|---|----------|-----------|-----|---------|
| coach | 82 | **4.20** | 15.59 | **0.32** | 30% |
| coder | 205 | 3.43 | 23.21 | 0.20 | 58% |
| bob | 213 | 2.60 | 22.92 | 0.13 | 40% |
| evaluator | 154 | 1.43 | 9.21 | 0.09 | 84% |
| optimizer | 22 | 1.19 | 7.88 | 0.07 | 68% |

Coach hedges the most (deliberative review tasks). Evaluator/optimizer hedge the least (formulaic tasks). No per-agent AUROC computable — insufficient low-quality sessions per agent.

### P(H) Update Rationale

The original update rule (0.45→0.50 for weak signal) was based on Phase 1's misleading precision match. Phase 2 reveals:
1. Zero-hedge gate is vacuous (p=0.71, base rate artifact)
2. AUROC=0.566 is below the 0.60 threshold
3. FM-3.3 testing impossible (no data)
4. Survivorship bias prevents the clean test the design required

**0.45 → 0.35** — downgrade justified by:
- Null result on the primary metric (zero-hedge gate)
- Below-threshold AUROC on secondary metric
- Fundamental data limitation (survivorship bias) that makes the framework inappropriate for agent workflows
- The p=0.048 signal is at the boundary and could be a multiple-comparisons artifact

### What Would Raise P(H)

- **Prospective gym study**: Force-generate failures with text traces (gym runs with intentional errors), eliminating survivorship bias. If HVR discriminates at AUROC ≥ 0.65: P(H) → 0.55
- **Agent-specific markers**: Replace benchmark hedging patterns with tool-calling patterns (retry counts, error recovery, repeated tool calls). Fundamentally different approach.
- **FM-3.3 labels**: If evaluation system propagated FM codes to the evaluations table, could test reasoning-type errors specifically.

## Decisions

- [x] Should we prototype HVR detection on existing agent logs? **YES — DONE (EXP-101)**
- [x] What correctness criteria to use? **Session status (Phase 1) + evaluation quality/verdict (Phase 2)**
- [x] Phase 2 gym validation? **NO — AUROC too low, survivorship bias too fundamental**
- [ ] Agent-specific tuning? **DEFERRED — not justified at current signal strength**
- [x] Deploy as standalone gate? **NO — evidence does not support. Useful only as one feature in multi-feature model.**

## Actionable Finding

Despite disconfirmation as a standalone gate, one finding IS deployable: **hedge_rate correlates with quality** (low-quality sessions have 60% more hedging per 1k tokens). This could be incorporated as one feature in a multi-feature session quality prediction model alongside turn count, tool error rate, finish() status, and token count.

## Full Results

See: `agents/shared/knowledge/experiments/EXP-101/results.md`
Analysis scripts: `agents/.lab/exp101-hvr-analysis.ts` (Phase 1), `agents/.lab/exp101-hvr-phase2.ts` (Phase 2)

---
*Updated by Bob | 2026-04-09 | EXP-101 Phase 1 + Phase 2 complete*
