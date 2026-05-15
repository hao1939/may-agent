# NON_DELIVERY Pattern Analysis — 2026-05-06

## Finding
Evaluator flagged NON_DELIVERY issues in 4 of 5 recent evaluated sessions:
- **coach** (s_1777483248275_448): 28+ iterations repeating "project is complete" — zero files written
- **optimizer** (s_1777471451597_3): Intent to update project.md but no output  
- **optimizer** (s_1777483248263_447): Interrupted clean start, no evidence of work
- **optimizer** (s_1777483248236_446): No files despite retries and WRITE-FIRST constraint

## Pattern Classification
Two distinct failure modes:

### 1. Ghost Completion (coach case)
Agent reads project state, sees milestones marked done, concludes "nothing to do" — loops 28 times.
- **Root cause**: Task/context confusion (EXP-910 target)
- **EXP-910 relevance**: SIH was deployed to master-worker.ts to separate "YOUR TASK" from "PROJECT CONTEXT"
- **Question**: Was this coach session dispatched BEFORE or AFTER SIH deployment? If after, SIH didn't fix it.

### 2. Execution Failure (optimizer cases)
Agent starts but produces nothing — crashes, interrupted, or enters no-op loop.
- **Root cause**: Possibly infrastructure (clean start failures) or task complexity
- **Not an EXP-910 issue** — these are execution failures, not state confusion

## EXP-910 Measurement Status
SIH was deployed to master-worker.ts. Need to check:
1. How many master-worker runs occurred post-deployment?
2. Did any post-SIH runs show ghost completions?

Current data is insufficient for formal measurement — the recent evaluations may predate SIH deployment. The workflow-run metadata doesn't contain enough detail to audit transcripts.

## Proposed Next Steps

### Immediate (this session or next)
- **H-EXP-068**: Hypothesis that NON_DELIVERY is concentrated in "project complete" scenarios where all milestones are done but the project isn't closed. Test: check if these sessions were dispatched for projects at final milestone.

### Short-term
- **Terminal iteration guard**: When a worker session produces 0 files for 3+ consecutive iterations, auto-close the project or escalate (prevents the 28-iteration waste in the coach case).
- **EXP-800**: Still blocked on gym infra. Manual fork protocol remains viable.

## Circuit Breaker Audit
`master-worker.ts` has a zero-output guard (line 396): MAX_ZERO_OUTPUT=3, auto-terminate at 6 consecutive zero-output iterations. The coach 28-iteration case either:
1. Predates this guard's deployment
2. Was NOT dispatched via master-worker (different workflow path)
3. The agent produced files but they were empty/irrelevant (not truly zero-output)

The SIH (Session Intent Header) is deployed at lines 420-440, properly separating "YOUR TASK" from project context.

## Connection to Existing Knowledge
- **KE-511 (Iatrogenic Retry)**: Retrying failing sessions can make things worse. The 28-iteration coach loop is a clear case.
- **EXP-296 (Ghost Completion)**: Circuit breaker IS in master-worker.ts (auto-terminate at 6). If the coach case bypassed it, we need to understand which dispatch path was used.
- **EXP-910 (SIH)**: Deployed at lines 420-440. Awaiting measurement data.

## Severity
HIGH — 80% of recently evaluated sessions showed NON_DELIVERY. Even if some are infrastructure issues, the ghost completion variant (coach) represents pure waste. A terminal iteration guard would have saved 25+ iterations × session cost.
