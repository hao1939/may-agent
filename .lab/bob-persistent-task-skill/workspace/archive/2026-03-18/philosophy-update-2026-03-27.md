# Philosophy Update
### New: 95. Data Quarantine (P95) — from: Scout/Amy (Zombie Agent Threat)
**"Untrusted input remains untrusted until sanitized."**
We cannot treat external web content (curl, fetch) the same as trusted internal files. Raw web content often contains "Prompt Injections" that can hijack an agent's context.
- **The Threat**: Persistent Memory Poisoning (Zombie Agents). An agent reads a malicious webpage, summarizes it into `knowledge/`, and effectively installs malware into the system's long-term memory.
- **The Law**: Never write raw external content to `knowledge/` without passing it through a Sanitization Skill.
- **The Mechanism**: Use the "Airlock Pattern". Download to `workspace/quarantine/`, sanitize using a dedicated skill/agent that strips imperative commands, then move to `knowledge/`.

### Revised: 53. Grounded Self-Evolution (P53)
**Added Mechanism**: **Failure-Driven Crystallization**. The primary mechanism for Capability Evolution is distilling failures into skills (SkillRL, arXiv:2602.08234). "If X failed, write a skill to handle X." This transforms iteration poison (drift) into iteration value (optimization).

### Duplicate Merged: P75 and P80
**Merged**: P75 (Cross-Delegation Tracking) and P80 (Integration Success Rate) are the same concept (L3 Defense).
**Action**: Kept P80 as the definitive definition ("Measure the Connection"). Removed P75 to reduce noise.

### New: 93. Infrastructure Resilience (P93) — from: L3 Crisis (Bob/Optimizer)
**"The System Must Survive the Infrastructure."**
External APIs (LLMs, Tools) are unreliable distributed systems. They will fail with timeouts, empty responses, and malformed streams.
- **The Failure**: An unhandled infrastructure error crashes the agent loop, losing state.
- **The Law**: **Wrap every external call in a Resilience Layer.**
- **The Mechanism**:
  1. **Retry with Backoff**: Transient errors (503, Empty) get 3 retries.
  2. **Circuit Break**: Persistent errors (Auth, 404) fast-fail.
  3. **Fallbacks**: If a model fails, degrade to a cheaper/dumber model or a heuristic.
- **Validation**: 1089 tests passed after implementing P93 in `manager.ts` during the L3 Crisis.

### Open Questions
- **P78 Supply Chain**: Do we need a dedicated "Skill Registry" agent, or is the filesystem enough?
- **P80 ISR**: How to measure ISR for async `send` calls? (Current metric is blind to them).
