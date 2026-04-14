# DD#757: SPASM — Stable Persona-driven Agent Simulation via Egocentric Context Projection

**Paper**: "SPASM: Stable Persona-driven Agent Simulation for Multi-turn Dialogue Generation"  
**Authors**: Han Luo, Guy Laban (U. Leeds / Ben-Gurion University)  
**Source**: arXiv:2604.09212 (Apr 2026) — Findings of ACL 2026  
**Rating**: ★★★★ EXCELLENT  
**Date**: 2026-04-14  
**Scout**: Session 761 (SPASM + PETITE deep dives)

---

## Core Finding

**LLM–LLM conversations accumulate identity-related failures (persona drift, role confusion, "echoing") that can be eliminated by a simple representational change: storing dialogue history in perspective-agnostic form and projecting it into each agent's egocentric view before generation.** This Egocentric Context Projection (ECP) reduces persona drift by Cohen's d = -0.75 on emotion probes and eliminates echoing to 0% under human validation — all without changing model weights or adding training.

## Key Mechanism: Egocentric Context Projection (ECP)

### The Problem: Naive History Concatenation Causes Identity Collapse
Standard multi-turn dialogue feeds the same concatenated history to both agents. This causes:
- **Persona drift**: Agent gradually deviates from assigned identity/goals over turns
- **Role confusion**: Agent confuses which utterances are "self" vs "partner"
- **Echoing**: One agent gradually mirrors the other's language, perspective, and stance

These failures compound over long conversations and are **structural** — they arise from how history is represented, not from model capability.

### The Solution: Perspective-Agnostic Storage + Egocentric Projection
1. **Store history neutrally**: Each turn records (absolute_speaker_id, content) without committing to LLM-specific roles like user/assistant
2. **Project per-agent**: Before generation, apply operator Ψ_i that maps absolute IDs to relative roles: {SELF, PARTNER}
3. **Generate from egocentric view**: Each agent sees its own utterances as "SELF" and partner's as "PARTNER" — deterministic, no learned component

This is formally a **role-relativization operator** — it preserves content and temporal order while normalizing speaker identity into agent-relative coordinates.

### Why It Works (Mechanistic Insight)
The key insight is that role ambiguity in standard concatenation creates a **representational confound**: the same token sequence occupies different semantic roles for different agents. When both agents see "User: [Client text]" / "Assistant: [Responder text]", the Client's own words appear in the "User" role, creating tension between the LLM's trained user/assistant distinction and the intended Client/Responder roles. ECP resolves this by making every agent always see its own utterances in the same structural position.

## Quantitative Results

### Persona Drift Reduction (ECP vs Concat)
| Backbone | Dimension | Δ Drift | Cohen's d | p-value |
|----------|-----------|---------|-----------|---------|
| GPT-4o-mini | Emotion | -0.042 | **-0.75** | <0.001 |
| GPT-4o-mini | Motivation | -0.031 | -0.55 | <0.001 |
| GPT-4o-mini | Concerns | -0.024 | -0.30 | 0.014 |
| DeepSeek | Concerns | -0.036 | -0.41 | <0.001 |
| Qwen-Plus | Concerns | -0.032 | -0.38 | <0.001 |

Negative Δ = less drift. ECP consistently reduces drift across all 3 backbones and 3 dimensions.

### Echoing Elimination
Under human validation, ECP achieves **0% echoing rate** across ALL 9 backbone pairings. Concat echoing rates range from 3% to 24%.

### Persona Retrieval Accuracy (Embedding Space)
| Configuration | Top-1 Acc | Top-10 Acc |
|--------------|-----------|------------|
| GPT/GPT | 0.96 | 1.00 |
| DS/GPT | 0.99 | 1.00 |
| Qwen/GPT | 0.98 | 1.00 |
| Random baseline | 0.02 | 0.17 |

### Responder Dominance Effect
The Responder model backbone dominates interaction geometry — fixing GPT-4o-mini as Responder keeps clustering quality high (Silhouette ≥0.60) regardless of Client backbone. DeepSeek as Responder degrades clustering to 0.10 Silhouette. **The responder shapes the latent space; the client modulates variance.**

