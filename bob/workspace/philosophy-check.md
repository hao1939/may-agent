## Philosophy Check: Cron Handler Drift

### Aligned ✅
- **Event-Driven Architecture (P33)**: The handlers correctly implement the "offload to infra" pattern. `evaluate-sessions.ts` and `watchdog.ts` run as pure JS, saving token costs and reducing latency.
- **Measurable Operations (P18)**: Both handlers log structured results (`skipped`, `evaluated`, `errors`), making their operation visible and debuggable.

### Drift ⚠️
- **Static Policies in Dynamic Environments (P44)**:
  - `evaluate-sessions.ts` hardcodes `META_AGENTS = new Set(["evaluator", "optimizer", "may"])`. If we add a new meta-agent (e.g., `coach`, `bob`), we must remember to update this list. This is a brittle static policy.
  - `watchdog.ts` hardcodes `PERSISTENT_AGENTS = new Set(["may"])`. This contradicts our move to "any agent can be the interface agent" (System Design). If `AGENT=bob` is used, Bob's persistent session will be killed by the watchdog after 45 minutes because he's not in the hardcoded list.

### Questions ❓
- Why does `evaluate-sessions.ts` skip meta-agents? Is it because they don't produce evaluatable work? Or to save tokens?
- If `evaluator` evaluates `optimizer` (which is a valid use case for meta-loop improvement), this hardcoded exclusion blocks it.

### Recommendations
1. **Remove Hardcoded Lists**:
   - In `watchdog.ts`: Check `session.isPersistent` (or equivalent flag) instead of checking the agent name. The runtime knows which session is the persistent interface session.
   - In `evaluate-sessions.ts`: If the exclusion is about avoiding infinite loops (evaluator evaluating evaluator), make it specific to the *role* in that session, or use a "no-eval" flag in the agent config, rather than a hardcoded name list.

2. **Dynamic Persistence Check**:
   - The watchdog should query the session manager: "Is this the interface session?" rather than "Is this May?".
