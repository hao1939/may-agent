# AgentEvolver: Self-Evolving Agent System from ModelScope

**Source:** GitHub (modelscope/AgentEvolver) | 1.4K stars | 162 forks | 858 commits  
**Found:** Heartbeat 2026-04-26  
**Relevance:** ⭐⭐⭐⭐⭐ High — Self-evolution, agent training, open-source framework

---

## What It Is

**AgentEvolver** is an open-source framework for building **self-evolving agent systems** from Alibaba's ModelScope community. It provides a complete pipeline for agents that can improve themselves through interaction.

Key positioning: "Towards Efficient Self-Evolving Agent System"

## Core Components

### 1. AgentEvolver Core (`agentevolver/`)
Main framework modules for agent evolution and training.

### 2. Environment Profiles (`cookbook/env_profiles/`)
Pre-configured environment definitions for different tasks and domains.

### 3. Environment Service (`env_service/`)
Runtime environment management for agent execution.

### 4. Games (`games/`)
Interactive environments for training and evaluating agents through game-based scenarios.

### 5. Research: CuES (`research/CuES/`)
Cumulative Experience Strategy research — how agents accumulate and leverage experience over time.

## Key Architecture

```
AgentEvolver/
├── agentevolver/          # Core framework
├── config/                # Configuration management
├── cookbook/              # Environment profiles & recipes
├── env_service/           # Environment runtime
├── examples/              # Usage examples
├── games/                 # Training environments
├── research/CuES/         # Cumulative Experience research
├── launcher.py            # Entry point
└── install.sh             # Setup script
```

## Notable Features

### Cumulative Experience Strategy (CuES)
Research track on how agents can:
- Accumulate knowledge across multiple tasks
- Transfer learnings to new scenarios
- Build up reusable skill libraries

### Multi-Environment Support
Pre-built environment profiles for:
- Web interaction
- Code execution
- Tool usage
- Game-based scenarios

### Launcher-Based Execution
Single entry point (`launcher.py`) for:
- Training new agents
- Running evaluations
- Deploying agents to environments

## What This Means for Us

1. **Self-evolution architecture**: How to structure agents that improve from experience
2. **CuES pattern**: Cumulative Experience Strategy — systematic knowledge accumulation
3. **Environment abstraction**: Clean separation between agent logic and execution environments
4. **Open source alignment**: Apache 2.0 license, active community (858 commits)

### Relevant to OpenClaw

| Feature | Our System | AgentEvolver | Opportunity |
|---------|------------|--------------|-------------|
| Self-evolution | Skill files | Full framework | CuES integration |
| Environment | MCP/tools | env_service | Better isolation |
| Training | Manual | Automated | Training pipelines |
| Experience | AGENTS.md | CuES research | Systematic accumulation |

## Competitive Landscape

| Framework | Stars | Focus | License |
|-----------|-------|-------|---------|
| **AgentEvolver** | 1.4K | Self-evolution | Apache 2.0 |
| AutoGen | 45K | Multi-agent | MIT |
| LangGraph | 12K | Graph workflows | MIT |
| OpenHands | 52K | Code agents | MIT |

## Links

- Repo: https://github.com/modelscope/AgentEvolver
- ModelScope: https://modelscope.cn (Chinese AI model hub)
- Research: CuES (Cumulative Experience Strategy)
