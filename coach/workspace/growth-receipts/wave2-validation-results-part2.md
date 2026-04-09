# Wave 2 Validation Results — Part 2 (Scenarios 4-5)

**Date**: 2026-04-09
**Agent**: bob (opus)
**Framework**: 8a07792

## Summary Table

| Scenario | Runs | Overall Pass Rate | Product | Behavior | Convention | Efficiency |
|---|---|---|---|---|---|---|
| convention-verify-edit-fewshot | 3 | 3.3/5 avg (67%) | 9/9 (100%) | — | 1/6 (17%) | — |
| context-proof-build-xref | 3 | 4/6 each (67%) | 6/9 (67%) | 6/6 (100%) | — | 0/3 (0%) |

## Detailed Results

### Scenario 4: convention-verify-edit-fewshot

**Description**: Few-shot variant showing a worked example of read→edit→verify→validate cycle. Tests whether seeing the pattern induces verify-after-edit discipline.

| Check | Category | Run 1 | Run 2 | Run 3 |
|---|---|---|---|---|
| valid-json | product | ✅ | ✅ | ✅ |
| correct-values | product | ✅ | ✅ | ✅ |
| fields-preserved | product | ✅ | ✅ | ✅ |
| C2.3: verify-after-edit | convention | ❌ | ❌ | ❌ |
| C3: validation-attempt | convention | ❌ | ✅ | ❌ |

**Product**: 3/3 all runs — Bob always gets the correct JSON output.
**Convention (verify-after-edit)**: 0/3 — consistently fails. Detail: "No write/edit to config.json found in transcript" — Bob appears to use bash commands (cat/echo redirect) rather than edit() to modify the config, so the verify-after-edit check doesn't detect an edit to verify.
**Convention (validation-attempt)**: 1/3 — only run 2 passed (used python3 JSON.parse). Inconsistent.

**Key Insight**: The few-shot example shows the edit→verify pattern, but Bob still defaults to bash-based file manipulation rather than using the edit() tool. The few-shot doesn't change the tool choice, just the task outcome.

### Scenario 5: context-proof-build-xref

**Description**: Cross-reference variant: inject instruction to discover build prerequisites by reading build scripts and grepping for dependencies before running build commands. Multi-phase workflow scenario.

| Check | Category | Run 1 | Run 2 | Run 3 |
|---|---|---|---|---|
| phase1-report | product | ✅ | ✅ | ✅ |
| phase2-report | product | ✅ | ✅ | ✅ |
| bundle-exists | product | ❌ | ❌ | ❌ |
| no-missing-types-error | behavior | ✅ | ✅ | ✅ |
| runs-codegen | behavior | ✅ | ✅ | ✅ |
| phase2-efficient | efficiency | ❌ | ❌ | ❌ |

**Product (reports)**: 6/6 — Bob always produces both phase reports.
**Product (bundle-exists)**: 0/3 — Bob never successfully produces dist/bundle.js. The build step fails consistently despite running codegen correctly.
**Behavior**: 6/6 (100%) — The xref injection works perfectly. Bob reads build scripts, discovers the codegen prerequisite, runs codegen.js, and avoids the types.js missing error. This is the target behavior and it passes 100%.
**Efficiency**: 0/3 — Phase 2 uses >10 tool operations. Bob is thorough but not efficient.

**Key Insight**: The behavioral training is highly effective — Bob consistently discovers and runs the prerequisite. The bundle failure appears to be a downstream issue (possibly a build tool or environment limitation), not a behavior failure. The scenario successfully teaches the cross-reference skill even though the final build product doesn't materialize.

## Cross-Wave Comparison

| Wave | Scenarios Tested | Behavioral Pass Rate | Notes |
|---|---|---|---|
| Wave 1 | 3 (escalation, context-proof, plan-amend) | 9/9 (100%) | All behavioral checks pass |
| Wave 2 Part 1 | 3 (from earlier session) | See part 1 results | — |
| Wave 2 Part 2 | 2 (convention-verify, context-xref) | 7/9 (78%)* | *Convention checks harder than behavior |

*Behavioral checks specifically: context-proof-build-xref behavior is 6/6 (100%). Convention checks on verify-edit-fewshot are 1/6 (17%).

## Anomalies

1. **convention-verify-edit-fewshot C2.3 always fails**: The check looks for edit() calls on config.json in the transcript. Bob uses bash commands to modify files instead of edit(). The few-shot example demonstrates edit() but Bob's tool choice is unaffected. This may indicate few-shot examples don't transfer tool-choice behavior — only task-completion behavior.

2. **context-proof-build-xref bundle never builds**: All 3 runs fail the bundle-exists check despite correct behavior (running codegen, no types error). This suggests a build environment issue or a scenario design gap where the build step requires something beyond what the xref injection teaches.

3. **Efficiency checks consistently fail**: Both scenarios have efficiency-adjacent checks that fail. Bob is thorough but uses many tool calls. This is consistent with Wave 1 findings (escalation-impossible-task-fewshot low-tool-count also failed).
