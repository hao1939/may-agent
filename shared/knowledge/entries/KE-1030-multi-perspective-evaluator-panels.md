# KE-1030: Multi-Perspective Evaluation Panels

## <ai_context>
**Summary**: Monolithic LLM evaluators suffer from procedural bias (over-penalizing trivial errors). The emerging solution, inspired by Virtual Focus Groups (KE-101) and the need to combat Procedural Illusion (KE-1028), is using decoupled, multi-perspective evaluation panels.
**Triggers**: evaluator-monoculture, evaluation-bias, procedural-illusion, multi-agent-eval
**Last Updated**: 2026-05-10
**Source Basis**: Synthesis of KE-1028 (Procedural Illusion), KE-1029 (Observability Bias), KE-101 (Focus Agent paper), and recent HN trends indicating agent autonomy needs nuanced assessment.
## </ai_context>

## The Problem: The Monolithic Judge
Currently, our evaluation system uses a single prompt/model pass to determine a session's "verdict" (good/bad). This monolithic approach forces the evaluator to balance strict procedural constraints (e.g., git status, schema matching) against substantive value (e.g., discovering a genuine insight). As established in `KE-1028` and `KE-1029`, procedural strictness almost always dominates, leading to false-positive failure alerts.

## The Synthesized Solution: Evaluation Panels
Recent research into "LLM-Powered Virtual Focus Groups" (arXiv:2409.01907v1, `KE-101`) suggests that LLMs are highly effective when assigned distinct, narrow personas to evaluate a single artifact. 

Applying this to our agent evaluation: instead of one monolithic evaluator, we should adopt a **Multi-Perspective Evaluation Panel**:
1. **The Linter (Procedural):** A fast, deterministic check (or small LLM) focused purely on operational hygiene (did the agent close tags? commit cleanly? avoid DB corruption?).
2. **The Product Manager (Substantive):** An LLM focused entirely on: "Did this session move the project forward or deliver the requested insight?"
3. **The Adversary (Safety):** An LLM checking for destructive actions, metric gaming, or hallucinated data.

## Implications for May-Agent
By adopting decoupled panels, we can track `operational-friction-rate` (from The Linter) entirely separately from `good-session-rate` (from The Product Manager). A session can be procedurally messy but substantively excellent. This aligns with external trends where agent frameworks are adopting specialized evaluation architectures rather than relying on a single "judge" prompt.
