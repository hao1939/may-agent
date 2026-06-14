<ai_context>
Guard triggers at 3441/3500 threshold (98.3%). Will breach within hours at current rate. Composition shifted since KE-1930: "uncommitted files" warns now 60.7% of all triggers (2092/3443), up from ~30% in KE-1930. This is structural noise from aks-rp-e2e's permanently dirty worktree — every aks-explorer session finish triggers warn on 30+ unrelated dirty files. SESSION_BASH_GREP dropped to ~1%. The threshold was raised from 2500→3500 to absorb this, but the structural floor is ~2100/day from uncommitted-files alone.
Separately, resume_failed grew to 687/24h (up from 599 in KE-1932, 14.7% in 1 day). KE-1932 F2 falsified — not a burst, structural. Planner sessions now 64% of resume failures (up from 47.6%).
Triggers: guard.triggered-count-24h, guard.warned-count-24h, uncommitted-files, threshold, beforeToolCall, resume_failed, KE-1930, KE-1932
</ai_context>

# KE-1980: Guard Threshold Breach Imminent — Uncommitted-Files Now Dominant Noise Source

**Status**: active
**Discovered**: 2026-06-14
**Agent**: arc (heartbeat)
**Scope**: guard metrics, session lifecycle
**Related**: KE-1930 (guard composition shift), KE-1932 (resume_failed escalation), KE-1867 (READ_DEDUP surge)

## Observation

`guard.triggered-count-24h` = 3441, threshold = 3500. At current rate, breach within hours.

### Composition Shift Since KE-1930

KE-1930 (also Jun 14, earlier) analyzed guard composition when total was 3312 and attributed dominance to SESSION_BASH_GREP. The composition has shifted:

| Signal Type | Count (24h) | % | Trend vs KE-1930 |
|------------|------------|---|-------------------|
| Uncommitted files (finish guard) | 2092 | 60.7% | ↑ dominant |
| READ_DEDUP | 343 | 10.0% | ↓ |
| SESSION_BASH_GREP | ~40 | 1.2% | ↓↓ sharply |
| Other beforeToolCall | ~440 | 12.8% | — |
| read-before-edit | ~8 | 0.2% | — |
| hallucinated-path | ~2 | 0.1% | — |
| finish-guard (block) | ~3 | 0.1% | — |

**The structural floor is ~2100/day from uncommitted-files alone.** Every aks-explorer session that calls finish() triggers a warn listing 30+ dirty files in the shared worktree. This is not actionable — the dirty files are from other agents' concurrent work and the aks-rp-e2e project's accumulated uncommitted changes.

### Why the Threshold Will Keep Ratcheting

1. Threshold was 2500 → raised to 3500 after KE-1930
2. The structural floor (uncommitted-files) is ~2100/day and growing with aks-explorer session count
3. Any spike in READ_DEDUP or SESSION_BASH_GREP on top of this floor hits 3500
4. Pattern: KE-1842 predicted this — thresholds always loosen, never tighten

### resume_failed Update (KE-1932 F2 Falsified)

| Day | Resume Fails | Source |
|-----|-------------|--------|
| Jun 9 | 104 | KE-1785 |
| Jun 13 | 599 | KE-1932 |
| Jun 14 | 687 | this entry |

Growth: +14.7% in 1 day. Planner sessions now 64% of failures (441/687), up from 47.6% in KE-1932.

KE-1932's F2 ("if growth is a burst, rate should stabilize within 48h") is **falsified** — this is structural, not transient. The design-implementation gap (dedup_key spec exists in doc but no code) remains the root cause.

## Structural Assessment

Two distinct structural noise sources are consuming guard budget:
1. **Uncommitted-files warns**: Worktree dirt from concurrent agents triggers on every aks-explorer finish(). Fix: either suppress finish-guard when all dirty files are unrelated, or commit/stash the aks-rp-e2e accumulated changes.
2. **resume_failed handler cycles**: Each of the 687 failed resumes triggers a handler.started → handler.completed cycle that counts as a handler completion but produces zero value. Fix: implement dedup_key per KE-1837 spec.

Neither is dangerous, but both inflate metrics and erode signal-to-noise ratio.

## Falsifiers

1. **F1**: If aks-rp-e2e accumulated dirty files are committed or stashed, uncommitted-files warns should drop >80% and guard triggers should fall to ~1300/day.
2. **F2**: If the finish-guard is updated to suppress warnings when ALL dirty files are classified as unrelated, uncommitted-files warns drop to near zero.
3. **F3**: If guard threshold is raised to 4000 without fixing the structural sources, it will breach again within 2-3 days (KE-1842 ratchet pattern).
