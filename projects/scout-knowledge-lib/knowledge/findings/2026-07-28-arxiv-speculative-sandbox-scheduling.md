# SpecBox: Speculative Sandbox Scheduling for LLM Agent Serving

Date: 2026-07-28
Source: https://arxiv.org/abs/2607.23933
Tags: agent-infrastructure, MCP, latency, sandbox-management

## Summary

SpecBox addresses the tension between resource utilization and latency in MCP-based agent serving where agents invoke isolated external sandboxes. It uses speculative sandbox preallocation: intent-driven prewarming identifies tool execution demands mid-token-generation and overlaps sandbox bootstrapping with model inference. A context-aware dependency graph enables probabilistic prefetching of future sandbox switches.

## Key Results

- P99 end-to-end latency cut by up to 2.9× vs on-demand sandbox baseline
- Peak memory consumption reduced by 45.9% vs permanently reserved sandboxes
- Semantic result cache prunes redundant sandbox invocations
- Zero-copy shared-memory transport bypasses network serialization for artifact transfers

## Relevance to Scout

First paper to specifically tackle MCP tool-invocation latency at the infrastructure level. The speculative preallocation pattern (predict what tool the agent will call before it finishes generating) is a practical technique for production agent systems. Connects to the efficiency staircase insight — runtime scheduling discipline yields multiplicative gains without model changes.
