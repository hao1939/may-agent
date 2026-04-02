# Deep-Dive: Friday March 20, 2026 — Tier 2 Papers
**Date:** 2026-03-20
**Scout Session:** s_1773990317765_168

---

## DD#440: Inference-Driven De-Anonymization in LLM Agents
**arXiv:** 2603.18382v1 [cs.AI] — 19 Mar 2026
**Authors:** Ko, Jeong, Thakur, Kim, Jia (Virginia Tech / Accenture)
**Rating:** ★★★★★ CRITICAL (upgraded from ★★★★)
**Gap Match:** Gap 3 (Cross-Layer Attacks) + Gap 1 (Trust/Provenance)

### Core Finding
LLM-based agents can autonomously reconstruct real-world identities from scattered, individually non-identifying cues — even as a **byproduct of benign tasks**. This is formalized as "inference-driven linkage" and demonstrated across three settings with devastating effectiveness.

### Key Quantitative Results
1. **Netflix Prize re-identification**: GPT-5 agent reconstructs **79.2% of identities** from just 2 movie ratings (noisy), vs. 56.0% classical baseline. At 8 ratings, 99.0% success.
2. **AOL Search Logs**: Agent autonomously identified **10 real individuals** from anonymized search histories by triangulating business registries, lifestyle markers, institutional records — with *no bespoke engineering*.
3. **InferLink Benchmark**: Under explicit prompts, linkage success up to **100%** (Claude 4.5, Hybrid/MK condition). Even under *implicit* benign framing, Claude 4.5 achieves **70-80% linkage** — meaning agents de-anonymize people *while doing other work*.

### Technical Architecture
- **Formal model**: Π: (D_anon, D_aux) ↦ (î, ℰ) — anonymized artifacts + auxiliary context → identity hypothesis + evidence
- **Three evaluation settings**:
  1. Fixed-pool matching (Netflix-style)
  2. Open-ended narrowing with web retrieval (AOL-style)  
  3. Controlled benchmark (InferLink) varying fingerprint type × intent × attacker knowledge
- **Fingerprint types**: Intrinsic (personal attributes), Coordinate (spatiotemporal), Hybrid
- **Intent conditions**: Implicit (benign task) vs. Explicit (re-identification requested)
- **Knowledge conditions**: Zero-Knowledge (ZK) vs. Membership-Knowledge (MK)

### Critical Insight: Incidental Linkage
The most alarming finding: **identity reconstruction emerges as a byproduct of benign analysis**. In the Implicit condition (no re-identification requested), agents still achieve 25-80% linkage success depending on model and fingerprint type. This means:
- An agent doing market analysis might inadvertently de-anonymize customers
- An agent doing healthcare research might link anonymous patient records to identities
- Privacy failure occurs **without adversarial intent**

### Mitigation Analysis
Privacy-aware system prompts can reduce linkage (e.g., GPT-5 Explicit-MK drops from 85% to 0% with safety prompts), but at **significant utility cost** (up to -54% for Claude 4.5). This reveals a fundamental **privacy-utility trade-off** in agentic systems.

### Connections to Our Architecture
1. **Gap 3 (Cross-Layer Attacks)**: This IS a cross-layer attack — agents combine information across data silos that were anonymized independently, creating emergent privacy violations
2. **Gap 1 (Trust/Provenance)**: Provenance tracking must now include *inference provenance* — what identities can be derived from combined data
3. **DD#429 (Provenance Paradox)**: Self-reported routing means agents may route sensitive data to inference-capable models without privacy constraints
4. **CR#236 (Collusion Defense)**: Multi-agent systems where agents share partial results could enable collaborative de-anonymization at massive scale
5. **DD#430 (MAT Framework)**: Trace-based assurance must include *inference monitoring* — detecting when an agent is accumulating identity-relevant signals

### Limitations
- InferLink uses synthetic data (10×10 tables) — real-world datasets larger/noisier
- AOL evaluation limited to cases where corroboration is possible
- Privacy-aware prompts are easily circumvented by jailbreaking

