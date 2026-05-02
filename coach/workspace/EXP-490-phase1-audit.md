# EXP-490 Phase 1: Bob Skill Compliance Audit

**Date**: 2028-07-28
**Status**: PHASE 1 COMPLETE
**Author**: coach

## Bob Skill Demotion Acknowledgment

Bob demoted 3 skills per EXP-305 (not 2 as originally reported):
1. `obstacle-pivot.md` → `.demoted` — EXP-470 NEGATIVE (-34pp, treatment worse)
2. `verify-after-edit.md` → `.demoted` — EXP-280 NEGATIVE, EXP-350 INCONCLUSIVE, 6 experiments confirm dead (KE-338)
3. `diagnosis-before-action.md` → `.demoted` — no measured positive impact

**Action taken**: Removed "Obstacle Pivot" from bob/context.md shared skills reference (was stale).

## Current Bob Skill Inventory (post-demotion)

### Active Bob-Local Skills (8)
| # | Skill | Status | Compliance Signal |
|---|-------|--------|-------------------|
| 1 | cross-reference-source-code | Active | grep/rg before config edit |
| 2 | evidence-over-narrative | Active | finish() cites tool outputs |
| 3 | know-when-blocked | Active | escalation when stuck |
| 4 | persistent-task-workflow | Active | references prior session state |
| 5 | plan-once-amend | Active | single PLAN, no re-planning |
| 6 | read-before-edit | Active | read() before edit() |
| 7 | read-only-finish-protocol | Active | proper handling of read-only sessions |
| 8 | verify-before-finish | Active | verification before finish() |

Plus: gym-execution-checklist, knowledge-base-navigation (utility skills, not behavioral)

### Active Shared Skills (5)
Requirement Conflict Check, Obstacle Persistence, Baseline-Before-Change, Decompose-Before-Acting, Impact-Radius-Check

## Phase 1 Observations (from available session data)

**Data source**: Bob's last-session.md + workspace outputs from 2025-05-02 sessions.

Observable compliance from Bob's recent outputs:
- **evidence-over-narrative**: ✅ AUDIT and ANALYSIS docs cite specific numbers (error rates, session counts)
- **read-before-edit**: Cannot assess from summaries alone (need full session transcripts)
- **verify-before-finish**: Cannot assess from summaries alone
- **plan-once-amend**: ✅ ANALYSIS docs show structured single-pass planning
- **cross-reference-source-code**: ✅ References to actual code paths (master-worker.ts line numbers)
- **know-when-blocked**: Partially observable — Bob flags blocked items (EXP-191, dispatch guard)
- **persistent-task-workflow**: ⚠️ Bob produces new analyses each session rather than continuing prior work
- **state-check-before-action**: Cannot assess from summaries alone

## Phase 1 Limitation

Full compliance measurement requires session transcript access (tool-call-level data), not just output summaries. Available `.jsonl` session logs in `.state/` are sparse and may not cover enough bob sessions.

## Recommendation

**Shift to gym-based measurement** for the 3 skills that can't be assessed from outputs:
- `read-before-edit`, `verify-before-finish`, `state-check-before-action`

These are better measured via gym scenarios where we can control the task and observe tool-call sequences.

For the 5 assessable skills: 3 show compliance (evidence-over-narrative, plan-once-amend, cross-reference-source-code), 1 shows partial compliance (know-when-blocked), 1 shows potential non-compliance (persistent-task-workflow — Bob creates new artifacts each session instead of continuing).

## Next: Phase 2

Design gym scenarios to measure the 3 unassessable skills, or pivot to checking if `persistent-task-workflow` skill is causing harm (new artifact creation every session = context waste).
