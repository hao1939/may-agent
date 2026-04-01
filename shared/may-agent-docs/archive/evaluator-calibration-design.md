# Evaluator Calibration System — Design

**Status**: Proposal
**Author**: hao + pi
**Date**: 2026-03-12

## Problem

The evaluator is the foundation of the improvement loop. Coach, Optimizer, and
Bob all act on evaluator scores. But nobody verifies whether those scores are
correct. 718 LLM-evaluated sessions exist with no ground truth. The system is
an open loop.

Current gaps:
- No human review of evaluator output
- Self-calibration only (evaluator re-reads own JSON, not fresh re-evaluation)
- No inter-rater reliability measurement
- Malformed JSONs (8 files with parse errors) go undetected
- Internal inconsistencies (verdict vs issues count) undetected
- 40% of sessions scored "needs_improvement" — is that right or is evaluator
  too harsh?

## Design: Three-Layer Calibration

### Layer 1: Human Spot-Check (ground truth)

The user periodically reviews evaluations against actual transcripts and records
agreement/disagreement. This is the only source of ground truth (P35).

**Format**: `agents/evaluator/workspace/human-reviews.jsonl`

```jsonl
{"sessionId":"s_1773099142776_46","agent":"may","evalVerdict":"acceptable","evalEfficiency":0.62,"evalQuality":0.58,"humanVerdict":"acceptable","humanNotes":"Scores about right. Constraint violation is real. Efficiency could be lower (0.5) given 6x repeated reads.","agree":true,"date":"2026-03-12"}
{"sessionId":"s_1773071717540_9","agent":"coder","evalVerdict":"acceptable","evalEfficiency":0.62,"evalQuality":0.86,"humanVerdict":"needs_improvement","humanNotes":"Quality too high. macOS sed on GNU is not just 'inefficiency' — it broke the edit. Should be 0.6 quality.","agree":false,"date":"2026-03-12"}
```

Fields:
- `sessionId`, `agent` — what was evaluated
- `evalVerdict`, `evalEfficiency`, `evalQuality` — evaluator's scores
- `humanVerdict` — human's verdict (same scale: good/acceptable/needs_improvement)
- `humanNotes` — what the human noticed
- `agree` — quick boolean: does the human agree with the verdict?
- `date` — when reviewed

**Who does this**: The user (hao), opportunistically. Even 2-3 reviews per week
give enough signal to detect systematic bias.

**Who consumes this**: Coach reads it to refine evaluation criteria. Optimizer
reads it to detect mechanical issues in transcript preparation.

### Layer 2: Consistency Checker (JS handler)

A deterministic JS handler that flags internally inconsistent evaluations.
No LLM needed — pure pattern matching.

**Checks**:
1. **Verdict-issues mismatch**: "good" verdict with 3+ issues, or
   "needs_improvement" with 0-1 minor issues.
2. **Score-verdict mismatch**: Efficiency ≥ 0.7 AND quality ≥ 0.7 but verdict
   is not "good" (or the reverse).
3. **Internal contradiction**: `overall.verdict` disagrees with agent-level
   verdict (already observed in calibration.md).
4. **Malformed JSON**: Files that fail to parse.
5. **Score extremes without evidence**: Efficiency or quality of 0.0 or 1.0
   with fewer than 2 issues cited.
6. **Duplicate evaluations**: Multiple eval files for same session content.

**Output**: Writes flagged evaluations to
`agents/evaluator/workspace/consistency-flags.jsonl`

```jsonl
{"sessionId":"s_xxx","flag":"verdict_issues_mismatch","detail":"verdict=good but 4 issues listed","date":"2026-03-12"}
```

**Trigger**: Runs as part of `evaluate-sessions` handler, after new evaluations
are written. Cheap — scans only new evaluations each cycle.

**Who consumes this**: Evaluator reads flags during heartbeat calibration check.
Coach uses it to identify criteria ambiguity. Optimizer uses it to fix
mechanical issues.

### Layer 3: Adversarial Re-evaluation (LLM calibration)

Periodically re-evaluate a completed session from scratch and compare scores.
This measures inter-rater reliability — can the evaluator agree with itself?

**How it works**:
1. Pick a session to re-evaluate. Selection strategy (in priority order):
   - Sessions flagged by Layer 2 (consistency issues)
   - Sessions where human disagreed (Layer 1)
   - Random borderline sessions (verdict = "acceptable", the fuzziest category)
   - Random sample from recent evaluations
2. Run `evaluateTask()` on the same parent session. The evaluator gets the
   same transcript, same failure chains, same prompt. Fresh session, no memory
   of the previous evaluation.
