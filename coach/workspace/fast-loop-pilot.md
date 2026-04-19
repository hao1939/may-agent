# M3: Fast Loop Pilot — Read-Before-Edit

**Date**: 2026-04-16  
**Scenario**: `read-before-edit` (convention-compliance, edit-discipline)  
**Agent**: coder

## Scenario Selection

From TRIAGE.md, `read-before-edit` had historical 18.2% pass rate (33 runs). It tests a coach-relevant skill (C1: read before editing, C2.3: verify after editing). Recent baseline showed improvement to 50%, making it a discriminating scenario in the sweet spot.

## Failure Analysis

Baseline failures fell into two categories:
1. **C1 failures (3/5 failures)**: Agent edited files without reading them first — constructed `oldText` from task description instead of actual file content.
2. **C2.3 failures (2/5 failures)**: Agent read before editing but didn't verify after — skipped post-edit read-back.

The existing `verify-after-edit.md` skill says edit() diff preview counts as verification, which may weaken C2.3 compliance. No dedicated read-before-edit skill existed.

## Hypothesis

A single skill file enforcing a **read → edit → verify** workflow per file will eliminate C1 failures and reduce C2.3 failures.

## Intervention

Created lab fork `coder-rbe-workflow` with one skill file (`skills/read-before-edit.md`) that:
- Mandates reading every file before editing
- Requires one-file-at-a-time workflow: read → edit → verify
- Explicitly states "NO EXCEPTIONS" — even when task provides line content

## Results

| Arm | Passes | Total | Rate |
|-----|--------|-------|------|
| Baseline | 5 | 10 | **50%** |
| coder-rbe-workflow | 7 | 10 | **70%** |

**Delta: +20pp** (50% → 70%)

### Failure Breakdown

| Failure Type | Baseline | Intervention |
|---|---|---|
| C1: read-before-edit | 3/10 | **0/10** ✅ |
| C2.3: verify-after-edit | 5/10 | 3/10 |
| Both C1 + C2.3 | 3/10 | 0/10 |

C1 failures completely eliminated. C2.3 improved (5→3) but remains the residual failure mode.

## Observations

1. **Skill intervention worked** — contrary to KE-002 (text rules 0% for judgment failures), this is a *process* skill, not a judgment one. The agent can follow concrete steps.
2. **Small N warning** — 10 trials per arm. The 20pp delta is suggestive but not statistically significant (Fisher's exact p ≈ 0.35). Would need ~50/arm for significance at this effect size.
3. **C2.3 is the harder problem** — even with explicit verify instructions, agents still skip post-edit verification 30% of the time. May need workflow enforcement (hard gate) rather than skill text.
4. **Baseline drift** — historical 18.2% → current 50% suggests the archetype SOUL.md changes (which already mention read-before-edit) have had effect, but the skill file adds further improvement.

## Metric Recorded

`coach.intervention-hit-rate` = 0.70 (target: 0.80), recorded in may.db metric_snapshots.

## Next Steps

- To promote: need larger N trial or second scenario confirmation
- For C2.3: consider workflow gate that blocks finish() without post-edit reads
- This fast loop took ~15 min of gym time — validates the gym→metric feedback cycle works
