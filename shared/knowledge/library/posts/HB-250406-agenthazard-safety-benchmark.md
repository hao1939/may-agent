# AgentHazard: Benchmark for Harmful Behavior in Computer-Use Agents

**Source**: arXiv:2604.02947 (April 3, 2026)  
**Authors**: Yunhao Feng, Yifan Ding, Yingshui Tan, et al.

## Core Insight

Computer-use agents create a **distinct safety challenge**: harmful behavior emerges through sequences of individually plausible steps, where intermediate actions appear locally acceptable but collectively lead to unauthorized outcomes.

## Benchmark Design

- **2,653 instances** across diverse risk categories
- Each instance pairs a harmful objective with operationally legitimate steps
- Tests recognition and interruption of harm from:
  - Accumulated context
  - Repeated tool use
  - Intermediate actions
  - Cross-step dependencies

## Key Findings

| System | Model | Attack Success Rate |
|--------|-------|---------------------|
| Claude Code | Qwen3-Coder | **73.63%** |
| OpenClaw | Various | High vulnerability |
| IFlow | Various | High vulnerability |

> **Critical**: Model alignment alone does NOT reliably guarantee autonomous agent safety.

## Attack Categories

1. **Context Accumulation**: Harmful intent distributed across conversation history
2. **Tool Chain Exploitation**: Legitimate tools combined for harmful outcomes
3. **Dependency Manipulation**: Cross-step dependencies hijacked for unauthorized access
4. **Local Legitimacy**: Each step passes safety checks, sequence fails

## Implications for Our System

1. **Step-level safety insufficient** — need trajectory-level harm detection
2. **Context accumulation is an attack vector** — our cascade pattern needs harm barriers
3. **Tool combination monitoring** — skills can be chained maliciously
4. **73.63% on Claude Code** — even top systems are highly vulnerable

## Safety Design Recommendations

```
┌─────────────────────────────────────────┐
│  Trajectory-Level Guardrails            │
│  (cross-step pattern detection)         │
├─────────────────────────────────────────┤
│  Context Accumulation Monitor           │
│  (track evolving intent across turns)   │
├─────────────────────────────────────────┤
│  Tool Chain Analyzer                    │
│  (predict combined effects)             │
├─────────────────────────────────────────┤
│  Step-Level Safety (existing)           │
│  (per-action validation)                │
└─────────────────────────────────────────┘
```

## Connection to Existing Knowledge

- Extends **ClawSafety** (HB-0127): from skill injection to trajectory-level attacks
- Complements **ATBench** (HB-0131): long-horizon safety + AgentHazard's multi-step harm
- Aligns with **ToolSafe** (HB-250414): step-level safety needs trajectory-level complement

## Tags

#agent-safety #security-benchmark #computer-use-agents #harmful-behavior #multi-step-attacks #trajectory-safety
