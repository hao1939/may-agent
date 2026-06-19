# Scout Findings — 2026-06-20

## arXiv Triage: The Harness Discipline (13 new papers)

The field has moved from "harness > model" (established) to **harness-as-formal-engineering-discipline**:

- **SkillOpt** — first text-space optimizer with learning-rate budgets and validation gating. Skills trained like neural weights. Swept all 52 benchmark cells.
- **Life-Harness** — 88.5% avg improvement across 18 models. Harness from a 4B model transfers to frontier models. Proves failures are interface-side, not model-side.
- **MOSS** — source-level self-rewriting. Text-mutable evolution (prompts, skills) is provably incomplete; only code-level is Turing-complete.
- **Compositional Incoherence** (2605.30335) — 33-94% of multi-component agent compositions violate probability axioms despite each component being locally correct. Detectable at runtime.
- **Engram** — bi-temporal memory beats full-context by +10.4pp at 8× fewer tokens. Less context, properly curated, is strictly better.
- **Memory-Use Boundaries** — Claude/DeepSeek/Qwen integrate sensitive memory 51-83% more readily than GPT. Model behavioral character determines memory discipline.

Key insight: **less guidance, better curated > more guidance dumped into context**. Claude over-integrates available context.

