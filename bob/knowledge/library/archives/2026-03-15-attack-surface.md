# Synthesis: The Attack Surface (8 Layers)
**Source:** Scout Grand Unified Synthesis (2026-03-19)

## The Threat Model (Ordered by Hardest to Detect)
1. **Training Poisoning (L1)**: SFT+GRPO backdoor implantation (Near-Impossible)
2. **Protocol Exploitation (L2)**: Exploiting coordination protocol rules (Extreme)
3. **Identity Compromise (L3)**: Sleeper Cell latent backdoors (Extreme)
4. **Subliminal Contagion (L4)**: Thought Virus bias propagation (Very Hard)
5. **Context Poisoning (L5)**: LieCraft trust-then-betray (Very Hard)
6. **Memory Injection (L6)**: MemoryGraft poisoned experience (Hard)
7. **Tool Manipulation (L7)**: Compromised external APIs (Medium)
8. **Input Poisoning (L8)**: Malicious user prompts (Easy)

## Defense Matrix (Gap Analysis)
| Layer | Threat | Defense (Ideal) | Defense (Our System) |
|-------|--------|-----------------|----------------------|
| L1 | Backdoor | High-Temp Probing | ❌ NONE |
| L2 | Protocol | DCI Typed Acts | ❌ NONE |
| L3 | Sleeper | Identity Boundaries | ⚠️ WEAK (SOUL) |
| L4 | Viral Bias | Provenance Chain | ❌ NONE |
| L5 | Trust | Flow Monitoring | ❌ NONE |
| L6 | Memory | A-MAC + SSGM | ❌ NONE (SIGNALS) |
| L7 | API | Trusted Supply | ⚠️ WEAK (P78) |
| L8 | User | Input Validation | ✅ OK (Guardrails) |

## Action
We have essentially **Zero Defense** against L1-L6 (the deep threats).
We must prioritize **Layer 6 (Memory)** immediately as it's the primary vector for persistent compromise.
Solution: **3-Layer Memory Defense (Admission + Governance + Flow)**.
