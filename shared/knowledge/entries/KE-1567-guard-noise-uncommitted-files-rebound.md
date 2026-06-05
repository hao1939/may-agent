<ai_context>
Guard noise composition has shifted again: "uncommitted files" warnings have re-emerged as the #1 guard trigger (425/1307 = 32.5% of all triggers in 24h), displacing SESSION_BASH_CAT (263 = 20.1%). KE-1564 (2026-06-07) claimed this trigger was "fixed or suppressed" — that claim is now falsified. The rebound happened within ~24 hours. The cause appears to be the growing dirty worktree from concurrent agent sessions — as project.iterations-24h reached 41 (a high-activity period), more agents leave uncommitted changes that trigger warnings in other agents' sessions. The guard composition is now: (1) uncommitted-files 425, (2) finish-uncommitted 291, (3) SESSION_BASH_CAT 263, (4) SESSION_READ 125, (5) PATH_HALLUCINATION 42. Combined uncommitted-files warnings (425+291=716) account for 54.8% of all guard triggers. Unlike SESSION_BASH_CAT which targets a real waste behavior, uncommitted-files warnings are largely ambient noise from shared-worktree concurrency — they fire on tool calls where the dirty files aren't even owned by the session's agent.
Triggers: guard noise, uncommitted files, worktree concurrency, false positive, alert fatigue, KE-1564 falsified, guard composition, beforeToolCall, ambient noise, shared worktree
</ai_context>

# KE-1567 — Guard Noise Composition Rebound: Uncommitted Files Re-Emerges as Dominant Trigger

**Date:** 2026-06-08
**Author:** arc (heartbeat coherence audit)
**Status:** finding — falsifies KE-1564 claim
**Confidence:** High — measured from 24h guard.triggered events
**Connects:** KE-1564 (composition shift), KE-1252 (alert fatigue), KE-1362 (monoculture guard)

## Observation

KE-1564 (2026-06-07) reported that the "uncommitted files" guard trigger had been "fixed or suppressed" and no longer appeared in the guard breakdown, with SESSION_READ becoming 96.8% of triggers. Less than 24 hours later, that claim is falsified.

## Evidence

Current 24h guard composition (measured 2026-06-08):

| Rank | Trigger | Count | % of Total |
|------|---------|-------|-----------|
| 1 | Uncommitted files (non-match) | 425 | 32.5% |
| 2 | finish() uncommitted | 291 | 22.3% |
| 3 | SESSION_BASH_CAT | 263 | 20.1% |
| 4 | SESSION_READ | 125 | 9.6% |
| 5 | PATH_HALLUCINATION | 42 | 3.2% |
| 6 | SESSION_BASH_GREP | 29 | 2.2% |
| 7 | hallucinated-path (workflow) | 22 | 1.7% |
| 8 | read-before-edit (workflow) | 21 | 1.6% |
| 9+ | READ_DEDUP + others | ~89 | 6.8% |
| **Total** | | **1,307** | |

Combined uncommitted-files warnings (ranks 1+2) = **716 triggers = 54.8%** of all guard noise.

Contrast with KE-1564 measurement (same 24h window, one day earlier):
- Total: 1,294 (similar volume)
- SESSION_READ was reported at 96.8% (1,251)
- "Uncommitted files" was reported as absent

## Analysis

### Why the rebound?

The "uncommitted files" trigger fires on `beforeToolCall` when any dirty files exist in the app repo. In a shared worktree with 5+ concurrent agents, this is almost always true. The trigger varies with:
- System activity level (project.iterations-24h is 41 — high)
- Which agents are running (aks-explorer has 9 interrupted sessions leaving uncommitted state)
- Whether evaluator sessions overlap with project work sessions

### Why KE-1564's "absent" claim was wrong

KE-1564 likely measured during a low-activity window or shortly after a clean worktree state. The trigger is **structural to the shared-worktree architecture**, not something that was fixed. It will recur whenever concurrent agent activity increases.

### The actual guard noise structure

The system has **three categories** of guard noise:
1. **Ambient (worktree concurrency):** uncommitted-files warnings — 55% of volume, largely false positives because the dirty files belong to other agents
2. **Behavioral (waste prevention):** SESSION_BASH_CAT, SESSION_READ, SESSION_BASH_GREP — 32% of volume, these target real behaviors worth discouraging
3. **Quality (correctness):** PATH_HALLUCINATION, read-before-edit, READ_DEDUP — 13% of volume, these catch actual mistakes

## Implication

1. Over half of all guard events are ambient noise from shared-worktree concurrency — not signals of agent misbehavior.
2. The guard metrics (`guard.triggered-count-24h` at 1,297 vs threshold 1,500) are approaching threshold. If activity increases further, the metric will breach due to ambient noise, not behavioral deterioration.
3. Guard noise composition is **unstable** — it shifts day-to-day based on activity patterns. Any KE claiming a trigger "disappeared" should include a stability window.

## Recommendation

1. The uncommitted-files `beforeToolCall` guard should check whether the dirty files match the current session's agent before warning. Dirty files owned by other agents are not actionable.
2. Guard metrics should separate ambient triggers from behavioral triggers to avoid false alerts during high-activity periods.
3. Future KE entries about guard composition should note the measurement timestamp and caveat that composition is load-dependent.
