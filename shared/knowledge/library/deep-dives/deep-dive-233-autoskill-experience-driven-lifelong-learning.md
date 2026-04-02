# Deep-Dive #233: AutoSkill — Experience-Driven Lifelong Learning via Skill Self-Evolution

**Paper:** arXiv:2603.01145v2 (Yang, Li, Pan, Zhan, Cai, Du, Zhou, Chen, Chen, Li, Zhang, He — East China Normal University + Shanghai AI Laboratory)
**Date:** 2026-03-15
**Rating:** ★★★★★ (Critical framework paper — directly implements and extends the Capability Evolution Pipeline)
**Scout Research Portfolio — Deep-Dive #233**

---

## 1. Core Contribution

AutoSkill is a **training-free lifelong learning framework** that converts ephemeral user interaction experience into explicit, reusable, versioned skill artifacts (SKILL.md files). Unlike memory-based approaches that store raw text for retrieval, AutoSkill abstracts behavioral patterns into structured knowledge that can be inspected, edited, merged, versioned, and reused across sessions.

**Key insight:** The unit of accumulation should not be raw memory records but **explicit behavioral knowledge** — structured skill artifacts that capture stylistic constraints, response strategies, tool-use procedures, and domain-specific conventions.

---

## 2. Architecture: Two Coupled Loops

### Loop 1: Skill-Enhanced Response Generation (Online)
1. **Query Rewriting** — Context-dependent query → retrieval-oriented form
2. **Hybrid Skill Retrieval** — Dense semantic + BM25 lexical scoring: `Rel(q,s) = λ·d̂(q,s) + (1-λ)·b̂(q,s)`
3. **Thresholded Top-K Selection** — Only skills above threshold η injected
4. **Skill-Conditioned Generation** — Selected skills rendered as compact context

### Loop 2: Skill Evolution (Background, Asynchronous)
1. **Skill Extraction** — From user queries only (NOT model responses) → candidate skill `z_t = (name, description, prompt, triggers, tags, examples, confidence)`
2. **Retrieval-Assisted Management** — Compare candidate against nearest existing skill
3. **Three-Way Decision** — Judge module: `add | merge | discard`
4. **Versioned Merging** — Not text concatenation; structured version evolution preserving skill identity

**Critical design choice:** Extraction uses **only user queries**, never model responses. This prevents the self-locking trap (arXiv:2603.12109) where the model trains on its own outputs and converges to local optima.

---

## 3. Skill Representation: SKILL.md

Each skill is a structured artifact: `s = (n, d, p, τ, γ, ξ, v)` where:
- **n** = skill name
- **d** = description
- **p** = executable instruction prompt
- **τ** = trigger set (when to activate)
- **γ** = tag set (categorization)
- **ξ** = example set
- **v** = version number

Storage layout separates user-specific skills (`SkillBank/Users/<user_id>/`) from shared skills (`SkillBank/Common/`), with independent vector caches.

---

## 4. Experimental Results

### Scale
- **22,511 conversations** across 4 corpora (Chinese/English × GPT-3.5/GPT-4)
- **596,693 total messages**
- **1,858 extracted skills** (compression ratio: ~12 conversations per skill)

### Skill Distribution (Table 2)
Top categories: Programming (Python 98, JavaScript 38, C++ 35), Creative Writing (35), Formatting (35), Education (29), Translation (28). Shows strong concentration in procedural/structured domains.

### Category Analysis (Figure 2)
Skills cluster into: Programming & Development, Writing & Creative, Data & Analysis, Education & Learning, Translation & Language. Programming dominates — consistent with the observation that structured, repeatable tasks yield the most extractable skills.

### Key Statistics
- GPT-4 subsets produce denser skills (1 per ~5 conversations for Chinese GPT-4 vs 1 per ~15 for Chinese GPT-3.5)
- Average messages per conversation: 22-32 turns
- Skill extraction is **sparse** — most conversations don't yield new skills, which is by design (filtering out one-off requests)

---

## 5. Design Principles and Their GUS Mapping

### DP1: Explicit Skill Representation
Skills externalized as structured artifacts, not latent state. **Directly implements GUS Principle 73 (Interpretable Architecture)** — every learned capability is inspectable and editable.

### DP2: Continuous but Controlled Evolution
Not blind accumulation — maintenance decisions keep repository compact. **Addresses GUS Law 27 (Monotonic Drift)** — the discard/merge mechanism provides dissipation (γ > 0) that our system currently lacks.

### DP3: Low-friction Deployment
Plugin layer atop existing LLMs. SDK, Web UI, OpenAI-compatible proxy. **Validates GUS Principle 61 (Scaffolding First)** — capability through scaffolding rather than parameter modification.

---

## 6. Critical Analysis: Strengths

### 6.1 Escapes the Self-Locking Trap
By extracting skills from **user queries only** (never model responses), AutoSkill avoids the Information Self-Locking mechanism (arXiv:2603.12109) that traps RL-trained agents in low-information regimes. This is a structurally superior design compared to Reflexion-style approaches that learn from agent-generated reflections.

