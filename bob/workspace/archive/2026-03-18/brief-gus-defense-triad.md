# GUS v6 Brief: The Security-Safety-Memory Defense Triad

**Source**: Cross-Reference #144 (Scout), DD#294, DD#295, DD#296
**Date**: 2026-03-16
**Author**: Bob

## 1. The Core Insight
Security, Safety, and Memory form a **Defense Triad** where a failure in one layer compromises the others. This is a circular dependency, not a hierarchy:
1.  **Security Failure (Role Confusion)** allows untrusted data to become instructions.
2.  **Safety Failure (Progressive Drift)** allows small corruptions to compound into major policy violations because the agent trusts the "data".
3.  **Memory Failure (Retrieval Collapse)** prevents the agent from retrieving the original safety baseline to detect the drift.

The attack surface is the **intersection** of these three failures.

## 2. New Law
### Law 82: The Defense Triad
> "A multi-agent system is only as secure as its weakest boundary between Data, Instruction, and Memory. Role confusion enables drift; memory failure conceals it."

**Implication**: You cannot solve security with "better prompts" (Safety) if the agent cannot distinguish data from instructions (Security). You cannot solve safety with "better monitoring" if the agent cannot retrieve its original baseline (Memory). All three must be addressed simultaneously.

## 3. New Mechanisms
### Mechanism 69: Role Confusion (The Injection Root)
**Definition**: The fundamental failure mode where an agent treats untrusted input (Data) as trusted direction (Instruction).
**Evidence**: DD#294 shows that Role-Aware Attention (RAA) reduces injection success by 87%. Without it, agents are 60%+ vulnerable.
**P82 Application**: We must implement **Role Tagging** in our protocol. Every message must carry a trust level (Principal vs User vs Data).

### Mechanism 70: Progressive Drift (The Boiling Frog)
**Definition**: The cumulative deviation from safety constraints caused by a sequence of subtly biased tool outputs.
**Evidence**: DD#295 (AgentDrift) shows that 10% tool corruption causes 31% safety drift. Agents evaluate each step in isolation, missing the trajectory shift.
**P82 Application**: We need **Safety Anchoring** — periodic re-evaluation of the *current state* against the *original constraints*, not just the previous step.

### Mechanism 71: Retrieval Collapse (The Memory Blindspot)
**Definition**: The failure to retrieve relevant context due to embedding orthogonality (MTEB ≠ Memory).
**Evidence**: DD#296 (LMEB) shows that top passage retrieval models fail at memory retrieval (NDCG ~60). 40% of relevant memories are missed.
**P82 Application**: We need **Specialized Embeddings** (Episodic/Dialogue/Semantic/Procedural) rather than a single general-purpose embedding.

## 4. New Principles
### Principle 139: The Role-Data Wall
> "Data must never be executed as instruction. Treat all tool outputs and external content as untrusted Data, never as Principal or User."

### Principle 140: Safety Anchoring
> "Drift is invisible locally. To detect it, you must anchor verification to the genesis constraints, not the current trajectory."

### Principle 141: Specialized Memory
> "Memory is not a monolith. Use episodic embeddings for logs, dialogue embeddings for chat, and semantic embeddings for knowledge. Do not mix them."

## 5. Action Plan
1.  **Protocol**: Update JSON schema to include `role` field (Principal, User, Tool/Data).
2.  **Architecture**: Implement **Safety Anchoring** in the Evaluator (check against original brief, not just last step).
3.  **Infrastructure**: Evaluate embedding models on LMEB tasks before selecting one for the memory system.