3. Compare original vs re-evaluation scores.
4. Write result to `agents/evaluator/workspace/re-evaluations.jsonl`

```jsonl
{"sessionId":"s_xxx","agent":"coder","originalVerdict":"acceptable","originalEfficiency":0.62,"originalQuality":0.86,"reEvalVerdict":"acceptable","reEvalEfficiency":0.55,"reEvalQuality":0.78,"verdictMatch":true,"efficiencyDelta":0.07,"qualityDelta":0.08,"date":"2026-03-12"}
```

**Key metrics**:
- `verdictMatch` — did the verdict agree? This is the most important signal.
  If verdicts disagree, the evaluation criteria are ambiguous for this case.
- `efficiencyDelta` / `qualityDelta` — how much did numeric scores drift?
  Small drift (±0.1) is normal. Large drift (±0.3) means the scoring is
  unreliable for this type of session.

**Frequency**: 1-2 re-evaluations per day. Not every session — just enough to
measure reliability. Each re-evaluation costs one evaluator session (~$0.05-0.15).

**Who consumes this**:
- **Coach**: Reads divergent cases to find criteria ambiguity. "The evaluator
  scored this 'good' once and 'needs_improvement' once — what's unclear in
  the rubric?" Coach then refines `criteria.md` or adds a LESSONS.md entry.
- **Optimizer**: Reads drift metrics to find mechanical issues. "Efficiency
  scores drift by 0.3 on sessions with long transcripts — is the transcript
  preparation losing information?" Optimizer fixes the JS pipeline.
- **Bob**: Reads systemic patterns. "Re-evaluations always disagree on
  researcher agents — are the researcher criteria too subjective?"

### Layer interaction

```
Layer 1 (Human)     → ground truth → feeds Layer 3 selection + Coach criteria work
Layer 2 (JS checks) → flags        → feeds Layer 3 selection + immediate alerting
Layer 3 (Re-eval)   → reliability  → feeds Coach (criteria) + Optimizer (pipeline)
                                     feeds back into Layer 2 (new consistency patterns)
```

All three layers write to `agents/evaluator/workspace/`. Coach and Optimizer
read from there during their heartbeats. The evaluator itself reads Layer 2
flags during its calibration periodic task.

## Implementation Plan

### Phase 1: Layer 2 — Consistency Checker (JS, no LLM cost)

Add consistency checking to `evaluate-sessions.ts` handler. After writing new
evaluations, scan them for internal inconsistencies. Write flags to
`consistency-flags.jsonl`. Update evaluator heartbeat to check flags during
calibration step.

**Files to change**:
- `agents/may/handlers/evaluate-sessions.ts` — add `checkConsistency()` after eval
- `agents/evaluator/workspace/consistency-flags.jsonl` — new output file
- `agents/evaluator/heartbeat.md` — add "check consistency flags" to calibration step

### Phase 2: Layer 1 — Human Spot-Check (format + docs)

Define the JSONL format. Create the file with 5-10 seed reviews (hao reviews
real evaluations). Update Coach and Evaluator heartbeats to reference it.

**Files to change**:
- `agents/evaluator/workspace/human-reviews.jsonl` — new file, seeded
- `agents/evaluator/DOMAIN.md` — document human-reviews.jsonl as key input
- `agents/coach/heartbeat.md` — add "check human-reviews for criteria gaps"

### Phase 3: Layer 3 — Adversarial Re-evaluation (LLM, cron job)

Add a new cron handler that picks a session, re-evaluates it, compares scores.
Selection weighted by Layer 1 disagreements and Layer 2 flags.

**Files to change**:
- `agents/may/handlers/re-evaluate.ts` — new handler
- `agents/may/cron.json` — new entry, daily or 2x/day
- `agents/evaluator/workspace/re-evaluations.jsonl` — new output file
- `agents/evaluator/DOMAIN.md` — document re-evaluation data
- `agents/coach/DOMAIN.md` — document as input for criteria refinement

## Cost Estimate

- Layer 1: Free (human time only)
- Layer 2: ~0ms extra per evaluation cycle (pure JS)
- Layer 3: $0.05-0.15 per re-evaluation × 1-2/day = ~$0.10-0.30/day

Total: negligible. The cost of bad evaluations (wrong coaching, wrong
optimization, wrong design decisions) is far higher.

## Success Criteria

After 2 weeks of operation:
- Layer 1: ≥20 human reviews recorded
- Layer 2: Consistency check catches 100% of malformed JSONs and verdict mismatches
- Layer 3: ≥20 re-evaluations recorded, with measurable verdict agreement rate

Target: ≥80% verdict agreement on re-evaluation (same transcript → same verdict
at least 80% of the time). If below that, the evaluation criteria need work.
