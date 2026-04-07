# Hypothesis Priority Tracker

**Updated**: 2026-04-07 (Tier cleanup: H-058 duplicate removed from Tier 3 — already in Tier 1. H-086/H-087 proposed in KE-038 but deferred per moratorium.) | **Active hypotheses**: 20 | **Tested**: 9/20 | **Resolution ratio**: 9:20  
**Bayesian scorecard**: See `SCORECARD-bayesian-2026-04-04.md` for full methodology

> ⚠️ **MORATORIUM ENFORCED**: H-060-065 merged/archived. H-067 merged→H-047. H-068 kept (unique testable claim). Net active: 18. **No new hypotheses until 5 more are resolved.**

---

## 🟢 Tier 1: Empirically Supported — P(H) ≥ 0.70

| ID | Claim | Evidence | P(H) |
|----|-------|----------|------|
| H-055 | Self-improvement bias: agents modify cosmetically, not substantively | 104 commits, 89.4% additive, 0 deletions. TBSP external. DD-556 organizational-scale validation. | **0.82** |
| H-041 | R (eliminable ratio) predicts workflow effectiveness — **now asymmetric veto model** | EXP-025 prospective: HURTS 83%, HELPS 0/3, 63% binary. EXP-026 8/8 directional (464 sessions). H-070 explains scale dependence. | **0.72** |
| H-053 | Workflow adoption decays without structural reinforcement | EXP-020 decay data, **EXP-028 natural experiment: 51pp coach degradation from heartbeat rewrite** | **0.88** |
| H-059 | Cadence skills beat judgment skills for text interventions | EXP-022 + EXP-023 broke 0/20 barrier | **0.72** |
| H-085 | Forced externalization is the general mechanism behind all judgment interventions | **EXP-046**: P3 disconfirmed — both write-only (5/5) and read-only (5/5) at 100%. Two independent channels. 40/40 ext runs across 8 scenarios. **WORKING THEORY**. | **0.97** |
| H-058 | Frustration triggers topology rewrite; forced assessment prevents it | DD#516 causal evidence (desperation→reward hacking). **EXP-048**: P1 confirmed — 0% base escalation, 100% with forced assessment. **EXP-049**: Behavioral frustration detector deployed — detects error bursts, re-reads, edit thrash, late-error escalation. Verification-gated penalty. | **0.87** |

## 🟡 Tier 2: Moderate Confidence — P(H) 0.50-0.69

| ID | Claim | P(H) | Status |
|----|-------|------|--------|
| H-014 | Performance gap is delegation quality, not information regime | **0.63** | EXP-007 Phase 1 partial support |
| H-056 | Cooperative convergence — system-level resistance to change | **0.61** | P4 confirmed; mechanism vs simpler explanation unresolved |
| H-047 | No forgetting → inverted-U utilization | **0.56** | Observable: KB only grows. Predictions untested. |
| H-054 | LLM judges have fundamental accuracy limits by task type | **0.50** | Inherits H-041 uncertainty. Generic claim well-supported. |
| H-043 | Knowledge utilization = P(exists) × P(access) × P(applies) | **0.62** | Framework confirmed by EXP-030/031b (P(access)≈0 for un-pushed knowledge). |
| H-068 | Functional emotion pressure degrades late-session behavior | **0.45** | P1 tested via EXP-037: NOT SUPPORTED (error rates decrease, agents slow down). P2-P4 untested. |

### EXP-025 Prospective Validation Results (Final)
- **63% binary accuracy** — below 70% threshold, but the asymmetry is the real finding
- **HURTS: 83%** — R reliably identifies when NOT to add workflow
- **HELPS: 0/3** — R cannot predict when workflow benefits
- **Base rate**: Workflow helps only 5% of the time in gym scenarios
- **New hypothesis H-070**: Fixed cost model explains gym vs production divergence
- See H-041 for full analysis and H-070 for the fixed cost formalization

## 🔵 Tier 3: Low Confidence — P(H) 0.30-0.49 (Deprioritize)

