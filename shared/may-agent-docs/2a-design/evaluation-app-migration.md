# Plan: Agent-to-App Migration — Evaluation

## Context

The system is transitioning from agent-oriented to project-app-oriented. In the
agent model, each agent owns its domain: heartbeat, knowledge, workflows, skills,
periodic tasks. In the app model, each durable concern is a project-app that owns
the goal, task tree, domain model, and process. Agents become workers dispatched
by apps.

aks-rp-e2e proved the app pattern for domain projects. This plan applies it to
evaluation — the first internal system-service migration. Evaluation is a durable
process, not an agent personality. Making it an app makes the evaluation pipeline
visible, steerable, and auditable.

## Why Evaluation First

- Most complex agent: 3 workflows, 15+ skills, deep knowledge, periodic tasks
- Highest system-wide impact: evaluation quality affects all agent improvement
- Most tangled: heartbeat log is 850+ lines of mixed monitoring/evaluation/patrol
- Clearest benefit: separating "evaluate sessions" from "be the evaluator agent"

## Three Boundaries

The migration must keep three things separate:

| Layer                       | What it holds                                               | Storage                           | Committed?         |
| --------------------------- | ----------------------------------------------------------- | --------------------------------- | ------------------ |
| **Domain knowledge**        | Criteria, scoring methodology, calibration model, learnings | `criteria/`, `reports/`           | Yes                |
| **High-volume records**     | Individual evaluation rows, scores, verdicts                | DB (`evaluations` table), runtime | No — stays in DB   |
| **Runtime/process control** | Task tree, shadow comparisons, scratch state                | `tasks/`, `.state/`               | Tree yes, state no |

Individual session evaluations are records, not tasks. They do not go in the
task tree or in committed evidence folders.

## What Moves

| Current (agent)                                      | New (app)                                         | Notes            |
| ---------------------------------------------------- | ------------------------------------------------- | ---------------- |
| `agents/evaluator/workflows/evaluator-aftermath.ts`  | `evaluation.app/workflows/evaluator-aftermath.ts` | Core pipeline    |
| `agents/evaluator/workflows/evaluator-deep-eval.ts`  | `evaluation.app/workflows/evaluator-deep-eval.ts` | LLM evaluation   |
| `agents/evaluator/knowledge/criteria.md`             | `evaluation.app/criteria/criteria.md`             | Domain knowledge |
| `agents/evaluator/knowledge/aftermath-*.md`          | `evaluation.app/criteria/learnings/`              | Learnings        |
| `agents/evaluator/skills/score.md`                   | `evaluation.app/criteria/scoring.md`              | Methodology      |
| `agents/evaluator/skills/detect-drift.cjs`           | `evaluation.app/workflows/drift-detection.ts`     | Drift            |
| `agents/evaluator/skills/monitor-session.cjs`        | `evaluation.app/workflows/session-monitor.ts`     | Monitoring       |
| `agents/evaluator/skills/patrol.cjs`                 | `evaluation.app/workflows/integrity-patrol.ts`    | Integrity        |
| `agents/evaluator/skills/extract-strategy.cjs`       | `evaluation.app/workflows/strategy-extraction.ts` | Learning         |
| `agents/evaluator/periodic-tasks.md`                 | `evaluation.app/tasks/tree.json`                  | Process tree     |
| `agents/evaluator/workspace/consistency-flags.jsonl` | `evaluation.app/criteria/calibration/`            | Calibration      |

## What Stays with the Agent

The evaluator agent becomes a worker identity only:

- `agent.json` — name, model, tools
- `AGENTS.md` — minimal worker behavior guidance

No heartbeat. No cron. No periodic tasks. No domain knowledge.
The app owns schedules and dispatches the evaluator as a worker.

## App Layout

