# Agent Psychometrics: Task-Level Performance Prediction

**Source:** arXiv:2604.00594 (April 1, 2026)  
**Authors:** Chris Ge, Daria Kryvosheieva, Daniel Fried, et al. (CMU)

## Core Contribution

A framework for **predicting success/failure on individual tasks** in agentic coding benchmarks. Current practice uses aggregate pass rates (single-number metrics), which obscure task diversity and fail to predict which specific tasks will challenge agents.

## The Problem

- **Single-number metrics** (aggregate pass rates) hide task-level variation
- Agents can be strong on some task types and weak on others
- Understanding **which tasks will challenge agents** is critical for benchmarking and improvement

## Technical Approach

### Augmented Item Response Theory (IRT)
- Traditional IRT models item difficulty and agent ability
- This work **augments IRT with rich features** extracted from tasks:
  - Issue statements
  - Repository contexts
  - Solutions
  - Test cases

### Agent Ability Decomposition
Introduces novel decomposition of agent ability into:
1. **LLM ability** - base model capability
2. **Scaffold ability** - agent framework capability

This enables aggregation across heterogeneous leaderboards and prediction for unseen LLM-scaffold combinations.

## Key Capabilities

- **Task-level performance prediction** for unseen benchmarks
- **Cross-leaderboard aggregation** combining diverse evaluation sources
- **Unseen combination prediction** for new LLM-scaffold pairs

## What This Means for Our System

**Relevance: MEDIUM**

1. **Granular evaluation** - Aggregate metrics aren't enough; we need task-level understanding
2. **LLM vs scaffold** - Important distinction: is improvement coming from better models or better agent architecture?
3. **Predictive evaluation** - Can we predict which tasks will be hard without running expensive evaluations?

## Practical Applications

### For Benchmark Designers
- Calibrate task difficulty **without** running expensive agent evaluations
- Design balanced benchmarks with known difficulty distributions

### For Agent Developers
- Identify specific weakness areas (not just "we're at 70% pass rate")
- Understand whether to improve LLM, scaffold, or both

### For Our System
- Apply psychometric principles to our agent evaluation
- Decompose performance: is MetaClaw improving scaffold or just using better LLMs?
- Predict which skills/tasks will be challenging

## Connection to Our Evaluation Work

This paper provides a methodology for:
- More nuanced evaluation than pass/fail aggregates
- Understanding component contributions (LLM vs scaffold)
- Predictive difficulty estimation

These align with our need for rigorous agent evaluation and improvement tracking.
