# YC-Bench: Long-Horizon Agent Coherence Benchmark

**Source:** Hugging Face Blog (April 2, 2026)  
**Original:** https://huggingface.co/blog/collinear-ai/yc-bench  
**Repo:** https://github.com/collinear-ai/yc-bench

## TL;DR
YC-Bench simulates a full year of startup operations to test AI agents' long-term coherence. Only **3 out of 12 frontier models** turned a profit. The key differentiator? **Scratchpad usage** — top models wrote to memory 5-50x more frequently than failing ones.

## The Benchmark Design

**Scenario:** Agent acts as CEO of a startup with $200K initial capital, 1 year to survive.

**Core Mechanics:**
- Browse marketplace for contracts
- Assign employees (partially hidden skill profiles)
- Manage cash flow vs growing payroll
- Build client relationships for better deals
- **~35% of clients are adversarial** — lure with high rewards, then 3x scope after signing

**The Memory Challenge:**
- Conversation history truncated to last 20 turns
- Must proactively write to persistent scratchpad
- Tests: recognize → save → retrieve → act on information

## Results: The Bloodbath

| Tier | Models | Avg Final Funds | Bankruptcies |
|------|--------|-----------------|--------------|
| **Winners** | Claude Opus 4.6, GLM-5, GPT-5.4 | > $1M | 0/3 each |
| **Survived** | Kimi-K2.5, Gemini 3 Flash | $200K-$400K | 0-1/3 |
| **Went Broke** | Sonnet 4.6, Qwen 3.5, Gemini 3.1 Pro, GPT-5.4 Mini/Nano, Grok 4.20 | < $200K | 2/3 each |

## Four Failure Modes (Coherence Pipeline)

### 1. Claude Opus 4.6 — The Disciplined Strategist ($1.27M avg) 🏆
- Rewrites scratchpad **34 times per run**
- Evolves through 4 strategic phases
- Inspects every task before accepting (155 inspections/run)
- **Succeeds at:** perceive → record → retrieve → act consistently

### 2. Gemini 3 Flash — The Autopilot ($394K avg) 🔄
- Only **~2 scratchpad entries per run**
- Same 4-command cycle every turn: accept → assign all → dispatch → resume
- **Fails at perception** — never reflects, survives purely on throughput

### 3. Claude Sonnet 4.6 — The Broken Genius ($103K avg, 2/3 bankrupt) 🧠
- Derives **correct strategies but fails execution**
- Writes perfect feasibility formula at Turn 7, ignores it at Turn 8
- Writes "one task at a time" rule, averages **7.23 concurrent tasks** (max 16!)
- **Fails at consistency** — correct rules, immediately abandoned

### 4. Grok 4.20 — The Paralyzed Analyst ($14K avg, 2/3 bankrupt) 😰
- Accurately identifies problems in scratchpad
- **Aware inaction** — observations never translate to behavior change
- Only **0.92 commands per turn** (lowest) — thinks but doesn't act
- **Fails at action** — reflects accurately, does nothing

## Key Finding: Scratchpad is Everything

| Model | Scratchpad Writes / 100 Turns | Task Inspections / Acceptance | Result |
|-------|------------------------------|-------------------------------|--------|
| GPT-5.4 | 10.6 | 1.43 | Top 3 |
| Claude Opus 4.6 | 5.6 | 1.10 | Top 3 |
| Claude Sonnet 4.6 | 4.6 | 0.64 | Bankrupt 2/3 |
| Gemini 3 Flash | 0.2 | 0.11 | Survived |
| Gemini 3.1 Pro | 0.0 | 0.00 | Bankrupt 2/3 |

**Top models use scratchpad 5-50x more** than bottom models.

## Strategic Insight: Trust Snowball

Top models focus on 1-2 clients early → success reduces future workloads by up to 50% → more completions → more trust → **virtuous cycle**.

Models spreading work across many clients never achieve work reduction → enter **payroll-driven death spiral**.

## Cost Efficiency Twist

Best performer ≠ most cost-efficient:
- **Kimi-K2.5:** 2.5x better revenue per API dollar than next best
- **Claude Opus 4.6:** ~$86/run vs Kimi's ~$1.79
- For production: "good enough" at 1/50th cost may be right call

## Implications for Our System

1. **Long-horizon coherence is distinct from reasoning** — models scoring similarly on standard benchmarks diverge wildly here

2. **Reasoning-execution gap is real** — models can derive correct strategies but fail to execute (Sonnet case)

3. **Adversarial robustness needs memory** — 47% of bankruptcies from adversarial clients; requires learning from sparse, delayed signals

4. **Memory architecture is critical** — the 20-turn truncation forces explicit memory management; passive context insufficient

## Related Resources

- **Paper:** Vending-Bench (arXiv:2504.15498) — precursor with immediate feedback loops
- **SimLab:** https://github.com/collinear-ai/simlab — training environment for long-horizon capabilities

---
*Collected: 2026-04-05*  
*Relevance: High — directly tests memory and coordination patterns relevant to multi-agent systems*
