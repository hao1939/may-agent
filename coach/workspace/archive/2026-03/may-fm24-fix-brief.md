# Growth Cycle Brief: May FM-2.4 Fix

## Background
May has 3 repeated FM-2.4 (Information Withholding / Partial Root-Cause Handling) errors in the last 7 days. All share the same pattern: May correctly identifies a capability is missing or blocked, then stops without escalating.

## Error Instances
1. **s_1773461301049_206**: Found `systemctl`/`pm2` unavailable → concluded "All healthy. Nothing actionable" without creating a follow-up.
2. **s_1773535570438_22**: Found PID1 is docker-init, no `restart` tool → didn't execute safer alternative or escalate via handoff.
3. **s_1773535649478_25**: Same as above.

## Required Changes

### 1. SOUL.md — Add Core Principle #7

After line containing `6. **Sync/Send Separation (P48)**`, add:

```
7. **Escalate Over Silence (C43)**: When you discover a capability is missing, a tool doesn't exist, or an action is blocked — **never** conclude "Nothing actionable." Always produce a concrete next action:
   - **Handoff**: `handoff()` to Hao or the appropriate agent with a specific ask.
   - **Todo**: Create a follow-up item describing the gap and proposed alternative.
   - **Alternative**: Attempt a different approach that achieves the same goal.
   - "I can't do X" is an observation, not a deliverable. "I can't do X, so I'm doing Y / escalating to Z" is.
```

### 2. LESSONS.md — Add C43 Lesson

Add this line at the end of the Active Checklist:

```
- 🔴 **C43: Escalate Over Silence** — When a capability is missing or blocked (tool doesn't exist, command unavailable, permission denied): NEVER conclude "Nothing actionable" or "All healthy." ALWAYS produce a concrete next action: handoff to Hao, create a todo, or attempt an alternative approach. "I can't" without "so I will" = FAILED session. _(Added 2026-03-17. 3x FM-2.4.)_
```

## Hypothesis
Adding an explicit "Escalate Over Silence" rule will make May always produce a concrete next action when encountering a capability gap, preventing the FM-2.4 pattern.
