---
name: growth-cycle
description: Standard workflow for evolving agents (Fork-Train-Verify-Promote).
version: 2.0.0
tools: [agent-growth]
---

# Skill: Agent Growth Cycle

**Status**: Verified (2026-03-14)
**Owner**: Coach

The Growth Cycle is the standard mechanism for safely evolving agents.
It replaces "editing live agents" with a rigorous **Fork → Train → Gym Test → Promote** workflow.

## The Principle
**P51 The Growth Cycle**: Evolution requires isolation. Never practice on production.
1. **Fork**: Create a safe lab copy.
2. **Train**: Apply changes (prompts, knowledge, skills).
3. **Gym Test**: Prove it works with automated scoring.
4. **Promote**: Apply to production.

## The Workflow

### 1. Identify the Need
- **Trigger**: A recurring failure pattern, a missing skill, or a directive to improve an agent.
- **Output**: A clear hypothesis. "If I add X to Coder, it will stop doing Y."

### 2. Fork (`fork_agent`)
Create an isolated clone.
```bash
fork_agent('coder', 'coder-v2')
# Creates agents/.lab/coder-v2/
```
- The fork inherits the parent's config, so it has all current context.

### 3. Train (Edit the Fork)
Modify the fork — one method at a time.
- Edit: `agents/.lab/coder-v2/SOUL.md`, `knowledge/`, `heartbeat.md`, etc.
- **One change per experiment.** Multiple changes make results uninterpretable.
- Consult `knowledge/method-catalog.md` for the right method.

### 4. Gym Test (`scripts/gym-run.sh`)
Run the forked agent against gym scenarios with automated scoring.
```bash
# Test the fork
scripts/gym-run.sh <scenario> --agent coder --lab coder-v2 --timeout 3

# Baseline comparison (no --lab)
scripts/gym-run.sh <scenario> --agent coder --timeout 3
```

Output is JSON: `{ passed, checks[], summary }`.

- **The scorer decides**, not you. If the scorer says fail, the fix didn't work.
- **Always run baseline** for comparison if you don't have one yet.
- **Do NOT use git stash, git checkout, or git branch.** The `--lab` flag handles isolation by copying production agents/ and overlaying the fork.

### 5. Decide & Record
- **Pass**: Promote the fork. Log to `workspace/experiments.jsonl`.
- **Fail**: Iterate on step 3 or discard. Log the failure too.

### 6. Promote (`promote_agent`) or Discard (`discard_agent`)
```bash
# If verified:
promote_agent('coder-v2', 'coder')
# Overwrites config/knowledge. Does NOT overwrite agent.json or workspace.

# If failed:
discard_agent('coder-v2')
```
Always clean up. Don't leave dead forks.

## Example: Fixing "Shotgun Debugging"
1. **Observe**: Coder guesses at fixes without reading errors.
2. **Fork**: `fork_agent('coder', 'coder-strict')`.
3. **Train**: Add "Debug Protocol" to `coder-strict/SOUL.md`.
4. **Gym Test**: `scripts/gym-run.sh phantom-fix --agent coder --lab coder-strict`.
5. **Compare**: Baseline fails, patched passes → promote.
6. **Promote**: `promote_agent('coder-strict', 'coder')`.

## Constraints
- **Never edit live agents** for behavioral changes. Fork first.
- **Gym verification is mandatory.** No promotion without a passing gym run.
- **One method per experiment.** For interpretable results.
- **Clean up.** Always promote or discard.

## Lessons Learned (2026-03-17)

1. **Baseline-passing scenarios are useless for behavioral fixes.** If the
   baseline agent already passes a gym scenario, you can't measure whether
   your fix helped. Before running experiments, verify that the scenario
   actually triggers the target failure pattern. If all scenarios pass
   baseline, you need harder scenarios first.

2. **Gym infrastructure must be verified before running experiments.** Check
   that the agent is registered in the test env, worktrees set up correctly,
   and the gym runner produces valid output. Wasting experiments on infra
   failures is costly.

3. **All text-based additions degrade baseline performance.** Sprint 1 tested
   5 methods (heartbeat step ×2, SOUL guard, knowledge file, LESSONS entry).
   ALL caused regressions on previously-passing scenarios. Adding text
   shifts model behavior globally — even well-targeted additions cause
   collateral damage. Future methods should be SUBTRACTIVE or CONDITIONAL.

4. **Null-patch test proves forks are clean.** Forking an agent with zero
   changes produces identical gym results to baseline. Regressions in
   experiments are caused by the patches, not infrastructure.

5. **Test on BOTH target AND non-target scenarios.** Sprint 1's key failure
   was that methods improved the target scenario but regressed others. Always
   test the full scenario suite, not just the target.

6. **"Coercive" language causes premature action.** SOUL guards with "MUST
   do X within N steps" forced the agent to rush. Use advisory language
   ("prefer X", "consider Y") instead of mandates.
