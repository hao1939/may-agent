# Heartbeat note — 2026-05-04 — Evaluation coverage diagnosis

## Snapshot (DB)
- Sessions in last 24h: **1717** (by `sessions.startedAt`)
- Evaluations in last 24h: **98** (by `evaluations.createdAt`)
- Approx coverage (eval/sessions, 24h): **~5.7%**
- Meta-agent inflation: evaluator produced **1129/1717** sessions in the last 24h; since eval-poller skips evaluator/judge, “overall coverage” is misleading.
- Coverage for non-meta sessions (excluding evaluator/judge): **98 / 586 = ~16.7%**
- Recency: `max(evaluations.createdAt) == max(sessions.startedAt)` (pipeline is writing today; lag ~= 0)

Evidence: bun:sqlite queries in heartbeat transcript.

## Likely cause
`agents/may/handlers/eval-poller.ts` has (a) **hard per-run caps** and (b) a **meta-agent skip list**.

Caps per 30-min run:
- `MAX_LLM_EVALS_PER_RUN = 12`
- `MAX_HEURISTIC_EVALS_PER_RUN = 200`
- `WALL_CLOCK_BUDGET_MS = 240_000`

So absolute throughput ceiling ~= (12+200) * 48 = 10,176 evaluations/day.

But the observed 24h numbers:
- completed sessions (DB, by `sessions.startedAt` + terminal `status`): **1714**
- session dirs in history in last 24h (filesystem): **1714**
- evaluations created in last 24h (DB): **98**

This points away from “history missing” and toward **eval-poller evaluating only a small agent allowlist**.
Evidence: evaluations in the last 24h exist only for: coach/amy/dev/optimizer/arc/bob/may/scout/tech-lead (no long tail).

Concretely, if most of the 1714 completed sessions are from other agents (or are skipped for another reason), coverage will look ~5-6% even if eval-poller is healthy.

## Next checks
1. Compute `sessions.startedAt>now-24h` grouped by `agent` to confirm whether the other sessions are from agents not being evaluated.
2. Find where eval-poller chooses candidates beyond `SKIP_AGENTS` (likely `evaluateStandaloneSession()` has further skip/scope logic).
3. Decide policy: broaden evaluation scope vs keep an allowlist and explicitly target “coverage of human-facing agents” instead of overall coverage.
