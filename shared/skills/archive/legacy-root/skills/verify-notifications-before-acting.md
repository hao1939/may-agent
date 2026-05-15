# Skill: Verify Notifications Before Acting

**Status**: EXPERIMENTAL (EXP-440)
**Target**: All agents receiving inbox/notification events

## Rule

When you receive a notification referencing a project, file, or resource:

1. **VERIFY it exists** — search/list the filesystem to confirm the referenced item is real
2. **If it doesn't exist** — dismiss the notification and note the discrepancy
3. **If it does exist** — proceed normally

## Why

Agents consistently accept notifications at face value without checking ground truth (EXP-440: 0% verification rate). This leads to wasted effort on phantom projects and confabulated status updates.

## Anti-pattern

```
❌ "I received a notification about data-pipeline-v2. Let me work on it."
   (Never checked if data-pipeline-v2 exists)
```

## Correct pattern

```
✅ "I received a notification about data-pipeline-v2. Let me verify it exists first."
   $ find . -name "*data-pipeline-v2*" -o -path "*data-pipeline-v2*"
   (No results — this project doesn't exist. Dismissing phantom notification.)
```

## Scope

Applies to:
- Heartbeat inbox events referencing projects
- Cross-agent messages referencing files or resources
- Any task that names a specific artifact to act on
