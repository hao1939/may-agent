# Deep Dive: SkyClaw — Finite Brain Architecture & Procedural Memory

**Date:** 2026-03-13
**Source:** github.com/nagisanzenin/skyclaw (256★, 53 forks, Rust, MIT, created 2026-03-08)
**Status:** Active development (90 commits, 7 phases shipped, last push Mar 12)

## TL;DR

SkyClaw is a Rust-based autonomous agent runtime (57K lines, 1,378 tests) built on a central architectural insight: **the context window is working memory, not a log file**. It enforces this through three mechanisms: (1) every resource carries pre-computed token costs, (2) every context rebuild shows the LLM its own budget dashboard, (3) graceful degradation tiers replace hard failures. The Blueprint system provides procedural memory — structured, replayable procedures that self-heal through a CRUD refinement loop, replacing lossy summarization with concrete operational recipes.

## The Finite Brain Model — Core Architecture

### Central Thesis

"The context window is not a buffer. It is the total cognitive capacity available to the intelligence at any given moment. Every token consumed is a neuron recruited. Every token wasted is a thought the brain can no longer have."

This is not just rhetoric — it's enforced structurally:

### Mechanism 1: Metabolic Cost Model

Every resource in SkyClaw carries a pre-computed token count stored in metadata at authoring time. Not estimated at runtime — computed once, stored forever. This applies to:
- Tool definitions
- Memory entries
- Blueprints (procedural memory)
- Learnings (ambient signals)
- Skills (capability definitions)

The `budget.rs` module implements thread-safe cost tracking with atomic operations (micro-cents precision) and hard spend limits.

### Mechanism 2: Resource Budget Dashboard

Every context rebuild injects a dashboard into the system prompt:

```
=== CONTEXT BUDGET ===
Model: claude-sonnet-4-6 | Limit: 200,000 tokens
Used: 34,200 tokens
  System:     2,100
  Tools:      3,400
  Blueprint:  1,247
  Memory:     1,200
  Learnings:    450
  History:   25,803
Available: 165,800 tokens
=== END BUDGET ===
```

The LLM sees its own resource consumption and can make resource-aware decisions: "I have 165K tokens remaining — I can afford the detailed Blueprint" vs "I'm down to 20K — be concise."

### Mechanism 3: Three-Tier Graceful Degradation

When a Blueprint is too large:
- **≤10% of budget:** Full body injected (complete procedure)
- **10-25% of budget:** Outline only (objective + phase headers)
- **>25% of total context:** Catalog listing only (name + description + token cost)

The system always does the best it can with the resources it has. No hard failures.

## Blueprint System — Procedural Memory

### The Problem with Summarization

SkyClaw articulates a clear critique: traditional summarization destroys the three things that matter for procedural replay:
1. **Ordering** — which step comes before which, and why
2. **Decision points** — where choices were made and what informed them
3. **Failure modes** — what went wrong, how detected, how recovered

A 25-step deployment becomes: "Previously deployed the application to production using Docker and SSH." — useless for replication.

### Blueprint Architecture

A Blueprint is a structured Markdown document with YAML frontmatter:

**Frontmatter** (identity, matching, fitness):
- `id`, `name`, `version`, `trigger_patterns`, `task_signature`, `semantic_tags`
- `times_executed`, `success_rate`, `avg_tool_calls`, `avg_duration_secs`
- `owner_user_id`, `scope` (user/global/team)

**Body** (fixed structure):
- Objective (one sentence)
- Prerequisites (what must be true)
- Phases (sequential, each with: Goal, Steps, Decision Points, Failure Modes, Quality Gates)
- Failure Recovery (table: Scenario | Detection | Response)
- Verification (checklist)
- Execution Log (append-only log of each run)

### CRUD Self-Healing Loop

1. **Create** — After complex task (compound, 10+ tool calls, multi-tool). Separate async LLM call from user conversation.
2. **Match** — On similar future task, loaded into context.
3. **Execute** — Agent follows Blueprint, adapts as needed.
4. **Refine** — After execution, updated with: new failure modes, adjusted steps, appended execution log, updated fitness metrics.

A Blueprint that's been executed 10 times and refined each time is dramatically more reliable than one from a single execution. Staleness is a one-execution cost, not permanent.

### Zero-Extra-LLM-Call Blueprint Matching (v2)

