# Rubric Patches — Evaluator Score Batch 1

Based on patterns observed in the first 50-session score batch, the following
calibration changes are supported by evidence.

## Patch 1: Decompress the "good" band

**Problem**: 90% of sessions land at quality=0.85 with no differentiation.

**Proposed change**: Split the `good` verdict into `good` (0.80–0.89) and
`excellent` (0.90–1.00) based on:
- Sessions with material output (file write/edit + verification) → eligible for excellent
- Sessions with recovery from errors that still succeed → eligible for excellent
- Sessions that are pure routing/coordination with <5 ops → cap at good

**Evidence**: Deep-eval session `s_1779352614089_86` (quality=0.89) received a
higher score than heuristic sessions despite having 8 wasted calls, because it
demonstrated recovery and delivered complex output. The current rubric cannot
express this distinction for heuristic-evaluated sessions.

## Patch 2: Graduate the shallow-session threshold

**Problem**: The binary `opCount <= 2 → needs_improvement` rule is the only
downgrade path. Sessions with 3 ops that do nothing meaningful still get `good`.

**Proposed change**: Introduce a "thin session" signal for sessions with 3–4 ops
that contain only reads and a finish with no writes, edits, or meaningful bash.
These should score `acceptable` (0.65) rather than `good` (0.85).

**Evidence**: Sessions like `s_1779359556984_135` (3 ops) receive the same
quality=0.85 as sessions with 26 productive ops. The heuristic S1 signal
("finish success but no observable output") exists in the v1 spec at 0.5 but
the canonical evaluator does not implement this gradation.

## Patch 3: Let efficiency influence verdict for long sessions

**Problem**: aks-explorer sessions with 30–70 ops get efficiency=0.55 but
verdict=good. Efficiency is purely decorative.

**Proposed change**: For sessions with opCount > 20, if efficiency < 0.60,
cap verdict at `acceptable` unless deep-eval overrides. This incentivizes
tighter tool usage in long-running sessions.

**Evidence**: `s_1779353419873_88` (57 ops, efficiency=0.55) and
`s_1779360481581_138` (34 ops, efficiency=0.55) both receive `good` despite
the evaluator itself flagging low efficiency.

## Patch 4: Add "confirmation depth" signal to v1 heuristics

**Problem**: v1 heuristic S5 ("Clean Finish") cannot be scored from metadata
alone — it requires transcript inspection.

**Proposed change**: Replace S5 weight with a "confirmation depth" proxy:
- Session calls `read()` on a file it just wrote/edited → +1
- Session runs a verification bash command (test, build, check) → +1
- Score S5 = min(confirmations, 2) / 2

This is computable from the `outputSignals` field already present in the
evaluator's `overall` JSON (e.g., "verification command" signal).

**Evidence**: The canonical evaluator already detects "verification command" as
an output signal but does not use it to modulate the quality score.

## Priority

1. **Patch 2** (thin-session threshold) — lowest effort, highest immediate value
2. **Patch 4** (confirmation depth) — already has data source, improves v1 heuristic
3. **Patch 1** (decompress good band) — requires rubric redesign
4. **Patch 3** (efficiency influence) — may need per-agent calibration

## Implementation Path

These patches should be validated by re-scoring this same 50-session batch with
the proposed rules and checking whether the new distribution better separates
sessions that received deep-eval praise from those that were merely "routine_ok".
