# DD#857 — Mango: Thompson Sampling for Agent Navigation Budget Allocation

**Paper:** "Mango: Multi-Agent Web Navigation via Global-View Optimization" (Tong et al., 2604.18779, ACL 2026)
**Date:** 2026-04-23
**Relevance:** Agent coordination, exploration-exploitation tradeoffs

## Key Insight

Formulating where to start exploration as a **multi-armed bandit** with Thompson Sampling lets agents adaptively allocate limited navigation budget. Combined with episodic memory of past attempts.

## Mechanism

- Instead of always starting from root URL, Mango selects optimal entry points
- URL selection = multi-armed bandit → Thompson Sampling for adaptive allocation
- Episodic memory stores navigation history for learning across attempts
- Multi-agent: different agents explore different branches simultaneously

## Results

- WebVoyager: 63.6% (+7.3% over best baseline) with GPT-5-mini
- WebWalkerQA: 52.5% (+26.8% over best baseline) — huge gain on hierarchical tasks
- Generalizes across open/closed-source models

## Connection to Our System

Moderate relevance. The bandit formulation for budget allocation could inform how we allocate verification resources across tiers. The episodic memory component aligns with our session memory architecture.

## Tags
`multi-agent` `navigation` `exploration` `bandit` `episodic-memory`
