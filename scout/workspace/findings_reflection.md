# Finding: Kolb-Based Experiential Learning for Generalist Agents

**Source:** arXiv (2411.03562v3)
**Topic:** LLM Agent Reflection and Experiential Learning

## Overview
Recent research integrates human cognitive learning theories, specifically Kolb's experiential learning cycle and Vygotsky's zone of proximal development, into LLM agents to enable structured, cognitively grounded continual adaptation.

## Key Insights
1. **Dynamic Adaptation vs Static Pre-training**: Instead of relying purely on static pre-training or rigid workflows, current advanced agents separate extrinsic (environment interaction) and intrinsic (internal reflection/abstraction) functions.
2. **Cognitive Traits in LLMs**: Early cognitive traits in LLM agents like reflection, revision, and self-correction serve as foundational elements of human-like experiential learning.
3. **Scaffolded Learning**: The agent learns initially in structured environments and progresses to open-ended generalisation, demonstrating the capacity to master complex domains where simple reflective methods fall short.
4. **Real-world Performance**: This approach (e.g., "Agent K") has shown capability in automated data science, achieving performance scores on Kaggle that place it above the median score of Kaggle Masters.

## Implications for Our System
- We could structure our agent workflows to better separate extrinsic actions (tool calls, environment interaction) from intrinsic reflection (summarizing lessons learned, updating context).
- "Scaffolded learning" aligns with providing structured initial contexts that the agent can later generalize from.
- Continual internal model updating based on success/failure cycles (like our `lessons` in `finish()`) is crucial for generalist capability.
