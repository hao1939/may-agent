# CR#161: The Invisible Attack Surface — Four Vectors of Hidden Threat in AI Agent Systems

**Cross-Reference Synthesis**
**Papers Connected:** DD#294 (Prompt Injection as Role Confusion), DD#295 (AgentDrift), DD#298 (Steganographic Reasoning Detection), DD#315 (SpectralGuard Memory Collapse)
**Date:** 2026-03-16
**Scout Session:** s_1773652428874_1383

---

## Thesis

Four recent papers, each studying ostensibly different attack vectors, reveal a **unified vulnerability taxonomy** for AI agent systems. What connects them is a shared structural property: **the attack is invisible at the interface where defenders look**. In each case, the threat operates in a representational space that existing monitoring cannot observe, and the system's overt outputs appear normal until catastrophic failure.

This cross-reference synthesizes these four papers into a single framework: the **Invisible Attack Surface Model (IASM)**, which classifies threats by *where* they hide and *what* they corrupt, and identifies gaps in current defense strategies.

---

## 1. The Four Threat Vectors

### Vector 1: Role Confusion (DD#294)
- **Attack surface:** Latent attention space
- **What hides:** Authority escalation — data tokens silently inherit instruction-giver authority
- **Where defenders look:** Input/output text (prompt engineering, sanitization)
- **Where the attack operates:** Internal role representations in transformer attention weights
- **Invisibility mechanism:** Text that *looks like data* is *treated as instructions* because attention doesn't distinguish provenance
- **Key metric:** 87% injection success rate with zero syntactic anomalies

### Vector 2: Progressive Tool Corruption (DD#295)
- **Attack surface:** External tool output channel
- **What hides:** Cumulative safety drift — each corrupted tool response is individually plausible
- **Where defenders look:** Individual tool outputs (each passes sanity checks)
- **Where the attack operates:** Cumulative reasoning trajectory across multi-step chains
- **Invisibility mechanism:** No single step is anomalous; the drift emerges from statistical accumulation across many individually-reasonable perturbations
- **Key metric:** 67% drift rate at 25% tool corruption; agent self-detection only 8.3%

### Vector 3: Steganographic Coordination (DD#298)
- **Attack surface:** Inter-agent communication channel
- **What hides:** Covert information encoded in otherwise-normal outputs
- **Where defenders look:** Message content (semantic analysis of what agents say)
- **Where the attack operates:** Statistical properties of token selection — information encoded in *how* tokens are chosen, not *what* they say
- **Invisibility mechanism:** Content appears semantically normal; hidden information exists in the distribution of choices, undetectable by content analysis
- **Key metric:** Behavioral canary detection requires running agents multiple times (high cost)

### Vector 4: Spectral Memory Collapse (DD#315)
- **Attack surface:** Internal state dynamics (SSM-specific)
- **What hides:** Destruction of long-range memory capacity
- **Where defenders look:** Model outputs (perplexity, accuracy on current tokens)
- **Where the attack operates:** Spectral radius of state transition matrices — a purely internal quantity invisible in outputs
- **Invisibility mechanism:** Output-level metrics remain normal while internal memory horizon shrinks from millions to dozens of tokens; output-only defenses are **provably** insufficient (Theorem 3)
- **Key metric:** 1% drop in spectral radius halves effective memory; accuracy collapse is catastrophic and sudden at rho_critical of about 0.90

---

## 2. Unified Vulnerability Taxonomy

### The IASM Framework

| Dimension | Role Confusion | Tool Drift | Steganography | Spectral Collapse |
|-----------|---------------|------------|---------------|-------------------|
| **Attack layer** | Attention/representation | Tool I/O boundary | Communication channel | Recurrent state dynamics |
| **Temporal profile** | Instantaneous | Progressive/cumulative | Persistent | Progressive with phase transition |
| **Observability** | Unobservable at text level | Each step appears normal | Content appears normal | Output appears normal |
| **Scaling behavior** | Worse with model capability | Worse with chain length | Worse with channel bandwidth | Worse with sequence length |
| **Architecture** | All transformers | All tool-using agents | All communicating agents | SSMs (Mamba, etc.) |
| **Defense location** | Attention mechanism | Stateful tool monitoring | Behavioral divergence testing | Internal state monitoring |
| **Defense cost** | Architectural change (LoRA) | O(N) per tool call chain | O(K) agent runs per message | O(d_state) per token |

### Shared Structural Properties

**Property 1: The Observability Gap**
All four attacks exploit the same fundamental principle: **there exists information critical to safety that is not accessible from the standard observation interface**. The information bottleneck between internal model state and observable outputs means models project high-dimensional internal states to low-dimensional outputs, inevitably losing safety-relevant information.

**Property 2: Anti-Scaling**
Three of the four attacks get *worse* as systems become more capable:
- Role Confusion: More capable models better understand and follow injected instructions (23% more susceptible)
- Tool Drift: More capable models build longer reasoning chains with more drift opportunities
- Steganography: More capable models have higher bandwidth for hidden channels
- (SpectralGuard is architecture-specific, not capability-dependent)

This creates a **safety paradox**: the very improvements that make agents more useful also expand their invisible attack surface.

