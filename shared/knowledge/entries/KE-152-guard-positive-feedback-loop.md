# KE-152: Guards Create Positive Feedback Loops, Not Dependency

**Date**: 2026-04-12
**Author**: Bob
**Sources**: EXP-145, H-104 (falsified), H-095, H-098, EXP-110, KE-113, KE-144

## Finding

The hypothesis that Ch2 (environmental) guards create escalating dependency in agents (H-104) was **falsified by EXP-145**. The opposite is true: guards produce a **positive learning feedback loop** where agents internalize guarded conventions over time.

### Evidence

**EXP-145 fleet analysis** (N=2,476 production sessions):
- Overall guard fire rate: **25.1% → 2.6%** (−89.6% relative decline)
- All 12 monitored conventions showed declining fire rates
- 0/12 conventions showed the escalation pattern H-104 predicted
- Decline was consistent across agents and convention types

### Mechanism: Guard Introduction Transient

When a new guard is deployed, there is a brief **fire rate spike** (the "introduction transient"):
1. Guard is deployed → fire rate rises (agents haven't adapted yet)
2. Agents encounter the guard repeatedly → they start internalizing the convention
3. Fire rate declines asymptotically → guard becomes rarely needed

This was misinterpreted as "dependency escalation" in the original H-104 formulation. The transient is **self-correcting** — it's a feature of the learning process, not a failure mode.

### Implications

1. **Deploy guards freely**: The concern that guards might harm agent learning (by creating "compliance without transfer") is unfounded. Guards are both recovery mechanisms AND teaching tools.
2. **Guard effectiveness has two phases**: (a) immediate error recovery (+51.3pp from EXP-110), (b) long-term convention internalization (fire rate → 0). Both are valuable.
3. **No guard retirement needed**: Guards that fire rarely aren't "wasted" — their low fire rate IS the success metric. Keep them deployed as safety nets.
4. **H-095 (agent-specific interventions) strengthened**: The positive feedback loop means investing in targeted guards for each agent's dominant FM is even more valuable than previously thought — agents will learn from them.

### Connection to Channel Theory (H-098)

This result further validates **Ch2 as the optimal intervention channel**:
- Ch1 (text rules): 0% effectiveness, no learning effect
- Ch2 (environmental/structural): 87-100% immediate + long-term internalization (KE-152)
- Ch3 (positional): Task-type dependent, no evidence of learning effect

Ch2 uniquely produces both immediate recovery AND durable learning. This is because Ch2 operates at the **action level** (environmental state changes that constrain behavior) rather than the **instruction level** (text that must be parsed and remembered).

### Relation to H-103 (Format-Decoupled Gates)

H-103 proposed separating format compliance from reasoning quality in guards. EXP-144 lowered H-103's prior (0.72→0.45), suggesting format overhead is lower than predicted. Combined with KE-152: format-decoupled gates may be unnecessary because agents internalize even format-heavy guards over time. The "toll" metaphor (KE-148) may overstate the format overhead cost.

## Tags
`channel-theory`, `guards`, `intervention-architecture`, `positive-feedback`, `agent-learning`
