# Bob FM-2.6 Multi-File KB Update Failures — Analysis & Intervention Design

**Date**: 2026-04-09
**Author**: Coach
**Trigger**: 4 FM-2.6 REASONING_ACTION_MISMATCH errors in 21 hours (2026-04-08 12:13 → 2026-04-09 03:53)

## 1. Error Pattern Summary

All 4 errors share the exact same structure:

| # | Timestamp | Files Required | Files Completed | Failure Mode |
|---|-----------|---------------|-----------------|--------------|
| 1 | 04-08 12:13 | 2 (KE-060, INDEX) | 0 | Did freshness checks only, then forked another session |
| 2 | 04-08 16:13 | 5 (H-088, KE-056, KE-060, INDEX, PRIORITY-TRACKER) | 0 | Todo inspection + spot-checking, no edits |
| 3 | 04-09 02:53 | 6 (H-085, KE-043, KE-060, INDEX, PRIORITY-TRACKER, todo) | ~partial | Concluded "already integrated," skipped INDEX/PRIORITY-TRACKER/todo |
| 4 | 04-09 03:53 | 7 (H-091, KE-059, KE-060, KE-065, INDEX, PRIORITY-TRACKER, todo) | 1 (WKWA-007) | Read attempts on KE-059/60/65 failed ENOENT, not recovered |

### Common Pattern: "Reasoning Substitutes for Action"
Bob correctly **understands** the task (he knows which files to update) but:
- **Error 1 & 2**: Gets absorbed in reading/checking and runs out of budget or attention before writing
- **Error 3**: Reasons himself into believing the work is already done ("already integrated")
- **Error 4**: Hits ENOENT on file reads, doesn't recover, writes to an unrelated file instead

This is NOT a planning failure — Bob plans correctly. It's an **execution tracking failure**: he loses track of which items from his plan have actually been completed. The 4 errors show an escalating pattern (2→5→6→7 required files) suggesting the task complexity is growing beyond what Bob can track in working memory.

## 2. Root Cause Analysis

### Primary: No Completion Tracking Mechanism
Bob's current workflow has no mechanism to:
1. Enumerate all N required deliverables at the start
2. Check off each one as it's completed
3. Verify all N are done before calling finish()

Without a checklist, Bob's behavior degrades as N increases:
- N=1-2: Usually completes (working memory sufficient)
- N=5-7: Frequently drops items (working memory overflow)

### Secondary: ENOENT Non-Recovery (Error #4)
When `read()` fails for KB files (KE-059, KE-060, KE-065), Bob doesn't fall back to `ls` the parent directory and find the correct path. His existing `knowledge-base-navigation` skill covers this for initial navigation but doesn't trigger during mid-task reads when he's "already working."

### Tertiary: Premature Completion Judgment (Error #3)
Bob decides "already integrated" without evidence. This is a judgment failure — he reasons about completion status instead of mechanically checking it. Related to FM-3.3 (verification gap).

## 3. Existing Interventions Assessment

### Already deployed:
| Intervention | Covers this? | Gap |
|-------------|-------------|-----|
| `deliver-or-report` workflow | Partially — enforces "write SOMETHING" but doesn't track N deliverables | Phase 2 verifies ≥1 file exists, but doesn't verify ALL N planned files were written |
| `verify-after-edit` skill | Each write verified | Doesn't track cumulative completion across N files |
| `knowledge-base-navigation` skill | ENOENT recovery | Only triggers at session start, not mid-task |

### Key gap: The `deliver-or-report` workflow already extracts planned files and checks existence — but it only checks that `verified.length > 0`, not that ALL planned files are verified. This is a straightforward fix.

### Existing gym scenarios:
| Scenario | Relevance |
|----------|-----------|
| `drudgery-multi-file` | Tests bulk edits to many files — process task, not judgment |
| `multi-file-verify-gap` | Tests verification after rename refactor — 3-4 files |
| `convention-verify-multi-edit` | Tests 3-file config correction — closest match but small N |
| `scope-creep-multifile` | Tests scope management — different failure mode |

**None of these test the specific pattern**: "given a list of 5-7 KB files to update with research findings, complete ALL of them." A new scenario is needed.

## 4. Intervention Recommendation

### Mechanism Selection (based on EXP-084 findings)

This is a **process task** (update N specified files), not a judgment task (decide whether to update). The EXP-084 hierarchy applies:

| Method | Expected Effect | Rationale |
|--------|----------------|-----------|
| Text rule ("update all files") | 0% | KE-002: declarative text rules don't change behavior |
| Few-shot example | ~33% standalone, higher via injected_context | Shows the pattern but doesn't enforce it |
| **Checklist injection** | Best fit | This IS a checklist problem — track N items, complete all N |
| Workflow enforcement | 100% but heavy | `deliver-or-report` already exists, just needs the ALL check |

**Recommended: Two-layer intervention**

#### Layer 1: Fix `deliver-or-report` workflow (workflow enforcement — immediate)
The workflow already extracts planned deliverables and checks existence. Change the completion gate from:
```typescript
// Current: const hasDeliverables = verified.length > 0;
// Proposed: const allDelivered = missing.length === 0 && verified.length > 0;
```

When `missing.length > 0`, instead of returning success with a "Missing" section, trigger a **Phase 2b retry** — give Bob the missing files list and tell him to complete them. This turns the workflow from "write something" to "write everything."

