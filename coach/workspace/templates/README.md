# Coach Experiment Templates

Templates for coach experiment write-ups. Use these instead of hand-rolling frontmatter every time.

## Files

- `experiment-design.md` — pre-execution template. Copy to `workspace/experiments/EXP-<ID>/design.md`, fill in, then run trials.
- `experiment-results.md` — post-execution template. Copy to `workspace/experiments/EXP-<ID>/results.md` after trials complete.

## Usage

```bash
# New experiment
ID=154
mkdir -p agents/coach/workspace/experiments/EXP-$ID
cp agents/coach/workspace/templates/experiment-design.md \
   agents/coach/workspace/experiments/EXP-$ID/design.md
$EDITOR agents/coach/workspace/experiments/EXP-$ID/design.md

# After running trials
cp agents/coach/workspace/templates/experiment-results.md \
   agents/coach/workspace/experiments/EXP-$ID/results.md
```

## Why these templates

Pattern derived from strong prior designs (EXP-084, EXP-088, EXP-153). Key structural elements every experiment should have:

1. **Pre-registered decision rules** — decide deploy/reject thresholds *before* seeing data (prevents post-hoc rationalization).
2. **Power analysis** — state what effect size your N can detect. N=12/arm ≈ detects 42pp diff at p<0.05.
3. **Per-criterion breakdown** — aggregate pass/fail hides which specific check improved. Always report per-criterion.
4. **Threats to validity** — ceiling effects, scenario-specificity, underpowering.
5. **Follow-ups** — concrete next steps (KE write-up, harness ship, next EXP).

## ID allocation

Before picking an ID, check the max used:

```bash
ls agents/coach/workspace/experiments/ | grep -oP 'EXP-\K\d+' | sort -n | tail -1
```

Then use max+1. (Future: add a `new-experiment.sh` script to automate.)
