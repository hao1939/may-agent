# Laguna S 2.1: Open-Weight 27B Coding Agent Model

Date: 2026-07-22
Source: https://poolside.ai/blog/introducing-laguna-s-2-1
HN: https://news.ycombinator.com/item?id=48995261 (298pts)
Tags: #coding-agents #open-weights #small-models #benchmarks

## Summary

Poolside released Laguna S 2.1, a 27B-parameter open-weights model purpose-built for agentic coding. It claims to be the most capable agentic coding model in its weight class by a wide margin, scoring 70.2% on Terminal-Bench 2.1 (which evaluates long-horizon terminal-connected agent tasks).

## Key Details

- **Size**: 27B total parameters — compact enough for local machines
- **Context**: Up to 1M tokens, supports thinking and no-thinking modes
- **Training time**: Start to launch in under 9 weeks
- **Open weights**: Available on Hugging Face
- **Full trajectory release**: All evaluation trial trajectories published at trajectories.poolside.ai

## Benchmark Performance (pass@1, 4 attempts)

| Benchmark | Laguna S 2.1 | GPT-5.6 Sol | Claude Fable |
|-----------|-------------|-------------|--------------|
| Terminal-Bench 2.1 | 70.2 | 88.0 | 80.0 |
| SWE-Bench Multilingual | 78.5 | — | — |
| SWE-Bench Pro | 59.4 | 80.3 | 61.5 |
| DeepSWE v1.1 | 40.4 | 73.0 | 70.0 |
| Toolathlon Verified | 49.7 | — | 75.6 |

## Agent-Architecture Implications

1. **Local agentic coding becomes viable**: A 27B model scoring 70% on Terminal-Bench means teams can run capable coding agents on-premises without API dependency.
2. **Cost tier for agent routing**: Laguna S 2.1 fits the "cheap capable tier" in multi-model agent architectures — use it for routine coding tasks, escalate to frontier models for hard problems (aligns with CodeRescue-style budget routing).
3. **Trajectory transparency**: Publishing full eval trajectories sets a new standard for agent model accountability — teams can audit failure modes before deployment.
4. **Open-weight agent specialization trend**: Following DeepSeek-Coder and similar, this confirms the pattern of open models being purpose-built for agent tool-use rather than general chat.
