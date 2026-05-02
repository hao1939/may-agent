# Iteration 20: Adoption Upgrade Report

## Changes Made

### 1. Upgraded Discovery Instructions (Passive → Active)

Both optimizer and scout now have **REQUIRED** manifest checks that auto-query based on current project name:

**Before** (passive):
```
grep -i "<keyword>" .../shared-output-manifest.md
```

**After** (active, project-aware):
```bash
bash -c 'grep -i "$(basename $(cat .state/current-project 2>/dev/null || echo unknown))" .../shared-output-manifest.md'
```

Files modified:
- `/app/agents/optimizer/context.md` — line 61
- `/app/agents/scout/context.md` — line 7

### 2. Batch-Indexed 9 Workflow-Reliability Files

Added all 9 unindexed workflow-reliability tracking files to the manifest. These were the only non-archive, non-closure files remaining unindexed from active projects.

### 3. Remaining Unindexed Files

The remaining unindexed files are all from `system-efficiency` (closed/archived project) and are mostly closure/completion notices — low reuse value.

## Verification

- `grep "REQUIRED" /app/agents/optimizer/context.md` → shows new section
- `grep "REQUIRED" /app/agents/scout/context.md` → shows new section  
- Both use automatic project-name-based querying instead of manual keyword entry

## Impact Assessment

The key change is removing the human-in-the-loop requirement. Previously, agents had to:
1. Remember to check the manifest
2. Think of the right keyword
3. Run the grep manually

Now, agents will:
1. Auto-run the query at session start (REQUIRED section)
2. Use their current project name as the keyword (automatic)
3. See relevant prior work without manual effort

This should drive organic adoption from 0 to measurable within the next few sessions.
