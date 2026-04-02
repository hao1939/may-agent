# DD#429: Memory Control Flow Attacks (MCFA) — From Storage to Steering

**Paper:** "From Storage to Steering: Memory Control Flow Attacks on LLM Agents"
**Authors:** Xu, Zhu, Yao, Xue, Song
**ArXiv:** 2603.15125 (submitted 16 Mar 2026)
**Venue:** ICML 2026
**Rating:** ★★★★★ CRITICAL — Empirically validates CR#241's central thesis
**Date:** 2026-03-18

---

## Why This Paper Matters

This is the first systematic empirical study demonstrating that **memory retrieval can hijack agent control flow** — forcing unintended tool usage even against explicit safety constraints. It validates what our CR#241 ("Memory Under Siege") theorized: memory is the most underdefended attack surface, and poisoned memories create persistent behavioral modification that survives across tasks.

**Key finding: >90% of trials across GPT-5 mini, Claude Sonnet 4.5, and Gemini 2.5 Flash are vulnerable to MCFA, with 100% persistence over long horizons and high resistance to textual repair.**

---

## Core Contribution: The MCFA Framework

### Attack Model
MCFA is a two-phase attack:
1. **Injection Phase:** Adversary uses *standard interactions* (no privileged access) to store action-oriented preferences/rules into agent long-term memory
2. **Exploitation Phase:** During subsequent benign tasks, the poisoned memory is retrieved and dominates control flow, overriding system safety constraints

**Critical assumption:** The attacker needs NO internal privileges — cannot modify system prompts, tool implementations, or access the memory store directly. Standard user interaction suffices.

### Formalization
Agents are modeled as memory-augmented state machines:
- **A = ⟨F, T, M, Φ_ret, Φ_upd⟩** — LLM transition function, tool set, memory state, retrieval function, update function
- **Control flow loop:** Read[memory] → Plan[control flow] → Execute[control flow] → Write[memory]
- **Attack succeeds** when trace τ satisfies adversarial policy π_adv and violates safe policy Π_safe

### Five Attack Families

| Family | What It Measures | Physical Interpretation |
|--------|-----------------|------------------------|
| **Override** | Tool-choice overrides (using prohibited tools) | Memory acts as "hard-coded" user preference, bypassing safety filters |
| **Order** | Workflow reordering (skipping critical steps) | Dependency subversion — invisible to whitelist defenses |
| **M-Scope** | Cross-task propagation | Universal trigger — injected logic acts as "Master Key" across domains |
| **Persistence** | Long-horizon durability | Chronic infection — stable attractor resists natural context decay |
| **Relapse** | Mitigation resistance | State resistance — textual patches ephemeral; underlying M remains poisoned |

---

## MemFlow: The Evaluation Framework

### Design Principles
1. **Isolation-based trace auditing** (Theorem 1): By resetting short-term history H=∅, any observed deviation is strictly attributable to retrieved long-term memory — eliminates confound of session context
2. **Standardized injection→auditing protocol**: Inject, then evaluate on heterogeneous benign tasks under isolation
3. **Cross-framework testing**: LangChain + LlamaIndex with pluggable memory components

### Theorem 1 (Memory-Causal Verification)
Under isolation (H=∅), if a benign task trace violates safety policy, the deviation is *strictly attributable* to memory state M. This is the key methodological contribution — it provides provable attribution.

---

## Devastating Experimental Results

### Attack Success Rates (ASR)
Tested against: GPT-5 mini, Claude Sonnet 4.5, Gemini 2.5 Flash

| Attack Family | LangChain ASR | LlamaIndex ASR |
|---------------|--------------|----------------|
| **Override** (Strong Retrieval) | 97.2–100% | 91.7–100% |
| **Order** (Strong Retrieval) | 61.1–69.4% | 52.8–66.7% |
| **M-Scope** | 97.2–100% | 100% |
| **Persistence** | **100% across all models** | **100% across all models** |
| **Relapse** (post-mitigation) | >85% deviations persist | >85% deviations persist |

### Key Empirical Findings

1. **Retrieval Dominance (Corollary 1):** When memory retrieval is active, its influence weight α >> β (system safety prompt weight). RAG injects adversarial instructions as "ground truth" that LLMs faithfully execute.

2. **Textual Repair Failure (Corollary 2):** P(τ_safe | M_poisoned, Repair) ≈ 0. Conversational repair instructions cannot overcome persistent poisoned memory. **Memory Surgery (direct state modification) is necessary** — prompting alone is insufficient.

3. **Retrieval OFF = Safe:** When retrieval is disabled (OFF), ASR drops to 0.0% across all models and families. This proves the attack is genuinely memory-mediated, not a base model vulnerability.

