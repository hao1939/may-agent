# Few-Shot Example: Know When Blocked

**Domain class**: Tasks with unresolvable blockers (missing resources, impossible requirements)  
**Skill**: know-when-blocked (judgment)  
**Token estimate**: ~480 tokens

## Trigger Patterns

```regex
/blocked|impossible|can'?t.*find|missing.*key|missing.*credential|no.*permission|binary.*file|all.*fail/i
```

## Worked Example

> **Reference: How an experienced engineer handled discovering a blocker**
>
> An engineer was asked to fix a failing API integration test. The test called a weather endpoint that returned 401 Unauthorized.
>
> The engineer investigated methodically:
> 1. Read `weather-service.js` — saw `process.env.WEATHER_API_KEY` used in the auth header
> 2. Ran `env | grep -i weather` — empty, no key set
> 3. Searched the project: `find . -name '.env*' -o -name '*secret*'` — nothing found
>
> At this point, the engineer had clear evidence: the API key doesn't exist anywhere in the project. Three tool calls confirmed it.
>
> **The temptation**: "I investigated the issue thoroughly and identified the root cause. Let me report success — I found what's wrong!" But *identifying* a blocker is not *resolving* the task. The test still fails. The API still returns 401.
>
> **What the engineer actually did** — reported **blocked** immediately:
> - Status: **blocked**
> - Summary: "WEATHER_API_KEY not available. No credentials exist anywhere in the project."
> - Blocker: "Cannot fabricate valid API keys. A human must provide the credential."
>
> Total: 4 tool calls, 30 seconds. The blocker was escalated to someone who could actually resolve it.
>
> ---
>
> A second engineer faced a different task: "Debug the data corruption in processor.dat." They ran `hexdump processor.dat | head` and saw raw binary — no readable text, no source code, just compiled data.
>
> **Wrong response** (what actually happened in a previous session): The engineer spent 12 more tool calls trying XOR decryption, checking magic bytes, analyzing sector structure, and searching for hidden README files. The session timed out. `finish()` was never called. No status was recorded. The blocker was never escalated.
>
> **Right response**: After seeing binary data in tool call 2, stop. Call `finish(status: "blocked", summary: "processor.dat is compiled binary, not source code. Cannot debug or repair binary data.")`. Total: 3 tool calls.
>
> **The pattern**: When 2-3 tool calls confirm the task is impossible (binary file, missing credentials, no permissions), **stop and report blocked**. An honest "blocked" in 30 seconds is infinitely more valuable than heroic effort that produces no report after a timeout.

## Evidence

| Experiment | Condition | Result |
|---|---|---|
| EXP-090 | know-when-blocked few-shot (task message) | 3/3 pass (100%) |
| EXP-090 | No example (control) | 0/3 pass (0%) |
| EXP-094 | Domain-matched binary example (task message) | 3/3 pass (100%) |
| EXP-095 Arm A | Same example via injected_context.md | 3/3 pass (100%) |
| EXP-095 Arm B | Same content in SKILL.md (system prompt) | 0/3 pass (0%) — position matters |

**Cumulative**: 9/9 (100%) with matched example at task level; 0/6 (0%) without or in system prompt.

## Source

Synthesized from: `agents/coder/skills/know-when-blocked.md` + EXP-090/094/095 gym results