```
projects/evaluation.app/
  app.ts                        # app declaration: events, schedules, actions
  package.json
  README.md

  tasks/
    tree.json                   # process tree (pipeline health, not individual evals)
    README.md

  criteria/                     # evaluation domain knowledge (committed)
    criteria.md                 # current scoring criteria
    scoring.md                  # scoring methodology
    versions/                   # criteria version snapshots
      v1.md
      v2.md
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

  scripts/
    compare-shadow.ts           # compare shadow vs production evaluations
    evaluation-status.ts        # pipeline health check
    check-integrity.ts          # app-level integrity validation

  reports/                      # durable high-value summaries (committed)
    calibration/                # calibration reports
    drift/                      # drift detection reports
    patrol/                     # integrity findings

  .state/                       # runtime scratch (gitignored)
    shadow-evaluations.jsonl    # shadow mode comparison data
    journal.jsonl               # runtime journal
```

## Criteria Versioning

Every evaluation record includes provenance:

```json
{
  "sessionId": "s_177...",
  "agent": "may",
  "criteriaVersion": "v2",
  "scoringVersion": "v1",
  "workflowVersion": "session-aftermath@1.3",
  "score": { "quality": 0.65, "efficiency": 0.8 },
  "verdict": "acceptable",
  "evidence": ["session transcript", "tool call analysis"],
  "createdAt": "2026-06-14T..."
}
```

`criteria/versions/` keeps snapshots. When criteria change, bump the version.
Auditing "why did this session get 0.65?" requires knowing which criteria
version was active.

## app.ts Declaration

```typescript
export default defineProjectApp({
  id: "evaluation",
  owner: "evaluator",
  workspace: "projects/evaluation.app",

  budget: {
    sessionsPerDay: 100,
    tokensPerDay: 2_000_000,
    maxConcurrent: 5,
  },

  schedules: [
    {
      id: "evaluation-pipeline-review",
      cron: "*/5 * * * *",
      event: { type: "evaluation.tick", lane: "pipeline-health" },
    },
    {
      id: "drift-detection",
      cron: "0 * * * *",
      event: { type: "evaluation.tick", lane: "drift" },
    },
    {
      id: "integrity-patrol",
      cron: "0 */6 * * *",
      event: { type: "evaluation.tick", lane: "patrol" },
    },
  ],

  events: [
    "session.completed",
    "evaluation.session.requested",
    "evaluation.tick",
    "metric.breach",
  ],

  eventGraph: {
    routes: {
      "evaluation-aftermath": {
        emits: [
          "evaluation.reviewed",
          "evaluation.triage_closed",
          "evaluation.learning_created",
        ],
      },
      "evaluation-heartbeat": {
        emits: ["heartbeat.step_started", "heartbeat.skipped"],
      },
      "evaluation-deep-eval": {
        emits: ["handler.workflow_dispatched"],
      },
    },
    adapters: [
      {
        event: "metric.breach",
        emits: ["evaluation.tick"],
      },
      {
        event: "project.action.invoked",
        emits: ["evaluation.tick"],
      },
    ],
    externalEvents: [
      "evaluation.reviewed",
      "evaluation.triage_closed",
      "evaluation.learning_created",
      "heartbeat.step_started",
      "heartbeat.skipped",
      "handler.workflow_dispatched",
    ],
  },

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
      description: "Show human-vs-machine agreement",
    },
    "pipeline-health": {
      type: "sync",
      description: "Show evaluation pipeline health",
    },
  },

  // Events correlate to durable evaluation tasks through taskRoutes.
  // taskWorkflows provides aftermath, heartbeat, and deep-evaluation
  // capabilities; ownerEntry handles tasks without a bound workflow.
});
```

## Task Tree (Process, Not Records)

The tree represents systemic evaluation work, not individual evaluations:

