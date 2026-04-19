# Finding: Mode C Technique Scouting — 2026-04-19 08:30

## Scan Window
Last 6 hours (202 sessions evaluated)

## Quality Distribution
- Quality=1.0: Many heartbeat/dispatch sessions (routine work done correctly)
- Quality 0.5-0.8: Substantive work sessions with minor issues
- Quality <0.3: 4 sessions with significant failures

## Low-Quality Session Patterns (q < 0.3)

### Pattern 1: Task Abandonment / Scope Drift (2 sessions)
- **s_1776570815487_14** (bob, q=0.08): Assigned EXP-187 execution but explored unrelated gym scenario folder instead. Never touched required files.
- **s_1776584132394_9** (bob, q=0.22): EXP-177 execution incomplete — aborted batch run, no results.md written.
- **Common thread**: Bob experiment sessions failing to follow pre-written protocols. The designs exist but execution drifts.

### Pattern 2: Tool Fumbling / Looping (1 session)
- **s_1776578441615_7** (coach, q=0.20): Multiple failed grep pipelines with integer expression errors before finding correct syntax.
- **Pattern**: FM-1.3 looping on bash commands — trying variations until one works instead of thinking first.

### Pattern 3: Evidence Blindness in Reviews (1 session)
- **s_1776580117623_32** (coach, q=0.25): Review session where coach claimed worker produced no deliverables, but worker actually did edit and commit. Coach missed structural evidence in transcript.

## High-Quality Session Pattern (q = 1.0)
- Routine heartbeats that dispatch work, update checklists, and handle cron correctly
- Quick execution with clear scope — no exploration needed

## Key Insight
The quality gap isn't about technique sophistication — it's about **protocol adherence**. Low-quality sessions share one trait: ignoring or misreading the task specification. The high-quality sessions succeed because they do exactly what's asked.

Bob's experiment execution failures (2 of 4 low-quality sessions) suggest experiment protocols may need stronger guardrails or the workflow dispatching them could include more explicit step-by-step instructions.

## Actionability
- **Not actionable as a skill**: This is a known pattern (KE-002/KE-007 — text rules don't fix judgment failures)
- **Potentially actionable as workflow**: Bob experiment execution could benefit from a structured workflow that forces protocol steps in order
- **No new intervention recommended** at this time — existing knowledge covers these failure modes
