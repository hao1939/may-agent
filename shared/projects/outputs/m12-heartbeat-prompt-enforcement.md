# M12: Heartbeat Prompt-Level Enforcement

## Change Made
Modified `agents/coach/heartbeat.md` to prepend a MANDATORY OUTPUT FORMAT section before the existing content.

## Rationale
After 11 iterations and 0% compliance:
- context.md instructions are ignored (supplementary, not authoritative)
- The workflow .ts file is dead code (heartbeat system doesn't use it)
- The ONLY text the coach LLM actually executes is `heartbeat.md`
- Putting the format requirement AT THE TOP of the task prompt is our best remaining option

## What Was Added (prepended to heartbeat.md)
```
## OUTPUT FORMAT (MANDATORY)
Your FIRST output in this session must be exactly this structure before any tool calls:

GOAL: [one sentence — what you'll accomplish this heartbeat]
PLAN:
1. [specific action]
2. [specific action]
3. [specific action]
DONE WHEN: [verifiable criteria]

Then execute your plan. End with finish() including verification_evidence.
Do NOT skip this. Do NOT make tool calls before outputting this block.
```

## Key Insight
The heartbeat system loads `heartbeat.md` as the direct task prompt. This is what the LLM sees as its instructions. Context.md is loaded separately as background. The task prompt has much higher compliance authority than supplementary context.

## Next Step
Wait for next coach heartbeat to fire (every 30min). Check `agents/coach/last-session.md` for GOAL/PLAN/DONE WHEN blocks as first output.
