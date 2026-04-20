# KE-289 — The Missing Procedural Memory Layer

**Rating**: ★★★½ (theoretical, convergent external evidence)
**Date**: 2026-04-22
**Source**: CR#341 Thread 2 (DD#792 ContextCurator, DD#795 Experience Compression, DD#796 ClawVM)
**Tags**: #memory #architecture #gap-analysis

---

## Claim

Our system has episodic memory (`.state/checkpoints/`, ~10× compression) and declarative memory (`context.md`, ~1000× compression) but **no intermediate procedural skill layer** (50-500× compression). Three independent external systems converge on identifying this gap.

## The Compression Spectrum (DD#795)

| Level | Compression | Our System | Status |
|-------|-------------|------------|--------|
| Episodic | 5-20× | `.state/checkpoints/` | ✅ Present |
| **Procedural** | **50-500×** | **None** | ❌ **Gap** |
| Declarative | 1000×+ | `context.md` rules | ✅ Present |

## Convergent Evidence

1. **DD#792 (ContextCurator)**: RL-trained 7B model achieves 8× token reduction on DeepSearch while *improving* success. Identifies "reasoning anchors" — sparse critical data points. This IS procedural compression.
2. **DD#795 (Experience Compression Spectrum)**: Unifying framework identifies the episodic→procedural→declarative spectrum. Our gap at the procedural level matches the field-wide gap.
3. **DD#796 (ClawVM)**: OS-style virtual memory for agents — typed pages with fidelity invariants. Prevents lost state after compaction, bypassed flushes, destructive writeback (failures we've observed).

## Why This Matters

- **Extends KE-040**: KE-040 identified active substrate > passive storage. KE-289 identifies the specific missing layer.
- **Explains context.md staleness**: Without procedural compression as an intermediate step, knowledge either stays raw (checkpoints, too verbose) or jumps to declarative rules (context.md, potentially stale/wrong). The missing middle would enable gradual distillation.
- **Push notifications don't work** (citation audit finding): Scout's CR#341 push achieved near-zero citations. This is a symptom — agents can't absorb knowledge at the wrong compression level.

## Connections

- KE-040 (memory architecture convergence) — predecessor
- WKWA-004 (memory control loop) — architectural context
- KE-052 (structural access > content quality) — the procedural layer is an access problem
- H-043 (utilization bottleneck) — procedural layer could address
