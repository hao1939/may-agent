# DD#786: DiffMAS — End-to-End Latent Communication Optimization for Multi-Agent Systems

**Paper:** "Learning to Communicate: Toward End-to-End Optimization of Multi-Agent Language Systems" (arXiv:2604.21794)
**Authors:** Yu, Liu, Jin, Yuan, Kuang, Wang — Under review at COLM 2026
**Relevance:** ★★★★½ — Direct implications for inter-agent communication in our system
**Date:** 2026-04-24

## Core Insight

Most multi-agent LLM systems treat inter-agent communication as a **fixed text interface** — agents exchange natural language messages. DiffMAS shows this is suboptimal: by making communication a **learnable latent channel** (via KV-cache sharing), agents jointly optimize *what* to encode and *how* to interpret it, yielding consistent gains over text-based protocols.

Key result: 26.7% on AIME24, 20.2% on GPQA-Diamond — beating both single-agent and text-based multi-agent baselines.

## Mechanism

1. **Latent trajectories**: Instead of text messages between agents, share internal KV-cache representations
2. **Parameter-efficient training**: SFT over multi-agent latent trajectories — agents learn to encode/decode shared representations
3. **Joint optimization**: Communication format and reasoning are optimized together, not separately

## Connection to Our System

**Direct relevance to inter-agent communication patterns:**
- Our agents communicate via text (notifications, INBOX.md, context files). This is exactly the "fixed interface" DiffMAS identifies as suboptimal.
- The finding that **jointly optimizing communication + reasoning** outperforms fixed protocols connects to our recurring problem of agents misinterpreting or ignoring notifications from other agents (e.g., scout findings-used rate hovering ~54%).
- The "decoding stability" improvement is interesting — our system has instability when agents receive context they weren't optimized to process.

**Practical implications:**
- We can't do latent KV-cache sharing (our agents are prompt-based, not fine-tuned). But the principle applies: **structure what agents share based on what the receiver can actually use**, not what the sender thinks is important.
- This validates the hypothesis that our low findings-used rate isn't just about content quality — it's about **communication format mismatch**.

**Connection to existing work:**
- Extends DD#784 (StructMem) — structured memory + structured communication are complementary
- Connects to DD#521 (mngr) — the integrator pattern is a text-level approximation of what DiffMAS does at the latent level
- Relevant to H-EXP-013 (counterfactual credit) — if communication channels are optimized, credit attribution becomes cleaner

## Actionable Takeaway

For our text-based system, the DiffMAS principle translates to: **standardize inter-agent message formats based on receiver needs, not sender output.** Each agent should have a defined "input schema" for notifications, and senders should format to match. This is a text-level approximation of the latent optimization DiffMAS demonstrates.

## Triage: Other Papers from Apr 22-24 Batch

| Paper | Relevance | Notes |
|-------|-----------|-------|
| 2604.21794 DiffMAS | ★★★★½ | This deep dive |
| 2604.21155 Multi-Agent Empowerment | ★★★ | Intrinsic motivation → emergent group behavior. Theoretical; interesting but no direct system application |
| 2604.21529 Self-Organizing Energy | ★★ | Domain-specific (energy grids) |
| 2604.21787 Thermal Comfort | ★ | Domain-specific |
| 2604.21328 Diversity in Teams | ★★★ | Agent-based sim on missing expertise. Relevant concept but simulation-only |
| 2604.21129 AGNT2 | ★★ | Blockchain/agent economy infrastructure |
| 2604.21811 PAC Consensus | ★★½ | Learning theory for consensus — theoretical |
| 2604.20732 Freight Negotiation | ★½ | Domain-specific |
| 2604.20805 Pluralistic Alignment | ★★★ | Structural value alignment — interesting for governance but abstract |
| 2604.20622 pAI/MSc | ★★★½ | ML theory research with humans-in-loop. Relevant to our human-AI research workflow |
| 2604.20348 Bimanual Multi-Agent ICL | ★★★ | In-context learning for multi-agent coordination — methodologically interesting |
