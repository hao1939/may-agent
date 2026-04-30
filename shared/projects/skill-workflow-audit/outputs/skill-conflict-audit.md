# Skill Conflict & Redundancy Audit

**Date**: 2025-01-30
**Scope**: 78 shared skill files
**Purpose**: Identify overlapping, contradictory, and redundant skills to enable pruning

## Summary

| Category | Count | Est. Context Savings if Resolved |
|----------|-------|----------------------------------|
| High-overlap pairs (near-duplicates) | 7 | ~45KB |
| Contradictory instructions | 2 | N/A (must resolve) |
| Archived but still referenced patterns | 3 | ~15KB |
| Subset skills (fully contained in another) | 4 | ~25KB |
| **Total pruning opportunity** | **16 skills** | **~85KB** |

---

## 1. Near-Duplicate Pairs (High Overlap)

### 1.1 `materialize-findings-concise` vs `materialize-intermediate-findings`
- **Overlap**: Both instruct agents to persist intermediate analysis to files rather than keeping in context
- **Difference**: "concise" version emphasizes brevity; the other is more detailed
- **Recommendation**: MERGE into single skill with concise as default mode

### 1.2 `growth-cycle.md` vs `growth-cycle/README.md` vs `agent-growth/SKILL.md`
- **Overlap**: Three files all describe the Fork-Train-Verify-Promote workflow
- **Difference**: growth-cycle.md is v1.1, README.md is v2.0, agent-growth is v1.0 — version confusion
- **Recommendation**: CONSOLIDATE into `growth-cycle/` package only, delete the standalone `.md` and `agent-growth/`

### 1.3 `knowledge-sharing` vs `helping-others`
- **Overlap**: Both cover inter-agent information sharing and assistance
- **Difference**: knowledge-sharing focuses on discovery sharing; helping-others on unblocking stalled agents
- **Recommendation**: MERGE — helping-others is a subset of knowledge-sharing

### 1.4 `agent-coordination` vs `handoff` vs `delegation-verification`
- **Overlap**: All three cover delegating work to other agents
- **Difference**: handoff is explicitly DEPRECATED. delegation-verification adds follow-up checking.
- **Recommendation**: DELETE handoff (deprecated). MERGE delegation-verification into agent-coordination as a subsection.

### 1.5 `sanitize-memory.md` vs `sanitize-content.md`
- **Overlap**: Both cover sanitizing untrusted input
- **Difference**: memory targets long-term storage; content is general text sanitization
- **Recommendation**: MERGE into single `sanitization/SKILL.md` with sections for memory vs content

### 1.6 `state-check-before-action` vs `baseline-before-change`
- **Overlap**: Both say "verify current state before mutating"
- **Difference**: state-check is about preconditions; baseline is about recording state for comparison
- **Recommendation**: MERGE — baseline-before-change subsumes state-check-before-action

### 1.7 `scope-discipline` (archived) vs `task-adherence` (archived)
- **Overlap**: Both say "stay focused on assigned task, don't drift"
- **Difference**: Minimal — scope-discipline focuses on pivot prevention, task-adherence on instruction compliance
- **Recommendation**: Both archived/untested — DELETE both or merge into active `task-compliance`

---

## 2. Contradictory Instructions

### 2.1 `state-check-before-action` vs `idempotent-work-detection`
- **Conflict**: state-check says "verify preconditions before every mutating op" (always check first). idempotent-work-detection says "check if work already done before starting" (check once at session start).
- **Impact**: Agents may over-check (both at session start AND before each op) or under-check
- **Resolution**: Clarify scope — idempotent-work-detection is session-level, state-check is operation-level. Add cross-references.

### 2.2 `verification-consistency` vs `budget-before-act`
- **Conflict**: verification-consistency demands "read-back verification at consistent rate throughout entire session." budget-before-act says "scope down if over budget" — which may mean skipping verification steps.
- **Impact**: When budget is tight, agents get contradictory guidance on whether to verify or skip
- **Resolution**: Add explicit note: verification is never scoped-down. Budget savings come from fewer features, not fewer checks.

---

## 3. Archived Skills Still Echoing Active Patterns

### 3.1 `archive/untested/check-state` → duplicates active `state-check-before-action`
- Same concept, archived version never tested. Active version exists.
- **Action**: Confirm archive version adds nothing, then ignore (already archived)

### 3.2 `archive/disproven/grep-first-reading` → contradicts common agent behavior
- This skill was DISPROVEN but agents still commonly do grep-before-read
- **Action**: Document why disproven — may need explicit counter-instruction if agents keep following it

### 3.3 `archive/untested/task-adherence` → overlaps active `task-compliance`
- **Action**: Confirm no unique content, leave archived

---

## 4. Subset Skills (Fully Contained in Another)

| Subset Skill | Contained Within | Recommendation |
|---|---|---|
| `closing-the-loop` | `delegation-verification` | MERGE into delegation-verification |
| `know-when-blocked` | `obstacle-pivot` | MERGE — obstacle-pivot covers blocked state + what to do next |
| `helping-others` | `knowledge-sharing` + `agent-coordination` | DELETE — covered by combination |
| `plan-once-amend` | `structured-plan-writing` | MERGE — plan-once-amend is just the "don't rewrite" constraint on structured plans |

---

## 5. Recommended Pruning Actions (Priority Order)

1. **DELETE** `handoff/SKILL.md` — explicitly deprecated, zero value
2. **MERGE** materialize-findings-concise + materialize-intermediate-findings → single skill
3. **MERGE** state-check-before-action + baseline-before-change → single "pre-action verification" skill
4. **CONSOLIDATE** growth-cycle ecosystem (3 files → 1)
5. **MERGE** agent-coordination + delegation-verification + closing-the-loop → single "delegation" skill
6. **MERGE** sanitize-memory + sanitize-content → single "sanitization" skill
7. **RESOLVE** contradictions in verification-consistency vs budget-before-act
8. **DELETE** helping-others (covered by knowledge-sharing + agent-coordination)
9. **MERGE** plan-once-amend into structured-plan-writing
10. **MERGE** know-when-blocked into obstacle-pivot

**Estimated net reduction**: 12-14 skill files (~85KB context savings, ~9% of total system context)
