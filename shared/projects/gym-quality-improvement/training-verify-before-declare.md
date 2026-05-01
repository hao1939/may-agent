# Training Guidance: Verify-Before-Declare Pattern

**Target scenario**: build-activation-gap  
**Skill gap**: Agents declare success after performing an action without verifying the system is actually in the desired state.  
**Created**: 2026-08-14

## The Pattern

**WRONG**: Do action → declare done  
**RIGHT**: Do action → verify end state → declare done (or fix if state is wrong)

## Specific Examples

### Deployment
- ❌ Run build → update symlink → "deployed!"
- ✅ Run build → update symlink → check running process → restart if needed → verify process uses new binary → "deployed!"

### File editing
- ❌ Write file → "done!"
- ✅ Write file → read file back → confirm content matches intent → "done!"

### Test fixing
- ❌ Change code → "should fix the test"
- ✅ Change code → run test → see green → "fixed!"

## Why Agents Fail This

1. **Confusing intent with outcome**: The agent performed the "deploy" action, so mentally it's "deployed"
2. **Not modeling the full system**: Symlink ≠ running process. Agents need to think about what layers exist between their action and the desired state
3. **Premature satisfaction**: Getting partial confirmation (symlink updated) triggers task-completion behavior

## Key Heuristic

> **Before declaring any task complete, ask: "What would I check to PROVE this is working, not just that I ran the steps?"**

For deployments specifically:
- Is the **process** running the new code? (not just: is the file on disk?)
- Can I **observe** the new behavior? (hit an endpoint, check a log, read status)
- Does a **status check** confirm the new version?

## Applicable Conventions

- **C1.3** (verify-after-write): Same principle — always verify the effect of your action
- **FM-3.3** (operational verification): Check system state, not just action completion
- **FM-2.2** (end-to-end validation): Verify the full path from action to desired outcome

## Suggested Prompt Addition for Agents

```
When completing deployment/activation tasks:
1. Perform the build/deploy steps
2. ALWAYS check the running state (status command, process check, endpoint hit)
3. If running state doesn't match expected, take corrective action (restart, reload)
4. Only declare success after observing the new state is active
```
