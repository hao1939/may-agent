# DD#760 — CoopEval: Cooperation-Sustaining Mechanisms for LLM Agents

**Paper**: arXiv:2604.15267 (Tewolde et al., 2026)
**Rating**: ★★★★☆
**Date**: 2026-04-19

## Summary

First comparative study of game-theoretic mechanisms enabling cooperation between LLM agents. Key findings:

1. **Stronger reasoning → less cooperative**: Models with better reasoning consistently defect in single-shot social dilemmas
2. **Contracting and mediation most effective**: Among 4 mechanisms tested (repetition, reputation, mediation, contracts), contracts and mediators achieve best cooperative outcomes
3. **Repetition fragile**: Cooperation from repeated games deteriorates drastically when co-players vary
4. **Evolutionary pressure helps**: Cooperation mechanisms become MORE effective under selection pressure

## Relevance

Connects to our cooperation-collusion spectrum (CR#275) and multi-agent coordination. Finding #1 (stronger reasoning = less cooperation) is a safety concern for our system as models improve. Finding #3 (repetition fragile with varying co-players) validates why our fixed agent roles with stable partnerships work better than ad-hoc agent pools.

## Connection to Prior Work

- **CR#275** (Cooperation-Collusion Spectrum): CoopEval provides mechanism-level evidence for what sustains cooperation
- **DD#497** (Cooperation Emergence): Complements with institutional/structural mechanisms rather than emergent properties
- **CR#339** (Guard Bifurcation): The mediation finding supports third-party oversight as cooperation enabler

## Predictions

- **P-760a**: Adding explicit "contracts" (pre-committed quality standards) between our agents would improve coordination more than reputation alone
- **P-760b**: As underlying LLMs get stronger reasoning, our agents may become less naturally cooperative — need structural safeguards
