# Plan: Agent-to-App Migration — Evaluation as First V3 App

## Context

The system is transitioning from agent-oriented to project-app-oriented. In the
agent model, each agent owns its domain: heartbeat, knowledge, workflows, skills,
periodic tasks. In the app model, each durable concern is a project-app that owns
the goal, task tree, domain model, and process. Agents become workers dispatched
by apps.

aks-rp-e2e proved the pattern. Now we apply it to evaluation — the most complex
agent — to validate the v3 app model works for internal system concerns, not just
domain projects.

## Why Evaluation First

- Most complex agent: 3 workflows, 15+ skills, deep knowledge, periodic tasks
- Highest system-wide impact: evaluation quality affects all agent improvement
- Most tangled: heartbeat log is 850+ lines of mixed monitoring/evaluation/patrol
- Clearest benefit: separating "evaluate sessions" from "be the evaluator agent"
  makes the evaluation process visible, steerable, and auditable

## What Moves

| Current (agent) | New (app) | Notes |
|-----------------|-----------|-------|
| `agents/evaluator/workflows/evaluator-aftermath.ts` | `evaluation.app/workflows/session-aftermath.ts` | Core evaluation pipeline |
| `agents/evaluator/workflows/evaluator-deep-eval.ts` | `evaluation.app/workflows/deep-eval.ts` | LLM evaluation |
| `agents/evaluator/knowledge/criteria.md` | `evaluation.app/criteria/criteria.md` | Evaluation criteria (domain knowledge) |
| `agents/evaluator/knowledge/aftermath-*.md` | `evaluation.app/criteria/learnings/` | Evaluation learnings |
| `agents/evaluator/skills/score.md` | `evaluation.app/criteria/scoring.md` | Scoring methodology |
| `agents/evaluator/skills/detect-drift.cjs` | `evaluation.app/workflows/drift-detection.ts` | Behavioral drift |
| `agents/evaluator/skills/monitor-session.cjs` | `evaluation.app/workflows/session-monitor.ts` | Active session health |
| `agents/evaluator/skills/patrol.cjs` | `evaluation.app/workflows/integrity-patrol.ts` | System integrity |
| `agents/evaluator/skills/extract-strategy.cjs` | `evaluation.app/workflows/strategy-extraction.ts` | Agent strategy learning |
| `agents/evaluator/periodic-tasks.md` | `evaluation.app/tasks/tree.json` | Process tree replaces periodic log |
| `agents/evaluator/workspace/consistency-flags.jsonl` | `evaluation.app/calibration/` | Calibration data |

## What Stays with the Agent

The evaluator agent keeps:
- `agent.json` — identity, model, tools
- `AGENTS.md` — agent behavior guidance
- `heartbeat.md` — simplified: just check app health + respond to messages

The agent becomes thin: its heartbeat checks whether the evaluation app has
work, dispatches itself as a worker if needed, and handles messages. All
domain knowledge, criteria, and process ownership moves to the app.

## evaluation.app Structure

```
projects/evaluation.app/
  app.ts                        # app declaration
  project.json                  # project metadata
  README.md                     # what this app does
  
  tasks/
    tree.json                   # process tree
    
  criteria/                     # evaluation domain knowledge
    criteria.md                 # scoring criteria
    scoring.md                  # scoring methodology
    learnings/                  # what we've learned about evaluation
    calibration/                # human-vs-machine agreement data
    
  workflows/
    session-aftermath.ts        # evaluate completed sessions
    deep-eval.ts                # LLM-powered deep evaluation
    drift-detection.ts          # behavioral drift detection
    session-monitor.ts          # active session health
    integrity-patrol.ts         # system integrity checks
    strategy-extraction.ts      # extract agent strategies
    calibration-review.ts       # human review calibration loop
    
  handlers/
    on-session-completed.ts     # trigger evaluation on session end
    on-metric-breach.ts         # react to evaluation metric breaches
    
  evidence/
    evaluations/                # scored evaluation results
    drift-reports/              # drift detection findings
    patrol-reports/             # integrity findings
    
  .state/                       # runtime state (gitignored)
```

## app.ts Declaration

