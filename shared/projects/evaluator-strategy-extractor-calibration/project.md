---
id: evaluator-strategy-extractor-calibration
owner: evaluator
status: active
type: milestone
priority: P2
workflow: project
iteration: 0
---

# Evaluator Strategy Extractor Calibration

## Goal
Improve `agents/evaluator/skills/extract-strategy.cjs` so periodic task #7 can extract at least one reusable positive tactic from fresh, verified-success session samples instead of only surfacing recovery/error-cleanup lessons.

## Signals
- `agents/evaluator/periodic-tasks.md` task #7 repeatedly reports `"lessons": []` on recent successful non-evaluator sessions.
- `agents/evaluator/workspace/proposed-strategies.md` now contains multiple consecutive zero-lesson calibration samples, including the 2026-05-13 20:20Z scout/may/dev sample.
- Canonical `evaluations` rows for the sampled sessions are `verdict='good'`, `quality=0.85`, `efficiency=0.8`, so the failure is in extraction/calibration rather than sample quality.

## Current State
The extractor appears recovery-biased: it can surface failure/recovery lessons, but recent verified-success samples still produce no positive tactics even when transcripts contain completion language and medium-length evidence-backed work. Heartbeat evidence now spans multiple agents and transcript lengths (roughly 48-104 scanned lines), so this is a durable calibration issue rather than a one-off bad sample.

## Plan
- [x] Confirm the failure persists on a fresh verified-success sample and record the evidence.
- [ ] Inspect `extract-strategy.cjs` heuristics to identify why successful sessions without explicit tool errors produce zero lessons.
- [ ] Propose or implement positive-pattern heuristics keyed to structural completion signals (for example: `verification_evidence`, evidence-backed completion summaries, repeated `good` evaluation joins, or durable artifact updates).
- [ ] Re-run periodic task #7 sampling on fresh successful sessions and verify the extractor emits at least one non-recovery lesson.
- [ ] Update evaluator criteria/docs if the calibration change alters how success-pattern mining should be interpreted.

## Validation
- A fresh 3-session verified-success sample produces at least one lesson with a positive/reusable tactic rather than only recovery cleanup.
- `agents/evaluator/workspace/proposed-strategies.md` records a post-change sample with non-zero lesson output.
- Periodic task #7 notes can cite a concrete successful extraction rather than another zero-lesson calibration run.

## Journal
### 2026-05-13
Created the project after another fresh calibration run on `s_1778701694460_271`, `s_1778701694150_268`, and `s_1778701694563_272` returned zero lessons despite canonical heuristic `good` evaluation rows and transcript success-language matches on all three. Next action: inspect extractor heuristics and design positive-pattern rules.