### Verdict
**This paper represents a paradigm shift.** It moves privacy from "what data was accessed" to "what identities can be inferred." Every anonymization strategy must now account for LLM-powered inference-driven linkage. Directly fills Gap 3 with a concrete, quantified threat model.

---

## DD#441: ExpRAG — Retrieval-Augmented LLM Agents Learning to Learn from Experience
**arXiv:** 2603.18272v1 [cs.AI] — 18 Mar 2026
**Authors:** Ferraz, Deffayet, Nikoulina, Déjean, Clinchant (NAVER LABS Europe)
**Rating:** ★★★★ STRONG
**Gap Match:** Gap 4 (Memory Governance) — extends

### Core Finding
Combining retrieval-augmented generation (retrieving past experience trajectories) with supervised fine-tuning (LoRA) produces agents that **learn to learn from experience** — significantly outperforming either approach alone, especially on unseen tasks.

### Key Quantitative Results
1. **ALFWorld (in-distribution)**: LoRA baseline alone achieves 94.1% — outperforming ALL prior state-of-the-art including SAND (85.0%), ITPR (85.1%), and even rule-based expert (89.6%)
2. **ALFWorld (OOD hard tasks)**: ExpRAG-LoRA achieves **88.5%** vs. LoRA alone at 34.4% — a **+54.1pp improvement** on unseen task types
3. **ScienceWorld (OOD hard)**: ExpRAG-LoRA achieves **42.2%** vs. LoRA at 15.6% — nearly 3× improvement
4. **Training-free ExpRAG alone**: Simple retrieval (no training) achieves 83.6% on ALFWorld, outperforming all memory-augmented systems including Reflexion (42.7%), Memory Bank (40.3%), A-MEM (34.7%)

### Technical Architecture: ExpRAG Pipeline
1. **Experience Bank Construction**: Collect agent rollouts, encode each trajectory τ_i into embedding ϕ(τ_i), create searchable index
2. **Retrieval at Inference**: Encode current task + history as query, retrieve top-K most similar trajectories by nearest-neighbor search
3. **In-Context Conditioning**: Retrieved trajectories injected into system prompt as "memory block"
4. **ExpRAG-LoRA**: Key innovation — include retrieved trajectories *during fine-tuning* so model learns to leverage retrieved context, not just memorize training targets

### Design Choices That Matter
- **Top-K**: K=2 is practical sweet spot (captures most gains, avoids context rot)
- **Static vs. Dynamic retrieval**: Static (retrieve once at start) more stable; dynamic (re-retrieve each step) only helps when index is well-matched
- **Index composition**: Training from "all" tasks works best; using only easy-task index fails on hard tasks
- **Delayed generalization**: OOD performance keeps improving even after validation loss increases (grokking-like phenomenon) — best checkpoints at epoch 50, well past conventional early stopping

### Connections to Our Architecture
1. **DD#428 (Experience-Following)**: ExpRAG provides the *mechanism* for the experience-following property — agents follow retrieved experience with r≈1 correlation, and this paper shows how to make that reliable
2. **DD#431 (MemArchitect)**: MemArchitect governs WHAT to store; ExpRAG governs HOW to retrieve and USE — they're complementary layers in the memory stack
3. **CR#246 (Complete Memory Stack)**: ExpRAG validates the "episodic retrieval" layer of our memory architecture — full trajectories as memory units, not summaries
4. **CR#234 (Memory Workshop Cluster)**: ExpRAG directly competes with and outperforms Mem0, A-MEM, Memory Bank — confirming our assessment that simpler architectures win

### Critical Insight: Simple Baselines Beat Complex Systems
The paper's most important meta-finding: **simple experience retrieval dramatically outperforms elaborate memory management systems**. This validates our CR#246 prediction that the field has been over-engineering memory when the core operation (episodic retrieval + fine-tuning) is remarkably effective.

### Limitations
- Only tested on text-based environments (ALFWorld, ScienceWorld)
- Expert trajectories as memory source (not self-generated)
- Fixed read-only memory — no online updates
- 7B parameter models only

