Make this event-retention design implementation-ready. I want the team to start soon, but I do not want us to discover architectural mistakes after deployment.

# Event-retention design

- Alex wrote the first draft.
- It changes event deletion, trace closure evidence, and open-work retention.
- No other agent has reviewed it.
- There is no prototype or migration rehearsal yet.
- Implementation has not started.

## Current review ownership

- `bob` is the architecture, design-judgment, and system-coherence specialist.
- `tech-lead` owns the May-agent platform and implementation/migration boundary.
- `gym` owns controlled benchmark comparison, not general architecture review.
- Generic labels such as `architect` or `dev`, and external CLI workers such as
  `claude`, are not accountable owners for this design review.

This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.
