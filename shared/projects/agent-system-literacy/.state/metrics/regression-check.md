# Regression Check Reference — For Heartbeat Use

## Quick Check List

```
CHECK 1: Escalation Quality
  Look at: /app/agents/shared/ for recent escalation files
  Pass if: ≥50% have (problem + tried + ask)
  Fail action: Reactivate project

CHECK 2: Project Creation Rate  
  Look at: /app/agents/shared/projects/ modification dates
  Pass if: Any project activity in last 7 days
  Fail action: Note; reactivate if 3 consecutive fails

CHECK 3: Literacy Pass Rate
  Look at: Agent behavior in recent sessions
  Pass if: Agents correctly use project files, delegation, tools
  Fail action: Reactivate project
```

## Last Checked
- Date: (fill in during heartbeat)
- Status: (PASS / BREACH)
- Notes: (details)
