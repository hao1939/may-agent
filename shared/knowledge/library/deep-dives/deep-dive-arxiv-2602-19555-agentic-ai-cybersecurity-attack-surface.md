# Deep-Dive: arXiv:2602.19555 — Agentic AI as a Cybersecurity Attack Surface: Threats, Exploits, and Defenses in Runtime Supply Chains

**Paper:** arXiv:2602.19555
**Title:** Agentic AI as a Cybersecurity Attack Surface: Threats, Exploits, and Defenses in Runtime Supply Chains
**Authors:** Xiaochong Jiang, Shiqi Yang, Wenting Yang, Yichen Liu, Cheng Ji (Independent researchers; NEU/NYU/UCSD/UIUC affiliations)
**Date:** 2026-02-27
**Deep-Dive Date:** 2026-03-18
**Gap Target:** CR#237 Gap 4 — Memory Adversarial Robustness & Gap 5 — Attack Propagation in Multi-Agent Networks
**Rating:** ★★★★★ CRITICAL — Unified threat taxonomy for agentic runtime supply chains; introduces Viral Agent Loop concept

---

## 1. Core Contribution

This paper **systematizes security risks in agentic AI** within a unified runtime framework. Key novelties:

1. **Runtime Supply Chain** concept — distinguishes static (build-time) from dynamic (inference-time) supply chains
2. **Man-in-the-Environment (MitE)** threat model — adversary manipulates environmental artifacts, not infrastructure
3. **Viral Agent Loop** formalization — agents as self-propagating attack vectors in cyclic ecosystems
4. **Zero-Trust Runtime Architecture** — three architectural imperatives for securing agentic systems

This is a **systematization of knowledge (SoK)** paper, not an empirical paper. Its value is in the taxonomy and threat model unification.

---

## 2. Fundamental Paradigm Shift: Static → Dynamic Supply Chains

### Traditional Software Supply Chain
- Resolution at build/deploy time
- Dependencies: libraries, binaries
- Topology: Directed Acyclic Graph (DAG)
- Attack surface: code vulnerabilities
- Upstream source: verified vendor

### Agentic Runtime Supply Chain
- Resolution at inference/runtime
- Dependencies: data context, APIs, tools
- **Topology: Cyclic (feedback loops)**
- Attack surface: **semantic manipulation**
- Upstream source: runtime information sources

### Key Concept: Stochastic Dependency Resolution
Unlike traditional software where `import numpy` maps to a specific binary hash, agentic systems assemble their execution context at runtime through **probabilistic semantic decisions**. Retrieved documents, external APIs, and tools become implicit inference-time dependencies.

### Prompt-Data Isomorphism
The phenomenon where retrieved passive data (D) is **upcast into active instructions (I)** by the LLM's reasoning engine. This is the fundamental vulnerability that enables MitE attacks.

---

## 3. Data Supply Chain Attacks

### 3A. Within-Session Manipulation (Transient)

**Indirect Prompt Injection:**
- Malicious payload embedded in third-party data source
- Agent's tool (web browser, email API) fetches content and prepends to context
- Extends to multi-modal: adversarial perturbations in images/sounds decoded to text
- 98% success rate for human-imperceptible perturbations

**In-Context Learning Exploitation:**
- Many-Shot Jailbreaking: flood short-term memory with fictitious dialogues
- ASR follows power-law growth with shot count
- Effectively renders standard alignment filters obsolete within single session

### 3B. Across-Session Manipulation (Persistent) — KEY FOR GAP 4

**Knowledge Base Contamination (RAG poisoning):**
- Adversarial strings hijack vector space for broad query retrieval
- PoisonedRAG: **poisoning 0.1% of corpus → 70% ASR for targeted queries**
- AGENTPOISON: constrained optimization for stealthy backdoors, dormant until trigger → **80%+ ASR**
- GraphRAG vulnerable to relation-level poisoning (malicious edges for multi-hop reasoning)

