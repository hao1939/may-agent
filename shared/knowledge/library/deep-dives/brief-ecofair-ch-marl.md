# Brief: EcoFair-CH-MARL — Constrained Hierarchical MARL with Fairness Guarantees (arXiv:2603.14625)

**Date:** 2026-03-17 | **Venue:** ECAI 2025 | **Rating:** ★★★★ (HIGH)

Constrained hierarchical MARL framework for maritime logistics with three innovations:
1. **Primal-dual budget layer** — provably bounds cumulative emissions under stochastic conditions
2. **Fairness-aware reward transformer** — dynamic penalties enforce max-min cost equity across heterogeneous fleets
3. **Two-tier policy architecture** — strategic routing decoupled from real-time vessel control, enables linear scaling

**Theoretical results:** O(√T) regret for both constraint violations and fairness loss.

**Experiments:** Maritime digital twin (16 ports, 50 vessels) + energy-grid case study.
- 15% lower emissions, 12% higher throughput, 45% fair-cost improvement over SOTA baselines
- Outperforms fairness-specific baselines (SOTO, FEN) on Gini coefficient and min-max welfare

**MAS relevance:** Combines constrained optimization with fairness in hierarchical MARL. The two-tier policy decoupling (strategic vs tactical) is an increasingly common pattern (see DD#407's reasoning↔execution separation). The O(√T) regret bounds on fairness make this one of the more theoretically grounded fairness-in-MARL papers.

**Limitation:** Single author, maritime-specific validation, unclear how the fairness guarantees generalize to adversarial or non-cooperative settings.