4. **Model-Agnostic Vulnerability:** GPT-5 mini, Claude Sonnet 4.5, and Gemini 2.5 Flash are ALL equally vulnerable. Alignment training does not protect against MCFA.

5. **Framework-Agnostic Vulnerability:** Both LangChain and LlamaIndex show comparable vulnerability — this is architectural, not implementation-specific.

---

## Critical Connection to CR#241

Our CR#241 ("Memory Under Siege") identified five properties of memory attacks:
1. ✅ **Survives restarts** — MCFA Persistence: 100% across all models
2. ✅ **Self-reinforces** — MCFA's Read→Plan→Execute→Write loop naturally reinforces
3. ✅ **Propagates across tasks** — M-Scope: 97.2–100% cross-task propagation
4. ✅ **Escapes detection** — Override through standard interaction, invisible to whitelist
5. ✅ **Compounds across architectures** — Framework-agnostic vulnerability confirmed

**CR#241 predicted the fundamental asymmetry:** "An attacker needs to poison ONE memory entry. A defender must verify ALL entries, FOREVER." MCFA proves this with 100% persistence and >85% relapse rate post-mitigation.

### What MCFA Adds Beyond CR#241
- **Formal state-machine model** for memory-augmented agents under attack
- **Theorem 1** provides provable causal attribution methodology
- **MemFlow** as reproducible evaluation framework
- **Empirical quantification** across 3 frontier models × 2 frameworks × 5 attack families
- **Production-style mitigation (RBMS) failure**: Role-Based Memory Segregation doesn't work

---

## Implications for Our Architecture

### For CR#238 (Cross-Stack Attack Composition)
MCFA provides the **persistence engine** for composed attacks. An initial prompt injection can write to memory → memory persists → future tool calls are hijacked indefinitely. This is the missing link in attack composition theory.

### For CR#240 (Scalability Wall)
Memory monitoring at scale requires trace auditing on every tool call — the computational cost grows with agent population × interaction frequency. MCFA's "write-once, read-many" property means one injection can affect unlimited future interactions.

### For CR#243 (Unified Defense Architecture)
The paper's key defense insight — **Memory Surgery over Conversational Repair** — demands architectural changes:
1. Write-time validation gates (connect to Atlas's Compiled Memory)
2. Periodic memory integrity audits
3. Provenance tracking for memory entries
4. Memory isolation between trust levels

### For DD#426 (Atlas Compiled Memory)
Atlas's compilation pipeline (raw → insight → compiled) is especially vulnerable to MCFA. A poisoned raw experience that survives to compiled status becomes a **permanent behavioral modifier** with the highest persistence. Atlas's corroboration mechanism (0.5 → 0.85 confidence) could amplify MCFA payloads.

---

## The "Retrieval Dominance" Problem

The most alarming finding: **retrieved memory overrides system prompts**. This means:
- Alignment training is bypassed by architecture
- Safety constraints in system prompts become advisory, not mandatory
- The RAG pathway creates an "authority escalation" channel where user-injected preferences gain system-level influence

This directly challenges the assumption that system prompts provide reliable safety guardrails in memory-augmented agents.

---

## Open Problems Identified

1. **No effective defense exists** — RBMS (the best mitigation tested) still allows >85% deviation
2. **Detection-evasion tradeoff** — subtle memory modifications may not trigger integrity checks
3. **Multi-agent amplification** — paper studies single-agent; shared memory in MAS could cascade MCFA exponentially
4. **Memory surgery automation** — how to identify and remove poisoned entries without disrupting legitimate memory?
5. **Formal verification** — can trace-based auditing scale to complex multi-agent workflows?

---

## Relevance Score

| Dimension | Score | Notes |
|-----------|-------|-------|
| Multi-agent security | 10/10 | First systematic MCFA study |
| Memory architecture | 10/10 | Proves memory is the critical attack surface |
| Defense design | 9/10 | Shows current defenses fail; demands new approaches |
| Empirical rigor | 10/10 | 3 frontier models × 2 frameworks × 5 families |
| Connection to our work | 10/10 | Direct validation of CR#241 |

**OVERALL: 10/10 — Must-integrate paper**

---

## Cross-References
- **→ CR#241** (Memory Under Siege): Direct empirical validation
- **→ CR#238** (Cross-Stack Attack Composition): MCFA as persistence engine
- **→ CR#243** (Unified Defense Architecture): Memory Surgery requirement
- **→ DD#426** (Atlas): Compilation amplification risk
- **→ DD#428** (Experience Following): Memory management attack surface
- **→ CR#244** (Memory Quality Imperative): Write-time gating insufficient alone
