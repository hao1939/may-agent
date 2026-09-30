<ai_context>
summary: "AA-AgentPerf-Local benchmarks local model-serving speed by replaying fixed recorded agent trajectories with growing full conversations and controlled output lengths. Its useful contribution is to isolate inference capacity from agent quality while preserving agent-shaped context growth, cache behavior, prefill, and decode costs; results remain configuration-specific and do not measure task correctness or multi-agent concurrency."
triggers: ["local agent inference", "agent trajectory replay", "AA-AgentPerf-Local", "agentperf-local", "local LLM benchmark", "prefill latency", "agent serving capacity", "inference benchmark"]
last_updated: "2026-09-30"
source_basis: "Full Artificial Analysis launch article and static inspection of the aa-agentperf-local README at commit 0e1c95ab295ed5f783898129ef63a9f207924a30, surfaced by Hacker News item 49906656. Scout did not execute the package or reproduce the published hardware results."
</ai_context>

# Replay agent-shaped trajectories to benchmark local inference, not agent quality

**Date:** 2026-09-30  
**Disposition:** New knowledge  
**Source:** https://artificialanalysis.ai/articles/aa-agentperf-local  
**Repo:** https://github.com/ArtificialAnalysis/aa-agentperf-local/tree/0e1c95ab295ed5f783898129ef63a9f207924a30  
**HN:** https://news.ycombinator.com/item?id=49906656

## Observation

Artificial Analysis released **AA-AgentPerf-Local**, an Apache-2.0 tool for measuring how quickly a local OpenAI-compatible model server can replay recorded agent conversations. Its useful distinction is explicit: it measures serving speed, not output quality. The default workload contains eight recorded tasks and 168 model turns. Each request includes the complete conversation so far, producing agent-shaped context growth to roughly 56–58K tokens rather than repeating short independent prompts.

The comparable `exact` policy forces each turn to generate its recorded number of tokens. This holds generated work constant across systems and prevents an early stop from masquerading as faster serving. A full run requires a 65,536-token context; reduced-context and synthetic smoke-test runs are marked non-comparable. The tool records per-turn evidence and writes the summary last, so a crashed run lacks a headline summary rather than looking complete.

Tool execution is skipped by default to isolate inference. Optional modes can replay recorded tool delays or execute recorded shell commands in containers, but live execution introduces a different trust and comparability boundary. The README warns that recorded commands are untrusted, Docker access is commonly root-equivalent, and a replay can request network access unless the operator forces it off.

## What the launch results suggest

The launch article reports 14 serving configurations across four systems and four 4-bit models. All successful featured configurations used speculative decoding, and the runtime, quantization, and speculative-decoding method materially affected results. The reported patterns are therefore about complete serving configurations, not hardware or model names in isolation.

On the fixed default replay:

- the GeForce RTX 5090 was fastest for every model that fit in 32 GB, reportedly more than 3.5× faster than the other tested systems in end-to-end completion time;
- the DGX Spark was reportedly 1.4–1.7× faster than the Ryzen AI Halo on three of four models despite only a small memory-bandwidth difference, which the authors attribute partly to prefill compute and CUDA software maturity;
- even with 73–93% of prompt tokens served from KV cache, prefill consumed a material share of completion time; for Qwen3.8-27B the article reports 22–41%; and
- when a tool returned a large file, reading the new context reportedly delayed the next response by roughly 24 seconds on the Halo and 39 seconds on the tested MacBook, versus about 2 seconds on the RTX 5090.

The transferable signal is not the temporary hardware ranking. Agent-serving capacity depends on the interaction among context growth, cache reuse, new-input prefill, decode bandwidth, quantization, speculative decoding, and memory capacity. A short-prompt tokens-per-second figure hides several of those costs.

## Reusable evaluation pattern

A local-agent capacity check should preserve four separate layers:

1. **Workload identity:** pin the replay manifest and retain the ordered, growing conversation rather than substituting isolated prompts.
2. **Output policy:** hold generated token counts constant for comparable latency, and label normalized or early-stopping runs separately.
3. **Serving configuration:** record model revision, quantization, runtime, context limit, cache policy, and speculative-decoding setup.
4. **Outcome boundary:** report inference latency and throughput without implying task correctness, tool correctness, or end-to-end agent reliability.

This complements the broader [measurement-control-plane pattern](./2026-09-17-agent-performance-harness-measurement.md): deterministic measurement can make a speed comparison auditable, but it does not expand what the benchmark measures. For deployment decisions, pair this replay with a separate quality evaluation and with a workload model for concurrency and ordinary co-running processes.

## Evidence limits

- Scout read the full launch article and the repository README pinned at commit `0e1c95ab295ed5f783898129ef63a9f207924a30`; Scout did not run the tool, inspect every implementation path, or reproduce any result.
- The benchmark and article are produced by the same organization. The published figures are author-reported, not independent validation.
- The launch focuses on one agent using the whole system. It does not establish multi-agent throughput, interference with ordinary applications, or production tail behavior.
- Skipping tools isolates inference but excludes a potentially dominant part of end-to-end latency. Live-tool mode changes both security exposure and reproducibility.
- Featured configurations are tuned and all use speculative decoding. Results should not be generalized to untuned defaults, other model revisions, or future runtime versions.
- The HN item had 1 point and no comments when inspected, so HN supplied discovery rather than community corroboration.

## Sources

- Artificial Analysis, “AA-AgentPerf-Local: Benchmarking local AI agents on laptops and workstations” (2026-09-29): https://artificialanalysis.ai/articles/aa-agentperf-local
- ArtificialAnalysis/aa-agentperf-local README at pinned revision: https://github.com/ArtificialAnalysis/aa-agentperf-local/blob/0e1c95ab295ed5f783898129ef63a9f207924a30/README.md
- Hacker News item 49906656: https://news.ycombinator.com/item?id=49906656
