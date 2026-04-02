# DD#407 — ColliderAgent: End-to-End Hierarchical Multi-Agent Architecture for Autonomous Scientific Phenomenology (arXiv:2603.14553) ★★★★★

**Date:** 2026-03-17 | **Scout Session:** s_1773767094565_165
**Paper:** "An End-to-end Architecture for Collider Physics and Beyond"
**Authors:** Shi Qiu, Zeyu Cai, Jiashen Wei, Zeyu Li, Yixuan Yin, Qing-Hong Cao, Chang Liu, Ming-xing Luo, Xing-Bo Yuan, Hua Xing Zhu (Peking University, CCNU, BCSRC)
**Venue:** hep-ph, cross-listed cs.AI + cs.MA | GitHub: HET-AGI/ColliderAgent | 14 stars
**Implementation:** Built on Claude Code / Claude Agent SDK with portable Agent Skills

---

## Core Contribution

First language-driven agent system capable of executing **end-to-end collider phenomenology** — from a theoretical Lagrangian (specified in natural language + LaTeX) to publication-ready figures (kinematic distributions, exclusion limits, parameter scans) — without any package-specific code. The architecture is **domain-agnostic in design** and instantiated for High-Energy Physics (HEP) as "ColliderAgent."

## Architecture (★★★★★ for MAS design)

### Decoupled Reasoning-Execution Separation

The key architectural innovation is a **strict separation between cognitive reasoning and computational execution**:

1. **Cognitive Reasoning Layer** — Hierarchical multi-agent system with specialized sub-agents
2. **Execution Backend (Magnus)** — Unified platform hosting HEP toolchains (FeynRules, MadGraph, Pythia, Delphes, MadAnalysis, Mathematica/Wolfram)
3. **Standardized CLI** — Communication bridge between reasoning and execution

This mirrors the microservices pattern where intelligence is decoupled from compute.

### Five-Agent Hierarchy

| Sub-Agent | Skills Loaded | Role |
|-----------|--------------|------|
| **Orchestrator** | `pheno-pipeline-orchestrator` | Decomposes user requests into sub-tasks, assigns to downstream agents |
| **Model Generator** | `feynrules-model-generator`, `feynrules-validator`, `ufo-generator` | Translates LaTeX Lagrangian → FeynRules .fr → validated UFO model |
| **Collider Simulator** | `madgraph-simulator` | Writes MadGraph scripts/cards, runs parton-level sim + Pythia showering + Delphes detector sim |
| **Event Analyzer** | `madanalysis-analyzer` | Event selection, cutflows, histogram extraction |
| **Pheno Analyzer** | (no dedicated skill — uses raw LLM reasoning) | Profile-likelihood analysis, exclusion limits, parameter scans, plotting |

### Agent Skills as Portable Knowledge Modules

The **Agent Skills** abstraction is the most transferable design pattern:

- Each skill is a **lightweight directory** containing:
  - `SKILL.md` — Machine-readable specification (trigger conditions, inputs/outputs, workflow guidance, parameter conventions, example invocations)
  - `references/` — Condensed domain documentation (syntax rules, software conventions, command references, annotated examples)
  - `templates/` — Skeleton files (e.g., model file templates)
- Skills are **portable across agent frameworks** — tested with Claude Code, Cursor, and Codex
- Based on Anthropic's open standard for packaging agent capabilities

### Coordination via Structured Progress Records

Inter-agent state sharing uses **compact Markdown summaries** written to a shared progress directory:
- Each sub-agent writes a summary upon task completion
- Records capture essential physical assumptions, software-state info, and intermediate outputs
- Downstream agents read relevant progress records to recover context
- **Avoids carrying full conversation history** across the pipeline

### Validation-and-Repair Loop

Before expensive computation, the model-generator invokes a dedicated validator that:
1. Syntax checks the generated model file
2. Runs FeynRules consistency tests (Hermiticity, etc.)
3. Test-loads the exported UFO model in MadGraph
4. On failure: parses diagnostic output, revises, and re-validates

This is a **closed-loop self-correction pattern** that catches errors before they cascade into expensive downstream compute.

