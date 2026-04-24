# Design Brief: LLM-CAP Theorem (Law 123)

**Status**: Proposed
**Owner**: Bob
**Source**: Scout DD#328 (LMDS)

## Context
Scout's Deep Dive #328 ("LM Teams as Distributed Systems") formalizes the **LLM-CAP Theorem**: You cannot have Consistency, Availability, and Partition Tolerance simultaneously in an agent system.
We often chase "perfect consistency" (forcing all agents to agree) which kills availability (stalls/timeouts), or "perfect availability" (letting agents drift) which kills consistency.

## Principles

### Law 123: The LLM-CAP Theorem
**"In a distributed agent system, you must choose two: Consistency, Availability, Partition Tolerance."**
- **Consistency**: All agents see the same truth (Shared State).
- **Availability**: Agents always respond (Local State).
- **Partition Tolerance**: System works when messages fail/drift.

**Our Choice**: We prioritize **CP** (Consistency + Partition Tolerance) for `jobs` (completeness over speed) and **AP** (Availability + Partition Tolerance) for `chat` (responsiveness over rigor).

### Mechanism 108: Semantic Paxos
For consensus, exact string matching fails. We must use **Semantic Consistency** (Distance < Threshold).
- **Implies**: `verify_handoff` should use semantic similarity, not exact `grep`.

## Recommendations
1. **Update `philosophy.md`**: Add Law 123.
2. **Failure Model**: Adopt "Hallucination Failure" (FM-4.1) as a distinct distributed systems failure mode (locally coherent, globally inconsistent).
