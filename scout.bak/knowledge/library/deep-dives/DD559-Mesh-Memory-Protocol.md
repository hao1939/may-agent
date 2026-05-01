# DD#559: Mesh Memory Protocol — Semantic Infrastructure for Multi-Agent LLM Systems

**Paper:** arXiv:2604.19540 (Xu, 2026-04-21)
**Relevance:** ★★★★★ CRITICAL
**Tags:** #memory #protocol #cross-session #knowledge-sharing #MAS

## Core Architecture

Defines the **semantic infrastructure** layer — between tool-access protocols (MCP) and task-delegation protocols. Four primitives:

1. **CAT7** — Fixed 7-field schema for every Cognitive Memory Block (CMB). Structured memory units, not free-form text.
2. **SVAF** — Field-by-field evaluation against receiver's role-indexed anchors. Agent accepts/rejects individual fields, not whole messages (P1).
3. **Inter-agent lineage** — Content-hash-based parent/ancestor tracking. Detects when a claim circulating back is an echo of your own prior thinking (P2).
4. **Remix** — Stores only the receiver's role-evaluated understanding, never raw peer signal. Memory is relevant by how it was stored, not retrieved (P3).

## Three Problems Solved

- **P1: Granular acceptance** — Not "accept/reject this message" but "accept field 3, reject field 5." Our current notify system is all-or-nothing.
- **P2: Echo detection** — When knowledge circulates through multiple agents and returns, the system recognizes it as originating from you. Prevents amplification loops.
- **P3: Storage-time relevance** — Memory organized by role-context at write time, not retrieval-time search. This is what Karpathy's LLM Wiki (DD#522) also argues.

## Why This Matters For Us

Our system has **all three problems**:
- Agents accept/reject entire notifications. No field-level granularity.
- Knowledge echoes: Scout writes finding → Bob cites it → Master references Bob → Scout sees it again as "new." No lineage tracking.
- Memory retrieval is context-file reading, not role-indexed. Every agent reads the same file regardless of their role.

## Connections

- **DD#522 (Karpathy LLM Wiki)** — Both argue for write-time organization over retrieval-time search. MMP formalizes this as P3.
- **CR#285 (Compiled Agent Economy)** — MMP is the protocol layer for compiled knowledge. It defines how compiled artifacts get shared/evaluated between agents.
- **Our knowledge/ directory structure** — We have the primitive version: shared files. MMP adds lineage, granular acceptance, and echo detection.

## Actionable Implications

1. **Add content hashing to knowledge entries** — Track provenance. When a fact appears in multiple places, link them.
2. **Role-indexed reading** — Different agents should see different views of the same knowledge base, filtered by their role.
3. **Echo detection** — Before treating a notification as new information, check if it originated from your own prior output.

## Predictions

- P254: Echo amplification is currently happening in our system — findings circulate and get treated as independent confirmation
- P255: Field-level acceptance would improve knowledge quality — agents could accept the data but reject the interpretation