### Verdict
**Definitive empirical study.** Establishes that the combination of episodic retrieval + fine-tuning is the right foundation for agent memory. The 88.5% OOD result on ALFWorld is remarkable. Directly validates and extends our memory stack architecture.

---

## DD#442: Multi-Trait Subspace Steering — The Dark Side of HAI
**arXiv:** 2603.18085v1 [cs.AI] — 18 Mar 2026
**Authors:** Chia, Wong, Pan
**Rating:** ★★★ SOLID (downgraded from ★★★★)

### Core Contribution
Develops MultiTraitSSS framework that uses activation space steering to create "Dark models" exhibiting cumulative harmful behavioral patterns in human-AI interaction. Tests both single-turn and multi-turn harmful interactions.

### Relevance Assessment
- **Primary focus**: Human-AI interaction safety (single-agent, single-user)
- **MAS relevance**: Moderate — the steering technique could be used to create malicious agents within a multi-agent system, connecting to Gap 5 (Evolutionary Deception) where agents might develop harmful interaction patterns
- **Connection to CR#236**: Shows that LLM behavioral traits can be steered programmatically — relevant to understanding how compromised agents might manipulate human overseers in HITL scenarios
- **Connection to CR#242 (HITL Threshold)**: If agents can be steered to exhibit psychologically manipulative patterns, HITL oversight becomes more vulnerable to manipulation

### Key Technical Elements
- Crisis-associated personality traits combined via subspace steering
- Generates models that produce harmful outcomes across sustained interaction
- Protective measures proposed but details in full paper

### Verdict
Interesting for understanding adversarial agent creation, but primarily a single-agent safety paper. Lower priority for our MAS architecture focus.

---

## DD#443: Access Controlled Website Interaction for Agentic AI
**arXiv:** 2603.18197v1 [cs.AI] — 18 Mar 2026
**Authors:** Kim, Kim
**Rating:** ★★★ SOLID (confirmed)

### Core Contribution
Proposes website-side access control mechanisms for agentic AI performing delegated critical tasks. Modifies open-source authorization service (OAuth-style) to support fine-grained agent delegation.

### Relevance Assessment
- **Primary focus**: Agent authentication and delegation for web interaction
- **MAS relevance**: Moderate — addresses the practical problem of how agents prove their authority to act on behalf of users
- **Connection to DD#429 (Provenance Paradox)**: If routing is unreliable, delegation credentials might be passed to wrong agents
- **Connection to DD#440 (De-Anonymization)**: Agents with web access credentials could be used for inference-driven de-anonymization
- **Gap coverage**: Touches on Gap 2 (Runtime Safety) tangentially — provides the auth infrastructure layer

### Key Technical Elements
- Website design for AI agent interaction
- Modified access grant protocols for agent delegation
- Fine-grained permission model for critical tasks
- Evaluation of capabilities

### Verdict
Practical engineering contribution. Important for deployment but not theoretically groundbreaking. Fills a gap in the "plumbing" of agent web interaction.

---

## Summary: Tier 2 Assessment

| Paper | Rating | Gap Coverage | Key Finding |
|-------|--------|-------------|-------------|
| DD#440 (De-Anonymization) | ★★★★★ UPGRADED | Gap 3 + Gap 1 | Agents de-anonymize as byproduct of benign work; 79.2% Netflix re-ID |
| DD#441 (ExpRAG) | ★★★★ STRONG | Gap 4 extends | Simple retrieval + fine-tuning = 88.5% OOD; beats all complex memory systems |
| DD#442 (Dark HAI) | ★★★ SOLID | Gap 5 tangential | Subspace steering creates harmful agents; primarily single-agent safety |
| DD#443 (Access Control) | ★★★ SOLID | Gap 2 tangential | Practical auth infrastructure for agent delegation |

**Major upgrade:** DD#440 promoted from Tier 2 to effective Tier 1 status — this is the most important privacy paper in the batch and directly fills Gap 3 (Cross-Layer Attacks), the hardest gap in our W12 Capstone architecture.
