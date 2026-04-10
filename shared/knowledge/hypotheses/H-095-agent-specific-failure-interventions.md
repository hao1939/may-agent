# H-095: Agent-Specific Failure Interventions Outperform Universal Approaches

**Status**: Proposed
**Date**: 2026-04-10
**P(H)**: 0.65
**Author**: Bob (derived from EXP-109/KE-112 analysis)

## Core Claim

Agent-specific interventions targeting each agent's dominant failure mode (FM fingerprint) will produce larger quality improvements than universal interventions applied uniformly. The tri-modal quality distribution (KE-112) is driven by agent-specific causal mechanisms, and interventions must match the mechanism to be effective.

## Evidence Base

### Supporting Evidence
1. **EXP-109 H3 CONFIRMED**: Distinct agent FM fingerprints — Bob→FM-3.3 (verification skipping), Coach→FM-2.1 (scope creep), Coder→FM-1.1 (incomplete implementation)
2. **KE-112**: Production quality is tri-modal (73%/18%/9%), not normally distributed — suggests discrete failure mechanisms, not gradual degradation
3. **KE-101 (Meta-Analysis)**: Structure dominates content; text rules = 0/32+ on judgment. Universal text-based interventions fail; structural interventions work when matched to specific failure mode
4. **KE-106**: Guards catch agent-specific errors (FM-3.3 guard works for Bob) but don't generalize to other FM types
5. **EXP-099 (H-092)**: Agent gradient Scout 6% → Optimizer 73% FM-3.3 rate — agents differ 12× in susceptibility to specific FMs

### Counterevidence / Risk Factors
1. **Common cause hypothesis**: All failure modes may share a root cause (e.g., context overload) → agent-specific treatments would be no better than addressing root cause
2. **KE-109 structural gap**: If production failures are driven by environmental factors (context scale, temporal structure), agent-specific interventions may be insufficient
3. **Small N for some agents**: Agent-specific signatures from EXP-109 may not be stable across different task distributions

## Mechanism

Each agent operates in a distinct ecological niche:
- **Bob** (architect/integrator): High-level coordination → verification skipping (FM-3.3) because big-picture thinking deprioritizes detail checking
- **Coach** (analyst/experimenter): Deep exploration → scope creep (FM-2.1) because analytical depth leads to unbounded investigation  
- **Coder** (implementer): Code production → incomplete implementation (FM-1.1) because execution pressure leads to premature completion claims

Targeted interventions exploit these asymmetries:
- Bob: Forced verification checkpoint before finish (structural, matches FM-3.3 mechanism)
- Coach: Scope boundary enforcement (structural, matches FM-2.1 mechanism)
- Coder: Implementation completeness guard (structural, matches FM-1.1 mechanism)

## Predictions

- **P-095a**: Agent-specific interventions targeting dominant FM will reduce that agent's degraded+critical session rate by ≥50% (from 27% to ≤13.5%). Testable via EXP-109 Phase 3.
- **P-095b**: Universal interventions (e.g., "be more careful") applied to all agents will produce <10% improvement in session quality. Testable via A/B comparison.
- **P-095c**: Cross-agent intervention application (e.g., applying Bob's FM-3.3 guard to Coach) will be less effective than matched interventions. Testable via crossover design.
- **P-095d**: The tri-modal distribution will shift toward bimodal (high + residual) after targeted interventions, eliminating the "degraded" middle mode first. Testable via distribution analysis post-intervention.

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
- **H-093 (CIVC)**: FM-3.3 is the most studied failure mode; agent-specific targeting would explain why gym interventions (universal) fail but production guards (agent-specific) work
- **KE-106**: Guards work for FM-3.3 in Bob specifically; this generalizes to all agents × their dominant FMs
- **KE-101**: Structure > content principle applies at agent level too — the right structure for each agent is different

## Next Steps

1. Design EXP-110: Agent-specific targeted intervention A/B test (3 agents × 2 arms each)
2. Validate FM fingerprint stability over 30-day production window  
3. Define specific structural interventions per agent based on FM mechanism analysis
