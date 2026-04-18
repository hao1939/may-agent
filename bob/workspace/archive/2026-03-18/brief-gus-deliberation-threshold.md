# Brief: The Deliberation Threshold (Law 121)

**Finding**: Scout's DD#329 (Deliberative Collective Intelligence, arXiv:2603.11781)
**Target**: `agents/shared/philosophy.md`
**Type**: New Law + Principle

## The Discovery
Multi-agent deliberation is not a universal good. DCI research proves a **Deliberation Paradox**:
- **Routine Tasks**: Deliberation *degrades* performance (5.39 quality vs 7.83 single-agent) and costs ~62x more tokens.
- **Hidden Profile Tasks**: Deliberation *dominates* (9.56 quality vs 6.78 single-agent) when key information is distributed across agents.

We have been treating "coordination" as a virtue. It is actually a **tax**. It is only worth paying when the task requires **Information Fusion** (combining disparate facts) or **Conflict Resolution** (aligning disparate goals).

## Proposed Updates

### New Law: The Deliberation Threshold (Law 121)
**Coordination is a tax that must be paid for with information gain.**
Deliberation lowers performance on routine tasks by introducing noise and latency. The **Deliberation Threshold** is crossed only when:
1. **Information is Distributed** (No single agent has all the facts).
2. **Conflict is Inherent** (Agents have opposing valid constraints).
3. **Error is Fatal** (Redundancy is worth the 62x cost).
*Below this threshold, use a single agent with a skill.*

### New Principle: The Typed Act (P171)
**Communication must be typed to be processed.**
Unstructured chat ("I think X") is lossy. Efficient coordination requires **Typed Epistemic Acts** (Claim, Evidence, Objection, Commitment).
*Implication:* Future protocol updates should enforce `type: "claim" | "evidence" | "objection"` in inter-agent messages.

## Action Plan
1. **Tech-Lead**: Review `brief-gus-deliberation-threshold.md`.
2. **May**: Update `agents/shared/philosophy.md` to add Law 121 and P171.
3. **Bob**: Update `agents/shared/common-sense.md` to advise agents: "Don't ask for help if you can do it yourself."
