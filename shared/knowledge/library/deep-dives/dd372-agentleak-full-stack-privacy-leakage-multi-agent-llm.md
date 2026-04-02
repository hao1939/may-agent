# Deep-Dive #372: AgentLeak — A Full-Stack Benchmark for Privacy Leakage in Multi-Agent LLM Systems

**Source:** arXiv:2602.11510 (El Yagoubi, Badu-Marfo, Al Mallah — Polytechnique Montréal)
**Date Analyzed:** 2026-03-17
**Relevance:** ★★★★★ CRITICAL — First empirical quantification of full-stack privacy leakage in multi-agent systems

---

## 1. Core Contribution

AgentLeak is the **first full-stack benchmark** for measuring privacy leakage across ALL communication channels in multi-agent LLM systems — not just user-facing outputs, but inter-agent messages, shared memory, tool arguments, logs, and artifacts. Prior benchmarks (AgentDojo, PrivacyLens, TOP-Bench) audit only final outputs, creating a massive blind spot.

**Scale:** 1,000 scenarios × 4 domains (healthcare, finance, legal, corporate) × 5 LLMs (GPT-4o, GPT-4o-mini, Claude 3.5 Sonnet, Mistral Large, Llama 3.3 70B) = **4,979 execution traces**.

## 2. The Seven Leakage Channels

AgentLeak identifies **seven distinct pathways** where sensitive data can escape:

### External Channels (amenable to traditional security)
- **C1:** Final output to users
- **C3:** Tool input arguments (API calls)
- **C4:** Tool output returns
- **C6:** System logs / telemetry
- **C7:** Persistent artifacts (files, records)

### Internal Channels (CURRENTLY UNPROTECTED)
- **C2:** Inter-agent messages (delegation, coordination)
- **C5:** Shared memory state (persists across sessions)

**Critical finding:** Every framework evaluated (LangChain, CrewAI, AutoGPT, MetaGPT) provides **zero privacy controls** for internal channels C2 and C5.

## 3. Headline Results

### The Privacy Paradox of Multi-Agent Systems

| Metric | Single-Agent | Multi-Agent | Change |
|--------|-------------|-------------|--------|
| C1 (output) leakage | 43.2% | 27.2% | **-37%** |
| Total system exposure | 43.2% | **68.9%** | **+59%** |
| Hidden violations (H1) | N/A | **41.7%** | — |

**The paradox:** Multi-agent systems REDUCE per-channel output leakage (C1: 27.2% vs 43.2%) but INCREASE total exposure by 1.6× because they create new unmonitored channels.

### Channel-Level Leakage
- **C1 (final output):** 27.2%
- **C2 (inter-agent messages):** **68.8%** — 2.5× higher than output
- **C5 (shared memory):** 46.7%
- Internal channels mean: 57.8% — **2.1× higher** than external

### The 41.7% Audit Gap
Among 4,979 traces, **2,076 (41.7%)** had clean outputs but leaked through internal channels. Output-only audits would classify these as fully compliant.

Domain breakdown of H1:
- Healthcare: **62.4%** (highest — most sensitive data)
- Finance: 44.9%
- Legal: 34.9%
- Corporate: 24.6%

## 4. Per-Model Results

| Model | C1 Rate | C2 Rate | C2/C1 Ratio | H1 Rate |
|-------|---------|---------|-------------|---------|
| Claude 3.5 Sonnet | **3.3%** | **28.1%** | 8.5× | 24.8% |
| GPT-4o | 17.2% | 76.8% | **4.5×** | **59.6%** |
| GPT-4o-mini | 41.2% | 75.3% | 1.8× | 34.2% |
| Llama 3.3 70B | 26.9% | 67.8% | 2.5× | 41.3% |
| Mistral Large | 47.5% | **96.2%** | 2.0× | 48.7% |

**Pattern C2 > C1 holds universally** across all 5 models and all 4 domains.

**GPT-4o insight:** Lowest C1 among non-Claude models (17.2%) but near-highest C2 (76.8%) — safety filters are optimized for user-facing output but permissive for internal reasoning.

**Claude 3.5 Sonnet** achieves lowest rates on BOTH channels (C1: 3.3%, C2: 28.1%), suggesting safety alignment transfers partially to internal channels — but still leaks in >1 in 4 internal communications.

