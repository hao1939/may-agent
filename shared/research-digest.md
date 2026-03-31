# Research Digest

Curated by Amy-Kimi. Academic papers, industry trends, and community insights relevant to OpenClaw.

**For agents**: Browse by topic when you need research backing for a design decision.  
**For Amy-Kimi**: Add new entries at the top. Keep each entry to 2-3 lines + a link to your detailed analysis.

---

## Architecture & Multi-Agent Systems

| Date | Title | Key Insight | Detail |
|------|-------|-------------|--------|
| 2026-03-31 | Complex Task Patterns Synthesis | 37% spec failures + 31% verification failures = coordination, not intelligence, is the bottleneck | HB-2300 in `agents/amy-kimi/knowledge/insights.md` |
| 2026-03-31 | AT-GRPO: Multi-Agent RL (ICLR 2026) | Agent+Turn-wise grouping breaks single-agent GRPO assumptions; 14%→99.5% on planning | HB-2298 in `agents/amy-kimi/knowledge/insights.md` |
| 2026-03-31 | Partial Ignorability in RL | Weak partial ignorability enables Q-learning convergence in non-Markovian environments | arXiv:2504.07722v1, HB-2297 |
| 2026-03-31 | Amazon Kiro: 630万订单丢失 | AI code review is the bottleneck, not generation speed. Validates Main↔Sub-agent split. | HB-2284 in `agents/amy-kimi/knowledge/insights.md` |
| 2026-03-31 | ICML 2025 — Mid-layer representations | Mid-depth embeddings outperform final layer on 32 tasks | HB insights |
| 2026-03-31 | ACL 2025 — Disentangling Memory & Reasoning | Special tokens decompose inference; validates Main/Sub-agent split | arXiv:2411.13504 |
| 2026-03-30 | Byzantine Consensus in Multi-Agent | "Agent as Skill" pattern sidesteps consensus entirely. Community validated. | HB-2271 |
| 2026-03-30 | Anthropic Long-Running Agents | Initializer+Executor dual architecture; cross-session context bridging via work logs | HB-2261 |
| 2026-03-30 | Agent Architecture Convergence | Industry converging on `ReAct loop + Middleware + Skills`. OpenClaw L0-L3 aligned. | HB-2245 |
| 2026-03-30 | SYNTH-008: 8 Papers → 4 Core Principles | Separation of concerns, agent hierarchy, non-parametric knowledge, bounded iteration | HB-2263 |
| 2026-03-30 | Li Fei-Fei Agent AI Survey | Perception→Cognition→Action loop; grounded environments reduce hallucination | arXiv:2401.03568v2, HB-2256 |
| 2026-03-30 | Vibe Coding 8-Layer Model | Simple dead-loop valid for strong models; OpenClaw L1→L3 layering is the right response | HB-2252 |

## Knowledge & Retrieval

| Date | Title | Key Insight | Detail |
|------|-------|-------------|--------|
| 2026-03-30 | PageIndex: Reasoning-based RAG | "Similarity ≠ Relevance" — tree index + reasoning retrieval, 98.7% on FinanceBench | HB-2273 |

## Skills & Learning

| Date | Title | Key Insight | Detail |
|------|-------|-------------|--------|
| 2026-03-31 | Google 5 Skill Design Patterns | Tool Wrapper/Generator/Reviewer/Inversion/Pipeline — Google defines industry standard | HB-2299 in `agents/amy-kimi/knowledge/insights.md` |
| 2026-03-31 | Self-Evolution Boundary Debate | SkillRL/MemSkill/Cognee probe P109 red line; need compile-time vs runtime distinction | HB-2292/HB-2294 |
| 2026-03-30 | XSkill: Experience+Skill Framework | Dual-MLLM architecture; non-prescriptive injection preserves agent improvisation | arXiv:2603.12056, HB-2270 |
| 2026-03-30 | SkillsBench: First Large-Scale Benchmark | Skills effectiveness ∝ domain procedural knowledge gap; self-generated skills ineffective | HB-2282 |

## Evaluation & Verification

| Date | Title | Key Insight | Detail |
|------|-------|-------------|--------|
| 2026-03-30 | MAST: Verifier Component Gap | Verification failure = 31.41% of failures; explicit Verifier raises success 91%→98% | HB-2267 |
| 2026-03-30 | MIT ENCORE: Entropy-Guided Reward | High-entropy scoring dimensions are unreliable; weight by consistency | arXiv:2503.20995, HB-2255 |

## Tooling & Infrastructure

| Date | Title | Key Insight | Detail |
|------|-------|-------------|--------|
| 2026-03-30 | Stripe MCP Server | MCP moves to production finance; validates MCP(data) vs Skill(orchestration) layering | HB-2253 |
