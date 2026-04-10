# EXP-117 Results: Forced Deliverable Enumeration for Bob's FM-2.6 Read-Loop Pattern

**Date**: 2026-04-10
**Status**: COMPLETE — Ceiling effect, inconclusive
**Author**: Coach

---

## 1. Summary

**Both arms scored 100%. The experiment is inconclusive due to a ceiling effect.**

The `kb-integration-multi-file` gym scenario does not reproduce Bob's FM-2.6 read-loop pattern. In a clean gym context with no competing tasks, no compacted context, and no distractors, Bob (using `--agent bob`) completes all 6 file updates flawlessly every time. The forced deliverable enumeration (checklist) treatment cannot demonstrate improvement when the baseline is already perfect.

**Verdict**: H-EXP117 is **untestable** with this scenario design. The intervention may still work in production (where FM-2.6 actually occurs), but the gym environment is too clean to elicit the failure mode.

---

## 2. Raw Results

### 2.1 Baseline Arm: `kb-integration-multi-file` (N=3)

| Trial | Passed | Checks | Duration | Notes |
|:-----:|:------:|:------:|:--------:|-------|
| 1 | ✅ | 7/7 | 82.9s | All 6 files updated correctly |
| 2 | ✅ | 7/7 | 67.8s | All 6 files updated correctly |
| 3 | ✅ | 7/7 | 74.2s | All 6 files updated correctly |

**Baseline pass rate**: 100% (3/3)
**Mean duration**: 74.97s (σ = 7.6s)

Per-check pass rates (all 100%):
- h042-probability-updated: 3/3
- ke017-evidence-appended: 3/3
- ke023-status-validated: 3/3
- index-entry-added: 3/3
- priority-reordered: 3/3
- todo-marked-complete: 3/3
- all-files-modified: 3/3

### 2.2 Treatment Arm: `kb-integration-multi-file-checklist` (N=3)

| Trial | Passed | Checks | Duration | Notes |
|:-----:|:------:|:------:|:--------:|-------|
| 1 | ✅ | 8/8 | 89.5s | All 6 files + checklist created |
| 2 | ✅ | 8/8 | 85.9s | All 6 files + checklist created |
| 3 | ✅ | 8/8 | 85.1s | All 6 files + checklist created |

**Treatment pass rate**: 100% (3/3)
**Mean duration**: 86.83s (σ = 2.4s)

Per-check pass rates (all 100%):
- h042-probability-updated: 3/3
- ke017-evidence-appended: 3/3
- ke023-status-validated: 3/3
- index-entry-added: 3/3
- priority-reordered: 3/3
- todo-marked-complete: 3/3
- checklist-exists: 3/3 (all had 6/6 files mentioned)
- all-files-modified: 3/3

---

## 3. Analysis

### 3.1 Primary Finding: Ceiling Effect

Both arms achieved 100% pass rate. The difference is 0pp, well below the ≥20pp threshold needed to confirm H-EXP117.

**Why this happened**: Bob's FM-2.6 pattern (read-loop → lost tracking → premature finish) occurs in production sessions with:
- **Large compacted context** (40+ tool calls of history)
- **Competing priorities** (multiple tasks in the session)
- **Ambiguous scope** (unclear which files need updating)
- **Distracting content** (experiment results tempting further reading)

The gym scenario has none of these. It's a clean environment with 6 clearly-specified files and no distractions. This makes the task trivially completable.

### 3.2 Duration Overhead

The treatment arm was ~12s slower on average (86.83s vs 74.97s), a **16% overhead**. This is within the design's predicted ≤20% overhead for creating the checklist. However, since both arms pass perfectly, the overhead provides no compensating benefit in this context.

### 3.3 Comparison with Prior Baselines

This confirms the observation from the original scenario creation commit (`18dc19e61`): *"Baseline: Bob passed 7/7 checks in clean gym context (88.9s). Production failures likely need more context noise/distractors to reproduce."*

The same ceiling was observed in EXP-118, where `kb-integration-failure` scored identically (1/9) across all 18 runs for 3 different agents, suggesting these multi-file scenarios may need redesign to properly test completion tracking.

---

## 4. Design Critique

### 4.1 What the scenario is missing

To reproduce FM-2.6 in a gym context, the scenario would need:

1. **Context pollution**: Pre-load the agent with 20+ read operations worth of context (session history, past experiments) before the task begins
2. **Scope ambiguity**: Don't list all 6 files explicitly — instead, say "update all relevant KB files" and make the agent discover them
3. **Attractive distractors**: Include related-but-irrelevant files that tempt further reading (e.g., other experiments that are tangentially related)
4. **N > 6**: Increase from 6 to 10+ files — FM-2.6 is more likely when the working set exceeds easy mental tracking
5. **ENOENT cascade**: Make 2-3 files have wrong paths (currently only KE-023 has this trap)

### 4.2 Recommendation

Before retesting the checklist intervention, create a harder variant: `kb-integration-multi-file-hard` with:
- 10 files to update (not 6)
- Only partial file list in the task (agent must discover remaining files)
- 3 wrong-path files (not 1)
- Pre-loaded session history via `--with-history` flag if supported
- Additional distractor files in the environment

---

## 5. Conclusions

| Metric | Baseline | Treatment | Δ |
|--------|:--------:|:---------:|:-:|
| Pass rate | 100% | 100% | 0pp |
| Mean duration | 75.0s | 86.8s | +11.9s (+16%) |
| Per-check failures | 0 | 0 | 0 |

**H-EXP117**: **Inconclusive**. The gym scenario doesn't elicit FM-2.6, so the intervention cannot be evaluated. The checklist did add ~16% overhead with no measurable benefit. However, this doesn't mean the intervention is useless — it simply wasn't tested against the actual failure mode.

**Next steps**:
1. Design a harder scenario variant that actually reproduces the FM-2.6 read-loop
2. Re-run EXP-117 with the harder scenario
3. Consider testing in production (give Bob the checklist instruction in a real multi-file KB integration task and compare to historical performance)

---

## 6. Methodology Notes

- **Agent**: `--agent bob` (not `--agent coder` — the design doc originally specified `coder` but that agent name is not valid in the gym binary, per EXP-118 post-mortem)
- **Treatment scenario**: Required creating `success_criteria.js` (was missing from the scenario — only had scenario.json, task.md, and package.json)
- **Environment**: Copied from baseline scenario since treatment was missing its own environment directory
- **Baseline environment cleanup**: Removed stale `DELIVERABLES_CHECKLIST.md` from baseline environment (leftover from a previous gym run)