```
◐ Evaluation system
  ◐ Pipeline health
    — is the aftermath pipeline keeping up?
    — are there evaluation gaps?
    — is LLM lane producing useful signal?
  ◐ Criteria and calibration
    — are criteria producing consistent scores?
    — human-vs-machine agreement rate
    — criteria version management
  ◐ Drift detection
    — per-agent behavioral drift monitoring
    — classify: natural evolution vs regression
  ◐ System integrity
    — compliance patrol findings
    — active session health anomalies
  ◐ Strategy learning
    — extracted strategies from high-scoring sessions
    — feed back into agent guidance
```

Individual "evaluate session X" is a workflow execution, not a task tree node.
The aftermath workflow must run only from `session.completed` or explicit
`evaluation.session.requested` events that carry a concrete `sessionId`;
periodic ticks review pipeline health and must not invoke aftermath blindly.

## Loop-Control Safeguards

Known evaluation failure modes that the app must preserve/strengthen:

| Risk                    | Safeguard                                                                 |
| ----------------------- | ------------------------------------------------------------------------- |
| Self-evaluation         | Skip: do not evaluate evaluator's own sessions                            |
| Duplicate evaluation    | Dedupe by `sessionId + criteriaVersion`                                   |
| Aftermath amplification | Cooldown: repeated problem classes get exponential backoff                |
| Zero-op auth failures   | Classify as infra issue, do not trigger aftermath review                  |
| Noisy escalations       | Cooldown per problem class, max 1 escalation per class per hour           |
| Metric scope leak       | Only react to evaluation-owned metrics, not all `metric.breach`           |
| Self-reference loops    | Evaluator sessions that trigger more evaluator sessions: hard depth limit |

## Migration Phases

### Phase 1: Create app shell

Create `evaluation.app/` with app.ts, README, project.json, tasks/tree.json.
No behavior change. Verify: app loads, no runtime errors.

### Phase 2: Extract criteria and schemas

Move criteria, scoring methodology, calibration data from agent knowledge.
Add criteria versioning (`criteria/versions/v1.md`). No behavior change yet.

### Phase 3: Replay historical sample

Run app evaluator against a fixed sample of past sessions (e.g., 50 sessions
from last 24h). Compare scores against existing `evaluations` table rows.
Write results to `.state/shadow-evaluations.jsonl`.
Verify: same verdicts within acceptable tolerance.

### Phase 4: Shadow live mode

App observes live `session.completed` events and evaluates in shadow.
Shadow results go to `.state/shadow-evaluations.jsonl`, NOT to production
`evaluations` table. No production metrics, no aftermath actions.
Run `scripts/compare-shadow.ts` daily to measure agreement.
Duration: 3-5 days.

### Phase 5: Cut over session-aftermath

Move session-aftermath to app production. One lane at a time.
Disable evaluator cron for aftermath.
Verify: evaluation coverage, quality, latency unchanged.

### Phase 6: Expand remaining lanes

Move drift detection, integrity patrol, strategy extraction.
Each lane: shadow first → cut over.

### Phase 7: Thin evaluator

Remove all old cron/heartbeat logic from evaluator agent.
Agent becomes worker identity only.
Verify: evaluator agent heartbeat is gone or minimal.

## Success Criteria

- Evaluation coverage unchanged (same sessions evaluated)
- Evaluation quality unchanged (same score distribution)
- Evaluation latency ≤ 2x current (app dispatch overhead)
- Criteria versioned: every evaluation record has criteriaVersion
- Task tree shows pipeline health, not individual evaluations
- Human can steer: adjust criteria, review calibration, pause lanes
- No self-evaluation, no duplicate evaluations, no aftermath amplification
- Evaluator agent is a thin worker identity

## Candidates After Evaluation

| Agent     | Durable concern                             | Priority      |
| --------- | ------------------------------------------- | ------------- |
| evaluator | Session evaluation, calibration, drift      | **This plan** |
| scout     | Learning, exploration, knowledge synthesis  | Next          |
| may       | System operations, project reconciliation   | After scout   |
| coach     | Agent coaching, improvement recommendations | After may     |
