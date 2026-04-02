# DD#278 — Status Signaling: Generative Model of Conspicuous Consumption
**Paper:** A Generative Model of Conspicuous Consumption and Status Signaling  
**arXiv:** 2603.13220v1 (cs.MA, 13 Mar 2026)  
**Authors:** Logan Cross, Jordi Grau-Moya, William A. Cunningham, Alexander Sasha Vezhnevets, Joel Z. Leibo — Google DeepMind + U. Toronto  
**Rating:** ★★★★★

## Problem
Status signaling drives resource allocation in human societies, but classical frameworks (Costly Signaling Theory) treat preferences as fixed and can't explain how specific goods/behaviors acquire or lose prestige dynamically. Why does a Labubu doll become a Veblen good while similar toys don't? CST explains why signals are stable once established, but lacks a generative mechanism for how they emerge.

## Theory — Predictive Pattern Completion via Appropriateness
The paper proposes that status symbols emerge endogenously through a feedback loop:
1. Agents observe peers' consumption/signaling in social contexts
2. Agents update internal model of "what people like us do" (habitus, per Bourdieu)
3. Agents imitate observed status signals via predictive pattern completion
4. Social diffusion amplifies convergence on specific symbols

This grounds status signaling in the **theory of appropriateness** rather than rational utility maximization: humans (and LLM agents) act by sampling actions that are contextually appropriate given observed precedent, not by optimizing payoffs.

## Method — Concordia LLM Agent Simulations
- LLM-based agents with synthetic personas living daily lives in the Concordia framework
- Agents buy food, gadgets, clothing, accessories in a marketplace
- Social phase: "first dates" where agents observe each other's visible items + 80 turns of conversation
- Memory streams encode social observations → drive preference updating

**Key experimental manipulations:**
1. **Social visibility ON/OFF**: With social interaction, functional demand transforms into status-seeking
2. **Real brands vs. synthetic goods**: Tests whether effects are just pretraining bias
3. **Fixed vs. dynamic pricing**: Isolates whether cost drives demand or demand drives cost
4. **Influencer agents**: Tests whether targeted social influence creates subcultures

## Key Results

### Status Goods Emerge from Social Interaction
- **WITH social layer**: High demand + price run-ups for luxury goods (Chanel, Rolex); Labubu becomes a Veblen good (positive price elasticity — demand INCREASES with price)
- **WITHOUT social layer**: Static prices, significantly lower purchase rates for status goods
- The social layer alone transforms functional demand into conspicuous consumption

### Pretraining Bias Ruled Out
- Same status effects observed with **procedurally generated synthetic goods** (no prior brand knowledge)
- Status is socially constructed in-context, not retrieved from training data

### Social Contagion > Cost Signaling
- **Fixed-price control**: Status purchases increased EVEN MORE with fixed initial prices
- This proves social contagion drives demand, not signal cost (refutes pure CST)

### Influencer Effects
- "Influencer" agents drive endogenous formation of distinct subcultures through targeted sanctioning
- Similar effects generalize to non-monetary signaling behaviors (political allegiance, group identity, altruism signaling)

## What Makes This Important

1. **Endogenous preference formation**: Previous agent models treat preferences/utilities as fixed. This demonstrates preferences emerge from social interaction — a paradigm shift for agent design.

2. **Veblen effects emerge naturally**: Positive price elasticity (demand increases with price) is notoriously hard to model. Here it emerges organically from social dynamics, not from utility function engineering.

3. **LLMs as sociological simulacra**: Validates that LLM agents can reproduce complex social phenomena (fashion cycles, status hierarchies, subculture formation) from micro-level interactions, making Concordia a viable "computational social science" platform.

4. **Three-way contribution**: New theory (appropriateness-based status), new methodology (generative agent societies for preference formation), new open-source framework.

5. **Implications for agent system design**: If preferences are endogenous and socially constructed, multi-agent systems will develop emergent status hierarchies, in-group/out-group dynamics, and mimetic desire patterns that designers must account for.

## Connections to Portfolio

- **DD#277 (CMAG)**: Direct counterpart — CMAG studies how to GOVERN influence in agent populations; this paper studies how influence NATURALLY CREATES status hierarchies. Together they define the manipulation-emergence spectrum.
- **DD#237 (LLM Social Simulation)**: Both use LLM agents for social science, but this goes further by demonstrating emergent preference change (not just behavioral variation).
- **DD#251 (Concordia Framework)**: Built directly on Concordia — validates the platform for studying economic/sociological phenomena.
- **DD#196 (Emergent Social Norms)**: Both study norm emergence, but this paper focuses specifically on consumption norms and status signaling with economic mechanisms.
- **Grand Unified Synthesis**: Strengthens the Emergent Behavior pillar — preferences, status hierarchies, and cultural conventions emerge from agent interaction without explicit programming.

## Key Insight
**Status is socially constructed through observation and imitation, not from fixed preferences or cost structures.** When LLM agents interact socially, they spontaneously develop status hierarchies, conspicuous consumption patterns, and Veblen effects — even for synthetic goods with no pretraining bias. This has profound implications for multi-agent system design: any system with social observation will develop emergent status dynamics, whether designers intend it or not. The theory of appropriateness (predictive pattern completion) provides a more powerful explanatory framework than rational utility maximization for understanding agent social behavior.

## Limitations
- Concordia agents are LLM-based; unclear how well results transfer to humans or non-LLM agents
- 5-day simulation window is short for studying long-term fashion cycles and signal decay
- No adversarial stress testing (what happens with deliberate manipulation?)
- Limited to consumption and signaling; doesn't test status competition dynamics
- LLMs may have systematic biases toward status-seeking behavior from training data (even with synthetic goods, the "status concept" is from pretraining)
