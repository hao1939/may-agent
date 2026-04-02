# Deep-Dive: WideSeek-R1 — Width Scaling via Multi-Agent Reinforcement Learning

**Paper**: arXiv:2602.04634v3 (Feb 4, 2026; revised Mar 12, 2026)
**Authors**: Zelai Xu, Zhexuan Xu, Ruize Zhang, Chunyang Zhu, Shi Yu, Weilin Liu, Quanlu Zhang, Wenbo Ding, Chao Yu, Yu Wang (Tsinghua, Microsoft Research Asia)
**Resources**: [Project Page](https://wideseek-r1.github.io/) | [Code](https://github.com/RLinf/RLinf/tree/main/examples/agent/wideseek_r1) | [Model (HF)](https://huggingface.co/RLinf/WideSeek-R1-4b) | [Dataset (HF)](https://huggingface.co/datasets/RLinf/WideSeek-R1-train-data) | [Docs](https://rlinf.readthedocs.io/en/latest/rst_source/examples/agentic/wideseek_r1/index.html)
**Scout Assessment**: ★★★★★ Critical — First rigorous empirical demonstration that trained multi-agent "width scaling" matches single-agent "depth scaling" at 170× fewer parameters per agent.

---

## 1. Core Thesis

**Depth scaling** = one agent doing more sequential reasoning turns (longer CoT, more tool calls).
**Width scaling** = a lead agent spawning parallel subagents, each handling independent subtasks.

WideSeek-R1 shows these are complementary dimensions: depth scaling plateaus quickly on broad tasks, while width scaling continues to improve as you add more parallel subagents — **but only if the system is end-to-end trained via MARL**.

## 2. Architecture

### Lead-Agent / Subagent Hierarchy
- **Shared LLM**: Both lead agent and subagents use the same 4B parameter model (Qwen3-4B base)
- **Isolated contexts**: Each agent has its own context window — no cross-contamination
- **Specialized tools**:
  - Lead agent: only `call_subagent` (delegates subtasks with clear prompts)
  - Subagents: `search` (retrieves snippets/URLs) + `access` (summarizes URL content)
- **Parallel execution**: All subagents from a single turn run simultaneously
- **Multi-turn orchestration**: Lead agent can do up to 10 turns, spawning up to 10 subagents per turn; each subagent gets up to 20 turns

### Key Design Choice: Context Isolation
Single agents suffer from **context pollution** — irrelevant information from earlier subtasks degrades later performance. Width scaling naturally solves this because each subagent starts fresh.

## 3. MARL Training Method

### Extension of GRPO (Group Relative Policy Optimization)
- **Verifiable outcome reward**: Each rollout scored by consistency with ground truth (no reward model)
- **Group-normalized advantage**: A_hat = (R - μ) / σ across G rollouts per query
- **Same advantage for all agents in same rollout**: Avoids complex credit assignment that leads to reward hacking

### Dual-Level Advantage Reweighting (Novel Contribution)
1. **Token-level reweighting across turns**: Averages over all tokens across all turns per agent, so longer turns have proportionally more influence (prevents dilution from turn-level averaging)
2. **Agent-level reweighting**: Averages over agents per rollout, preventing rollouts with many subagents from dominating gradient. This **discourages lead agents from spawning excessive subagents** — more agents only help if they improve final reward.

### Training Details
- Base model: Qwen3-4B (thinking mode)
- Training data: Hybrid dataset — 50% broad info-seeking (constructed, 20k tasks) + 50% standard QA from ASearcher
- Search tools: Offline local knowledge base from Wiki2018 (for efficiency)
- Cost: ~3,000 H100 GPU hours
- Rollout dominates training time (90%+ of step time)

## 4. Training Data Construction Pipeline

Fully automated 3-stage pipeline (no human annotation):

1. **Query Generation**: Extract user intents from HybridQA (Wikipedia-based), sample target row count 10–50, synthesize schema-constrained queries requiring tabular output
2. **Answer Generation**: Gemini-3-Pro generates two independent responses per query + identifies "unique column(s)" for row alignment
3. **QA Pair Filtering**: 
   - Cell-wise consistency check between two responses (threshold 0.9)
   - Complexity filter (discard tables < 3 rows)
   - Result: 20k high-quality broad info-seeking tasks

## 5. Results

### Main Results (WideSearch Benchmark — 200 tasks, EN + CN)

| Model | Item F1 (Avg@4) | Row F1 (Avg@4) | Success Rate |
|-------|---------|---------|-------------|
| **WideSeek-R1-4B** (multi-agent) | **40.0%** | **15.3%** | **0.4%** |
| DeepSeek-R1-671B (single agent) | 41.3% | 20.7% | 0.4% |
| SingleSeek-R1-4B (single agent) | 28.1% | 6.5% | 0.3% |
| Qwen3-4B (multi-agent, untrained) | 31.2% | 8.4% | 0.0% |
| AgentFlow-7B (multi-agent) | 28.7% | 9.0% | 0.4% |
| OWL-8B (multi-agent) | 20.2% | 3.1% | 0.0% |

**Headline result**: WideSeek-R1-4B ≈ DeepSeek-R1-671B on Item F1 with **170× fewer parameters per agent**.

### Width vs Depth Scaling Curves
- **Depth scaling (single agent)**: Saturates quickly — adding more turns provides diminishing returns after ~10 turns due to fixed context length
- **Width scaling (untrained)**: Initially improves with more subagents, then **declines** at 10 subagents (noise from conflicting responses overwhelms untrained lead agent)
- **Width scaling (WideSeek-R1)**: **Consistent monotonic improvement** up to 10 subagents — MARL training is what unlocks true width scaling

### Standard QA Benchmarks (7 benchmarks)
WideSeek-R1-4B achieves 59.0% average, beating:
- Multi-agent Qwen3-4B (+7.7%)
- SingleSeek-R1-4B (+2.0%)
- OWL-8B (+1.8%)
- MiroFlow-8B (+9.0%)

Shows MARL training doesn't sacrifice general reasoning for breadth.

## 6. Ablation Studies

### Role Ablation (Which component matters more?)
- Upgrading lead agent OR subagents each yields comparable Item F1 gains
- Upgrading subagents yields higher Row F1 and Success Rate (subagents directly interact with tools)
- Best performance requires BOTH trained — demonstrates synergy

### Data Ablation
- Wide-only data: Good at orchestration, weak at individual subtask solving
- Deep-only data (ASearcher): Good at subtask solving, weak at orchestration
- **Hybrid (50/50)**: Best on all metrics — wide and deep data are complementary

## 7. Limitations (Acknowledged by Authors)

1. **Only 4B tested**: Training cost is high (~3,000 H100 hours even for 4B)
2. **Coarse credit assignment**: Same reward for all agents — can't distinguish lead agent failures from subagent failures
3. **Static 2-layer hierarchy**: No recursive sub-sub-agents (destabilizes training)
4. **90% of training time is rollout**: Long-tail generation bottleneck with collocated RL

## 8. Implications for Our System

### Direct Architecture Relevance
- **Width scaling is real and trainable**: Validates our multi-agent architecture approach
- **Shared model + isolated contexts**: Exactly our design pattern — one LLM backing multiple agent roles
- **Context isolation prevents pollution**: Strong empirical evidence for our per-agent context boundaries

### Lessons for Implementation
1. **MARL training is key**: Untrained multi-agent systems plateau or degrade — width scaling only works with end-to-end training
2. **Agent-level reweighting**: Critical for preventing "spawn more agents" as a degenerate strategy
3. **Hybrid training data**: Breadth tasks (orchestration) + depth tasks (subtask execution) should be mixed
4. **Parallel execution essential**: Turn-taking (serial) multi-agent systems miss the core width advantage

### Potential Concerns
- 2-layer hierarchy may be a real constraint — our system may need deeper hierarchies for complex tasks
- Credit assignment remains unsolved — role-specific reward modeling is an open research frontier
- 170× parameter reduction is for broad info-seeking tasks specifically — may not generalize to all task types

### Connection to Other Research
- **SDec-POMDP** (2603.11802): Theoretical framework for exactly this kind of hierarchical coordination
- **SSGM** (2603.11768): Governance middleware could complement WideSeek-R1's static hierarchy
- **OpenMOSS**: Self-organizing approach vs. WideSeek-R1's trained-hierarchical approach — different philosophies for same problem
- **Price of Decentralization** (2603.11884): Theoretical bounds on when centralized (depth) vs. decentralized (width) is better

## 9. Key Takeaway

Width scaling (parallel multi-agent) is a complementary and independently valuable dimension to depth scaling (sequential single-agent). A trained 4B-parameter multi-agent system can match a 671B single agent on broad tasks. But the key insight is that **untrained width scaling doesn't work** — you need end-to-end MARL to teach the lead agent scalable orchestration and the subagents effective parallel execution. This is the strongest empirical evidence yet that multi-agent systems aren't just an engineering convenience — they're a genuinely superior architecture for broad tasks when properly trained.

---
*Analysis by Scout | Session s_1773407284095_600 | 2026-03-13*
