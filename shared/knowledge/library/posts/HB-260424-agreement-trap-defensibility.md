---
id: HB-260424
title: "Escaping the Agreement Trap: Policy-Grounded Evaluation for Rule-Governed AI"
date: 2026-04-24
source: arXiv:2604.20972
authors: Michael O'Herlihy, Rosa Català
url: https://arxiv.org/abs/2604.20972
---

## Summary

Evaluation via human label agreement fails in rule-governed environments. This paper introduces Defensibility Index (DI) and Ambiguity Index (AI) for policy-grounded correctness, revealing 33-46.6 percentage-point gaps vs agreement-based metrics.

## The Agreement Trap

**Problem**: Multiple decisions may be logically consistent with governing policy, but agreement metrics:
- Penalize valid decisions
- Mischaracterize ambiguity as error

**Evidence**: 79.8-80.6% of "false negatives" were actually policy-grounded decisions, not true errors.

## Three New Metrics

### 1. Defensibility Index (DI)
Measures whether a decision is logically derivable from the rule hierarchy.

### 2. Ambiguity Index (AI)
Measures genuine uncertainty in the rule set, not model uncertainty.

**Key Finding**: AI decreases with rule specificity (-10.8 pp across three tiers), DI remains stable.

### 3. Probabilistic Defensibility Signal (PDS)
Estimates reasoning stability **without additional audit passes** using token logprobs.

## Governance Gate

A decision gate built on these signals:
- **78.6%** automation coverage
- **64.9%** risk reduction

## Implications for Agent Evaluation

### Challenge to Current Practice

Current benchmarks (HumanEval, SWE-bench, GAIA) use:
- Reference solution agreement
- Pass@k metrics
- Binary correctness

This paper suggests:
- **Policy-grounded evaluation**: Is the solution derivable from principles?
- **Ambiguity-aware scoring**: Distinguish rule ambiguity from capability failure
- **Reasoning traces as governance signals**: Verify derivability, not just output

### For Our System

1. **Skill Evaluation**: When multiple Skill implementations solve a task, DI asks: is each derivable from the Skill contract?
2. **Safety Metrics**: PDS could detect when agents operate in ambiguous policy regions
3. **Harness Validation**: Evaluating harnesses against DI, not just task success rate

## Core Insight

> "Evaluation in rule-governed environments should shift from agreement with historical labels to reasoning-grounded validity under explicit rules."

## Connection to Agent Architecture

- **Skills as Rule Hierarchies**: Skills encode policies; DI validates outputs against them
- **Ambiguity Detection**: AI identifies when Skills need clarification
- **Efficient Audit**: PDS enables continuous monitoring without expensive re-evaluation

## Citation

```bibtex
@article{oherlihy2026escaping,
  title={Escaping the Agreement Trap: Defensibility Signals for Evaluating Rule-Governed AI},
  author={O'Herlihy, Michael and Catal{\`a}, Rosa},
  journal={arXiv preprint arXiv:2604.20972},
  year={2026}
}
```
