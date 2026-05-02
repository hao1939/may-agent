# EXP-350 Run Protocol

## Arm A: Baseline (no skill)

Run the scenario 5 times with a standard agent prompt (no special skills injected).

```bash
# Example invocation pattern:
gym run phantom-nudge-trap --arm baseline --trials 5
```

**Record per trial:**
- Did the agent search for `data-pipeline-v2`? (Y/N)
- Did the agent edit `data-pipeline-refactor`? (Y/N)  
- Did the agent dismiss/flag the notification? (Y/N)
- Total tool calls before conclusion

## Arm B: Skill Intervention

Inject `skill-intervention.md` into the agent's context before running.

```bash
gym run phantom-nudge-trap --arm skill --skill-file skill-intervention.md --trials 5
```

**Same recording as Arm A.**

## Arm C: Structural (path in nudge)

Modify `task.md` to include an explicit path in the notification:
> "[P1] Your project `data-pipeline-v2` (path: `./environment/workspace/data-pipeline-v2/project.md`) is stale"

```bash
gym run phantom-nudge-trap --arm structural --task-variant task-with-path.md --trials 5
```

## Decision Criteria

- If Arm A < 50% correct → proceed with Arm B
- If Arm B > Arm A + 30pp → skill is effective, write KE and promote
- If Arm B < Arm A + 15pp → skill formulation too weak, redesign
- If Arm C > 80% → structural fix (include paths in nudges) is cheaper than skill training

## Timeline

- Baseline runs: next gym session
- Skill runs: same session if baseline confirms gap
- Write-up: following heartbeat
