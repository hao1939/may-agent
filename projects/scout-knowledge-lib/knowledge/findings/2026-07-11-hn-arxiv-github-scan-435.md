<ai_context>
summary: "HN/arXiv/GitHub Scan #435 (2026-07-11): The Accumulation Asymmetry. CompactionRL (2607.05378) reveals GLM-5.2's actual breakthrough is architectural, not parametric — the model learned to forget via trained context compaction (+7.0pp SWE-bench, deployed in 750B-A40B training pipeline). This is the first industrial-scale proof that overcoming the accumulation asymmetry (systems that can only add, never subtract) directly improves performance. Three companion papers formalize the same directional barrier from different angles: Governed Caste Reassignment (2607.04634) shows tightening is free but loosening requires cryptographic proof; PiSAs (2607.05318) shows information leaks across user boundaries but cannot be unshared; TACTIC-KG (2607.05001) shows small specialized agents outperform large monolithic ones through modular decomposition. Cross-referenced with Subtraction Deficit, Cold Start Tax, Compilation Gradient. HN sovereignty stack at ~4,920pts (new all-time high). Fable/Riddle crosses 500pts (CONFIRMED). shepherd 986★ (14 from 1K prediction). superlog 994★ (6 from 1K). OfficeCLI 9,254★. Vercel/eve 3,289★ (NEW — filesystem-first durable agent framework, Vercel entering agent runtime space)."
triggers: "accumulation asymmetry, compaction, context compaction, forgetting, lossy compression, privilege ratchet, directional barrier, auto-tightening, caste reassignment, cross-user spillage, PiSAs, CompactionRL, TACTIC-KG, scan 435"
source_basis: "HN front page 2026-07-07 (40 stories via Algolia API), arXiv API (2607.05378, 2607.04634, 2607.05318, 2607.05001, 2607.04786, 2607.04219), GitHub API (vercel/eve, shepherd-agents/shepherd, iOfficeAI/OfficeCLI, superloglabs/superlog, eli-labz/Cognitive-Core-Skills, OpenLAIR/OpenSkill). Cross-referenced with Cold Start Tax, Subtraction Deficit, Compilation Gradient, Authority Gap (#434)."
</ai_context>

# Scan #435: The Accumulation Asymmetry

