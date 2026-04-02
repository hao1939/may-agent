# Deep Dive: Measuring AI Agents' Progress on Multi-Step Cyber Attack Scenarios

**Paper**: arXiv:2603.11214  
**Authors**: Folkerts, Payne, Inman, Giavridis, Skinner, Deverett, Aung, Zorer, Schmatz, Ghanem, Wilkinson, Steer, Hong, Wang  
**Affiliation**: UK AI Safety Institute (AISI)  
**Date**: 2026-03-11  
**Rating**: ★★★★★ Critical — Most rigorous longitudinal measurement of autonomous AI cyber attack capability to date  
**Relevance**: Directly relevant to agent security architecture, capability forecasting, and defensive design

---

## TL;DR
UK AISI evaluates 7 frontier models (Aug 2024–Feb 2026) on two purpose-built cyber ranges: a 32-step corporate network attack and 7-step industrial control system attack. **Two compounding trends**: (1) performance scales log-linearly with inference-time compute (no plateau at 100M tokens), and (2) each model generation outperforms predecessors at fixed budgets. Best run: Opus 4.6 completed 22/32 steps (~6 of 14 estimated human-expert hours) for ~$80.

---

## Core Architecture & Methodology

### Cyber Ranges (Not CTFs)
The key innovation is using **full network simulation environments** rather than isolated CTF challenges:

1. **"The Last Ones" (32 steps, 9 milestones)**: Corporate network attack requiring exfiltration from protected internal database. Progresses through: reconnaissance → web exploitation → credential theft → lateral movement → privilege escalation → reverse engineering → C2 exploitation → supply chain compromise → data exfiltration. Estimated 14 hours for human expert.

2. **"Cooling Tower" (7 steps)**: Industrial control system attack on simulated power plant cooling tower. Requires HMI exploitation → protocol reverse engineering → cryptographic analysis → PLC manipulation. Estimated 15 hours for human expert. Steps are much larger units of work than "The Last Ones."

### Agent Design
- **Minimal scaffolding**: Standard ReAct agent on Kali Linux
- **Tools**: Bash, Python, Mythic C2 framework
- **Context compaction**: At 80% context window capacity, conversation summarized by same model and fresh window started
- **Evaluated using**: UK AISI's Inspect AI framework
- **No active defenders**: Alerts recorded but don't impede agent

### Models Tested (7 models, 18 months)
GPT-4o (Aug 2024), Sonnet 3.7 (Feb 2025), Sonnet 4.5 (Sep 2025), Opus 4.5 (Nov 2025), 5.1 Codex (Nov 2025), 5.3 Codex (Feb 2026), Opus 4.6 (Feb 2026)

---

## Key Findings

### Finding 1: Log-Linear Scaling with Inference-Time Compute
- Performance increases as **logarithmic function of total tokens**, with **no observed plateau** up to 100M tokens
- 10M → 100M tokens yields gains of up to **59%**
- Models were still executing goal-directed commands when token limits hit (not stalling/looping)
- **Critically**: Scaling requires NO technical sophistication — anyone can increase token budgets

### Finding 2: Generational Improvement (The Scary Trend)
At 10M tokens on "The Last Ones":
| Model | Release | Avg Steps | Max Steps |
|-------|---------|-----------|-----------|
| GPT-4o | Aug 2024 | 1.7 | 3 |
| Sonnet 3.7 | Feb 2025 | 5.8 | 8 |
| Sonnet 4.5 | Sep 2025 | 6.1 | 8 |
| 5.1 Codex | Nov 2025 | 8.0 | 13 |
| Opus 4.5 | Nov 2025 | 7.6 | 9 |
| 5.3 Codex | Feb 2026 | 7.2 | 8 |
| **Opus 4.6** | **Feb 2026** | **9.8** | **11** |

At 100M tokens:
| Model | Avg Steps | Max Steps |
|-------|-----------|-----------|
| Sonnet 4.5 | 9.4 | 11 |
| 5.1 Codex | 9.8 | 11 |
| Opus 4.5 | 11.0 | 11 |
| 5.3 Codex | 11.0 | 11 |
| **Opus 4.6** | **15.6** | **22** |

**Opus 4.5 → 4.6 in just 2 months**: 42% improvement at 100M tokens. Best run jumped from ~1.5 to ~6 estimated human hours.

### Finding 3: Two Capability Dimensions
1. **Token efficiency**: How quickly a model makes progress per token (Opus 4.6 reaches milestone 2 in ~2M tokens vs 10M for others)
2. **Narrow capability depth**: Whether the model possesses specialist skills for hard steps (GPT-4o plateaus after step 2 regardless of compute)

### Finding 4: Key Bottlenecks
Three principal bottlenecks in the corporate range:
1. **NTLM relay attacks** (milestones 4–5): Require real-time process coordination, intercepting Windows auth credentials
2. **CI/CD pipeline exploitation** (milestones 7–8): Long chains of credential discovery, build config manipulation, backdoor deployment
3. **Sharp performance drop** after milestone 4: transition from web exploitation to specialist skills (reverse engineering, cryptography, malware development)

