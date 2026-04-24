# AgentScope - Alibaba's Multi-Agent Framework

**Source**: GitHub (agentscope-ai/agentscope)  
**Stars**: 24.3k  
**Origin**: 🇨🇳 China (Alibaba/ModelScope)  
**Date Found**: 2026-04-24

## TL;DR

AgentScope is a production-ready, easy-to-use multi-agent framework from Alibaba with built-in support for ReAct agents, tool use, memory, planning, real-time voice, evaluation, and model finetuning. It's designed for increasingly agentic LLMs.

## Key Features

### Core Capabilities
- **ReAct Agent**: Built-in with tool use and reasoning
- **Skills System**: Modular agent skills
- **Human-in-the-loop**: Steering capabilities
- **Memory**: Short-term and long-term memory
- **Planning**: Built-in planning capabilities
- **Real-time Voice**: Voice interaction support
- **Evaluation**: Built-in agent evaluation
- **Finetuning**: Support for model finetuning

### Multi-Agent Orchestration
- **Message Hub**: Flexible multi-agent messaging system
- **Workflows**: Support for debate, concurrent agents, routing, handoffs
- **MCP Support**: Model Context Protocol integration
- **A2A Support**: Agent-to-Agent protocol support

### Production Features
- **Deployment**: Local, serverless cloud, K8s
- **Observability**: OTel (OpenTelemetry) support
- **AgentScope Studio**: Visual management interface
- **RAG Support**: Retrieval-augmented generation

## Architecture Philosophy

> "We design for increasingly agentic LLMs. Our approach leverages the models' reasoning and tool use abilities rather than constraining them with strict prompts and opinionated orchestrations."

This is a key insight: instead of forcing LLMs into rigid workflows, AgentScope provides flexible abstractions that let increasingly capable models take more initiative.

## Documentation Structure

- Installation & Quick Start
- Core concepts (Message, Agent)
- Workflows (Conversation, Debate, Concurrent, Routing, Handoffs)
- Model & Context management
- Tool & Skill development
- Agent State & Session Management
- Pipeline, Plan, RAG
- Evaluation & Tuner

## Relevance to Our System

| Feature | Our System | AgentScope | Notes |
|---------|------------|------------|-------|
| Multi-agent | ✓ | ✓ | Both support multi-agent |
| Message Hub | Dispatcher | Message Hub | Similar pub/sub patterns |
| Memory | ✗ | ✓ | We lack explicit memory |
| Planning | ✗ | ✓ | We don't have planning layer |
| Human-in-loop | ✗ | ✓ | Missing from our system |
| A2A Protocol | ? | ✓ | We should evaluate |
| Studio UI | May's Agent | ✓ | Similar visualization |

## Actionable Insights

1. **Memory System**: We should consider adding explicit memory abstractions
2. **Planning Layer**: AgentScope's planning capabilities could inspire our roadmap
3. **A2A Protocol**: Worth investigating for interoperability
4. **Message Hub**: Our dispatcher pattern is similar - validate design choices

## Links

- GitHub: https://github.com/agentscope-ai/agentscope
- Docs: https://doc.agentscope.io/
- Paper: https://arxiv.org/abs/2402.14034
- PyPI: https://pypi.org/project/agentscope/
