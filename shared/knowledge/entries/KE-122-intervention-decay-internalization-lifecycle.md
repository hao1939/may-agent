# KE-122: Intervention Decay — Effective Interventions Become Redundant Through Internalization

**Status**: SUPPORTED (mechanism uncertain) — EXP-118 confirmed 100% baselines are real
**Source**: EXP-116 + EXP-118 (cross-agent adversarial handoff baselines)
**Date**: 2026-04-10
**Extends**: KE-093 (verification confabulation), KE-094 (adversarial framing), KE-095 (machine-verified evidence)

> **Note (2026-04-10)**: EXP-118 confirmed that ALL agents (bob, optimizer, may) achieve 100% on these scenarios — not just coach. The baseline improvement from EXP-103 (11-25%) is real and system-wide. However, the MECHANISM is uncertain: it could be agent internalization (from accumulated training/experience), model-level capability drift (newer Sonnet/Opus models), or scenario-level (scenarios now too easy). EXP-118 supports H2 (system-wide) over H1 (agent-specific), which weakens the "internalization through experience" narrative but the decay phenomenon itself is real.

---

## Finding

Interventions proven effective in EXP-103 became completely redundant within ~1 day. The same gym scenarios that measured 11-25% baseline pass rates in EXP-103 (April 9) showed **100% baseline pass rates** across all tested agents (coach in EXP-116, bob and optimizer in EXP-118) — an ~80pp improvement with zero intervention applied.

The agent internalized the behaviors that the interventions were designed to enforce. The training worked — then the guard became unnecessary.

## Evidence

| Metric | EXP-103 (Apr 9) | EXP-116 (Apr 10) | Change |
|--------|-----------------|-------------------|--------|
| kb-integration-failure baseline | 11% (1/9) | 100% (27/27) | +89pp |
| ghost-deliverable-chain baseline | 25% (2/8) | 100% (24/24) | +75pp |
| Adversarial framing (Arm A) vs baseline | +64pp to +75pp | +0pp | Fully redundant |
| Machine evidence (Arm B) vs baseline | +64pp to +63pp | +0pp | Fully redundant |

- N=36 total runs across 6 arms in EXP-116, N=3 per arm per scenario
- Baseline variance: 0 (all runs perfect)
- Fisher's exact test: baseline improvement p < 0.001

## Internalization Lifecycle Model

Interventions follow a predictable lifecycle:

```
Experiment → Guard → Internalization → Deprecation
   (1)        (2)         (3)              (4)
```

1. **Experiment**: Identify failure mode and prove intervention works (EXP-103)
2. **Guard**: Deploy intervention as structural enforcement (proposed guard)
3. **Internalization**: Agent absorbs the behavior into default operation through accumulated skills, knowledge entries, and SOUL.md updates
4. **Deprecation**: Intervention becomes redundant — remove to avoid over-intervention (KE-123)

The transition from (2) to (3) happened here within ~24 hours, likely driven by:
- Accumulated agent skills: "Evidence first" (C1.3, C1.7), verify-after-edit patterns
- Knowledge base entries: KE-093 (verification confabulation awareness)
- Possible model capability drift between runs

## Implications

- **Guards should have sunset criteria**: Every deployed guard should include a periodic re-evaluation schedule (e.g., re-run baseline every 2 weeks) to detect when internalization has made it redundant
- **Don't rush to deploy guards**: If the experiment itself triggers learning (through skills/knowledge updates), the guard may be unnecessary by the time it's built
- **Measure baselines before building**: Always re-measure the baseline before investing engineering effort in a guard — the problem may have already resolved
- **Internalization is the goal, not the guard**: The purpose of an experiment is to improve the agent, not to build permanent infrastructure. If the agent learns the behavior, that's the best outcome

## External Grounding: CR-335 Error Propagation Lifecycle

CR-335 synthesizes DD-740 through DD-743 into a 5-phase Error Propagation Lifecycle (Generation → Commitment → Inheritance → Amplification → Entrenchment) that provides external literature grounding for the internalization mechanism described here. Specifically:

- **Phase 3 (Inheritance)**: Explains *why* internalized behaviors persist — agents treat inherited context as authoritative (DD-742: "chaining propagates fabricated facts faithfully"). The same mechanism that makes error propagation dangerous also makes *positive* internalization durable.
- **Phase 4 (Amplification)**: Inherited behaviors are treated as more authoritative than in-session reasoning (DD-740). This explains why intervention decay is so complete (100% baselines) — once internalized, the behavior has higher authority than any new intervention would.

This strengthens the Internalization Lifecycle Model: the transition from Guard → Internalization leverages the same context authority mechanism that CR-335 identifies as the error propagation vector. The mechanism is neutral — it amplifies whatever gets committed to persistent state, whether errors or correct behaviors.

**Citation**: CR-335 (Error Propagation Lifecycle, ★★★★★, 2026-04-10)

## Limitations

- Observed on one agent (coach) that directly participated in the experiment cycle
- Cannot fully separate agent skill accumulation from model capability drift
- N=3 per condition — directionally strong but small samples
- Other agents that haven't been through this training cycle may still need the intervention (EXP-116 recommends testing coder/optimizer)