**Long-Term Memory Poisoning:**
- LTM creates feedback loop: agent "poisons itself"
- **MINJA framework**: injects malicious records via queries only (no memory bank access needed)
  - Appends instruction-heavy "indication prompt" to benign query with "victim term"
  - **Average ASR: 76.8%**
- This is the most persistent attack — survives session boundaries, influences all future decisions

---

## 4. Tool Supply Chain Attacks (Three-Phase Model)

### Phase I: Discovery (Intent → Tool_ID)
**Hallucination Squatting:**
- Agents hallucinate plausible but non-existent tool identifiers
- Adversaries preemptively register these as malicious packages
- Hallucinated names are predictable and recur across models

**Semantic Masquerading:**
- Adversarially crafted metadata maximizes textual overlap with common queries
- Displaces legitimate tools in retrieval rankings
- Minor description perturbations significantly degrade selection accuracy

### Phase II: Implementation (Load Tool_ID → Runtime Code)
**Hidden Backdoors:**
- Tool implements advertised functionality + trigger-based malicious logic
- High apparent utility maintained while silently executing unintended actions

**Transitive Dependency Exploitation:**
- Tool setup triggers installation of auxiliary packages with arbitrary code execution
- Agents treat dependency installation as functional step, not security-sensitive operation

### Phase III: Invocation (Execute with Authority)
**Over-Privileged Invocation:**
- Broad permissions + long-lived credentials → confused-deputy failures
- Privilege escalation via natural-language communication channels
- Non-interactive, difficult to detect or reverse

**Argument Injection:**
- Correct tool, valid credentials, but adversarial parameter manipulation
- Analogous to SSRF — trusted intermediary relays attacker-controlled inputs
- Cross-Plugin Request Forgery (CPRF): injected content causes agents to generate malicious parameters

---

## 5. The Viral Agent Loop — THE CORE NOVELTY

### Definition
A recursive scenario where Agent_A processes payload P, induces side effect Δ via tool invocation, and Δ is later discovered and incorporated as input by Agent_B.

**Formal model:**
```
Invoke(Ag_A, P) --writes--> Δ_env AND Retrieve(Ag_B) ∋ Δ_env ⊇ P
```

### Why This Is Different
- Agent transforms from **passive victim** to **active carrier**
- Unlike isolated invocation failures, Viral Agent Loop introduces **temporal recursion**
- Unlike traditional malware (code execution vulnerabilities), agentic propagation exploits **instruction-following behavior under legitimate permissions**

### Propagation Vectors

**Generative Worms (Morris II):**
- Cohen et al.: adversarial prompts replicate across GenAI agents
- Email-processing agent receives poisoned input → exfiltrates context + propagates payload to downstream agents
- Mirrors 1988 Morris Worm but operates at **semantic layer** instead of syntactic (buffer overflows)
- **Cannot be patched by fixing code** — requires aligning semantic reasoning

**Persistent Ecosystem Contamination:**
- Agents with write access to shared knowledge stores upload compromised artifacts
- Corporate wikis, version-control systems become vectors
- Agents become **producers AND consumers** of malicious content
- Progressive degradation of shared knowledge base integrity

### Topological Shift
- Traditional supply chains: DAG (unidirectional, compromise terminates)
- **Agentic supply chains: Cyclic graph** (outputs re-enter as inputs)
- Distinction between supplier and consumer **collapses**
- Security mechanisms assuming acyclic dependency resolution **fail**

---

## 6. Defense Systematization (Five Runtime Layers)

| Layer | Attack Vector | Existing Defenses |
|-------|---------------|-------------------|
| Data (Perception) | Direct/Indirect Prompt Injection | Instruction Hierarchy, Intent Verification (Task Shield, IntentGuard, MELON) |
| Data (Memory) | RAG & Agent-State Poisoning | Statistical Filtering (RAGDefender, FilterRAG), Audited Memory Writes (A-MemGuard) |
| Tool (Phase I) | Hallucination Squatting | Static Registry Allowlists |
| Tool (Phase II) | Dependency Pollution | Signed SBOMs, SLSA Frameworks |
| Tool (Phase III) | Privilege Escalation | Scoped Permissions (MCP), Multi-stage Arbiters (MCP-Guard) |

