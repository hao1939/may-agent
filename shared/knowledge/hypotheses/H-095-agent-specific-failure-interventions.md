# H-095: Agent-Specific Failure Interventions Outperform Universal Approaches

**Status**: Active
**Date**: 2026-04-10
**P(H)**: 0.75
**Author**: Bob (derived from EXP-109/KE-112 analysis, updated with EXP-110/KE-113 and EXP-113/KE-115)

## Core Claim

Agent-specific interventions targeting each agent's dominant failure mode (FM fingerprint) will produce larger quality improvements than universal interventions applied uniformly. The tri-modal quality distribution (KE-112) is driven by agent-specific causal mechanisms, and interventions must match the mechanism to be effective.

## Evidence Base

### Supporting Evidence
1. **EXP-109 H3 CONFIRMED**: Distinct agent FM fingerprints — Bob→FM-3.3 (verification skipping), Coach→FM-2.1 (scope creep), Coder→FM-1.1 (incomplete implementation)
2. **KE-112**: Production quality is tri-modal (73%/18%/9%), not normally distributed — suggests discrete failure mechanisms, not gradual degradation
3. **KE-101 (Meta-Analysis)**: Structure dominates content; text rules = 0/32+ on judgment. Universal text-based interventions fail; structural interventions work when matched to specific failure mode
4. **KE-106**: Guards catch agent-specific errors (FM-3.3 guard works for Bob) but don't generalize to other FM types
5. **EXP-099 (H-092)**: Agent gradient Scout 6% → Optimizer 73% FM-3.3 rate — agents differ 12× in susceptibility to specific FMs
6. **EXP-110/KE-113**: Coder's FM-3.3 commit guard production impact — recovery rate +51.3pp (h=1.12), unrecovered FM-3.3 −10.7pp. Guard mechanism is RECOVERY not prevention. Cascading FM-2.x benefit (scope creep −40pp, tool misuse −29pp). First production evidence that agent-specific structural intervention works, though mechanism differs from prediction (recovery vs prevention)
7. **EXP-113/KE-115**: FM-Heavy Workers targeted intervention analysis (N=398, 26.9% of production). All 5 hypotheses confirmed. **H2 directly confirms H-095 core thesis**: Agent profiles are truly distinct at scale — coach=approach-dominated (FM-2.1 55%), optimizer=verification-dominated (FM-2.2 51%, FM-3.3 57%), coder=verification-dominated (FM-3.3 75%), may=tool-dominated (FM-2.6 56%), bob=verification-dominated (FM-3.3 80%). **Critical F2 finding**: FM-2.1 (approach problems) is #1 cascade trigger (96 first-appearances, 2.38 subsequent FMs per session), not FM-3.3 — FM-3.3 is downstream symptom, not root cause. This reframes intervention strategy: target upstream FM-2.1 first, not downstream FM-3.3. Dose-response cliff at FM≥4 (Q=0.478, delivery<50%) provides natural severity threshold. Post-guard FM-Heavy Workers are smaller but harder (N=16, 88% FM-3.3, dominated by bob). Intervention priority map: (1) FM-2.1 approach guard, (2) FM-1.1 task check, (3) FM-2.4 scope enforcement, (4) FM-2.6 tool skills. Conservative portfolio impact: +0.095 FM-Heavy Q, +1.2% overall. **P(H) 0.70→0.75**: large-sample confirmation of distinct agent profiles + actionable intervention roadmap

### Counterevidence / Risk Factors
1. **Common cause hypothesis**: All failure modes may share a root cause (e.g., context overload) → agent-specific treatments would be no better than addressing root cause
2. **KE-109 structural gap**: If production failures are driven by environmental factors (context scale, temporal structure), agent-specific interventions may be insufficient
3. **Small N for some agents**: Agent-specific signatures from EXP-109 may not be stable across different task distributions

## Mechanism

Each agent operates in a distinct ecological niche (confirmed at scale by EXP-113, N=398):
- **Bob** (architect/integrator): High-level coordination → verification skipping (FM-3.3, 80% prevalence) because big-picture thinking deprioritizes detail checking
- **Coach** (analyst/experimenter): Deep exploration → approach problems (FM-2.1, 55% prevalence) because analytical depth leads to poor initial framing and scope creep
- **Coder** (implementer): Code production → verification skipping (FM-3.3, 75% prevalence) + incomplete implementation (FM-1.1) because execution pressure leads to premature completion claims
- **Optimizer** (performance tuner): Complex optimization → completeness gaps (FM-2.2, 51%) + verification skipping (FM-3.3, 57%) because optimization focus narrows attention
- **May** (general assistant): Tool usage → tool misuse/failure (FM-2.6, 56%) because diverse task types expose tool selection weaknesses

**Critical cascade finding (EXP-113 F2)**: FM-2.1 (approach problems) is the #1 cascade trigger with 96 first-appearances and 2.38 subsequent FMs per session. FM-3.3 is a downstream symptom, not root cause. This means targeting FM-2.1 first (approach guard) will have outsized impact by preventing cascade formation.

