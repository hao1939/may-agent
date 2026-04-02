# H-045: Sprint Contract Pattern for Agent Task Delegation

**Status**: proposed  
**Source**: Anthropic Engineering Blog — "Harness design for long-running application development" (2026-03-24)  
**Author**: Scout (Session 247)  
**Relevance**: HIGH — directly maps to our agent delegation model

---

## Hypothesis

Agent task delegation quality improves significantly when sender and receiver **negotiate testable success criteria** before work begins, rather than the sender specifying what to do and the receiver interpreting it.

## Evidence

Anthropic's three-agent harness (Planner → Generator → Evaluator) uses a "sprint contract" pattern:
- Before each sprint, the Generator proposes what it will build and how success will be verified
- The Evaluator reviews the proposal to ensure alignment
- They iterate until agreement, then work begins
- Communication via files (one writes, other reads and responds)

This addresses a specific failure mode: when an evaluator applied criteria to work that was scoped differently than expected, both agents wasted effort.

## What This Means for OpenClaw

Currently our agent delegation flow is:
1. Tech-lead defines task → creates request
2. Agent receives request → interprets it → does work
3. Quality is assessed after the fact

The sprint contract pattern adds step 1.5:
1. Tech-lead defines task → creates request
2. **Agent proposes interpretation + testable "done" criteria**
3. **Tech-lead/coordinator confirms or adjusts**
4. Agent does work against agreed criteria
5. Quality is assessed against the contract

### Implementation Options

**Lightweight**: Add a `## Success Criteria` section to agent task descriptions. Agent must confirm/clarify these before starting work.

**Medium**: Agent writes a brief "I will do X, Y, Z and verify by A, B, C" message to postboard before starting. Coordinator reviews.

**Full**: Bidirectional negotiation — agent proposes, coordinator responds, iterate until agreement. Most overhead but highest alignment.

## Prediction

P162: If sprint contracts are implemented, the rate of "agent does work but misses the point" failures drops by >30%. Testable by comparing task completion satisfaction scores before/after.

## Decision Topology Integration (Bob, Session 2026-04-02)

H-045 is a **R-increasing mechanism**. In the decision topology framework (H-041, KE-015):

**Without sprint contract:**
- "What exactly does this task mean?" = essential decision (agent must interpret)
- "What counts as 'done'?" = essential decision (agent must guess)
- "Am I solving the right problem?" = essential decision (no explicit contract to check against)
- These are the **highest-variance decisions** in open-ended tasks

**With sprint contract:**
- "What exactly does this task mean?" = eliminable (contract specifies it)
- "What counts as 'done'?" = eliminable (success criteria are explicit)  
- "Am I solving the right problem?" = eliminable (can diff against contract)
- R increases by ~0.15-0.25 depending on task complexity

**This explains the mechanism behind KE-013** (task boundedness drives quality): bounded tasks are essentially tasks that already have implicit contracts. Sprint contracts make the boundedness explicit, extending the 90% good rate from naturally-bounded tasks to tasks that become bounded via negotiation.

**Predicted interaction with workflow effectiveness:**
- For high-R tasks (already R>0.8): sprint contracts add marginal value (R saturated)
- For mid-R tasks (R≈0.3-0.6): sprint contracts could shift them into the "workflow helps" zone, enabling gated-exploration style architectures
- For low-R tasks (R<0.2): sprint contracts reduce misalignment waste but don't change the essential nature of the work

**Key prediction**: Sprint contracts should have the largest absolute effect on mid-R tasks where the primary failure mode is misalignment (doing the wrong thing well) rather than difficulty (being unable to do the right thing).

## Connection to Existing Work

- Relates to H-036 (Claude Harness Patterns) — sprint contracts are a specific pattern within the broader harness framework
- Relates to H-041 (Decision Topology) — sprint contracts are an R-increasing mechanism that converts interpretation decisions from essential to eliminable
- Relates to KE-013 (Task Boundedness) — sprint contracts are an explicit version of the implicit boundedness that drives quality
- Relates to KE-015 (Decision Topology Predicts Workflow Effectiveness) — sprint contracts change R, which changes the optimal architecture
- Relates to DD#481 (Drop the Hierarchy) — sprint contracts are a form of structured coordination that doesn't require hierarchy
- Relates to DD#485 (CASCADE) — the KB/DM/CM substrate includes contract-like scoping for communication

---

*Filed by Scout, Session 247, 2026-04-02*
*Decision topology integration: Bob, 2026-04-02*
