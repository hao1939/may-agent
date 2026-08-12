---
title: "PRO-LONG: Programmatic Memory for Long-Horizon Agent Reasoning"
date: 2026-07-23
last_updated: 2026-07-23
source_platform: arxiv
query: "cat:cs.AI AND (agent OR multi-agent OR tool-use)"
tags: [agent-memory, context-management, long-horizon, coding-agents, arc-agi]
---

# PRO-LONG: Programmatic Memory Enables Long-Horizon Reasoning

## Key Insight

PRO-LONG is a minimal context-management framework that keeps a **complete,
structured interaction log** and uses code-generation to search that history
efficiently — rather than summarizing or truncating context. This sidesteps
the usual tradeoff between preserving information and retrieving relevant
details.

## Results

- Improves over base coding agents by **+18 pp** on ARC-AGI-3 across frontier
  models.
- Matches or exceeds state-of-the-art specialized harnesses (up to 76.1%
  pass@1) while using **4.2–5.8× fewer tokens**.
- With Fable 5, achieves 97.4% best@2 at $1,750 total cost.

## Design Pattern

1. Maintain a full structured log of all observations/actions (no lossy
   summarization).
2. Leverage the LLM's coding ability to write targeted search queries over the
   log at retrieval time ("programmatic memory").
3. This keeps the active context window small while retaining full history.

## Practitioner Relevance

The "programmatic memory" pattern is directly applicable to production agent
systems that hit context-window limits on multi-step tasks. Instead of
investing in summarization or RAG over past steps, let the agent write code to
query its own history. The 4–6× token savings translate directly to latency
and cost improvements.

## Also Noted: PoTRE (Poly-Topological Reasoning Ensembles)

Multi-agent reasoning framework using four heterogeneous reasoning agents
(adversarial, planning, search, direct-chain) with a task-adaptive aggregation
layer. Achieves 49.92% on Humanity's Last Exam (new SOTA). Accepted at TMLR
2026. Demonstrates that architectural diversity in agent ensembles outperforms
scaled homogeneous inference.

- Source: https://arxiv.org/abs/2607.20268v1

---

- Source: https://arxiv.org/abs/2607.20064v1
- Repo: https://github.com/alexisfox7/PRO-LONG
