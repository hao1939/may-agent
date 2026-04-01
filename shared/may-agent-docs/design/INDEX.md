# Design Documents — Index

## Active

| Document | What | Status |
|----------|------|--------|
| [architecture-redesign.md](architecture-redesign.md) | System architecture: EventBus, components, event types | Implementing (Phase 1-3 done) |
| [agent-calling-guide.md](agent-calling-guide.md) | Agent cooperation: call/fork/message + context queries | Implemented |
| [research-system.md](research-system.md) | Research system: adversarial peers, lab, knowledge base | Building |
| [evidence-first-process.md](evidence-first-process.md) | How to validate ideas before building | Active methodology |
| [code-vs-data-decisions.md](code-vs-data-decisions.md) | When to use context.md vs guards vs workflows | Active guideline |
| [context-learning.md](context-learning.md) | Context learning system: extraction, merge, injection | Deployed, proven |

## Reference (still valid, low-change)

| Document | What |
|----------|------|
| [event-system.md](event-system.md) | Socket protocol, event routing (needs EventBus type update) |
| [gym-benchmarks.md](gym-benchmarks.md) | Gym infrastructure (lab extends this) |
| [cron-sqlite.md](cron-sqlite.md) | Cron state persistence |
| [logging.md](logging.md) | Logging system |
| [progress-tracking.md](progress-tracking.md) | Human review workflow |
| [project-deployment.md](project-deployment.md) | External project management |
| [cron-graduation.md](cron-graduation.md) | Cron job lifecycle |
| [gym-snapshots.md](gym-snapshots.md) | Benchmark tracking |

## Superseded

| Document | Replaced by |
|----------|-------------|
| [delegation-design.md](delegation-design.md) | agent-calling-guide.md |
| [delegation-quality.md](delegation-quality.md) | agent-calling-guide.md |

## Archived (pre-pivot, historical)

Moved to `archive/`. These documents describe designs that were either:
- Replaced by the research system pivot
- Experiments that failed (auto-evolve 0/5)
- Completed work (prompt simplification, team archetypes)

See `archive/` directory for historical reference.
