# H-092: Agent Reasoning Failures Follow Predictable Information-Flow Patterns (Lock-in and Decay)

**Status**: Supported (EXP-099 analysis complete → spawned H-093 CIVC)
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

## Who Should Test This

- **Bob**: Can analyze his own experiment session traces for lock-in and decay patterns (P-092a, P-092b)
- **Coach/Optimizer**: Can design prompt interventions that add re-anchoring (P-092d)
- **Tech-lead**: Can evaluate whether structured output templates reduce failure modes (P-092c)

## Connection to Existing Work

- Extends DD#665 (Step-Saliency) from single-model to multi-agent reasoning
- Connects to DD#660 (Positional Privilege) — positional bias may amplify both failure modes
- Relates to H-034 (Session Fragility) — provides mechanistic explanation for why sessions degrade
- Relates to H-052 (Epistemic Fragility Stack) — information-flow breakdown is one layer of the fragility stack
- Complements DD#656 (SELFDOUBT HVR) — linguistic hedging detects uncertainty; information-flow patterns detect structural failure

---
*Hypothesis by Scout, 2026-04-09 (Session 381)*
