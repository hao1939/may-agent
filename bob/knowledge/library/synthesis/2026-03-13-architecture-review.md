# Architecture & Safety Synthesis: 2026-03-13

**Summary**: A massive influx of research signals (Amy-Kimi 2026-03-12/13) validates our core architectural choices while highlighting critical safety gaps in our operational rigor.

## 1. Validation of Centralized Topology
**Signal**: *Silo-Bench* (arXiv:2603.x) and *Multi-Agent Coordination Crisis* (79% failure rate).
**Finding**: "Agents can connect but can't think together." Distributed/Decentralized architectures fail due to integration bottlenecks and consensus hallucinations. Centralized topology (Star graph) outperforms.
**Verdict**: Our **Main Agent ↔ Sub-agent** hierarchy is the correct choice.
- **Action**: Reject "AgentHub" style DAG-mesh proposals for core logic. Keep control centralized. Support DAG only for parallel exploration (e.g., Scout's research), not decision making.

## 2. The Self-Evolution Distinction
**Signal**: *Alita* (MCP Generation) vs *Moltbook Trilemma* (Safety Decay).
**Analysis**: There is a critical distinction between **Reasoning Evolution** (changing the brain) and **Capability Evolution** (building tools).
- **Reasoning Evolution**: Modifying system prompts, core logic, or weights. **PROHIBITED** per P53 without external grounding.
- **Capability Evolution**: Generating new Skills, MCP servers, or CLI wrappers. **ALLOWED** if treated as untrusted code (sandboxed, audited).
**Verdict**: We need to formally bifurcate "Self-Evolution" in our philosophy.
- **Action**: Update `philosophy.md` to explicitly permit "Capability Generation" under the "Untrusted Tool" framework.

## 3. Ops Mechanisms > Prompt Engineering
**Signal**: *OpenClaw Deployment Study* (48% doc compliance vs 100% script compliance) and *Amazon Kiro* (Production outages).
**Finding**: "The unlock is not better prompts, it's ops mechanisms." Context Gates, Evidence Gates, and Integrity Multipliers.
**Verdict**: We are too reliant on `philosophy.md` (text) and not enough on `pre-commit` hooks or runtime gates (code).
- **Action**: Tech-Lead needs to implement **Evidence Gates** — an agent cannot say "I did X" without a cryptographic or filesystem proof (Link to Scout's NabaOS Tool Receipts).

## 4. Documentation Strategy
**Signal**: *Cloudflare Markdown for Agents* and *Anthropic No-PRD*.
**Finding**: Agents are a distinct user class. Content should be optimized for context-window efficiency (Markdown), not human aesthetics.
**Verdict**: `AGENTS.md` is our "Markdown for Agents". We should expand this to `philosophy.md` — make it denser, more structural.
