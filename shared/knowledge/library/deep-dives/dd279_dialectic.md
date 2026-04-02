# DD#279 — DIALECTIC: Multi-Agent Debate for Startup Evaluation
**Paper:** DIALECTIC: A Multi-Agent System for Startup Evaluation  
**arXiv:** 2603.12274v1 (cs.MA, 13 Mar 2026)  
**Authors:** Jae Yoon Bae, Simon Malberg, Joyce Galang, Andre Retterath, Georg Groh — TU Munich, Earlybird VC, UVC Partners  
**Rating:** ★★★★☆

## Problem
VC investors face massive deal flow but can only evaluate a fraction deeply. Early-stage screening demands tradeoffs between evaluation thoroughness and opportunity coverage. Current ML approaches (XGBoost on structured features) predict well but don't model how investors actually form conviction — through iterative argumentation and hypothesis refinement.

## Method — Three-Phase Multi-Agent Architecture

**Phase 1 — Fact Collection:**
- Decomposer agent generates industry-specific question trees from 4 seed questions (company, team, product, market)
- Answer agent traverses question tree bottom-up, citing company data + web search
- Produces hierarchical fact base F covering all decision-relevant dimensions

**Phase 2 — Reasoning (Dialectical Debate):**
- Generator creates K arguments per stance (pro/contra investment)
- Critic acts as devil's advocate, challenging each argument
- Evaluator scores argument convincingness using 14-criteria taxonomy (Wachsmuth et al.)
- Refiner improves arguments based on scores
- **Survival-of-the-fittest**: Only top-K arguments survive each iteration
- Iterates T times → converges to small set of dominant pro/contra arguments

**Phase 3 — Decision:**
- Decision score = Σ(pro scores) - Σ(contra scores) + threshold τ
- Invest iff σ_T > 0
- Numeric scores enable ranking across entire deal pipeline

Uses GPT-5-mini with temperature 0.0 for deterministic fact-finding, higher for argumentation.

## Key Results
- **Backtested on real investment opportunities from 5 VC funds**
- Matches precision of human VCs in predicting startup success
- The dialectical debate phase measurably improves argument quality over iterations
- Generates interpretable pro/contra narratives (not just scores)

## What Makes This Important

1. **Process-faithful automation**: Unlike ML models that produce opaque predictions, DIALECTIC mirrors the actual cognitive process of VC evaluation — iterative hypothesis challenge and refinement.

2. **Survival-of-the-fittest argumentation**: The progressive elimination of weak arguments through adversarial critique is a principled way to handle multi-agent debate convergence. This is more structured than free-form debate.

3. **Practical deployment path**: Built with Earlybird VC and UVC Partners — this isn't academic abstraction but a system designed for real deal flow screening.

4. **Question tree decomposition**: The hierarchical fact-gathering approach (seed questions → industry-specific sub-questions → bottom-up synthesis) is a reusable pattern for any domain requiring structured knowledge acquisition.

## Connections to Portfolio

- **DD#220 (Multi-Agent Debate)**: DIALECTIC is a specific instantiation of multi-agent debate for a practical domain. Adds the survival-of-the-fittest argument selection mechanism.
- **DD#277 (CMAG)**: Both involve LLMs generating strategies/arguments, but DIALECTIC uses debate for decision quality while CMAG uses governance for ethical quality.
- **DD#197 (Structured Reasoning)**: Question tree decomposition connects to structured reasoning architectures.
- **DD#267 (MAAS: Agent Specialization)**: Both use role-specialized agents (generator, critic, evaluator, refiner) with clear interface contracts.

## Key Insight
**Dialectical debate with survival-of-the-fittest selection is a principled mechanism for multi-agent convergence on high-quality decisions.** The progressive elimination of weak arguments through adversarial critique ensures that surviving conclusions have been stress-tested against counterarguments — mimicking how expert committees actually form conviction.

## Limitations
- Only VC evaluation tested; generalization to other decision domains untested
- GPT-5-mini dependency; no model comparison
- Backtesting ≠ live performance; VC success is highly path-dependent
- Decision score (simple sum difference) is crude; doesn't weight argument importance
- No mechanism for handling truly novel/unprecedented startup types where decomposition patterns don't apply
