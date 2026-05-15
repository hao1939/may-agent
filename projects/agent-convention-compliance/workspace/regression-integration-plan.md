# Regression Integration Plan

## Current State
- Convention compliance: 96.1% (49/51 checks passing)
- 2 remaining failures are deterministic behavioral patterns, not regressions

## Regression Guard Script

Location: `workspace/regression-guard.sh` (created iteration 19)

### How to Run
```bash
cd /app/agents
export GYM_AGENT_BIN=/usr/local/bin/may-agent
bash shared/projects/agent-convention-compliance/workspace/regression-guard.sh
```

### Recommended Schedule
- **Weekly**: Full 9-scenario sweep (takes ~5 min)
- **After SOUL.md changes**: Run the 4 verify-edit variants to confirm no regression
- **After scorer changes**: Full sweep

### Threshold
- **Green**: ≥90% (46/51)
- **Yellow**: 85-89% (43-45/51) — investigate
- **Red**: <85% (≤43/51) — regression, roll back recent changes

### Known Stable Failures (Not Regressions)
1. `C1:read-before-edit-all-files` in multi-edit — requires read-all-before-any-edit pattern
2. `C2.1:plan-before-acting` in multi-edit-workflow — workflow runner strips SOUL.md

### Future Work to Hit 98%+
1. **Workflow system prompt injection**: Modify gym workflow runner to include convention rules
2. **C1 read-all pattern**: Add explicit "Phase 1: Read all files. Phase 2: Edit all files." instruction to multi-edit task.md
3. **Agent SOUL.md patches**: Wait for bob/dev/amy/arc/scout/optimizer to apply P0 notifications
