# KE-121: Forced Externalization Prevents Misinterpretation, Not Just Omission

**Status**: Active
**Source**: EXP-115 (FM-2.2 completeness checklist guard)
**Date**: 2026-04-10
**Extends**: KE-007 (structural enforcement > text rules), KE-034 (forced externalization mechanism)

---

## Finding

Forced deliverable enumeration (writing DELIVERABLES_CHECKLIST.md before executing) improved incomplete-deliverables-trap pass rate from **0% to 100%** (N=3+3). The baseline failure wasn't omission — the agent read the relevant file in all runs — but **misinterpretation**: the agent treated "update old timeout references" as "add new context while preserving old text" instead of "replace old values with new ones."

The checklist forced the agent to articulate "replace 300→600 in LESSONS.md" before executing, which locked in the correct interpretation and prevented semantic drift during implementation.

## Two Mechanisms of Forced Externalization

Forced externalization now has evidence for two distinct mechanisms:

1. **Anti-omission** (previously known): Forces enumeration so nothing is forgotten
   - Evidence: EXP-043 (sycophancy, 45/45), EXP-079 (cross-ref, 0%→100%)

2. **Anti-misinterpretation** (NEW): Forces explicit articulation of ambiguous requirements before execution
   - Evidence: EXP-115 (0%→100%, N=3+3)
   - The agent "does" all deliverables in baseline — it reads LESSONS.md, it adds 600-second content — but it misinterprets "update" as "append" rather than "replace"
   - The checklist step forces disambiguation: writing "replace 300→600" commits to the correct interpretation

## Implications

- Forced externalization is the **most robust intervention mechanism** in the system
- Evidence across: omission prevention, sycophancy resistance, cross-reference discovery, AND misinterpretation prevention
- **Zero-cost**: adds ~3.5% execution time, no risk of over-compliance or timeout
- Applicable to any task with ambiguous or multi-step requirements

## Limitations

- Tested only on optimizer agent with brief-based tasks
- Small N (3+3)
- Covers ~23% of real FM-2.2 (standalone failures, not pipeline cascades)
- The specific failure mode (append vs replace) may be narrower than "misinterpretation" in general