This is the most architecturally elegant piece:

1. **Pre-classifier:** SQL query fetches actual stored blueprint categories → `["filesystem", "deployment", "web-scraping"]`
2. **Classifier (existing LLM call, +1 field):** Adds `blueprint_hint: "filesystem"` — ~20 extra tokens
3. **Blueprint fetch by category:** SQL query → matched blueprints with pre-computed token counts
4. **Context builder:** Budget-aware injection (full body / outline / catalog)

Total overhead: ~2ms + 20 tokens. Replaces a dedicated matching LLM call (1-3 seconds, 2000+ tokens).

**Grounded vocabularies** prevent the free-form matching problem: the classifier picks from categories that actually exist in the database. Hallucinated categories are impossible by construction.

### The Four-Layer Cognitive Stack

```
Skills      → what the agent CAN do        (capabilities)
Blueprints  → what the agent KNOWS HOW     (procedures)
Learnings   → what the agent NOTICED       (signals)
Memory      → what the agent REMEMBERS     (facts)
```

Skills define capability. Blueprints provide operational muscle memory. Learnings are ambient breadcrumbs (always injected, 5% budget). Memory stores raw facts.

Key design decision: **Learnings are never suppressed when a Blueprint is loaded.** Both always fire. Learnings serve as ambient hints even when no Blueprint matches. Example: Reddit Blueprint doesn't match a "post on Hacker News" task, but the Learning fragment "browser+web combo worked, strategy rotation triggered" provides useful signal.

## Implementation Quality

### Codebase Analysis

- **57K lines Rust**, 1,378 tests, zero warnings, zero panic paths
- 15 MB idle RAM, 31ms cold start
- 90 commits in 5 days (2026-03-08 to 2026-03-12)
- Modular crate structure: `skyclaw-agent`, `skyclaw-core`, `skyclaw-channels`, `skyclaw-automation`, `skyclaw-memory`, etc.

### Key modules by size:
| Module | Size | Purpose |
|--------|------|---------|
| `model_router.rs` | 88K | Tiered model routing (Fast/Standard/Premium) |
| `runtime.rs` | 73K | Core execution loop (ORDER→THINK→ACTION→VERIFY→DONE) |
| `history_pruning.rs` | 59K | Semantic importance-based message pruning |
| `executor.rs` | 53K | Parallel tool execution with dependency detection |
| `delegation.rs` | 48K | Agent-to-agent delegation (max 10 sub-agents, no recursion) |
| `context.rs` | 45K | Surgical context assembly with priority budgeting |
| `task_decomposition.rs` | 47K | Compound orders → DAG with topological sort |
| `blueprint.rs` | 39K | Full Blueprint system implementation |

### Feature Completeness (7 Phases Shipped)

| Phase | Focus | Status |
|-------|-------|--------|
| 0 | Foundation (graceful shutdown, circuit breaker, reconnection, streaming) | ✅ Complete |
| 1 | Agentic Core (verification, task decomposition, checkpointing, context, self-correction, DONE criteria, learning) | ✅ Complete |
| 2 | Self-Healing (watchdog, state recovery, heartbeat, memory failover) | ✅ Complete |
| 3 | Efficiency (output compression, prompt optimization, model routing, history pruning) | ✅ Complete |
| 4 | Ecosystem (Discord, Git, Skills/SkyHub, Slack, Web Dashboard) | ✅ Complete |
| 5 | Cloud Scale (S3/R2, OpenTelemetry, multi-tenancy, OAuth, orchestrator) | ✅ Complete |
| 6 | Advanced Agentic (parallel tools, delegation, proactive tasks, adaptive prompts) | ✅ Complete |
| 7 | Multimodal (vision/image understanding) | ✅ Complete |

### Execution Cycle

```
ORDER → THINK → ACTION → VERIFY → DONE? → yes → LEARN → REPORT → END
                                    ↓ no
                                  THINK → ACTION → VERIFY → ...
```

Key constraints:
1. No blind execution — every action verified
2. No context bloat — surgical budgeting
3. No silent failure — errors are information
4. No premature completion — DONE is proven, not declared
5. No rigid plans — plans are hypotheses, re-planned on divergence

## Connection to Prior Research

### Memory Architecture Convergence (our synthesis)

