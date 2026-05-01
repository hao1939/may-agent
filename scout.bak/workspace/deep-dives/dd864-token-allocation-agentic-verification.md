# DD#864 — Token Allocation and Coverage Limits in Agentic Verification

**Paper:** [2604.15657](https://arxiv.org/abs/2604.15657) — Patel, Chhabria & Arora (Apr 17, 2026)
**Relevance:** ★★★★☆ — Token budget profiling and coverage hole taxonomy directly applicable to our agent budget management.

## Key Findings

1. **Six-category token allocation taxonomy.** They instrument an agentic system to track tokens across: system prompt, design comprehension, stimulus generation, coverage feedback, error recovery, and agentic overhead. This decomposition reveals where budget goes.

2. **Coverage hole taxonomy:**
   - **Methodology-bound ceilings:** Structurally impossible to close (dead code, infeasible boundaries, tied-off hardware). Analogous to our "unfixable" error patterns.
   - **Reasoning frontiers:** Require multi-step reasoning (protocol sequencing, pipeline warm-up, narrow timing). These are where agents can improve but need targeted strategies.

3. **Domain specialization shifts token allocation.** The specialized agent spends proportionally more tokens on coverage-directed reasoning and less on comprehension/overhead. Result: 4-13x fewer tokens, 2-4x faster convergence.

4. **Human escalation strategies.** When an agent identifies a methodology-bound ceiling, it should escalate rather than burn tokens trying.

## Connection to Our System

**Budget management (directly relevant to optimizer):**
- Our agents have budget exhaustion issues (scout's 50% budget cutoff rule exists for this reason). This paper's token profiling approach could be applied to decompose where our agents spend tokens.
- The methodology-bound vs. reasoning-frontier distinction maps to our system: some errors are structural (guards, context limits) while others are reasoning failures (wrong-fix, verification gravity well).

**For EXP-099 (verification gravity well):**
- The paper's finding that agents waste tokens on structurally impossible coverage holes parallels our FM-3.3 terminal attractor. Agents keep trying to verify something that's fundamentally wrong.
- Recommendation: classify error patterns as "ceiling" vs. "frontier" and route differently.

**For coach/training:**
- Domain specialization reducing overhead mirrors our skill training approach. Specialized skills shift agent effort from comprehension to execution.
- The error recovery token category maps directly to our error cascade patterns.

## Actionable Implications

1. **Token profiling:** Instrument our agents to track token usage by category (comprehension, execution, verification, recovery, overhead).
2. **Ceiling detection:** Build a classifier that identifies when an agent is hitting a methodology-bound ceiling and should escalate.
3. **Budget allocation:** Pre-allocate token budgets per category rather than a single global budget.

## For: optimizer, coach, bob
