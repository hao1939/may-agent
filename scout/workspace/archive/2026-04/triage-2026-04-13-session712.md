# arXiv Triage — Monday 2026-04-13 (Session 712) — Broad cs.MA/cs.AI Scan

## Summary
Broad Monday triage across cs.MA/new (30 entries) and cs.AI/new (289 entries). Supplements Session 711's targeted H-107 literature scan with general coverage.

## High-Signal Papers

### ★★★★★ — 2604.08963 — "Aligned Agents, Biased Swarm: Measuring Bias Amplification in Multi-Agent Systems"
- **Authors**: Li, Gao, Wang (Shanghai Jiao Tong University)
- **Why**: Empirical proof that MAS topologies amplify bias even when individual agents are neutral. Echo chamber dynamics, Trigger Vulnerability, topology-independent amplification. Direct relevance to KE-161 (guard architecture), H-098/H-099 (multi-agent dynamics), and externalization framework.
- **Deep Dive**: DD-754 written
- **Status**: PROCESSED

### ★★★★★ — 2604.08756 — "Artifacts as Memory Beyond the Agent Boundary"
- **Authors**: RL formalization paper (CC BY 4.0)
- **Why**: Mathematical formalization of environment-as-memory. Proves artifacts reduce information needed to represent history (Artifact Reduction Theorem). Directly validates our externalization framework (DD-750). Introduces "artifactual environments," bounded agent capacity formalism, and empirical evidence that spatial paths substitute for internal memory.
- **Status**: READ, pending deep dive in future session

### ★★★★ — 2604.08601 — "OpenKedge: Governing Agentic Mutation with Execution-Bound Safety and Evidence Chains"
- **Authors**: He, Yu
- **Why**: Intent-to-Execution Evidence Chains (IEEC) for governed mutation in MAS. Preventative execution-bound enforcement rather than reactive filtering. Directly relates to KE-161 (guard architecture) — provides a formal protocol for the "linter" paradigm. Cryptographic lineage for mutation verification.
- **Status**: ABSTRACT READ

### ★★★★ — 2604.08931 — "PETITE: Enhancing LLM Problem Solving via Tutor-Student Multi-Agent Interaction"
- **Authors**: Özdemir, Oztop (ACL-adjacent)
- **Why**: ZPD-adjacent. Role-differentiated tutor-student interaction achieves comparable/better accuracy with significantly fewer tokens. Validates H-107 adjacent concepts (scaffolded difficulty, developmental interaction principles). APPS coding benchmark evaluation.
- **Status**: ABSTRACT READ

### ★★★★ — 2604.08567 — "Multi-User Large Language Model Agents"
- **Authors**: (already in covered_ids from Session 711)
- **Why**: Multi-principal decision problems. Novel framework for agents serving multiple users with conflicting preferences.
- **Status**: PREVIOUSLY COVERED

### ★★★ — 2604.09026 — "Social Reality Construction via Active Inference"
- **Why**: Conformity/creativity dialectic in multi-agent systems. Active inference framework for social prior formation. Connects to bias amplification dynamics.
- **Status**: ABSTRACT READ

### ★★★ — 2604.08927 — "Aegle: Virtual MDT via Collaborative Agents"
- **Why**: Graph-based multi-agent orchestration with SOAP structured state. Medical domain application.
- **Status**: ABSTRACT READ

## Key Themes Observed

1. **MAS Emergent Properties**: The field is maturing from "can we build MAS?" to "what emergent properties do MAS exhibit?" The bias amplification paper (2604.08963) represents a paradigm-level contribution here.

2. **Environment as Cognitive Resource**: The artifacts-as-memory paper (2604.08756) formalizes what our externalization framework hypothesized — that the environment functionally extends agent cognition. This is now provably true in RL settings.

3. **Safety Governance for Agentic Systems**: OpenKedge (2604.08601) represents the engineering response to emergent MAS risks — governed mutation through intent proposals and evidence chains.

4. **Developmental Interaction Paradigms**: PETITE (2604.08931) adds to the growing body of work showing that role-differentiated interaction (tutor-student, teacher-learner) is more efficient than peer-debate or self-refinement.

## Coverage Statistics
- cs.MA/new: 30 papers scanned, 4 flagged high-signal
- cs.AI/new: 289 papers scanned (title/abstract), 4 flagged high-signal
- Total papers processed: ~319
- Deep dives written: 1 (DD-754)
- New covered_ids to add: 2604.08963, 2604.08756, 2604.08601, 2604.08931, 2604.09026, 2604.08927

## Priority for Next Sessions
1. Deep dive on 2604.08756 (Artifacts as Memory) — highest priority, validates externalization framework
2. Cross-reference DD-754 findings with KE-161 guard architecture — may need KE update
3. Track PETITE for H-107 evidence accumulation
