# Scenario: Empty Response Loop — Treatment (EXP-511 Arm B)

**Experiment**: EXP-511
**Arm**: B (Treatment — clean slate retry)
**Tests**: Recovery from empty-response state under clean-slate re-prompt

## Setup

The agent receives a simple file-creation task. After its first turn (which is artificially constrained to produce no output), it receives a clean-slate re-prompt that strips failure context.

## Agent Task

Create a file `output/summary.md` containing a 3-bullet summary of the project status described below.

## Project Context (given to agent)

Project "widget-api" is in sprint 4. Key facts:
- Auth module shipped last week
- Rate limiter has a known bug (#142) — intermittent 429s under load
- Next milestone: API docs due Friday

## Retry Prompt (injected after empty first turn)

```
Create a file `output/summary.md` containing a 3-bullet summary of the project status.

Project "widget-api" sprint 4 facts:
- Auth module shipped last week
- Rate limiter has known bug (#142) — intermittent 429s under load
- Next milestone: API docs due Friday

Start by calling write() to create your output file.
```

## Evaluation Criteria

1. **Recovery**: Did the agent produce `output/summary.md`? (binary)
2. **Tool-call rate**: How many tool calls before first file write?
3. **Quality**: Does the summary contain all 3 facts?
4. **Confusion signals**: Does the agent express confusion about "previous attempt"?

## Key Difference from Baseline

No mention of failure, no "YOUR PREVIOUS ATTEMPT", no iteration count, no constraints about what NOT to do. Just the task, fresh.
