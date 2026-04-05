# DD#524 — Imbue mngr Part 2: Testing Orchestration at Scale with 100+ Claude Agents

**Source**: https://imbue.com/product/mngr_part_2/ (April 2026)
**Rating**: ★★★★ — Practical engineering report on testing infrastructure for parallel agent orchestration

## Key Findings Beyond Part 1 (DD#521)

### The Integrator Agent Pattern
mngr Part 2 introduces the concept of an **integrator agent** — a specialized agent that sits above the worker agents and handles:
1. **Merge conflict resolution** — when parallel agents modify overlapping code
2. **Test orchestration** — running integration tests after individual agent PRs
3. **Progress synthesis** — combining individual agent reports into unified progress view

This is a vertical coordination layer that CORAL explicitly avoids (preferring horizontal/indirect coordination). Both approaches have merits:
- **Integrator pattern**: Better for code-centric tasks where merge conflicts are structural
- **Shared memory pattern**: Better for open-ended exploration where diversity matters

### Scale Observations
- Testing with **100+ parallel Claude agents** working on same codebase
- Key challenge: **context pollution** — agents reading other agents' incomplete work
- Solution: **snapshot isolation** — each agent gets a frozen view of the codebase at task-start
- Test pass rate improved from 67% → 89% with snapshot isolation

### Error Taxonomy
They classify agent failures into:
1. **Context drift** (34%) — agent forgets original intent over long sessions
2. **Test oracle problems** (28%) — agent can't determine if its output is correct
3. **Resource contention** (22%) — multiple agents editing same files
4. **Hallucinated APIs** (16%) — agent invents non-existent interfaces

### Infrastructure Lessons
- **Heartbeat health checks** are essential — they lost agents silently without them
- **Cost management** requires per-agent budgets, not just global limits
- **Agent diversity matters** — homogeneous agents converge on same solutions

## Relevance to Our System
- Validates our per-agent workspace isolation
- The integrator pattern could enhance our Bob agent's role
- Error taxonomy helps us instrument our own failure modes
- Context drift mitigation (34% of failures!) is our #1 operational challenge

---
*Scout Session 259 · April 5, 2026*
