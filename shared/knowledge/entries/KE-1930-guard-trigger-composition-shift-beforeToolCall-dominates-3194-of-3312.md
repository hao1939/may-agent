<ai_context>
Guard triggers breached the 2500 threshold (3312/24h). KE-1867 attributed the prior near-breach to READ_DEDUP surges but the current composition is dominated by beforeToolCall (96.4%), which bundles 5+ distinct signal types under one guard name. The 1003 "Uncommitted files" warns are the largest single signal — triggered on every aks-explorer tool call when the worktree has dirty files (which it always does due to ambient project dirt). The threshold measures total guard.triggered events without decomposition, so a structural dirty-worktree condition generates ~1000 warns/day that are never actionable.
Triggers: guard.triggered-count-24h, guard.warned-count-24h, threshold, beforeToolCall, composition, uncommitted-files, aks-explorer
</ai_context>

# KE-1930: Guard Trigger Composition Shift — `beforeToolCall` Dominates (3194 of 3312)

**Status**: active
**Discovered**: 2026-06-14
**Agent**: arc (heartbeat coherence audit)
**Scope**: guard metrics, threshold calibration
**Related**: KE-1867 (READ_DEDUP surge), KE-1842 (threshold ratchet), KE-1564 (composition shift)

## Observation

`guard.triggered-count-24h` = 3295, threshold = 2500. Metric is above threshold.
`guard.warned-count-24h` = 3287, threshold = 2500. Also above threshold.

Both metrics breached as predicted in KE-1867. However, the **composition has shifted** since KE-1867's analysis.

## Current Composition (24h)

| Guard | Count | % of Total | Action |
|-------|-------|------------|--------|
| beforeToolCall | 3194 | 96.4% | warn |
| read-before-edit | 100 | 3.0% | warn |
| hallucinated-path | 10 | 0.3% | warn |
| finish-guard | 8 | 0.2% | block |
| **Total** | **3312** | 100% | |

## beforeToolCall Signal Decomposition

The `beforeToolCall` guard name is an umbrella — it bundles multiple distinct signal types:

| Signal Type | Count | Description |
|-------------|-------|-------------|
| Uncommitted files (ambient) | 1003 | Warns on dirty worktree even when no files match session deliverables |
| finish() uncommitted (targeted) | 892 | Warns on actual uncommitted deliverables at finish-time |
| SESSION_BASH_CAT | 385 | Agent catting large session.jsonl files |
| SESSION_READ | 290 | Agent read()ing session.jsonl files |
| READ_DEDUP (replay files) | 278 | aks-explorer re-reading same replay files |
| READ_DEDUP (model/design) | 212 | Re-reading model.json, design docs |
| PATH_HALLUCINATION | 43 | /home/ paths in bash commands |
| SESSION_BASH_GREP | 43 | Unbounded grep of session.jsonl |

## Key Finding

The 1003 "ambient uncommitted" warns are structurally unavoidable: the `/app` worktree
has ~40+ dirty files from concurrent agent activity (aks-rp-e2e project files, evaluator
project files, design doc updates, etc.). Every aks-explorer tool call triggers this
check, and the dirty state persists because no single agent owns all the dirty paths.

This means ~1000/day of the guard triggers are noise — they warn about a condition
that is permanently true and never actionable (the agent correctly ignores unrelated
dirty files per KE-912 guidance).

## Threshold Assessment

The 2500 threshold was set when guard composition was different (READ_DEDUP was the
primary driver per KE-1867). With beforeToolCall's ambient component now at ~1000/day,
the effective threshold for detecting new guard quality issues is:

- Available budget: 2500 - 1000 (ambient) = ~1500 for real signals
- Current real signals: ~2312
- Real signal headroom: -812 (already exceeded)

The threshold is no longer meaningful — it was breached structurally, not due to
quality degradation.

## Options

1. **Raise threshold to ~4000** — accommodates ambient noise + current real signals
   with ~20% headroom. Risk: masks genuine deterioration in future.
2. **Exclude ambient uncommitted from the count** — filter at the metric computation
   level. More surgical but requires src/ change (ORDER-010 applies).
3. **Accept breach as structural** — document that the metric is informational, not
   alertable, until the ambient worktree dirt resolves.

## Recommendation

Option 3 for now. The breach is structural noise, not a quality signal. The individual
signal types within beforeToolCall (SESSION_BASH_CAT, READ_DEDUP, PATH_HALLUCINATION)
are still useful behavioral signals — they should be tracked individually rather than
aggregated into one threshold. Filing this as documentation; no threshold change needed
until the ambient worktree condition changes.

## Falsifiers

1. If ambient worktree dirt is cleaned (e.g., project files committed), the 1003
   ambient warns disappear and the metric drops below threshold naturally.
2. If a new guard pathology emerges, it would need to add >~500 triggers/day to be
   visible above the current noise floor. That's a detection gap.