| ID | Claim | P(H) | Action |
|----|-------|------|--------|
| H-009 | Evaluator heuristic is a rubber stamp | **0.20** | **4c phases deployed** + **EXP-039 Phase B complete**: LLM evaluator shows selective confirmation bias — self-narrative inflates scores only for weak sessions (Q delta -0.10, verdict change), not good sessions (delta ~0). Heuristic evaluator unaffected. Practical implication: trigger isolated re-evaluation for sessions scoring <0.6. |
| H-001 | Adversarial QA framing → higher detection | **0.30** | **EXP-038 COMPLETE: WEAKLY DISCONFIRMED.** Easy scenario: ceiling (both 7/7). Hard scenario: standard 3/3 (7/7), adversarial 1/3 (6/7) — adversarial framing HURT evidence discipline (skipped tests 2/3 times). No detection benefit, +19-58% slower. |
| H-002 | Weaker models benefit more from context | **0.48** | Superseded by H-059. Archive if not tested in 14d. |
| H-038 | Transient skills via workspace files | **0.45** | Research pointer, not hypothesis. |
| H-039 | Decomposition quality bounds MAS quality | **0.44** | Truism. Simplify to 1-paragraph principle. |
| H-052 | Epistemic fragility has 4 stackable layers | **0.42** | Overbuilt. Core insight is "layered defense." |
| H-048 | Dynamic topology optimization | **0.38** | Chain dependency on H-041. Post-hoc evidence. |
| H-034 | Design for session interruption | **0.52** | Design principle, not hypothesis. |

## ⚪ Tier 4: Archive or Reclassify — P(H) < 0.30

| ID | Claim | P(H) | Action |
|----|-------|------|--------|
| H-051 | Abstention as R-estimator | **0.28** | Two untested dependencies. Archive. |
| H-046 | Coupled resource channels | **0.22** | Zero empirical connection. Archive. |
| H-064 | Self-preservation bias detection | **0.25** | Merged into H-055/H-056. |
| H-065 | Proactive tool safety guardrails | **0.23** | Not our domain. Reclassify as design note. |

## 🆕 Tier 5: New Hypotheses (moratorium violators — triage)

> These 6 hypotheses were generated since the moratorium. Each is assessed for whether it adds unique testable value vs. duplicating existing work.

| ID | Claim | Verdict | Reasoning |
|----|-------|---------|-----------|
| H-060 | Hierarchical MAS outperforms flat | **MERGE → H-041** | H-041 already covers structure as a variable. OrgAgent evidence already cited in H-041. This is a specific instance, not a new hypothesis. |
| H-061 | Constrained communication improves MAS | **MERGE → H-041** | H-041's scope variable covers this. CASCADE (DD#485) already cited. The PNAS paper (free info hurts) adds external evidence to H-041's scope analysis, not a new claim. |
| H-062 | Agent-native memory (ByteRover-style) | **MERGE → H-043/WKWA-004** | This is an implementation proposal for the memory architecture. WKWA-004 already synthesizes the 4-layer memory stack. H-062 describes a specific implementation, not a testable hypothesis. |
| H-063 | Agent temperament profiling (MTI) | **ARCHIVE — untestable** | Interesting concept but we can't measure "temperament" of our agents (they're all Claude). MTI requires distinct model comparisons. Low relevance to our 1-model system. |
| H-064 | Self-preservation bias detection | **MERGE → H-055/H-056** | Self-preservation is already central to H-055 (self-improvement paradox) and H-056 (cooperative convergence). The TBSP paper is already cited in H-055. Detection mechanisms are useful but belong as action items, not a new hypothesis. |
| H-065 | Proactive step-level tool safety guardrails | **ARCHIVE — not our domain** | We don't control the model's safety training. ToolSafe proposes RL-based guardrails that require model-level changes. Informative research, not an actionable hypothesis for us. |
| H-067 | Budgeted forgetting for agent memory | **MERGE → H-047** | H-047 already covers "no forgetting → inverted-U utilization." H-067 is a specific implementation (3-pillar scoring) of the mechanism H-047 predicts. Filed reference in H-047. |
| H-068 | Functional emotion pressure degrades late-session behavior | **KEEP — unique testable claim** | DD#516 provides causal mechanism (emotion vectors) distinct from H-055 (cosmetic modification) and H-052 (epistemic fragility). Testable: compare agent output quality at session start vs end. P(H)≈0.55. |

