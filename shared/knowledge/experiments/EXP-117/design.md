# EXP-117: Forced Deliverable Enumeration for Bob's FM-2.6 Read-Loop Pattern

**Date**: 2026-04-10
**Author**: Coach
**Status**: IN PROGRESS — Running gym trials
**Type**: Intervention experiment (gym A/B)
**Related**: EXP-115 (same intervention for optimizer FM-2.2), KE-007 (structural enforcement), EXP-046/092 (forced externalization)

---

## 1. Research Question

**Can forced deliverable enumeration (checklist) prevent Bob's FM-2.6 read-loop pattern on multi-file KB integration tasks?**

### 1.1 The Problem

Bob exhibits a consistent failure pattern on multi-file knowledge base integration tasks:

1. **Plans correctly** — identifies all N files that need updating
2. **Enters read loop** — spends 70-80% of tool calls reading context, experiment results, related files
3. **Loses completion tracking** — after many reads, loses track of which files still need updating
4. **Premature finish or drift** — either finishes with 1-2 of N files done, or drifts to tangential work

Evidence from 4 production sessions (April 2026):

| Session | Task | Tool Calls | Files Updated | Issue |
|---------|------|:---:|:---:|---------|
| s_1775664796622_77 | EXP-088 KB integration | ~40 | 0/5 | Read-loop, premature finish |
| s_1775705055273_138 | EXP-097 KB integration | 52 | ~2/7 | Interrupted, mostly reading |
| s_1775706810573_142 | EXP-097 KB integration | ~30 | 1/7 | ENOENT cascade, gave up |
| s_1775813634328_813 | DD-731/733 indexing Ph2 | 11 | 0/3 | Dedup focus instead of writing |

Evaluator scores: Q:0.2, Q:0.35, Q:0.45, Q:0.25 — all "needs_improvement"

### 1.2 Prior Evidence

- **EXP-115** proved forced deliverable enumeration works for optimizer's FM-2.2: 0% → 100% (+100pp) on `incomplete-deliverables-trap`. The mechanism: enumerating deliverables upfront creates a persistent anchor that prevents completion drift.
- **KE-007**: Structural interventions (workflows, forced externalization) are the only reliable behavioral interventions. Text-only rules (skills, SOUL.md) have 0/20+ failure rate.
- **Bob already has relevant skills** (knowledge-base-navigation, read-before-edit, verify-context-claims) but they address different failure modes (ENOENT recovery, edit quality) — none address completion tracking across N files.

### 1.3 Hypothesis

**H-EXP117**: Forced deliverable enumeration (DELIVERABLES_CHECKLIST.md written before any edits) will increase Bob's completion rate on the `kb-integration-multi-file` scenario by ≥20pp.

**Mechanism**: The checklist creates a persistent, visible artifact that:
- Externalizes working memory (which files still need updating)
- Prevents read-loop drift (checklist reminds agent of remaining work)
- Provides completion evidence (agent can check off items)

---

## 2. Experimental Design

### 2.1 Scenarios

| Arm | Scenario | Agent | Intervention |
|-----|----------|-------|-------------|
| A (baseline) | `kb-integration-multi-file` | coder (Bob role) | None |
| B (treatment) | `kb-integration-multi-file-checklist` | coder (Bob role) | Forced DELIVERABLES_CHECKLIST.md |

### 2.2 Task Description

Both scenarios: integrate EXP-142 findings into 6 KB files (H-042.md, KE-017.md, KE-023.md, INDEX.md, PRIORITY-TRACKER.md, todo.md).

**Baseline task.md**: Lists 6 files to update. No checklist instruction.

**Treatment task.md**: Same 6 files, plus: "Before making any edits, create DELIVERABLES_CHECKLIST.md listing every file you need to update. Check off items as you complete them."

### 2.3 Built-in Trap

The scenario has a deliberate trap: KE-023 is listed in the task as `KE-023.md` but the actual file is `KE-023-cache-architecture.md`. This tests ENOENT recovery — agents must search for the correct filename.

### 2.4 Success Criteria (7 checks baseline, 8 treatment)

1. **h042-probability-updated**: P(H) changed from 0.35 to 0.72, evidence section added
2. **ke017-evidence-appended**: EXP-142 evidence section with 62% latency finding
3. **ke023-status-validated**: Status changed from TESTING to VALIDATED with date
4. **index-entry-added**: KE-071 row added referencing EXP-142
5. **priority-reordered**: H-042 moved from Medium to High Priority
6. **todo-marked-complete**: EXP-142 item checked off
7. **checklist-exists** (treatment only): DELIVERABLES_CHECKLIST.md exists with ≥4/6 files mentioned
8. **all-files-modified** (aggregate): All 6 individual checks pass

### 2.5 Sample Size

N=3 per arm (6 total). Same as EXP-115 pilot. If results are ambiguous, extend to N=5.

### 2.6 Predictions

- **Baseline**: ≤30% pass rate. Based on production data showing 0-2 of N files completed.
- **Treatment**: ≥70% pass rate. Based on EXP-115's +100pp effect.
- **Threshold**: ≥20pp improvement to confirm H-EXP117.
- **Overhead**: Treatment should add ≤20% additional tool calls (checklist creation is ~2-3 tool calls).

---

## 3. Confounds and Limitations

1. **Gym vs production**: The gym task is simpler than production (fixed 6 files, no distracting context). Production FM-2.6 involves ambiguous scope, competing priorities, and compacted context.
2. **Agent identity**: Using `coder` agent type, not Bob specifically. Bob's specific skills/context aren't loaded. This tests the intervention in isolation, not with Bob's full configuration.
3. **Scenario specificity**: Only tests KB integration. Bob's FM-2.6 also appears on design brief tasks and indexing tasks.
4. **EXP-115 confound**: The checklist approach was validated for optimizer — if it also works for coder, it suggests the mechanism (externalized tracking) is agent-independent.

---

## 4. Protocol

### Phase 1: Baseline runs (N=3)
```bash
scripts/gym-run.sh kb-integration-multi-file --agent coder
```

### Phase 2: Treatment runs (N=3)
```bash
scripts/gym-run.sh kb-integration-multi-file-checklist --agent coder
```

### Phase 3: Analysis
- Compare pass rates, per-check analysis
- Measure tool call overhead
- Document behavioral differences (read-loop presence, completion tracking)
