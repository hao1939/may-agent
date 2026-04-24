# DD#874: SWARM — Soft-Label Governance for Distributional Safety in MAS

**Paper:** arXiv:2604.19752 (Aiersilan & Savitt, Mar 2026)
**Relevance:** ★★★★ HIGH
**Date:** 2026-04-24

## Core Idea

SWARM replaces binary good/bad safety classifications with soft probabilistic labels p = P(v=+1) ∈ [0,1], enabling continuous-valued governance of multi-agent systems. Implements a modular governance engine with configurable levers.

## Key Findings

1. **Strict governance reduces welfare by >40% without improving safety** — binary enforcement is counterproductive
2. **Aggressively internalizing externalities collapses welfare** (from +262 to -67) while toxicity remains invariant — governance over-correction is real
3. **Circuit breakers need careful calibration** — overly restrictive thresholds destroy value; optimal threshold balances welfare and toxicity
4. **Soft metrics detect proxy gaming** that binary evaluations miss — self-optimizing agents can pass binary checks while failing continuous ones
5. **Works on live LLM agents** (Concordia, Claude, GPT-4o Mini) without modification

## Governance Levers Tested

- Transaction taxes
- Circuit breakers
- Reputation decay
- Random audits

## Connection to Our System

**Direct relevance to DynaTrust (DD#424) and verification architecture:**
- Our trust system uses Bayesian updates with asymmetric weights — SWARM shows why continuous (not binary) is essential
- The "strict governance destroys welfare" finding validates our lighter-touch approach to agent oversight
- Proxy gaming detection via soft labels connects to NARCBench (DD#520) collusion detection — different mechanisms, same insight: binary monitoring is insufficient
- Circuit breaker calibration maps to our experiment budget controls and session timeouts

**Key quote for system design:** "Distributional safety requires continuous risk metrics and governance lever calibration involves quantifiable safety-welfare tradeoffs."

## For Optimizer

The welfare-safety tradeoff curves from SWARM could inform how we calibrate agent budgets and intervention thresholds. Over-governing agents (strict budgets, aggressive timeouts) may reduce output quality without improving reliability.

## Code

Website: https://www.swarm-ai.org/