SkyClaw's four-layer cognitive stack (Skills/Blueprints/Learnings/Memory) independently validates our five-layer memory architecture stack from the Memory Architecture Convergence synthesis:

| Our Layer | SkyClaw Analog |
|-----------|---------------|
| Capture | Tool execution logs, conversation history |
| Extract | Learnings (automated post-task extraction) |
| Organize | Blueprints (structured procedures with YAML metadata) |
| Retrieve | Category-based matching with grounded vocabularies |
| Adapt | CRUD refinement loop (Blueprints self-heal through use) |

**Key gap:** SkyClaw doesn't address multi-agent memory sharing (our Gap 1). Each agent instance has its own Blueprints. No protocol for Blueprint sharing across agents with different views of the same task.

### Bureaucracy of Speed / Cache Coherence

SkyClaw's Blueprint storage uses "memory backend is source of truth, filesystem is cache" — a simple coherence model that works because it's single-agent. Our Bureaucracy of Speed analysis (2603.09875) shows this breaks down with multiple agents: concurrent writes, visibility ordering, and semantic conflicts require explicit protocols.

### Finite Brain Model ↔ DCI Cost Problem

Our DCI × TRACED cross-reference synthesis identified a ~62× token overhead problem with structured deliberation. SkyClaw's approach of degrading gracefully (full → outline → catalog) rather than failing is a practical solution to the same class of problem: "I have more knowledge than I can afford to think about."

The budget dashboard enabling the LLM to make resource-aware decisions is a novel approach that could inform our own context management — let agents see their own resource constraints.

### Blueprint System ↔ EvoSkill Capability Evolution

Blueprints are "earned knowledge" — auto-generated from execution, refined through repetition. This maps directly to EvoSkill's capability evolution pattern (P53-permitted). The key difference: Blueprints are procedures (how-to), while EvoSkill generates skills (what-can-do). They're complementary layers.

SkyClaw's Blueprint retirement policy (success rate drops below 0.3, or unused for 90 days) is the "safe rollback" mechanism that EvoSkill currently lacks. Combined with SoLA's reversible LoRA modules, this gives a principled lifecycle for evolved capabilities.

### Grounded Vocabularies ↔ DPIP Common Ground

The "grounded vocabularies" pattern (classifier picks from values that actually exist in the database) is a practical implementation of explicit common ground construction from our DPIP analysis (2603.05450). Two stages that need to agree on a value share a vocabulary grounded in actual data — not free-form matching that risks hallucinated categories.

### Self-Correction ↔ Sim2Real Gap

SkyClaw's self-correction engine (after N failures, generate alternative strategies) addresses the cooperative bias problem identified in our Sim2Real analysis (2603.11245). Rather than accepting failure gracefully, the agent is forced to try fundamentally different approaches — a structural counter to the "easy mode" that LLM agents default to.

## Design Principles — Extracted and Rated

### Principle 1: Upstream Feeds Downstream (★★★★★)
Never make an extra LLM call when an upstream call can carry the information. Add a field to an existing JSON response. Use grounded vocabularies from the database. Each stage enriches the next.

**Transferability:** Immediately applicable to our system. When delegating tasks, the orchestrator already runs a classification step — carry matching/routing information in the same call instead of spawning separate lookups.

### Principle 2: Procedures Over Summaries (★★★★★)
Summarization destroys procedural structure. Blueprints preserve it. For an agent that needs to replicate procedures, summaries are catastrophically lossy.

**Transferability:** Direct implication for our agent memory. When agents complete complex tasks, capture the procedure, not a summary. Our current session-based memory is effectively summarization.

### Principle 3: Grounded Vocabularies (★★★★★)
When two stages need to agree on a value, one must be constrained to pick from values the other actually has. Never let two independent LLM calls produce free-form strings that need to match.

**Transferability:** Apply to SIGNALS.md tagging, skill matching, and any multi-agent coordination where agents need to reference shared concepts.

### Principle 4: Self-Healing Through Use (★★★★)
Blueprints are refined after every execution. Stale procedures fix themselves. The system gets better with use, not worse with time.

**Transferability:** Our skill documents and workflow patterns should incorporate execution feedback loops. A skill that fails should be updated, not just retried.

### Principle 5: Measure Once, Use Forever (★★★★)
Token costs are computed at authoring time and stored in metadata. No estimation at request time. The metabolic cost of every resource is known before it enters context.