```typescript
export default defineProjectApp({
  id: "evaluation",
  
  budget: {
    sessionsPerDay: 100,     // evaluation is high-volume
    tokensPerDay: 2_000_000,
    maxConcurrent: 5,
  },
  
  schedules: [
    {
      id: "session-aftermath",
      cron: "*/5 * * * *",   // every 5 min
      event: { type: "evaluation.tick", lane: "aftermath" },
    },
    {
      id: "drift-detection",
      cron: "0 * * * *",     // hourly
      event: { type: "evaluation.tick", lane: "drift" },
    },
    {
      id: "integrity-patrol",
      cron: "0 */6 * * *",   // every 6 hours
      event: { type: "evaluation.tick", lane: "patrol" },
    },
  ],
  
  events: [
    "session.completed",
    "evaluation.tick",
    "metric.breach",
  ],
  
  actions: {
    "evaluate-session": {
      type: "async",
      description: "Evaluate a specific session",
    },
    "review-criteria": {
      type: "sync",
      description: "Show current evaluation criteria",
    },
    "calibration-status": {
      type: "sync",
      description: "Show human-vs-machine agreement stats",
    },
  },
});
```

## Task Tree (Process)

```
◐ Evaluation system
  ◐ Session evaluation pipeline
    — evaluate completed sessions
    — score quality + efficiency
    — route to LLM deep-eval when needed
  ◐ Calibration and criteria
    — maintain scoring criteria
    — calibrate against human reviews
    — update criteria from disagreements
  ◐ Drift detection
    — detect behavioral drift per agent
    — classify: natural evolution vs regression
  ◐ System integrity
    — patrol for compliance violations
    — monitor active session health
  ◐ Strategy learning
    — extract successful strategies from high-scoring sessions
    — feed back into agent guidance
```

## Migration Steps

### Phase 1: Create the app shell (no behavior change)
1. Create `projects/evaluation.app/` with app.ts, README, project.json
2. Copy criteria and learnings from agent knowledge
3. Create initial task tree
4. Verify: app loads, no runtime errors

### Phase 2: Move workflows (parallel operation)
5. Copy workflows to app, adapt imports
6. Wire app schedules alongside existing cron
7. Run both old and new in parallel, compare outputs
8. Verify: same evaluations produced

### Phase 3: Cut over
9. Disable evaluator cron entries that moved to app
10. Simplify evaluator heartbeat to app-health check only
11. Move remaining knowledge to app workspace
12. Verify: evaluator agent is thin, app owns the process

### Phase 4: Prove it
13. Run for 1 week in app mode
14. Compare evaluation metrics: coverage, quality, latency
15. Fix gaps discovered during proving period
16. Document the migration pattern for other agents

## Migration Pattern (Reusable)

For any agent → app migration:

1. **Identify the durable concern** — what does this agent own that persists
   across sessions?
2. **Separate domain from identity** — knowledge, criteria, learnings go to
   the app. Agent personality, model, tools stay with the agent.
3. **Create app.ts** — declare schedules, events, actions
4. **Create task tree** — process steps the app follows
5. **Move workflows** — from agent workflows to app workflows
6. **Thin the agent** — agent heartbeat becomes: check app health, handle
   messages, dispatch self as worker when needed
7. **Parallel prove** — run both for 1 week, compare outputs
8. **Cut over** — disable agent-side, app owns the process

## Candidates After Evaluation

| Agent | Durable concern | Priority |
|-------|----------------|----------|
| evaluator | Session evaluation, calibration, drift | **This plan** |
| scout | Learning, exploration, knowledge synthesis | Next |
| may | System operations, project reconciliation | After scout |
| coach | Agent coaching, improvement recommendations | After may |

## Risks

- **Evaluation latency**: app dispatch adds one event hop vs direct cron.
  Mitigated: app schedules can be as frequent as cron.
- **Volume**: evaluator processes hundreds of sessions/day. App budget must
  be high enough.
- **Parallel operation**: running both old and new doubles evaluation cost
  during Phase 2. Keep parallel period short (3-5 days).

## Success Criteria

- Evaluation coverage unchanged (same sessions evaluated)
- Evaluation quality unchanged (same scores)
- Evaluation latency ≤ 2x current (app dispatch overhead)
- Evaluator agent heartbeat < 50 lines (was 850+)
- Task tree shows evaluation process clearly
- Human can steer evaluation from task tree (adjust criteria, review calibration)
