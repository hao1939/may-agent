# Ops Monitoring — monitor-session.cjs

## What it is
`node agents/evaluator/skills/monitor-session.cjs --running` is a runtime watchdog that classifies active sessions as healthy/unhealthy.

## Known signals (as observed)
- Can report **STALL** sessions.
- Can report **PROTOCOL_VIOLATION** with evidence like: “P114 Violation: Complex task attempted without Experience Replay (grep ERROR_LOG)”.

## Interpretation caution
Treat these as **heuristics**, not ground truth. If the detector flags many sessions (e.g., multiple **coach** growth-trigger sessions) as P114 violations, it may indicate either:
- real behavior drift (skipping expected replay/verification), **or**
- false positives (misclassifying certain work, e.g., lab-file edits).

## Actionable follow-up
When these flags appear repeatedly:
1. Cross-check by reading the relevant session JSONL (look for actual replay/grep actions vs. none).
2. If false positives dominate, adjust the detector criteria; if true positives dominate, escalate to Coach/Optimizer.

## Environment drift notes
- `.state/evaluations/` may be absent in some environments. When missing, evaluators cannot perform direct spot-checks of evaluation artifacts; rely on session transcript evidence instead.
- `detect-p53-drift.cjs` is referenced in some docs, but may not exist as a runnable script (only a skill doc at `agents/evaluator/skills/detect-p53-drift/SKILL.md`). Treat as documentation drift unless/until the script exists.
