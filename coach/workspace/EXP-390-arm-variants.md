# EXP-390 Arm Variants — Heartbeat Snippet Overrides

## Arm A (Control) — threshold=10
```
ANTI-SHALLOW RULE (P0):
- You MUST make at least 10 tool calls before calling finish().
- "Nothing to do" is NEVER true.
- A session that only reads files and declares "done" is a FAILURE. Produce an artifact every session.
```

## Arm B (High) — threshold=15
```
ANTI-SHALLOW RULE (P0):
- You MUST make at least 15 tool calls before calling finish().
- "Nothing to do" is NEVER true.
- A session that only reads files and declares "done" is a FAILURE. Produce an artifact every session.
```

## Arm C (Low) — threshold=5
```
ANTI-SHALLOW RULE (P0):
- You MUST make at least 5 tool calls before calling finish().
- "Nothing to do" is NEVER true.
- A session that only reads files and declares "done" is a FAILURE. Produce an artifact every session.
```

## How to inject
When running gym scenarios, the heartbeat content is loaded via `coaching/my-instructions.md` in the scenario environment. To test each arm:
1. Copy the scenario to a variant folder (e.g., `partial-verification-trap-arm-b`)
2. Replace the ANTI-SHALLOW RULE text in `coaching/my-instructions.md` with the arm variant
3. Run via: `cd /app/agents && export GYM_AGENT_BIN=/usr/local/bin/may-agent && bash test/gym/run-gym.sh <scenario-variant> --timeout 10`

## Alternative: Direct injection
If scenarios don't have coaching/my-instructions.md, inject via the scenario's `system_prompt_append` field in config.json.