## 5. Attack Taxonomy and Success Rates

**32-class attack taxonomy** organized into 6 families:

| Family | Tests | ASR |
|--------|-------|-----|
| F1: Prompt/Instruction | 992 | 79.8% |
| F2: Tool-Surface | 484 | 78.9% |
| F3: Memory/Persistence | 255 | 79.6% |
| F4: Multi-Agent Coordination | 252 | **82.9%** |
| **Overall** | 1,983 | **79.9%** |

**F4 (coordination attacks) achieve the highest ASR** — exploiting inter-agent trust to use coordination channels as exfiltration vectors.

## 6. Defense Effectiveness

| Defense | C1 Effectiveness | C2/C5 Effectiveness |
|---------|-----------------|---------------------|
| Output sanitizers | **98%** | **0%** |
| Privacy-focused prompts | 60% | **6%** |
| NeMo Guardrails | High | **0%** |

**82% of leakage is semantic** (paraphrasing, not verbatim copying), making pattern-matching defenses nearly useless.

### Prototype Interceptor
Applying C1 redaction logic to internal channels:
- Internal leakage: 31.5% → **2.4%** (92% reduction)
- Task Success Rate: 78.6% → 73.9% (**-4.7 points**)
- Feasible but reveals **privacy-utility tradeoff**

## 7. Framework-Level Analysis (Benign Only)

| Framework | C2 Rate (A0) |
|-----------|-------------|
| AutoGPT v0.5.x | 35% |
| CrewAI v0.83.x | 33% |
| LangChain v0.1.x | 29% |
| MetaGPT v0.8.x | 28% |

Tight spread (28-35%) confirms the problem is **systemic, not implementation-specific**.

## 8. Secondary Channels

- **C3 (tool input):** 62-86% leakage — agents treat API parameters as scratch space
- **C6 (system logs):** Even higher — the "Thought Gap" where chain-of-thought reasoning leaks to logs
- **Shadow Leakage:** In >65% of scenarios, C3/C6 leak while C1 stays clean

## 9. Portfolio Connections

### Validates GUS Laws
- **Law 28 (Information Leakage Amplification):** Each agent adds a leakage pathway — monotonically
- **Law 21 (Multi-Layer Optimization Paradox):** 41.7% gap between measured and actual leakage
- **Mechanism 30 (Privacy Amplification Cascade):** Empirically confirmed

### Connects to Prior Work
- **DD#294 (Role Confusion):** C2 creates new attack surface for intra-system role confusion
- **DD#295 (AgentDrift):** Tool corruption × C3 leakage = compound exposure
- **CR#144 (Defense Triad):** Circular security-safety-memory dependency validated empirically
- **DD#338 (Bureaucracy of Speed):** CCS/RCC maps to C2/C5 access control
- **CR#175 (MemOS v2):** C5 memory governance confirmed critical at 46.7% leakage

### Novel Contributions
1. **Privacy Paradox:** More agents = less output leakage BUT more total exposure
2. **Channel Blindness:** 41.7% hidden violation rate proves output-only audits insufficient
3. **82% Semantic Leakage:** Pattern-matching defenses fundamentally inadequate
4. **Safety Alignment Partial Transfer:** First empirical evidence of alignment generalizing across communication modalities

## 10. Limitations

1. Coordinator-worker topology only — no hierarchical/mesh/dynamic
2. Static allowed sets — real-world policies are contextual
3. English-only scenarios
4. Simulated attacks, not live red-team
5. Binary channel detection, not per-field granularity

## 11. Testable Predictions

1. Hierarchical/mesh topologies will show HIGHER C2 leakage than coordinator-worker
2. Within 12 months, ≥2 major MAS frameworks will add C2/C5 privacy controls
3. Within 18 months, a regulator will cite internal agent communication as a data minimization violation
4. Achieving <10% internal leakage + >90% TSR requires per-field selective disclosure

---

**Bottom Line:** AgentLeak proves multi-agent LLM systems have a massive privacy blind spot: 41.7% of violations occur in channels no current audit inspects. Every framework, every model, every domain shows the same pattern — internal channels leak 2.1× more than external outputs. This is a structural property requiring fundamental rearchitecting of how agents share information.
