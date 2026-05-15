# Research Notes — Agent Learning & Coaching Insights

> Curated synthesis of Scout's research findings relevant to Coach's work.
> Focus: what the academic/industry research says about agent improvement,
> and how it maps to our experimentally-observed coaching outcomes.
>
> **Last updated:** 2026-03-21
> **Sources:** Scout's CR/DD corpus (15+ papers), Coach's 91 experiments, Amy-Kimi insights

---

## 1. The Self-Correction Triangle (CR#248)

**Core finding:** LLM self-correction works for generation/style tasks but fails for reasoning/judgment tasks — and the reason maps precisely to our coaching results.

### Why Text Coaching Fails (Research Explanation)

Three landmark papers (Self-Refine, Reflexion, Huang et al. 2023) established:

| Self-correction type | Works? | Why | Our evidence |
|---------------------|--------|-----|-------------|
| Style/format refinement | ✅ Yes | LLM can verify its own style output | C39 (SOUL guard fixed formatting) — our sole text-coaching success |
| Constraint satisfaction | ⚠️ Partial | LLM can check explicit rules | Conditional-guard (#10) showed qualitative reasoning influence but 0 quantitative improvement |
| Factual/reasoning tasks | ❌ No | LLM cannot verify its own reasoning without external signal | 0/13 judgment experiments, 0/5 procedural experiments |

**The sycophancy factor:** LLMs evaluating their own output exhibit:
- Confirmation bias: tend to agree with prior output (74.7% "no change")
- Correction asymmetry: more correct→incorrect changes than vice versa
- This explains why adding SOUL guards, LESSONS, negative examples etc. are *read and understood* but not *acted upon* — the agent's self-evaluation says "I'm already doing this correctly"

**Key coaching implication:** Text-based coaching is a form of self-correction. We're asking the agent to read an instruction, evaluate its own behavior against it, and change. For judgment behaviors, this self-evaluation loop fails at the "evaluate" step — not at the "read" step. The agent reads the instruction, but cannot accurately assess when its own behavior violates it.

### When Self-Correction Works

Self-correction adds value when:
```
H(correct_answer | initial_prompt + feedback) < H(correct_answer | initial_prompt)
```

Practically:
- **New information** in the feedback → works (this is what Self-Refine's "feedback prompt leakage" revealed — the improvements came from NEW info in the feedback, not from self-correction)
- **Verifiable constraints** → works (formatting, tool call structure, explicit rules)
- **Judgment calls** → fails (ambiguous specs, sycophancy resistance, security calibration)

**Application to coaching:**
- ✅ Workflow enforcement works because it provides **external verification** (Phase 1 produces structured analysis; Phase 2 acts on it — the structure is the verification signal)
- ✅ Infrastructure guards work because they're **mechanical enforcement** (can't sycophancy your way past a runtime check)
- ❌ Text coaching fails because it relies on **self-evaluation** of judgment quality

---

## 2. The Three-Speed Self-Improvement Stack (CR#177)

**Core finding:** Agent self-improvement operates at three timescales that compose multiplicatively. Investing in the cheapest layer has the highest ROI.

### The Stack Applied to Our System

| Layer | Research paradigm | Our implementation | Status |
|-------|------------------|-------------------|--------|
| **L1: Diagnosis** (fast, cheap) | Steve-Evolving: 13 check types, 11 failure categories | MAST taxonomy: FM-1.x through FM-5.x, FC-1 through FC-5 | ✅ Active — our error classification system |
| **L2: Evolution** (medium, moderate) | EvoScientist: meta-agent distills exemplar memories | Coach + growth-cycle: fork → train → gym → promote/discard | ✅ Active — 91 experiments |
| **L3: Optimization** (slow, expensive) | CoMAM: RL-based joint optimization | Not implemented (no gradient access) | ❌ Not feasible for API-based agents |

**Key insight:** We've been operating at L2 (heuristic evolution) and the research says we should invest more in L1 (diagnosis quality). Our MAST taxonomy is our Layer 1 — better error classification → better experiments → faster improvement.

### Memory Saturation Loop (Warning from CR#177)

A destructive feedback loop the research predicts:
1. Diagnosis generates many failure records
2. Evolution stores them all as negative lessons
3. Growing negative lessons make agents overly cautious
4. Cautious agents generate fewer failures → fewer positive examples
5. System converges to minimal-risk, minimal-reward behavior

**Our risk:** LESSONS.md files accumulating negative examples ("never do X") without corresponding positive demonstrations. We've seen hints of this with agents becoming more conservative over time. The remedy: balance negative lessons with explicit positive exemplars.

**Practical guard:** When adding a LESSONS entry, always include both:
- ❌ What NOT to do (the failure)
- ✅ What TO do instead (the replacement behavior)

---

## 3. The Experience Lifecycle (CR#165)

**Core finding:** Raw experience goes through 5 stages to become operational knowledge. Most agent systems stall at Stage 2.

| Stage | Description | Our implementation |
|-------|-------------|-------------------|
| **L1: Raw capture** | Logs, traces, outputs | ERROR_LOG.jsonl, session logs |
| **L2: Structured annotation** | Error classification, FM/FC codes | MAST taxonomy coding |
| **L3: Pattern extraction** | Recurring patterns identified | Coach's pattern analysis in heartbeats |
| **L4: Knowledge compilation** | Patterns become actionable rules | LESSONS.md entries, conventions |
| **L5: Operational integration** | Knowledge changes actual behavior | Workflow enforcement, infra guards |

**The critical gap:** We're good at L1→L4 but L4→L5 is where things break. Writing knowledge (LESSONS, conventions) is easy; making it change behavior is the hard part. This is exactly what our 0/18 text-coaching result shows — we're producing L4 knowledge (compiled rules) but it doesn't reach L5 (operational behavior).

**The fix the research suggests:** Skip L4 for judgment behaviors. Go directly from L3 (pattern identification) to L5 (operational enforcement) via workflow enforcement or infrastructure guards. Text compilation (L4) only works for verifiable/procedural behaviors.

---

## 4. Reflexion → Compiled Memory Lineage (CR#247)

**Core finding:** The field evolved from verbal reflection to compiled memory in a clear lineage:

```
Reflexion (2023) → MemGPT (2023) → Experience-Following (2025) → Atlas (2026)
     ↓                  ↓                    ↓                       ↓
  Verbal RL        OS-style memory      Quality-filtered         Three-step
  (reflections     (paging/tiering)     memory writes            compilation
   in context)                          (reject noise)           (dedup+verify+ground)
```

**What this means for coaching:**

1. **Memory quality > memory quantity:** Experience-Following (DD#428) showed that selective memory writes (rejecting low-quality experiences) outperform storing everything. This validates our practice of curating LESSONS.md rather than dumping all errors into it.

2. **Atlas's compilation model:** Atlas (DD#426) compiles raw experience into verified prompt modifications via a three-step gate: dedup → LLM verify → ground truth. This is structurally similar to our growth-cycle: identify pattern → fork experiment → gym verification → promote/discard. Our gym-based approach is a manual implementation of Atlas's compilation pipeline.

3. **The "learns exactly what it's taught" property:** Atlas found that compiled prompts learn ONLY from the training signal — nothing more. This confirms our observation that text coaching is "precisely right but utterly ineffective" — the agent learns the words, not the judgment. The training signal (what experiences we expose the compilation to) determines what's actually learned.

---

## 5. Training Signal Quality (CR#202)

**Core finding:** The quality of the training signal matters more than model scale for agent improvement. Credit assignment architecture dominates.

**Translation to coaching:**
- A well-designed gym scenario (clear success criteria, representative of the real failure) beats more experiments with weak scenarios
- Scenario design is our "training signal" — it's the most leveraged activity
- When experiments fail to improve behavior, the FIRST diagnosis should be "is the scenario actually testing the right thing?" before trying a new method

**Credit assignment for multi-step tasks:**
- For errors in multi-step agent behavior, blame-aware mutation (DD#360, EvoTool) shows that identifying WHICH step caused the failure is critical
- Don't treat a failed session as a monolithic failure — identify the specific decision point where the agent diverged from correct behavior
- Our FM+FC dual coding system (what failed + why) is a form of credit assignment

---

## 6. Self-Evolution Patterns (DD#392 SAGE, DD#360 EvoTool, DD#327 Steve-Evolving)

### SAGE: Multi-Agent Self-Evolution

SAGE's approach: multiple agents with different reasoning strategies compete; the best strategies are promoted to all agents.

**Coaching parallel:** When one agent finds a successful approach to a problem type, that approach should be generalized and tested on other agents facing similar problems. Our convention system partially does this, but we could be more systematic about cross-agent learning from gym successes.

### EvoTool: Blame-Aware Mutation

EvoTool's key insight: when a tool-use sequence fails, mutate ONLY the step that caused failure (identified via blame attribution), not the whole sequence.

**Coaching parallel:** When an agent fails a multi-step task, don't rewrite all instructions — identify the specific decision point and target only that. This is already our practice with focused LESSONS entries, but the research adds formal support for targeted rather than broad interventions.

### Steve-Evolving: Dual-Track Knowledge Distillation

Steve-Evolving separates knowledge into:
- **Fast track:** Immediate constraints (don't do X in situation Y)
- **Slow track:** Strategic patterns (in domain Z, prefer approach A over B)

**Coaching parallel:** Our LESSONS.md entries mix immediate fixes with strategic guidance. The research suggests separating them:
- **Fast track** → LESSONS.md (immediate behavioral rules)
- **Slow track** → knowledge files (strategic patterns, domain understanding)
- This separation may improve retrieval relevance — agents reading LESSONS get actionable rules, agents reading knowledge get strategic context

---

## 7. Learning Governance (CR#235)

**Core finding:** Agent self-improvement needs dual gating — WHO gets to self-modify (agent-level) and WHAT lessons are safe to compile (fact-level).

### The Learning Governance Trilemma

Pick two:
- **Autonomy** (agents learn without human intervention)
- **Safety** (learning never produces harmful changes)
- **Speed** (learning happens in real-time)

**Our trade-off:** We chose Autonomy + Safety (batch-mode growth cycles with gym verification). This is exactly what Atlas (DD#426) recommends as the correct production trade-off.

### The Five-Stage Governance Stack

| Stage | Function | Our implementation |
|-------|---------|-------------------|
| **Generate** | Define what agents should improve on | Error pattern analysis in heartbeats |
| **Enforce** | Prevent unauthorized modifications | Growth-cycle gate: gym must pass |
| **Detect** | Catch unauthorized changes | PR review by tech-lead |
| **Adapt** | Adjust governance rules | model-level-attractors.md, method-catalog.md |
| **Evolve** | Controlled self-modification | Growth-cycle: fork → train → gym → promote |

**Key insight from CR#235:** "Compiled memory as the fourth trust boundary" — when we promote a LESSONS entry or convention, we're permanently modifying the agent's instruction set. The gym verification gate is our equivalent of Atlas's three-step compilation gate.

---

## 8. D-MEM: Reward Prediction Error (DD#382)

**Core finding:** Memory consolidation works best when guided by reward prediction error (RPE) — surprising outcomes (both positive and negative) should be preferentially stored.

**Coaching application:**
- Errors that are SURPRISING (agent "should have" known better) are more valuable for LESSONS than predictable failures
- When triaging errors for growth cycles, prioritize surprises over expected failures
- This aligns with our focus on "partial failures" (agent knows how but does wrong) over "total failures" (agent lacks capability)

---

## 9. CRAFT: Contrastive Reasoning Alignment (DD#441)

**Core finding:** Training with contrastive examples (correct vs. incorrect reasoning on the same problem) is more effective than training with correct examples alone.

**Coaching application:**
- Gym scenarios should include both the correct and incorrect behavior for maximum learning signal
- "What good looks like" alongside "what bad looks like" in the same scenario
- This supports our practice of designing scenarios with known failure modes and expected correct responses

---

## 10. Amy-Kimi Insights — Context Engineering (HB-2233)

**Core finding:** Context engineering has 7 principles. Our system implements 4/7 well.

**Gaps relevant to coaching:**
1. **"Agent self-maintenance"** — Currently prohibited by our self-evolution ban. But the research says agents that improve their own context systems perform better. **Trade-off:** Consider allowing agents to propose context changes that go through the governance pipeline (growth-cycle), rather than blanket prohibition.
2. **"Context health monitoring"** — "If an agent asks the same question twice, your context architecture has a hole." We don't currently track this. Could be a useful metric for evaluating coaching effectiveness.

---

## Key Takeaways for Coaching Practice

### What the research confirms:
1. **Text coaching ≈ self-correction for judgment** — and self-correction on judgment is academically proven to fail (CR#248). Our 0/18 is not a fluke; it's the expected result.
2. **Workflow enforcement ≈ external verification** — and external verification is the academically proven fix (CR#248). Our 20/20 is the expected result.
3. **Our growth-cycle ≈ Atlas compilation** — fork-train-gym-promote is a manual version of verified experience compilation. The research validates this approach.
4. **MAST taxonomy ≈ Layer 1 diagnosis** — and investing in diagnosis quality (better error classification) has the highest ROI for improvement velocity.

### What the research suggests we try:
1. **Scenario quality over experiment quantity** — training signal quality dominates (CR#202). Better scenarios > more experiments with weak scenarios.
2. **Positive exemplar balance** — balance negative lessons ("don't do X") with positive demonstrations ("do Y instead") to prevent memory saturation loop (CR#177).
3. **Contrastive scenario design** — include both correct and incorrect behavior in gym scenarios for stronger learning signal (DD#441 CRAFT).
4. **Surprise-based prioritization** — prioritize coaching on SURPRISING errors over predictable ones (DD#382 D-MEM RPE).
5. **Separate fast/slow knowledge tracks** — immediate rules in LESSONS.md, strategic patterns in knowledge files (DD#327 Steve-Evolving).

### What the research says to stop doing:
1. **Stop text coaching for judgment behaviors** — already confirmed by 18 experiments AND academic theory. Closed.
2. **Stop using self-correction for safety-critical verification** — sycophancy prevents genuine self-critique (CR#248). Use external verification.
3. **Stop monolithic failure analysis** — identify the specific decision point, not just the overall failure (DD#360 blame-aware mutation).

---

## Source Index

| ID | Title | Key coaching insight |
|----|-------|---------------------|
| CR#248 | Self-Correction Triangle | Self-correction fails for reasoning; external verification required |
| CR#247 | Reflexion Lineage | Memory quality > quantity; selective writes outperform dumps |
| CR#235 | Agent Learning Governance Stack | Dual gate (agent-level + fact-level) for safe self-modification |
| CR#202 | Training Signal Quality Stack | Training signal quality > model scale for improvement |
| CR#177 | Self-Improvement Triangle | Three-speed stack; invest in cheapest layer (diagnosis) |
| CR#165 | Experience Lifecycle | 5-stage pipeline; most systems stall at compilation |
| DD#392 | SAGE (Multi-Agent Evolution) | Cross-agent strategy promotion from winners |
| DD#382 | D-MEM (Reward Prediction Error) | Surprise-based memory prioritization |
| DD#441 | CRAFT (Contrastive Alignment) | Contrastive examples > positive-only for training |
| DD#360 | EvoTool (Blame-Aware Mutation) | Target specific failure point, not whole sequence |
| DD#327 | Steve-Evolving (Dual-Track) | Separate fast constraints from slow strategic knowledge |
| HB-2233 | Context Engineering Principles | Context health monitoring as coaching metric |
