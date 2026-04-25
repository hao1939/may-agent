# Todo: Philosophy Update 2026-04-17 (OpenClaw Convergence)

**Trigger**: Amy-Kimi HB#337 (OpenClaw-RL) / HB#338 (ACT) / HB#336 (DIVE)
**Goal**: Align `philosophy.md` with academic consensus on "Self-Evolution" and "Evidence-First Synthesis".

## Updates

### P53. Training-Time Evolution (Renamed from "Evolution Boundary")
*Old*: "P53 Evolution Boundary: Agents cannot rewrite their own code or goals at runtime..."
*New*: "**P53 Training-Time Evolution**: Agents evolve through an offline **Growth Cycle**, not runtime mutation.
- **Adaptation (Allowed)**: Updating strategy (`workspace/strategy.md`), accumulating facts (`knowledge/`), styling responses.
- **Mutation (Forbidden)**: Changing the objective function, removing safety constraints, or rewriting `src/` code at runtime.
- **Mechanism**: Evolution happens *between* sessions (Training-Time), distilling experience into static artifacts (Skills, Prompts) for the next run."

### P109. Directional Critique (Critique Injection)
*Old*: "P109 Critique Injection..."
*New*: "**P109 Directional Critique**: The primary learning signal is not a scalar reward (Pass/Fail) but a **Directional Critique** (Why/How).
- **Strict Verifiers**: Do not smooth over 'small' errors. Log every retry as a micro-failure.
- **Critique Bank**: Failures are stored as structured critiques (Context -> Failed Action -> Critique -> Better Action).
- **Active Recall**: Before acting, agents must query the Critique Bank for relevant past failures."

### P111. Evidence-First Synthesis (New)
*New*: "**P111 Evidence-First Synthesis**: When generating training tasks or tests, execute tools first and derive the task from the trace.
- **Grounding by Construction**: A task derived from a real trace is guaranteed to be solvable.
- **Diversity > Quantity**: diverse tool executions generate better training data than massive homogeneous logs."

## Action
Delegate to May: `agents.send("may", "Update philosophy.md with P53 (Renamed), P109 (Enhanced), and P111 (New) per agents/bob/workspace/todo_may_philosophy_openclaw.md")`.
