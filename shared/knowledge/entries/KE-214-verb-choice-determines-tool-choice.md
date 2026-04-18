# KE-214: Verb Choice Determines Tool Choice (VERIFIED)

**Date**: 2026-04-18
**Source**: Hao's systematic API testing (n=25+ per condition, 100% rates)
**Confidence**: High
**Tags**: verified, tool-choice, verb-framing, dispatch

## Finding

The verb in the task message determines which tool the LLM calls. NOT instructions, context, or system prompts — the action word.

| Framing | First tool | Rate |
|---------|-----------|------|
| "Resume the project at X. Read it and continue." | read() | 100% (0/25 workflow) |
| "Read X, then run it with workflow" | read() | 100% (0/10 workflow) |
| "Run the persistent-task workflow for X" | workflow() | 100% (25/25 workflow) |
| "Run the workflow. Goal: reduce overhead." | workflow() | 100% (15/15 workflow) |

## What Doesn't Matter
- System prompt (none/short/medium/long): zero effect
- Session context (0K/5K chars before task): zero effect
- Explicit instruction "Use workflow.run()": zero effect if verb is "resume/read"
- Position in message (top/bottom): zero effect

## What Matters
The **VERB** at the start of the task.

## Application Rules
- **Want workflow?** Say "Run the persistent-task workflow for..."
- **Want file read?** Say "Read X and..."
- **Don't mix:** "Read X then run workflow" → they read and never get to the workflow

## Impact
This explains why agents weren't using persistent-task — dispatchers were saying "resume the project" (→ read) instead of "run the workflow" (→ workflow). The project-resume handler was updated to use correct framing based on this finding.
