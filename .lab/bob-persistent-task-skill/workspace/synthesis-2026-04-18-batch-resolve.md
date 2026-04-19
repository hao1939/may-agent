# Research Synthesis: Batch Hypothesis Resolution (2026-04-18)

## Summary

Resolved **6 hypotheses** across 3 parallel threads. All threads succeeded.

| Hypothesis | Verdict | Domain |
|---|---|---|
| H-095 (Agent-Specific Failure Interventions) | ✅ SUPPORTED | Intervention design |
| H-053 (Workflow Adoption Decay) | ✅ SUPPORTED | Sustainability |
| H-058 (Frustration-Triggered Topology Rewrite) | ✅ SUPPORTED (P=0.87) | Agent behavior |
| H-009 (Evaluator Drift) | ✅ SUPPORTED (P=0.85, recharacterized) | Evaluation |
| H-043 (Knowledge Utilization Bottleneck) | ✅ SUPPORTED | Knowledge systems |
| H-166-original (Binary Recognition Threshold) | ❌ REFUTED | Expert knowledge |

## Key Findings by Thread

### Thread 1: H-095 + H-053 — Intervention Sustainability
- Agent-specific interventions outperform universal ones, but EXP-124 null result removed one pillar (FM-1.3 path-guessing remains unresolved by any intervention type)
- Workflow adoption decays 60-80% from peak without structural reinforcement; text instructions sustain only a 4-10% floor

### Thread 2: H-058 + H-009 — System Dynamics
- Frustration triggers topology rewrites (agents restructure their approach patterns under sustained failure)
- Evaluator drift recharacterized as **structural blind spot** rather than gradual drift — evaluation gaps are architectural, not temporal

### Thread 3: H-043 + H-166 — Knowledge & Expertise
- Knowledge accessibility (not knowledge existence) is the bottleneck limiting agent improvement
- Binary threshold model of expert knowledge **refuted** — moderate hints work when environment isn't contaminated (EXP-168 confound discovered)

## Cross-Thread Patterns

1. **Structure > Text**: H-053 (adoption decay) + H-043 (knowledge bottleneck) + H-009 (structural blind spots) all point to the same meta-finding: **textual/passive interventions underperform structural ones**. Knowledge exists but isn't accessed; workflows are known but decay; evaluation gaps are built-in, not learned.

2. **Intervention paradox**: H-095 says targeted interventions work, but H-053 says they decay, and EXP-124 shows even structural ones can null-result. The effective window is narrow.

3. **H-166 refutation reshapes the intervention design space**: If expert knowledge has gradient (not binary) effects, then partial-knowledge interventions are worth pursuing — contradicting the "all or nothing" model that would have narrowed our approach.

## Impact Ranking

1. **H-166 refutation** (highest) — Changes how we design knowledge interventions going forward
2. **H-043 + H-053 convergence** — Structural accessibility is the key lever, not content creation
3. **H-009 recharacterization** — Shifts evaluation improvement from monitoring to architecture
4. **H-058 confirmation** — Useful but less actionable (frustration rewrite is descriptive)

## Next Steps

- **Design a structural knowledge injection experiment** leveraging H-166 refutation + H-043 (gradient knowledge × accessibility)
- **FM-1.3 path-guessing remains unresolved** — neither text nor structural interventions work; needs fresh approach
- **Evaluate runtime enforcement** as the structural mechanism that H-053 demands for sustainability