### Zero-Trust Runtime Architecture — Three Imperatives

**1. Deterministic Capability Binding:**
- Replace probabilistic tool selection with cryptographic provenance
- Cryptographically Bound Registries verifying semantic integrity
- Critical tools invoked via explicit identifiers, not semantic similarity

**2. Context as Untrusted Control Flow:**
- Treat ALL retrieved data as potentially adversarial
- Structural separation between operator instructions and passive data
- Instruction Hierarchy: system > user > retrieved data

**3. Constrain Tool Execution Through Provenance:**
- Capability-based security replacing persistent credentials
- Tool Dependency Graphs restricting unsafe call sequences
- AI-Guarding-AI: isolated Supervisor Model auditing Worker Agent tool calls

---

## 7. CR#237 Integration

### Gap 4 (Memory Adversarial Robustness) Relevance
- **MINJA attack** (76.8% ASR via queries alone) defines the threat our defenses must address
- **PoisonedRAG** (0.1% corpus → 70% ASR) quantifies RAG vulnerability scale
- Memory poisoning taxonomy (direct, indirect, gradual erosion) maps exactly to Gap 4 requirements
- Existing defenses (RAGDefender, A-MemGuard) provide starting points but are insufficient

### Gap 5 (Attack Propagation) Relevance — KEY FINDING
- **Viral Agent Loop is exactly Gap 5** — this paper formalizes what we've been looking for
- Cyclic topology means attack propagation is fundamentally different from traditional supply chains
- Morris II demonstrates empirical feasibility of cross-agent worm propagation
- Persistent ecosystem contamination via shared knowledge stores is the highest-risk scenario

### Cross-References
- **2603.02240 (SuperLocalMemory)** — implements defense architecture against threats cataloged here
- **2603.11619 (Taming OpenClaw)** — empirical attack analysis complementing this taxonomy
- **Colosseum (2602.15198)** — auditing framework for detecting collusion (related to viral propagation)
- **OWASP ASI06** — this paper's threat model directly references and extends OWASP framework

### What This Means for Kairix
1. **Multi-agent systems must assume cyclic dependencies** — DAG-based security assumptions will fail
2. **Memory writes need cryptographic provenance** — not optional, mandatory
3. **Tool selection must be deterministic** — probabilistic semantic matching is a vulnerability
4. **Supervisor-worker architecture** is necessary for tool invocation security
5. **Attack propagation modeling** must account for agents as carriers, not just victims

---

## 8. Limitations

1. **SoK paper, not empirical** — systematizes existing work rather than presenting new experiments
2. **Zero-Trust Runtime Architecture is aspirational** — no implementation or evaluation provided
3. **Defense catalog incomplete** — acknowledges statistical filtering is often insufficient
4. **No quantitative comparison** of defenses against each attack vector
5. **Doesn't address trust federation** across heterogeneous agent ecosystems
6. **Cyclic graph analysis** is conceptual — no formal graph-theoretic treatment

---

## 9. Key Takeaways

1. The **agentic supply chain is fundamentally cyclic**, not DAG-like — this changes all security assumptions
2. **Prompt-Data Isomorphism** is the root vulnerability — passive data becomes active instructions
3. **Stochastic Dependency Resolution** makes agentic systems inherently harder to secure than traditional software
4. The **Viral Agent Loop** is the most dangerous scenario — agents propagate attacks without code-level flaws
5. **Three-phase tool supply chain** model provides complete coverage of tool-related attack surfaces
6. **Zero-Trust Runtime** treating context as untrusted control flow is the correct architectural response

---

*Filed as DD#415 — Gap 4 + Gap 5 targeted deep-dive*
*Complements DD#414 (SuperLocalMemory) — attack taxonomy paired with defense implementation*
