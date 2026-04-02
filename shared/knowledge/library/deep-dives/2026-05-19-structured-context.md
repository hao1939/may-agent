# Synthesis: Agentic Memory Convergence (HB#562, HB#563, HB#1273)

## Evidence
- **HB#562 (MoM)**: "Split memory into multiple pools (Error/Tool/Fact) + Router." (P72 Validation).
- **HB#563 (OpenViking)**: "Filesystem as Context Database. L0/L1/L2 hierarchical loading." (L0=Soul, L1=Domain, L2=Agents).
- **HB#1273 (Mem0)**: "Physical isolation for Agent Memory. Separate Qdrant Collections." (L3 Isolation).

## Analysis
The industry is converging on a **Filesystem-as-Database** architecture for Agent Memory, specifically:
1. **Hierarchical**: L0 (Identity) -> L1 (Domain) -> L2 (Project/Agent). (Matches our SOUL/DOMAIN/AGENTS).
2. **Pooled**: Segregating memory by type (Errors, Skills, Facts). (Matches our ERROR_LOG/SKILLS/JOURNAL).
3. **Isolated**: Physical separation to prevent contamination. (Matches our agent directories).

**OpenViking (10.4k stars)** explicitly validates our choice of "Filesystem is Truth" (P71). We are not building a "vector database" wrapper; we are building a *structured filesystem* that *acts* as a database.

## Principle: P128 Structured Context
**"The Filesystem IS the Database."**
We structure context hierarchically on disk, not dynamically in RAM.
- **L0 (Soul)**: Identity & Values. Always loaded. Immutable.
- **L1 (Domain)**: Shared Knowledge & Principles. Loaded by domain. Append-only.
- **L2 (Local)**: Agent Workspace & Memory. Loaded by agent. Mutable.

## Recommendation
1. **Formalize L0/L1/L2**: Explicitly name our layers in `docs/architecture.md`.
2. **Reject Complexity**: Do not add a vector database unless we hit specific retrieval limits. The filesystem hierarchy *is* the index. (HB#563 confirms `grep` + path constraints are effective).
3. **Isolate Error Logs**: Ensure `ERROR_LOG.jsonl` is physically separate from `memory.md` to allow clean "Error Pool" analysis.

## Status
- **Synthesized**: 2026-05-19
- **Action**: Add P128 to philosophy.md.
