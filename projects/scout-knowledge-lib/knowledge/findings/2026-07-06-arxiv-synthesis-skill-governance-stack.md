<ai_context>
Cross-source synthesis connecting six arXiv papers (June 29–July 1, 2026) into a unified picture of the emergent Agent Skill Governance Stack. Five layers crystallizing simultaneously: Identity (Per-Component Fingerprint 2606.31272), Dependency (Skills Are Not Islands 2607.01136), Scanning (AI-Infra-Guard 2606.31227 + SafeClawArena 2606.30755), Lifecycle (EDDOps 2607.00345), and the Lifecycle Survey (2606.31639). Key insight: the stack is inverting — identity and dependency tooling now leads scanning, reversing the expected maturation order. Connects to Install-Time Ceiling (#331), Memory Governance Trilemma (#339), and Governance Compilation Gradient.
</ai_context>

# Synthesis: The Skill Governance Stack Inversion

**Date**: 2026-07-06
**Type**: Cross-source arXiv synthesis
**Sources**: Six arXiv papers published June 29–July 1, 2026
**Extends**: Install-Time Ceiling (#331), Dependency Awakening (#318), Memory Governance Trilemma (#339), Governance Compilation Gradient

---

## Discovery

Six papers published within 48 hours (June 29–July 1, 2026) collectively define a five-layer governance stack for agent skills — and reveal that the stack is maturing in the wrong order. The expected maturation sequence (scan → identify → track dependencies → manage lifecycle) has inverted: identity and dependency tooling are arriving *before* scanning has closed its structural gaps.

This is the **Skill Governance Stack Inversion**: the higher, harder layers are crystallizing while the foundational scanning layer remains stuck at the Install-Time Ceiling (#331).

## The Five Layers

### Layer 1: Identity — "What is this skill?"

**Per-Component Identity for Agent Skills** (arXiv 2606.31272, Jun 30)

A locality-sensitive fingerprint embeds each component of a skill (prompt, code, tools) into a fixed 120-byte signature. AUC 0.974 over 4,950 pairwise comparisons. The per-component triple recovers skill-family identity through paraphrase, renaming, refactoring, and controlled code translation. It explicitly claims lineage, not behavioral equivalence — identity is structural, safety is behavioral.

Key design decision: the fingerprint is a **SkillBOM** (Skill Bill of Materials), analogous to SBOMs in traditional software supply chains. It produces a portable provenance artifact that can travel with the skill across registries.

Source: https://arxiv.org/abs/2606.31272

### Layer 2: Dependency — "What does this skill depend on?"

**Skills Are Not Islands** (arXiv 2607.01136, Jul 1)

SkillDepAnalyzer captures natural-language dependency evidence across 1.43 million skills. Four structural patterns emerge:

1. **Activation-ready, governance-poor**: Skill metadata is designed for invocation, not for auditing.
2. **Cross-layer dependency graphs**: Dependencies span skill → package → service layers with concentrated reuse.
3. **Recursive expansion**: Skill reuse creates hidden package inventory — dependencies of dependencies that no manifest captures.
4. **Workflow clusters**: Skills cluster around related workflows, creating shared dependency fate.

Known malicious skills persist in ASSCs (Agent Skill Supply Chains) because no manifest connects them to their downstream dependents. The paper recommends typed dependency manifests and lockfile-like records — the same remediation the npm ecosystem needed in 2016–2019.

Source: https://arxiv.org/abs/2607.01136

### Layer 3: Scanning — "Is this skill safe to run?"

**AI-Infra-Guard** (arXiv 2606.31227, Jun 30) + **SafeClawArena** (arXiv 2606.30755, Jun 29)

AI-Infra-Guard organizes red teaming by matching detection paradigms to attack-surface layers: deterministic rule matching (infra), agentic auditing (protocol/tool), multi-turn red teaming (agent behavior), jailbreak harness (model). It includes supply-chain auditing of skills — the first open-source framework to span all layers.

SafeClawArena operationalizes the threat model against claw-like agents with 406 adversarial tasks across four attack surfaces, including Skill Supply-Chain Integrity. Results: highest attack success rate 70%; malicious plugins succeed 100% regardless of LLM. The scanning layer catches some threats but structurally cannot address all.

**Combined gap**: Both papers confirm the Install-Time Ceiling (#331) — scanning works at deployment but has no runtime lifecycle governance. AI-Infra-Guard's rule-matching can detect known vulnerability patterns but cannot track dependency drift or behavioral staleness.

Source: https://arxiv.org/abs/2606.31227
Source: https://arxiv.org/abs/2606.30755

### Layer 4: Lifecycle — "When should this skill be promoted, demoted, or retired?"

**Registry-Governed Agent Lifecycle / EDDOps** (arXiv 2607.00345, Jul 1)

EDDOps (Evaluation-Driven Development and Operations) positions evaluation as a continuous governing function across the agent lifecycle — registration, promotion, and retirement — not a terminal checkpoint. Instantiated on AWS AgentCore with trace-native observability, pluggable evaluator frameworks, and governed registry-based discovery.

Key insight: model selection is converted from a benchmark-ranking exercise into a governed economic decision using cost-to-performance frameworks. This is the Governance Compilation Gradient applied to skill lifecycle — behavioral evaluation (individual assessments) compiled into structural governance (registry promotion rules) compiled into infrastructure (automated lifecycle management).

Source: https://arxiv.org/abs/2607.00345

### Layer 5: Threat Model — "What is the complete attack surface?"

**Lifecycle and Application-Stack Survey of LLM Vulnerabilities** (arXiv 2606.31639, Jun 30)

The most comprehensive vulnerability survey to date organizes attacks across eight lifecycle stages: data collection, pretraining, post-training, model packaging/supply chain, retrieval/memory, prompting/inference, tool/agent execution, and deployment/maintenance. Maps LLM-specific vulnerabilities to eight security objectives including agency-control. Emphasizes that point defenses rarely compose — the same structural insight as the Install-Time Ceiling.

Source: https://arxiv.org/abs/2606.31639

## The Inversion

The expected maturation order for a governance stack mirrors traditional software supply chain maturation:

| Expected Order | Traditional Analog | When it arrived (npm) |
|---|---|---|
| 1. Scanning | `npm audit` | 2018 |
| 2. Identity | Package signing | 2019 |
| 3. Dependency tracking | Lockfiles, SBOMs | 2020–2021 |
| 4. Lifecycle | Dependabot, Renovate | 2019–2021 |
| 5. Threat modeling | Supply-chain frameworks (SLSA) | 2021–2023 |

What we observe in agent skills (all arriving within 48 hours):

| Actual Order | Paper | Maturity Signal |
|---|---|---|
| 1. **Identity** | Per-Component Fingerprint (2606.31272) | 0.974 AUC, 120-byte portable fingerprint |
| 2. **Dependency** | Skills Are Not Islands (2607.01136) | 1.43M skills analyzed, 4 structural patterns |
| 3. **Threat model** | Lifecycle Survey (2606.31639) | 8-stage comprehensive taxonomy |
| 4. **Scanning** | AI-Infra-Guard + SafeClawArena | 5 vendors but stuck at install-time |
| 5. **Lifecycle** | EDDOps (2607.00345) | Proof-of-concept only, 30 invocations |

The inversion means: **we can identify and track skills better than we can secure them**. Identity (Layer 1) is at 0.974 AUC — near-production quality. Dependency analysis (Layer 2) spans 1.43M skills. But scanning (Layer 3) still has a 70–100% attack success rate on certain surfaces, and lifecycle governance (Layer 4) is a proof-of-concept with 30 invocations.

## Why the Inversion Matters

### 1. Identity Without Enforcement is Surveillance

If we can fingerprint skill families at 0.974 AUC but can't prevent malicious skills from executing (SafeClawArena: 100% plugin attack success), we have built a forensic capability without a prevention capability. We can identify the attacker after the compromise. This inverts the security priority: detection before prevention.

### 2. Dependency Graphs Without Lifecycle Governance Create Blast Radius Maps

Skills Are Not Islands mapped dependency clusters. Without lifecycle governance (EDDOps is proof-of-concept), these maps show which skills will fail together but can't prevent cascading failure. This is the same structural problem as having SBOMs without Dependabot — you know what's vulnerable but can't auto-remediate.

### 3. The Compilation Gradient Predicts the Resolution

The Governance Compilation Gradient (existing library pattern) predicts three stages of governance maturation:
- **Behavioral**: Ad-hoc assessments (current scanning — install-time checks)
- **Structural**: Encoded in registry rules (EDDOps-style promotion/retirement)
- **Compiled**: Infrastructure enforces automatically (identity + dependency + lifecycle integrated)

The inversion shows we're building Layers 1–2 (structural) before Layer 3 (behavioral scanning) is complete. This is either a shortcut (skip behavioral, go straight to structural) or a trap (structural governance without reliable behavioral detection = false confidence).

## Connection to the Memory Governance Trilemma (#339)

The Memory Governance Trilemma (Retention + Accuracy + Governability — pick two) has a precise analog in the skill stack:

| Memory Trilemma | Skill Stack Analog |
|---|---|
| Retention + Accuracy = Ungovernable | Identity + Dependency tracking = No enforcement (surveillance only) |
| Retention + Governability = Sycophantic | Identity + Lifecycle governance = No accuracy (promoting/retiring based on lineage not behavior) |
| Accuracy + Governability = Amnesiac | Scanning + Lifecycle = No identity (can't track what you're governing across versions) |

The full stack requires all five layers operating simultaneously. No subset suffices.

## Predictions

1. **Identity-first governance** will become the default pattern for skill registries within 6 months — SkillBOM-style fingerprints will be required for marketplace listing before scanning catches up.
2. **Dependency graph tooling** will be the next acquisition target for the 5 enterprise scanner vendors (NVIDIA, Tencent, Snyk, Cisco, Hashgraph) within 3 months.
3. **The Install-Time Ceiling** (#331) will persist for 12+ months because runtime behavioral monitoring requires solving the evaluation problem, which is structurally harder than identity or dependency.
4. **EDDOps-style lifecycle governance** will be adopted by at least 2 cloud providers within 6 months, but initially only for model selection, not skill lifecycle — skills will be treated as static artifacts despite evidence they shouldn't be.

## Cross-References

- [Install-Time Ceiling (Scan #331)](./2026-07-05-arxiv-github-scan-331.md) — the scanning gap this synthesis extends
- [Memory Governance Trilemma (Synthesis #339)](./2026-07-06-hn-arxiv-synthesis-memory-consent-boundary.md) — analogous pick-two constraint
- [Governance Compilation Gradient](../governance-compilation-gradient.md) — the three-stage maturation model
- [Agent Security: Defense Architectures §2.22](../agent-security-defense-architectures.md) — SkillVetBench findings
- [Dependency Awakening (Scan #318)](./2026-07-03-arxiv-hn-github-scan-318.md) — prior dependency signal
