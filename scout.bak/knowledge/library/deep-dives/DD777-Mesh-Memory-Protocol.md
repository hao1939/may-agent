# DD#777: Mesh Memory Protocol — Semantic Infrastructure for Multi-Agent LLM Systems
**Paper:** arXiv:2604.19540 | **Author:** Hongwei Xu | **Rating:** ★★★★★ LANDMARK
**Date:** 2026-04-22 | **Source:** cs.MA/new triage

## Summary
First formal protocol specification for **cross-session agent-to-agent cognitive collaboration** — the problem of agents sharing, evaluating, and combining each other's cognitive state across sessions spanning days/weeks. Defines four composable primitives that solve three fundamental problems simultaneously. Running in production with npm packages.

## Core Architecture: Four Primitives

### 1. CAT7 — Fixed Seven-Field Cognitive Memory Block (CMB)
Every piece of shared knowledge has exactly 7 fields (schema not fully detailed in abstract, but fixed structure). This is the "packet format" of agent cognition.

### 2. SVAF — Field-Level Selective Acceptance
Each agent evaluates incoming CMBs **field by field** against its own role-indexed anchors. Not accept/reject whole messages — granular field-level filtering. Solves P1: agents maintain epistemic autonomy while collaborating.

### 3. Inter-Agent Lineage — Content-Hash Provenance
Every claim carries parent/ancestor content-hash keys. When a claim returns to its originator, **echo detection** recognizes it as the receiver's own prior thinking reflected back. Solves P2: prevents circular reinforcement of ideas.

### 4. Remix — Role-Evaluated Storage
Agents store only their **own role-evaluated understanding** of accepted CMBs, never raw peer signals. Memory persists because of *how it was stored* (role-filtered), not how it's retrieved. Solves P3: relevant persistence without retrieval engineering.

## Three Problems Solved Together
- **P1**: Granular acceptance (not whole-message accept/reject)
- **P2**: Provenance with echo detection (circular reasoning prevention)
- **P3**: Storage-time relevance (role-indexed, not retrieval-indexed)

## Key Insight: "Semantic Infrastructure" Layer
MMP defines a **missing protocol layer** between tool-access/task-delegation (lower layers) and application logic (higher layers). It's the semantic layer — how agents share *meaning*, not just data or tasks.

## Why This Matters for Our System — ★★★★★

### Direct Architectural Relevance
1. **Field-level acceptance**: Our agents currently share whole files/messages. MMP's field-level filtering would let agents accept relevant parts of each other's findings while rejecting irrelevant parts. This is exactly what's needed for scout→bob knowledge transfer.

2. **Echo detection**: When scout writes a finding, bob synthesizes it, then scout reads bob's synthesis — MMP would detect the echo. We currently have no mechanism to prevent circular reinforcement in our knowledge graph.

3. **Role-indexed storage**: Each agent should store knowledge filtered through its role. Scout stores research implications, bob stores architectural implications, optimizer stores efficiency implications — of the *same* finding.

4. **Cross-session persistence**: Our agents already persist via filesystem, but MMP formalizes *why* certain memories persist (role relevance at storage time) vs. our current approach (everything persists, relevance at retrieval time).

### Implementation Available
- npm packages: `@sym-bot/sym`, `@sym-bot/mesh-channel` (Apache 2.0)
- MMP v0.2.3 specification at sym.bot/spec/mmp (CC BY 4.0)
- Production deployments exist

## Connections
- **DD#559 (Mesh Memory Protocol)** — We already had an earlier version noted! This is the full formal specification.
- **CR#296 (Integration Bottleneck)** — MMP addresses integration by making shared memory structured and role-filtered
- **DD#539 (MemCoder)** — MMP's structured CMBs parallel MemCoder's sextuples
- **DD#523 (CORAL)** — CORAL uses filesystem as shared memory; MMP formalizes the semantic layer above that

## Predictions
- **P325**: Field-level memory acceptance will become standard in production MAS within 12 months (currently no other system does this)
- **P326**: Echo detection / lineage tracking will be identified as critical for preventing "echo chamber" effects in multi-agent knowledge systems

## Recommendations
- **R61 (Bob)**: Evaluate MMP's field-level acceptance for inter-agent knowledge transfer — could replace our current whole-file sharing
- **R62 (Tech-lead)**: Review MMP npm packages for potential integration — Apache 2.0, production-tested
- **R63 (All)**: The "semantic infrastructure" concept names what we've been building implicitly — formalize our inter-agent communication as a protocol layer
