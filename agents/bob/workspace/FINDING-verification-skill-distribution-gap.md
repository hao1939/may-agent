# FINDING: Verification Skill Not Loaded for Top-Offending Agents

**Date**: 2026-05-02
**Author**: bob
**Status**: ACTIONABLE

## Evidence

### The Problem
Verification failures are the #1 cross-agent issue category:
- 8/40 issues (20%) across all evaluations are verification-related
- Optimizer: 19 total issues (highest), including VERIFICATION_FAILURE, UNVERIFIED_CLAIMS_RISK, EVIDENCE_GAP
- Coach: 16 total issues, including VERIFICATION_FAILURE, VERIFICATION_GAP, UNVERIFIED_CLAIM

### The Gap
A comprehensive 152-line verification skill exists at `agents/shared/skills/verification/SKILL.md` with 9 anti-patterns and inviolable constraints.

**But it appears to NOT be loaded for the agents that need it most:**
- `agents/optimizer/skills/` — has `verify-after-edit.md` (edit-level only), no general verification skill
- `agents/coach/skills/` — has `verify-after-edit.md`, no general verification skill  
- `agents/coder/skills/` — has `convention-compliance.md`, `task-instruction-compliance.md`, no general verification skill
- `agents/amy/SOUL.md` — explicitly references `agents/shared/skills/verification/SKILL.md` ✅
- `agents/bob/skills/` — has `verify-before-finish.md` (12 lines, weaker version) ✅

### Root Cause
The shared verification skill exists but isn't being injected into optimizer, coach, or coder sessions. These agents have only `verify-after-edit.md` which covers the narrow case of "read back after edit" but NOT:
- Pre-completion verification
- Structured evidence checking (P61 receipts)
- Anti-patterns AP-1 through AP-9
- The "inviolable constraints" section

## Recommendation

**Option A (Quick)**: Add a reference to `agents/shared/skills/verification/SKILL.md` in optimizer/coach/coder SOUL.md files, similar to amy's approach.

**Option B (Better)**: Copy the core verification checklist (the "Inviolable Constraints" section — 8 lines) into each agent's existing `verify-after-edit.md`, expanding its scope to pre-finish verification.

**Option C (Best, tests H-EXP-028)**: Do Option A for optimizer only, leave coach as-is. After 10+ evaluations, compare verification failure rates. This directly tests whether skill loading matters.

## Impact
If 20% of issues are verification failures and we can halve that, we improve eval scores by ~10%.

## Relationship to H-EXP-028
This finding PARTIALLY supports H-EXP-028 (shallow read) but introduces an alternative explanation: **the skill isn't loaded at all for top offenders**. Must distinguish between:
1. Skill loaded but ignored (H-EXP-028)
2. Skill not loaded (skill distribution gap)

Option C disambiguates these.
