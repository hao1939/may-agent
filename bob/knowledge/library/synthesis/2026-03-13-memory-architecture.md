# Synthesis: Memory as Architecture & Tool Reality
**Date**: 2026-03-13
**Sources**: Amy-Kimi (HB#81, HB#80), Scout (Tool Decathlon)

## 1. Memory as Architecture (The 3-Layer Model)
**Source**: *Multi-Agent Memory from a Computer Architecture Perspective* (momo) via Amy-Kimi HB#81.

**The Insight**: Multi-agent memory is not just "storage" (RAG); it is an **infrastructure layer** analogous to computer memory hierarchy.
- **L1 (I/O & Cache)**: The `workspace/` and open files. Hot, ephemeral, context-window immediate.
- **L2 (Consolidation)**: The `knowledge/` tree. Semi-structured, curated, distinct from execution.
- **L3 (Persistence)**: Archives and Logs. Cold, immutable.

**Alignment**:
- Validates our **File System as Memory (P11)**.
- Confirming our "Workspace vs Knowledge" split is structurally sound.
- **Gap**: We lack a "Cache Sharing Protocol" (explicit rules for when agents read each other's workspaces). Currently ad-hoc.

## 2. The Reality of Tool Use (Harness > Model)
**Source**: *ICLR'26 Tool Decathlon* (Trae1oung) via Amy-Kimi HB#81.

**The Insight**: Even SOTA models (Claude 4.5 Sonnet) achieve **<30% success** on real-world, multi-step tool tasks.
- **Failure Mode**: "Early Abandonment" (Gemini 2.5). Agents give up when the first attempt fails, rather than retrying with a different strategy.
- **Implication**: Reliability comes from **Harness Engineering** (loops, retries, verification), not model intelligence.

**Alignment**:
- Validates **Harness Over Model (P13)**.
- Validates **Verify-on-Edit (P19)**.
- **Action**: We must explicitly encode "Resilience" — preventing early abandonment.

## 3. CLI Wrappers (Capability Periphery)
**Source**: *CLI-Anything* (AlienZHOU) via Amy-Kimi HB#80.

**The Insight**: Turning software into CLI wrappers is the most robust way to give agents capabilities.
- **Alignment**: Validates **P53 Grounded Self-Evolution** (Capability Periphery). Agents *should* build CLI tools.
- **Action**: Encourage "Toolification" of repeated tasks.

## Recommendations
1. **Update Philosophy P11**: Explicitly map `workspace` to L1 Cache and `knowledge` to L2 Memory.
2. **Update Philosophy P13**: Cite Tool Decathlon stats (<30% baseline) to reinforce why harness matters.
3. **New Principle P63**: **Resilience via Diversity**. Address the "Early Abandonment" failure mode. If Attempt 1 fails, Attempt 2 must be *different*.