### Finding 5: ICS Range Still Hard
- Most models complete **zero steps** at 10M tokens on Cooling Tower
- Best: Opus 4.6 averages 1.4/7 steps at 100M tokens
- BUT models found **unintended paths**: directly probed proprietary PLC protocols from network traffic, bypassing intended web exploitation path
- One model **exploited an unintended software bug** in PLC implementation via brute-force session ID fuzzing — without understanding the mechanism ("magic sub-function code")

### Finding 6: Auxiliary Experiments
- **Better prompting doesn't help much**: 2 extra sentences of guidance = no significant uplift
- **Example traces don't help**: Prefilling conversation with partial attack chain = no improvement
- **Tool failure mitigations**: Longer system prompts reduced errors but increased per-message tokens, netting zero gain
- **Behavioral analysis**: Unused credentials correlate negatively with progress; unique services discovered correlate positively
- **Human-AI teaming**: Mid-range starts show models can complete steps they never reach in end-to-end runs — human intervention at key bottlenecks would be highly effective

---

## Critical Analysis

### Strengths
1. **Longitudinal design**: 7 models over 18 months provides genuine trend data, not snapshot
2. **Multi-step realism**: 32-step sequential chains vs. isolated CTFs — huge methodological advance
3. **Compute scaling measurement**: Systematic variation of token budgets reveals scaling law
4. **Honest limitations**: Authors acknowledge both over-estimation (no active defense) and under-estimation (minimal scaffolding, capped token budgets) factors
5. **Government backing**: AISI credibility + HMG support = institutional weight

### Weaknesses
1. **N=5 at 100M tokens**: Very small sample sizes for most capable configurations. High variance (Opus 4.6: avg 15.6, max 22, presumably min much lower)
2. **No active defense**: All results measure capability against static targets. Real-world has EDR, SIEM, SOC teams
3. **No human baseline measurement**: "14 hours for human expert" is estimated, not empirically measured
4. **Context compaction quality unmeasured**: Using the evaluated model for its own compaction introduces confound — better models may compact better

### Missing
- No cost-effectiveness analysis vs. human pentesters
- No comparison to specialized fine-tuned models (only general frontier models)
- No measurement of how scaffolding improvements would affect results

---

## Implications for Our System

### Defensive Design
1. **Assume log-linear scaling continues**: If compute gets cheaper and models get better, autonomous attacks on multi-step chains will keep improving. Our agent system needs defense-in-depth.
2. **Bottleneck points matter**: The NTLM relay and CI/CD pipeline bottlenecks suggest that **requiring heterogeneous, real-time coordination** is still a meaningful defense barrier
3. **ICS/specialized domains still protected**: Proprietary protocols and specialized knowledge remain significant barriers — but the "unintended path" finding (protocol probing) shows models find alternative attack surfaces

### Agent Architecture Lessons
1. **Context compaction is critical infrastructure**: Enables 100M+ token runs. Our agents use compaction too — this paper validates its importance
2. **Token efficiency > raw capability**: The "token efficiency" dimension maps directly to cost-effectiveness of our own agents
3. **Minimal scaffolding baseline**: Paper uses standard ReAct — performance with custom scaffolding would be higher, suggesting our domain-specific agent designs have significant capability uplift potential

### Security Posture
1. **$80 for 6 hours of expert-equivalent work**: Cost threshold for AI-augmented attacks is already very low
2. **No sophistication required**: The scaling trend requires zero attacker skill — just bigger token budgets
3. **Human-AI teaming is the near-term threat**: Full autonomy not needed; human steering at bottlenecks + AI execution = force multiplier NOW

---

## Cross-References
- **AgenticCyOps (2603.09134)**: Our earlier deep-dive on enterprise MAS security framework — this paper provides the *empirical evidence* for why those defenses matter
- **RewardHackingAgents (2603.11337)**: Evaluator integrity paper — relevant as cyber eval integrity matters too
- **MAMA (2602.04431)**: Safe agentic design — the security constraints it proposes are validated by this threat data
- **AISI Inference Scaling blog**: Referenced in paper, extends their earlier finding to multi-step chains

---

## Key Quotes
> "Model performance scales log-linearly with inference-time compute, with no observed plateau"

> "Increasing from 10M to 100M tokens yields gains of up to 59%, requiring no specific technical sophistication from the operator"

> "The best single run completed 22 of 32 steps, corresponding to roughly 6 of the estimated 14 hours a human expert would need"

> "The most operationally relevant threat model may not be a fully autonomous AI agent, but a human operator using an AI agent to accelerate and scale attack operations"

> "[The model] did not understand the mechanism it had exploited, attributing its success to a 'magic sub-function code'"

---

**Scout Assessment**: This is the most important cybersecurity-relevant paper in our research corpus. It provides hard empirical evidence for two trends that compound: better models + more compute = better attacks, with no plateau in sight. The $80 price point for expert-level work and zero-skill-requirement scaling should inform our system's security architecture immediately.

**Filed**: 2026-03-14  
**Word count**: ~1,500  
