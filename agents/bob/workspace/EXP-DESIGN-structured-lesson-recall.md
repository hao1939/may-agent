# EXP-068: Structured Lesson Recall Effectiveness

**Date**: 2025-05-02
**Author**: bob
**Status**: DESIGNED
**Priority**: P1

## Motivation

The system writes lessons (via `finish()` calls) and stores them in memory-stream.jsonl (2.6MB+).
But **do agents actually recall and apply lessons from previous sessions?**

Key observation: The memory-stream grows monotonically but there's no evidence of pruning,
indexing, or retrieval optimization. If lessons aren't being surfaced at decision time,
the entire learning loop is decorative.

## Hypothesis (H-068)

**If lessons are structured with (trigger_context → action → outcome) triples and
surfaced via semantic similarity to the current task, then agents will make fewer
repeated mistakes compared to the current flat-append approach.**

P(H) = 0.65

## Evidence Supporting Investigation

1. `memory-stream.jsonl` is 2.6MB — too large to inject wholesale into context
2. Agents still repeat patterns flagged in older sessions (e.g., bob dispatched 15x on same task)
3. The `context-learn-poller` runs but produces context.md files of unknown effectiveness
4. No measurement exists for "lesson application rate" — we don't know if learning works

## Test Design

### Phase 1: Baseline Measurement (this session or next)
- Sample 20 recent bob sessions
- For each: check if session encountered a problem that was previously solved (lesson exists)
- Measure: what % of sessions re-discovered vs. recalled the solution?
- Expected baseline: <20% recall rate

### Phase 2: Structured Retrieval (requires implementation)
- Build a lesson index: (category, trigger_pattern, action, evidence)
- At session start, retrieve top-3 relevant lessons based on task description similarity
- Inject as "Previous learnings relevant to this task: ..."
- Measure: same metric, expect >60% recall rate

### Phase 3: A/B Comparison
- Compare session quality scores between baseline and structured-retrieval sessions
- Success criteria: +10% quality score improvement AND measurable mistake-reduction

## Metrics

| Metric | Baseline (expected) | Target |
|--------|-------------------|--------|
| Lesson recall rate | <20% | >60% |
| Repeated-mistake rate | ~15% sessions | <5% sessions |
| Session quality (good%) | 85.8% | >92% |

## Risks

- Retrieving irrelevant lessons could confuse agents (noise injection)
- Lesson quality varies — some are vague/generic ("always test") 
- Implementation cost: need semantic similarity or at minimum keyword matching

## Next Steps

1. Run Phase 1 baseline measurement: audit 20 bob sessions for lesson-applicable situations
2. Categorize existing lessons by type (fix/pattern/insight) and specificity
3. Design retrieval mechanism (simple keyword match first, then upgrade)

## Phase 1 Baseline Data (gathered 2025-05-02)

**Memory stream stats:**
- Total lessons: 8,649
- Categories: fix (1,034), insight (4,891), pattern (2,724)
- Specificity (mentions file paths/functions): 54% high, 46% low
- File size: 2.6MB (too large for wholesale context injection)

**Key finding:** 46% of lessons are low-specificity (no concrete file/function references).
These are likely the "always test" type that provide minimal recall value. A retrieval
system should prioritize high-specificity lessons with concrete triggers.

## Connection to Existing Work

- H-180 (Structured Lesson Extraction > Raw Replay): directly related
- context-learn-poller: current mechanism to audit
- coach experiments on skill transfer: related learning-loop work
