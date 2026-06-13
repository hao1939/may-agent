# Feedback Loop Amplification — Implementation & Validation Plan

## Summary

Designed and implemented a lightweight feedback-echo mechanism that injects the
last evaluator critique into each agent's working directory as `last-eval.md`.
Agents are instructed (via `shared/common-sense.md`) to read this file at session
start and adapt their approach accordingly.

## What Was Done

### 1. Feedback-Echo Script (`agents/shared/feedback-echo.ts`)
- Queries evaluations DB for each agent's latest issues
- Generates `agents/<name>/last-eval.md` with:
  - Latest session verdict and quality score
  - Specific issues flagged
  - Deduplicated recent issue patterns (last 5 evaluations)
  - Action-required prompt
- Successfully generated files for 12 agents on first run

### 2. Agent Prompt Injection (`shared/common-sense.md`)
- Added "Evaluator Feedback (Learning Loop)" section
- Instructs agents to read `last-eval.md` at session start
- Placed before Heartbeats section for visibility

### 3. Cron Job (`feedback-echo-sync`)
- Runs hourly to keep feedback files current
- Ensures new evaluations are reflected within 1 hour

### 4. Convention Document (`contracts/feedback-echo-convention.md`)
- Defines the mechanism, validation criteria, and promotion path
- Status: draft (awaiting 5-session validation)

## Validation Plan

The mechanism needs 5 post-deployment sessions to validate. Success criteria:
- ≥3/5 sessions show agent reading `last-eval.md`  
- ≥2/5 sessions show agent acknowledging or adapting to feedback
- Repeated-issue rate decreases

**How to validate** (after 5+ sessions have occurred with these files in place):
```sql
-- Check session transcripts for last-eval.md reads
SELECT sessionId, agent FROM sessions 
WHERE createdAt > <deployment_timestamp>
-- Then inspect file_reads table or session transcripts for 'last-eval' references
```

## Architecture Decision

Chose file-based injection over:
- **Event consumption**: 248 pending learning.feedback events are never consumed; fixing the event consumer requires platform changes
- **Direct prompt injection**: Would require modifying the manager's system prompt builder (platform code)
- **Context fact**: Too volatile (changes every evaluation); a file that agents read on-demand is more appropriate

The file-based approach mirrors the successful `last-session.md` pattern and works
within the current harness without platform changes.

## Evidence

- `bun agents/shared/feedback-echo.ts` executed successfully, generating 12 files
- `agents/may/last-eval.md` contains actionable feedback (schema/query errors)
- `agents/scout/last-eval.md` contains actionable feedback (shallow sessions)
- `shared/common-sense.md` updated with reading instruction
- Cron job registered and active

## Next Steps

After 5 sessions have run with these files in place:
1. Query file_reads table for `last-eval.md` access
2. Check session transcripts for feedback acknowledgment
3. If ≥3/5 reference rate: promote to active convention
4. If <3/5: strengthen forcing (inject into task prompt directly)
