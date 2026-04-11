# Skill: Agent Gym & Lab

Testing and experimentation system for agent behavior.

## Quick Reference

```bash
# Run one scenario
scripts/gym-run.sh <scenario> --agent <agent> --timeout 3

# List scenarios
scripts/gym-run.sh --list
scripts/gym-run.sh --list --tier smoke
scripts/gym-run.sh --list --category bug-fixing

# Run all smoke scenarios
scripts/gym-run.sh --run-all --tier smoke --agent coder

# Test a .lab/ fork
scripts/gym-run.sh <scenario> --agent coder --lab <fork-name>

# Batch runs: multiple scenarios/variants/trials in one call
scripts/gym-batch.sh --scenario <name> --agent coder --trials 5
scripts/gym-batch.sh --scenario <name> --variants baseline,my-fork --trials 3
scripts/gym-batch.sh --tier smoke --agent coder --variants baseline,fork1

# Run a lab experiment (A/B comparison)
scripts/lab-run.sh EXP-XXX
scripts/lab-run.sh EXP-XXX --dry-run
```

## Gym: Single Scenario Runs

The gym runs one agent against one scenario. The scenario has:
- `task.md` — what the agent is asked to do
- `environment/` — the files the agent works with
- `success_criteria.js` — automated scorer (pass/fail per check)
- `scenario.json` — metadata (tier, categories, timeout)

The scorer decides pass/fail, not the agent.

**Output**: JSON with `passed`, `checks[]`, `duration_ms`, `session_id`.

## Lab: A/B Experiments

The lab runs multiple arms of the same scenario with different setups. Reads experiment design from `agents/shared/knowledge/experiments/EXP-XXX/design.json`.

### Design Format

```json
{
  "hypothesis": "H-003",
  "description": "Does the verification skill improve pass rate?",
  "arms": {
    "control": {
      "scenario": "verify-before-finish",
      "agent": "coder",
      "setup": {}
    },
    "treatment": {
      "scenario": "verify-before-finish",
      "agent": "coder",
      "setup": { "install_skill": "verification" }
    }
  },
  "runs_per_arm": 3,
  "metrics": ["passed", "ops", "duration_ms"]
}
```

### Setup Options

| Option | What it does | Example |
|--------|-------------|---------|
| `install_skill` | Copy skill from shared/skills/ to agent | `{"install_skill": "verification"}` |
| `remove_skill` | Remove a skill from agent | `{"remove_skill": "verification"}` |
| `context_file` | Replace agent's context.md | `{"context_file": "path/to/alt-context.md"}` |
| `append_context` | Add text to context.md (without replacing) | `{"append_context": "Always verify before finish."}` |
| `model` | Use a different model | `{"model": "gemini3flash"}` |

All setup is per-arm, cleaned up after each run. Production agent config is never permanently changed.

### Running

```bash
# Dry run (shows what would happen)
scripts/lab-run.sh EXP-003 --dry-run

# Run the experiment
scripts/lab-run.sh EXP-003
```

Results saved to `agents/shared/knowledge/experiments/EXP-XXX/runs/`.

## Batch Gym Runs

When running multiple trials, comparing variants, or running across tiers — use `gym-batch.sh` instead of calling `gym-run.sh` in a loop:

```bash
# Run 5 trials of one scenario (for statistical confidence)
scripts/gym-batch.sh --scenario hasty-fix --agent coder --trials 5

# Compare baseline vs a lab fork, 3 trials each
scripts/gym-batch.sh --scenario verify-before-finish --agent coder \
  --variants baseline,coder-with-skill --trials 3

# Run all smoke-tier scenarios with comparison
scripts/gym-batch.sh --tier smoke --agent coder --variants baseline,my-fork --trials 2
```

**When to use gym-batch vs gym-run**: If you're about to call `gym-run.sh` more than twice in a session, use `gym-batch.sh` instead. It handles the loop, records results with batch IDs, and prints a comparison summary.

## Growth Cycle (Fork → Test → Promote)

For persistent changes (not just A/B tests):

1. **Fork**: Copy agent to `.lab/` — `forkAgent("coder", "coder-with-skill")`
2. **Modify**: Edit the fork's SOUL.md, skills/, context.md
3. **Test**: `scripts/gym-run.sh <scenario> --agent coder --lab coder-with-skill`
4. **Compare**: Run same scenario without `--lab` for baseline
5. **Promote or discard**: If better, copy changes back. If not, delete the fork.

## Scenarios

Scenarios are in `agents/gym/scenarios/`. Each directory contains:
```
scenarios/
  cascading-error/
    scenario.json      # {tier, categories, tags, timeout}
    task.md            # what the agent sees
    environment/       # files the agent works with
    success_criteria.js # automated scoring
```

**Tiers**: `smoke` (fast, basic), `standard` (thorough), `full` (comprehensive).

## Writing Results to Knowledge Base

After running experiments, write findings:
- Results → `agents/shared/knowledge/experiments/EXP-XXX/results.md`
- Verified finding → `agents/shared/knowledge/entries/KE-XXX.md`
- Refuted hypothesis → update `agents/shared/knowledge/hypotheses/H-XXX.md`
