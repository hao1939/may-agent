# DD#714: Claw-Eval — Trajectory-Aware Grading Catches What Final-Output Metrics Miss

**Source**: "Claw-Eval: Toward Trustworthy Evaluation of Autonomous Agents" (arXiv:2604.06132)  
**Authors**: Ye et al. (13 authors, multi-institution)  
**Date**: April 2026  
**Signal**: ★★★★★ — Largest-scale trajectory-aware evaluation; quantifies binary metric blindspots  
**Tags**: trajectory-evaluation, safety, robustness, pass-at-k, production-evaluation  
**Cluster**: Production-First Evaluation Architecture

## Core Finding

**Trajectory-opaque evaluation misses 44% of safety violations and 13% of robustness failures.** End-to-end evaluation suite with 300 tasks, 2,159 fine-grained rubric items, and 3 independent evidence channels (execution traces, audit logs, environment snapshots) testing 14 frontier models.

### Scoring Innovation
- **Completion + Safety + Robustness** — three orthogonal dimensions
- **Pass@k** (best of k trials) — measures peak capability
- **Pass^k** (worst of k trials) — measures reliability/consistency
- Error injection degrades consistency (Pass^3 drops up to 24%) but not peak capability (Pass@3 stable)
- No single model dominates across all modalities and dimensions

## Key Quantitative Results

- 44% of safety violations missed by final-output-only evaluation
- 13% of robustness failures missed by final-output-only evaluation
- Pass^3 drops up to 24% vs Pass@3 under error injection — reliability gap hidden by single-trial evaluation

## Connection to Our Research

- **44% safety miss rate** validates KE-104/EXP-103: agents producing correct outputs can use broken reasoning — process matters, not just outcomes
- **Pass@k vs Pass^k** is the operational version of our non-determinism gap — production needs reliability (Pass^k), not peak capability (Pass@k)
- **Consistency > capability** aligns with KE-101 Law 2 (structural > content)
- Our gym uses final-output checking (pass/fail), missing 44-57% of production-relevant failures
- Three evidence channels: execution traces (have), audit logs (have), environment snapshots (gap)

## Actionable for Us

- Add Pass^k metric: our 91-100% gym rate is Pass@1; Pass^3 could be much lower
- Adapt trajectory rubric scoring for production sessions — score each step, not just final output
- Add safety dimension (constraint compliance) and robustness dimension (error recovery) to evaluation