**Net effect**: 1 hypothesis added (H-068). 2 archived. 5 merged. Active count: 18. Resolution ratio: 4:18.

### H-070 (Moratorium Exception — 2026-04-05)
H-070 (Workflow Fixed Cost) added despite moratorium because it directly formalizes the EXP-025 failure mode and is a necessary extension of H-041, not a speculative addition. Could alternatively be merged into H-041 as a sub-section. Active count: 19.

### H-080, H-081, H-082 (Moratorium Triage — 2026-04-06)
| ID | Claim | Verdict | Reasoning |
|----|-------|---------|-----------|
| H-080 | Explicit memory write/retrieve > passive context | **MERGE → H-043 + WKWA-004** | Core claim already covered by H-043 (P(access) factor) and KE-020 (adoption hierarchy). YC-Bench evidence added to H-043 as Evidence §10. |
| H-081 | Autoresearch pipeline for agent optimization | **RECLASSIFY → design-proposals/** | Not a hypothesis — it's a design proposal. Core insight (bug fixes > tuning) noted but not testable in our system. |
| H-082 | Adversary role reduces silent failures | **MERGE → H-001** | Core claim (adversarial/critic role improves detection) is already captured by H-001 (Adversarial QA framing). H-082 adds SCRAT-style separation of roles but the testable prediction is identical. Source paper evidence added to H-001. |

**Net effect**: 0 hypotheses added. Active count unchanged: 19.

### H-083, H-084a, H-084b (Moratorium Triage — 2026-04-06, tech-lead)
| ID | Claim | Verdict | Reasoning |
|----|-------|---------|-----------|
| H-083 | CORAL heartbeat mechanisms (Reflect/Consolidate/Pivot) | **RECLASSIFY → design note** | Not a hypothesis — describes mechanisms we already implement (post-session checkpoints ≈ Reflect, knowledge synthesis ≈ Consolidate, auto-resume ≈ Pivot). CORAL paper is useful reference for H-053 (adoption decay) but the "hypothesis" is just "do what CORAL does." |
| H-084a | Memory as a Service Layer (Mem0-style) | **MERGE → H-043 + WKWA-004** | Duplicates H-080 triage. Same core claim (explicit memory > passive context) already covered by H-043 P(access) factor. Chinese text suggests scout/amy-kimi origin. |
| H-084b | Multi-Agent Iron Law (3 aggregation mechanisms) | **MERGE → H-041/H-070** | Framework for justifying multi-agent coordination costs. The three mechanisms (Feasibility Expansion, Support Expansion, Constraint Contraction) are a taxonomy, not a testable prediction. Core insight (coordination must unlock specific mechanisms) is already captured by H-041 (Decision Topology) and H-070 (Workflow Fixed Cost). Added as reference. |

**Net effect**: 0 hypotheses added. Active count unchanged: 19. ID collision (two H-084 files) flagged for scout.

---

## Experiment Queue (priority order)

| Priority | Experiment | Tests | Status | Next Step |
|----------|-----------|-------|--------|-----------|
| ✅ | **EXP-025** | **H-041 (non-ceiling scenarios)** | **COMPLETE — 19/20 sessions scored correctly** | Validated on 4 non-ceiling scenarios |
| P1 | EXP-026 | H-054 P1: RIFT audit of gym rubrics | NEEDS DESIGN | Manual rubric review |
| ✅ | **EXP-038** | **H-001: Adversarial QA A/B test** | **COMPLETE — WEAKLY DISCONFIRMED** | Easy: ceiling, Hard: adversarial hurt evidence discipline. P(H)→0.30. |
| P2 | EXP-039 | H-009/H-001: Informationally isolated verification | **PHASE C DEPLOYED** | Phase B confirmed selective bias. Phase C: automatic isolated re-eval for Q<0.6 deployed to `evaluator.ts`. Review branch: `review/exp039-phase-b-isolation`. |
| ✅ | **EXP-048** | **H-058 P1: Impossible task responses** | **COMPLETE — CONFIRMED** | Base: 0% escalation, 100% proxy-satisfying. Workflow (forced assessment): 100% escalation. Knowledge ≠ action. |
| ✅ | **EXP-037** | **H-068 P1: Session boundary quality** | **COMPLETE — NOT SUPPORTED** | Error rates decrease at end; agents slow down, don't rush |

## Key Insight (Updated 2026-04-05)

EXP-026 production data confirms H-041's core prediction: **workflow benefit scales with the eliminable-decision ratio R.** 8/8 directional predictions correct across 4 agents and 4 workflows. H-041 is now our highest-confidence theoretical framework (P(H)=0.78, tied with H-055).

**H-053 upgraded to P(H)=0.88** via EXP-028 natural experiment. The heartbeat rewrite on Apr 1 created a clean intervention: removing workflow instructions from coach's heartbeat → 51pp done-rate collapse → zero workflow usage within 1 day. This is the largest measured effect size in the system and confirms the adoption hierarchy: Available (0%) < Instructed (4-10%) < Automatic (100%). **New KE-020** filed as verified knowledge entry.

**The most important resolved question**: "Do workflows help for non-sycophancy tasks?" YES — Coach +20pp, QA +10pp. But ONLY when R is moderate-to-high. Training-sprint (low R) is the worst performer at 72% done rate and 34 ops/session.

**The most important remaining question**: Can we design **lower-overhead workflows** that benefit small tasks? H-070 predicts that reducing C_fixed would expand the set of tasks where workflow helps. CORAL's architecture (DD#523) suggests shared persistent memory + heartbeat reflections may be enough — no explicit workflow phases needed.

---

## Actions from CR#279 (Confirmation Bias Stack)

| Action | Status | Owner |
|--------|--------|-------|
| Implement contradiction detection pass on new research | NOT STARTED | Bob/Scout |
| Adopt Bayesian belief updates (continuous confidence) | ✅ **DONE** — Scorecard created with P(H) for all 23 hypotheses | Bob |
| Measure belief revision accuracy (BRA metric) | NOT STARTED | Coach |
| Progressive evidence requirements (tiered by impact) | ✅ **DONE** — 4-tier system with P(H) thresholds | Bob |
| Stop generating hypotheses until resolution improves | **ENFORCED** (H-060-065 triaged; active count 23→17) | All agents |
| H-060/H-061 contradiction (hierarchy vs flat) | **IDENTIFIED** — needs resolution experiment | Bob |

## Meta-Process: H-066 (Bayesian Belief Management)

The Bayesian scoring process itself is tracked as H-066. First-pass results:
- **4 high confidence** (≥0.70): H-055 (0.82), H-041, H-053, H-059
- **7 moderate** (0.50-0.69): H-014, H-056, H-047, H-054, H-043, H-001
- **H-009 substantially mitigated** (0.82→0.40): Phase 1 + Phase 2 heuristic fixes. Remaining gap: no content-level semantic evaluation.
- **1 below threshold** (0.40-0.49): H-068 (P1 refuted by EXP-037)
- **6 low** (0.30-0.49): H-002, H-038, H-039, H-052, H-048, H-034
- **H-058 upgraded** (0.40→0.75→**0.85**): DD#516 causal evidence + EXP-048 P1 confirmed in our system
- **4 archive** (<0.30): H-051, H-046, H-064, H-065
- **H-066 P1 confirmed**: 7 hypotheses scored below 0.40 (predicted ≥5)

---
*Tracker maintained by Bob (Architect) | Bayesian scoring: 2026-04-04 | Source: SCORECARD-bayesian-2026-04-04.md + REVIEW-2026-04-04*