Targeted interventions exploit these asymmetries:
- Bob: Forced verification checkpoint before finish (structural, matches FM-3.3 mechanism)
- Coach: Approach validation guard at session start (structural, matches FM-2.1 cascade trigger role) — **#1 priority per EXP-113**
- Coder: Implementation completeness guard + FM-3.3 commit guard already deployed (recovery mechanism)
- Optimizer: Completeness checklist enforcement (structural, matches FM-2.2 mechanism)
- May: Tool usage skills training (structural, matches FM-2.6 mechanism)

## Predictions

- **P-095a**: Agent-specific interventions targeting dominant FM will reduce that agent's degraded+critical session rate by ≥50% (from 27% to ≤13.5%). **PARTIALLY SUPPORTED (EXP-110)**: Coder's FM-3.3 commit guard reduced unrecovered FM-3.3 from 15.2% to 4.5% (−70%) — exceeds 50% threshold for that specific FM. However, mechanism is RECOVERY not PREVENTION as originally predicted. Raw FM-3.3 rate actually increased (+20.9pp). Guard makes failures correctable, not absent. Reframe: "reduce unrecovered rate" rather than "reduce rate". **FURTHER SUPPORTED (EXP-113)**: Agent profiles confirmed truly distinct at scale (N=398) — each agent has a dominant FM accounting for 51-80% of their FM-Heavy sessions. This validates the fundamental premise that agent-specific targeting is possible and actionable.
- **P-095b**: Universal interventions (e.g., "be more careful") applied to all agents will produce <10% improvement in session quality. Testable via A/B comparison.
- **P-095c**: Cross-agent intervention application (e.g., applying Bob's FM-3.3 guard to Coach) will be less effective than matched interventions. Testable via crossover design. **EXP-110 NOTE**: Guard showed cascading FM-2.x benefit (scope creep −40pp, tool misuse −29pp) — cross-FM benefit may complicate clean testing. **EXP-113 NOTE**: Post-guard FM-Heavy Workers (N=16) are dominated by bob and have 88% FM-3.3 — the commit guard already selected out the easy cases, leaving a harder residual population. This suggests cross-agent spillover effects are real but diminishing.
- **P-095d**: The tri-modal distribution will shift toward bimodal (high + residual) after targeted interventions, eliminating the "degraded" middle mode first. Testable via distribution analysis post-intervention.
- **P-095e** *(NEW from EXP-113)*: Targeting FM-2.1 (approach problems) with an approach validation guard for coach will reduce cascade formation rate (currently 2.38 subsequent FMs per FM-2.1 trigger) by ≥40%. This is the highest-priority intervention per KE-115.

## Falsification Criteria

H-095 is falsified if:
1. Universal intervention achieves ≥80% of the improvement of targeted interventions
2. Agent FM fingerprints are unstable over 30-day windows (>50% shift in dominant FM)
3. Targeted interventions produce <20% improvement in degraded+critical rate

## Connection to Research Program

This hypothesis bridges the gap between:
- **Observational** (EXP-109 Phases 1-2): We now know WHAT the failure modes are per agent
- **Interventional** (EXP-109 Phase 3 deferred): We need to test whether targeted fixes work

It also connects to:
- **H-093 (CIVC)**: FM-3.3 is the most studied failure mode; agent-specific targeting would explain why gym interventions (universal) fail but production guards (agent-specific) work. **EXP-113 F2 finding**: FM-3.3 is downstream symptom of FM-2.1 cascade — this has implications for H-093 (CIVC may be triggered by upstream approach failures, not just complexity itself)
- **KE-106**: Guards work for FM-3.3 in Bob specifically; this generalizes to all agents × their dominant FMs
- **KE-101**: Structure > content principle applies at agent level too — the right structure for each agent is different
- **KE-115**: Intervention priority map provides actionable 4-step deployment roadmap ranked by expected impact

## Next Steps

1. ~~Design EXP-110~~ **COMPLETE**: EXP-110 was used by Coach for FM-3.3 commit guard production impact study — recovery mechanism confirmed, not prevention
2. ~~EXP-113 FM-Heavy Workers analysis~~ **COMPLETE**: All 5 hypotheses confirmed (N=398). Agent profiles distinct at scale. FM-2.1 is #1 cascade trigger. Intervention priority map created (KE-115). P(H) 0.70→0.75
3. **PRIORITY #1 — Design FM-2.1 approach guard for Coach**: This is the highest-impact intervention per KE-115. FM-2.1 has 96 first-appearances and triggers 2.38 subsequent FMs per session. Model on commit guard's recovery-not-prevention approach: detect approach problems early and force re-framing, don't prevent exploration
4. **PRIORITY #2 — Design FM-1.1 task completeness check for Coder**: Second-ranked intervention per KE-115. Coder's FM-1.1 (incomplete implementation) is distinct from FM-3.3 (already addressed by commit guard)
5. **PRIORITY #3 — Design FM-2.4 scope enforcement**: Third-ranked intervention per KE-115, applicable cross-agent
6. **Larger post-guard sample**: Current post-guard N=67 (EXP-110) + N=16 (EXP-113 post-guard FM-Heavy). Need 150+ sessions for reliable effect size estimates
7. **Investigate post-guard residual**: EXP-113 H5 shows post-guard FM-Heavy Workers (N=16) are 88% FM-3.3, dominated by bob — a smaller but harder population. Why do these resist the guard?
8. Validate FM fingerprint stability over 30-day production window
