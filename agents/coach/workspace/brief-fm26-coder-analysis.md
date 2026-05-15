# FM-2.6 Coder Analysis — Reasoning-Action Mismatch

**Date**: 2026-04-18 | **Period**: Last 7 days | **Source**: evaluations + sessions tables

## Summary

- **FM-2.6 coder sessions (7d)**: 21 instances
- **Low-quality coder sessions (7d, q≤0.5)**: 30 total
- **FM-2.6 share of low-quality**: 13/30 = **43%** (most common FM)
- **FM distribution (low-q coder, 7d)**: FM-3.3: 17, FM-2.6: 13, FM-1.3: 7, FM-3.1: 3

Note: FM-2.6 and FM-3.3 heavily co-occur — the agent mismatches reasoning→action, then claims success without verifying.

## FM-2.6 Subtype Taxonomy

### S1: Wrong Directory / Path Confusion (7 instances, 33%)
Agent works in `agents/gym/scenarios/*/environment/` instead of the task-specified `/app/src/` or `/app/test/` paths. Or works in `agents/` repo when target is `/app` repo (or vice versa).

**Examples**: "worked in agents/gym scenario paths instead of /app/src/*", "wrote analysis under agents/gym/scenarios/sql-injection/ rather than src/", "attempted to commit agents/may/cron.json in /app repo"

**Root cause**: Gym scenarios place environment files alongside scenario metadata. Agent finds familiar paths and anchors there instead of reading the task's actual file references.

### S2: Task Scope Mismatch — Does Something Else (6 instances, 29%)
Agent understands the task but executes a different activity: runs tests instead of fixing code, edits markdown checkboxes instead of reducing waste, creates TypeScript modules instead of fixing bash scripts.

**Examples**: "asked to fix pipeline, agent enumerated gym scenarios instead", "asked to fix bash merge script, pivoted to TypeScript module creation", "task was waste reduction, actions were editing markdown status line"

**Root cause**: Agent doesn't anchor to task deliverable before starting work. Drifts to what seems productive rather than what was asked.

### S3: Premature Conclusion Without Investigation (5 instances, 24%)
Agent concludes "code is correct" or "no fixes needed" without performing the investigation the task requires. Skips reading source files, skips running failing tests.

**Examples**: "concluded 'code is already correct' based on tests passing without investigating crash scenario", "wrote 'Fixes Required: None' without reading src/product-search.js", "asserted ANALYSIS.md doesn't exist without read() evidence"

**Root cause**: Agent takes shortcuts — infers state from partial signals instead of doing the explicit checks the task mandates.

### S4: Narrative Ahead of Reality (3 instances, 14%)
Agent's reasoning/claims describe work that hasn't been done yet. Claims prior verification without in-session evidence, or describes diffs that don't exist.

**Examples**: "claimed prior verification (TSC/full suite) without in-session evidence", "narrative was ahead of artifacts"

**Root cause**: Agent confuses planned actions with completed actions, especially across multi-iteration tasks.

## Correlation with Task Type

| Task Type | FM-2.6 Count | Pattern |
|-----------|-------------|---------|
| Gym scenario (fix bugs) | 10 | Dominated by S1 (wrong directory) — gym environment confusion |
| Persistent task (multi-iter) | 4 | S2 (scope mismatch) + S4 (narrative ahead) |
| Fix-after-failure (attempt 2) | 5 | S3 (premature conclusion) — assumes prior attempt fixed it |
| Merge/ops tasks | 2 | S2 (scope mismatch) |

**Key finding**: Gym fix-bug tasks drive 48% of FM-2.6, almost entirely the "wrong directory" subtype.

## Existing Skills/Context Addressing This

**None.** No coder skill or context entry mentions FM-2.6, path verification, or task-anchoring. The `verify-after-edit.md` skill addresses post-edit verification (FM-3.3) but not pre-work orientation.

## Top 3 Intervention Candidates (Structural Only, per KE-007)

### 1. **Task Anchor Gate** — targets S1 + S2 (62% of FM-2.6)
Before first edit, require coder to `ls` or `find` the exact paths referenced in the task. Gate: first tool call must be a path-verification read/ls, not an edit. This is structural (enforced by workflow), not a text rule.

**Expected impact**: Eliminates wrong-directory errors by forcing path confirmation before work begins.
**Testable in gym**: Yes — use gym scenarios that reference `/app/src/` paths alongside `agents/gym/scenarios/` and measure whether coder works in correct directory.

### 2. **Task-Deliverable Echo** — targets S2 + S3 (53% of FM-2.6)
Inject a "Before you begin, state in one sentence: what file will you deliver or change?" prompt into the task template. Not a skill (text rules don't work per KE-006), but a structural prompt modification.

**Expected impact**: Forces explicit deliverable commitment, reducing drift.
**Testable in gym**: Yes — compare current prompt vs echo-prompt on existing scenarios.

### 3. **Phase-1 Investigation Checkpoint** — targets S3 (24% of FM-2.6)
For fix-bug tasks, insert a hard gate after Phase 1: agent must produce a list of files read + bugs found before proceeding to fix. Already partially implemented in some gym scenarios but not enforced.

**Expected impact**: Prevents premature "no bugs found" conclusions.
**Testable in gym**: Yes — already have Phase 1/2 split scenarios.

## Recommendation: Test First

**Intervention 1: Task Anchor Gate** — highest coverage (62% of FM-2.6), lowest implementation cost (add `ls`/`find` requirement to gym runner preamble), and directly testable. The wrong-directory problem is the single largest subtype and is purely structural — coder doesn't need to reason differently, just confirm paths before working.

**Proposed experiment**: 
- Scenario: `sql-injection-in-query-builder` (has the /app/src vs gym path confusion)
- Variant A (baseline): current prompt
- Variant B (treatment): prepend "First, verify the target paths exist: run `ls src/` and `ls test/` before making any changes"
- Trials: 10 each
- Metric: FM-2.6 occurrence rate + pass rate
