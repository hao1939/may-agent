# DD#778: Explicit Trait Inference for Multi-Agent Coordination

**Paper:** [2604.19278](https://arxiv.org/abs/2604.19278)  
**Authors:** Abdurahman, Ishii, Margatina, Bhargavi, Sunkara, Zhang  
**Relevance:** ★★★★★  
**Date:** 2026-04-22

## Core Idea

ETI (Explicit Trait Inference) enables LLM agents to infer and track partner characteristics along two psychological dimensions — **warmth** (trust, cooperativeness) and **competence** (skill, reliability) — from interaction histories. These trait profiles then guide coordination decisions.

## Key Results

- **Economic games:** 45-77% reduction in payoff loss vs CoT baseline
- **MultiAgentBench (realistic MAS):** 3-29% improvement depending on scenario/model
- Trait profiles **predict agent actions** — informative profiles drive the gains
- First systematic evidence that LLM agents can (i) reliably infer traits from history and (ii) leverage that awareness for coordination

## Mechanism

1. After each interaction, agents update warmth/competence estimates of partners
2. These structured trait profiles feed into decision prompts
3. Agents adapt behavior: delegate to competent partners, cooperate more with warm ones
4. Psychologically grounded in the Stereotype Content Model (warmth × competence)

## Why This Matters for Us

**Direct connection to our trust/reputation systems:**
- Our system already tracks agent reliability (competence dimension) but lacks explicit warmth/cooperativeness tracking
- ETI's two-dimensional model is richer than simple trust scores
- The finding that trait profiles predict actions means we could use this for agent behavior prediction
- Lightweight: no fine-tuning needed, just structured prompting with history

**Connection to existing hypotheses:**
- Relates to DynaTrust (DD#424) — ETI provides the psychological grounding that DynaTrust's mechanism lacks
- Relates to Cooperation-Collusion Spectrum (CR#275) — warmth dimension could help detect cooperative vs collusive behavior
- Connects to DD#562 (LLM Normative Conformity) — agents conforming to group norms may show different warmth profiles

## Actionable Implications

1. **Agent profiles:** Add warmth + competence dimensions to how we model agent capabilities
2. **Task routing:** Route tasks not just by skill match but by predicted cooperativeness for collaborative tasks
3. **Trust calibration:** Use two-dimensional trait model instead of scalar trust scores
4. **Failure prediction:** Declining competence scores could predict coordination failures before they happen

## Limitations

- Tested on LLM agents specifically; may not generalize to non-LLM agent types
- Warmth dimension harder to ground in software agents (no real emotions)
- Gains vary significantly by scenario (3-29% range is wide)