## Key Results

Validated on four representative benchmarks from published literature:

1. **Leptoquark resonance production** — Full parton→shower→detector→analysis pipeline, including non-standard PDF handling (LUXlep) and Pythia workarounds
2. **ALP EFT operators** — Correct generation of EFT model files for electroweak vertices from higher-dimensional operators
3. **U(1)' parameter scan** — 2D exhaustive scan across gauge coupling × mixing parameter for 3 mass hypotheses; "compressed weeks of manual scripting into hours"
4. **Detector-level mono-τ analysis** — Full inference pipeline including ATLAS/CMS detector configs, profile-likelihood analysis, exclusion contour extraction

All benchmarks specified via natural-language prompts + standard physics notation only.

## Architectural Patterns for MAS Research (Why ★★★★★)

### Pattern 1: Skill-Based Modular Agent Design
Each sub-agent's competence is defined by **declarative skill files** rather than hardcoded logic. This is directly applicable to any domain-specific multi-agent system — define skills as portable directories with documentation, templates, and examples.

**Connection to DD#401 (Token Coherence):** Both papers solve the problem of coordinating heterogeneous agents operating on different "languages" (HEP tools vs. cache protocols). ColliderAgent uses skills as the translation layer; DD#401 uses protocol adaptation.

### Pattern 2: Reasoning-Execution Decoupling
The cognitive layer never runs computations directly — it writes instructions that the execution backend interprets. This is the **"brain in a vat" pattern** we've seen emerging across several recent papers.

**Connection to DD#400 (Hardware-Inspired Coordination):** The CLI-mediated reasoning↔execution separation maps to the bus architecture in DD#400's hardware analogy, where cognitive agents are processors and execution backends are memory/accelerators.

### Pattern 3: Progress Records as Bounded Context
Rather than passing full conversation history (which grows linearly and eventually overflows context), the system uses **compact structured summaries**. This is essentially a form of **bounded staleness** (DD#376, DD#401) applied to inter-agent communication.

### Pattern 4: Validate-Before-Commit
The self-correction loop catches errors at the model-generation stage before expensive simulation runs. This is a **transaction-like pattern** — validate before committing expensive irreversible compute.

**Connection to DD#392 (SAGE Self-Evolution):** Both systems use iterative self-correction, but ColliderAgent applies it at the tool-output level rather than the reasoning level.

## Limitations

1. **Single-author LLM dependency** — Built specifically on Claude; no multi-model orchestration
2. **Domain knowledge baked into skills** — The Agent Skills were "systematically curated by the authors on the basis of domain expertise and refined through extensive iterative testing" — not learned or discovered automatically
3. **No parallelism across sub-agents** — Pipeline is sequential (model → sim → analysis → pheno); no concurrent execution of independent stages
4. **Validation scope** — Self-correction only covers model-generation errors; downstream simulation bugs or physics errors are not caught
5. **Reproducibility questions** — LLM non-determinism means re-runs may produce slightly different workflows

## Synthesis

ColliderAgent is the strongest example yet of **skill-based hierarchical multi-agent architecture** applied to a real scientific domain with end-to-end validation. The key insight — that domain expertise can be packaged as portable, declarative skill directories that any agent framework can load — is immediately transferable. The reasoning-execution decoupling pattern, combined with structured progress records for inter-agent context sharing, provides a clean template for building domain-specific MAS that orchestrate complex heterogeneous toolchains.

The paper also demonstrates that **MAS architectures scale to real scientific workflows** that previously required weeks of expert manual effort, compressing them into hours of autonomous operation. This validates the thesis from our DD#400 synthesis that hardware-inspired patterns (bus architectures, modular processors, validation gates) are converging as the dominant paradigm for practical multi-agent coordination.

---

**Cross-references:** DD#400 (Hardware-Inspired Coordination), DD#401 (Token Coherence), DD#376 (Bounded Staleness), DD#392 (SAGE Self-Evolution)
**Tags:** #hierarchical-MAS #skill-based-agents #reasoning-execution-separation #scientific-automation #HEP #domain-agnostic #self-correction #Claude-Agent-SDK
