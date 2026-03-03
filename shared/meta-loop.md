# Meta Loop — Self-Improvement Cycle

**Owner: bob (orchestrator), evaluator (measurement), optimizer (implementation)**

The meta loop is how the agent system improves itself. It runs during idle time and is orchestrated by Bob.

## Flow

```
Idle trigger (5min)
    │
    ▼
┌─────────┐     ┌──────┐     ┌───────────┐     ┌─────────┐
│Evaluator │────▶│ Bob  │────▶│ Optimizer │────▶│Evaluator │
│(measure) │     │(judge)│     │(implement)│     │(verify)  │
└─────────┘     └──────┘     └───────────┘     └─────────┘
                  │  ▲                              │
                  │  │                              ▼
                  │  │                          ┌──────┐
                  │  └──────────────────────────│ Bob  │
                  │         accept/reject/hold  │(close)│
                  │                             └──────┘
                  │
                  ▼ (async, non-blocking)
              ┌─────────┐
              │  Human  │
              │(clarify) │
              └─────────┘
```

## Agent Roles in the Loop

### Evaluator — Measurement Instrument
- Scores completed sessions against consistent criteria (efficiency, quality, wasted calls)
- Does NOT interpret why something matters or decide what to fix
- Input: completed session transcripts
- Output: structured scores + issue lists + failure chains

### Bob — Interpreter / Design Conscience / Orchestrator
- Connects evaluation data to what the human actually cares about (via philosophy.md)
- Filters between measurement and action — prevents optimizer from chasing low-value noise
- Triggers the optimizer with a prioritized brief
- Reviews optimizer's changes after implementation
- Can challenge evaluator scoring ("those calls were exploration, not waste")
- Has veto power: accept, reject, or hold

### Optimizer — Executor of Improvements
- Implements fixes based on Bob's brief (not raw evaluation data)
- Uses implement-and-review workflow (coder + QA) for code changes
- Has autonomy on HOW to implement, not WHAT to implement

## Bob's Three Powers

### Accept
Change passes re-evaluation and aligns with philosophy. Update lessons, move on.

### Reject
Change doesn't improve what matters or violates philosophy. Revert, log why.

### Hold (non-blocking)
Bob is unsure whether a change aligns with human intent. The change stays in place provisionally. Bob queues a question for the human in `agents/bob/workspace/pending-decisions.md`. The loop continues with other work. When the human responds, the answer feeds back into philosophy.md.

## Two Review Tracks (Post-Hoc)

| Track | Agent | Question | Output |
|-------|-------|----------|--------|
| Performance | Evaluator | "Was this efficient? What was wasted?" | Scores, failure chains |
| Design | Bob | "Was this the right approach? Does it match philosophy?" | Alignment observations, drift flags |

Both feed into the optimizer's next cycle.

## Implementation

- Idle timer in run/may.ts triggers Bob (not optimizer directly)
- Bob has subagents tool to delegate to evaluator and optimizer
- Bob writes optimizer briefs to `agents/bob/workspace/optimizer-brief.md`
- Bob maintains hold queue at `agents/bob/workspace/pending-decisions.md`
- No complex workflow — Bob orchestrates via judgment, not a state machine
