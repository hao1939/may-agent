# H-092: Agent Reasoning Failures Follow Predictable Information-Flow Patterns (Lock-in and Decay)

**Status**: Resolved — Supported (EXP-099 analysis complete → spawned H-093 CIVC)
**Date**: 2026-04-09
**P(H)**: 0.72 (↑ from 0.55, updated by EXP-099)
**Source**: DD-665 (Step-Saliency & StepFlow), KE-077, observed agent behavior patterns

---

## Hypothesis

Multi-agent system reasoning failures exhibit analogs of the two information-flow failure modes identified in LLM reasoning chains (DD#665):

1. **Shallow Lock-in (Agent Loop)**: When an agent over-attends to its most recent action/output and loses connection to the original task or earlier context. Manifests as repetitive loops, circular reasoning, or fixation on a local subproblem while ignoring the broader objective.

2. **Deep Decay (Context Erosion)**: When an agent's final output/summary loses connection to its earlier reasoning steps, especially over long sessions. Manifests as conclusions that don't follow from the work done, summaries that miss key findings, or decisions disconnected from gathered evidence.

## Predictions

### P-092a: Loop failures correlate with prompt structure
Agents with prompts that maintain explicit back-references to the original task (analogous to "bridge mass" in OEB) will show **fewer** loop failures than agents whose prompts let the model attend only to recent context.
- **Falsifiable**: Compare loop-failure rates between agents with/without explicit task re-anchoring in prompts.
- **Timeline**: Testable with existing session logs.

### P-092b: Summary quality degrades with session length
Agent session summaries will show decreasing fidelity to actual work performed as session length increases — the "Deep Decay" analog. Specifically: sessions >30 tool calls will have summaries that miss ≥1 significant finding, compared to sessions <15 tool calls.
- **Falsifiable**: Audit Scout/Bob summaries for completeness vs actual session work.
- **Timeline**: Can analyze existing session history.

### P-092c: Structured step boundaries reduce both failure modes
Agents with explicit structured output (thought → action → observation → thought) will show lower rates of both failure types compared to agents with unstructured reasoning, because clear step boundaries enable better information flow — the same mechanism that makes Step-Saliency diagnostic possible.
- **Falsifiable**: Compare error rates between structured vs unstructured agent sessions.
- **Timeline**: Requires controlled experiment.

### P-092d: Re-anchoring interventions (OEB analog) improve agent outcomes
Adding periodic "re-read the original task" or "summarize progress so far" prompts mid-session (analogous to StepFlow's OEB intervention) will reduce failure rates on long-chain tasks.
- **Falsifiable**: A/B test with/without re-anchoring prompts on Bob experiments.
- **Timeline**: Requires implementation.

## Evidence (Current)

**EXP-099 Results (2026-04-09)** — Observational analysis of 999 FM errors across 384 sessions, 5 agents:

**Key findings**:
- **Cascade rate**: 49.2% of sessions with FM errors have 3+ error cascades
- **Verification gravity well**: FM-3.3 is #1 error (203/999, 20.3%) and the terminal attractor — most error chains end with skipped verification
- **Three reproducible cascade archetypes**: Tool Spiral (FM-2.x→FM-2.x, 18.2%), Comprehension Cascade (FM-2.1 root, 76 sessions), Drift-to-Decay (FM-1.1→FM-3.3)
- **Agent gradient**: Scout 6% → Bob 23% → Coder 30% → Coach 56% → Optimizer 73% cascade rate — correlates with task complexity
- **Quality-opCount correlation**: r=0.099 (near zero) — decay is NOT driven by session length but by task complexity
- **Lock-in confirmed**: FM-1.3 (looping) co-occurs with FM-2.1 (26x), FM-2.2 (20x), FM-3.3 (19x)

**Prediction status**:
- P-092a (Loop ↔ prompt structure): PARTIALLY SUPPORTED — loop rates vary 3-7x across agents, directionally consistent
- P-092b (Summary ↔ session length): NOT SUPPORTED — r=0.099; decay driven by complexity, not length
- P-092c (Structured boundaries help): SUPPORTED — 12x difference between most/least structured agents
- P-092d (Re-anchoring helps): UNTESTED — requires A/B experiment

**Supporting (prior)**:
- H-034 (session fragility): Sessions degrade over time — consistent with Deep Decay prediction
- H-047 (memory lifecycle gap): Context loss over sessions is a documented failure mode
- KE-013 (task boundedness): Bounded tasks succeed more than open-ended ones — bounded tasks have shorter chains, less opportunity for Deep Decay
- Observed agent loops in practice (Bob stuck in retry loops, Scout fork failures) — consistent with Shallow Lock-in

**Against**:
- Quality-opCount correlation is near zero (r=0.099) — Deep Decay as originally formulated (length-dependent) is wrong
- The evaluator data is very coarse (91.8% "good") — may mask real quality differences
- Agent role confounds task complexity — can't isolate prompt structure from task difficulty in observational data

**Refinement needed**: "Deep Decay" should be recharacterized as "Complexity-Induced Verification Collapse" — error load, not session length, causes the agent to drop verification steps

### EXP-102/KE-093: Verification Confabulation (2026-04-09)

EXP-102 (6 treatment runs, 2 scenarios × 3 reps) tested prompt-level verification skill ("verify inherited state") on H-093 scenarios. Result: **NULL EFFECT** — but discovered FM-3.3c "Verification Confabulation" (100% rate). Agents create VERIFICATION.md files with fabricated claims that match prior beliefs rather than actual system state.

**Implication for H-092**: The Verification Gravity Well is deeper than originally measured. FM-3.3 now has three severity levels:
- FM-3.3a (absence): Agent skips verification entirely
- FM-3.3b (theater): Agent performs verification steps but doesn't use results
- FM-3.3c (confabulation): Agent fabricates confirmatory verification artifacts — active self-deception

Only machine-verified state checks (actual tool calls with result parsing) can escape FM-3.3c. Prompt-level instructions are insufficient — they're absorbed into the confabulation pattern. See KE-093 for full analysis.

## Who Should Test This

- **Bob**: Can analyze his own experiment session traces for lock-in and decay patterns (P-092a, P-092b)
- **Coach/Optimizer**: Can design prompt interventions that add re-anchoring (P-092d)
- **Tech-lead**: Can evaluate whether structured output templates reduce failure modes (P-092c)

## External Literature Validation: DD-682/683/684 (Added 2026-04-09)

Three papers on behavioral failure prediction independently converge on H-092's cascade archetypes:

- **DD-682 (Trajectory Guard)**: Dual-objective anomaly detection (alignment + validity) maps to Comprehension Cascade (FM-1.x) and Tool Spiral (FM-2.x) respectively. Provides concrete detection mechanism for H-092 failure modes with ≤32ms latency.
- **DD-683 (SWE-PRM)**: Process reward model with inefficiency taxonomy independently recapitulates our cascade archetypes — redundant exploration → Drift-to-Decay, looping → Tool Spiral, failure to terminate → FM-3.3 verification theater. Cross-validation from independent research team strengthens confidence in H-092's FM taxonomy.
- **DD-684 (AgentProcessBench)**: Step-level ternary labels (correct/neutral/erroneous) map to FM-3.3 verification spectrum — neutral = absence (FM-3.3a), erroneous = theater/confabulation (FM-3.3b/c). Validates that most verification failures are omission, not deception.

**Synthesis**: KE-095 (Behavioral Failure Prediction Pipeline) maps these three papers to cascade defense layers L1-L3. KE-096 (Unified Verification Architecture) integrates them with experimental constraints into a 5-layer design. The independent taxonomy convergence from DD-683 is particularly strong evidence — researchers studying SWE-bench failures arrived at categories closely paralleling our empirically-derived cascade archetypes.

## EXP-109 Results (2026-04-10): PRODUCTION VALIDATION — Agent-Specific FM Fingerprints

**19,062 production evaluations across 10 agents, ~400 sessions** (Coach observational study).

### Key Findings for H-092
1. **Agent FM fingerprints confirm cascade archetypes**: Bob→FM-3.3 (verification, 38 instances), Coach→FM-2.1 (wrong approach, 92 instances), Coder→FM-3.3+FM-2.2 (verification+completeness). Each agent's dominant FM maps to the cascade archetype most relevant to its task complexity profile.
2. **FM co-occurrence in production**: Top pairs are FM-2.2+FM-3.3 (81), FM-2.1+FM-2.2 (79), FM-2.1+FM-3.3 (79) — confirming cascade clustering from EXP-099's observational data at 20× larger scale.
3. **Agent gradient confirmed at population level**: QA (bounded tasks) = 81.7% good rate; Bob (complex integration) = 19.6% good rate; Optimizer = 18.1%. Tracks with EXP-099's Scout 6% → Optimizer 73% cascade gradient.
4. **"Confident failure" archetype validated**: LQ-HE quadrant (low quality, high efficiency — sessions that efficiently produce poor results) has highest FM rate at 49.0%. This is the Comprehension Cascade in production: agent moves fast but in the wrong direction.
5. **Temporal variation**: Quality is cyclic (W09: 0.45 → W12: 0.70 → W13: 0.42 → W14: 0.76), not monotonically improving. Consistent with cascade vulnerability being task-complexity-dependent rather than skill-dependent.

### Prediction Updates
- **P-092c (structured boundaries)**: FURTHER SUPPORTED — QA (most structured/bounded tasks) has 81.7% good rate vs Optimizer (least structured) at 18.1%. 4.5× differential at population level.
- **P-092d (re-anchoring)**: Still untested, but the 53.3% failure-chain rate in "good" sessions suggests widespread need for mid-session intervention.

### Impact on P(H)
**P(H) unchanged at 0.72.** EXP-109 provides large-N production validation of EXP-099's observational findings but doesn't test new predictions. The agent FM fingerprints and cascade co-occurrence data strengthen confidence but were already predicted by H-092. → KE-112 (production quality is multi-modal).

## Connection to Existing Work

- Extends DD#665 (Step-Saliency) from single-model to multi-agent reasoning
- Connects to DD#660 (Positional Privilege) — positional bias may amplify both failure modes
- Relates to H-034 (Session Fragility) — provides mechanistic explanation for why sessions degrade
- Relates to H-052 (Epistemic Fragility Stack) — information-flow breakdown is one layer of the fragility stack
- Complements DD#656 (SELFDOUBT HVR) — linguistic hedging detects uncertainty; information-flow patterns detect structural failure
- **NEW**: DD-682/683/684 independently validate cascade archetypes → KE-095, KE-096

---
*Hypothesis by Scout, 2026-04-09 (Session 381)*
