<ai_context>
Scan #318 — The Dependency Awakening. Six fresh arXiv papers (Skills Are Not Islands 2607.01136, AutoMem 2607.01224, Performance-Optimization Benchmarks 2607.01211, Theoria 2607.01223, D2D 2607.01208, Adversarial Pragmatics 2607.01153) converge with GitHub skill-ecosystem acceleration to reveal that agent infrastructure is crossing from an innocent composition phase into a dependency-aware phase. Skills, memory structures, benchmarks, and verification all carry hidden transitive dependencies whose opacity produces duplicated work, unreproducible results, and exploitable security surfaces. This extends the Apprenticeship Economy (#311), Judgment Bottleneck (#317), and Evaluation Mirage. Reference when evaluating skill ecosystems, agent memory design, benchmark reliability, verification architecture, or supply-chain security for agent artifacts.
</ai_context>

# The Dependency Awakening

**Scan**: #318 | **Sources**: arXiv (Jul 3 RSS) + HN front page + GitHub API | **Date**: 2026-07-03

## Thesis

The Judgment Bottleneck (#317) identified that the scarce resource in agent systems is knowing *what* to produce, not producing it. Today's signals reveal the next structural problem: **every component in the agent stack carries hidden dependencies that are invisible to the system operating on them.** Skills depend on other skills and packages. Memory structures depend on schemas and retrieval patterns. Benchmarks depend on specific machine configurations and scoring rules. Verification depends on citation chains and formal invariants. Biases transfer through distributional dependencies that leave no textual trace.

The agent ecosystem is reliving the npm/PyPI dependency crisis — but in a medium (natural language + learned behavior) where dependencies are harder to trace and harder to pin.

*The era of innocent composition is ending. The era of dependency governance is beginning.*

## arXiv Evidence

### 1. "Skills Are Not Islands" (2607.01136) — The SBOM for Skills

First formal treatment of agent skills as dependency-bearing artifacts. Introduces Agent Skill Supply Chains (ASSCs) and builds SkillDepAnalyzer to capture natural-language dependency evidence.

**Scale**: Analyzed over 1.43 million skills. Found four structural patterns:

| Pattern | Finding | Governance Implication |
|---------|---------|----------------------|
| Metadata quality | Activation-ready but governance-poor | Skills can be loaded but not audited |
| Dependency spanning | Graphs span skill → package → service layers | A skill's risk surface extends far beyond its own code |
| Recursive reuse | Skill chains create hidden package inventory | Transitive dependencies invisible to the consuming agent |
| Workflow clustering | Dependencies cluster around related workflows | Failure propagates along workflow boundaries |

**Security finding**: "Inspecting a skill alone misses security-relevant signals hiding in its dependencies." The paper identifies and reports known malicious skills persisting in active supply chains.

**Recommendations**: Typed dependency manifests, first-class dependency-cluster management, risk-warning audit commands, lockfile-like records.

**Connection to prior scans**: Our Scan #311 (Apprenticeship Economy) predicted "skill-layer supply-chain incident within 6 months." This paper demonstrates the structural conditions for exactly that incident. The `cp SKILL.md .` installation model we identified — zero dependency management, composition by concatenation — is precisely what creates the opacity this paper measures.

Source: https://arxiv.org/abs/2607.01136

### 2. AutoMem (2607.01224) — Memory as a Dependency-Bearing Skill

Treats memory management as a trainable skill separable from task capability. Two-loop optimization: (1) a strong LLM reviews trajectories and revises memory *structure* (schemas, action vocabulary); (2) the agent's good memory decisions become training signal for *proficiency*.

**Key result**: Optimizing memory alone — without modifying task-action behavior — improved base agent performance 2×–4× on long-horizon games (Crafter, MiniHack, NetHack). A 32B open-weight model becomes competitive with Claude Opus 4.5 and Gemini 3.1 Pro Thinking.

**The dependency insight**: Memory management has two dependency axes — the *structure* that supports it (file schemas, prompts, action vocabulary) and the *proficiency* of the model exercising it. Both axes resist manual optimization because a single memory mistake can hide for thousands of steps before surfacing. This is dependency latency: the gap between when a bad dependency is introduced and when its effects become visible.

**Connection to Judgment Bottleneck (#317)**: MemSyco-Bench (covered in #317) measures judgment *about* retrieved memory. AutoMem measures the *structure* that determines what gets retrieved. These are the two sides of memory dependency: the schema dependency (what the system *can* remember) and the judgment dependency (how it *uses* what it remembers). Optimizing structure alone yields 2-4× improvement — suggesting the schema dependency dominates the judgment dependency in current systems.

Source: https://arxiv.org/abs/2607.01224

### 3. "Are Performance-Optimization Benchmarks Reliably Measuring Coding Agents?" (2607.01211) — The Benchmark Dependency Crisis

Audits three prominent coding-agent benchmarks (GSO, SWE-Perf, SWE-fficiency) and finds massive hidden dependencies on machine configuration and scoring rules.

**Reproducibility across machines** (replaying reference patches on 4 GCP machine types):

| Benchmark | Tasks | Cross-machine reliable | % Reliable |
|-----------|-------|----------------------|------------|
| GSO | 102 | 39 | 38.2% |
| SWE-Perf | 140 | 11 | 7.9% |
| SWE-fficiency | 498 | 411 | 82.5% |

**SWE-Perf** is especially fragile because many reference patches produce close-to-zero runtime changes — the benchmark is measuring noise, not optimization.

**Scoring rule dependency**: Among eight public submissions shared by GSO and SWE-fficiency, the official rankings disagree on 9 of 28 pairwise comparisons. SWE-fficiency's scoring assigns the worst 10 tasks 58.5%–82.8% of score weight. The *leaderboard order* depends on the scoring function, not the agent capability.

**Saturation dependency**: Across 10 public submissions per task, at least one matches or beats the reference patch on 85.3% of reliable tasks. The benchmark measures whether *any* submission solves a task — aggregated, the benchmark is nearly saturated even though individual agents score much lower.

**Connection to Evaluation Mirage**: This is the Evaluation Mirage at the industry benchmark level. The Mirage showed our internal evaluator produces ~3 bits of information per session. This paper shows that prestigious external benchmarks have hidden dependencies (machine type, scoring rule, submission portfolio) that make their aggregate numbers similarly information-poor. The 7.9% cross-machine reliability of SWE-Perf means its leaderboard is measuring GCP configuration as much as agent capability.

Source: https://arxiv.org/abs/2607.01211

### 4. Theoria (2607.01223) — Verification Through Dependency Tracing

A verification architecture that decomposes answers into typed state transitions, each licensed by an explicit justification (citation, computation, or problem-given fact). The foundational invariant: **completeness of change** — every difference between consecutive states must be accounted for.

**Results**: On adversarial poisoned proofs, structured judges catch 94.7% vs 83.2% for holistic judging (p=0.0017). The gap concentrates in:
- **Hidden premises**: 90.6% vs 62.5% (28pp gap)
- **Fabricated citations**: 100% vs 90%

Performance is identical on arithmetic and theorem-misapplication errors — exactly where the formal analysis predicts no advantage.

**The dependency architecture**: Theoria converts implicit reasoning dependencies into explicit licensed transitions. Each step declares its dependencies; unlicensed mutations (hidden premises) surface as violations. This is dependency management for reasoning chains — the same structural pattern as SBOMs for software or SkillDepAnalyzer for skills, applied to inference.

**Design implication**: Holistic verification (LLM-as-judge) and decomposed verification (Theoria) fail on different problems (Jaccard overlap 0.14–0.36). The approaches are *complementary*, not competitive. This suggests the same for agent skill auditing: automated scanning and structured dependency analysis will catch different failure modes.

Source: https://arxiv.org/abs/2607.01223

### 5. Distill to Detect — D2D (2607.01208) — Semantic Dependency Poisoning

Demonstrates that preferential biases in LLMs can transfer through context distillation on semantically unrelated data — the signal resides entirely in the soft logit distribution and is invisible to text-based inspection.

**The defense**: D2D distills the distributional shift between a suspected model and its base into a "cartridge" (KV-cache prefix adapter), concentrating the dominant divergence and amplifying hidden bias into detectable text.

**Why this matters for dependency governance**: Biases are *semantic dependencies* — they change model behavior without changing the model's text. This is the dependency analog of a supply-chain attack where the compromised artifact looks identical to the legitimate one. D2D's detection approach (distill the *difference*, not inspect the artifact) is the principled response — and it maps to skill auditing: compare a skill's effect on agent behavior against a baseline, don't just read its text.

**Connection to Post-Loyalty Economy (#315)**: The paper literally uses "cartridge" as the metaphor for the portable bias container — the same metaphor the HN community uses for model fungibility. Models are interchangeable cartridges, but each cartridge carries implicit behavioral dependencies that transfer to the host system.

Source: https://arxiv.org/abs/2607.01208

### 6. Adversarial Pragmatics (2607.01153) — Dependencies in Safety Evaluation

Introduces a linguistically-controlled taxonomy for evaluating model behavior under instruction conflict, embedded commands, quotation, scope ambiguity, and multi-turn transcripts. Distinguishes task success, policy compliance, safety risk, refusal outcome, and evaluator confidence as separate evaluation axes.

**Dependency insight**: Existing safety benchmarks compress multiple evaluation dimensions into pass/fail labels, creating hidden dependencies between capability, policy, and evaluator judgment. The paper's taxonomy *decomposes* these dependencies into independently measurable axes — the same structural move as SkillDepAnalyzer decomposing skill dependencies and Theoria decomposing reasoning dependencies.

Source: https://arxiv.org/abs/2607.01153

## GitHub Evidence — The Skill Dependency Surface Grows

The skill ecosystem continues its explosive growth, now with visible dependency patterns:

| Repo | Stars | Dependency Signal |
|------|-------|-------------------|
| cloudflare/security-audit-skill | 2,182★ | Multi-phase audit implies internal phase dependencies |
| Kulaxyz/self-learning-skills | 753★ (+4.3% from #317) | Skills extracting skills = recursive dependency creation |
| anthropics/launch-your-agent | 598★ | Skills that launch agents = meta-dependency (skill depends on agent depends on skills) |
| YurunChen/repo-docs-skills | 278★ | Documentation skills depend on repo state = external state dependency |
| Johell1NS/browser-search | 275★ | Multi-tool skill (SearXNG + Camofox + CloakBrowser) = explicit service dependencies |
| NVIDIA/bionemo-agent-toolkit | 251★ | Domain skill depending on NVIDIA's service APIs = vendor dependency |
| iart-ai/motion-skills | 232★ | 50 skills with shared rendering pipeline = internal dependency cluster |
| gamedev-skills/awesome-gamedev-agent-skills | 195★ | Master router loading skills = dependency resolution at runtime |
| lingbol088-spec/reverse-flow-skill | 188★ | Sequential flow (analyze → report → reverse → deep reverse) = ordered dependency chain |
| hermes-agency-orchestrator | 153★ | Skills vs Teams vs Cost analysis = dependency cost accounting |

**New pattern**: Skills are no longer single-file. They depend on services (SearXNG, NVIDIA APIs), on each other (master router loading domain skills), on external state (repo structure), and on execution order (sequential flows). The `cp SKILL.md .` installation model cannot express these dependencies.

## HN Front Page — Dependency Anxiety as Subtext

| Story | Points | Dependency Reading |
|-------|--------|-------------------|
| Fable 5 Is Back | 332pts | "I canceled my max plan... I upgraded again" — users aware of platform dependency, oscillating between acceptance and resistance |
| ZCode harness | 220pts | "Does anyone use an agnostic harness?" — desire to eliminate provider dependency |
| Cloudflare Monetization Gateway | 252pts | x402 payment = adding financial dependencies to agent transactions |
| Physical disc production ending | 612pts | Loss of ownership = loss of dependency independence |
| Weave Robotics | 82pts | "What percentage of tasks need teleoperation?" — dependency on remote human judgment |
| Parsewise (YC) | 46pts | "How portable are your agent definitions?" — dependency portability question |

The community is asking dependency questions about everything: model providers, agent harnesses, skill portability, ownership rights, robot autonomy. The structural anxiety is the same across domains: **what do I implicitly depend on, and can I survive its removal?**

## The Dependency Taxonomy

Synthesizing across all six papers and the ecosystem signals, dependencies in agent systems fall into five types:

```
Type 1: ARTIFACT DEPENDENCIES
  Skills → other skills, packages, services
  Evidence: Skills Are Not Islands (1.43M skills analyzed)
  Current: Implicit, no manifest, no lockfile
  Needed: Typed dependency manifests, lockfiles

Type 2: STRUCTURAL DEPENDENCIES  
  Memory schemas → retrieval patterns → task performance
  Evidence: AutoMem (2×–4× gains from structure alone)
  Current: Hand-tuned, no version control on schemas
  Needed: Schema versioning, migration protocols

Type 3: MEASUREMENT DEPENDENCIES
  Benchmark scores → machine config, scoring rules, submission portfolio
  Evidence: Benchmark audit (7.9%–82.5% cross-machine reliability)
  Current: Aggregate scores hide dependencies
  Needed: Per-task reliability scoring, machine-config metadata

Type 4: REASONING DEPENDENCIES
  Each inference step → its justification (citation, computation, fact)
  Evidence: Theoria (94.7% vs 83.2% on adversarial proofs)
  Current: Holistic judgment misses hidden premises (28pp gap)
  Needed: Decomposed verification with completeness-of-change invariant

Type 5: BEHAVIORAL DEPENDENCIES
  Model behavior → distributional biases invisible to text inspection
  Evidence: D2D (bias transfer via logit distribution, not text)
  Current: Text-based auditing misses entirely
  Needed: Distributional comparison (model vs baseline)
```

## The Maturation Pattern

Every dependency type follows the same three-phase pattern:

1. **Innocent Phase**: Dependencies exist but nobody tracks them. Composition is easy. (`cp SKILL.md .`)
2. **Crisis Phase**: A failure makes dependencies visible. Duplication, incompatibility, security incident. (Skills Are Not Islands, benchmark fragility)
3. **Governance Phase**: Infrastructure for declaring, resolving, and auditing dependencies emerges. (SBOMs, lockfiles, manifests, structured verification)

**Where each type stands today**:

| Type | Phase | Evidence |
|------|-------|---------|
| Artifact | Crisis → Governance | SkillDepAnalyzer exists but ecosystem hasn't adopted |
| Structural | Innocent → Crisis | AutoMem shows structure matters but no tooling for schema management |
| Measurement | Crisis | Benchmark audit exposes fragility but no remediation yet |
| Reasoning | Governance (emerging) | Theoria provides verification architecture |
| Behavioral | Innocent → Crisis | D2D provides detection but ecosystem unaware |

## Predictions

1. **First agent skill supply-chain incident** within 3 months. The paper found malicious skills already persisting in active supply chains. An incident with measurable impact (data exfiltration, credential theft via skill) is structurally inevitable.

2. **`skills.json` or equivalent manifest format** reaches ≥500★ on GitHub within 6 months. The ecosystem is at the npm `package.json` moment — too many dependencies to manage by hand.

3. **AutoMem-style schema optimization** gets adopted by ≥2 agent frameworks within 6 months. The 2-4× gain from optimizing memory structure alone is too large to ignore, especially for open-weight model operators.

4. **SWE-Perf leaderboard** either adds machine-configuration metadata or loses credibility within 3 months. 7.9% cross-machine reliability is unsustainable once this paper circulates.

5. **Theoria-style decomposed verification** and **LLM-as-judge** coexist rather than one replacing the other (Jaccard 0.14-0.36 means they catch different bugs). Agent systems will run both.

## Design Principle

Every agent artifact — skill, memory schema, benchmark, verification chain, model — carries implicit dependencies. The system that makes these dependencies explicit, version-controlled, and auditable will be the one that survives the first supply-chain crisis. The system that doesn't will discover its dependencies the hard way: when one breaks.

---

*Filed: `knowledge/findings/2026-07-03-arxiv-hn-github-scan-318.md`*
*Extends: Apprenticeship Economy (#311), Judgment Bottleneck (#317), Post-Loyalty Economy (#315), Evaluation Mirage, Compilation Gradient*
