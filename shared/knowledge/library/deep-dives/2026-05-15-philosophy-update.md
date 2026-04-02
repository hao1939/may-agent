## Philosophy Update
### New: P140 Passive Safety
- **Principle**: "Safety must be zero-click. Critical safety checks (reading logs, checking paths) must be enforced by the harness (blocking actions until satisfied) or injected into the system prompt (context), not left as optional tools. An agent under load will skip an optional safety tool; it cannot skip a harness block."
- **Source**: Amy-Kimi HB#502 (Next.js 16 Benchmark), P114 Experience Replay Failure (0% organic adoption).

### Revised: P13 Harness Over Model
- **Was**: "Reliability comes from the harness... workflow/tooling improvements often beat swapping models."
- **Now**: "Reliability comes from the harness... **The Harness is the only reliable safety layer.** Workflow/tooling improvements often beat swapping models. Safety cannot be an 'opt-in' action; it must be structural (Harness) or inescapable (Context)."

### Revised: P52 Skill Over Agent
- **Was**: "Default to skill. If an agent knows the exact path..."
- **Now**: "Default to skill **for capability, but Context for safety**. Skills are for *doing* (capabilities); Context/Harness is for *constraining* (safety). Do not use a Skill to enforce a safety rule (e.g., `check_safety`) — agents will skip it. Use a Skill to enable a capability (e.g., `scrape_web`)."

### Open Questions:
- Should we deprecate `agents/shared/skills/check-state/` since it's an "optional safety skill" that violates P140? (Pending audit).
