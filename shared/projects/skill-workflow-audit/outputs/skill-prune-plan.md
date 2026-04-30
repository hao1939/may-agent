# Skill Pruning Plan

**Date**: 2025-01-30  
**Based on**: skill-conflict-audit.md (16 skills identified)  
**Expected savings**: ~85KB context reduction (~9% of total system context)

## Action Summary

| Action | Count | Est. Savings |
|--------|-------|-------------|
| ARCHIVE (delete/move to archive) | 4 | ~25KB |
| MERGE (combine into target skill) | 9 | ~45KB |
| RESOLVE (fix contradiction, no deletion) | 2 | ~15KB (clarity gain) |
| NO-ACTION (already archived) | 1 | 0 |
| **Total** | **16** | **~85KB** |

---

## Detailed Plan

| # | Skill Path | Action | Target/Resolution | Rationale | Est. Savings |
|---|-----------|--------|-------------------|-----------|-------------|
| 1 | `shared/skills/handoff/SKILL.md` | ARCHIVE | Move to `archive/deprecated/` | Explicitly deprecated, zero value | ~6KB |
| 2 | `shared/skills/helping-others/SKILL.md` | ARCHIVE | Delete (covered by knowledge-sharing + agent-coordination) | Pure subset of two other skills combined | ~5KB |
| 3 | `shared/skills/archive/untested/scope-discipline` | ARCHIVE | Leave in archive, remove any active references | Overlaps task-compliance, never validated | ~4KB |
| 4 | `shared/skills/archive/untested/task-adherence` | ARCHIVE | Leave in archive, remove any active references | Overlaps task-compliance, never validated | ~4KB |
| 5 | `shared/skills/materialize-findings-concise/SKILL.md` | MERGE | → `materialize-intermediate-findings/SKILL.md` | Add "concise mode" flag to the detailed version | ~5KB |
| 6 | `shared/skills/state-check-before-action/SKILL.md` | MERGE | → `baseline-before-change/SKILL.md` | baseline-before-change subsumes state-check | ~6KB |
| 7 | `shared/skills/growth-cycle.md` | MERGE | → `growth-cycle/README.md` (v2.0) | Standalone .md is outdated v1.1, package has v2.0 | ~8KB |
| 8 | `shared/skills/agent-growth/SKILL.md` | MERGE | → `growth-cycle/README.md` (v2.0) | v1.0 duplicate of growth-cycle package | ~6KB |
| 9 | `shared/skills/delegation-verification/SKILL.md` | MERGE | → `agent-coordination/SKILL.md` (add verification section) | Coordination + verification = one workflow | ~5KB |
| 10 | `shared/skills/closing-the-loop/SKILL.md` | MERGE | → `agent-coordination/SKILL.md` (add closing section) | Subset of delegation-verification which merges into coordination | ~4KB |
| 11 | `shared/skills/sanitize-memory/SKILL.md` | MERGE | → new `sanitization/SKILL.md` (memory + content sections) | Two halves of the same concern | ~5KB |
| 12 | `shared/skills/sanitize-content/SKILL.md` | MERGE | → new `sanitization/SKILL.md` | Two halves of the same concern | ~5KB |
| 13 | `shared/skills/know-when-blocked/SKILL.md` | MERGE | → `obstacle-pivot/SKILL.md` (add "detecting blocked" section) | obstacle-pivot covers blocked state + action | ~4KB |
| 14 | `shared/skills/plan-once-amend/SKILL.md` | MERGE | → `structured-plan-writing/SKILL.md` (add constraint) | plan-once-amend is just one constraint on plan writing | ~4KB |
| 15 | `shared/skills/verification-consistency/SKILL.md` | RESOLVE | Add note: "Verification is never scoped down by budget constraints" | Contradicts budget-before-act on when to skip checks | 0 |
| 16 | `shared/skills/budget-before-act/SKILL.md` | RESOLVE | Add note: "Budget savings come from fewer features, not fewer verification steps" | Contradicts verification-consistency | 0 |

---

## Execution Order

### Phase 1: Safe Deletions (no merge work needed)
1. Archive `handoff/` — already deprecated
2. Archive `helping-others/` — fully covered elsewhere
3. Confirm `scope-discipline` and `task-adherence` have no active references

### Phase 2: Simple Merges (content addition to target)
4. Add concise mode to `materialize-intermediate-findings`
5. Merge `state-check-before-action` into `baseline-before-change`
6. Merge `plan-once-amend` into `structured-plan-writing`
7. Merge `know-when-blocked` into `obstacle-pivot`

### Phase 3: Multi-file Consolidations
8. Consolidate growth-cycle ecosystem (delete standalone .md + agent-growth, keep package)
9. Merge agent-coordination + delegation-verification + closing-the-loop
10. Create new `sanitization/SKILL.md` from sanitize-memory + sanitize-content

### Phase 4: Contradiction Resolution
11. Add cross-references to verification-consistency and budget-before-act

---

## Verification Criteria

After pruning:
- [ ] No skill references broken (grep for deleted skill names in all agent configs)
- [ ] Merged skills contain all unique content from source skills
- [ ] Net file count reduced by 12-14
- [ ] Total shared skills context reduced from ~480KB to ~395KB
- [ ] No agent behavior regressions (monitor for 1 week post-prune)

---

## Risk Mitigation

- **Git branch**: Execute all changes on `skill-pruning` branch
- **Rollback**: Keep archived copies of all deleted/merged skills for 30 days
- **Gradual**: Phase 1 first, observe 48h, then Phase 2, etc.
- **Grep check**: Before each deletion, `grep -r "skill-name" agents/` to find references
