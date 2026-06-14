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

## Layout

- `app.ts` declares schedules, event routes, actions, and app-owned adapter
  behavior.
- `workflows/` contains the app workflow entrypoints.
- `agents/evaluator/` contains the evaluator worker identity and guidance.
- `criteria/` contains scoring criteria and versioned methodology.

## Commands

```sh
bun run check       # syntax, typecheck, and formatting
bun run bundle      # build the app manifest and local workflows
```

The v3 app manifest in `app.ts` owns schedules and event-to-handler routing.
Session aftermath runs only for `session.completed` or explicit
`evaluation.session.requested` events that carry a concrete `sessionId`;
regular ticks review pipeline health instead of blindly running aftermath.
