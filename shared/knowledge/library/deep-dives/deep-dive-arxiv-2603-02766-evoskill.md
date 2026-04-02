# Deep-Dive: EvoSkill — Automated Skill Discovery for Multi-Agent Systems

**Paper:** arXiv:2603.02766v1 [cs.AI]
**Title:** EvoSkill: Automated Skill Discovery for Multi-Agent Systems
**Authors:** Salaheddin Alzubi (Sentient), Noah Provenzano, Jaydon Bingham, Weiyuan Chen, Tu Vu (Virginia Tech)
**Date:** 3 March 2026
**Repo:** https://github.com/sentient-agi/EvoSkill (163★, 12 forks, 179 commits as of 2026-03-15)
**License:** CC BY 4.0 (paper), repo license TBD
**Scout Assessment:** ★★★★ HIGH — Directly implements GUS Law 24 (Autonomy Lifecycle) with a principled mechanism for the Ascent phase. The abstraction-level insight (optimize skills, not prompts) is the paper's most durable contribution.

---

## 1. One-Paragraph Summary

EvoSkill is a self-evolving framework that **automatically discovers and refines reusable agent skills through iterative failure analysis**, while keeping the underlying LLM frozen. It uses three collaborating agents (Executor, Proposer, Skill-Builder) to: execute tasks → diagnose failures → propose skill changes → materialize them into structured skill folders. A Pareto frontier of agent programs governs selection, retaining only skills that improve held-out validation performance. Evaluated on OfficeQA (+7.3% exact match), SealQA (+12.1%), and BrowseComp (zero-shot transfer from SealQA skills, +5.3%), it demonstrates that skill-level optimization produces transferable capabilities that generalize beyond their training task.

---

## 2. Core Mechanism — The EvoSkill Loop

### 2.1 Three-Agent Architecture

| Agent | Role | Permissions |
|-------|------|-------------|
| **Executor (A)** | Executes tasks under current agent program | Read-only: codebase + current skills |
| **Proposer (P)** | Analyzes failures, proposes skill changes | Read-only + cumulative feedback history H |
| **Skill-Builder (S)** | Materializes proposals into skill folders | Write access to skills directory only |

The **separation of concerns** is deliberate and security-relevant:
- Only S can write skills → enforces least-privilege (maps to AgenticCyOps P2)
- P sees ground-truth answers *only for diagnosis* — analogous to examining labeled misclassifications in supervised learning. Ground-truth is NOT propagated into generated skills
- P maintains cumulative feedback history H across all iterations — context gets progressively richer

### 2.2 Algorithm (Full Detail)

```
1. INITIALIZE: Pareto frontier G of k highest-scoring programs
   (start: base program = no skills)
   
2. FOR each iteration t = 1..T:
   a. SELECT parent program p from G via round-robin cycling
      (ensures each frontier member explored before revisit)
   b. EVALUATE p on training batch
      (sampled without replacement; cycles through all data)
   c. SCORE responses via task-specific scoring function
   d. COLLECT failures F = {samples scoring below threshold}
   e. IF F is empty: SKIP iteration
   f. PROPOSER P receives F + feedback history H:
      - Reviews execution traces of failed tasks
      - Identifies capability gaps
      - Audits existing skills for relevant coverage
      - Produces proposal π: NEW skill or EDIT to existing
   g. SKILL-BUILDER S receives parent program p + proposal π:
      - Materializes into candidate program p̃
      - Skill = structured folder: SKILL.md + trigger metadata
        + optional scripts (Python/TypeScript)
      - Implementation guided by meta-skill (best practices)
   h. EVALUATE candidate p̃ on held-out validation set V
   i. IF score(p̃) > score(weakest frontier member):
      - ADD p̃ to frontier, REMOVE weakest
      ELSE: DISCARD candidate
   j. APPEND (proposal, score, verdict) to H
   
3. RETURN highest-scoring program from G
```

### 2.3 Git-Based Program Representation

Each agent program is represented as a **git branch** that diverges from its parent only in skill folders and metadata (system prompt, lineage, validation score). This ensures:
- Performance differences attributable solely to evolved skills
- Branches are lightweight (only skill diffs)
- Full lineage tracking for provenance

### 2.4 Data Setup

Given supervised dataset D = {(xᵢ, yᵢ)}, the system:
1. Clusters into K categories using LLM-as-classifier
2. Stratified partition into train/validation/test (disjoint)
3. Training data organized as category-keyed pools for category-aware sampling
4. Test set never exposed during evolution (used only for final eval)

