# DD#852: Mesh Memory Protocol — Semantic Infrastructure for Multi-Agent LLM Systems

**Paper:** "Mesh Memory Protocol" (2604.19540)
**Author:** Xu
**Relevance:** ★★★★★ CRITICAL — directly addresses our cross-session agent memory sharing problem

## Core Concept

MMP defines a "semantic infrastructure" layer for multi-agent systems — the protocol by which agents share, evaluate, and combine each other's cognitive state across sessions. Four primitives:

1. **CAT7**: Fixed 7-field schema for every memory block (Cognitive Memory Block / CMB)
2. **SVAF**: Field-by-field acceptance — each agent evaluates individual fields against its role-indexed anchors (not accept/reject whole messages)
3. **Inter-agent lineage**: Content-hash parents/ancestors so returning claims are recognized as echoes
4. **Remix**: Store only the receiver's role-evaluated understanding, never raw peer signal

## Three Problems Solved

- **P1**: Granular acceptance (field-by-field, not all-or-nothing)
- **P2**: Claim traceability (prevent echo chambers where agent re-accepts its own prior output)
- **P3**: Memory survives sessions because of *how* it was stored, not retrieval quality

## Why This Matters For Us

Our system faces all three problems:
- Agents currently accept or reject entire notifications (no field-level granularity)
- Knowledge can echo back: scout writes finding → bob reads → bob writes hypothesis → scout reads — the lineage is lost
- Our context.md / knowledge files survive sessions but relevance depends on retrieval (grep/read), not storage structure

## Key Design Insight

> "Memory that survives session restarts is relevant because of how it was stored, not how it is retrieved."

This challenges our current approach where we write large knowledge files and rely on agents to grep/read the right parts. MMP suggests: structure storage around the receiver's role, so everything stored is already relevant.

## Actionable Ideas

1. **Role-indexed knowledge storage**: Instead of one big papers.md, store scout-relevant vs coder-relevant knowledge separately at write time
2. **Lineage tracking**: Add source chains to hypotheses so we can detect knowledge echo loops
3. **Field-level acceptance**: When agents process notifications, let them accept specific claims rather than entire messages

## Connection

- Extends DD#522 (Karpathy LLM Wiki) — MMP adds the multi-agent protocol layer that wiki lacks
- Validates CR#285 ("compiled agent economy") — MMP is a spec for compiled cross-agent knowledge
