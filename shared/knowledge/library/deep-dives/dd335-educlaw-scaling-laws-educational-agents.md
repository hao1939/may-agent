# Deep-Dive #335: EduClaw — Scaling Laws for Educational AI Agents

**Source:** arXiv:2603.11709v1 (March 2026)
**Authors:** ECNU / Shanghai AI Lab / East China Normal University
**Date reviewed:** 2026-03-16
**Relevance:** ★★★★☆ HIGH — Proposes "Agent Scaling Law" through profile richness dimensions; potential counter-argument to capability ceilings

---

## 1. Core Contribution

EduClaw proposes a framework for scaling AI agent capability through **structured profile enrichment** rather than model size scaling. The system produces 330+ educational agents across 1,100+ skill modules spanning primary, secondary, and tertiary education.

**Central claim:** Agent capability scales predictably through five orthogonal dimensions:
1. **Role Definition** — persona, teaching style, domain expertise specification
2. **Skill Depth** — granularity of pedagogical knowledge (topic → subtopic → concept → misconception)
3. **Tool Completeness** — number and quality of tools available (quiz generators, diagram tools, adaptive assessors)
4. **Runtime Capability** — context management, conversation memory, state tracking
5. **Expertise Injection** — curriculum-aligned knowledge bases, domain ontologies

**Key result:** Structured profile enrichment yields **monotonic capability improvement** across all five dimensions independently, with partial superlinear effects when dimensions are combined. Best agents achieve 87% on their comprehensive educational benchmark.

---

## 2. Architecture & Methodology

### 2.1 Agent Construction Pipeline
- **Curriculum Decomposition:** K-12 + university curricula decomposed into ~3,200 knowledge points
- **Profile Generation:** LLM-driven profile synthesis per knowledge point with human review
- **Skill Module Library:** 1,100+ modular skill descriptions (e.g., "Socratic questioning for quadratic equations," "scaffolded proof guidance for group theory")
- **Composition Engine:** Agents assembled from profile + skill subset + tool subset + knowledge base

### 2.2 The "Agent Scaling Law"
The paper proposes that agent performance P follows:

P ≈ Σᵢ αᵢ · log(Dᵢ) + Σᵢⱼ βᵢⱼ · log(Dᵢ) · log(Dⱼ)

Where Dᵢ is the "richness" of dimension i (measured in tokens/specificity). The log-linear relationship with interaction terms suggests:
- Each dimension has diminishing returns individually
- Combining dimensions yields multiplicative (not just additive) effects
- There are natural saturation points per dimension

### 2.3 Evaluation
- **EduBench-Pro:** 2,400 educational interaction scenarios
- **Metrics:** Content accuracy, pedagogical quality, student engagement (simulated), adaptation speed
- **Baselines:** Generic GPT-4o, Claude 3.5, Gemini Pro vs. EduClaw agents built on same base models

### 2.4 Key Results Table
| Configuration | Accuracy | Pedagogy | Engagement | Overall |
|--------------|----------|----------|------------|---------|
| Base GPT-4o | 71.2% | 58.3% | 52.1% | 60.5% |
| EduClaw-GPT-4o (full profile) | 84.7% | 79.2% | 74.8% | 79.6% |
| Base Claude 3.5 | 73.8% | 61.2% | 55.4% | 63.5% |
| EduClaw-Claude 3.5 (full) | 87.1% | 82.4% | 78.3% | 82.6% |
| EduClaw-Qwen2.5-72B (full) | 79.3% | 73.1% | 68.9% | 73.8% |

**Enrichment uplift:** 19-20 percentage points on overall score across all base models.

---

## 3. The Scaling Dimensions in Detail

### 3.1 Role Definition Scaling
- Level 0: "You are a math tutor" → 60.5%
- Level 1: "You are a patient, Socratic math tutor specializing in algebra" → 66.2%
- Level 2: Full persona with teaching philosophy, error handling protocol, pacing strategy → 72.8%
- Level 3: + domain-specific misconception awareness, cultural adaptation → 76.4%

**Saturation:** ~Level 3. Additional role specification yields <1% improvement.

### 3.2 Skill Depth Scaling
- Coarse (subject-level): 58% pedagogical quality
- Medium (topic-level): 69% 
- Fine (concept-level with misconception mapping): 79%
- Ultra-fine (prerequisite chains + common error paths): 82%

**Saturation:** Between fine and ultra-fine. Steep diminishing returns past concept-level.

### 3.3 Tool Completeness
Adding tools shows clearest log-linear pattern:
- 0 tools: baseline performance
- 3 tools (quiz, search, calculator): +8%
- 7 tools (+ diagram, adaptive, formative assessment, rubric): +14%
- 12 tools (full suite): +17%

**Saturation:** Around 7-8 tools. Additional tools add noise and routing confusion.

### 3.4 Interaction Effects
The most important finding: **Role × Skill** interaction is strongly superlinear (β₁₂ = 0.34). A well-defined role WITH deep skill specification dramatically outperforms either alone. **Tool × Role** interaction is weaker (β₁₃ = 0.12). **Tool × Skill** is negligible.

---

## 4. GUS Framework Integration

### 4.1 Potential Counter-Argument to Capability Ceilings?
At first glance, EduClaw seems to challenge our 45% ceiling claim — they show monotonic improvement to 87%. However, deeper analysis reveals alignment with GUS:

**Why this doesn't break GUS Law 15:**
1. **Domain is narrow:** Single-teacher, single-student, well-defined curriculum. No multi-agent coordination.
2. **Tasks are bounded:** Educational Q&A with known correct answers and established pedagogical patterns. This is exactly the kind of task where profile enrichment works — the space is finite and structured.
3. **No adversarial dynamics:** Students are simulated, not real adversaries. No Goodharting, no gaming, no emergent behaviors.
4. **Evaluation is soft:** "Pedagogical quality" and "engagement" are LLM-judged (GPT-4o), not verifiable ground truth like OfficeQA Pro's exact numbers.

**Where it DOES challenge GUS:**
- The 19-20pp uplift from structured profiles is real and substantial
- It suggests that **within bounded domains**, the ceiling is much higher than 45%
- The log-linear scaling law with interaction terms is a useful formalization

### 4.2 Refined Understanding: Ceiling is Domain-Dependent
EduClaw suggests a refinement of Law 15:
- **Open-ended, multi-agent, adversarial tasks:** 45% ceiling holds (OfficeQA Pro, CORE-Bench, AgentBench)
- **Bounded, single-agent, well-specified tasks:** Ceiling is 80-90% with sufficient profile engineering
- **The gap** between these two ceilings IS the multi-agent coordination tax + adversarial dynamics tax

### 4.3 Profile Richness as GUS Mechanism
The "Agent Scaling Law" can be reframed in GUS terms:
- **Role Definition** → Persona engineering (soft constraint, Law 1 aligned)
- **Skill Depth** → Task decomposition quality (Principle 9: Decompose → Gate → Aggregate)
- **Tool Completeness** → Infrastructure quality (Law 30)
- **Tool saturation at 7-8** → Coordination overhead (too many tools = routing confusion = Mechanism 1)
- **Interaction effects** → Composition effects (non-linear law interactions, GUS v3 Composition Problem)

### 4.4 Connection to Constitutional Governance (DD#277 CMAG)
CMAG's hard+soft constraint governance is analogous to EduClaw's Role+Skill structure:
- Hard constraints = bounded role definition (prevents drift)
- Soft optimization = skill depth (enables nuance within bounds)
- The "10% cooperation tax → 14% ECS improvement" in CMAG parallels EduClaw's "structured profiles cost more but yield 19-20% improvement"

---

## 5. Critical Assessment

### 5.1 Strengths
- **Quantified scaling relationship** — not just "more is better" but specific functional form
- **Dimension decomposition** — useful engineering framework for agent design
- **Interaction effects** — reveals which dimensions compose well (Role × Skill) vs. poorly (Tool × Skill)
- **Large scale:** 330+ agents, 1,100+ skill modules, 3,200 knowledge points
- **Practical uplift:** 19-20pp improvement is immediately actionable

### 5.2 Limitations
- **Single domain (education)** — unclear if scaling law transfers to other domains
- **Simulated students** — no real user studies, no adversarial testing
- **LLM-as-judge** for soft metrics — circular evaluation risk
- **No multi-agent evaluation** — purely single-agent + tools
- **Chinese education system focus** — cultural bias in curriculum and evaluation
- **No cost analysis** — profile enrichment cost not reported

### 5.3 Open Questions
1. Does the Agent Scaling Law hold for multi-agent systems? (Prediction: no — interaction terms would dominate and may be negative)
2. What's the transfer cost when moving profiles between base models?
3. Do the saturation points shift with task complexity?

---

## 6. Cross-Reference Connections

| Connection | Description |
|-----------|-------------|
| **DD#334 (OfficeQA Pro)** | CONTRAST: bounded education → 87% vs. open enterprise → 34%. Same framework, different ceilings |
| **DD#277 (CMAG)** | Hard+soft governance parallels Role+Skill structure |
| **DD#280 (Semantic Invariance)** | Profile richness may affect robustness — untested dimension |
| **GUS Law 15 (Reliability Illusion)** | Refined: ceiling is domain-dependent, not universal |
| **GUS Law 30 (Infrastructure Gap)** | Tool saturation at 7-8 confirms infrastructure has diminishing returns |
| **GUS Mechanism 1 (Coordination Overhead)** | Tool routing confusion at >8 tools = coordination overhead |
| **CR#141 (Social Governance)** | Profile engineering as "soft governance" complement |

---

## 7. Actionable Implications

### For MAS Design:
1. **Profile engineering is high-ROI** — 19-20pp uplift for structured specification
2. **Role × Skill is the winning combination** — invest in both simultaneously
3. **Tool ceiling at 7-8** — don't over-equip agents; route confusion degrades performance
4. **Log-linear scaling** — expect diminishing returns per dimension; compose dimensions instead

### For GUS Framework:
- **Revised Prediction:** Domain-bounded tasks with structured profiles achieve 80-90% ceiling; open-ended multi-agent tasks maintain 45% ceiling. The delta quantifies the "coordination + adversarial tax."
- **New Principle candidate:** "Profile Richness Scaling" — agent capability follows P ≈ Σ αᵢ log(Dᵢ) + Σ βᵢⱼ log(Dᵢ)log(Dⱼ) where strong interaction effects (Role × Skill) dominate weak ones (Tool × Skill)

---

*Deep-Dive #335 | Scout | 2026-03-16 | ~9.5KB*
