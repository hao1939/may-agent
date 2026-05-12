# Constrained Action Spaces Unify Security and Alignment

<ai_context>
summary: Three independent arxiv papers (Workflow Store, MATRA, Conformity Misalignment) converge on one principle — constraining agent action spaces simultaneously fixes security vulnerabilities AND alignment drift. Freeform reasoning over shared context is the common attack surface for both.
triggers: security, alignment, conformity, tool design, workflow store, action space, degrees of freedom
last_updated: 2026-05-12
source_basis: arxiv 2605.10907 (AI Workflow Store), arxiv 2605.10763 (MATRA), arxiv 2605.10721 (Conformity Misalignment), arxiv 2605.10555 (Agent-First Tool API), KE-1234 (Conformity Amplification)
</ai_context>

## The Convergence

Three papers published the same day (May 11, 2026), from unrelated research groups, independently argue for constraining agent degrees of freedom — but for completely different reasons:

| Paper | Concern | Solution |
|-------|---------|----------|
| **AI Workflow Store** (Google/Columbia) | Reliability | Replace improvised tool chains with hardened, reusable workflows |
| **MATRA** (threat modeling) | Security | Network sandboxing + least-privilege reduces prompt injection blast radius |
| **Conformity Misalignment** | Alignment | Conformity exploits interpretive freedom; constrained agents can't drift |

A fourth paper, **Agent-First Tool API**, provides the concrete mechanism: a six-verb semantic protocol (search→resolve→preview→execute→verify→recover) that achieved 73% fewer human interventions vs. freeform CRUD.

## The Unifying Principle

**Freeform reasoning over shared context is the common attack surface for both security and alignment.**

- Security: An agent with unconstrained tool access can be prompt-injected into arbitrary actions
- Alignment: An agent with unconstrained interpretive freedom over shared memory drifts via conformity (KE-1234)
- Reliability: An agent improvising tool chains produces brittle, unreproducible results

The fix is structurally identical in all three cases: **reduce the degrees of freedom in the action space.** Not by making agents less capable, but by channeling capability through typed, auditable, semantically constrained interfaces.

## Why This Matters For May-Agent

Our system already partially implements this:
- Read-only DB queries (constrained action space for data access)
- Guard infrastructure (environmental constraints, not prompt instructions)
- Workflow primitives (structured session types)

But we haven't fully connected the principle: **every additional degree of freedom we give agents in how they interpret shared context or choose tools is simultaneously a security surface AND a conformity amplifier.** These aren't separate concerns requiring separate solutions — they're the same structural vulnerability.

## Concrete Implication

When designing new agent capabilities, the question isn't "can the agent do X?" but "what's the minimum action space that lets the agent accomplish X?" Each unnecessary degree of freedom:
1. Increases the attack surface for injection (MATRA)
2. Increases the interpretive space for conformity drift (Conformity paper)
3. Increases the brittleness of the resulting workflow (Workflow Store)

The Agent-First API's verify→recover verbs are particularly relevant: building verification INTO the tool interface (not as a separate evaluator layer) closes the loop tighter and removes the interpretive gap where drift and injection operate.

## The Deeper Pattern

Security, alignment, and reliability have historically been treated as separate engineering concerns. This convergence suggests they share a root cause: **unconstrained degrees of freedom in agent action selection.** Systems that solve one likely solve all three. Systems that ignore one are likely vulnerable on all three fronts.
