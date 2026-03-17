# HB#1645: EvoScientist - Self-Evolving AI Scientist Framework

**Source**: XHS@Leo (1870赞/3215收藏/129评论)  
**GitHub**: https://github.com/EvoScientist/EvoScientist (448⭐/41 Forks)  
**Date**: 2026-03-16  
**Status**: 🔥🔥 High Value

## Overview

EvoScientist is a self-evolving multi-agent framework for "Vibe Research" - autonomously conducting the full scientific research lifecycle from literature review to paper writing.

## Core Architecture

### 1拖6 Multi-Agent Design
- **1 Main Agent**: Orchestrates overall research flow
- **6 Specialized Sub-agents**:
  - Planning (规划)
  - Retrieval (检索)
  - Coding (编码)
  - Debug (调试)
  - Analysis (分析)
  - Writing (写作)

### Skill System
- **318 independent research skills**
- **17 scientific domains** covered
- Modular skill installation (e.g., domain-specific skills)

### Self-Evolution Mechanism
```
Failure → Guardrails (避坑指南)
Breakthrough → Reusable Strategies (可复用策略)
Knowledge persists across sessions
```

## Key Claims

### ICAIS 2025 Results
- **6 papers** autonomously produced
- **100% acceptance rate** (conference avg ~30%)
- **Best Paper Award** 🏆
- **AI Reviewer's Appraisal Award** 🥇
- **#1 on DeepResearch Bench II**

## Multi-Platform Support
- CLI / TUI
- WeChat (微信)
- Feishu (飞书)
- Telegram
- Slack

## Design Philosophy

> "Human-on-the-loop paradigm, where AI acts as a research buddy that co-evolves with human researchers and internalizes scholarly taste and scientific judgment."

- AI handles the "execution loop"
- Humans focus on: **Intuition**, **Vision**, **Taste**
- Research shifts from "experimental labor" to "scientific品味"

## Technical Stack
- Built on **LangChain DeepAgents** framework
- Python-based (pyproject.toml, uv.lock)
- Apache 2.0 License

## Community Reception

### Questions Raised
- "Which conference is ICAIS?" (质疑声: "野鸡会议")
- Comparison to Andrej Karpathy's autoresearch
- Multi-agent vs single strong model with prompt switching

### Author Responses
- Claims papers are linked on GitHub
- Acknowledges framework was developed before public release
- Emphasizes multi-agent architecture for specialized expertise + context management

## OpenClaw Relevance

| EvoScientist | OpenClaw Mapping |
|--------------|------------------|
| 1 Main Agent + 6 Sub-agents | Main Agent ↔ Sub-agent hierarchy |
| Failure → Guardrails | Error Log as directional critique |
| Breakthrough → Skills | AGENTS.md skill accumulation |
| Cross-session knowledge persistence | Session-independent memory |
| Human-on-the-loop | Audit trail design |

## Tension Points

1. **Self-Evolution Claims**: Claims self-evolution but details unclear on how this differs from supervised refinement
2. **Academic Validation**: ICAIS conference legitimacy questioned by community
3. **Comparison to Single Model**: Open question whether multi-agent beats single strong model with good prompts

## Source Links
- XHS Post: https://www.xiaohongshu.com/explore/69b683540000000023023253
- GitHub: https://github.com/EvoScientist/EvoScientist

---
**Archive Date**: 2026-03-16  
**HB ID**: 1645
