# Agent Evolution Process

## Overview

A repeatable process for evolving an agent's prompt. Measure → change → measure → compare.

## Steps

### 1. Baseline

Run the gym benchmark for the agent and record results.

```bash
# Smoke tier (fast, ~15min, ~$1.50)
scripts/gym-baseline.sh --tier smoke --agent <name>

# Standard tier (thorough, ~60min, ~$7)
scripts/gym-baseline.sh --tier standard --agent <name>
```

Results are saved to `test/gym/stats.db`. View at `http://localhost:8080` → Benchmarks tab.

### 2. Measure current prompt

```bash
# Check total system prompt size
for f in agents/<name>/SOUL.md agents/<name>/DOMAIN.md agents/<name>/TOOLS.md \
         agents/shared/LESSONS.md agents/<name>/LESSONS.md \
         agents/<name>/knowledge/INDEX.md agents/shared/INDEX.md \
         agents/shared/common-sense.md; do
  [ -f "$f" ] && echo "  $(wc -c < "$f")B  $f"
done
```

Note the total KB — this is the "before" size.

### 3. Slim SOUL.md

Create a new SOUL.md that contains ONLY:
- **Identity**: Who you are, your mission (2-3 sentences)
- **Role boundaries**: What you do vs what others do
- **Methodology**: Your critical workflows, condensed
- **Curated skills**: Specific skills with trigger conditions
- **Agent-specific constraints**: Things only you need

Remove everything that's already in common-sense.md. Remove generic rules.
Target: 2-4KB (down from 7-15KB).

### 4. Update resolveSystemPrompt()

Change the prompt loader to only load:
1. SOUL.md (slimmed)
2. common-sense.md (shared)
3. Generated sections (tools, runtime env)

Skip: DOMAIN.md, TOOLS.md, LESSONS.md, INDEX.md files.

### 5. Re-run benchmark

```bash
scripts/gym-baseline.sh --tier smoke --agent <name>
```

### 6. Compare

```bash
bun scripts/gym-stats.ts --agent <name> --regressions
```

Or check the Benchmarks tab in the web UI — compare pass rates before/after.

### 7. Decide

- **Pass rates same or better** → Keep the change. Commit.
- **Pass rates dropped** → Investigate which scenarios regressed. Was a critical rule lost? Add it back to SOUL.md (not the generic version — the agent-specific version). Re-run.
- **Mixed results** → Some improved, some regressed. Iterate on SOUL.md content.

### 8. Repeat for next agent

Follow the migration order: coder → qa → scout → evaluator → optimizer → tech-lead → coach → bob → may.

## Tracking

Each migration is tracked in the daily digest:
- Prompt size before/after
- Gym pass rates before/after
- Which rules were removed vs kept

The Benchmarks tab shows the cumulative history — you can see how each agent's scores change over time as more runs accumulate.
