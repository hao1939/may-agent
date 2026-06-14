# Evaluation App

Evaluates completed agent sessions for quality and efficiency. Detects
behavioral drift, patrols system integrity, and extracts successful
strategies.

This is a project-app: it owns the evaluation process, criteria, and
calibration. The evaluator agent is a worker identity dispatched by this app.

## Process

```
session.completed → evaluate → score → verdict → learning
```

Five lanes:
1. **Session aftermath** — evaluate completed sessions (every 5 min)
2. **Deep eval** — LLM-powered evaluation for selected sessions
3. **Drift detection** — per-agent behavioral drift (hourly)
4. **Integrity patrol** — system compliance checks (every 6h)
5. **Strategy extraction** — learn from high-scoring sessions

## Domain Knowledge

- `criteria/criteria.md` — current scoring criteria
- `criteria/scoring.md` — scoring methodology
- `criteria/versions/` — criteria version snapshots
- `criteria/calibration/` — human-vs-machine agreement data
- `reports/` — durable summaries (calibration, drift, patrol)

## Commands

```sh
bun scripts/evaluation-status.ts    # pipeline health
bun scripts/compare-shadow.ts       # shadow vs production comparison
bun scripts/check-integrity.ts      # app integrity validation
```