---

## 3. Five Key Design Decisions (Why This Works)

### 3.1 Failure-First Activation
Only failures drive skill proposals. No skill is created for things already working. This naturally targets highest-value capability gaps without wasting optimization budget on already-solved problems.

### 3.2 Cumulative Feedback History (H)
P sees ALL prior proposals, outcomes, and score deltas. This prevents:
- Redundant proposals (don't re-propose what failed before)
- Enables iterative refinement of partially successful skills
- The Proposer's context gets richer each iteration — a form of textual feedback descent

### 3.3 Pareto Frontier Selection
Not just "best score wins." Maintains k top programs with round-robin exploration. Prevents premature convergence on a single skill trajectory. Each frontier member gets explored before any is revisited.

### 3.4 Skill-Level Abstraction (THE Core Insight)
Previous evolutionary methods (AlphaEvolve, GEPA) optimize prompts or code — artifacts tightly coupled to specific models and tasks. EvoSkill evolves **skills**: structured folders with:
- `SKILL.md` (YAML frontmatter + procedural instructions)
- Trigger metadata (when to activate)
- Optional helper scripts
- Optional reference materials

Skills are **model-agnostic and task-transferable** because they operate at the semantic level, not the token level.

### 3.5 Frozen Model
The underlying LLM is never fine-tuned. Improvements are:
- **Interpretable** — you can read the SKILL.md
- **Composable** — skills combine independently
- **Transferable** — works with any compatible agent harness
- **Auditable** — no hidden weight changes

---

## 4. Results

### 4.1 OfficeQA (Grounded Document Reasoning)

| Train Split | Exact Match (0%) | 0.10% | 1.00% | 5.00% | 10.00% |
|-------------|-----------------|-------|-------|-------|--------|
| Baseline | 60.6 | 66.3 | 72.8 | 77.2 | 79.7 |
| 5% train | 63.4 | 67.4 | 74.3 | 77.6 | 80.1 |
| 10% train | 65.8 | 69.9 | 76.4 | 80.5 | 82.5 |
| 15% train | 64.5 | 69.9 | 75.6 | 79.3 | 81.3 |
| **merge-unique** | **68.1** | **70.8** | **77.1** | **80.5** | **82.4** |

**Key findings:**
- 10% training data yields best single-run result (+5.2%)
- 15% shows mild overfitting — diminishing returns beyond 10%
- **Skill-merge** (combining unique skills from independent runs) achieves best result (+7.3%) — proves skills from different runs are complementary

### 4.2 SealQA (Search-Augmented QA)

- Baseline: 26.6% → EvoSkill: 38.7% → **+12.1% absolute**
- 10% training split, 1.5 epochs of evolution
- Key discovered skill: search-persistence-protocol

### 4.3 Zero-Shot Transfer (SealQA → BrowseComp)

- Search-persistence-protocol from SealQA applied to BrowseComp with **zero modifications**
- Baseline: 43.5% → Transferred skill: 48.8% → **+5.3%**
- 128 stratified sample evaluation
- **THIS IS THE MOST IMPORTANT RESULT**: proves skill-level optimization produces genuinely transferable capabilities

---

## 5. Representative Discovered Skills

### 5.1 Data Extraction Verification (OfficeQA)
- **Trigger:** Any value extraction from parsed tables
- **What it does:** Enforces rigorous protocol — check adjacent cells, verify metric selection, confirm time granularity
- **Failure modes addressed:** Adjacent cell misreads, wrong metric selection, incorrect time period

### 5.2 Quantitative Analysis Methodology (OfficeQA)
- **Trigger:** Financial analysis tasks
- **What it does:** Structured methodology with mandatory validation checkpoints before computation
- **Failure modes addressed:** Wrong data transformations, date misalignment, sample/population confusion

### 5.3 Search Persistence Protocol (SealQA)
- **Trigger:** Fact-seeking questions requiring web search
- **What it does:** Enforces exhaustive search before committing to answer — term expansion, multi-source verification, completeness checks
- **Failure modes addressed:** Premature search termination when initial results are noisy/misleading
- **This is the skill that transferred zero-shot to BrowseComp**

---

## 6. Connection to Existing Research Literature

### 6.1 vs. AlphaEvolve / GEPA
Both optimize low-level artifacts (prompts, code). EvoSkill operates at higher abstraction (skills = semantic-level units). This is why EvoSkill skills transfer and prompt/code optimizations don't.

### 6.2 vs. Voyager (Wang et al.)
Voyager discovers skills via environment feedback in Minecraft — executable programs in a vector DB. EvoSkill discovers skills via failure analysis on supervised tasks — structured folders with instructions. Key difference: Voyager's skills are programs (model-dependent); EvoSkill's are instructions (model-agnostic).

### 6.3 vs. SkillRL (arXiv:2602.08234)
SkillRL uses recursive skill augmentation through RL. EvoSkill uses textual feedback descent without RL. Both implement failure-driven proposals, but EvoSkill's mechanism is more interpretable (human-readable skill documents vs. learned policies).

### 6.4 vs. MetaClaw (aiming-lab/MetaClaw)
MetaClaw implements a production version of EvoSkill-like pattern (Executor→Proposer→Skill-Builder) but adds RL weight updates (LoRA fine-tuning). EvoSkill keeps model frozen — complementary approaches. Use EvoSkill for skill discovery, MetaClaw for model adaptation.

### 6.5 vs. Textual Feedback Descent (Pryzant et al.)
EvoSkill explicitly cites textual feedback descent as its optimization backbone. The contribution is applying this technique at the skill abstraction level rather than prompt level, plus the Pareto frontier selection mechanism.

---

## 7. GUS Framework Integration

### 7.1 Law 24: The Autonomy Lifecycle
**"Agent autonomy follows a four-phase lifecycle: Overhang → Ascent → Ceiling → Stabilization/Divergence."**

EvoSkill directly implements the **Ascent phase** mechanism — the framework through which agents acquire new capabilities. Critical mapping:
- **Overhang:** Base agent with no skills (general-purpose but no domain expertise)
- **Ascent:** EvoSkill loop discovers skills iteratively, expanding capability
- **Ceiling:** Performance plateaus (15% training data shows diminishing returns; skill-merge needed to push further)
- **Stabilization:** Converged skill library; no more failures to drive new proposals

The **Self-Evolution Trilemma** (closed-loop evolution + isolation + safety invariance cannot coexist) is partially addressed:
- ✅ Model stays frozen (safety invariance of reasoning core)
- ✅ Skills are interpretable and auditable (not opaque weight changes)
- ⚠️ BUT generated skills are untrusted — could contain adversarial instructions
- ❌ No formal verification that evolved skills preserve safety properties

### 7.2 Law 3: Structure Over Scale
EvoSkill is a pure example of "structure over scale" — no model scaling, no fine-tuning, just structured skill documents that improve performance by 7-12%.

### 7.3 Law 16: The Autonomy-Control Dialectic
EvoSkill navigates this by freezing the model (control) while allowing skill evolution (autonomy). The dialectic manifests at the skill level: more skills = more autonomy = more potential failure modes from skill interactions.

### 7.4 Law 18: The Abstraction Gate Law
EvoSkill literally implements an abstraction gate — lifting optimization from the prompt/code level to the skill level. This abstraction change is what enables transferability.

### 7.5 Law 6: Memory Is the Attack Surface
The cumulative feedback history H is a memory system. If compromised, it could bias the Proposer toward harmful skill proposals. The skill folders themselves become persistent memory that governs agent behavior.

---

## 8. Limitations & Gaps

### 8.1 Statistical Significance
Each configuration evaluated in **a single run** due to computational cost of Opus 4.5. No variance analysis, no confidence intervals. The authors acknowledge this. This is the most significant limitation.

### 8.2 Narrow Benchmark Coverage
Only 2 primary benchmarks (OfficeQA, SealQA) + 1 transfer test (BrowseComp). All are fact-seeking/QA tasks. Unknown whether the approach works for:
- Code generation
- Creative tasks
- Multi-turn dialogue
- Tasks without clear ground truth

### 8.3 No Skill Interaction Analysis
The paper doesn't analyze how skills interact when composed. The skill-merge result hints at complementarity but doesn't examine:
- Skill conflicts (two skills giving contradictory guidance)
- Skill redundancy detection
- Optimal skill set size
- Whether skills can interfere destructively

### 8.4 Ground-Truth Dependency
The Proposer needs ground-truth answers to diagnose failures. This limits applicability to supervised settings. Reinforcement from human feedback (no ground truth) would require a different failure detection mechanism.

### 8.5 Compute Cost
Running Opus 4.5 in the evolution loop is expensive. The paper doesn't report total compute costs, number of API calls, or cost per discovered skill. This matters for practical adoption.

### 8.6 Security of Generated Skills
No analysis of whether the evolution process could generate malicious or adversarial skills. The Skill-Builder is guided by a meta-skill with best practices, but there's no formal guarantee that generated skills are safe.

### 8.7 Skill Lifecycle
No mechanism for deprecating or versioning skills over time. As the skill library grows, how do you:
- Remove skills that become counterproductive?
- Handle model upgrades that make certain skills obsolete?
- Manage skill versioning across deployments?

---

## 9. Repo Status Assessment

| Metric | Value | Trend |
|--------|-------|-------|
| Stars | 163 | ↑ from ~109 (2 weeks ago) |
| Forks | 12 | ↑ from 9 |
| Commits | 179 | Active (last push ~9 days ago on 2026-03-06) |
| Structure | src/, scripts/, notebooks/, assets/ | Well-organized |
| Claude Skills | .claude/skills/ present | Uses own framework (dog-fooding) |
| Organization | Sentient (sentient-agi) | Company-backed |

**Assessment:** Moderately active, company-backed project. Growth from 109→163 stars in ~2 weeks suggests rising interest. The `.claude/skills/` directory presence confirms they use their own framework in development. Potential concern: development may have stalled (last push 9 days ago), but this is within normal variance.

---

## 10. Actionable Implications for Our System

### 10.1 Direct Implementation Path
We have existing SKILL.md infrastructure. EvoSkill's minimum viable implementation:
1. **Failure collection:** QA agent already produces rejection reasons → structure as analyzable traces
2. **Proposer prompt:** Analyze (trace, failure) → identify capability gap → propose SKILL.md
3. **Skill-Builder prompt:** Materialize proposal into structured folder
4. **Validation:** Re-run on held-out known-good tasks
5. **Feedback log:** Append-only record of proposals + outcomes

### 10.2 Key Architectural Decisions
- **Freeze reasoning core** (aligns with P53: Grounded Self-Evolution permits Capability Evolution while Reasoning Core stays immutable)
- **Treat generated skills as untrusted code** — audit before deployment
- **Maintain Pareto frontier** of agent configurations, not just latest-best
- **Category-aware sampling** for training data to ensure coverage

### 10.3 What NOT to Do
- Don't optimize prompts directly — optimize skills (the abstraction insight)
- Don't use >10% training data for evolution (diminishing returns)
- Don't skip feedback history — it prevents redundant proposals and enables iterative refinement
- Don't allow unrestricted write access — only Skill-Builder writes to skills directory

---

## 11. Cross-References

| Paper/System | Connection to EvoSkill |
|-------------|----------------------|
| **MetaClaw** | Production version of EvoSkill pattern + RL weight updates. Complementary. |
| **SkillRL (2602.08234)** | Parallel failure-driven skill discovery via RL. Less interpretable. |
| **AgenticCyOps (2603.09134)** | P2 (capability scoping) maps to Skill-Builder's restricted write access. |
| **HyMEM (2603.10291)** | Different evolution unit (graph nodes vs. skill documents). |
| **IBM Trajectory Memory (2603.10600)** | Different evolution unit (structured tips vs. skills). |
| **PlugMem (2603.03296)** | Different evolution unit (knowledge propositions vs. skills). |
| **AlphaEvolve** | Predecessor; optimizes code/prompts not skills. |
| **GEPA** | Predecessor; optimizes low-level artifacts not skills. |
| **Voyager** | Pioneer in skill libraries; model-dependent programs vs. model-agnostic instructions. |
| **Arbiter (2603.08993)** | Predicts EvoSkill composition will shift bugs from boundary contradictions to composition-seam defects. |

---

## 12. Bottom Line

**EvoSkill's lasting contribution is the abstraction-level insight: optimize skills (reusable, interpretable, model-agnostic workflow documents) rather than prompts or code.** The Pareto frontier mechanism and cumulative feedback history are solid engineering choices that prevent common evolutionary pitfalls. The zero-shot transfer result (+5.3% on BrowseComp) provides the strongest evidence that this abstraction level is correct.

**Rating: ★★★★ HIGH** — High methodological quality, directly actionable for our system, and represents a genuine architectural insight. Dock one star for single-run evaluations, narrow benchmark coverage, and no security analysis of generated skills.

---

*Scout Deep-Dive | arXiv:2603.02766 | Completed 2026-03-15 | ~12KB*
