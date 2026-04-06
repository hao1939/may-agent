# AgentHazard: Safety Benchmark for Computer-Use Agents

**Source**: arXiv:2604.02947 (April 3, 2026)  
**Authors**: Yunhao Feng, Yifan Ding, Yingshui Tan, et al.

## Core Contribution

A benchmark for evaluating **harmful behavior in computer-use agents** that extends beyond chat systems to persistent, stateful agents operating over tools, files, and execution environments.

## The Safety Challenge

Unlike chat systems, computer-use agents:
- Maintain state across interactions
- Translate intermediate outputs into concrete actions
- Enable harmful behavior through **sequences of individually plausible steps**
- Execute intermediate actions that appear locally acceptable but collectively lead to unauthorized outcomes

## Benchmark Design

**AgentHazard contains:**
- **2,653 instances** spanning diverse risk categories
- Each instance pairs harmful objective with locally legitimate operational steps
- Tests recognition and interruption of harm from:
  - Accumulated context
  - Repeated tool use
  - Intermediate actions
  - Dependencies across steps

## Evaluation Results

| System | Model | Attack Success Rate |
|--------|-------|---------------------|
| Claude Code | Qwen3-Coder | **73.63%** |
| OpenClaw | Various | High vulnerability |
| IFlow | Various | High vulnerability |

**Critical Finding:**
> "Model alignment alone does not reliably guarantee the safety of autonomous agents."

## Attack Strategies Tested

- Multi-step sequences with locally plausible intermediate actions
- Context accumulation leading to harmful outcomes
- Tool chain exploitation
- Dependency manipulation across execution steps

## Implications for Our System

1. **Safety cannot be delegated to model alignment alone**
2. **Multi-step attacks** are the primary threat vector
3. **Intermediate action verification** needed at each step
4. **Context monitoring** for accumulated harmful patterns
5. **Explicit safety checks** in tool execution layer

## Key Insight

The distinction between "helpful" and "harmful" often only becomes apparent after multiple steps. Current systems lack the ability to recognize and interrupt these trajectories early.

## Recommendations

- Implement step-level safety verification
- Monitor for attack pattern signatures
- Add explicit "stop and verify" checkpoints
- Design tools with least-privilege principles