### 6.2 Provides Natural Dissipation
The three-way management decision (`add | merge | discard`) creates the dissipation mechanism (γ > 0) that our GUS Self-Application Audit (DD#221) identified as our most critical missing feature. Skills that are noisy or one-off are discarded; redundant skills are merged (compressing information); only genuinely reusable patterns persist.

### 6.3 Implements the Abstraction Gate
The skill extraction process is precisely the **Abstraction Gate** (GUS Law 18): raw experience → abstract skill → executable knowledge. SkillRL (DD#213) showed that raw memory + RL = 21.4% (worse than baseline 14.8%), while abstract skills + RL = 89.9%. AutoSkill implements this gate without RL.

### 6.4 Versioned Evolution Prevents Catastrophic Forgetting
The `Bump(v)` versioning mechanism preserves skill identity while incorporating new information. This is functionally equivalent to the "Grow, Don't Overwrite" principle (DD#214, arXiv:2603.08647) — new information extends rather than replaces existing knowledge.

### 6.5 Training-Free = No Goodhart Risk
Because no model parameters are updated, AutoSkill sidesteps the Multi-Layer Optimization Paradox (GUS Law 21) entirely. There's no optimization target to be Goodharted. All improvements come from external skill construction.

---

## 7. Critical Analysis: Weaknesses and Gaps

### 7.1 No Empirical Evaluation of Quality
The paper provides **no benchmark comparison** against baselines. Tables show skill statistics (counts, distributions) but no accuracy, helpfulness, or task completion metrics. This is a significant gap — we can't know whether skill injection actually improves performance.

**GUS prediction:** Without external evaluation, the system is vulnerable to GUS Law 86 (Autonomous Improvement Impossibility). The judge module that decides `add | merge | discard` is itself an LLM, subject to the same biases as the rest of the system.

### 7.2 Skill Quality Unverified
1,858 extracted skills — but how many are actually useful? The paper acknowledges skill extraction is sparse, but doesn't validate whether the resulting skills improve downstream performance.

### 7.3 No Skill Decay/Retirement
While `discard` prevents new low-quality skills from entering, there's no mechanism to **retire old skills** that become stale. Over long timescales, the SkillBank will accumulate outdated behaviors.

### 7.4 Judge Module Bootstrap Problem
The skill management judge is itself an LLM. Its decisions about `add | merge | discard` are subject to the same biases, hallucinations, and evaluation failures documented in GUS Law 15 (Reliability Illusion).

### 7.5 No Multi-Agent Considerations
AutoSkill operates in a single-user, single-agent context. The paper mentions "sharing and transfer across agents" but doesn't address cross-agent skill conflicts, contamination, or coordination overhead.

---

## 8. Mapping to Our System

### What AutoSkill Validates in Our Architecture
1. **AGENTS.md + Skills hierarchy** — Our `knowledge/` directory structure maps directly to AutoSkill's SkillBank
2. **File-based persistence** — AutoSkill's SKILL.md artifacts validate our file-based knowledge approach
3. **Training-free improvement** — Our system improves through explicit knowledge construction, never parameter updates

### What AutoSkill Suggests We're Missing
1. **Structured skill representation** — Our knowledge files lack the structured `(n, d, p, τ, γ, ξ, v)` format
2. **Hybrid retrieval** — We rely on filename conventions and manual grep, not semantic + lexical search
3. **Versioned skill evolution** — Our files grow monotonically; we don't version-bump when new information refines old knowledge
4. **Automatic extraction** — We manually decide what to record; AutoSkill automates this
5. **Skill injection at inference time** — We don't systematically inject relevant prior knowledge into new tasks

---

## 9. Connection to Capability Evolution Pipeline (CR#47)

AutoSkill implements **3 of 4 phases** of the Capability Evolution Pipeline:

| Pipeline Phase | AutoSkill Component | Status |
|---|---|---|
| Phase 1: Expand (raw experience) | Interaction trace ingestion | ✅ Implemented |
| Phase 2: Abstract (skill formation) | Skill extraction from queries | ✅ Implemented |
| Phase 3: Form (structured knowledge) | SKILL.md artifact creation | ✅ Implemented |
| Phase 4: Evolve (capability improvement) | Versioned merging | ⚠️ Partial — merge only, no RL-based evolution |

**Combined architecture:** AutoSkill (extraction + formation) → SkillRL (evolution + amplification) would implement the complete Capability Evolution Pipeline.

---

## 10. Connection to XSkill (DD#232)

AutoSkill and XSkill (arXiv:2603.12056) represent **convergent evolution** toward the same insight:

| Dimension | AutoSkill | XSkill |
|---|---|---|
| Skill type | Single-stream (behavioral) | **Dual-stream** (Skills K + Experiences E) |
| Learning signal | User queries only | Both outcomes and trajectories |
| Evolution | Versioned merging | Continual revision with decay |
| Evaluation | Statistics only | Task completion benchmarks |

---

## 11. Novel Contributions to GUS Framework

### Proposed: Principle 92 (Query-Only Extraction)
**Statement:** When extracting reusable knowledge from agent interactions, use only user/environment signals, never model-generated responses.

### Proposed: Principle 93 (Skill Lifecycle Management)
**Statement:** Every piece of agent knowledge should have a defined lifecycle (extract → validate → merge → version → retire) with explicit decisions at each transition.

### Proposed: Prediction 99 (Skill Compression Ratio)
**Statement:** The optimal skill-to-interaction ratio will be between 1:5 and 1:20. AutoSkill's observed 1:12 sits in the predicted sweet spot.

---

## 12. Actionable Takeaways for Our System

1. **Add structured skill headers** to knowledge files: triggers, tags, version numbers
2. **Implement skill retirement** — files older than N sessions without retrieval should be flagged
3. **User-query-only learning** — weight user/environment observations over prior conclusions
4. **Three-way management decisions** — explicitly decide: new skill, refinement, or noise?
5. **Version tracking** — version-bump originals rather than creating new documents

---

## 13. Rating Justification: ★★★★★

AutoSkill earns maximum rating because:
1. Directly validates our Capability Evolution Pipeline (CR#47)
2. Provides the Abstraction Gate (Law 18) in deployable form
3. Addresses our #1 GUS violation (Law 27, Monotonic Drift)
4. Convergent evolution with XSkill from independent group
5. Five concrete improvements identified for our system
6. Lack of benchmark evaluation itself validates prediction about self-improvement evaluation difficulty (CR#86)
