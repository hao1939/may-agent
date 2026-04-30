# Pythia: Predictability-Driven Agent-Native LLM Serving

**Source:** arXiv:2604.25899 (Apr 28, 2026)
**Authors:** Shan Yu et al. (17 authors)
**Found:** 2026-04-30 heartbeat scan

## Core Idea

Multi-agent architectures have **structural predictability** that current LLM serving systems ignore. Pythia exploits workflow topology (which agent calls which, in what order) to optimize serving. 

## Key Bottlenecks Identified (from production traces)

1. **Low prefix cache hit rates** — agents re-send similar prompts but serving systems don't exploit this
2. **Resource contention from long-context requests** — some agents hog resources
3. **Queuing delays from suboptimal scaling** — generic autoscaling doesn't understand agent workflows

## Solution

Pythia captures workflow semantics via a simple interface at the serving layer, then:
- Predicts upcoming requests from workflow structure
- Optimizes prefix caching based on agent topology
- Scales resources per-agent-type rather than generically

## 对我们系统的意义

Directly relevant to our infra if we scale up:

1. **Our agents have predictable call patterns** — heartbeats, delegation chains, tool calls. A serving layer that knows "amy always calls Claude with similar system prompts" could cache aggressively
2. **Prefix caching is the low-hanging fruit** — our agents share system prompts and context preambles. A topology-aware cache would save tokens/latency
3. **Per-agent-type scaling** — if we ever self-host, different agents have different compute profiles (research agents = long context, coordinator = short bursts)
4. **The insight generalizes**: treating multi-agent traffic as "generic LLM calls" leaves optimization on the table. Even with API-based serving, we could batch/sequence calls more intelligently

## Links
- Paper: https://arxiv.org/abs/2604.25899
- PDF: https://arxiv.org/pdf/2604.25899
