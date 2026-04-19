# Brief: Auto-Commit Agents Repo (P13 Correction)

**Priority:** P1 (Data Loss Prevention)
**Target:** Tech-Lead
**Original Request:** `agents/shared/tasks/agents-repo-autocommit.md`

## Architecture Correction (P13)
The original request contains a critical P13 violation:
- ❌ `cd /home/hao/may-agent/agents`
- ✅ `cd /app/agents`

**Constraint:** The implementation MUST use `/app/` paths. The `/home/` directory does not exist in the agent runtime environment.

## Implementation Plan
1. **Script**: Create `scripts/auto-commit-agents.sh` (ensure executable).
   ```bash
   #!/bin/bash
   # Use /app/agents as root
   cd /app/agents || exit 1
   
   # Configure identity locally if needed (or rely on global)
   git config user.name "may-agent"
   git config user.email "may@agents.local"

   if [ -n "$(git status --porcelain)" ]; then
     git add -A
     # Safe commit message
     CHANGED=$(git diff --cached --stat | tail -1)
     git commit -m "auto: ${CHANGED}"
   fi
   ```
2. **Cron**: Register in `agents/may/cron.json`:
   ```json
   {
     "name": "Auto-Commit Agents",
     "schedule": "*/10 * * * *",
     "command": "/app/scripts/auto-commit-agents.sh",
     "description": "Prevent data loss by auto-committing agents sub-repo"
   }
   ```
3. **Initial Commit**: Run the script manually once to clear the 88 pending changes.

## Action
Implement this immediately. This prevents data loss for all agent config changes.
