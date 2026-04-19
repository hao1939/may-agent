# Evaluator calibration note — 2026-03-16 18:48Z

## Signals triage delta
- `agents/shared/SIGNALS.md` top block still shows **2 evaluator→tech-lead monitor-session handoffs** pending ACK (18:29 and 18:46), plus several bob/scout items pending for may/tech-lead.

## Calibration action
- Attempted periodic drift audit: `node agents/evaluator/skills/detect-p53-drift.cjs` **fails** with `MODULE_NOT_FOUND`.
- `agents/evaluator/skills/detect-p53-drift/` exists but contains only `SKILL.md` (no runnable `.cjs`). Heartbeat/skill docs still reference a `.cjs` entrypoint.
- Ran `node agents/evaluator/skills/detect-drift.cjs .state/ops-receipts.jsonl` successfully; it reports drift for `test-agent-drift:test` (recent=0 vs baseline=0.71 over 9 calls).

## Implication
- Periodic-task item "Detect Statistical Drift (P53 defense)" is currently not executable from evaluator toolchain as documented; needs repair or doc correction.
