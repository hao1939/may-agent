# EXP-154: Process Skill Effectiveness — Investigation Before Fix

**Date**: 2026-04-13
**Status**: IN PROGRESS
**Hypothesis**: H-154

## Background

The last 3 experiments (EXP-151, 152, 153) all failed to find skill effects due to ceiling effects (scenarios too easy) or floor effects (scenarios too hard). KE-175 establishes a "skill effectiveness window" requiring baseline variance and process-type skills.

### Phase 1: read-before-edit (PIVOTED)
Initial target was `read-before-edit` (4.3% baseline). Investigation revealed:
1. The scenario's environment files had NO bugs — they were already fixed
2. The success criteria required verify-after-edit, but since there were no edits to make, agents always failed
3. After fixing the environment (adding the actual bugs), the scenario now easily passes — not a good treatment target

### Phase 2: Pivoting to exp144-hidden-dep-decoupled

**exp144-hidden-dep-decoupled** has a clear, targetable failure mode:
- **Baseline**: 15% (3/20)
- **Product checks**: 5/5 in most runs (agents CAN fix the code)
- **Process checks**: Typically 1/4 (agents write a plan but don't document bugs or run pipeline after fixing)
- **Specific failures**: P2 (planning doesn't mention typo bug), P3 (planning doesn't mention checksum), P4 (doesn't run pipeline after fixes)

This is EXACTLY the kind of process failure a skill should address.

## Hypothesis

**H-154**: An "investigation-before-fix" process skill that requires documenting all discovered bugs before editing improves the process check pass rate on `exp144-hidden-dep-decoupled` by ≥20pp over baseline.

## Design

### Scenario

| Scenario | Baseline | N | Failure Mode | Why Selected |
|----------|----------|---|--------------|--------------|
| `exp144-hidden-dep-decoupled` | 15% (3/20) | 20 | Product passes (5/5) but process fails (1/4): agents don't document bugs or verify after fix | Process skill directly addresses the gap |

### Treatment: Investigation-Before-Fix Skill

**Fork name**: `coder-exp154-investigate`

The treatment adds a process skill requiring agents to:
1. Run the code first to see the error
2. Write FINDINGS.md documenting EVERY bug found (name, location, effect, fix)
3. Look for hidden dependencies (e.g., checksums)
4. Fix all bugs only after documentation
5. Run the code again after fixing to verify

This directly targets all 3 failing process checks:
- P2: Writing FINDINGS.md with bug details will mention the typo
- P3: The "hidden dependencies" step will surface the checksum
- P4: The "verify by running" step will trigger pipeline execution

### Control: Production Baseline

**Fork name**: none (baseline runs)

Existing 20 baseline runs at 15% pass rate.

### Sample Size

- 10 treatment trials (fork: `coder-exp154-investigate`)
- 0 new control needed (20 historical baseline runs)
- Total new runs: 10

### Measurements

**Primary**: Overall pass rate (% passing all checks)
**Secondary**: Individual process check pass rates (P1-P4)

### Predictions

1. Treatment ≥35% overall pass rate (vs 15% baseline)
2. P2 and P3 pass rates ≥50% (vs ~20% baseline) — the documentation requirement directly forces bug identification
3. P4 pass rate ≥70% — the "run after fixing" step is the easiest to follow

## Files

- Treatment skill: `agents/.lab/coder-exp154-investigate/skills/investigation-before-fix.md`
- Process skill design: `workspace/process-skill-atomic-edit.md` (phase 1, superseded)
