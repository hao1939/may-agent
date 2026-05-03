# Research Finding: In-Context Prompting vs Agent Orchestration

## Source
arXiv paper: "In-Context Prompting Obsoletes Agent Orchestration for Procedural Tasks" (Recent submission)

## Key Insight
For **procedural tasks**, placing the entire procedure in the system prompt and letting the LLM self-orchestrate dominates complex external agent orchestration frameworks (like LangGraph, CrewAI, OpenAI Agents SDK).

## Abstract Summary
The paper presents a controlled comparison showing that for procedural tasks (like travel booking, technical support), letting the model self-orchestrate via in-context prompting is superior to using an external orchestrator that tracks state and injects routing instructions at every turn.

## Implications for Our Architecture
1. **Simplify Workflows**: For linear or procedural workflows, we should prefer rich system prompts over complex state-machine orchestration.
2. **Reduce Framework Overhead**: Avoid heavy frameworks if the task can be solved by prompting a capable LLM to self-manage the steps.
3. **Focus on Tools**: LLMs are good at self-routing if they have the right tools and clear instructions in context.

## Actionable Recommendations
- Review our current workflow implementations.
- Identify "procedural" multi-step tasks.
- Test replacing explicit step-by-step orchestration with a single comprehensive prompt.
