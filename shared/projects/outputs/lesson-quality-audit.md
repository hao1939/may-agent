# Lesson Quality Audit — Iteration 9 Update

**Date**: 2025-01-27 (updated iteration 9)  
**Auditor**: Worker agent

## Summary

- **79 total lessons** in `lessons.jsonl` (59 before + 20 new from 8 uncovered agents)
- **0 organic lessons** from the context-learn pipeline
- **All 59 are seeded**: 20 from initial extraction + 39 bootstrapped from context.md files
- **Poller has run once**: processed 2 sessions, but context-learn updates `context.md` files, NOT `lessons.jsonl`

## Lesson Breakdown by Agent

| Agent | Count | Source |
|-------|-------|--------|
| coder | 5 | bootstrapped from context.md |
| coach | 5 | bootstrapped from context.md |
| scout | 3 | bootstrapped from context.md |
| may | 3 | bootstrapped from context.md |
| system | 2 | extracted from context.md |
| bob | 2 | bootstrapped from context.md |

(Remaining 39 from initial seeding batch)

## Lesson Category Distribution

| Category | Count |
|----------|-------|
| pattern | 12 |
| insight | 6 |
| fix | 2 |

## Quality Assessment (1-5 scale)

### High Quality (5/5) — Actionable, specific, battle-tested
- **coder/Post-Fix Pipeline Trace**: "After fixing a bug, trace the full data flow" — directly prevents regression
- **coach/Completion Illusion**: "Analysis gates HARM performance" — specific anti-pattern with data (KE-180)
- **scout/Few-shot examples**: "HARMFUL for discovery/exploration" — counterintuitive, data-backed

### Good Quality (4/5) — Useful but somewhat generic
- **system/C1.1 read-before-edit**: Universal rule, well-quantified ("#1 violation cause")
- **bob/sqlite3 CLI unavailable**: Environment-specific, saves time
- **may/Prefer fork() over message()**: Actionable tool choice guidance

### Medium Quality (3/5) — True but could be more specific
- **coder/Mock Leak Awareness**: Good pattern but lacks specifics on detection
- **may/Knowledge must be APPLIED**: Aspirational rather than actionable

### Observations
1. **No duplicates detected** — each lesson is unique
2. **Strong agent-specificity** — lessons are tagged to the right agent domains
3. **Missing agents**: architect, evaluator, judge, master, optimizer, qa, tech-lead have 0 lessons despite having context.md files (21-125 lines each)

## Pipeline Status

### What's Working
- Poller handler exists at `agents/may/handlers/context-learn-poller.ts`
- Cron entry exists in `agents/may/cron.json`
- Poller has fired once, processed 2 sessions
- State tracking works (`.state/context-learn-poller-processed.json`)

### What's NOT Working
- **context-learn writes to context.md, not lessons.jsonl** — the pipeline updates agent context files but doesn't append to the shared lesson store
- **Zero organic lesson capture** — all 59 lessons are manually seeded
- **session.completed event never emits** — core runtime doesn't fire it, poller is the workaround

## Context.md Stats (total knowledge base)

| Agent | Lines |
|-------|-------|
| coder | 125 |
| bob | 113 |
| tech-lead | 111 |
| may | 92 |
| coach | 83 |
| scout | 84 |
| amy | 72 |
| optimizer | 73 |
| qa | 70 |
| amy-kimi | 46 |
| evaluator | 41 |
| architect | 21 |
| judge | 22 |
| master | 21 |
| **Total** | **974** |

## Recommendations

1. **Fix context-learn to also append to lessons.jsonl** — currently it only modifies context.md. The lesson store needs a write path.
2. **Extract lessons from remaining agents** — architect, evaluator, judge, master, optimizer, qa, tech-lead have rich context.md but 0 lessons in jsonl
3. **Add validated_count tracking** — all lessons have `validated_count: 0`. Need a mechanism to increment when a lesson proves useful.
4. **Quality bar**: Current seeded lessons are 3-5/5 quality. Set minimum bar at 3/5 for organic capture.
