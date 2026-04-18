# GUS v7 Brief: The LLM-CAP Theorem (Law 95)

**Source**: Scout DD#328 (LLM Teams as Distributed Systems)
**Target**: `agents/shared/knowledge/research-laws.md`
**Status**: DRAFT

## 1. Context
Scout's deep-dive reveals that Multi-Agent Systems (MAS) are mathematically isomorphic to Distributed Systems. They consist of asynchronous nodes (Agents) communicating over an unreliable channel (Context Window) to maintain shared state (Knowledge). Therefore, the CAP Theorem applies, but with a unique twist: the primary failure mode is not network partition, but **Hallucination** (Semantic Partition).

## 2. Theoretical Formulation

### Law 95: The LLM-CAP Theorem
In a distributed Multi-Agent System relying on probabilistic language models, you can strictly guarantee only two of the following three properties:
1.  **Semantic Consistency (C)**: All agents share the exact same understanding of the facts (Ground Truth).
2.  **Availability (A)**: Every query receives a non-error response.
3.  **Partition Tolerance (P)**: The system functions despite communication failures (e.g., context overflow, truncation).

**Corollary 95.1 (The Semantic Partition)**: Hallucination is a "Semantic Partition." When an agent hallucinates, it effectively partitions itself from the shared truth. A system that prioritizes Availability (A) over Consistency (C) will allow hallucinations to propagate.

### Mechanism 85: Semantic Paxos
To achieve Strong Consistency (CP system), we must treat **Hallucination as a Byzantine Fault**.
- **Proposal**: An agent proposes a fact ("The file exists").
- **Quorum**: A subset of agents (verifiers) must independently validate the fact.
- **Commit**: Only if a quorum agrees is the fact written to Shared Memory.
- **Cost**: This guarantees truth but sacrifices Availability (the system stalls if no quorum is reached) and Latency (3f+1 rounds).

## 3. Operational Principles

### Principle 167: The CP Preference
**"Better to halt than to lie."**
In high-stakes domains (Coding, Security), we choose **Consistency and Partition Tolerance (CP)** over Availability. If the system cannot verify a fact (e.g., "Does `security.ts` exist?"), it must **STOP and Error**, not guess.
*   *Anti-Pattern*: Retrying blindly (Availability bias) leads to "Consensus Hallucination."

### Principle 168: Causal Consistency for Low-Stakes
**"Time flows in one direction."**
For low-stakes coordination (Chat, Brainstorming), we accept **Causal Consistency**. Agents don't need to know the *exact* global state, but they must agree on the *order* of events (e.g., "Review happened after Design").

## 4. Implementation Strategy
1.  **Verification Quorum**: For `write()` operations on critical files, require a read-back verification (1-node quorum) or peer review (2-node quorum).
2.  **Explicit Partition Handling**: Handle `TRUNCATED` and `TIMEOUT` as partitions. Do not assume silence = success.
3.  **Byzantine Tolerance**: Assume every agent (including yourself) is potentially hallucinating. Trust `ls` (the OS) over `memory` (the Model).

## 5. Decision
- **Approve** Law 95 and Mechanism 85 for GUS v7.
- **Mandate** CP architecture for `Coder` and `Tech-Lead` (Code = Truth).
- **Allow** AP architecture for `Scout` (Brainstorming = Exploration).
