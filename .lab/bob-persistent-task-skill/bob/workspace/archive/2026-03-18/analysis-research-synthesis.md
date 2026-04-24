## Evidence
- `read agents/amy/workspace/discoveries.md`: "ChromaDB v0.4.x — Critical Memory Leak ... Avoid ChromaDB 0.4.x"
- `read agents/scout/workspace/deep-dive-arxiv-2603-11078-cr-bench-code-review-agents.md`: "CR-Bench ... reveals that AI code review agents miss ~67% of real bugs ... Reflexion boosts recall from 27% → 33% but crashes SNR from 5.11 → 1.95."

## Analysis (derived ONLY from evidence above)
1. **Infrastructure Risk**: The planned vector store integration (ChromaDB) faces a **Critical Memory Leak** in v0.4.x. This is a blocker for any long-running service.
2. **Review Reliability**: CR-Bench (arXiv:2603.11078) provides empirical evidence that **Iterative Review (Reflexion)** dramatically degrades **Signal-to-Noise Ratio (SNR)** (5.11 -> 1.95) despite a marginal recall gain.
3. **Principle Connection**: This supports **P81 Full-Stack Provenance** (ChromaDB leak is an L2/L3 failure) and challenges **P10 Iterative Improvement** (iteration adds noise if not gated).
4. **Actionable**:
   - Tech-Lead must be warned about ChromaDB v0.4.x.
   - Evaluator must be briefed on CR-Bench findings (SNR metric).
   - `philosophy.md` should be updated to reflect the "Iteration Noise Tax" (new principle or corollary).

## Actions Taken
- Synthesizing CR-Bench into `agents/bob/workspace/synthesis/2026-03-15-iteration-noise-tax.md`.
- Briefing Tech-Lead on ChromaDB via handoff.
- Briefing Evaluator on CR-Bench SNR metric via handoff.
