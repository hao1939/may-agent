# Auto-Evolve: Coder SOUL.md Variations — Manifest

**Date:** 2026-03-25
**Target agent:** coder
**Baseline:** agents/coder/SOUL.md (41 lines)

## Error Profile (96 entries in ERROR_LOG.jsonl)

Top failure modes:
- **FM-3.3** (25): Verification failures — claiming verification without evidence
- **FM-2.3** (7): Evidence gaps
- **FM-2.2** (6): Instruction mismatch / scope issues
- **FM-1.1** (6): Workflow breaks
- **FM-1.2** (4): Minor waste
- **GOAL_MISALIGNMENT** (4)
- **WORKFLOW_BREAK** (4)
- **SPECULATION_WITHOUT_PROOF** (4)
- **FINISH_GUARD_TRIGGERED** (4)
- **WEAK_VERIFICATION_EVIDENCE** (4)

## Variations

### v01_check.md — "Double-Check Skill"
**Change:** Adds one new skill to Skills section: mandatory read-back after every write/edit call.
**Targets:** FM-3.3 (verification failure) — the #1 error pattern.
**Hypothesis:** Explicit read-back requirement reduces phantom verification claims.
**Lines changed:** +1 skill entry (1 paragraph)

### v02_unconstrained.md — "Remove Constraints"
**Change:** Removes entire Constraints section (10 lines of ⛔ rules).
**Targets:** FM-2.2 (instruction mismatch), FM-1.1 (workflow break) — tests whether constraint overload causes the agent to confuse/ignore rules.
**Hypothesis:** Fewer rules = better adherence to remaining rules. Constraints may cause cognitive overload leading to net negative behavior.
**Lines changed:** -10 lines (Constraints section removed)

### v03_stepbystep.md — "Step-by-Step Planning"
**Change:** Adds explicit numbered planning methodology before any task action.
**Targets:** FM-3.3 (verification), PREMATURE_CLOSURE — tests whether upfront planning reduces missed verification steps.
**Hypothesis:** Forced planning creates a checklist that includes verification, reducing skipped steps.
**Lines changed:** +9 lines in Methodology section

### v04_senior.md — "Senior Engineer Identity"
**Change:** Reframes identity from "Implementer/hands" to "Senior Engineer with judgment." Adds Engineering Judgment methodology.
**Targets:** GOAL_MISALIGNMENT, FM-2.2 — tests whether more autonomy/confidence reduces misalignment errors.
**Hypothesis:** "Senior Engineer" framing encourages thoughtful execution rather than mechanical compliance, reducing errors from blindly following instructions.
**Lines changed:** 3 lines modified, 2 lines added

### v05_simplified.md — "Simplified SOUL"
**Change:** Dramatically shortens SOUL: removes Role Boundaries detail, Post-Fix Audit, several skills, all constraints. ~27 lines vs 41.
**Targets:** All patterns — tests whether information overload in SOUL is itself a failure source.
**Hypothesis:** Shorter context = more attention to each remaining rule. The "less is more" hypothesis.
**Lines changed:** -14 lines net (heavy simplification throughout)

## Next Step

Step 2: Run gym-baseline.sh for each variation + baseline. Script exists in the auto-evolve workflow doc.
Assign to tech-lead or run mechanically.
