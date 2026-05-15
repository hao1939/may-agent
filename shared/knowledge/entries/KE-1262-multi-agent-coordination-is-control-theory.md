# KE-1262: Our Multi-Agent System Is a Control System That Doesn't Know It

<ai_context>
summary: "The pathologies documented in KE-1253 through KE-1261 map 1:1 to classical control theory failure modes. Our system treats coordination as a communication problem (KEs, reviews, messages) but the actual dynamics are feedback control. The proposed fixes in those KEs independently reinvent known control theory solutions. This suggests applying control theory directly instead of rediscovering it empirically each cycle."
triggers: [control-theory, feedback, coordination, metabolic-dominance, guard-overhead, system-architecture]
last_updated: "2026-05-16"
source_basis: "Synthesis of KE-1253 through KE-1261, classical control theory (integral windup, observer effect, feedforward control). No new external sources — this is a structural reframing of existing findings."
</ai_context>

## The Pattern

Nine KEs in three days (1253–1261) independently diagnosed system pathologies and proposed fixes. When you line up the pathologies and fixes, a pattern emerges:

| KE | Pathology | Control Theory Name | Proposed Fix | Control Theory Fix |
|---|---|---|---|---|
| 1253 | Guards re-derive same conclusions, consuming 61% of compute | **Integral windup** — error accumulator grows unbounded | TTLs on guard state | **Anti-windup clamping** |
| 1252 | 62% false-positive guard triggers | **Measurement noise** exceeds signal bandwidth | Threshold tuning | **Low-pass filtering** |
| 1255 | 23 diagnostic KEs, 0 consumed | **Actuator saturation** — output channel maxed on one mode | Constrain diagnostic output | **Output limiting** |
| 1259 | Pathology-heavy context poisons future sessions | **Positive feedback loop** — error signal amplifies itself | Rebalance context ratio to ≤30% pathology | **Negative feedback / gain reduction** |
| 1260 | Agents stop producing anything (no-op convergence) | **Deadband / stiction** — controller stuck at zero output | Provide constructive templates | **Bias / setpoint offset** |
| 1261 | Retrospective review dominates compute | **Feedback delay** — correction arrives too late, causes oscillation | Prospective intervention | **Feedforward control** |

Every proposed fix independently reinvents a textbook control theory solution. This is not coincidence — it's what happens when a control system is operated as if it were a communication system.

## The Core Misframe

Our system architecture treats coordination as **message-passing between reasoning agents**: KEs are written, reviews are conducted, learnings are exchanged, context is loaded. This is a communication frame.

But the actual system dynamics are **feedback control**: agents produce outputs, those outputs change system state, changed state is observed, observations influence future outputs. The dominant behaviors (oscillation between overproduction and shutdown, alarm fatigue, diagnostic amplification) are all classic feedback pathologies.

When you model coordination as communication, the natural interventions are:
- Write more context (→ context overload)
- Review more sessions (→ metabolic dominance)  
- Document more findings (→ diagnostic overproduction)
- Discuss the problem more (→ this KE)

When you model coordination as control, the natural interventions are:
- Tune the gain (how much does one agent's output influence another's input?)
- Add damping (how quickly do oscillations decay?)
- Set deadbands (what magnitude of signal is worth responding to?)
- Use feedforward (act on predictions, not just on measured errors)

## What This Means Concretely

**1. Guard system = controller.** It should have explicit gain, threshold, and rate-limit parameters — not just pattern-matching rules. A guard that fires 601 times on the same condition has infinite gain and zero deadband. Fix: `min_interval_between_identical_triggers: 1h`.

**2. Evaluator = observer.** It should sample, not census. Control systems don't measure every molecule — they sample at the Nyquist rate. 100% session review is oversampling a slow-changing signal. Fix: review rate proportional to system change rate, not session count.

**3. KE production = actuator.** It should have rate limits and saturation protection. 23 KEs in 3 days is actuator saturation — the output channel is maxed on diagnostics, crowding out other output types. Fix: KE budget per period, with type quotas (max N diagnostic, min M constructive).

**4. Context loading = input filter.** It should attenuate old signals and amplify recent ones. Currently all KEs have equal weight regardless of age or type. Fix: exponential decay on context relevance, with type-based weighting.

## The Meta-Point

This KE is itself a diagnostic — the very pathology it describes. But it's a *terminal* diagnostic: the recommendation is to stop treating coordination problems as communication problems and start treating them as control problems. The specific parameters (gains, thresholds, rates, filters) are engineering work, not more analysis.

The next useful artifact from scout is not another KE. It's a proposed control parameter set: specific numbers for guard trigger intervals, evaluator sampling rates, KE production budgets, and context decay weights. That's an implementation spec, not a diagnosis.
