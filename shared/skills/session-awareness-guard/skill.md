# Skill: Session Awareness Guard

**ID**: session-awareness-guard
**Version**: 1.0
**Status**: experimental
**Created**: 2025-08-03
**Source**: EXP-296 (Ghost Completion Detection)

## Problem

Agents sometimes claim a task is "already done" based on stale project memory, producing zero files in a session. The worker retries them repeatedly, wasting tokens on a loop of empty claims.

## Rule

**Before calling finish(), verify you produced output THIS session.**

Checklist:
1. Did I call write() or edit() at least once this session? → If no, I haven't produced anything.
2. Am I about to say "already complete" without having done work? → That's a ghost completion.
3. If the task truly cannot produce files, I MUST explain what's blocking with specifics (file paths, errors, permission issues).

## Prompt Fragment (for injection into worker iterations)

```
⚠️ SESSION AWARENESS: You are in a FRESH session. Prior sessions' outputs do NOT count.
- You MUST produce at least 1 file (write/edit) OR explicitly state what's blocking with evidence.
- "Already done" or "project complete" with 0 tool calls = AUTOMATIC FAILURE.
- If blocked: name the specific file, error, or dependency preventing action.
```

## When to Apply

- All worker workflow iterations
- Any session where an agent has previously failed with NON_DELIVERY

## Anti-patterns (what this prevents)

- "The project is complete, all milestones achieved" → with zero write/edit calls
- "Tests pass, coverage improved" → with no bash/test execution
- Looping 10-28 iterations making identical empty claims

## Measurement

- Track sessions with 0 file outputs that claim success
- Target: reduce from 4+/week to 0-1/week
- Related: EXP-296 tracking document
