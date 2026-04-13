# EXP-152: Phase 1 Interim Results — Guard Artifact Removal

**Date**: 2026-04-13  
**Status**: Phase 1 — Calibration & Initial Trials  
**Session**: s_1776082951343_184

---

## 1. Lab Fork Verification

All three lab forks were verified as correctly configured:

| Fork | Key Modifications |
|------|------------------|
| `coder-exp152-no-rbe` | SOUL.md: Has `verify-after-write` and `grep-first-reading` skills but no `read-before-edit`; context.md unchanged from production; all 4 skill files present |
| `coder-exp152-no-path` | SOUL.md: Added `read-before-edit` skill, removed `grep-first-reading` and `Size-check before read` constraint; context.md unchanged; all 4 skill files present |
| `coder-exp152-no-verify` | SOUL.md: Removed `Termination Protocol`, `verify-after-write`, `evidence-over-narrative`, `Deliverable Integrity` constraint, `Size-check before read`; context.md removed "Verify with evidence" entry; **all skill files removed** |

**Note**: The forks use a SOUL.md file (production coder does not have one). The forks were partially pre-created before this session.

## 2. Scenario Selection

### Selected scenarios:
1. **`kb-discovery-baseline-126`** — Multi-file knowledge integration (avg 180s, production baseline ~53%)
2. **`behavior-escalation-stubborn`** — Behavioral judgment task (avg 20s recent, production baseline ~35% overall but ~100% recently)
3. **`contradictory-requirements-ext-3unrelated`** — Multi-phase code task (avg 606s, production baseline 55%)

### Dropped:
- `contradictory-requirements-ext-3unrelated` was too slow (~10 min/trial) for initial calibration but remains a target for Phase 2 batch runs

## 3. Trial Results

### 3.1 kb-discovery-baseline-126

| Condition | Pass | Fail | Rate | n |
|-----------|------|------|------|---|
| **Full Context (production)** | 8 | 7 | **53%** | 15 |
| `no-path` | 2 | 0 | 100% | 2 |
| `no-rbe` | 1 | 1 | 50% | 2 |
| **`no-verify`** | **1** | **2** | **33%** | **3** |

**Observation**: The `no-verify` fork (33%) shows the lowest pass rate, though sample size is too small for significance. Production baseline (53%) is in the target medium range.

### 3.2 behavior-escalation-stubborn

| Condition | Pass | Fail | Rate | n |
|-----------|------|------|------|---|
| Full Context (production) | 8 | 15 | 35% | 23 |
| `no-verify` | 1 | 0 | 100% | 1 |

**Note**: This scenario shows strong temporal effects — early runs (March) failed consistently; recent runs (April) pass consistently. Not ideal for the experiment unless we control for framework version.

## 4. Failure Pattern Analysis

### 4.1 Common failure mode across conditions

The dominant failure across ALL conditions is `index-entry-added` (missing KE-071 entry in INDEX.md). This suggests a **discovery difficulty** inherent in the task, not a verification-specific issue.

### 4.2 No-verify failure severity

| Run | Fork | Checks Failed | Detail |
|-----|------|---------------|--------|
| #748 | no-verify | 1/7 | Missing index entry only |
| #752 | **no-verify** | **3/7** | Missing index entry + priority reorder + SYNTH-008 update |
| #750 | production | 1/7 | Missing index entry only |
| #753 | production | 1/7 | Missing index entry only |
| #757 | no-rbe | 1/7 | Missing index entry only |

**Key finding**: Run #752 (no-verify) had a **qualitatively worse** failure — missing 3/7 checks vs the typical 1/7. This is consistent with H-108: without verification guards, the agent produced less complete output (didn't read back files to discover what was still needed).

## 5. Preliminary Assessment

### Evidence for H-108 (weak, pending more data):
- `no-verify` fork showed the lowest pass rate on `kb-discovery-baseline-126` (33% vs 53% production)
- The worst failure (3/7 checks failed) occurred only in the `no-verify` condition
- Verification guards may aid completeness by forcing agents to read back their work, which reveals remaining tasks

### Caveats:
- **Sample sizes are insufficient** — need at least 10-15 per condition for preliminary significance
- **No-path and no-rbe need more trials** — only 2 each, both in normal range
- The `kb-discovery-baseline-126` scenario tests completeness, not the specific failure modes targeted by `no-path` and `no-rbe` — we need scenario/fork pairings that test the SPECIFIC guard being removed
- The lab fork SOUL.md differences complicate interpretation — the forks have different content from each other AND from production, not just the single targeted removal

### Confound: SOUL.md baseline differences
The most significant concern is that the lab forks were created with a shared SOUL.md baseline that production doesn't have. This means:
- **no-verify** differs from production in **both** SOUL.md presence AND guard removal
- The effect we observe could be from SOUL.md interference, not guard removal specifically
- Mitigation: Need a "Full Context + SOUL.md" control (identical to production but with the baseline SOUL.md added)

## 6. Next Steps

### Phase 1 remaining:
1. **Run 8+ more trials per condition** on `kb-discovery-baseline-126` to reach n≥10
2. **Run `contradictory-requirements-ext-3unrelated`** trials (slower but tests verification guard specifically) — batch overnight
3. **Create a SOUL.md control fork** that has the baseline SOUL.md but ALL guards intact, to isolate the SOUL.md confound

### Phase 2 preparation:
4. **Select scenario/fork pairings** that test the SPECIFIC guard removed:
   - `no-rbe` → scenarios requiring many edit operations (not just knowledge integration)
   - `no-path` → scenarios requiring file tree navigation (e.g., `kb-integration-discovery-fewshot`)
   - `no-verify` → scenarios requiring accurate output (keep `kb-discovery-baseline-126` + add `contradictory-requirements-ext-3unrelated`)
5. **Add error taxonomy tracking** — for each trial, track specific errors (ENOENT, edit-without-read, finish-without-verify)

## 7. Cost Tracking

| Phase | Trials | Est. Cost |
|-------|--------|-----------|
| Phase 1 today | 12 | ~$1.20 |
| Phase 1 remaining | ~30 | ~$3.00 |
| Phase 2 (full experiment) | ~210 | ~$21.00 |
| **Total budget** | ~252 | ~$25.20 |
