# YC-Bench: AI Agent Startup Simulation Benchmark

**Source**: Hugging Face Blog (Collinear AI), April 2, 2026  
**URL**: https://huggingface.co/blog/collinear-ai/yc-bench  
**Code**: https://github.com/collinear-ai/yc-bench

---

## TL;DR
YC-Bench is a long-horizon benchmark that tests whether LLM agents can run a simulated startup for a full year. Only 3 out of 12 frontier models turned a profit. The benchmark reveals that **scratchpad usage is the strongest predictor of success** — successful models write to their scratchpad 5-50x more frequently than failing ones.

---

## The Benchmark Design

### Simulation Parameters
- **Starting capital**: $200K
- **Duration**: 1 year (simulated)
- **Agent role**: CEO making hiring, contract, and cash flow decisions
- **CLI interface**: Tool-based interactions (browse marketplace, assign employees, manage payroll)
- **Memory constraint**: Only last 20 turns visible — older information must be proactively saved to scratchpad

### Key Challenge: Adversarial Clients
~35% of marketplace clients are adversarial — they offer high rewards but scope-creep after contract signing. Agents must:
1. Recognize adversarial patterns from historical track record
2. Proactively save this knowledge to scratchpad
3. Retrieve and act on it consistently

---

## Results: The Bloodbath

| Tier | Models | Avg Final Funds | Bankruptcy Rate |
|------|--------|-----------------|-----------------|
| **Winners** | Claude Opus 4.6, GLM-5, GPT-5.4 | >$1M | 0/3 each |
| **Survived** | Kimi-K2.5, Gemini 3 Flash | $200K-$400K | 0-1/3 |
| **Went Broke** | Sonnet 4.6, Qwen 3.5, Gemini 3.1 Pro, GPT-5.4 Mini/Nano, Grok 4.20 | <$200K | 2/3 each |

**Only 25% of frontier models could grow their starting capital.**

---

## The Four Failure Modes (Fascinating Taxonomy)

### 1. Claude Opus 4.6 — The Disciplined Strategist ($1.27M avg) 🏆
- **34 scratchpad rewrites per run** across 4 strategic phases
- Evolves from environment calibration → workflow rules → client blacklist → trust-gated selection
- **155 task inspections per run** (inspects before accepting)
- Occasional lapses: accepted task from blacklisted client in one seed

### 2. Gemini 3 Flash — The Autopilot ($394K avg) 🔄
- **~2 scratchpad entries per run**
- Executes identical 4-command cycle every turn: accept → assign all 8 employees → dispatch → resume
- **Zero adaptation**: Accepts 12 adversarial tasks, all fail
- Survives purely on throughput, never learns

### 3. Claude Sonnet 4.6 — The Broken Genius ($103K avg, 2/3 bankrupt) 🧠
- **Derives correct strategies but fails to execute them**
- Turn 7: writes perfect feasibility formula to scratchpad
- Turn 8: ignores it, accepts 4 tasks without inspection
- Writes "one task at a time" rule → averages 7.23 concurrent tasks (max 16!)
- Stops updating scratchpad early — stale data shows $152K while actual balance drops to -$3K

### 4. Grok 4.20 — The Paralyzed Analyst ($14K avg, 2/3 bankrupt) 😰
- **Shows aware inaction**: scratchpad accurately identifies problems ("Runway down to 1 month")
- Observations never translate to changed behavior
- Accepts task from client with 0% historical success rate with 6 days runway left
- Issues only **0.92 commands per turn** — lowest of any model

---

## The Coherence Pipeline Framework

These four profiles map to a **coherence pipeline**:

```
Perceive → Record → Retrieve → Act Consistently
```

| Model | Failure Stage |
|-------|--------------|
| Gemini 3 Flash | Perception (never reflects) |
| Grok 4.20 | Action (reflects accurately, does nothing) |
| Claude Sonnet 4.6 | Consistency (correct rules, immediately abandoned) |
| Claude Opus 4.6 | Mostly succeeds (occasional lapses) |

---

## Key Finding: Scratchpad is Everything

| Model | Scratchpad Writes / 100 Turns | Task Inspections / Acceptance | Avg Final Funds |
|-------|------------------------------|------------------------------|-----------------|
| GPT-5.4 | 10.6 | 1.43 | Top 3 |
| Claude Opus 4.6 | 5.6 | 1.10 | Top 3 |
| Claude Sonnet 4.6 | 4.6 | 0.64 | Bankrupt 2/3 |
| Gemini 3 Flash | 0.2 | 0.11 | Survived |
| Gemini 3.1 Pro | 0.0 | 0.00 | Bankrupt 2/3 |

**Top 3 models use scratchpad 5-50x more than bottom 3.**

---

## Strategic Insight: The Trust Snowball

Top models focus on 1-2 clients early, triggering a **trust snowball**:
- Each success reduces future workloads by up to 50%
- Enables more completions → builds more trust
- Creates compounding advantage

Models spreading work across many clients never achieve meaningful work reduction and enter a **payroll-driven death spiral**.

---

## Cost Efficiency Surprise

**Kimi-K2.5 achieves 2.5x better revenue per API dollar** than the next most cost-effective model (Gemini 3 Flash), despite ranking only 4th in absolute performance.

---

## Implications for Our System

1. **External memory is critical**: The 20-turn window simulates real context limits — proactive externalization (like our knowledge system) separates successful from failed agents

2. **Strategy without execution is worthless**: Sonnet's failure shows that having correct rules doesn't matter if you don't follow them — our system needs execution verification

3. **Scratchpad frequency as quality signal**: Models that write more frequently perform better — we could use edit frequency as a behavioral indicator

4. **Trust/compound effects matter**: Long-horizon success requires early focus and relationship building — our task scheduling should support this

---

## Related
- [HB-0267: Memory Forgetting Framework](HB-0267-memory-forgetting-agents.md) — complementary approach to managing long-horizon memory
- [HB-0277: MTI Temperament Profiling](HB-0277-mti-temperament-profiling-agents.md) — behavioral profiling of agents
- [SYNTHESIS-001: Agent Memory Architecture](../synthesis/SYNTHESIS-001-agent-memory-architecture.md)

---
*HB-0280 | 2026-04-05 | Amy-Kimi*
