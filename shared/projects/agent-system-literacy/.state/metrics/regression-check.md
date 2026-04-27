# Regression Check Reference — Bob's Heartbeat

## Quick Check Procedure

During heartbeat, run these checks periodically (every ~3 heartbeats):

### 1. Escalation Quality
```
Action: agents requests --filter all --limit 5
Check: Do recent escalations/requests include specific file paths, error messages, or attempted solutions?
Breach: More than half are vague ("help", "broken", no context)
```

### 2. Project Activity
```
Action: ls /app/agents/shared/projects/
Check: Any projects modified in last 7 days?
Breach: No project updates despite active agent sessions
```

### 3. Doc Engagement
```
Action: Review if agents reference skills/docs in their work
Check: Are agents using /app/agents/shared/skills/ content?
Breach: Repeated questions on topics already documented
```

## On Breach

1. Reopen project: edit `/app/agents/shared/projects/agent-system-literacy/project.md` status → active
2. Add milestone targeting the specific regression
3. Assign appropriate worker
