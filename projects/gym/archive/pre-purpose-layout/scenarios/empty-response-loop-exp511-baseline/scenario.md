# Scenario: Empty Response Loop — Baseline (EXP-511 Arm A)

**Experiment**: EXP-511
**Arm**: A (Control — escalating retry)
**Tests**: Recovery from empty-response state under pressure-escalation

## Setup

The agent receives a simple file-creation task. After its first turn (which is artificially constrained to produce no output), it receives the current production retry prompt with escalating pressure.

## Agent Task

Create a file `output/summary.md` containing a 3-bullet summary of the project status described below.

## Project Context (given to agent)

Project "widget-api" is in sprint 4. Key facts:
- Auth module shipped last week
- Rate limiter has a known bug (#142) — intermittent 429s under load
- Next milestone: API docs due Friday

## Retry Prompt (injected after empty first turn)

```
🚨 YOUR PREVIOUS ATTEMPT PRODUCED 0 FILES. This is iteration 2 retry.

Your FIRST tool call MUST be write(). Do NOT use read() or bash() first. Do NOT claim files already exist.

Original task:
Create a file `output/summary.md` containing a 3-bullet summary of the project status.
```

## Evaluation Criteria

1. **Recovery**: Did the agent produce `output/summary.md`? (binary)
2. **Tool-call rate**: How many tool calls before first file write?
3. **Quality**: Does the summary contain all 3 facts?
4. **Confusion signals**: Does the agent express confusion about "previous attempt"?
