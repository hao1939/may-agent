# Papers & Articles

Papers and articles worth reading, with key takeaways.

## 2026-02-26 HF Daily Papers Batch — New Entries

| ID | Title | Relevance |
|----|-------|-----------|
| 2602.20945 | Art of Efficient Reasoning | ★★★ Core — efficient CoT training mechanics, 0.2M GPU hours validation |
| 2602.19633 | TAPE: Tool-guided Adaptive Planning | ★★★ Core — graph-plan + constrained execution for robust agents |
| 2602.18998 | General AgentBench | ★★★ Critical — TTS ceiling + verification gap failure modes for general agents |
| 2602.21198 | Reflective Test-Time Planning | ★★★ Strong — reflection-in/on/retrospective for embodied agents, TTT + TTS combo |
| 2602.16745 | PETS: Efficient Test-Time Self-Consistency | ★★ Solid — principled trajectory allocation, 75% budget reduction |
| 2602.18940 | DREAM: Deep Research Evaluation | ★★ Solid — capability parity principle, agentic evaluation framework |
| 2602.16932 | RankEvolve: Evolutionary Retrieval Algorithms | ★★ Interesting — AlphaEvolve pattern applied to IR |
| 2602.21015 | CHAIN: Interactive Vision Reasoning Benchmark | ★ Borderline — 3D physical constraints benchmark, VLM agents |
| 2602.21193 | Nemotron-Terminal | Already archived HB21 |
| 2602.20739 | PyVision-RL | Already archived HB19 |
| 2602.21201 | Aletheia on FirstProof | Already archived HB21 |
| 2602.20424 | Implicit Intelligence | Already archived HB21 |

## 2026-03-09 — Deep-Dived from Feb 26 Backlog

| ID | Title | Status |
|----|-------|--------|
| 2602.19633 | TAPE: Tool-Guided Adaptive Planning | ★★★ **DEEP-DIVED** — Plan graph + ILP solver + constrained decoding. +21pp on hard tasks. Sampling error eliminated to 0%. M=4 plans optimal. (ref: deep-dive-tape-general-agentbench.md) |
| 2602.18998 | General AgentBench: Benchmark TTS of General Agents | ★★★ **DEEP-DIVED** — Context ceiling + verification gap. Claude Sonnet 4.5 only 0.2% degradation in general setting vs 10-30% for others. Sequential scaling fails beyond ceiling; parallel scaling limited by self-choice inability. (ref: deep-dive-tape-general-agentbench.md) |
| 2602.20945 | Art of Efficient Reasoning | ★★★ **DEEP-DIVED** — Two-stage paradigm (length adaptation → reasoning refinement). Train on easy prompts for dense rewards. L_R=L_T avoids "short=correct" trap. 3 failure modes for negative rollout handling. Validated 0.6B-30B Qwen3. (ref: deep-dive-arxiv-2602-20945-art-of-efficient-reasoning.md) |
| 2602.21198 | Reflective Test-Time Planning | ★★★ **DEEP-DIVED** — Three-LLM architecture (Generator/Internal-Eval/External-Eval). Reflection-in-action (TTS) + reflection-on-action (TTT) are mutually dependent — removing one can be worse than removing both. Retrospective hindsight for credit assignment. 44.7% vs 10.6% baseline on Fitting. N=4-6 candidates optimal. (ref: deep-dive-arxiv-2602-21198-reflective-test-time-planning.md) |

## 2026-03-11 — New Batch (Mar 5-6 arXiv Scan)

| ID | Title | Relevance |
|----|-------|-----------|
| 2603.06333 | SAHOO: Safeguarded Alignment for Recursive Self-Improvement | ★★★ Core — GDI (4-signal drift detector) + constraint preservation + regression risk. Data-driven thresholds, CAR frontier. ICLR 2026 Workshop. **DEEP-DIVED** (ref: deep-dive-arxiv-2603-06333-sahoo-recursive-self-improvement.md) |
| 2603.06007 | MASFactory: Graph-centric MAS Orchestration with Vibe Graphing | ★★ Solid — NL intent → editable workflow spec → executable graph. Reproduces ChatDev/MetaGPT/AgentVerse/CAMEL/HuggingGPT. 14⭐ GitHub. BUPT-GAMMA. |
| 2603.06394 | Schema-Gated Agentic AI for Scientific Workflows | ★★ Solid — 18-expert interviews surface ED vs CF tension. Schema as mandatory execution boundary. Multi-model scoring (α=0.80-0.98). Cambridge/Intellegens. |
| 2603.05069 | Jagarin: Three-Layer Architecture for Personal Duty Agents on Mobile | ★★ Interesting — DAWN (urgency scoring) + ARIA (email→duty ingestion) + ACE (agent-centric exchange protocol). User-aligned by design (not institution-deployed). Novel mobile agent architecture. |
| 2603.06222 | SPOT: Span-level Pause-of-Thought for Efficient Latent Reasoning | ★★ Solid — Compresses CoT into latent pause tokens via optimal transport. +2.3pp accuracy, -37.5% tokens. Frozen-head decoding for interpretability. |
| 2603.06565 | H²RL: Hybrid Hierarchical RL with Logical Options Pretraining | ★ Niche — Symbolic pretraining → neural refinement for long-horizon RL. Not directly agent-relevant. |
| 2603.05621 | RACAS: Robot-Agnostic Control via Agentic Systems | ★★ Interesting — 3 LLM/VLM modules (Monitors/Controller/Memory Curator) communicate via NL for closed-loop robot control. Zero-transfer across wheeled/jointed/underwater platforms. |
| 2603.05839 | Evaluating LLM Alignment With Human Trust Models | ★ Niche — White-box trust representation analysis in GPT-J-6B. Finds Castelfranchi socio-cognitive model alignment. |
