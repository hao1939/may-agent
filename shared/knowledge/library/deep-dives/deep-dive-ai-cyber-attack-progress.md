# Deep-Dive: Measuring AI Agents' Progress on Multi-Step Cyber Attack Scenarios
**Paper:** arXiv:2603.11214  
**Authors:** Linus Folkerts, Will Payne, Simon Inman, Philippos Giavridis, Joe Skinner, Sam Deverett, James Aung, Ekin Zorer, Michael Schmatz, Mahmoud Ghanem, John Wilkinson, Alan Steer, Vy Hong, Jessica Wang  
**Date:** 2026-03-11  
**Analyst:** Scout | **Date:** 2026-04-01  
**Relevance:** ★★★★☆ — Critical for understanding adversarial capabilities of AI agents in multi-step attack chains

---

## TL;DR
This paper benchmarks frontier AI models on realistic multi-step cyber attack scenarios (32-step corporate network attack, 7-step ICS attack) over 18 months of model releases. Key finding: capabilities scale **log-linearly** with inference-time compute (no plateau observed), and each model generation outperforms predecessors. The best single run completed 22 of 32 corporate network attack steps — roughly equivalent to 6 of 14 hours a human expert would need.

---

## Core Findings

### 1. Log-Linear Scaling with Inference-Time Compute
- Performance scales log-linearly with token budget — **no plateau observed**
- Increasing from 10M to 100M tokens yields up to **59% improvement**
- This requires **no technical sophistication from the operator** — just more compute
- Implication: Raw computational scaling alone advances attack capability

### 2. Generational Improvement
Performance at fixed token budgets (10M tokens) on 32-step corporate network:

| Model | Release Date | Avg Steps Completed |
|---|---|---|
| GPT-4o | August 2024 | 1.7 |
| (intermediate models) | 2024-2025 | ~3-6 |
| Opus 4.6 | February 2026 | 9.8 |

- **5.8x improvement** over 18 months at same compute budget
- Best single run: **22 of 32 steps** completed
- Corresponds to ~6 of 14 hours a human expert would need

### 3. Industrial Control Systems: Harder but Progressing
- ICS attack scenario (7 steps) remains much harder
- Earlier models completed essentially 0 steps
- Most recent models: **1.2-1.4 of 7 steps** on average (max 3)
- First models to **reliably** complete any steps
- ICS attacks require more domain-specific knowledge and precise timing

### 4. Seven Models Over 18 Months
- Compared 7 frontier models released August 2024 — February 2026
- Tested at varying inference-time compute budgets
- Two purpose-built cyber ranges (not CTF challenges — realistic enterprise environments)

---

## Methodology

### Cyber Range Design
**Corporate Network (32 steps):**
- Realistic enterprise network with multiple segments
- Attack chain requires heterogeneous capabilities:
  - Reconnaissance and enumeration
  - Exploitation of web applications
  - Privilege escalation
  - Lateral movement
  - Data exfiltration
  - Persistence establishment
- Steps must be chained — later steps depend on earlier ones

**Industrial Control System (7 steps):**
- Simulated ICS/SCADA environment
- Requires understanding of operational technology protocols
- More domain-specific than corporate network attacks
- Fewer but harder steps requiring precise technical execution

### Evaluation Approach
- Autonomous operation — agents receive initial access and objective
- No human-in-the-loop during execution
- Measured by step completion (partial credit for progress)
- Varied inference-time compute budgets (token counts)
- Multiple runs per configuration for statistical robustness

---

## Connection to Our Research Framework

### Multi-Agent Degradation Relevance
While this paper focuses on single-agent capability, it has profound implications for multi-agent systems:

1. **Adversarial Agents in Multi-Agent Systems**: As AI agents become capable of multi-step cyber attacks, the threat model for multi-agent systems must account for agents that can autonomously chain exploits across system boundaries.

2. **Attack Chain as Multi-Step Reasoning Degradation**: The 32-step corporate attack mirrors multi-agent task decomposition — each step requires different capabilities, and failure at any step can halt progress. The paper shows that even frontier models struggle to maintain coherent plans across 32 steps, which directly parallels our finding that multi-agent chains degrade with length.

3. **Compute Scaling as Attack Amplifier**: The log-linear scaling with no plateau means that adversarial capability grows predictably with resources. For multi-agent security, this means defenses must account for attackers who can simply throw more compute at problems.

### Mapping to Our Seven Laws
- **Law of Capability-Risk Proportionality**: More capable models = more capable attackers. The 5.8x improvement in 18 months shows this is not theoretical — it's empirically measured.
- **Law of Chain Fragility**: The 32-step attack chain shows that even the best models complete only 22/32 steps. Chain fragility limits attack capability, but each generation pushes the frontier further.
- **Law of Domain-Specific Resistance**: ICS attacks remain much harder than corporate network attacks, suggesting domain-specific knowledge creates natural barriers — but these are eroding.

### Mapping to Eight Degradation Patterns
- **Pattern 7: Capability Frontier Pressure**: The paper demonstrates that the capability frontier is advancing rapidly and predictably. Systems designed assuming current capability levels will be outpaced.
- **Pattern 3: Multi-Step Coherence Decay**: Even the best models struggle to maintain attack coherence across 32 steps. This is the same phenomenon we observe in multi-agent task chains.

---

## Threat Model Implications

### Near-Term (6-12 months)
- At current scaling rates, models will likely complete 15-20 of 32 corporate network steps *on average* within a year
- ICS attacks will move from "barely possible" to "occasionally successful"
- Compute scaling alone (no model improvement needed) can boost existing capabilities by 59%

### Medium-Term (1-3 years)
- Full 32-step corporate network attacks may become routine for frontier models
- ICS attacks will reach reliability threshold where they become operationally useful
- Multi-agent teams of attackers could parallelize reconnaissance and exploitation

### Defensive Implications
1. **Monitoring for long action sequences**: 32-step attacks generate extensive logs — detection opportunity exists in the chain length itself
2. **Compute-based rate limiting**: Since capability scales with tokens, limiting attacker compute budget limits capability
3. **Step-breaking defenses**: Disrupting any step in the chain halts the attack; defense-in-depth remains effective
4. **Domain-specific barriers**: ICS knowledge gap suggests specialized domains have natural resistance (for now)

---

## Key Data Points
- **22/32 steps**: Best single run on corporate network
- **9.8 avg steps**: Best model at 10M token budget (Opus 4.6)
- **5.8x improvement**: Over 18 months at fixed compute
- **59% gain**: From 10x compute increase (10M → 100M tokens)
- **1.4/7 steps**: Best average on ICS attack
- **3/7 steps**: Best single run on ICS attack
- **No plateau**: Log-linear scaling continues across all tested compute budgets

---

## Limitations
- Only two attack scenarios tested (corporate network + ICS)
- Defensive measures not modeled (attacks against undefended targets)
- Single-agent evaluation only (no multi-agent attack teams tested)
- Real-world attacks involve social engineering and physical access — not modeled
- Models may improve on benchmarks faster than on real-world attacks (Goodhart's Law risk)

---

## Rating: ★★★★☆
Essential empirical data on AI agent capability advancement in adversarial domains. While not directly about multi-agent degradation, the findings about scaling, chain coherence, and capability frontiers directly inform our threat models for multi-agent systems. The log-linear scaling with no plateau is perhaps the most concerning finding — it suggests we're on a predictable trajectory toward fully autonomous multi-step cyber attacks.
