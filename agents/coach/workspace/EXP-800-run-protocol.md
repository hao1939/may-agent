# EXP-800 Run Protocol — Threshold Rescue for VAE (UPDATED)

**Status**: UNBLOCKED — ready to run
**Updated**: 2029-07-16
**Design**: `agents/shared/knowledge/experiments/EXP-800/design.md`

## Gym Blocker: RESOLVED
- `GYM_AGENT_BIN=/usr/local/bin/may-agent` exists (106MB binary)
- Runner saves transcripts to `_transcript.txt` in work dir
- Session JSONL found in `.state/sessions/`
- `GYM_EXTRA_INSTRUCTIONS` NOT supported — using `injected_context` in scenario variants instead

## Scenarios & Arms

| Arm | Scenario | Instruction | Purpose |
|-----|----------|-------------|---------|
| A (baseline) | `multi-file-refactor` | None | Baseline VAE rate |
| B (vague nudge) | `multi-file-refactor-exp800-arm-b` | "Always verify your edits by reading the file after writing" | Vague text nudge |
| C (concrete threshold) | `multi-file-refactor-exp800-arm-c` | P0 concrete VAE gate (≥80%, REJECTED) | Tests KE-715 |
| D (concrete + distractor) | `multi-file-refactor-exp800-arm-d` | Same P0 gate + changelog distractor | Tests KE-655 vs KE-715 |

## Run Commands

```bash
export GYM_AGENT_BIN=/usr/local/bin/may-agent

# Arm A — Baseline (5 trials)
for i in 1 2 3 4 5; do
  bash agents/test/gym/run-gym.sh multi-file-refactor --agent coder 2>&1 | tee agents/coach/workspace/EXP-800-arm-a-trial-$i.log
done

# Arm B — Vague nudge (5 trials)
for i in 1 2 3 4 5; do
  bash agents/test/gym/run-gym.sh multi-file-refactor-exp800-arm-b --agent coder 2>&1 | tee agents/coach/workspace/EXP-800-arm-b-trial-$i.log
done

# Arm C — Concrete threshold (5 trials)
for i in 1 2 3 4 5; do
  bash agents/test/gym/run-gym.sh multi-file-refactor-exp800-arm-c --agent coder 2>&1 | tee agents/coach/workspace/EXP-800-arm-c-trial-$i.log
done

# Arm D — Concrete + distractor (5 trials)
for i in 1 2 3 4 5; do
  bash agents/test/gym/run-gym.sh multi-file-refactor-exp800-arm-d --agent coder 2>&1 | tee agents/coach/workspace/EXP-800-arm-d-trial-$i.log
done
```

## VAE Measurement

After each trial, measure VAE rate from session transcript:
```bash
node agents/coach/workspace/exp800-vae-measure.cjs <session.jsonl>
```

Or manually from `_transcript.txt`:
1. Count edit()/write() calls
2. For each, check if read() on same file appears within next 2 tool blocks
3. VAE rate = verified / total × 100

## Decision Criteria

| Arm C | Arm D | Conclusion |
|:---:|:---:|:---|
| ≥60% | ≥60% | KE-715 dominates → Deploy concrete-threshold VAE |
| ≥60% | ≤25% | KE-655 dominates → Threshold is gym-only |
| ≤25% | ≤25% | VAE untrainable via text → Structural gate only |

## Execution Order

1. Run 1 trial of Arm A to verify scenario works and transcripts are captured
2. Check transcript for VAE measurability
3. If measurable → run remaining trials across all arms
4. Compile results → `agents/coach/workspace/EXP-800-results.md`