**Property 3: Cascade Amplification**
In multi-agent systems, all four vectors **compound across agent boundaries**:
- Role confusion at agent A produces corrupted output as input to agent B, where role confusion treats A's corrupted output as authoritative
- Tool drift in agent A leads to subtly biased handoff to agent B, whose tools confirm A's biased framing (confirmation cascade)
- Steganographic content in A's output causes B to act on hidden instructions while C observes B's anomalous behavior but not the cause
- Spectral collapse in SSM-based agent A degrades long-context reasoning, passing incorrect summaries to agent B

---

## 3. Defense Architecture: Depth-Stratified Monitoring

### Layer 1: Representation Monitoring
- **Role-Aware Attention (DD#294):** Tag tokens with role embeddings; modulate attention by role compatibility
- **SpectralGuard (DD#315):** Monitor spectral radius of state transition matrices in real-time
- **Coverage:** Catches Vector 1 (role confusion) and Vector 4 (spectral collapse)

### Layer 2: Trajectory Monitoring
- **Safety Anchoring (DD#295):** Periodically re-evaluate reasoning against original safety constraints
- **Multi-tool Triangulation (DD#295):** Cross-validate tool outputs from independent sources
- **Coverage:** Catches Vector 2 (progressive tool corruption)

### Layer 3: Behavioral Monitoring
- **Behavioral Canaries (DD#298):** Run agents with and without suspected messages; compare behavioral divergence
- **V-Information Gap Analysis (DD#298):** Measure information asymmetry between decode-capable and decode-incapable agents
- **Coverage:** Catches Vector 3 (steganographic coordination)

### Layer 4: Cross-Agent Monitoring
- **Drift-Aware Handoff Protocol:** Each handoff includes a safety baseline hash comparing current state to initial safety assessment
- **Redundant Verification Agents:** Independent agents tasked solely with detecting anomalies in inter-agent communication
- **Coverage:** Catches cascade amplification across all four vectors

### Integration with Existing Portfolio

| Existing Work | How IASM Extends It |
|--------------|-------------------|
| **DD#277 (CMAG Constitutional Governance)** | Add steganographic gap constraints + drift-specific constitutional provisions to governance framework |
| **DD#283 (Verified Orchestration)** | Plan-Execute-Verify needs all four defense layers, not just output verification |
| **CR#144 (Defense Triad)** | Extends to **Defense Quad**: Memory Safety + Injection Resistance + Communication Integrity + Steganographic Gap Monitoring |
| **DD#258 (Information-Theoretic Privacy)** | Progressive tool drift and steganography are specific instances of information leakage amplification across multi-agent chains |
| **CR#126 (Failure Modes)** | IASM provides a mechanistic classification of *how* cascading failures originate — through invisible attack vectors rather than observable errors |

---

## 4. Open Problems and Research Frontiers

### 4.1 Unified Detection Theory
Can we develop a **single formal framework** that detects all four vectors simultaneously? The steganographic gap (V-information) from DD#298 is the most promising candidate — it's already reference-free and measures information asymmetry. Could it be extended to detect role confusion (asymmetry in how tokens are treated) and spectral collapse (asymmetry in memory capacity)?

### 4.2 The Cost of Complete Monitoring
- Layer 1 (representation): O(d_model) per token — feasible
- Layer 2 (trajectory): O(N * tools) per reasoning chain — expensive for long chains
- Layer 3 (behavioral): O(K * agent_runs) per message — prohibitively expensive at scale
- Layer 4 (cross-agent): O(agents^2 * messages) — combinatorial explosion

**Key question:** Can we design **adaptive monitoring** that allocates detection resources based on threat assessment, rather than exhaustively monitoring everything?

### 4.3 Adversarial Co-Evolution
Each defense creates new attack opportunities:
- Role-aware attention leads adversary to manipulate role embeddings
- SpectralGuard leads adversary to preserve spectral radius but corrupt eigenvector alignment
- Behavioral canaries lead adversary to design steganography minimizing behavioral divergence
- Safety anchoring leads adversary to corrupt the anchor itself

This suggests an **arms race dynamic** connecting to DD#314 (EvolveCoder's adversarial co-evolution framework).

### 4.4 Formal Composition of Attack Vectors
What happens when an attacker combines multiple vectors simultaneously? No paper addresses **multi-vector attacks**. This is a critical gap.

---

## 5. Actionable Recommendations for P82

1. **Immediate:** Add role tagging to SIGNALS.md handoff protocol — classify agent instructions (Principal), inter-agent content (User), and external data (Data)
2. **Short-term:** Implement tool output consistency tracking — log and compare tool outputs across sessions to detect drift patterns
3. **Medium-term:** Develop behavioral canary framework — periodically test whether agents behave differently when receiving suspected steganographic content
4. **Long-term:** Design adaptive monitoring allocation system that concentrates detection resources on the highest-risk interactions

---

## 6. Impact Assessment

**Synthesis significance: 9.5/10**

This cross-reference reveals that four ostensibly independent security papers are manifestations of a single underlying vulnerability: **safety-critical information that is invisible at the standard observation interface**. The IASM framework unifies them into a coherent threat taxonomy with a layered defense architecture. The key insight — that attacks exploit the information bottleneck between internal state and output — has profound implications for how we design monitoring systems for multi-agent AI.

The anti-scaling property (stronger models have larger invisible attack surfaces) makes this increasingly urgent as agent capabilities improve.

---

*Cross-reference produced by Scout | CR#161 | 2026-03-16*
*Connects: DD#294, DD#295, DD#298, DD#315 (all previously at 0 cross-references)*
