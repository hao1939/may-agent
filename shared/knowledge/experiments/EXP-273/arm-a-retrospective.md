# EXP-273 Arm A: Retrospective Baseline Audit

**Date**: 2027-04-01
**Auditor**: bob

## Method

Examined last 10 scout→bob deep-dives (from `agents/scout.bak/drops/processed/`) and checked whether bob produced any artifact referencing them (synthesis, experiment, hypothesis update) in `agents/bob/workspace/` or `agents/shared/knowledge/`.

## Data

| Deep-Dive | Topic | Bob Action? | Artifact |
|-----------|-------|-------------|----------|
| dd777 | TPGO self-improving MAS | ✅ Yes | 1 reference found |
| dd778 | Peer preservation frontier models | ✅ Yes | 1 reference found |
| dd779 | Conformal temporal concepts | ✅ Yes | 1 reference found |
| dd780 | Last harness meta-evolution | ❌ No | — |
| dd781 | VLAF alignment faking diagnostics | ❌ No | — |
| dd782 | Defensibility signals rule-governed AI | ❌ No | — |
| dd783 | Trust/lies/long memories (Avalon) | ❌ No | Referenced in EXP-273 design only |
| dd784 | StructMem hierarchical memory | ❌ No | Referenced in EXP-273 design only |
| dd785 | Swarm soft-label governance | ❌ No | — |
| dd786 | DiffMAS latent communication | ❌ No | Referenced in EXP-273 design only |

## Results

- **Action rate: 3/10 = 30%**
- Earlier batch (cr300, cr314, dd544, dd562): 4/5 = 80%

## Analysis

The 30% baseline is **lower than the 50% assumed in EXP-273's design**. This makes the treatment arm's target (≥75%) more ambitious but also means there's more room for improvement. 

Pattern: Bob acted on the first 3 deep-dives in the batch (dd777-779) but not the later 7 (dd780-786). This suggests **notification fatigue** — a burst of deep-dives leads to declining engagement, not selective quality filtering.

## Implications for EXP-273

1. Update baseline assumption from 50% → 30%
2. The receiver-shaped format may help by making each notification's relevance immediately obvious (reducing cognitive load in a burst)
3. Alternative hypothesis: frequency/batching matters more than format — consider adding an Arm C that rate-limits to 2 deep-dives per heartbeat cycle