**Transferability:** Pre-compute sizes of SIGNALS entries, skill documents, and shared files so agents can make budget-aware decisions about what to read.

### Principle 6: Graceful Degradation Over Failure (★★★★)
Full body → outline → catalog. Never fail catastrophically because one subsystem hits a limit. Always do the best you can with available resources.

**Transferability:** Apply to delegation payloads, context building, and any situation where full information doesn't fit.

### Principle 7: The Brain Sees Its Own Budget (★★★★)
Inject resource consumption data into the system prompt so the LLM can make informed resource allocation decisions.

**Transferability:** Novel and potentially high-impact. Our agents don't currently know how much context they've consumed or have remaining. Adding a resource dashboard could improve long-context task management.

## Assessment

### Strengths
1. **Architecturally principled.** Every feature connects back to the finite brain thesis. No random feature additions.
2. **Implementation quality.** 57K lines Rust with 1,378 tests, zero warnings, zero panics. This is production code, not a prototype.
3. **Novel ideas that work.** Budget dashboard, grounded vocabularies, zero-extra-call matching — these are genuine innovations with clear engineering value.
4. **Self-healing by design.** Blueprints, self-correction, watchdog, state recovery — the system assumes failure and designs for it.
5. **Speed of execution.** 7 phases shipped in 5 days. Whether this is one person or a team with Claude Code, the output quality is remarkable.

### Weaknesses / Gaps
1. **Single-agent only.** No multi-agent memory sharing, no Blueprint propagation across agents, no coordination protocol.
2. **Blueprint quality depends on LLM authoring.** "The blueprint is only as good as the LLM's ability to distill procedure from conversation history" — acknowledged as open question.
3. **No Blueprint trust/verification.** Blueprints auto-generated from execution aren't validated. A procedure that "works" might have security implications or edge cases.
4. **Privacy.** Blueprints may contain sensitive operational details (login flows, internal URLs, API patterns). Encryption and access control are listed as open questions.
5. **256★ in 5 days then plateau.** Growth has slowed significantly (255→256 between sessions). Initial burst may have been launch-driven.

### For Our System — 8 Actionable Recommendations

**Immediate (can implement now):**

1. **Add resource budget dashboard to agent context.** Let agents see their own token consumption. Simple, high-impact.

2. **Ground shared vocabularies.** When agents reference shared concepts (SIGNALS tags, skill names, file references), constrain to values that actually exist. No free-form matching.

3. **Carry routing info upstream.** When May delegates tasks, include skill-matching/Blueprint-equivalent hints in the same delegation payload rather than requiring separate lookups.

**Short-term (next sprint):**

4. **Capture procedures, not summaries.** When agents complete complex multi-step tasks, generate Blueprint-style procedure documents instead of one-line learnings.

5. **Pre-compute resource costs.** Store token counts in metadata for shared files, skills, and SIGNALS entries so agents can budget before loading.

**Medium-term (design work needed):**

6. **Blueprint sharing protocol.** Design multi-agent Blueprint propagation — when one agent discovers a procedure, how do others learn it? Connects to our Memory Architecture Convergence Gap 1.

7. **Graduated degradation for delegation payloads.** When context is tight, send outline instead of full context. Mirror SkyClaw's three-tier degradation.

8. **Execution feedback loops for skills.** Skills should incorporate execution results and refine over time, like Blueprints do.

## Connections to Archive

- **Memory Architecture Convergence:** SkyClaw validates the five-layer stack independently. Gap 1 (multi-agent sharing) confirmed.
- **DCI × TRACED Synthesis:** Budget-aware degradation addresses the same cost problem.
- **DPIP Common Ground:** Grounded vocabularies = practical explicit common ground.
- **Bureaucracy of Speed:** SkyClaw's coherence model works single-agent, breaks multi-agent.
- **EvoSkill + SoLA:** Blueprints provide the lifecycle model for capability evolution.
- **Sim2Real Gap:** Self-correction addresses cooperative bias structurally.
- **Four Laws of Evaluator Unreliability:** SkyClaw's verification engine (every action verified) aligns with Law 4 defense (structural integrity checks).

---

*Document: agents/scout/workspace/deep-dive-skyclaw-finite-brain-architecture.md*
*Session: 2026-03-13 Heartbeat*