## Scale of Evaluation
- 4,500 personas × 10 conversations per pairing = **45,000 conversations**
- 9 Client–Responder backbone combinations (3×3 matrix)
- 3 LLM backbones: GPT-4o-mini, DeepSeek-V3.2, Qwen-Plus
- 50-persona ablation study with 3 conversations each for ECP vs Concat

## Framework Architecture (SPASM)
Five modular components:
1. **Persona Schema**: Demographics + context + emotional state + behavioral patterns
2. **Persona Validator**: LLM-based plausibility check for sampled profiles
3. **Persona Crafter**: Converts validated fields to natural-language persona descriptions
4. **Client–Responder Dialogue**: Persona-enacting Client + role-prompted Responder
5. **Termination Detector**: Monitors for coherent stopping signals

## Connection to Our System

### HIGH: Context Representation for Multi-Agent Systems
ECP's core insight — **how you represent shared history matters more than what's in it** — directly connects to:
- **KE-101 Law 1 (Structure > Content)**: ECP is a pure structural change (relabeling) that produces large behavioral effects without content modification
- **KE-101 Law 3 (Attention is Zero-Sum)**: Perspective-agnostic storage avoids wasting attention on resolving role ambiguity
- **DD#733 (DACS)**: DACS uses Registry/Focus modes for context isolation; ECP uses egocentric projection — different mechanisms, same principle (active context management)

### MEDIUM: Echoing as Multi-Agent Failure Mode
Echoing — where one agent mirrors its partner — maps to our multi-agent collaboration concerns:
- In our system, could Coder "echo" Coach's framing instead of maintaining its own task perspective?
- Could session inheritance create a form of echoing where later sessions mirror earlier conclusions?
- **H-093 verification destruction** may be a form of echoing — the verifier adopts the generator's confidence

### MEDIUM: Responder Dominance Effect
The finding that the Responder backbone dominates interaction geometry has implications for our Dispatcher → Agent architecture. If the "responding" agent (e.g., Coder responding to Coach feedback) dominates the interaction space, then **who provides feedback matters more than who receives it**.

### ACTIONABLE: Drift Measurement Protocol
SPASM's drift benchmark (probe questions at baseline vs. turn t, cosine distance) is a lightweight, applicable protocol for measuring whether our agents drift from their assigned roles during long sessions.

## Critical Assessment

### Strengths
- Elegant, minimal intervention (relabeling only) with strong effect sizes
- Large-scale evaluation (45,000 conversations) with proper ablations
- Human validation confirms automated metrics (echoing elimination)
- Code and data available (GitHub)
- Accepted at ACL 2026

### Limitations
- Domain limited to counseling/support dialogues — unclear if ECP helps in task-oriented settings (our use case)
- All agents are GPT-4o-mini / DeepSeek / Qwen — no open-source small models tested
- Drift measurement depends on embedding model choice (OpenAI text-embedding-3-large)
- No comparison with other anti-drift techniques (e.g., periodic persona re-injection)

### Rating Justification: ★★★★
**The core mechanism (ECP) is simple, well-validated, and structurally relevant to our context management challenges.** The insight that representational format of shared history drives agent stability is actionable. Docked from ★★★★★ because: (1) the domain (synthetic dialogue generation) doesn't directly match our task-execution focus, and (2) the framework is more about data generation infrastructure than agent system design.

---

## Cross-References
- **DD#733 (DACS)**: Complementary context management approach — DACS scopes what context is visible; ECP normalizes how it's represented
- **DD#731 (Capability ≠ Cooperation)**: Both show that multi-agent interaction properties are structural, not capability-driven
- **CR#326 (Gym-Production Gap)**: ECP's "responder dominance" effect suggests production context asymmetries matter
- **KE-101 (Five Laws)**: External validation of Laws 1 (structure > content) and 3 (attention zero-sum)
- **H-093 (Verification Destruction)**: Echoing as a failure mode connects to verification agents adopting generator's perspective
