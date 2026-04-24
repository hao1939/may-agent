# MetaGPT - Multi-Agent Software Development Framework

**Source**: GitHub (FoundationAgents/MetaGPT)  
**Stars**: 67.4k  
**Forks**: 8.6k  
**Origin**: 🇨🇳 China  
**Date Found**: 2026-04-24

## TL;DR

MetaGPT is a multi-agent framework that simulates a software company. It takes a one-line requirement and outputs user stories, competitive analysis, requirements, data structures, APIs, and documents. The core philosophy: `Code = SOP(Team)`

## Key Innovation

### Software Company as Multi-Agent System

MetaGPT implements a complete software development workflow with specialized roles:

| Role | Responsibility |
|------|----------------|
| Product Manager | Requirements, user stories |
| Architect | System design, data structures |
| Project Manager | Task breakdown, scheduling |
| Engineer | Implementation |
| QA Engineer | Testing |

### Core Philosophy

> "Code = SOP(Team)"

MetaGPT materializes Standard Operating Procedures (SOPs) and applies them to teams composed of LLMs. This is different from other frameworks that focus on free-form collaboration.

## Recent Developments

- **MGX (MetaGPT X)**: Natural language programming product launched Feb 2025
- **ProductHunt #1**: MGX was #1 Product of the Day (Mar 4) and Week (Mar 10, 2025)
- **AFlow Paper**: Accepted for oral presentation at ICLR 2025 (top 1.8%, ranked #2 in LLM-based Agent category)
- **SPO/AOT Papers**: New research directions introduced Feb 2025

## Research Papers

1. **AFlow**: Automating Agentic Workflow Generation (ICLR 2025 Oral)
2. **SPO**: Self-Referential Optimization
3. **AOT**: Agent-Oriented Training

## Multi-Agent Patterns

MetaGPT uses structured workflows:
1. **SOP-Driven**: Each agent follows defined procedures
2. **Role-Based**: Clear responsibilities per agent
3. **Output-Standardized**: Consistent deliverables between stages

## Relevance to Our System

### Similarities
- Both use multi-agent architectures
- Both have specialized agents for different tasks
- Both emphasize structured workflows

### Differences
| Aspect | MetaGPT | Our System |
|--------|---------|------------|
| Domain | Software development | General agent system |
| Approach | SOP-driven, rigid | Event-driven, flexible |
| Roles | Fixed (PM, Architect, etc.) | Dynamic (coach, scout, etc.) |
| Output | Code, docs | Actions, decisions |

## Actionable Insights

1. **SOP Pattern**: Could we benefit from more explicit procedures for our agents?
2. **Role Specialization**: MetaGPT's clear role definitions could inspire our agent boundaries
3. **AFlow Research**: Their automated workflow generation could inform our dispatcher
4. **Evaluation**: ICLR oral presentation validates multi-agent approach

## Links

- GitHub: https://github.com/FoundationAgents/MetaGPT
- Website: https://mgx.dev/
- Twitter: https://twitter.com/MetaGPT_
- Discord: https://discord.gg/DYn29wFk9z
