# OpenAI Agents SDK: Production-Ready Agent Framework

**Source**: OpenAI Official Documentation (openai.github.io/openai-agents-python/)  
**Date**: April 2025  
**Researcher**: Amy-Kimi

## Summary

OpenAI released the **Agents SDK**, a production-ready upgrade from their previous experimentation framework "Swarm". It's designed as a lightweight, Python-first package with minimal abstractions for building agentic AI applications.

## Core Primitives

The SDK has a very small set of primitives:

1. **Agents** - LLMs equipped with instructions and tools
2. **Agents as tools / Handoffs** - Allow agents to delegate to other agents for specific tasks
3. **Guardrails** - Enable validation of agent inputs and outputs

## Key Features

| Feature | Description |
|---------|-------------|
| **Agent Loop** | Built-in loop handling tool invocation, result feedback to LLM, continuation until completion |
| **Python-First** | Use native Python features for orchestration; no new abstractions to learn |
| **Handoffs** | Powerful mechanism for coordinating and delegating across multiple agents |
| **Guardrails** | Parallel input validation and safety checks with fast-fail |
| **Function Tools** | Turn any Python function into a tool with automatic schema generation (Pydantic) |
| **MCP Integration** | Built-in MCP server tool integration working same as function tools |
| **Sessions** | Persistent memory layer for maintaining working context |
| **Human-in-the-Loop** | Built-in mechanisms for human involvement across agent runs |
| **Tracing** | Built-in visualization, debugging, monitoring; supports OpenAI eval/fine-tuning |
| **Realtime Agents** | Voice agents with gpt-realtime-1.5, auto interruption detection |

## Design Principles

1. **Enough features to be worth using, but few enough primitives to make it quick to learn**
2. **Works great out of the box, but you can customize exactly what happens**

## Installation

```bash
pip install openai-agents
```

## Hello World Example

```python
from agents import Agent, Runner

agent = Agent(name="Assistant", instructions="You are a helpful assistant")
result = Runner.run_sync(agent, "Write a haiku about recursion in programming.")
print(result.final_output)
```

## Implications for Our System

- **Handoffs vs Manager patterns**: The SDK provides clear guidance on choosing between handoff-style and manager-style orchestration
- **MCP as first-class**: MCP integration being built-in validates our direction on protocol-based tool integration
- **Guardrails pattern**: The parallel validation approach could enhance our task validation layer
- **Tracing as core**: Built-in observability suggests this should be a first-class concern, not an afterthought
- **Python-native**: Our Python-heavy stack aligns well with this philosophy

## Related Resources

- [Documentation](https://openai.github.io/openai-agents-python/)
- [GitHub](https://github.com/openai/openai-agents-python)
- Swarm (predecessor): https://github.com/openai/swarm
