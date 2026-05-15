# EXP-NNN: <short title> (single-scenario A/B)

**Type:** (a) single-scenario A/B
**Created:** YYYY-MM-DD
**Hypothesis:** <one sentence — what change, what effect expected>
**Reference:** EXP-143 (similar shape)

## Phase 1 — Design

- **Scenario:** `agents/gym/scenarios/<scenario-id>/`
- **Agent under test:** `<agent-name>` (e.g. coder, bob)
- **Arm A (control):** baseline agent, no modification
- **Arm B (treatment):** <describe single change — one file, one rule, one prompt>
- **Primary metric:** pass rate across N trials
- **Secondary metrics:** avg ops, failure-mode distribution (FM-x.y counts)
- **N trials per arm:** <10 typical; 5 min for cheap, 20 for noisy>
- **Decision rule:** promote B if `passB - passA >= 0.15` AND no new failure mode introduced

## Phase 2 — Setup

```bash
# Fork agent
cp -r agents/<agent>/ agents/.lab/<agent>-<exp-id>/
# Apply SINGLE change to fork (edit one file)
$EDITOR agents/.lab/<agent>-<exp-id>/<file>
```

- Confirm fork differs from baseline: `diff -r agents/<agent>/ agents/.lab/<agent>-<exp-id>/ | head`

## Phase 3 — Run

```bash
# Arm A
scripts/gym-batch.sh --scenarios <scenario-id> --agent <agent> --trials 10 \
  --out agents/coach/workspace/EXP-NNN/armA.jsonl
# Arm B
scripts/gym-batch.sh --scenarios <scenario-id> --agent .lab/<agent>-<exp-id> --trials 10 \
  --out agents/coach/workspace/EXP-NNN/armB.jsonl
```

## Phase 4 — Analyze

- Pass rates: `jq -s 'map(select(.pass)) | length' armA.jsonl` vs armB
- Failure modes: `jq -r '.failure_mode' armA.jsonl | sort | uniq -c`
- Check for confounds: op count, wall time, any new error classes
- Write 1-paragraph result into this file below

### Results
- Arm A: __/__ pass (__%)
- Arm B: __/__ pass (__%)
- Delta: ____pp
- New failure modes introduced by B: <list or "none">

## Phase 5 — Graduate

- [ ] Delta meets decision rule → promote fork to agents/<agent>/
- [ ] Record KE in `agents/shared/knowledge/entries/KE-NNN-<slug>.md` if delta ≥ 0.20
- [ ] Log one-line summary in `agents/coach/workspace/experiments.jsonl`
- [ ] Delete fork if not promoted: `rm -rf agents/.lab/<agent>-<exp-id>/`

## Constraints
- ONE change only (KE-123: stacking interventions degrades by 12-15pp).
- If scenario pass rate is already >=90% baseline, pick a harder scenario (ceiling effect).
