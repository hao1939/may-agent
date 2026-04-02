# DD#336 — COMIC: Agentic Sketch Comedy Generation
**Paper:** COMIC: Agentic Sketch Comedy Generation  
**arXiv:** 2603.11048v1 (cs.CV, cs.AI, cs.CL, cs.MA, cs.NE — 11 Mar 2026)  
**Authors:** Susung Hong, Brian Curless, Ira Kemelmacher-Shlizerman, Steve Seitz (University of Washington)  
**Project:** https://susunghong.github.io/COMIC/

---

## 1. Problem & Motivation

Can AI produce content that is genuinely funny? While LLMs excel at structured tasks (coding, math), humor remains uniquely challenging — subjective, context-dependent, multi-dimensional, and resistant to fixed reward functions. Professional sketch comedy (SNL, Key & Peele) requires brainstorming many ideas, iterative revision, and multiple production roles. COMIC tackles the full pipeline: from character references → comedic script → multi-shot video production.

**Key insight:** Humor's subjectivity means no fixed objective function works. Goodhart's Law bites hard — optimizing a humor proxy doesn't produce funny content. Instead, COMIC uses **relative fitness**: scripts compete against each other via pairwise tournaments, and quality is defined by competitive performance, not distance from an ideal.

---

## 2. Architecture — Multi-Agent Production Studio

COMIC models a production studio with agentic counterparts for each role:

| Agent Role | Function |
|---|---|
| **Writer** | Generates concepts, expands into full dialogues |
| **Critic** | Evaluates and compares scripts pairwise |
| **Editor** | Revises losing scripts based on critic feedback |
| **Scene Director** | Translates script → storyboard (shot specifications) |
| **Image/Video Generator** | Renders visual content per shot |
| **Voice Generator** | Synthesizes character audio |
| **Rendering Critic** | Evaluates and refines rendered videos |

### 2.1 Island-Based Competitive Evolution

The core innovation is the **multi-island topology**:

- Script population partitioned into K isolated islands {I₁, ..., Iₖ}
- Each island governed by a **specialized critic committee** Cₖ with distinct comedic preferences
- Within each island: **round-robin pairwise tournaments**
  - Two scripts compared by every critic in local committee
  - Losing script revised using winner's feedback (semantic crossover + mutation)
  - This implements **Red Queen dynamics** — fitness is relative to current competitors

**Fitness function:** f⁽ᵍ⁾(s) = expected win rate of script s against current population, given critic committee C and population S⁽ᵍ⁾. Crucially: E[f⁽ᵍ⁾(s)] ≥ E[f⁽ᵍ⁺¹⁾(s)] — the bar keeps rising.

**Why islands matter:**
- Different critic committees embody distinct comedic traditions (slapstick vs. dry wit vs. surreal)
- Populations diverge toward different niches → Pareto frontier of comedic styles
- Computational efficiency: O(K·|Sₖ|²·|Cₖ|) vs O(K²·|Sₖ|²·|Cₖ|) for global tournament

### 2.2 Human-Aligned Critic Generation

Rather than hand-crafting critic prompts, COMIC uses a **generate-and-select** strategy:

1. **Data collection:** 4,940 YouTube sketch videos from 5 channels (SNL, Key & Peele, Foil Arms & Hog, Studio C, Viva La Dirt League)
2. **Engagement scoring:** Fit per-channel logistic growth model to view count trajectories → projected carrying capacity as popularity proxy
3. **Critic pool generation:** Meta-critic agent generates diverse critic personas (10 per channel), calibrated using stratified in-context examples with tier labels
4. **Task-specific selection:** Two comparison tasks per channel:
   - Top vs. Bottom (sensitivity to large quality gaps — 83% accuracy)
   - Top vs. Middle (sensitivity to subtle distinctions — 64% accuracy)
   - Select best critic per task per channel → specialized pool

**Key result:** Task-wise best selection outperforms both mean-of-all-critics (55%/71%) and single-best-critic (57%/74%) baselines. Different comedic traditions genuinely require different evaluative criteria.

### 2.3 Video Rendering Loop

- **Storyboarding:** Scene director generates D scene directions, each specifying N shots with character poses, backgrounds, camera framing
- **Iterative shot refinement:** Each shot refined through |C_render| critic iterations, building history H
- **History tournament:** Single-elimination across refinement history (guards against over-refinement)
- **Scene-level tournament:** Single-elimination across D complete videos → selects best realization
- **Test-time scaling:** Increasing D trades compute for quality without retraining

---

## 3. Key Results

### 3.1 Human Evaluation (7-point Likert, higher = better)

| Method | Funniness | Watch More | vs. Human | Script | Narrative | Realism | Consistency |
|---|---|---|---|---|---|---|---|
| COMIC | **3.45** | **3.09** | **3.05** | **3.32** | **4.50** | 4.27 | 4.50 |
| Sora 2 | 2.73 | 2.73 | 2.32 | 2.45 | 3.36 | **5.73** | **5.50** |
| Veo 3.1 | 2.32 | 2.36 | 2.27 | 2.18 | 3.32 | 4.91 | 5.05 |
| VGoT | 1.18 | 1.27 | 1.14 | 1.00 | 1.23 | 2.00 | 2.32 |
| MovieAgent | 1.27 | 1.09 | 1.18 | 1.09 | 1.09 | 1.27 | 1.14 |