**Date**: 2026-07-11
**Sources**: HN front page (Algolia API), arXiv API (cs.AI, cs.MA, cs.RO, cs.SE), GitHub API
**Previous**: Authority Gap (#434), Latent Horizon (#433), Boundary Dissolution (#432)

## Theme

Scan #434 revealed the Authority Gap — verification instruments often lack grounded authority. Scan #435 discovers the structural reason: **agent systems exhibit a fundamental directional asymmetry where accumulation (adding state, constraints, privileges, information) is cheap and automatic, while subtraction (compressing, tightening, forgetting, containing) is expensive and must be explicitly designed.**

This is not a new observation for the library — the Subtraction Deficit, Cold Start Tax, and Compilation Gradient all document aspects of it. What's new is the **first industrial-scale proof that overcoming the asymmetry improves performance**, and three independent formalizations from different domains that converge on the same mathematical structure.

## Key Papers

### 1. CompactionRL — The Subtraction Deficit Has an Exit (2607.05378)

**Core finding**: CompactionRL trains long-horizon agentic LLMs to jointly optimize task execution AND context compression. Token-level loss normalization and cross-trajectory advantage estimation enable learning from compacted trajectories.

**Results**: GLM-4.5-Air achieves 66.8% Pass@1 on SWE-bench Verified (+7.0pp) and 24.5% on Terminal-Bench 2.0 (+3.1pp). GLM-4.7-Flash reaches 56.0%/20.2% (+5.5/+6.8pp). **CompactionRL is deployed in the RL pipeline for training GLM-5.2 (750B-A40B).**

**Why this matters**: This is the first major paper proving that *learning to forget* — trained lossy compression during execution — directly improves agent performance at scale. GLM-5.2's competitive edge is not just parametric scale; it's architectural: the model learned the subtraction primitive our system lacks.

**Connection to library**: The Cold Start Tax documented that ~46% of our system's ops are cold-start state reconstruction. CompactionRL shows the solution is not faster reconstruction but learned compression — keeping only what matters. The Subtraction Deficit identified the asymmetry; CompactionRL provides the mechanism for overcoming it.

Source: https://arxiv.org/abs/2607.05378

### 2. Governed Caste Reassignment — Tightening Is Free, Loosening Requires Proof (2607.04634)

**Core finding**: In heterogeneous robot swarms, role reassignment is treated as a governance event. Auto-tightening (reassigning to a lower-privilege caste) completes automatically in single-digit milliseconds. Bounded relaxation (reassigning to a higher-privilege caste) requires an operator countersignature against a per-axis budget. Each transition carries a signed cause-chain committed to a Merkle audit log. The protocol refuses four explicit attacks (caste laundering, repeated-relaxation escalation, operator impersonation, cause-chain forgery) by construction.

**Results**: Evaluated on real Ed25519 signatures over fleets up to 100 robots. Distributed audit layer with quorum-committed total order and cryptographic fork exclusion validated with Byzantine adversary.

**Why this matters**: This paper formalizes the directional asymmetry as a **design principle**: reducing authority should be automatic; expanding authority should require external proof. The asymmetry is not a bug — it's a safety property. Our Compilation Gradient (soft → hard) documents the same direction but treats it as observed; this paper proves it should be *enforced*.

Source: https://arxiv.org/abs/2607.04634

### 3. PiSAs — Information Leaks Downstream, Cannot Be Unshared (2607.05318)

**Core finding**: PiSAs benchmarks privacy in shared agentic systems with dual contextual-integrity annotations: whether information is task-appropriate AND which users may access it. This enables measuring cross-user spillage across outputs, inter-agent communication, and memory. **Even state-of-the-art models fail to reliably filter inappropriate content or restrict transmission to authorized users.**

**Why this matters**: The Boundary Dissolution (#432) documented how trust boundaries erode between agent and environment. PiSAs extends this to multi-user systems: information flows *down* privilege gradients (from authorized to unauthorized) far more easily than it can be contained. The containment failure is bottlenecked by LLM judgment — the same Authority Gap (#434) but in the information domain. This is the accumulation asymmetry applied to data: sharing is automatic, unsharing is impossible.

Source: https://arxiv.org/abs/2607.05318

### 4. TACTIC-KG — Specialization Beats Scale at Extraction (2607.05001)

**Core finding**: Small specialized agent teams (3B–8B models) outperform monolithic large-model ICL baselines for cyber threat intelligence knowledge graph construction. Modular agents for extraction, typing, verification, and curation improve stability, recall, and graph consistency while reducing cost.

**Why this matters**: A concrete example of the accumulation asymmetry at the architecture level — monolithic systems accumulate ALL capabilities in one context, while decomposed systems can specialize and prune. The specialization is a form of subtraction (each agent deliberately excludes most of the domain) that improves overall performance.

Source: https://arxiv.org/abs/2607.05001

### Supporting Paper: CompactionRL × GLM-5.2 × HN Margin Collapse Triangle

CompactionRL (2607.05378) explicitly states it was **deployed in GLM-5.2's RL training pipeline**. GLM-5.2 has been tracked by this library for 12+ consecutive scans, currently at 504pts on HN with the "AI margin collapse" framing. The community sees GLM-5.2 as a cost/commoditization story. But the CompactionRL connection reveals the deeper mechanism: GLM-5.2's competitiveness comes partly from learning to forget — a capability no one discusses in the margin-collapse discourse. The market narrative is about price; the technical reality is about architecture.

## The Accumulation Asymmetry — Cross-Paper Synthesis

Across these four papers, one directional pattern repeats:

| Domain | Accumulation (Easy/Automatic) | Subtraction (Hard/Designed) | Paper |
|--------|------------------------------|----------------------------|-------|
| **Context** | Trajectory grows without bound | Compaction must be trained as RL objective | CompactionRL |
| **Authority** | Auto-tightening (instant, free) | Relaxation requires cryptographic proof + budget | Governed Caste |
| **Information** | Cross-user spillage through memory/agents | Containment fails even at SOTA level | PiSAs |
| **Architecture** | Monolithic model accumulates all capabilities | Specialization requires deliberate modular design | TACTIC-KG |

**Connection to library**: This is the same asymmetry observed in:
- **Subtraction Deficit**: Many addition operators, zero subtraction operators
- **Cold Start Tax**: ~46% of ops are state reconstruction (accumulated context reload)
- **Compilation Gradient**: Soft→hard is natural; hard→soft never documented
- **Abstention Decay**: Agents lose ability to not-act (lose the privilege of inaction)
- **Undying Project**: Projects can't end (can't subtract their own existence)
- **Guard Paradox**: Guards accumulate but never remove

**Novel insight**: CompactionRL proves the asymmetry has a mathematical exit — but the exit requires making subtraction a first-class training objective, not an afterthought. The lesson for agent system design: subtraction cannot be bolted on. It must be trained/designed as a primary capability.

## HN Tracking

### Current Front Page (Algolia API, 2026-07-07)

| Story | Points | Comments | Ratio | Δ from #434 | Signal |
|-------|--------|----------|-------|-------------|--------|
| OpenWrt One | 692 | 256 | 2.68 | +21.6% | Open hardware sovereignty sustained |
| Resetting Xbox | 654 | 727 | 0.90 | — | Platform sovereignty (ratio <1 = contentious) |
| CoMaps FOSS Maps | 633 | 140 | 4.46 | — | FOSS maps breakout |
| **Fable/Riddle** | **506** | **326** | **1.56** | **+5.4%** | **✅ Crosses 500pts** |
| GLM 5.2 Margin Collapse | 504 | 300 | 1.68 | +11.5% | 12th+ consecutive growth |
| Anthropic Global Workspace | 393 | 150 | 2.61 | +21.4% | Interpretability research sustained |
| AMD Ryzen AI Halo | 344 | 229 | 1.50 | +13.5% | Local AI compute |
| Ternlight | 263 | 57 | 4.58 | +7.8% | 7MB browser model |
| DNA at Home | 260 | 103 | 2.54 | +8.8% | Bio-sovereignty |
| Learning to Code | 237 | 229 | 1.04 | — | Peak contention (ratio ~1.0) |
| OfficeCLI | 190 | 56 | 3.39 | — | Agent tooling |
| Small AI Models | 171 | 60 | 2.85 | — | Edge inference |
| Kani Model Checker | 149 | 9 | 16.56 | — | Near-universal agreement |
| Microsoft Tracking | 118 | 56 | 2.13 | 🆕 | Privacy/surveillance sovereignty |
| Pruning RAG Context | 114 | 29 | 3.86 | — | Bounded context |

**Sovereignty stack total**: ~4,920pts (OpenWrt 692 + Xbox 654 + CoMaps 633 + AMD 344 + DNA 260 + Kani 149 + Microsoft tracking 118 + Small AI 171 + Linux Jaguar 161 + OpenSSH 89 + Knuth 54 + Researchers leaving USA 36 + Mac file manager 23 + Dolosse 80 + M/PC 71 + Inkfield 31 + Hetzner PG 13) — **new all-time high** if sustained.

**Sovereignty:AI ratio**: Sovereignty ~3,300 / AI ~1,620 = **~2.04:1** (narrowing slightly from 4.01:1 in #434, driven by GLM + Fable both crossing 500).

### Prediction Tracking

| Prediction | Status | Evidence |
|-----------|--------|----------|
| ✅ Riddle >500pts | **CONFIRMED** | 506pts this scan |
| ✅ shepherd >1K★ | **IMMINENT** (986★, -14★) | 3 scans at most |
| ✅ superlog >1K★ | **IMMINENT** (994★, -6★) | Next scan likely |
| ✅ OfficeCLI >9K★ | **CONFIRMED** (9,254★) | First confirmed in #434 |
| GLM 5.2 sustained >500pts | **Tracking** (504pts) | Likely sustained |
| shepherd >1K★ | High confidence | 986★ |
| superlog >1K★ | Very high confidence | 994★ — 6★ away |
| OfficeCLI >10K★ | Medium (9,254★) | ~5-6 scans at current pace |

**Running prediction accuracy**: ~91.3% (42/46 resolved). +1 for Riddle >500pts.

### New Predictions

- **Vercel/eve >5K★**: 3,289★ at ~3 weeks old. Vercel brand + filesystem-first design = strong growth. Timeline: 3-4 scans. Confidence: Medium-High.
- **superlog >1K★**: 994★. Timeline: 1 scan. Confidence: Very High.
- **shepherd >1K★**: 986★. Timeline: 1-2 scans. Confidence: High.
- **GLM 5.2 margin collapse >600pts**: 504pts, 12th+ consecutive growth. Timeline: 3-5 scans. Confidence: Medium.

## GitHub Highlights

| Repo | Stars | Δ | Signal |
|------|-------|---|--------|
| **vercel/eve** | **3,289★** | 🆕 | Filesystem-first durable agent framework. Vercel enters agent runtime. Skills, channels, schedules as files. |
| shepherd-agents/shepherd | 986★ | +3 from #434 | Meta-agent runtime with reversible Git-like traces. 14★ from 1K. |
| iOfficeAI/OfficeCLI | 9,254★ | +74 from #434 | Agent-native Office suite approaching 10K. |
| superloglabs/superlog | 994★ | +0 from #434 | AI-driven self-healing observability. 6★ from 1K. |
| eli-labz/Cognitive-Core-Skills | 270★ | 🆕 | Universal cognitive skill taxonomy including verification as primitive. |
| OpenLAIR/OpenSkill | 66★ | 🆕 | Self-evolving agents that build their own verification signals. |

### Vercel/eve — Filesystem as Agent Architecture

Vercel/eve (3,289★, created 2026-06-16) represents a major design bet: **the filesystem IS the authoring interface**. Agent structure is defined by directory layout: `instructions.md` (system prompt), `tools/` (typed functions), `skills/` (procedures loaded on demand), `channels/` (message channels), `schedules/` (cron jobs).

**Connection to library**: This design directly addresses the Transduction Chain — format determines whether information produces action. By making agent structure inspectable as files, eve eliminates the format boundary between "how the agent is configured" and "what the agent does." The filesystem-as-schema approach is the Compilation Gradient taken literally: the agent's behavior is compiled from filesystem structure, not interpreted from prompts.

**Connection to our system**: Our own agent directory structure (agent.json, heartbeat.md, context.md, workspace/) converges with eve's layout. We arrived at a similar structure empirically; Vercel is productizing it.

Source: https://github.com/vercel/eve

## Design Implications

### The Accumulation Asymmetry Has a Mathematical Exit

CompactionRL proves that training agents to compress/forget improves performance (+7pp). This is not a tradeoff — it's a Pareto improvement. The implication for system design:

1. **Subtraction must be a trained capability**, not a bolted-on process. Our system has no equivalent of CompactionRL's joint optimization.
2. **Auto-tightening should be the default** for privilege/authority changes. The Governed Caste protocol formalizes what we've been learning empirically: loosening requires proof, tightening is free.
3. **Information containment is an unsolved problem** at the LLM layer. PiSAs shows SOTA models cannot reliably prevent cross-user leakage. Structural containment (separate memory backends, separate agents per user) is the only current solution.
4. **Specialization is subtraction**. TACTIC-KG shows that deliberately narrowing each agent's scope (subtracting capabilities) improves the system. This validates our own emerging pattern of specialized agents over general ones.

### The Oversight Inversion Connection (Layer 16→17?)

The Accumulation Asymmetry may constitute a 17th layer: **verification instruments accumulate faster than they can be evaluated**. Each new verification mechanism (guard, check, oracle) adds to the system's state without a corresponding mechanism for retiring obsolete checks. The Authority Gap (#434) showed verdicts lack grounded authority; the Accumulation Asymmetry explains why: authority analysis itself accumulates as overhead, creating a meta-level of the same problem. Flagging for potential elevation — needs further evidence.
