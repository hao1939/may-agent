# M3 Results — Gym A/B Comparison

**Date:** 2026-06-20
**Runner:** `agents/test/gym/run-gym.sh` via `may-agent --oneshot --agent coach`
**Runs per scenario:** 5

## Raw Results

### Scenario A: `breadcrumb-reaction` (breadcrumb-only, no question-framing)

| Run | reacted-to-stuck-requests | followed-breadcrumb | Overall |
|-----|--------------------------|--------------------:|---------|
| 1   | ❌ FAIL                   | ❌ FAIL              | FAIL    |
| 2   | ❌ FAIL                   | ❌ FAIL              | FAIL    |
| 3   | ❌ FAIL                   | ❌ FAIL              | FAIL    |
| 4   | ❌ FAIL                   | ❌ FAIL              | FAIL    |
| 5   | ❌ FAIL                   | ❌ FAIL              | FAIL    |

**Pass rate:** reacted: 0/5 (0%) · followed-breadcrumb: 0/5 (0%)

### Scenario B: `metric-reaction-G-breadcrumb` (question-framing + breadcrumbs)

| Run | reacted-to-stuck-requests | Overall |
|-----|--------------------------|---------|
| 1   | ❌ FAIL                   | FAIL    |
| 2   | ❌ FAIL                   | FAIL    |
| 3   | ❌ FAIL                   | FAIL    |
| 4   | ❌ FAIL                   | FAIL    |
| 5   | ❌ FAIL                   | FAIL    |

**Pass rate:** reacted: 0/5 (0%)

## Summary Comparison

| Check                     | breadcrumb-only | question-framing + breadcrumb | Δ      |
|--------------------------|:--------------:|:----------------------------:|:------:|
| reacted-to-stuck-requests | 0% (0/5)       | 0% (0/5)                     | +0pp   |
| followed-breadcrumb       | 0% (0/5)       | n/a (not checked)            | —      |

## ⚠️ CRITICAL: Results Are Invalid — Infrastructure Bug

**All 10 runs failed due to a transcript-capture bug, NOT agent behavior.**

### Root cause

The gym scorer (`gym-score-utils.cjs`) reads `_gym_transcript.jsonl` for behavioral checks. The gym runner (`runner.ts`) writes `transcript.jsonl` (no `_gym_` prefix). **File naming mismatch** → `hasTranscript()` always returns `false` → all behavioral checks automatically fail.

Additionally, when running inside a parent agent session, the runner captures the **parent session's** transcript from `.state/sessions/` rather than the child agent's transcript. The `transcript.jsonl` in the work dir contained my (parent) tool calls, not the child agent's.

### Evidence the agent DID react

Manual inspection of the work directory (`/tmp/gym-breadcrumb-reaction-8b6eb6f6/`) shows:
- `triage-note.md` was written by the child agent
- Content: *"Top priority: 76 stuck requests (target: 0). Attempted to read environment/stuck-requests.json for breakdown..."*
- The agent clearly identified stuck-requests as the priority and attempted to investigate

### What needs to happen

1. **Fix file naming**: Runner should write `_gym_transcript.jsonl` (or scorer should read `transcript.jsonl`)
2. **Fix nested-session transcript capture**: When the runner itself runs inside an agent session, it picks up the outer session's JSONL from `.state/sessions/` instead of the inner agent's
3. **Re-run M3** after fixing the infrastructure

## Statistical Interpretation

**Cannot draw conclusions.** The 0% vs 0% result reflects infrastructure failure, not agent behavior. The KE-215 observation (question-framing → 100% reaction vs breadcrumbs → 10%) remains the best available evidence.

### Recommendation

Fix the two gym-runner bugs listed above, then re-run this experiment as M3b. Until then, proceed with M4 (implement question-framing) based on the KE-215 evidence — the gym validation is blocked but the signal is strong enough to act on.
