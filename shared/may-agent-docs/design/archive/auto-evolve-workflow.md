# Auto-Evolve Workflow — Proposal

**Status: DRAFT — try it, keep it if it works**

## The idea

Combine LLM creativity with mechanical execution. Coach generates variations, a script tests them all, coach analyzes results. No LLM tokens spent during the testing loop.

## The workflow

```
Step 1 (LLM — coach, 1 session):
  Read the agent's SOUL.md, gym failures, error patterns.
  Generate 10 SOUL.md variations. Each changes ONE thing:
    - Add a skill
    - Remove a rule
    - Rephrase a constraint
    - Add a methodology step
    - etc.
  Save each to workspace/variations/v01.md ... v10.md

Step 2 (mechanical — gym-baseline.sh, no LLM):
  For each variation:
    cp variation → agent SOUL.md
    Run: scripts/gym-baseline.sh --tier smoke --agent <name>
    Record: variation name, pass rate, delta vs baseline
    Restore original SOUL.md
  Output: results.md table

Step 3 (LLM — coach, 1 session):
  Read results.md. Which variations improved? Why?
  Combine the best ideas into one final SOUL.md.
  Or: "none improved, here's what I'd try next"

Step 4 (mechanical):
  If improved: apply final SOUL.md, commit, log
  If not: revert, log what was tried
```

## Why this is faster

Current growth cycle: ~10 LLM-heavy steps per experiment, 1-3 experiments/day.
Auto-evolve: 2 LLM sessions + N mechanical gym runs. 10 experiments in one cycle.

Cost: 2 LLM sessions (~$0.30) + 10 gym runs (~$1.50) = ~$1.80 for 10 experiments.
Current: 3 growth cycles × ~$0.50 each = $1.50 for 3 experiments.
Same cost, 3x more experiments.

## Who does what

**Coach**: Steps 1 and 3 (generate variations, analyze results). This is what coach is good at — understanding WHY an agent fails and WHAT might fix it.

**Tech-lead**: Build the step 2 script that loops through variations and runs gym. This is mechanical — no intelligence needed, just file copy + gym-baseline.sh + record results.

**Optimizer**: Define the metric. Currently gym pass rate (checks passed / total checks). Could add: token cost per session, total ops used. But start with pass rate — one number, like autoresearch's val_bpb.

## How to try it

1. **Coach**: Pick an agent with known failures (e.g., coder fails 3/13 smoke scenarios). Generate 5-10 SOUL.md variations targeting those failures. Save to `agents/coach/workspace/auto-evolve/variations/`.

2. **Tech-lead**: Write the loop script (or coach can use bash):
```bash
#!/bin/bash
AGENT=$1
BASELINE_SOUL="agents/$AGENT/SOUL.md"
cp "$BASELINE_SOUL" "$BASELINE_SOUL.baseline"

for v in agents/coach/workspace/auto-evolve/variations/*.md; do
  name=$(basename "$v" .md)
  cp "$v" "$BASELINE_SOUL"
  echo -n "$name: "
  scripts/gym-baseline.sh --tier smoke --agent "$AGENT" 2>&1 | tail -1
done

cp "$BASELINE_SOUL.baseline" "$BASELINE_SOUL"
```

3. **Coach**: Read the results, decide what to keep.

4. **If it works**: Formalize into a workflow (like skill-lifecycle.ts). If it doesn't work: we learned something, move on.

## Open questions

- How should coach generate variations? Random mutations? Targeted fixes based on failure analysis? Both?
- Should we test against smoke (13 scenarios, fast) or targeted scenarios (specific failures, more precise)?
- How many variations per cycle? 5? 10? 20?
- Should the variation generation itself be tested? (meta-meta question)

Don't overthink these. Try 5 variations on coder, see what happens. Iterate from there.