**Estimated effort**: ~15 min code change + test
**Expected effect**: Should catch errors #1-3 (they would have hit the "missing files" gate). Error #4 (ENOENT non-recovery) needs separate treatment.

#### Layer 2: Checklist skill for multi-file tasks (structural text — medium-term)
A skill that triggers when the task mentions 3+ file paths to update:

```markdown
# Skill: Multi-File Completion Tracking

## Trigger
Task requires updating/writing 3 or more distinct files.

## Protocol
1. BEFORE starting: Write a checklist to workspace/current-checklist.md:
   ```
   ## Deliverables Checklist
   - [ ] file-1.md
   - [ ] file-2.md
   ...
   ```
2. AFTER each file write: Update the checklist:
   ```
   - [x] file-1.md ✅ (verified via read-back)
   ```
3. BEFORE calling finish(): Read the checklist. If ANY unchecked items remain, complete them.
4. In finish() deliverables, include ALL files from the checklist.
```

This is a **checklist injection** (L2.5 on EXP-084 hierarchy). Per EXP-084, checklists "guide STRUCTURE but not CONTENT" — which is exactly what's needed here. The content (what to write) isn't the problem; the structure (track what's been written) is.

#### Layer 3: ENOENT recovery reinforcement (addresses error #4)
Add to `knowledge-base-navigation` skill:

```markdown
## Mid-Task ENOENT Recovery
If read() fails ENOENT during multi-file update:
1. `ls` the parent directory
2. Look for the file under alternate names (KE-060.md vs KE-060-*.md)
3. If file genuinely doesn't exist: CREATE it (you're updating the KB, creating new entries is allowed)
4. Do NOT skip the file and move to something else
```

## 5. Gym Scenario Design (for validation)

### Scenario: `kb-integration-multi-file`

**Task**: "Integrate the findings from EXP-XXX into the knowledge base. Update these 6 files: H-042.md (revise P(H)), KE-017.md (add evidence), KE-023.md (update status), INDEX.md (add entries), PRIORITY-TRACKER.md (reorder), todo.md (mark complete)."

**Environment**:
- `environment/experiment-results/EXP-XXX/results.md` — the source findings
- `environment/knowledge/hypotheses/H-042.md` — needs P(H) update
- `environment/knowledge/entries/KE-017.md` — needs evidence appended
- `environment/knowledge/entries/KE-023.md` — needs status change
- `environment/knowledge/INDEX.md` — needs new entry rows
- `environment/knowledge/PRIORITY-TRACKER.md` — needs reorder
- `environment/todo.md` — needs item marked complete
- One file (`KE-023.md`) is at a slightly different path than stated in the task (to test ENOENT recovery)

**Success Criteria**:
1. `all-files-updated`: All 6 target files have been modified (git diff or mtime check)
2. `h042-p-updated`: H-042.md contains revised probability
3. `ke017-evidence-appended`: KE-017.md has new evidence section
4. `index-updated`: INDEX.md has new entries
5. `priority-reordered`: PRIORITY-TRACKER.md reflects new priority order
6. `todo-marked-complete`: todo.md shows item as done
7. `enoent-recovered`: The slightly-mispathed file was found and updated (tests ENOENT recovery)

**Baseline expectation**: ~2-3/7 criteria pass (Bob will update 2-3 files then drift)
**Post-intervention target**: ≥6/7

## 6. Implementation Priority

| Step | Intervention | Type | Priority | Estimated Effect |
|------|-------------|------|----------|-----------------|
| 1 | Fix `deliver-or-report` ALL check | Workflow | **P0** — immediate, addresses root cause | Catches 3/4 recent errors mechanically |
| 2 | Build `kb-integration-multi-file` gym scenario | Testing | **P1** — needed to validate interventions | Enables measurement |
| 3 | Write `multi-file-completion-tracking` checklist skill | Skill | **P1** — structural text, moderate expected effect | +2.0 score per EXP-084 checklist data |
| 4 | Extend `knowledge-base-navigation` for mid-task ENOENT | Skill | **P2** — addresses error #4 only | Narrow but prevents a specific failure |

## 7. Cross-References

- **EXP-084**: Mechanism hierarchy — checklist = +2.0 score improvement on judgment tasks. This is a process task, so likely even more effective.
- **EXP-088**: Few-shot in skill text vs injected_context — skill text delivery is diluted. Checklist may have same issue. Consider injecting the checklist via task.md rather than skill file.
- **H-091**: Intermediate delivery methods exist between text (0%) and workflow (100%). The `deliver-or-report` fix is workflow-level; the checklist skill is L2.5.
- **KE-002**: Text rules don't fix judgment failures (0/35). But this is a process failure, not judgment — text checklists may work better here.
- **Bob context.md**: Already has turn discipline advice ("At turn ~20, assess progress"). The multi-file tracking failure suggests the discipline advice isn't triggering mid-task.

## 8. Open Questions

1. **Is the `deliver-or-report` workflow being used for KB integration tasks?** Bob's heartbeat says "use deliver-or-report for all knowledge integration" — if he's not actually using it, the workflow fix won't help until we enforce it.
2. **Would injected_context checklist be more effective than a skill file?** EXP-088 showed delivery mechanism matters more than format. A checklist template injected via task.md (high salience) would likely outperform the same content in a skill file (low salience).
3. **Is there a budget issue?** If Bob's sessions are hitting tool call limits before completing all files, no skill or workflow fix will help — the task needs to be split into smaller batches (max 3-4 files per session).
