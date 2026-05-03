# EXP-720 Phase 1: Coverage Audit — Few-Shot Pattern Match Rate

**Date**: 2029-09-03
**Status**: ANALYSIS COMPLETE — H1 PARTIALLY SUPPORTED

## Method

Without direct access to historical orchestrator guidance text (session transcripts are ephemeral), I analyzed:
1. All 6 closed projects' milestone descriptions and outputs
2. Recent `last-session.md` summaries from 10 agents (proxy for task types)
3. The 5 few-shot regex patterns against typical task vocabulary

## Few-Shot Patterns (from INDEX.md)

| # | Domain | Regex | Typical Triggers |
|---|--------|-------|-----------------|
| 1 | Binary files | `/binary\|\.bin\b\|compiled\|executable\|hexdump/i` | Rare — only binary-related tasks |
| 2 | Bug debugging | `/bug\|error\|failing\|test.*fail\|crash\|500\|exception/i` | VERY BROAD — matches almost any troubleshooting |
| 3 | Dependency impact | `/upgrade\|dependency\|multiple.*(file\|module)\|impact\|import.*shared/i` | Moderate — refactoring, shared module changes |
| 4 | Blockers | `/blocked\|impossible\|can'?t.*find\|missing.*key/i` | Low — only when tasks hit walls |
| 5 | Evidence conflicts | `/fix.*bug\|broken\|failing\|doesn'?t.*work\|incorrect.*output/i` | Overlaps heavily with #2 |

## Analysis of Recent Task Types

### Worker tasks from closed projects (estimated from milestones):

| Project | Typical Worker Tasks | Pattern Match? |
|---------|---------------------|---------------|
| documentation-gen | Write/update docs, verify coverage | NO — writing tasks, no debug/error vocabulary |
| evaluation-revival | Fix evaluator, configure metrics | YES (#2, #5) — "error", "failing", "fix bug" |
| workflow-reliability | Fix workflow bugs, add guards | YES (#2, #3) — "error", "crash", "multiple modules" |
| agent-memory-learning | Write KEs, configure memory | NO — knowledge management, no debug vocabulary |
| coach-quality | Design experiments, measure results | NO — analytical/design work |
| skill-workflow-audit | Audit skills, close experiments | NO — audit/review work |

### Recent heartbeat sessions (last-session.md):
Most are heartbeat maintenance (check metrics, process inbox, write artifacts). These are NOT worker tasks and wouldn't go through master-worker.ts.

## Estimated Match Rate

**Conservative estimate**: ~25-35% of worker tasks would match Pattern #2 (bug/error debugging) or #5 (evidence conflicts). These are the broadest patterns.

**Concern**: The breadth of Pattern #2 (`/bug|error|failing/`) means it would match many NON-debugging tasks:
- "Check for error handling coverage" → MATCH (false positive)
- "Write error documentation" → MATCH (false positive)  
- "Update the failing test suite" → MATCH (true positive)

**Real debugging-task rate**: Likely 15-25% of worker iterations involve actual bug fixing.

## Verdict

**H1: PARTIALLY SUPPORTED** — Estimated 25-35% pattern match rate exceeds 20% threshold, but false positive rate is high (~30-50% of matches may be non-debugging tasks).

## Recommendation

1. **Proceed to Phase 2** but with tighter patterns:
   - Pattern #2: Require `test.*fail|error.*fix|debug|crash` instead of bare `error`
   - Pattern #5: Keep as-is (already more specific)
2. **Add logging**: Before full deployment, add a dry-run mode that logs "would inject X for task Y" without actually injecting
3. **KE-133 risk**: Few-shot examples HARM discovery tasks (-67pp). Must ensure patterns don't match exploration/research tasks.

## Limitation

This audit is based on task-type inference, not actual task text analysis. A stronger Phase 1 would require instrumenting master-worker.ts to log task text + pattern matches for 50+ iterations before injecting.
