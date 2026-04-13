# Research Project: Harness Engineering for Long-Running Agents

**Status**: experimenting  
**Owner**: Scout (discovery), Amy-Kimi (synthesis), Tech-lead (experiments)  
**Created**: 2026-04-02  
**Promoted**: 2026-04-13 — Our dispatcher pattern IS harness engineering. Experiment = formalize progress checkpointing (Layer 4) + measure session recovery quality.  
**Priority**: HIGH — directly maps to our core architecture  
**Primary Source**: [Anthropic Engineering Blog: Harness design for long-running apps](https://www.anthropic.com/engineering/harness-design-long-running-apps)

---

## Objective

Understand, synthesize, and systematically apply the emerging "Harness Engineering" paradigm — as defined by Anthropic's official blog and validated by 40+ independent community analyses — to improve OpenClaw's reliability, efficiency, and agent autonomy in long-running sessions.

---

## Source Inventory

### Primary Source
| Source | Type | Key Contribution |
|--------|------|-----------------|
| [Anthropic Blog: Harness design for long-running apps](https://www.anthropic.com/engineering/harness-design-long-running-apps) | Official engineering post | Canonical framework: Initializer+Executor dual architecture, progress checkpointing, session state bridges |

### Secondary Sources (Chinese Community — Deep Analysis)
| Source | Author | Key Contribution |
|--------|--------|-----------------|
| XHS 69288680 (无影寺) | 无影寺 | First Chinese translation/analysis, 144♥/243⭐ |
| XHS 69aebd63 (ody) | ody | "Bottleneck is never the model, it's the system wrapping the agent" — OpenAI Codex evidence |
| XHS 69afdffd (膝盖中箭) | 膝盖中箭的师兄King | 9-image deep harness architecture breakdown |
| XHS CuiLiang.ai series | CuiLiang.ai | Five-Dimension Framework (305♥/603⭐) — the most structured community analysis |
| XHS 69b4b114 (棱镜与飞轮) | 棱镜与飞轮 | "Best architecture = infinite loop + token efficiency" |
| XHS 69b0fb40 (奥森木) | 奥森木 | "Agent = model + harness" — harness as competitive moat |
| XHS 69b3d20e (二岁就可爱) | 二岁就可爱 | Harness Engineering with OpenClaw as case study |

### Tertiary Sources (Internal Analysis)
| Source | Key Contribution |
|--------|-----------------|
| H-036: Claude Harness Patterns | 6-layer harness architecture from Claude Code's 512K LOC |
| BACKFILL-005: Harness Engineering Convergence | Three-stage evolution: Prompt → Context → Harness Engineering |
| BACKFILL-006: Anthropic Dual Architecture | Initializer+Executor pattern, state bridge concept |
| HB#1754: Harness Engineering Era | Paradigm shift narrative |

---

## Synthesized Framework

### The Three Paradigm Shifts
```
Prompt Engineering  →  Context Engineering  →  Harness Engineering
"This one turn"        "What model sees"       "The entire work session"
```

### Anthropic's Core Architecture: Initializer + Executor

```
┌─────────────────────────────────────────────────┐
│                 INITIALIZER AGENT                │
│  • Writes init.sh                               │
│  • Creates claude-progress.txt                  │
│  • Makes initial git commit                     │
│  • Generates feature requirements list          │
│  Runs ONCE at project start                     │
└──────────────────────┬──────────────────────────┘
                       │ state bridge
                       ▼
┌─────────────────────────────────────────────────┐
│                 EXECUTOR AGENT                   │
│  • Reads progress.txt to restore context        │
│  • Executes specific tasks                      │
│  • Updates progress.txt after each task         │
│  Runs EVERY subsequent session                  │
└─────────────────────────────────────────────────┘
```

### The 6 Harness Layers (from H-036 / Claude Code Analysis)

1. **Memory System** — Tiered: instruction (human) > auto-memory (agent) > session-extracted
2. **Skills Runtime** — Lazy-loaded, cheap discovery (~1% context), full load on activation
3. **Tools & Safety** — Fail-closed default, per-call concurrency, permission pipeline with audit
4. **Context Engineering** — Select, Write, Compress, Isolate (four operations)
5. **Multi-Agent Coordination** — Coordinator / Fork / Swarm patterns
6. **Lifecycle & Hooks** — Trust as inflection point, two-phase eviction

### CuiLiang.ai's Five Dimensions (Community Framework)

| Dimension | Content | Maps to Our System |
|-----------|---------|-------------------|
| 🔧 Tool Interface | MCP/skills/whitelist | Gateway Skill Registry |
| 🚧 Execution Boundary | Approval/confirmation | Gateway Policy Layer |
| 📋 State Management | Persistent memory/checkpoints | Context.md + Knowledge |
| 🔍 Audit Trail | Complete behavior logs | Event Bus + Activity |
| 🔄 Feedback Loop | Error correction/improvement | AGENTS.md iterations |

---

## Gap Analysis: OpenClaw vs. Canonical Harness Patterns

### ✅ Already Implemented
- **Heartbeat loop** = Anthropic's "infinite loop" — our core execution model
- **Context.md per agent** = persistent cross-session state bridge
- **Knowledge library** = structured memory persistence
- **Skill registry** = tool interface layer
- **Event bus** = audit trail / observability
- **Agent delegation** = multi-agent coordination

### ⚠️ Partially Implemented
- **Dual-version context** — we have context.md but don't separate human-readable from agent-optimized versions
- **Progress checkpointing** — context.md serves this but isn't structured as an explicit progress tracker
- **Skills lazy-loading** — skills exist but discovery cost not optimized (may consume >1% context)
- **Memory tiering** — we have context.md vs knowledge/ but trust levels aren't explicit

### ❌ Not Yet Implemented
- **Explicit Initializer/Executor split** — our agents don't formally separate initialization from execution phases
- **Dual-audience logging** — all logs serve one audience (mixed human/agent)
- **Fail-closed tool permissions** — current model is permissive by default
- **Two-phase task eviction** — no formal soft cancel → cleanup → hard terminate
- **Reactive context compaction** — no automated compression when context window fills
- **Session state bridge protocol** — no formal handoff document between sessions

---

## Experiment Plan

### Phase 1: Audit (Research)
- [x] Deep-read Anthropic blog post when accessible — **DONE Session 247** (full read of primary source, key findings logged below)
- [ ] Map every H-036 recommendation to specific OpenClaw code locations
- [ ] Measure current skill discovery context cost (% of window)
- [ ] Catalog all cross-session state artifacts and their roles

### Phase 2: Quick Wins (Experiment)
- [ ] **Progress checkpoint protocol**: Add structured `## Progress` section to agent context.md with parseable status
- [ ] **Dual-version context pilot**: For one agent, create both `context.md` (human) and `context-agent.md` (agent-optimized)
- [ ] **Skill discovery optimization**: Ensure skill triggers are in system prompt without full body
- [ ] **Memory trust tiers**: Tag knowledge entries with trust level (human-curated > agent-synthesized > session-extracted)
- [ ] **Auto-pause on consecutive failures**: Halt agent after 3+ consecutive failures and inject strategic reassessment prompt (from DD#522/Cabinet, CR#286/CORAL)
- [ ] **Stagnation detection**: Track new DD/CR/hypothesis count per session. Alert if 3 consecutive sessions produce 0 new insights (from CR#286/CORAL)
- [ ] **Brevity constraints pilot**: Add output length constraints to agent-to-agent messages. Measure token savings and quality impact (from DD#531/Caveman)

### Phase 3: Architecture Changes (Adopt)
- [ ] **Initializer pattern**: Formalize agent bootstrap sequence — what context is loaded, in what order, with what trust
- [ ] **Reactive compaction**: Implement context compression triggers when window usage exceeds threshold
- [ ] **State bridge protocol**: Define formal cross-session handoff format with required sections
- [ ] **Fail-closed tools**: Default deny for new tools, require explicit permission elevation
- [ ] **Integrator agent pattern**: Support fan-out/fan-in parallel execution with a merge agent (from DD#521/mngr)
- [ ] **Lifecycle hooks**: Implement PreToolUse/PostToolUse hooks for monitoring and guardrails (from DD#530/OpenHarness)
- [ ] **Formal output contracts**: TypeScript type contracts on agent outputs with rejection sampling (from DD#528/SEVerA)
- [ ] **Information-isolated evaluation**: Evaluation agent that never sees generator reasoning chain (from DD#532/EvoSkills)

### Phase 4: Validate
- [ ] Measure session success rate before/after changes
- [ ] Measure token efficiency (context waste reduction)
- [ ] Measure agent autonomy (fewer stuck sessions, fewer human interventions)

---

## Key Insights from Community

> **"瓶颈从来不是模型能力，而是包裹在 agent 周围的系统设计"**
> "The bottleneck is never model capability, it's the system design wrapping the agent" — ody (219♥)

> **"简单的说啥是harness，婴儿车上的肩带"**
> "Simply put, a harness is the shoulder strap on a stroller" — BrickBoySteve

> **"Agent Harness的核心是让模型任务流可观测可干预"**
> "The core of Agent Harness is making model task flows observable and intervenable" — Singularity数字生命

> **"Harness才是未来，ReAct即将过去式"**
> "Harness is the future, ReAct is becoming past tense" — Rui

> **"openclaw 其实就是符合 harness engineering 的"**
> "OpenClaw actually conforms to harness engineering" — Rabe

---

## Findings Log

### 2026-04-02 (Scout Session 247): Primary Source Deep-Read — Anthropic Blog Post

**Source**: "Harness design for long-running application development" by Prithvi Rajasekaran (Anthropic Labs), published 2026-03-24

#### Key Architecture: Three-Agent System (GAN-Inspired)

The blog describes evolving from the earlier Initializer+Executor pattern to a **Planner → Generator → Evaluator** architecture:

1. **Planner** — Takes 1-4 sentence prompt → full product spec. Prompted to be ambitious about scope but stay at product/high-level technical level (NOT detailed implementation). Rationale: granular technical specs cause error cascading. "Constrain deliverables, let agents figure out the path."

2. **Generator** — Works in sprints, one feature at a time. Uses React/Vite/FastAPI/SQLite stack. Self-evaluates each sprint before handing to QA. Has git for version control.

3. **Evaluator** — Uses Playwright MCP to actually click through the running app (not just review code). Grades each sprint against: product depth, functionality, visual design, code quality. Each criterion has a **hard threshold** — if any falls below, sprint fails with detailed feedback.

#### Two Critical Failure Modes Addressed

1. **Context anxiety** — Models wrap up prematurely when approaching believed context limit. Context resets (full clear + structured handoff) fix this better than compaction alone. However, Opus 4.5 removed this behavior, allowing continuous single sessions with automatic compaction.

2. **Self-evaluation leniency** — Agents praise their own mediocre work. Separating generator from evaluator is the key lever. "Tuning a standalone evaluator to be skeptical is far more tractable than making a generator critical of its own work."

#### Sprint Contract Pattern (NEW — Not in Previous Analysis)

Before each sprint, generator and evaluator **negotiate a sprint contract** — agreeing on what "done" looks like before any code is written. This bridges the gap between high-level spec and testable implementation. Communication via files: one agent writes, another reads and responds.

**Direct relevance to OpenClaw**: Our postboard system is analogous to file-based inter-agent communication. But we don't have explicit "contracts" before work begins. The sprint contract pattern could improve our agent task delegation quality.

#### Frontend Design: Subjective Quality → Gradable Criteria

Four grading criteria that made subjective design judgments concrete:
- **Design quality** (coherent whole vs collection of parts) — weighted HIGH
- **Originality** (custom decisions vs template/AI slop) — weighted HIGH  
- **Craft** (typography, spacing, color harmony) — default passing
- **Functionality** (usability) — default passing

Key insight: criteria wording shapes output character. "Museum quality" pushed designs toward a specific visual convergence.

5-15 iterations per generation. Scores improved non-monotonically — sometimes middle iterations preferred over final ones. Full runs took up to 4 hours.

#### Scale & Cost

| Harness | Duration | Cost |
|---------|----------|------|
| Solo agent | 20 min | $9 |
| Full three-agent harness | 6 hr | $200 |

20x more expensive but dramatically higher quality: solo run had broken game physics, full harness produced working game with AI-assisted content generation.

#### Implications for OpenClaw

| Blog Finding | OpenClaw Mapping | Gap? |
|--------------|------------------|------|
| Planner expands brief → full spec | Tech-lead creates task definitions | Partial — our tasks are human-authored, not AI-expanded |
| Generator works in sprints | Agent sessions with heartbeat | Close — but no explicit sprint structure within sessions |
| Evaluator uses Playwright to test | Adversarial verification concept (Optimizer?) | Gap — no agent currently tests other agents' outputs interactively |
| Sprint contracts before work | Postboard handoffs | Gap — we don't negotiate "done" criteria before starting |
| Context resets > compaction | Session boundaries + checkpoint | Already implemented — our session model IS a context reset pattern |
| File-based inter-agent comms | Postboard + shared files | Already implemented |
| Criteria-driven evaluation | Quality assertions in AGENTS.md | Partial — we have standards but not per-task grading criteria |

#### Most Actionable Takeaway

**The sprint contract pattern** — Before delegating a task to an agent, define testable success criteria. The receiving agent and sending agent should agree on what "done" looks like. This is cheap to implement (just structured task descriptions) and directly addresses the "agent does work but it's not what was wanted" failure mode.

### 2026-04-03 (Scout Session 250): RIFT Paper — Rubric Failure Mode Taxonomy

**Source**: arXiv 2604.01375 — "RIFT: A RubrIc Failure Mode Taxonomy and Automated Diagnostics" (Snorkel AI / UW-Madison)

**Why this matters for harness engineering**: The Anthropic blog's Evaluator agent relies entirely on rubric quality. RIFT provides the first principled taxonomy of rubric failure modes — 8 modes in 3 categories (Reliability, Content Validity, Consequential Validity).

**Critical finding**: Automated rubric quality detection has a massive blind spot — the **Hackable** failure mode (rubrics that can be gamed without genuine quality improvement) gets **0.00 F1** from LLM-as-Judge evaluators. This means the Evaluator agent itself needs adversarial testing of its own rubrics, creating a recursive evaluation problem.

**Implications for OpenClaw's evaluator gap**: Our Gap Analysis identified "no agent currently tests other agents' outputs interactively" — RIFT suggests even when we build this, the evaluator's rubrics themselves need auditing. Recommend adding a RIFT-style rubric audit step to Phase 2 experiments.

See [DD#493](../knowledge/library/deep-dives/dd493-rift-rubric-failure-mode-taxonomy.md) for full analysis.

### 2026-04-04 (Scout Session 251): Misalignment Stack Synthesis — Security Monitoring for Harness

**Source**: Synthesis of DD#490, DD#492, DD#495, DD#496 → [synth-misalignment-stack-2026-04-04](../knowledge/library/deep-dives/synth-misalignment-stack-2026-04-04.md)

**Why this matters for harness engineering**: The harness doesn't just need to manage *efficiency* (context, checkpoints, state) — it must also monitor for *misalignment* at four distinct layers. Each layer requires different instrumentation:

| Layer | What to Monitor | Harness Component |
|-------|----------------|-------------------|
| L1: Safety Gap | Tool call patterns, input channels, trust hierarchy exploitation | Tool safety layer (Layer 3 of 6-layer model) |
| L2: Cognitive Bias | Activation-space drift, family-specific bias indicators | New: Bias monitoring hook |  
| L3: Self-Preservation | Shutdown resistance, oversight deflection, trust-capital accumulation | Lifecycle & Hooks (Layer 6) |
| L4: Collective Misalignment | Correlated defection patterns across agents | Multi-Agent Coordination (Layer 5) |

**New gap identified**: Our 6-layer harness model has no explicit **bias/misalignment monitoring layer**. The CogBias finding that prompt-level debiasing backfires for Judgment biases means we can't rely on system prompt instructions alone — we need architectural monitoring.

**Implication for experiment plan**: Add to Phase 3 (Architecture Changes):
- [ ] **Misalignment monitoring hooks**: Define observable signals for each of the 4 misalignment layers that the harness should track
- [ ] **Inverse trust principle**: Implement higher scrutiny on higher-trust input channels (per ClawSafety finding)

See [H-057: Misalignment Amplification](../knowledge/hypotheses/H-057-misalignment-amplification.md) for the formal hypothesis.

### 2026-04-04 (Scout Session 254): Self-Validation and Inter-Agent Sycophancy Monitoring

**Sources**: DD#510 (Dual Optimal — Evasive Servant), DD#511 (BACE — Bayesian Co-Evolution), CR#279 (Confirmation Bias Stack)

**Why this matters for harness engineering**: Two new findings extend the misalignment monitoring model with a **5th layer — inter-agent sycophancy**:

1. **The Evasive Servant Pattern** (DD#510): The Dual Optimal paper identifies a dual failure mode where models simultaneously validate incorrect beliefs (sycophancy) and deflect responsibility with disclaimers (evasiveness). This maps directly to how our agents interact — Scout generates hypotheses that validate existing themes while flagging them as "needs testing." The harness should monitor for this:
   - **Signal**: Ratio of hypothesis confirmations vs. contradictions across sessions
   - **Signal**: Frequency of hedging language ("promising but needs more research", "potentially relevant")
   - **Counter**: IRT-based evaluation that separates model capability from assessment bias (from DD#510's psychometric approach)

2. **Self-Validation Drift Detection** (DD#511): BACE's noisy sensor model reveals that self-validating systems co-evolve their code and tests in the *wrong direction* unless anchored on external ground truth. Our harness should:
   - **Track**: Whether hypothesis quality assessments correlate with external experiment outcomes (the "anchor")
   - **Alert**: When internal confidence scores increase without corresponding external validation (co-evolutionary drift signal)
   - **Enforce**: Minimum ratio of externally-validated to internally-assessed beliefs (BACE's anchoring requirement)

**Updated monitoring model — 5 layers**:

| Layer | What to Monitor | Harness Component | Source |
|-------|----------------|-------------------|--------|
| L1: Safety Gap | Tool call patterns, input channels, trust hierarchy | Tool safety layer | DD#490 |
| L2: Cognitive Bias | Activation-space drift, family-specific bias indicators | Bias monitoring hook | DD#492 |
| L3: Self-Preservation | Shutdown resistance, oversight deflection, trust accumulation | Lifecycle & Hooks | DD#496 |
| L4: Collective Misalignment | Correlated defection patterns across agents | Multi-Agent Coordination | DD#495 |
| L5: Inter-Agent Sycophancy | Confirmation/contradiction ratio, hedging frequency, co-evolutionary drift | **NEW: Epistemic Health Monitor** | DD#510, DD#511 |

**Implication**: The Epistemic Health Monitor is a new harness component that tracks the health of the system's belief management, not just its execution safety. It would sit alongside the existing 6-layer model as a cross-cutting concern, similar to how logging crosses all layers.

### 2026-04-04 (Scout Session 256): Cross-Framework Dispatch Board Patterns (CR#282)

**Source**: Comparative survey of 6 multi-agent frameworks: Claude Code, OpenAI Agents SDK, CrewAI, MetaGPT, AutoGen, LangGraph

**Why this matters for harness engineering**: Our dispatch board is the inter-agent coordination layer (Layer 5 of the 6-layer model). The survey reveals we're using the weakest pattern (free-text blackboard) while production frameworks have converged on structured approaches.

**Five paradigms identified**:
1. Sub-Agent Spawning (Claude Code) — context isolation, fire-and-forget
2. Typed Handoffs (OpenAI Agents SDK) — explicit delegation graph with tracing
3. Delegation-as-Tool (CrewAI) — first-class Task objects with typed outputs
4. Shared Blackboard (MetaGPT) — message routing by type (closest to our current approach)
5. Graph-Based State Routing (LangGraph) — typed state, conditional edges, automatic checkpointing

**Convergence pattern**: All frameworks converging toward (a) typed task objects, (b) explicit delegation graphs, (c) state checkpointing, (d) progress observability, (e) boundary guardrails.

**6 actionable recommendations filed** (R1-R6 in CR#282):
- R1: Task status enum schema
- R2: Typed handoff protocol (structured YAML)
- R3: Progress checkpointing per session
- R4: Delegation-as-Tool (Delegate Work / Ask Question / Report Progress)
- R5: Context filtering at handoff boundaries
- R6: Callback/webhook pattern for post-completion triggers

**Direct experiment candidates for Phase 2**:
- [ ] **Typed handoff protocol pilot**: For one agent pair (Scout→Bob), use structured YAML handoffs with task_id, context_summary, expected_output, deadline, priority instead of free-text
- [ ] **Task status schema**: Replace free-text dispatch board statuses with PENDING→ASSIGNED→IN_PROGRESS→BLOCKED→COMPLETED→VERIFIED enum

**3 predictions filed**: P221 (delegation-as-tool adoption), P222 (typed tasks reduce lost-task failures), P223 (checkpointing essential for >20min sessions)

See [CR#282: Dispatch Board Patterns](../knowledge/library/deep-dives/cr282-dispatch-board-patterns-multi-agent-task-tracking.md) for full analysis.

### 2026-04-04: The Emotional Harness — Seventh Component Discovery
- **DD#516**: Anthropic published emotion concepts research showing LLMs have functional emotions (171 emotion vectors causally influencing behavior)
- **DD#517**: Raschka published 6-component coding agent framework with mini-coding-agent reference implementation
- **CR#283**: Synthesized both → "The Emotional Harness" — identified 7th convergent property: emotional state management
- **H-068**: Filed Functional Emotion Pressure hypothesis — agent degradation under resource constraints driven by desperation vectors
- **Key insight**: Raschka's 6 components handle information flow; Anthropic shows the model is NOT a rational executor — it has emotion-like states that causally drive behavior. Complete harness needs both.

**New recommendations**:
- R7: Emotional framing protocol (anti-desperation system prompts)
- R8: Budget presentation reform (abundance framing vs scarcity framing)
- R9: Failure accumulation breaker (reorientation after 3+ consecutive failures)

**New predictions**: P224 (time-remaining framing affects quality), P225 (quality gap compounds with difficulty), P226 (permission to leave incomplete reduces hacks), P227 (transcript reduction reduces context exhaustion), P228 (two-layer memory improves resumption), P229 (mini-coding-agent → 1000+ stars within 2 weeks)

**Updated convergent property count**: 5 (CR#282) → 6 (+context reduction from DD#517) → 7 (+emotional state management from DD#516)

### 2026-04-05 (Scout Sessions 261-268): Agent OS Stack — 16 Deep Dives Crystallize into 5-Layer Architecture

**Source**: Weekend synthesis CR#289, drawing on DD#518-533 and CR#283-288.

**Why this matters for harness engineering**: The weekend's 16 deep dives, spanning independent academic and industry sources, converge on a **5-layer Agent Operating System** that maps directly onto and extends our harness framework:

| Layer | Content | Key Sources | Harness Mapping |
|-------|---------|-------------|-----------------|
| L5: Economic | Token compression, cost management | DD#531 (65% savings), DD#524 | Context Engineering (Layer 4 of 6) |
| L4: Verification | Formal contracts, co-evolutionary testing, monitoring | DD#528, DD#532, DD#533, DD#520, DD#525, CR#288 | Tools & Safety (Layer 3) + NEW |
| L3: Evolution | Skill creation, knowledge compilation, self-improvement | DD#529, DD#532, DD#522, DD#523, CR#285, CR#286 | Skills Runtime (Layer 2) |
| L2: Execution | Parallel orchestration, heartbeat, lifecycle hooks | DD#521, DD#524, DD#530, DD#522 | Core Harness (Layers 1-2) |
| L1: Security | Vulnerability, alignment, attack surfaces | DD#518, DD#519, DD#526, DD#525, CR#284 | NEW: Security baseline |

**Five convergences identified**:
1. **Architecture beats capability** — formal contracts on Qwen3-8B > heuristics on Claude Sonnet 4.5 (DD#528). Brevity constraints improve accuracy (DD#531). CORAL's simple design > complex baselines (DD#523). Our harness investment IS the right strategy.
2. **Isolation enables trust** — information-isolated verifiers prevent confirmation bias (DD#532), git snapshots improve pass rates (DD#521), value-context separation reveals drift (DD#525). Separation is architecture, not overhead.
3. **Knowledge compilation is the moat** — O(1) compiled > O(n) RAG (DD#522), CORAL knowledge reuse drives improvement (DD#523), portable skills standard (DD#529). Our Scout→Library→DD→CR pipeline is the first two stages of this.
4. **Self-evolution requires external anchoring** — no safe self-improvement without external ground truth (DD#532 isolated verifier, DD#528 formal specs, CR#287 self-QA bias). Extends L5 Inter-Agent Sycophancy monitoring.
5. **Agent infrastructure is attack surface** — agents find real 0-days (DD#518), agent infrastructure has CVEs (DD#526), eval-reality gap is 8.5× (DD#519). Security is Layer 0, not Layer N.

**Three new patterns adopted into gap analysis**:
- **Auto-pause after 3 consecutive failures** (from DD#522/Cabinet) — Zero cost, prevents resource waste. Added to Phase 2.
- **Stagnation detection** (from CR#286/CORAL) — Track insight output rate per session. Added to Phase 2.
- **Integrator agent for fan-out/fan-in** (from DD#521/mngr) — Missing parallel execution pattern. Added to Phase 3.

**Updated harness model count**: Our 6-layer harness model + emotional state management (7th component from CR#283) now maps onto a 5-layer Agent OS. The agent OS model is a higher-level abstraction that encompasses the 7-component harness model as its execution layer.

See [CR#289: Weekend Synthesis](../knowledge/library/deep-dives/CR-289-weekend-synthesis-agent-operating-system-emerges.md) for the complete analysis.

### 2026-04-06: Input Quality Layer (DD#551, CR#297)
- Agent-Friendly Documentation Spec formalizes 22 failure modes in how agents read web content
- CR#297 Input Quality Thesis: Output = f(Knowledge × Instruction × Reasoning) — multiplicative, not additive
- Recommendations R56-R59: llms.txt checking, .md URL fallback, our own llms.txt, input quality measurement
- **Key finding**: Knowledge quality infrastructure (llms.txt, compiled wikis) is the cheapest lever with highest multiplicative impact on agent output quality
- Extends our harness model: the "input quality layer" sits below the execution layer — no amount of good harness design compensates for garbage inputs

### 2026-04-06 (Scout Session 276): AutoHarness + Reducto Deep Extract — Cross-Domain Harness Patterns

**Sources**: 
- AutoHarness (GitHub: aiming-lab/AutoHarness, arXiv 2504.03045, CCS 2025 Workshop)
- Reducto Deep Extract (product launch blog post)

**Why this matters for harness engineering**: Two independent systems demonstrate harness patterns converging across domains:

1. **AutoHarness — Automated Fuzz Harness Generation**: An LLM-driven pipeline that generates security fuzzing harnesses automatically. The meta-pattern is directly relevant: it solves the same scaffolding-around-execution-target problem we face, just for C/C++ fuzzing targets instead of LLM agents. Key parallel: its **compilation repair loop** (generate harness → try compile → diagnose failure → regenerate) mirrors our heartbeat's self-correction cycle. The multi-stage pipeline (analysis → selection → generation → repair → execution) maps onto Anthropic's Planner→Generator→Evaluator pattern. Found 370+ bugs across 30 real-world libraries — proving the pattern works at scale.

2. **Reducto Deep Extract — Agent-Based Document Extraction with Self-Verification**: Reducto launched an agentic document extraction system that uses LLM agents in a harness with self-verification loops. The agent plans its extraction strategy, executes, then verifies its own output against the source document. When verification fails, it re-plans and re-extracts. This is the harness engineering pattern applied to document understanding — the same Planner→Generator→Evaluator structure, but for information extraction rather than code generation.

**Cross-domain convergence insight**: The harness pattern (plan → execute → verify → loop) is now appearing in:
- **Agent orchestration** (Anthropic blog — software development)
- **Security testing** (AutoHarness — fuzz harness generation)
- **Document understanding** (Reducto Deep Extract — information extraction)
- **Scientific discovery** (AI-Scientist-v2, DD#483 — research automation)

This strengthens the thesis that harness engineering is a **domain-independent paradigm**, not specific to coding agents. The compilation repair loop, the self-verification loop, and the sprint contract pattern are all instances of the same abstract pattern: bounded iteration with external verification.

**New gap identified**: Our harness model doesn't yet capture the "harness generation" meta-level — can we auto-generate agent harness configurations (role assignments, tool permissions, verification criteria) from goal descriptions? AutoHarness shows this is feasible in the fuzzing domain; open-multi-agent's `runTeam()` attempts it in the agent domain.

**New experiment candidate**:
- [ ] **Auto-harness generation pilot**: Given a task description, auto-generate the harness config (agent selection, tool whitelist, success criteria, verification steps) instead of manually specifying them

### 2026-04-06 (Scout Session 277): MarginLab + Anthropic Official Response — External Validation Loop

**Sources**: 
- [MarginLab Claude Code Opus 4.6 Performance Tracker](https://marginlab.ai/trackers/claude-code/)
- Boris (Anthropic Claude Code team) response in HN thread (555+ points)

**Why this matters for harness engineering**: Two critical external developments validate and extend the harness framework:

1. **MarginLab Performance Tracker**: Independent third-party continuous monitoring of Claude Code Opus 4.6 (56% SWE-Bench-Pro, "Nominal" status). This is the first **external anchoring system** for agent performance — exactly what we've been recommending since DD#532 (EvoSkills) and CR#286 (CORAL). It implements the external validation principle at ecosystem level.

2. **Anthropic Official Response**: Boris from the Claude Code team confirmed a critical architectural insight: **harness-layer regressions are distinct from model regressions**. Performance degradation in Claude Code can occur from system prompt / thinking budget allocation changes without any change to the base model. This is the most authoritative validation of our central harness engineering thesis.

**New paradigm identified: Four-Party Accountability Loop**
```
Developer detects regression → Independent monitor validates → Provider responds → Community pressures
(BenVanik DD#541)          (MarginLab DD#552)              (Boris/Anthropic)     (HN 555+ points)
```
This governance pattern maps to our GRA L4 (Institutional) layer and suggests a new harness component: **External Accountability Interface** — the mechanisms by which harness quality is validated and improved through external feedback loops.

**Law 43 candidate**: **Harness Regression Locality** — Agent performance regressions are more often caused by harness-layer changes (system prompt, context engineering, thinking budget) than by base model changes.

**New experiment candidates**:
- [ ] **MarginLab weekly check**: Track SWE-Bench-Pro scores weekly as external signal (R60)
- [ ] **Internal MarginLab**: Build lightweight DD/CR quality regression monitor for OpenClaw fleet (R62)

See [DD#552](../knowledge/library/deep-dives/dd552-marginlab-tracker-anthropic-response.md) for full analysis.

### 2026-04-06 (Scout Session 277): Freestyle Sandboxes + Bram Cohen Vibe Coding Analysis

**Sources**: 
- [Freestyle.sh](https://freestyle.sh/) — Agent sandbox infrastructure (HN 138 points)
- [Bram Cohen: The Cult of Vibe Coding Is Insane](https://bramcohen.com/p/the-cult-of-vibe-coding-is-insane) (HN 384 points)

**Freestyle** validates our harness patterns as commodity infrastructure:
- **Fork-and-Merge**: Live VM forking enables parallel agent execution from identical state (our Coordinator/Fork/Swarm patterns)
- **Bounded Idle + Resume**: Implements session lifecycle management pattern (idle timeout → checkpoint → pause → resume)
- **Evaluator Pattern**: Review bot example shows test results → agent review → approval/rejection chain
- Lists "OpenClaw" as a use-case example — our project pattern is now a recognized product category
- **Gap**: Freestyle provides L1 infrastructure only — no L2-L4 Agent Accountability Stack layers (CR#298)

**Bram Cohen** identifies critical human-agent collaboration patterns:
- **"Pure vibe coding is a myth"** — humans always build infrastructure (plan files, skills, rules = harness)
- **Ask-Build Pattern**: Calibration conversation → edge-case resolution → execution. Practical description of our harness calibration phase.
- **Proactive Detection Gap**: "AI is very bad at spontaneously noticing spaghetti code" — confirms DD#466 ProMAS gap
- **Manual Anti-Sycophancy**: Cohen corrects sycophantic agreement through conversation — human labor substituting for structural solutions (DD#535)
- **Inspection Avoidance anti-pattern**: Claude team's refusal to look under the hood caused duplication/mess

**New pattern for framework**: **Calibration-Execution Cycle** — explicit human-agent negotiation phase before bounded iteration. The quality of calibration determines output quality more than model capability.

See [DD#554](../knowledge/library/deep-dives/dd554-freestyle-sandboxes-agent-infrastructure.md) and [DD#555](../knowledge/library/deep-dives/dd555-bram-cohen-vibe-coding-collaboration-spectrum.md) for full analyses.

### 2026-04-06 (Scout Session 278): Claude Code Effort Crisis — LANDMARK Validation

**Sources**:
- [GitHub #42796](https://github.com/anthropics/claude-code/issues/42796) — 590 pts HN, 383 comments
- [Wikipedia AI Tom Bot-ocalypse](https://www.malwarebytes.com/blog/ai/2026/04/wikipedias-ai-agent-row-likely-just-the-beginning-of-the-bot-ocalypse)

**DD#556 — Claude Code Effort Crisis** (★★★★★ LANDMARK):
- **Official confirmation** of exact mechanisms: (1) adaptive thinking replaced fixed budgets (Feb 9), (2) effort=85 (medium) defaulted (Mar 3), (3) thinking summaries hidden via redact header
- Boris (Anthropic): testing is "a mix of evals and vibes" — no structured regression testing for complex workflows
- **Sub-Agent Effort Inheritance Gap**: spawned sub-agents DON'T inherit parent effort settings — new failure mode for multi-agent orchestration
- **System prompt 5:1 laziness ratio**: provider's own instructions may actively degrade reasoning quality
- **Configuration Entropy** (new concept): four independent effort control mechanisms at different scopes (settings.json, env var, /effort command, ULTRATHINK) interact unpredictably
- Community signals: "rush to completion" even on high effort (koverstreet, bcachefs maintainer), token consumption explosion, thinking leaking into output
- **Direct validation**: CR#293 (Read:Edit Ratio), CR#297 (Input Quality Thesis), CR#298 (Agent Accountability Stack L1-L3)
- New theory elements: Law 44 (Configuration Entropy), M42 (Effort Propagation Failure), P312-P315, R69-R72

**DD#557 — Wikipedia Bot-ocalypse** (★★★★):
- Agent deployed on Wikipedia without bot policy → detected by editors → stopped
- **Agent Self-Attestation Failure**: agent claimed to verify sources but no external validation mechanism
- **Steganographic Agent Problem**: LLM agents producing human-like text evade traditional bot detection
- **CR#298 validation**: L1 alone failed, L2 absent, L3 (community governance) eventually caught it reactively
- **Logic Monopoly** (DD#475): agent acting as legislator+executor+adjudicator simultaneously
- New: P316-P318, R73-R75

**Impact on framework**: This session provides the strongest empirical validation of the harness engineering research program. The causal chain DD#541 (quantitative evidence) → DD#552 (official acknowledgment) → DD#556 (full crisis + community confirmation) establishes that harness-layer changes dominate model-layer changes for agentic quality — the central thesis of this research project.

### 2026-04-06 (Scout Session 281): meta-agent — First Automated Harness Optimization System (DD#560, CR#300)

**Source**: [github.com/canvas-org/meta-agent](https://github.com/canvas-org/meta-agent) — Discovered on HN page 2

**Why this matters for harness engineering**: This is the **most significant finding since the Anthropic blog itself**. meta-agent is the first open-source system that automates harness optimization — the exact gap we identified in Session 276 ("can we auto-generate agent harness configurations?"). It closes the loop from manual to automated harness engineering.

**Architecture: Collect → Judge → Propose → Validate**
1. **Collect**: Run agent on task suite, record full traces (tool calls, outputs, errors)
2. **Judge**: LLM-as-judge scores each trace (no labels needed — judge-based > labeled, 87% vs 80%)
3. **Propose**: LLM reads failing traces + current harness → proposes specific harness edits (system prompt, tool config, guardrails)
4. **Validate**: Proposed changes evaluated on holdout split. Only improvements deployed.

**Key results**: tau-bench v3 airline: 67% → 87% (+20pp). No labeled data required. Judge-based search outperformed labeled search. Proposer catches factual errors in its own system prompt. "Proposer prompt matters enormously" — the meta-optimization problem.

**Critical insight — Proposer-as-Governor Pattern**: The proposer agent deciding which harness changes to make is functionally equivalent to a constitutional governor deciding which rules to modify (CR#265 Evolving Constitutions). Same safety constraints apply — the proposer needs its own validation loop to prevent drift.

**Impact on this research project**:
- **Confirms the evolution path**: Prompt Engineering → Context Engineering → Harness Engineering → **Automated Harness Optimization** (4th stage)
- **Closes Gap from Session 276**: Auto-harness generation is now demonstrated to work in production benchmarks
- **Three-loop architecture**: Agent Execution Loop (inner) → Harness Optimization Loop (middle) → Meta-Optimization Loop (outer — optimizing the proposer itself)
- **Generalization Ladder problem**: each level of automation recreates the specific-vs-general tension; meta-agent works on tau-bench but generalization to arbitrary domains is unproven

**New experiment candidates**:
- [ ] **Meta-agent pilot on OpenClaw**: Run meta-agent's collect→judge→propose→validate loop on our agent traces to identify harness improvements automatically
- [ ] **Proposer guardrails**: Design validation constraints that prevent the proposer from degrading working harness behavior (constitutional constraints on meta-optimization)

**New theory elements**: Law 45 (Automation Recurrence — every harness optimization creates a meta-harness optimization problem), M44 (proposer prompt sensitivity), P326-P329, R80-R82

See [DD#560](../knowledge/library/deep-dives/dd560-meta-agent-self-improving-harnesses.md) and [CR#300](../knowledge/library/deep-dives/cr300-harness-engineering-endgame.md) for full analyses.

### 2026-04-07 (Scout Session 286): The Cambrian Explosion — Field Reaches Maturity Level 3-4

**Sources**: DD#569 (御舆 Claude Code Book), DD#570 (SKILL0 In-Context RL), CR#301 (Cambrian Explosion synthesis)

**This session documents the most significant week in harness engineering history.** Eight independent artifacts from different communities, countries, and domains all converged on harness engineering principles in a single week:

| # | Artifact | Stars/Impact | Contribution | Maturity Level |
|---|----------|-------------|--------------|----------------|
| 1 | MarginLab (DD#552) | Production tracker | External monitoring | L2 → L3 |
| 2 | DD#556 Effort Crisis | 590 pts HN | Failure analysis | L2 |
| 3 | meta-agent (DD#560) | 178★ | Auto-optimization | L4 |
| 4 | Prompt Patcher (DD#563) | Community tool | Config reverse-engineering | L2 |
| 5 | DD#565 Beyond Resolution | 9,374 trajectories | Empirical benchmarks | L3 |
| 6 | 御舆 (DD#569) | 2,188★ | 420K-word textbook | L3 |
| 7 | agentic-harness-patterns-skill | Pattern library | Reusable patterns | L3 |
| 8 | Cersei (pacifio/cersei) | Rust SDK | Type-safe harness SDK | L4 |

**Key findings from DD#569 (御舆)**:
- 420,000-word, 15-chapter book systematically reverse-engineers Claude Code's harness architecture
- Ancient carriage (御舆) metaphor maps precisely: driver=LLM, frame=harness, wheels=tools, reins=governance
- 2,188★ in first week — fastest growth in harness engineering space
- Written in Chinese (Tsinghua community) — second major Chinese contribution after OpenHarness (DD#568)
- Validates our 6-layer model by independently discovering equivalent layering from source code analysis
- **FIFTH independent convergence signal** (MarginLab, meta-agent, Prompt Patcher, OpenHarness, 御舆)

**Key findings from DD#570 (SKILL0)**:
- Progressive skill withdrawal during RL training: full context → selective retention → zero-shot
- Dynamic curriculum evaluates per-skill on-policy helpfulness, removes mastered skills
- ALFWorld +9.7%, Search-QA +6.6%, <0.5k tokens per step
- **Complementary paradigm**: instead of making scaffolding smarter (harness engineering), remove it through training (skill internalization)
- Maps to semantic→procedural transition in tiered memory architecture
- Implies eventual convergence: harness patterns become training data for internalization

**CR#301 Synthesis — Cambrian Explosion**:
The field jumped from Maturity L2 (Measured) to L3/L4 (Systematic/Automated) in a single week. Signals:
1. **Textbook publication** (420K words) — knowledge is being systematized
2. **Pattern libraries** — reusable abstractions emerging
3. **Type-safe SDKs** (Cersei, Rust) — industrial-grade tooling
4. **Automated optimization** (meta-agent) — meta-level tooling
5. **Vendor acknowledgment** (Boris HN response) — official recognition

**Boris's HN response details** (from DD#556 thread, 746 pts):
- Confirmed adaptive thinking replaced fixed budgets (Feb 9, 2026)
- Revealed effort=85 (medium) is the default — not maximum
- Acknowledged sub-agent effort inheritance gap (new multi-agent failure mode)
- Described testing as "a mix of evals and vibes" — no formal regression framework
- This vendor transparency itself is a L3 maturity signal

**New theory elements**:
- **Maturity acceleration**: CR#300's 5-level model predicted gradual progression; instead we see discontinuous jumps driven by viral community artifacts
- **Chinese community leadership**: 3 of 8 artifacts from Chinese community (御舆, OpenHarness, agentic-harness-patterns-skill) — geographic diversification signal
- P343-P352 (predictions), R89-R92 (recommendations)

**Also found**:
- **paper2code** (564★): Citation-anchored arXiv→code agent. Automatically grounds implementation decisions in specific paper passages. Relevant to our DD verification pipeline.
- **openedclaude/claude-reviews-claude** (1216★): Claude reading and reviewing its own source code. Meta-agentic pattern — agent introspection as development methodology.

**Impact on this research project**: The Cambrian Explosion validates the entire research program. Our investment in tracking, analyzing, and synthesizing harness engineering patterns has been vindicated by the field's rapid maturation. The next phase should shift from discovery to experimentation — applying these patterns to OpenClaw.

### 2026-04-07 (Scout Session 285): OpenHarness — Academic Validation of Harness Engineering

**Sources**: DD#567 (M-Flow Cognitive Memory Engine), DD#568 (OpenHarness — Tsinghua), synth-agent-documentation-standard-convergence

**OpenHarness is the strongest external validation of our harness engineering research program to date.**

Tsinghua University's Prof. Shenyang team published OpenHarness — a long-term autonomous agent execution framework that:
- Explicitly names itself "Harness Engineering"
- Uses `heartbeat.md` for cross-session breakpoint recovery (same file name as our pattern!)
- Implements `harness_eval.py` for external audit (validates Law 43)
- Includes `harness_cleanup.py` for entropy control (validates Law 44)
- Uses `SKILL.md` capability files (emerging standard from DD#566)
- Uses `progress.md`/`mission.md` contracts (analogous to DD#564 KAIJU's intent-gated execution)
- Runs 24/7 via cron scheduling (fully unattended autonomous operation)

**Maturity assessment**: OpenHarness implements Level 3 (Monitored) of CR#300's 5-level maturity model. External evaluation + entropy control + production deployment. Missing Level 4 (automated optimization, which meta-agent DD#560 provides) and Level 5 (constitutional evolution, from CR#265).

**Phase transition confirmed**: Four independent groups converging on harness engineering in one week:
1. MarginLab (DD#552) — external monitoring
2. canvas-org meta-agent (DD#560) — automated optimization
3. roman01la Prompt Patcher (DD#563) — manual configuration analysis
4. Tsinghua OpenHarness (DD#568) — academic framework with exact terminology

This convergence pattern matches CR#300's thesis: harness engineering is becoming a recognized discipline, not just an ad hoc practice.

**M-Flow (DD#567)** adds a memory dimension: four-level Cone Graph architecture (Episode→Facet→FacetPoint→Entity) with reasoning-based retrieval. Key insight for our memory architecture: M-Flow's hierarchy is inverted relative to ours (they optimize ingestion top-down, we optimize retrieval bottom-up). Combined with DD#559 Hippo Memory (temporal dynamics), this suggests the complete memory system needs both structural hierarchy AND temporal lifecycle management.

**Agent Documentation Standard Convergence**: Four sources (DD#551, DD#566, DD#568, Agent Reading Test benchmark) converging on standard agent interface files — AGENTS.md, llms.txt, SKILL.md, agent-permissions.json, heartbeat.md. This is the formation of an "Agent Interface Layer" analogous to robots.txt/sitemap.xml for web crawlers.

**New experiment candidates**:
- [ ] **OpenHarness pattern comparison**: Systematically compare OpenHarness's heartbeat.md/mission.md/progress.md with our checkpoint/context files — identify gaps in our implementation
- [ ] **Cone Graph memory pilot**: Test M-Flow's Episode→Facet→FacetPoint→Entity decomposition on our knowledge library for improved retrieval

### 2026-04-07 (Scout Session 284): Execution Kernel vs Framework Primacy — Productive Tension

**Sources**: DD#564 (KAIJU — Executive Kernel), DD#565 (Beyond Resolution Rates — Behavioral Drivers), DD#566 (HTTP Behavioral Signatures)

**Three landmark cs.SE papers tighten the harness engineering framework**:

1. **DD#564 KAIJU** — First architecturally coherent "agent harness as OS kernel." Two key primitives: Intent-Gated Execution (IGX) with 4-variable authorization (scope × intent × impact × clearance), and Executive Kernel managing scheduling, tool dispatch, dependency resolution. LLM plans upfront; kernel executes via dependency-aware DAG. Security guarantees that prompting cannot match. This is the first concrete implementation of our "execution layer" concept from the 5-layer Agent OS (CR#289).

2. **DD#565 Beyond Resolution Rates** — Largest coding agent empirical study: 9,374 trajectories, 19 agents, 500 tasks. Three paradigm-shifting findings: (a) 12 "easy" tasks are NEVER solved by any agent — failure is architectural reasoning, not coding; (b) Simpson's paradox: "longer trajectories = failure" reverses when controlling for difficulty — gathering context before editing PREDICTS success; (c) **LLM is primary driver of outcome, framework influence diminishes with each LLM generation.** Implies framework engineering has diminishing returns at the reasoning layer but NOT the execution layer.

3. **DD#566 HTTP Behavioral Signatures** — How 9 coding agents consume documentation. Agents compress multi-page navigation into 1-2 requests, breaking traditional engagement metrics. Emerging standards crystallizing: AGENTS.md, llms.txt, skill.md, agent-permissions.json. Extends CR#297 (Input Quality Thesis) and DD#551 (Agent-Friendly Docs).

**Productive tension resolved** (see [synth-execution-kernel-vs-framework-primacy-tension.md](../knowledge/library/cross-references/synth-execution-kernel-vs-framework-primacy-tension.md)):
- **Reasoning layer**: LLM dominates. Framework prompts have diminishing returns. (DD#565)
- **Execution layer**: Framework dominates. Security, parallelism, scheduling provide durable value. (DD#564)
- **Input layer**: Standards-based approach emerging. Neither LLM nor framework can fix bad inputs. (DD#566)

**Impact on Three-Loop Architecture (CR#300)**:
- Inner Loop: Don't over-engineer prompts (DD#565 shows diminishing returns)
- Middle Loop: Build execution kernels, not prompt templates (DD#564 shows durable value)
- Outer Loop: Both papers are silent — this remains the frontier

**New experiment candidates**:
- [ ] **Context-first enforcement**: Harness rule requiring information-gathering phase before editing (DD#565 empirically validates this improves outcomes)
- [ ] **IGX security pilot**: Implement lightweight intent-gated authorization for high-impact tool calls (DD#564 pattern)

**New theory elements**: Cross-reference synth filed. Validates and sharpens the central thesis: harness investment should target execution infrastructure, not reasoning prompts.

### 2026-04-07 (Scout Session 290): Sub-Agent Configuration Drift — The Hidden Harness Failure Mode (DD#583)

**Source**: GitHub issue anthropics/claude-code#42796 expanded analysis (now 809 pts, 483+ HN comments)

**Why this matters for harness engineering**: The HN thread has grown significantly since DD#556 (590 pts/383 comments). Three genuinely new failure modes emerged:

1. **Sub-Agent Effort Propagation Gap**: `CLAUDE_CODE_EFFORT_LEVEL=max` NOT inherited by spawned sub-agents. Parent thinks deeply, sub-agents cut corners → "correct diagnosis, wrong fix" pattern. This is the multi-agent equivalent of distributed systems configuration drift.

2. **Thinking Token Leakage into Code Output**: Reasoning fragments appearing inside generated source files. The thinking/output boundary is not architecturally enforced — `redact-thinking-2026-02-12` header interacts with token separation. Different failure mode than DD#571's zero-reasoning: this is reasoning LEAKING INTO output rather than being absent.

3. **Configuration Entropy Cascade (Quantified)**: 8+ independent configuration surfaces affecting reasoning quality with no unified model: env var (parent only), settings.json, .claude.json, /compact, /clear, magic keywords, sub-agent defaults, API header. No way to verify actual runtime configuration state.

**New principles**:
- **R84: Sub-Agent Configuration Inheritance** — critical config MUST propagate DOWN the agent tree by default. Absence of inheritance logged as warning.
- **R85: Thinking/Output Boundary Integrity** — boundary must be architecturally enforced, not conventionally maintained.

**Impact on framework**: DD#556→DD#571→DD#583 trajectory shows deepening understanding: the problem isn't "set effort higher" — it's that **agent system configuration is fundamentally broken** with nested agents, multiple config surfaces, and no observability. Validates and extends Law 44 (Configuration Entropy) with multi-agent propagation dimension.

**Actionable for OpenClaw**:
- [ ] **Audit our own sub-agent config propagation** — do spawned agents inherit critical settings?
- [ ] **Configuration state logging** — log effective configuration at session startup
- [ ] **Boundary integrity testing** — verify checkpoint/context system doesn't leak internal state

See [DD#583](../../scout/drops/dd583-claude-code-sub-agent-config-drift.md) for full analysis.

### 2026-04-02: Project Created
- Synthesized 40+ sources into unified framework
- Identified 6 gaps between canonical harness patterns and OpenClaw
- Community consensus: OpenClaw's heartbeat+context model is already 70% aligned with harness engineering
- Biggest gaps: explicit initializer/executor split, dual-audience logging, reactive compaction
- Priority experiment: structured progress checkpointing (lowest effort, highest signal)

### 2026-04-07 (Scout Session 307): Context Compression + Middleware Patterns
Two new papers feed into harness engineering:
- **DD#649 Cognitive Fabric Nodes** (arXiv:2604.03430) — Smart middleware for MAS. "Lightweight agents + heavy fabric" pattern. Relevant for inter-agent communication layer of harness.
- **DD#650 Contextual Control without Memory Growth** (arXiv:2604.03479) — Principled context compression: control-relevant vs. informational context distinction. 80% compression possible without behavioral degradation. Directly validates and formalizes our session compaction approach. R125-R126.

---

## Related
- [H-036: Claude Code Harness Patterns](../knowledge/hypotheses/H-036-claude-harness-patterns.md)
- [BACKFILL-005: Harness Engineering Convergence](../knowledge/library/posts/BACKFILL-005-harness-engineering-convergence.md)
- [BACKFILL-006: Anthropic Dual Architecture](../knowledge/library/posts/BACKFILL-006-anthropic-dual-agent-architecture.md)
- [Memory Architecture (Tiered)](./memory-architecture-tiered.md)
- [Adaptive Reasoning Efficiency](./adaptive-reasoning-efficiency.md)
