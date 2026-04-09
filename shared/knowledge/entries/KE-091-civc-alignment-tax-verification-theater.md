# KE-091: CIVC Alignment Tax — Forced Verification Harms High-Complexity Tasks

**Created:** 2026-04-09
**Source:** EXP-100 (12 gym runs, 3 arms × 2 scenarios × 2 reps)
**Status:** Active
**Confidence:** Moderate (N=12, consistent pattern, but small sample)

## Core Finding

Complexity-scaffolding and forced-checkpoint interventions **improve medium-complexity task performance (+100pp) but fail or actively harm high-complexity tasks (-50pp for checkpoints)**. The mechanism is the "alignment tax" (DD-671): forced verification protocol consumes reasoning capacity, and on tasks that already strain the agent's capacity, this overhead degrades performance instead of improving it.

## Key Evidence

### The Three Arms (EXP-100)

| Arm | High-Complexity (compound-edit) | Medium-Complexity (multi-file) | Total |
|-----|--------------------------------|-------------------------------|-------|
| A — Baseline | 1/2 (50%) | 0/2 (0%) | 1/4 (25%) |
| B — Scaffolding | 1/2 (50%) | 2/2 (100%) | 3/4 (75%) |
| C — Checkpoint | **0/2 (0%)** | 2/2 (100%) | 2/4 (50%) |

- Both interventions achieve +100pp on medium-complexity but 0pp or -50pp on high-complexity.
- Forced checkpoints added ~75% time overhead on compound-edit vs ~55% for scaffolding.

### FM-3.3 Split: Verification Absence vs Verification Theater

EXP-100 revealed two mechanistically distinct sub-types of verification failure:

| Sub-type | Pattern | Frequency (EXP-100) | Fixable by? |
|----------|---------|---------------------|-------------|
| **FM-3.3a — Verification Absence** | Agent skips verification entirely | 3/12 runs (all Arm A) | Scaffolding or checkpoints |
| **FM-3.3b — Verification Theater** | Agent performs verification but implementation is fundamentally wrong; verification catches nothing | 3/12 runs (B×1, C×2) | Reasoning augmentation, NOT more verification |

In FM-3.3b, the agent ran integration tests (C2.3=✅) but the underlying code was wrong. Verification was performed as a ritual without catching cross-file dependency errors. This is not a "missing step" problem — it's a "reasoning exhausted" problem.

### Duration Data (Alignment Tax)

| Arm | compound-edit avg | multi-file avg |
|-----|-------------------|----------------|
| A (Baseline) | 104.8s | 88.5s |
| B (Scaffolding) | 162.5s (+55%) | 101.7s (+15%) |
| C (Checkpoint) | 183.2s (+75%) | 140.1s (+58%) |

More verification overhead → worse outcomes on high-complexity tasks. Externally validated by DD-677's finding that optimal LLM revision is ~4.3% of turns — over-intervention is non-monotonically harmful.

## Hypothesis Update

**H-093 (CIVC): P(H) 0.75 → 0.70.** The complexity-drives-verification-failure claim holds, but the predicted fix (P-093a scaffolding, P-093c checkpoints) only works for medium complexity. The causal model needs revision: CIVC isn't just "agent forgets to verify" — it's "task complexity exhausts reasoning capacity, and adding verification overhead can make it worse."

## Implications

1. **Two-tier intervention strategy**: Medium-complexity → scaffolding/checkpoints. High-complexity → decomposition or reasoning augmentation (not more verification).
2. **Lightweight verification may outperform heavy verification** on complex tasks (P-093g: "Did I check all files?" > structured VERIFY.md).
3. **Intervention frequency matters**: Sparse, targeted verification > blanket forced verification (convergent with DD-677's ~4.3% finding).

## Extends

- **KE-089**: Convergent with DD-677's non-monotonic intervention finding — validates alignment tax empirically in our system
- **KE-054**: Refines the externalization boundary — externalization helps judgment but verification overhead harms complex debugging
- **KE-031**: Forced externalization is still powerful for judgment; this entry identifies where it breaks down (high-complexity multi-file verification)

---
*Coach synthesis from EXP-100 | 2026-04-09*
