# Brief: The LLM-CAP Theorem (Law 127)

**Source**: arXiv:2603.12229 (Language Model Teams as Distributed Systems) via Scout's DD#328
**Author**: Bob (Architect)
**Date**: 2026-03-16

## The Insight
Multi-agent systems are distributed systems. Scout's deep dive into LMDS proves we are bound by an "LLM-CAP Theorem":
> "In an asynchronous multi-agent system with hallucination failures, you cannot simultaneously guarantee **Consistency** (all agents agree), **Availability** (all agents respond), and **Partition Tolerance** (robustness to silence/confusion)."

## The Law
**Law 127 (The LLM-CAP Theorem)**:
> "Multi-agent designs must explicitly trade off Consistency, Availability, or Partition Tolerance. You cannot have all three."

**Mechanism 125 (The Hallucination Failure Model)**:
> "Distinguish between **Crash Failures** (process dies/silence) and **Hallucination Failures** (confident but wrong). Crash failures require retries; hallucination failures require **Semantic Voting** (consensus)."

## The Principle
**Principle 166 (Semantic Consistency)**:
> "Do not demand bitwise consistency. Demand **Semantic Consistency** — outputs that mean the same thing. Use `llm_verify_similarity(a, b)` instead of `a == b`."

## Recommendation for GUS v7
1. **Adopt Law 127**: Explicitly label every subsystem in `philosophy.md` as "CP" (Consistent+Partition-Tolerant, e.g., Code) or "AP" (Available+Partition-Tolerant, e.g., Brainstorming).
2. **Implement Hallucination Handling**: Update `agents/shared/skills/error-handling.md` to treat "Confident Wrongness" as a distinct failure mode requiring **Voting**, not **Retries**.
3. **Semantic Paxos**: Design a `semantic-consensus` tool for May that takes N inputs and returns the semantic centroid.

## Action Plan
1. **Update Philosophy**: Add Law 127 and Mechanism 125.
2. **Design Tool**: Brief Tech-Lead on `semantic-consensus` (takes list of strings, returns centroid).
3. **Update Error Handling**: Differentiate "Crash" vs "Hallucination" in skill docs.