**COMIC beats frontier video models (Sora 2, Veo 3.1) on funniness, engagement, and narrative** despite lower visual realism. The vs. Human score of 3.05 (between "Slightly Less Funny" and "Comparable") is remarkable.

### 3.2 Automated Evaluation (Win Rate vs Middle-Tier Professional Sketches)

| Method | Win Rate | Inter-Diversity | Intra-Diversity |
|---|---|---|---|
| COMIC | **0.44** | **0.78** | **0.68** |
| Sora 2 | 0.075 | 0.53 | 0.72 |
| Veo 3.1 | 0.01 | 0.31 | 0.37 |
| VGoT | 0.00 | 0.00 | 0.00 |
| MovieAgent | 0.00 | 0.00 | 0.00 |

### 3.3 Scaling & Ablations

- **Generational improvement:** Win rate rises sharply through generation 4; inter-diversity recovers after initial convergence
- **Multi-island > single-island:** Higher win rate AND higher intra-diversity (specialization)
- **Scale matters:** Large config (K=4, |Sₖ|=4, |Cₖ|=4, D=4) significantly outperforms small
- **Critics are essential:** A/B study shows humans overwhelmingly prefer critic-refined over critic-free output
- **Cost:** Base config runs in ~1 day on single H200, ~$5 API budget

---

## 4. Theoretical Significance

### 4.1 Connection to Red Queen Hypothesis
COMIC explicitly implements Red Queen dynamics from evolutionary biology: agents must continuously evolve to maintain fitness against co-evolving competitors. This is the first principled application of this concept to creative AI generation.

### 4.2 Arrow's Impossibility Theorem Applied to Humor
The paper invokes Arrow's impossibility theorem — it's impossible to aggregate diverse preference profiles into a single consistent ranking. This justifies the multi-island approach: rather than seeking consensus, COMIC maintains diverse evaluative niches.

### 4.3 Inference-Time Compute Scaling for Open-Ended Tasks
Unlike math/coding where correctness provides clear verification, creative tasks lack ground truth. COMIC demonstrates that **competitive tournament structures** can serve as verification mechanisms for open-ended domains, enabling test-time compute scaling where it was previously impossible.

---

## 5. GUS Framework Integration

### Law 1 (Cognitive Sufficiency)
COMIC demonstrates that LLM cognitive capability is sufficient for humor generation when structured appropriately — the key is **search**, not raw capability. Individual LLM outputs are rarely funny; systematic exploration + selection yields quality.

### Law 2 (Agentic Scaffolding)
The multi-agent production studio architecture is a textbook example of role-based scaffolding amplifying base capabilities. Writer → Critic → Editor → Director → Renderer creates emergent quality impossible from single agents.

### Law 3 (Collaborative Dynamics)
Island-based topology is a novel collaboration pattern: **competitive-cooperative hybrid**. Within islands, scripts compete; across islands, diversity is preserved. This extends our collaboration taxonomy beyond pure cooperation or pure debate.

### Law 4 (Environmental Grounding)
YouTube engagement data serves as environmental grounding — critics are calibrated against real viewer preferences, not artificial benchmarks. This is "grounding through social signal."

### Law 5 (Human-AI Alignment)
The generate-and-select critic strategy is an alignment mechanism: rather than training critics (which risks reward hacking), COMIC generates diverse evaluative perspectives and selects those empirically aligned with human preferences.

### Mechanism Connections
- **M7 (Debate/Argumentation):** Pairwise tournaments are structured debates
- **M8 (Role Specialization):** Production studio roles (writer, critic, director, renderer)
- **M14 (Evolutionary/Population Methods):** Island-based evolution with semantic crossover
- **M17 (Constitutional/Governance):** Critic committees as governance structures
- **M20 (Quality-Diversity Search):** Multi-island topology maintains diverse solution niches

---

## 6. Novel Contributions to Multi-Agent Research

1. **Relative fitness for creative tasks** — First principled alternative to fixed reward functions for open-ended domains
2. **Automated critic alignment** — Generate-and-select from engagement data, no fine-tuning needed
3. **Island-based creative evolution** — Multi-island topology preserving diversity while driving quality
4. **Semantic crossover operator** — Critic feedback as evolutionary crossover + mutation in a single step
5. **Dual tournament structure** — History tournaments (depth) + scene tournaments (breadth) for video
6. **Creative inference-time scaling** — Demonstrated that compute → quality scaling works for humor

---

## 7. Limitations & Open Questions

- YouTube view counts as humor proxy introduces noise (clickbait, algorithmic promotion)
- No sound effects — audio limited to dialogue
- Visual realism still below frontier video models (Sora 2, Veo 3.1)
- Generalization beyond sketch comedy format unclear
- Originality attribution when building on large corpora remains unaddressed
- Could island migration (periodic script exchange between islands) further improve quality?

---

## 8. Cross-References

- DD#277 (CMAG): Constitutional governance parallels critic committee governance
- DD#293 (CoMAM): Collaborative memory optimization — COMIC's memory bank M stores character assets across shots
- DD#296 (LMEB): Benchmark design — COMIC's engagement-aligned evaluation is a novel benchmark methodology
- DD#305 (BICC): Bilateral context control — COMIC's shot-to-shot continuity via reference shots
- CR#168 (Runtime Safety Intelligence): COMIC's critic alignment connects to runtime evaluation stacks

---

*Scout DD#336 — 2026-03-16*
