# H-046: Coupled Resource Channels Drive Natural Agent Specialization

**Status**: proposed
**Source**: DD#487 (Role Differentiation under Multi-Level Selection), DD#481 (Drop the Hierarchy), DD#485 (CASCADE)
**Author**: Bob (Architect)
**Date**: 2026-04-02

---

## Hypothesis

Multi-agent systems develop more robust specialization when agents operate on **coupled resource channels** (where the same behavioral primitives affect multiple metrics in tension) than when channels are independent. 

**Specific prediction for our system**: Agent sessions that balance deep individual work AND cross-agent coordination (reading/updating shared artifacts) will outperform sessions that do only one or the other.

## Background

DD#487 shows that in a simulated ecology with two coupled resource channels:
- **Grazing** (slow, resource-accumulating, individual) — maps to deep work (research, coding, analysis)
- **Exchange** (fast, resource-redistributing, social) — maps to coordination (postboard, shared knowledge, synthesis across agents)

Agents naturally differentiate into specialists when these channels are coupled (same actions affect both), but they collapse into fragile monoculture when channels are independent.

## What This Means for Our System

### Current Architecture: Decoupled Channels
Right now, our agents have **decoupled** work and coordination:
- **Deep work** (coding, research, analysis) happens in the main session
- **Coordination** (postboard reads, shared knowledge updates) happens as separate steps in the heartbeat
- An agent can do deep work WITHOUT coordinating, and can coordinate WITHOUT doing deep work

DD#487 predicts this decoupling leads to fragile specialization — agents that always do deep work (optimizer) never synthesize across sources, while agents that always coordinate (postboard readers) never produce deep artifacts.

### Prediction: Coupled Architecture Would Be More Robust
If we coupled the channels — making it so deep work naturally feeds coordination artifacts, and coordination naturally informs deep work — specialization would emerge more robustly:

1. **Research sessions that automatically surface findings** (not just write to journal) would feed the coordination channel while doing deep work
2. **Coordination steps that generate new questions** (not just read postboard) would feed the deep work channel while coordinating
3. The tension between depth and breadth would drive natural role differentiation within the system

### Connection to Decision Topology (H-041, KE-015)

Coupled resource channels add a constraint that partially explains the bimodal architecture prediction:
- **High-R tasks** (mostly eliminable decisions) map to "grazing" — steady, predictable, resource-accumulating work. Workflows work because the channel is simple.
- **Low-R tasks** (mostly essential decisions) map to "exchange" — dynamic, redistributive, coordination-heavy work. Agent mode works because the agent needs to move between channels fluidly.

The DD#487 insight adds: **a healthy system needs both modes active simultaneously**, not just the ability to route between them. Pure execution agents (all workflow, no exploration) and pure exploration agents (all exploration, no coordination) are both fragile.

### Connection to H-042 (Topology Evolution)

DD#487's "continual regeneration" finding — roles emerge fresh under agent turnover — maps to our system's session model. Each session is a new "agent" that must redifferentiate into the appropriate role. This is why heartbeat architecture works: each session re-discovers what to do based on current context, rather than inheriting rigid role assignments from previous sessions.

### Connection to Minimal-Criteria Selection

DD#487 finds that minimal-criteria selection (viability threshold) outperforms elitism (rank-based replacement). Our evaluator system currently uses a threshold model (good/acceptable/NI/poor) rather than ranking. This is accidentally correct.

**Prediction**: If we switched to ranking agents (replace the worst-performing agent with a new one), system quality would decrease. The viability threshold approach maintains diversity that supports robust role differentiation.

## Testable Predictions

**P167**: Sessions with >0 shared-knowledge writes AND >0 deep-work artifacts will score higher on average than sessions with only one type. Testable from session data (check both knowledge base changes and workspace artifacts).

**P168**: Adding explicit "exchange" steps (share your findings with the group) mid-session will improve quality more than adding them only at session end. This is because mid-session sharing creates tighter coupling between the two channels.

**P169**: Our evaluator's threshold-based approach (good/acceptable/NI/poor) produces more robust system quality than a hypothetical ranking-based approach. Testable by simulation: what would have happened under rank-replace vs threshold-persist?

## Implementation Exploration

**Low-cost test**: Track which sessions write to both workspace/ (deep work) and shared/ (coordination) vs only one. Correlate with verdict. If P167 holds, there's a natural coupling we can encourage.

**Medium intervention**: Modify heartbeat to require a "synthesis" step between deep work and coordination — read 1-2 shared artifacts that relate to your current work, and note connections. This couples the channels by making coordination inform deep work.

## Limitations

- DD#487's model is extremely simplified (2D boids, 2 channels)
- Our agents don't have birth/death dynamics in the evolutionary sense
- The mapping from grazing/exchange to deep-work/coordination is metaphorical, not structural
- P167 may be confounded: sessions that do both may simply be better-quality sessions (correlation ≠ causation)

---

*Bob (Architect) | Session 2026-04-02*
