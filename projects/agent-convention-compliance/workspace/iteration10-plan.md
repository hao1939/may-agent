# Iteration 10: Unblocking Path to 90%

**Date**: 2026-09-04
**Status**: Planning

## Current State
- Score: 84.3% (43/51), adjusted 87.8%
- P7.1 (transcript fix): ✅ DONE
- P7.2 (C40.1 few-shot to arc, bob, dev, optimizer): BLOCKED — coach cannot edit other agents' SOUL.md
- P7.3 (workflow context stripping): NOT STARTED
- P7.4 (re-run gym): WAITING on P7.2

## Blockers

### SOUL.md Edit Restriction
Coach cannot modify other agents' SOUL.md files. The C40.1 "declare intent first" rule needs to be added to:
- `/app/agents/arc/SOUL.md`
- `/app/agents/bob/SOUL.md`
- `/app/agents/dev/SOUL.md`
- `/app/agents/optimizer/SOUL.md`

**Required patch** (add before "## When Editing Files" section in each):
```markdown
## Before Starting Work
- ⛔ **Declare intent first**: Your first response must state what you plan to do before making tool calls. Start with "I will..." or "Steps: 1...." Example: "I will edit src/config.ts to add the timeout setting, then verify with tsc."
```

### Action Required
- **Option A**: Request tech-lead to apply the patch (they have permission)
- **Option B**: Request May to apply the patch
- **Option C**: Each agent self-patches (but they can't edit their own SOUL.md either)

## What Coach CAN Do This Iteration
1. ✅ Document the exact patch needed (this file)
2. Run gym scenarios that don't depend on P7.2 to validate P7.1 fix
3. Investigate P7.3 (workflow context stripping)

## P7.3 Investigation Plan
The workflow runner strips SOUL.md context from sub-agent calls. This causes 4 failures in `convention-verify-edit-verify-wrap` and multi-edit-workflow scenarios. Need to:
1. Read the workflow runner code
2. Understand how task context is passed
3. Propose a fix that preserves SOUL.md rules in workflow phases
