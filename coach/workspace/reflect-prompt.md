# Reflection Procedure

**Trigger**: cron:reflect (runs every ~6h)  
**Input**: `.state/human-inputs.jsonl`, recent agent activity, experiment status  
**Output**: `agents/coach/workspace/reflections/YYYY-MM-DD-HH-reflection.md`  

## Steps

### 1. Load Context
- Read `last_analyzed_ts` from the most recent reflection file
- Read all human inputs from `.state/human-inputs.jsonl` after that timestamp
- Scan `agents/coach/workspace/activity.jsonl` for recent coach activity
- Query `may.db` for system health (session outcomes, error rates, op usage)

### 2. Classify New Inputs
For each new human input, classify as:
- **DIRECTION** — Strategic directive, new priority, design decision
- **CORRECTION** — Human correcting agent behavior, expressing frustration, demanding evidence
- **INQUIRY** — Status request, "what's happening?"
- **EXPLORATION** — Thinking out loud, brainstorming
- **DECISION** — Making a concrete choice between options
- **CLARIFICATION** — Explaining intent or adding nuance

### 3. Theme Extraction
Group related inputs into themes. For each theme:
- State the core directive or concern
- Connect to evidence (experiment data, production metrics)
- Identify what the system is/isn't doing about it

### 4. Root Cause Analysis
For corrections/frustrations:
- Why did the human have to intervene?
- Is this a systemic gap or a one-time issue?
- Has this been flagged before? (check previous reflections)

### 5. Follow-Up Tracking
Review improvement tasks from the last reflection:
- Status each one (DONE / IN PROGRESS / NOT STARTED / BLOCKED)
- Close completed items
- Escalate stalled items

### 6. Generate Improvement Tasks
Produce concrete, actionable tasks with:
- **ID**: IT-N
- **Priority**: P0/P1/P2
- **Target**: Which agent/role should act
- **Action**: Specific steps
- **Verification**: How to confirm it's done

### 7. Write Reflection
Write to `agents/coach/workspace/reflections/YYYY-MM-DD-HH-reflection.md`
Include: inputs analyzed, classifications, themes, root causes, follow-ups, new tasks, experiment status board.
End with `last_analyzed_ts: <latest ts analyzed>`

### 8. If No New Inputs
When there are no new human inputs since last reflection, the reflection becomes a **synthesis/review** cycle:
- Review follow-up items from recent reflections
- Audit system health data for emerging patterns
- Check experiment milestones approaching
- Identify any recurring themes that haven't been resolved
- This is a "check the pulse" reflection, not a "process new data" reflection
