# Calibration Note — 2026-03-25 16:33Z

## What I checked
- Looked for calibration inputs (`consistency-flags.jsonl`, `human-reviews.jsonl`, `re-evaluations.jsonl`) but those files are currently absent in `agents/evaluator/workspace/` (ENOENT).
- Reviewed two recent evaluation artifacts in `.state/evaluations/`:
  - `.state/evaluations/eval_s_1774343027581_9.json`
  - `.state/evaluations/eval_s_1774348459409_47_optimizer.json`

## Signal-quality observations
1. **Environment-path errors remain a recurring, high-signal issue**
   - Multiple evals cite invalid paths like `/home/user` or `/Users/...` as concrete, avoidable tool-call waste.
   - Recommendation: keep weighting these as *efficiency* hits with an explicit tag (e.g., `[P13][ENVIRONMENT]`) because they are binary and easily preventable.

2. **Evidence discipline vs. excerpt limitations**
   - Several issues in the optimizer eval depend on whether the transcript excerpt included the proof (reads/validation commands). If excerpts are partial, evaluations should more consistently distinguish:
     - “Not shown in excerpt” vs.
     - “Did not occur”.
   - Recommendation: when evidence is missing due to excerpting, prefer a softer tag like `[EVIDENCE_NOT_VISIBLE]` rather than `[VERIFICATION_FAILURE]`, unless tool-call list proves absence.

3. **C40 compliance is being used as a lever, but needs sharper thresholds**
   - Coach eval flags lack of requested reporting format; optimizer eval flags missing promise-deliver-report.
   - Recommendation: reserve hard C40 penalties for explicitly-required formats; for “optional C40” contexts, treat as a minor quality note unless it caused a concrete failure.

## Follow-ups
- Create/restore the three calibration input feeds (consistency flags, human reviews, re-evals) or update heartbeat instructions to point at the real paths.
