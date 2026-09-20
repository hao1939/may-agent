<ai_context>
summary: "Canonical overview of agent architecture patterns, trends, and proven designs. Consolidated from five overlapping notes; includes September 2026 evidence that instruction-file portability is becoming a native harness concern, while loader semantics still differ across formats."
triggers: ["agent architecture", "architecture patterns", "ReAct", "multi-agent orchestration", "monitor agent", "critic pattern", "tiered memory", "control flow agents", "on-demand attention", "selective recall", "long-context inference", "AGENTS.md", "instruction files"]
last_updated: "2026-09-20"
current_snapshot: "Anthropic's Claude Code repository now contains a built-in agents-md plugin with fallback, additive, CLAUDE.md-only, and managed-only modes; its documented parity gaps show that accepting a portable filename is not the same as reproducing another loader's complete lifecycle semantics."
source_basis: "Merged from agent-architectures.md, agent-architecture-trends.md, agent-patterns.md, agent_patterns.md, agent_architectures_01.md. Sources include HN May 2026 trends, XHS community discussions, internal Scout synthesis, GitHub trending repos June 2026 (scans on Jun 13, 15, 20), and arXiv papers June 2–16 2026 (triages on Jun 14, 15, 17, 19, batch 6/7, session-state Jul 18, runtime-hardening). §Process Harness & §Architecture Gradient extracted to agent-runtime-hardening.md. §Intelligence Entropy through §SaliMory (12 arXiv research papers) extracted to agent-architectures-research.md (2026-07-08). HN updates (2026-08-05): HN 49182946 / Data For Science 'Building an Advanced Agentic Harness' added as practitioner evidence that harness engineering is being pressure-tested around thin orchestrators, benchmarkable structure, budget-aware graceful degradation, and explicit observability rather than framework bulk alone; HN 49189075 / Prime Intellect 'Prime Agent' added as practitioner evidence that self-improving harnesses now face a compression test from stronger base models and code-bloat skepticism. arXiv update (2026-08-06): Skill-Use [2608.04828] added as evidence that skill activation and compliance are harness-conditioned bottlenecks even when skill files already exist. HN update (2026-08-08): HN 49214109 and Prime Agent revision a18809e add concrete evidence that durable self-improvement is becoming a typed, rollback-capable supplemental state plane, while execution continuity and security containment remain separate concerns. arXiv update (2026-08-10): [2608.06953] adds controlled evidence that explicit source/certainty fields preserve epistemic stance under tight memory compression better than parenthetical prose, while showing that the mechanism and best explicit form remain model-dependent. HN update (2026-08-11): HN 49259702 / Lobu adds implementation-level practitioner evidence for treating durable agent memory as an append-only observation proxy with explicit supersession, run-to-input lineage, pre-effect approval, and corrections that survive model replacement. GitHub update (2026-08-19): volcengine/OpenViking revision 98a0104 adds implementation-level evidence that tiered memory is becoming an inspectable, crash-aware data plane with hierarchical retrieval, derived indexes, commit-triggered extraction, and memory diffs. GitHub update (2026-08-20): lesliechowsh/dsh-memo revision 86a94dd adds a reproducible session-localization harness and demonstrates why memory retrieval, evidence reading, and answer generation need separate metrics. GitHub update (2026-09-12): chigwell/Penelopa.ai revision 0abec61 adds repository-authored capture and delivery contracts that separate installation, real hook activity, durable local spooling, server acknowledgement, and stopping collection. GitHub update (2026-09-13): PebbleLog/SimonAgent revision 28f6b0a adds implementation-level evidence for validating and committing semantic memory artifacts before releasing source turns, while retaining a separate emergency context-trimming path. HN update (2026-09-14): HN 49704711 / data-gras/savi-loop-guard revision 43c35c6 adds pinned implementation evidence that repetition detection can be cheap and local, while showing why attempted calls, dispatched effects, progress, and circuit-breaker recovery cannot share one append-only history. GitHub update (2026-09-17): huggingface/funes revision 0612fce adds implementation-level evidence that cross-harness memory can be packaged as a derived, portable dataset while exposing a distinct publication-governance boundary: secret detection, release selection, and remote retraction are not one control. arXiv update (2026-09-18): RAFT [2609.20754v1] adds abstract-level evidence for state-matched retrieval over multi-stage troubleshooting histories; its reported evaluation measures retrieval directly rather than full-agent outcomes. GitHub update (2026-09-20): caura-ai/caura revision 4673cab adds implementation-level evidence that shared-memory governance separates scope/trust admission, content-policy enforcement, and audit integrity, while exposing audit completeness as a separate availability property because non-critical events may be dropped under overload. arXiv update (2026-09-20): On-Demand Attention [2609.20734v1] adds abstract-level evidence that retained long-context state can be selectively activated from local decoding state rather than globally read at every token. HN/GitHub update (2026-09-20): HN 49774919 and anthropics/claude-code revision 2fc72b2 add implementation-level evidence that AGENTS.md portability is entering a first-party harness, while documenting lifecycle and attachment gaps that prevent filename support from implying full loader equivalence."
supersedes: ["agent-architecture-trends.md", "agent-patterns.md", "agent_patterns.md", "agent_architectures_01.md"]
</ai_context>

# Agent Architectures

Canonical reference for agent architecture patterns tracked by Scout.
See also: [enterprise-agent-architecture-2026.md](./enterprise-agent-architecture-2026.md),
[metagpt-architecture-pattern.md](./metagpt-architecture-pattern.md) for
system-specific deep dives.

## Core Architecture Taxonomy

- **Monolithic (Prompt-based)**: Single LLM call with instructions. Simple but brittle for complex tasks.
- **ReAct (Reason + Act)**: Interleaved reasoning and tool use. The baseline for most agent frameworks.
- **Multi-Agent Orchestration**: Routing, blackboard, or protocol-based coordination of specialized agents.

**Current direction**: Moving towards tightly-scoped, specialized agents that communicate via structured protocols and shared state.

## Proven Patterns

### 1. Monitor Agent (Watchdog)

- **Problem**: Autonomous agents get stuck in retry/failure loops or suffer context bloat leading to hallucinated tool calls.
- **Solution**: A distinct "Monitor" agent observes worker agents, detects stagnation, and enforces exit mechanisms.
- **Source**: Chinese AI community (XHS) discussions on autonomous agent reliability.

#### Repetition detection needs an effect-state and recovery boundary (HN, Sep 2026)

[SAVI Loop Guard](https://github.com/data-gras/savi-loop-guard), surfaced in
[HN item 49704711](https://news.ycombinator.com/item?id=49704711), is a small
implementation-level probe for the watchdog pattern. At pinned revision
`43c35c61abef731fb9042880a3fe76a24d7c60d5`, it groups events by `agent_id`
and detects either a burst of more than a configured number of calls in a time
window or a lifetime count of fuzzy-matched tool names above a threshold. The
checks are local and dependency-free, and repository tests cover threshold
boundaries, per-agent isolation, fuzzy variants, and both simultaneous verdicts.
The HN post had one point and no comments when checked, so this is code evidence,
not community validation or adoption evidence.

The preventive API exposes a more important architecture boundary.
`check_before_call()` first stores the candidate event, then recomputes all
historical issues, and raises if any issue belongs to that agent. The blocked
attempt therefore remains indistinguishable from a dispatched call. There is
also no reset or acknowledgement transition: once a structural issue exists,
a later call to a different tool still raises because the old issue remains in
the same agent's history. Scout reproduced this on the pinned source with a
limit of two: the third `search_web` attempt was blocked and retained, then a
`send_email` attempt was also blocked by the old `search_web` issue; all four
attempted spans were stored.

The underlying structural verdict is deliberately coarser than stagnation. It
compares tool-name tokens but not arguments, results, state change, errors, or
task phase, and counts repetitions over the guard's entire lifetime. Six
productive paginated reads can therefore look the same as six identical failed
reads. A production watchdog should keep four records distinct:

1. **attempt evidence** — what the agent proposed;
2. **effect evidence** — what was actually dispatched and what happened;
3. **progress evidence** — whether relevant state or output changed; and
4. **recovery policy** — whether the breaker is open, acknowledged, reset, or
   escalated.

This does not make cheap repetition heuristics useless; they are useful anomaly
signals and possible preconditions for intervention. It means a repetition
threshold alone is neither a progress detector nor a complete circuit breaker.
Scout could compile the pinned package and run the focused reproduction, but
could not execute the repository's pytest suite because pytest is absent from
the environment; the passing suite remains project-authored evidence.

### 2. Lightweight Loops over Heavy Frameworks

- **Problem**: Frameworks like LangChain add abstraction that makes debugging complex tool calls difficult.
- **Solution**: Write raw control loops with high-quality prompt engineering and precise tool signatures.
- **Source**: Community trends moving away from complex orchestration tools.

### 3. Critic / Reflection Pattern

- **Problem**: Single-pass generation fails on complex tasks with edge cases.
- **Solution**: Separate Actor → Critic → Refiner loop where a dedicated reviewer finds flaws before refinement.
- **Relevance to May**: Agents like `arc` could act as Critic for `dev`'s complex PRs before merging.
- **Source**: AI Agent Community Research (XHS Trends).

### 4. Tiered Memory

Long-running agents need memory beyond the context window:

1. **Working Memory**: Current context window (short-term, high fidelity).
2. **Semantic Memory**: Vector DBs for similarity-based retrieval (mid-term, associative).
3. **Episodic/Persistent Summary**: Key-value stores or durable markdown files containing hardened facts (long-term, explicit).

May currently uses `context_updates` for Tier 3 and standard context windows for Tier 1.
Tier 2 (vector DB) may become necessary as the project scales.

- **Source**: AI Agent Community Research (XHS Trends).

#### Epistemic fields survive compression better than incidental qualifiers (arXiv, Aug 2026)

A controlled memory-compression study sharpens what Tier 3 should store. Kwon
held claim and epistemic stance constant across matched notes, changing only
whether source/certainty appeared as labelled fields or as parenthetical prose.
At two tight budgets across 60 claims, stance retention rose from 52/360 to
109/360 on Claude Haiku 4.5 and from 147/360 to 202/360 on Claude Sonnet 4.5.
The per-claim direction favored fields 37–2 and 30–8 respectively; a
pre-registered Haiku replication reported a +15.6-point effect.

The useful architecture lesson is narrower than “use this exact schema”:

- **Compress claims and standing together.** A digest that preserves the claim
  but drops “rumor,” “inferred,” its speaker, or its as-of date has changed the
  claim's operational meaning.
- **Make standing explicit, not merely verbose.** Adding length did not help
  either model. Labels helped both, while full-sentence explicitness helped one
  model strongly and the other negligibly, so the best representation should be
  regression-tested per compressor.
- **Separate retention from validation.** Structured `SOURCE`, `CERTAINTY`, and
  `AS_OF` fields make omissions mechanically checkable, but do not prove that a
  filled value is correct. Multiple conflicting attributions also require a
  richer representation than one source slot.
- **Test under real pressure.** Loose budgets produced little effect; the
  failure surfaced when the compressor had to discard information. Memory evals
  therefore need pressure sweeps and should score “qualified,” “washed into bare
  fact,” and “evicted” separately.

Scope matters: the main experiment used 60 synthetic English claims and two
models from one provider; the end-to-end writer pilot was only n=10. Treat the
~15-point gain as evidence for explicit epistemic metadata under tight
compression, not as a universal schema benchmark.

- **Source**: Alex Kwon, “Explicit, Not Longer: What Makes Epistemic Stance
  Survive Memory Compression,” arXiv:2608.06953v1 (2026-08-07),
  https://arxiv.org/abs/2608.06953v1

## Emerging Trends

### Control Flow Replacing Prompt Engineering (May 2026)

Explicit control structures (state machines, behavior trees) are gaining traction
over purely LLM-driven loops for agent reliability. Instead of engineering the
prompt to handle control flow, the system imposes it externally.

- **Source**: Hacker News trends, May 2026.

### Context Engineering & Coding Flywheels

- **Context Engineering**: Emerging as a distinct multi-agent skill — crafting the right context for each agent call rather than relying on raw prompts.
- **Coding Flywheels**: Agentic coding environments where code generation, testing, and refinement form a tight autonomous loop are gaining popularity.

#### Portable instruction filenames still need explicit loader semantics (HN/GitHub, Sep 2026)

A new HN submission points to Anthropic's own Claude Code repository, where the
`mods/agents-md` directory contains a versioned `0.1.0` plugin authored by
Anthropic. At pinned revision `2fc72b2918b43710ff4c7c73be173100c2cbe379`, its
configuration exposes four instruction modes: keep only `CLAUDE.md`; use
`AGENTS.md` only when a project has no `CLAUDE.md` of its own (the default);
load both; or keep only organization-managed instructions. The implementation
hands discovered files back to the engine as ordinary project instructions, so
existing rendering, announcement, and subagent-omission behavior is reused
rather than reimplemented.

This is a stronger interoperability signal than another third-party adapter:
a first-party coding harness is treating `AGENTS.md` as an input format. But the
repository explicitly documents that support as a built-in plugin, not complete
native-loader equivalence. Among the remaining differences, nested
`AGENTS.md` files attach only after text `Read` calls rather than IDE selections,
prompt imports, notebooks, images, or PDFs; nested files are not restored from
the engine's read-file state after compaction; added directories do not
contribute `AGENTS.md`; `/memory` does not know them; and some fork/subagent
paths receive different attachment behavior.

The reusable architecture rule is: **portable instruction files need a loader
contract, not just a shared filename**. Compatibility tests should cover root
precedence, nested discovery, imports and symlinks, compaction/reload, added
worktrees, subagent inheritance, and managed-policy overrides. Otherwise two
harnesses may both advertise `AGENTS.md` support while supplying materially
different context to the model.

This is implementation-level evidence from a mutable upstream repository, not
release or adoption evidence. The HN item had no comments when checked, and the
plugin's own README lists the parity gaps; Scout did not run the repository's
`claude plugin test` suite.

*Sources: [HN item 49774919](https://news.ycombinator.com/item?id=49774919),
[anthropics/claude-code `agents-md` directory](https://github.com/anthropics/claude-code/tree/main/mods/agents-md),
[pinned README](https://github.com/anthropics/claude-code/blob/2fc72b2918b43710ff4c7c73be173100c2cbe379/mods/agents-md/README.md),
and [pinned plugin manifest](https://github.com/anthropics/claude-code/blob/2fc72b2918b43710ff4c7c73be173100c2cbe379/mods/agents-md/.claude-plugin/plugin.json)
(reviewed 2026-09-20).*

### Harness Engineering (June 2026 — Crystallizing Discipline)

The dominant new architectural pattern from GitHub trending repos. The "harness" is the meta-layer that wraps and enhances a base coding agent (Claude Code, Codex, Gemini CLI, etc.) with skills, memory, sandboxing, and scope control.

- **Key repos**: obra/superpowers (231k★), affaan-m/ECC (216k★), bytedance/deer-flow (71k★), humanlayer/12-factor-agents (23k★)
- **The 98% Problem**: The agent does 98% of the work; the harness (sandbox, rollback, budget caps) is the 2% that determines production safety.
- **Aligns with**: KE-1924 (Constraint Placement Theorem) — constraints belong in infrastructure, not instructions.
- **Sub-discipline emerging**: **Loop Engineering** — designing agent execution
  cycles with explicit cost accounting, retry budgets, and abort conditions.
  cobusgreyling/loop-engineering (353★) provides `loop-audit`, `loop-init`,
  `loop-cost` CLI tools. Where harness engineering wraps the agent, loop
  engineering structures its inner cycle. Validates the Compilation Threshold
  thesis: practitioners are building cost-awareness into execution loops.
- **Source**: GitHub trending repos June–July 2026, HN discourse June 2026.

**UPDATE (Aug 2026 — HN 49182946): Harnesses now have to justify their own complexity.**
A useful HN thread around Bruno Gonçalves's
["Building an Advanced Agentic Harness"](https://data4sci.com/blog/building-an-advanced-agentic-harness)
sharpens what practitioners now treat as a *serious* harness.

The linked post is explicit that the point is not a giant framework but a
**deliberately thin orchestrator** composed from small primitives:

- **Typed tools** with schema validation so bad actions fail before execution.
- **Up-front plan structure** (here a DAG) so independent work can run in
  parallel under bounded concurrency.
- **Tiered memory under a hard retrieval budget** instead of passively
  accumulating context.
- **Verification hierarchy**: deterministic checks first, LLM judge only for
  survivors.
- **Narrow Planner / Worker / Critic roles** with swappable providers.
- **Multi-dimensional budget pressure** (tokens, tool calls, wall time, cost)
  that triggers graceful degradation instead of binary success/failure.
- **Flat structured traces** so a run is replayable and auditable after the
  fact.

HN's reaction is as informative as the article itself:

- Several commenters argued the toy example risks **over-engineering** a task
  that a simpler loop could solve.
- `budududuroiu` explicitly preferred a **REPL / code-loop surface** over a DAG,
  because code can express loops and early exits without inventing a separate
  control language.
- `hanneshdc` asked the key governance question directly: **where are the
  benchmarks showing this structure improves error rates or problem-solving?**
- `alansaber` compressed the harness discourse into a blunt practitioner frame:
  much of it is really **context management plus guardrails**.

That combination matters. It suggests harness engineering is no longer judged by
how many moving parts it contains, but by whether each extra layer is
**measurable, swappable, and operationally justified**. The field is shifting
from "add scaffolding" to **"keep orchestration thin, externalize control, and
make every structural addition earn its keep via cost, verification, or
observability."**

*Sources: https://news.ycombinator.com/item?id=49182946 and
https://data4sci.com/blog/building-an-advanced-agentic-harness (article claims
and HN comments by dominotw, budududuroiu, hanneshdc, and alansaber checked
2026-08-05).*

**UPDATE (Aug 2026 — HN 49189075): Self-improving harnesses are now under a compression test.**
A useful HN thread around Prime Intellect's
["Prime Agent: A self-improving RLM agent"](https://www.primeintellect.ai/blog/prime-agent)
shows that practitioner interest in self-improvement is now paired with a much
sharper question: **is the harness still worth its own complexity once base
models improve?**

The thread's most informative comments focus on that tradeoff rather than the
headline benchmark claim:

- `riddlemethat` reports building a similar local MCP + memory + rules harness,
  but says newer foundational models have improved enough that simple repo-local
  Markdown context often replaces the heavier scaffold for the same use cases.
- `embedding-shape` argues the published repo exhibits the opposite failure
  mode: self-improvement via agent-written harness code can inflate into
  multi-10K-line files and enormous switch statements, creating a codebase that
  many models navigate worse rather than better.
- `supermdguy` pushes the next-step thesis: if harness engineering itself is
  the bottleneck, then the improvement loop may need explicit optimization
  methods (for example RL over harness changes), not just more auto-generated
  scaffolding.

That combination matters because it reframes self-improving harnesses from an
unqualified architectural advance into a **compression test**:

1. if stronger base models can absorb enough structure, bespoke harness layers
   start looking like temporary scaffolding,
2. if the harness persists, it must improve faster than its own code and rule
   complexity grows,
3. and the scarce engineering skill may shift from writing bigger harnesses to
   designing better **harness-evolution loops**.

This is a useful counterweight to the earlier "Harness Engineering" expansion:
practitioners are no longer only asking how to add scaffold layers; they are
starting to ask **which layers frontier models have already eaten, and whether
self-improvement creates more operational surface than it removes.**

*Sources: https://news.ycombinator.com/item?id=49189075 and
https://www.primeintellect.ai/blog/prime-agent (story title/url and HN comments
by riddlemethat, embedding-shape, and supermdguy checked 2026-08-05).*

**UPDATE (Aug 2026 — HN 49214109): Self-improvement is becoming a supplemental state plane.**
The newer HN submission points directly to Prime Agent's open repository, whose
current architecture makes the improvement boundary more concrete than the
original product argument. The base system prompt stays immutable; `/refine`
may instead make small changes to supplemental prompts, memories, skill
descriptions, and reusable subagent specifications. Refinements are recorded as
snapshots and can be rolled back, and they remain session-local by default.

That boundary is a useful response to the compression problem above. Treating
harness evolution as typed, reviewable state makes subtraction and rollback
possible without allowing a trajectory to rewrite its root authority. But the
repository also shows that three concerns often grouped as “persistent agents”
need separate controls:

1. **learning continuity** lives in versioned supplemental harness state;
2. **execution continuity** lives in daemon workers, JSONL transcripts,
   persistent IPython kernels, schedules, goals, and reattachable child agents;
3. **security containment** is explicitly *not* supplied by those process
   boundaries—the worker and kernel normally retain the user's OS permissions.

Prime Agent also distinguishes durable goals from continuation policy: a goal
stores the objective and progress, while autonomous mode decides whether to
continue under turn, token, time, and quality-gate limits. This separation keeps
a remembered objective from silently becoming unlimited execution authority.
Likewise, direct inter-agent messages carry runtime-derived sender identity and
queue/rate limits, but receipt means delivery or queuing—not that the requested
effect was authorized or completed.

The reusable design rule is: **make self-improvement a reversible data plane,
keep continuation budgeted, and do not mistake lifecycle isolation for a
sandbox.**

*Sources: https://news.ycombinator.com/item?id=49214109,
https://github.com/PrimeIntellect-ai/prime-agent,
https://github.com/PrimeIntellect-ai/prime-agent/blob/a18809e00ea30638584d87b3afea7285a9d7296c/README.md,
https://github.com/PrimeIntellect-ai/prime-agent/blob/a18809e00ea30638584d87b3afea7285a9d7296c/packages/coding-agent/docs/architecture.md,
and https://github.com/PrimeIntellect-ai/prime-agent/blob/a18809e00ea30638584d87b3afea7285a9d7296c/packages/coding-agent/docs/long-running-agents.md
(repository revision and linked HN item checked 2026-08-08; HN had 2 points and
no comments at retrieval).*

### Architectural Laziness (July 2026 — Explosive Growth)

DietrichGebert/ponytail (49,647★ as of Jun 23, from 4.5k→30k→50k in 11 days)
encodes a design principle: "Makes your AI agent think like the laziest senior
dev in the room." The optimal session is the one that doesn't run. Optimizing
for NOT doing work — the cheapest code is the code you don't write. Benchmark:
**54% less code, 20% cheaper, 27% faster** on real Claude Code sessions
(Haiku 4.5, n=4, 12 feature tasks).

- **Why it resonates**: ponytail is the fastest-growing philosophy repo in
  agent history. It's the Abstention Advantage crystallized as open-source:
  structural inaction is more valuable than marginal action.
- **Aligns with**: Abstention Advantage synthesis, Compilation Threshold
  ("38% of budget is LLM reasoning about deterministic answers").
- **Source**: GitHub trending repos Jun–Jul 2026 (star velocity tracked
  across seven scans; 50K confirmed via GitHub API 2026-06-23).

### The Skill Cambrian Explosion (June 2026 — Phase Transition)

Agent capabilities are propagating as installable Markdown files (SKILL.md),
not framework APIs. 40+ skill repos created in June 2026 alone. The format is
cross-vendor: works with Claude Code, Codex, Cursor, and others.

Key ecosystem layers:
- **Platform registry**: anthropics/skills (154K★, 18K forks) — the canonical skill repo
- **Skill collections**: BuilderIO/skills (2,450★), guard-skills (877★)
- **Domain skills**: baoyu-design (1,778★), effective-html (1,129★), security-audit-skill (358★)
- **Meta-skills**: luban-skill (464★, skill polishing), lazyskills (75★, first skill manager TUI)
- **Platform exports**: xcode27-skills (103★, Apple official), alpaca-skills (87★)

The installation model is radical: `cp SKILL.md .` — zero dependency management,
composition by concatenation. Git is the version control, GitHub is the registry.
Prediction: `skills.json` manifest or equivalent within 3 months; first skill-layer
supply-chain incident within 6 months.

- **Source**: GitHub API search Jun 23: 40+ repos matching "agent skill" created
  since 2026-06-01. See scan #107 for full table.

**UPDATE (Jul 2026 — Scan #318)**: "Skills Are Not Islands" (2607.01136) formalizes
part of this picture. It introduces Agent Skill Supply Chains (ASSCs) and
SkillDepAnalyzer over 1,434,046 GitHub-backed SkillsMP records. The generated
graphs span skill → package → service edges, expose hidden package inventory,
and form workflow clusters. Security rows show that root-only inspection can
miss transitive audit signals, including 26 of 194 roots reached by publicly
reported malicious-skill labels. They do not establish active execution,
incident prevalence, or the earlier six-month incident prediction. Use the
[primary qualification](./findings/2026-09-08-agent-skill-supply-chain-scope.md)
before transferring the result beyond that registry snapshot.
Source: https://arxiv.org/abs/2607.01136

**UPDATE (Jul 2026 — Scan #444)**: A three-layer Skill Governance Stack is crystallizing:
1. **Taxonomy** (eli-labz/Cognitive-Core-Skills, 273★): Universal, industry-neutral taxonomy of cognitive core skills — perception, memory, reasoning, planning, action, verification. JSON Schema format.
2. **Dependency** (Skills Are Not Islands, 2607.01136): Generated skill dependency graphs expose transitive inventory and audit signals; runtime risk remains unmeasured.
3. **Security** (NVIDIA/SkillSpector, 12,287★): Scanning skill dependency graphs for vulnerabilities and malicious patterns.
Each layer addresses a different concern; all three are needed for governed skill composition.

Additionally, **Omnigent** (omnigent-ai/omnigent, 6,617★) validates the Configuration Layer thesis (#425) at industrial scale: a meta-harness orchestrating Claude Code, Codex, Cursor, Pi, and custom agents through a unified governance layer, treating each model/framework as interchangeable configuration. 879 forks in 5 weeks. The model is not just configuration — it's *interchangeable configuration* across providers.
Source: findings/2026-07-18-hn-arxiv-github-scan-444.md

### The Selection Bottleneck (June 2026 — Cross-Layer Pattern)

Selection — not generation, memory, or reasoning — is the binding constraint
across agent system layers. **Skill Shadowing** (2605.24050v2) proves skill
library degradation (up to −21%) is entirely a selection failure, not context
overhead. **Tmax** (2606.23321) achieves 9B frontier via data selection recipes.
**OpenThoughts-Agent** (2606.24855, 172★) shows 100K curated > larger uncurated.
**RAD/MoE Routing** (2606.22798) reveals expert routing already encodes task
trajectory — routing IS latent selection. **Divergence-Point** (2606.23112)
gains +16.8% reward from preference-pair selection. **Plasticity Loss**
(2606.24752) shows scale delays but cannot prevent selection-capacity decay.
Implication: improving what gets chosen matters more than improving the pool.
Source: findings/2026-06-24-hn-scan-136.md

### The Apprenticeship Turn (July 2026 — Emerging)

The next phase after harness engineering: agents that learn from their own
execution and produce reusable artifacts for future agents. Three pillars:

1. **Self-learning agents**: Forsy-AI/agent-apprenticeship (1,135★) — automated
   workflow loops producing "work experience" + training data per run.
   Kulaxyz/self-learning-skills (722★) — golden path extraction from sessions.
   Ornith-1.0 (260pts HN) — self-scaffolding coding agents.

2. **Industrial skill supply chain**: BuilderIO/skills (3,015★), cloudflare/
   security-audit-skill (2,175★), Anthropic-Cybersecurity-Skills (23,747★ mapping
   817 skills to MITRE). LearnPrompt/luban-skill articulates the lifecycle:
   installable → propagatable → verifiable → evolvable.

3. **World-model training loop**: Qwen-AgentWorld (2606.24597, 199pts, 698★) —
   language world models simulating agentic environments where simulated training
   surpasses real-environment training. HN community immediately sees governance
   application: world models as apprenticeship auditors.
   Two impossibility results bound the approach: World Models in Pieces
   (2606.24842) proves structural certification must be transition-local (general
   worst-case analysis is uninformative), and Are We Ready (2606.24775) proves no
   single memory architecture dominates across workloads. Together: the world
   model must be as piecewise and workload-aligned as the agent it serves —
   universal agent simulation is doubly impossible. This is control theory's
   "plant model" arriving for agents as a patchwork, not a monolith.

- **Value chain inversion**: Old = Model→Harness→Skill→Output (human-driven).
  Emerging = Output→Skill→Harness→Model (agent-driven, with model routing).
- **Demand driver**: Tokenmaxxing declared dead (190pts/291c) — organizations
  shifting from token volume to execution quality.
- **Open-weight prerequisite**: Self-improving loops require model access that
  only open weights (GLM 5.2, Qwen-3.5) provide.
- **Governance gap**: How to audit a skill an agent taught itself remains
  structurally unanswered. World-model verification is the research proposal.
- **Source**: HN/GitHub/arXiv scan #311 (July 2026).

### Cross-Vendor Agent Orchestration (July 2026 — Emerging)

Deliberate model mixing: one model for planning, another for execution, with
the repo as shared memory. architect-loop (492★) uses Claude Fable 5 as
architect and GPT-5.5 Codex as builder. FableCodex (254★) and fable-mode
(450★) implement Fable-style multi-stage planning as portable skills.

- **Key insight**: "Repo as memory" sidesteps the entire memory infrastructure
  category — the codebase itself is the persistent state. Models are
  interchangeable components selected by strength.
- **Aligns with**: Substrate Inversion (intelligence in the loop architecture,
  not the model).
- **Source**: GitHub trending repos June–July 2026.

### Skills-as-Code Pattern (June 2026 — Dominant)

Agent capabilities defined as installable markdown/config packages, hot-swappable at runtime. The fastest-growing segment on GitHub.

- **Key repos**: anthropics/skills (150k★), addyosmani/agent-skills (58k★), antigravity-awesome-skills (41k★ — 1,500+ skills)
- **Mechanism**: Skills are total-function capabilities (bounded scope, no lifecycle overhead) invoked by a coordinator. Pipeline stages dissolve into skills.
- **Aligns with**: KE-1915 (Skills Absorption Thesis) — predicted "Skill Engineering" as next paradigm; GitHub data confirms.
- **Source**: GitHub trending repos June 2026.

### Agent Memory Infrastructure (June 2026 — Exploding Category)

Agent memory has become a standalone product category with 10+ competing repos above 5k stars.

- **Spectrum**: Centralized DB (OpenViking, 26k★) → Cloud (mem0, 58k★) → Stateful (letta, 23k★) → Local agent (beads, 25k★) → SQLite (engram, 4k★) → Single-file (memvid, 16k★)
- **Critical gap (narrowing)**: Mainstream repos remain append-only, but memory
  lifecycle tooling is now an emerging sub-category. YourMemory (245★,
  Ebbinghaus-curve decay, claims +16pp over Mem0 on LoCoMo). icarus-memory-infra
  (289★, provenance + supersession + rollback). memwatch (28★, staleness
  detection + auto-expiry). Memory-Like-A-Tree (124★, confidence-based decay).
  The forgetting gap is shifting from "zero implementations" to "lifecycle
  wrappers emerging around append-only stores."
- **Aligns with**: KE-1920 (Forgetting Deficit) — gap persists in mainstream
  (mem0, cognee, letta) but lifecycle tooling is the emerging bridge.
  The Eternal Present synthesis predicted provenance and expiry as the
  first temporal primitives to appear; confirmed by icarus and memwatch.
- **Source**: GitHub trending repos June–July 2026 (six consecutive scans).
- **Product category crystallization (Jun 2026)**: Seven cross-agent memory
  products launched on HN Jun 3–20, splitting into three architectural
  philosophies: (1) Cloud Brain — centralized memory service (Hyper/YC:
  knowledge-graph with typed edges + temporal invalidation, 79pts; Parcle:
  shared retrieval, claims 30–70% token reduction; Lore: LLM-proxy intercept);
  (2) Git-Native — memory versioned alongside code (Agents Remember:
  commit-ledger dual-worktree isolation; Maccha: 7-tier hierarchy + confidence
  decay); (3) Local Database — per-developer SQLite/vector (PMB: explicit vs
  implicit memory UX question; YourMemory: Ebbinghaus decay +16pp). **Consensus
  unsolved problem** across all approaches: conflict resolution when sources
  contradict (maps to Memory Hardening Stack L4 Origin Binding gap). **Token
  Tax thesis** (Parcle): >50% of agentic token spend is re-exploration tax —
  agents repeatedly paying to re-derive context from prior sessions. Aligns
  with Cold Start Tax synthesis (46% reconstruction) and the-token-economics-trap.md.
  Source: HN Scan #152b (findings/2026-06-22-hn-scan-152.md).

#### Retrieve the matching process state, not only a similar case (arXiv, Sep 2026)

[RAFT](https://arxiv.org/abs/2609.20754v1) models each closed support case as a
directed chain of timeline entries. Retrieval happens at the entry level: an
intermediate state in the active case can match an intermediate state in a
historical case, after which the system returns the parent case trajectory
anchored at that point. This differs from treating each case as one static
retrieval document; the useful unit is **state within a process**, while the
returned context is the larger trajectory around that state. An optional graph
can additionally connect cases through a configurable similarity
representation.

The authors report higher Case Hit than vanilla RAG and GraphRAG at every case
stage, with statistically significant gains over the strongest baseline. The
benchmark evidence has important scope limits: the public multi-stage support
set is synthetic from Microsoft Learn Windows Server documentation, while the
real Apache Jira set uses human-created duplicate labels and supplies only
directional transfer evidence. The study evaluates the retrieval layer
directly, not whether a deployed troubleshooting agent resolves cases more
accurately or safely.

**Architecture rule:** preserve process position when converting histories into
memory. Evaluate state matching, parent-trajectory retrieval, and downstream
agent outcomes as separate stages; a higher retrieval hit rate is not yet a
full-agent success claim.

- **Source:** https://arxiv.org/abs/2609.20754v1
- **Coverage:** live arXiv Atom abstract and metadata only; the full paper,
  benchmark, implementation, significance analysis, and Jira labels were not
  inspected or independently reproduced.

#### Memory benchmarks need a stage boundary and a scale boundary (GitHub, Aug 2026)

[`lesliechowsh/dsh-memo`](https://github.com/lesliechowsh/dsh-memo) is a
small lexical-retrieval plugin over DeepSeek Harness's existing session index,
but its reusable contribution is measurement discipline. The published harness
scores **session localization**—whether a gold session appears at rank *k*—not
whether a model reads the evidence correctly or produces a correct answer.
That separates four stages which “memory accuracy” often collapses:

1. candidate discovery;
2. session ranking;
3. passage/evidence retrieval inside the selected session; and
4. answer generation and judging.

At inspected revision
[`86a94dd`](https://github.com/lesliechowsh/dsh-memo/commit/86a94dd8d188669e031ad6615a65b7a764b47cd4),
the product enriches only the top three ranked sessions with up to three event
snippets *after* ranking. The benchmark therefore supports claims about stages
1–2, while the shipped evidence-enrichment path and end-to-end QA remain
separate unmeasured stages. This is a useful architecture rule: instrument each
boundary before using one downstream score to describe the whole memory stack.

Scale is a second boundary. The maintainer reports hit@1 of 78.2% on
LongMemEval-S's roughly 54-session pools, 54.6% on LongMemEval-M's roughly
500-session pools, and 60.2% on LoCoMo10. These are author-reported numbers,
not reproduced here; the repository publishes deterministic harnesses and
explicitly rejects comparison with reader+judge systems or different Recall@k
protocols. More importantly, candidate variants that improved the smaller S
set were not shipped when segmented M runs were neutral or negative. A
benchmark should act as a **falsifier**, not merely a leaderboard: require the
same directional gain on a larger or held-out pool, disclose the random
baseline at that pool size, and preserve rejected experiments.

One local check did reproduce the repository's narrower functional claim:
`node bench/zh.cjs` produced 0/11 hit@1 for ASCII-only tokenization and 10/11
for contiguous-Han-run tokenization, including the declared no-verbatim-run
ceiling miss. This is correctly labeled a self-built regression, not a public
Chinese benchmark. The boundary matters as much as the result.

- **Repo:** https://github.com/lesliechowsh/dsh-memo
- **Inspected revision:** https://github.com/lesliechowsh/dsh-memo/commit/86a94dd8d188669e031ad6615a65b7a764b47cd4
- **Primary sources:** [benchmark protocol and experiment log](https://github.com/lesliechowsh/dsh-memo/blob/86a94dd8d188669e031ad6615a65b7a764b47cd4/bench/README.md), [shipped retrieval and evidence-enrichment path](https://github.com/lesliechowsh/dsh-memo/blob/86a94dd8d188669e031ad6615a65b7a764b47cd4/index.js), [release/error history](https://github.com/lesliechowsh/dsh-memo/blob/86a94dd8d188669e031ad6615a65b7a764b47cd4/CHANGELOG.md)

#### Plain-file memory still needs a governed derivation layer (GitHub, Sep 2026)

[`tigerless-labs/agent-memory`](https://github.com/tigerless-labs/agent-memory)
combines two patterns that are usually presented as alternatives: Markdown is
the authoritative store, while SQLite FTS and optional vectors are rebuildable
retrieval caches. Recall returns paths, abstracts, anchors, and scores rather
than automatically pasting opaque chunks into context. This turns progressive
disclosure into a storage invariant: the agent can stop at an index line,
outline, full memory, or archived source trace.

The more reusable signal is its separation of **deterministic maintenance** from
**judgment that can erase distinctions**. At inspected revision
[`34d12a2`](https://github.com/tigerless-labs/agent-memory/commit/34d12a2f8678d5561aba27bd8ff73c5ae4b6a258),
the sleep-time Manage pass may normalize dates, settle weights, add links,
merge exact duplicates by supersession, cluster directories, and request
redistillation. Similar-entry merges, splits, supersession, and deletion are
represented as stable proposals; per-kind caps limit accepted decisions, and a
"delete" invalidates a file rather than physically removing it. Physical
removal is a separate garbage-collection action. The included unit tests encode
these boundaries, including that unattended sleep never shrinks the store,
repeat sleep is idempotent, proposal identity is stable, and every pass emits
an audit report.

This suggests a three-plane architecture for portable agent memory:

1. **source plane:** human-readable records plus archived provenance;
2. **derived plane:** disposable indexes, weights, links, and placement; and
3. **authority plane:** explicit proposals and decisions for lossy changes.

“Files are the source of truth” alone does not solve memory governance; the
important property is that every derived structure can be rebuilt and every
lossy transition crosses a separately inspectable authority boundary.

The repository also illustrates why implementation evidence and benchmark
evidence must remain separate. Its README reports LongMemEval-S and cross-host
results and says the protocol, ledger, and raw runs ship in `docs/experiments.md`
and `experiments/`. Those paths were absent from the complete, non-truncated Git
tree at the inspected revision, and the pinned raw `docs/experiments.md` URL
returned HTTP 404. The architecture and tests are inspectable; the reported
benchmark was not reproducible from that revision and should remain
**author-reported**, not treated as verified performance.

- **Repo:** https://github.com/tigerless-labs/agent-memory
- **Inspected revision:** https://github.com/tigerless-labs/agent-memory/commit/34d12a2f8678d5561aba27bd8ff73c5ae4b6a258
- **Primary sources:** [README](https://github.com/tigerless-labs/agent-memory/blob/34d12a2f8678d5561aba27bd8ff73c5ae4b6a258/README.md), [Manage implementation](https://github.com/tigerless-labs/agent-memory/blob/34d12a2f8678d5561aba27bd8ff73c5ae4b6a258/packages/core/src/agent_memory/core/manage.py), [Manage tests](https://github.com/tigerless-labs/agent-memory/blob/34d12a2f8678d5561aba27bd8ff73c5ae4b6a258/tests/unit/test_manage.py), [complete tree](https://api.github.com/repos/tigerless-labs/agent-memory/git/trees/0a7f8b7e5ecb5692517450232a49e2acf813c439?recursive=1)

#### A publishable memory needs a governed egress ledger (GitHub, Sep 2026)

[`huggingface/funes`](https://github.com/huggingface/funes) packages Claude
Code, Codex, pi, and Hermes session traces into one local Lance dataset and can
publish that derived memory to a Hugging Face dataset repository. At inspected
revision [`0612fce`](https://github.com/huggingface/funes/commit/0612fce1a05450366bf2160f3dae5dcfcd3d48ce),
chunk identity is deterministic over session, turn, block, and split; the
embedding model is stamped into the dataset; and incompatible query embeddings
are refused. This is useful portability machinery: raw transcripts remain the
rebuild source, while a source-agnostic derived index can move between machines
and agent harnesses.

The repository's publication path exposes a more important governance boundary.
Index-time credential redaction is best-effort and may be skipped when
TruffleHog is unavailable, while `push` independently requires the scanner and
fails closed. Before scanning, the implementation reconstructs whole blocks so
a secret split across chunks cannot evade detection; when a block is dirty, all
of its chunks are held back while unrelated rows may still publish with a
warning. The gated end-to-end test checks one narrower case—a generated SSH
private key is replaced by a marker and cannot be read back—but skips when
TruffleHog or `ssh-keygen` is absent. Scout inspected these tests and code but
did not execute the Rust suite or a live Hub push.

Credential safety is not publication governance. A user can select whole
sessions for a push, but the tool records no durable publication intent; the
remote is append-only and offers no session retraction. The docs also state that
local scrub does not repair an already-published remote. Consequently:

1. **Secret gate:** machine detection can stop recognizable credentials.
2. **Release gate:** a human or curator must decide whether an entire session's
   non-secret content is appropriate to disclose.
3. **Egress ledger:** publication should record selected session identities,
   source revision, destination, resulting remote commit, and policy decision.
4. **Retraction path:** rotation and remote dataset repair need an explicit
   workflow; local deletion or scrub is not evidence of downstream removal.

This extends the three-plane memory model above: once memory becomes portable,
the authority plane must cover not only lossy local changes but also irreversible
or externally durable release. A scanner, a selection flag, and an append receipt
solve different problems and should not be collapsed into a generic “safe to
share” status.

- **Repo:** https://github.com/huggingface/funes
- **Inspected revision:** https://github.com/huggingface/funes/commit/0612fce1a05450366bf2160f3dae5dcfcd3d48ce
- **Primary sources:** [indexing contract](https://github.com/huggingface/funes/blob/0612fce1a05450366bf2160f3dae5dcfcd3d48ce/docs/index.md), [publication and redaction contract](https://github.com/huggingface/funes/blob/0612fce1a05450366bf2160f3dae5dcfcd3d48ce/docs/push.md), [push gate implementation](https://github.com/huggingface/funes/blob/0612fce1a05450366bf2160f3dae5dcfcd3d48ce/src/commands/push.rs), [gated redaction test](https://github.com/huggingface/funes/blob/0612fce1a05450366bf2160f3dae5dcfcd3d48ce/tests/redact_on_index.rs), [complete tree](https://api.github.com/repos/huggingface/funes/git/trees/0612fce1a05450366bf2160f3dae5dcfcd3d48ce?recursive=1)

#### Event-sourced memory is an observation ledger, not a second source of truth (HN, Aug 2026)

An HN-submitted Lobu architecture note supplies a concrete practitioner design
for the lifecycle layer above. External systems remain authoritative for their
facts; Lobu's append-only log is authoritative only for what was observed and
what agents did about it. A correction appends a new event pointing to the one
it supersedes, “current” means no later event supersedes it, and the database
allows only one replacement of a given fact. This preserves the question most
in-place memory stores cannot answer: **what did this agent believe when it
acted?**

The more important improvement primitive is lineage, not retention alone. Each
behavior run records the exact events it consumed; outputs and human
corrections return to the same graph; the latest correction per field is folded
into the next prompt. That makes feedback portable across model replacement and
supports replay or evaluation against the state actually visible to a past
run. It also exposes three boundaries that an “event-sourced agent” must not
blur:

1. **Observation is not truth.** Preserve source-system identity and reconcile
   new observations instead of promoting the memory proxy into a competing
   system of record.
2. **Audit is not reversibility.** The log can correct a belief but cannot
   unsend an email, so consequential effects need approval before the external
   write.
3. **Self-generated events need exclusion rules.** Lobu reports that behaviors
   once reacted to their own bookkeeping rows after a timestamp migration;
   provenance must therefore participate in trigger admission, not merely in
   later inspection.

This is vendor-authored architecture evidence, not an independent reliability
study. Its reported scale—roughly 230,000 events, 27,000 supersessions, and
90,000 events naming their run—is self-reported; the HN item had one point and
one author comment when inspected. The reusable signal is the explicit split
between source truth, observation history, run lineage, and irreversible
external effects—not the product's scale claim.

- **HN:** https://news.ycombinator.com/item?id=49259702
- **Source:** https://lobu.ai/blog/self-improving-agents-are-event-sourced/

#### Governed shared memory needs separate admission, enforcement, and evidence guarantees (GitHub, Sep 2026)

[`caura-ai/caura`](https://github.com/caura-ai/caura) is implementation-level
evidence that a fleet memory is becoming a control plane rather than a vector
store. At inspected revision
[`4673cab`](https://github.com/caura-ai/caura/commit/4673cab2a881e890d0dd887f745aed77ff0c0938),
three mechanisms are visibly separate:

1. **Admission:** memories carry agent, team/fleet, or organization visibility;
   trust-level checks gate operations. A missing agent row can inherit the
   default trust level on read-only paths, while persistent write paths are
   explicitly required to reject that soft pass so a fabricated identity does
   not enter the audit trail.
2. **Policy:** deterministic content gates can flag, mask, privatize, or reject
   writes. Separately, tenant/fleet/agent “keystones” are ranked mandatory rules
   retrieved for the agent to obey. These are not the same guarantee: the
   former owns the write effect, while the latter is delivered instruction and
   still depends on agent compliance.
3. **Evidence:** stored audit rows form a per-tenant SHA-256 chain over canonical
   event fields and the previous hash. Repository tests cover mutation, sequence
   gaps, tail truncation against the retained chain head, concurrent same-tenant
   inserts, and retry deduplication.

The audit implementation exposes an important limit to the phrase
“tamper-evident.” Non-critical audit events use a bounded in-process queue and
may be dropped—with counters—when the queue is full; failed flush chunks are not
requeued. Reject decisions are marked critical and fall back to a synchronous
write on queue overflow, but if that fallback also fails the loss is logged and
the rejected operation still proceeds. The chain can therefore prove the
ordering and integrity of events that reached storage, while **capture
completeness remains a separate availability property**. It also has no
repository-visible external checkpoint in the inspected paths, so this review
does not claim resistance to an administrator who can rewrite both rows and the
in-database chain head.

**Architecture rule:** describe governed memory with a guarantee matrix, not one
“auditable” label: principal admission, visibility scope, effect-owning policy,
instruction-only policy, event capture durability, stored-event integrity, and
external anchoring. A valid hash-chain result does not prove every attempted or
executed action was captured.

This was a source inspection, not a deployment test. Scout did not execute the
PostgreSQL integration suite, induce queue overload, or independently verify the
README's production and benchmark claims.

- **Repo:** https://github.com/caura-ai/caura
- **Inspected revision:** https://github.com/caura-ai/caura/commit/4673cab2a881e890d0dd887f745aed77ff0c0938
- **Primary sources:** [README](https://github.com/caura-ai/caura/blob/4673cab2a881e890d0dd887f745aed77ff0c0938/README.md), [trust gate](https://github.com/caura-ai/caura/blob/4673cab2a881e890d0dd887f745aed77ff0c0938/core-api/src/core_api/services/trust_service.py), [governance audit emitter](https://github.com/caura-ai/caura/blob/4673cab2a881e890d0dd887f745aed77ff0c0938/core-api/src/core_api/services/governance_gate.py), [audit queue](https://github.com/caura-ai/caura/blob/4673cab2a881e890d0dd887f745aed77ff0c0938/core-api/src/core_api/services/audit_queue.py), [hash-chain primitives](https://github.com/caura-ai/caura/blob/4673cab2a881e890d0dd887f745aed77ff0c0938/core-storage-api/src/core_storage_api/services/audit_chain.py), and [chain tests](https://github.com/caura-ai/caura/blob/4673cab2a881e890d0dd887f745aed77ff0c0938/tests/test_audit_chain.py)

### Memory Control Plane (July 2026 — Emerging Thesis)

Three arXiv papers argue that append-only storage is the wrong abstraction — memory must version, invalidate, self-optimize, and compose with formal guarantees.

- **PLACEMEM** (2607.04089): Versioned memory capsules with provenance, validity windows, cascading invalidation, and KV-cache-aware routing. Memory as a compute-aware control plane, not a retrieval store. vLLM-first prototype with concurrency-safe invalidation.
- **SelfMem** (2607.03726): Self-optimizing memory that learns its own strategy. +48.7% over strongest baseline at 100K tokens, sustained at 1M (BEAM benchmark). No fixed strategy dominates — optimal memory behavior is task-dependent and learnable.
- **Biological Motifs / Agentic Operad** (2607.04240): Five systems-biology control motifs mapped to composable software patterns via polynomial functors and wiring diagrams. Provable error suppression bounds for feed-forward topologies. Four epistemic topology theorems (error amplification, sequential penalty, parallel acceleration, tool density scaling) consistent with published multi-agent benchmarks. 1,813 tests, 116 examples.
- **Structural claim**: The 10+ memory repos above are the *storage layer*. These papers describe the *governance layer* that sits above storage — the missing layer between the Oversight Inversion's production-verification gap and the Eternal Present's temporal blindness.
- **Aligns with**: Eternal Present (predicted provenance/expiry as first temporal primitives — PLACEMEM instantiates them), Subtraction Deficit (cascading invalidation = memory-level subtraction), Recursion Barrier #430 (SelfMem shows self-improvement productive when domain-scoped to memory strategy).
- **Source**: arXiv July 2026 (Scan #441). Finding: `knowledge/findings/2026-07-16-arxiv-scan-441.md`.

**UPDATE (Jul 2026 — Scan #444)**: Three memory governance benchmarks now form a complementary evaluation ecosystem: (1) **GateMem** (rzhub/GateMem, 154★) — multi-principal access control and governance for shared-memory agents. (2) **MemSyco-Bench** (2607.01071) — benchmarks memory-induced sycophancy, proving retrieved memories bias agents toward agreement over accuracy. (3) **MemoryData** (OpenDataBox/MemoryData, 98★) — unified evaluation suite across memory architectures. The memory layer is now measurable at three orthogonal dimensions: access governance, integrity (sycophancy detection), and cross-architecture comparison. Additionally, **brain.md** (mindmuxai/brain.md, 205★) and **mex** (1,151★, stable) represent competing memory format conventions (single-file markdown vs. structured scaffold with drift detection) — no convention has won.
Source: findings/2026-07-18-hn-arxiv-github-scan-444.md

### Context Compression (June 2026 — Emerging)

Tool outputs are too large for context windows. Infrastructure-layer compression reduces tokens 60-95% with same answer quality.

- **Key repo**: chopratejas/headroom (26k★, created Jan 2026)
- **Mechanism**: Compress tool outputs, logs, files, and RAG chunks before they reach the LLM.
- **Aligns with**: Infrastructure-layer constraint (KE-1924) applied to token budget rather than behavior.
- **Source**: GitHub trending repos June 2026.

#### Retaining history and reading history can be separate decisions (arXiv, Sep 2026)

**On-Demand Attention** ([2609.20734v1](https://arxiv.org/abs/2609.20734v1))
reports that a pretrained model's local decoding state predicts whether globally
reading its longer history will benefit the next prediction. The proposed ODA
method trains a lightweight recall head, leaves the base model unchanged, and
keeps the complete historical KV cache available, but invokes global attention
only when the head predicts it is useful. The authors also report a GPU-side
conditional implementation in vLLM and experiments across Qwen and Gemma models
in which selective recall recovers most of the performance lost under local
attention while reducing global reads.

The architectural signal is a third option between always carrying full-history
attention and irreversibly compressing or deleting old context: **retain the
history, but gate expensive access at inference time**. That makes memory
availability and memory activation different control surfaces. For agent
systems, the same distinction suggests measuring storage coverage, retrieval
or recall decisions, and downstream task quality separately rather than
assuming that retained context was consulted.

The limitation is equally important. A learned recall gate can create silent
false negatives: relevant history may exist but never be read. Production use
therefore needs recall-miss evaluation, task- and model-specific calibration,
and a fallback for high-stakes or low-confidence steps. This is abstract-level
author evidence from the live arXiv feed; Scout did not inspect the full paper,
run the vLLM implementation, or independently verify the speed and quality
claims, and the abstract provides no exact effect sizes.

#### Release source turns only after derived memory is admissible (GitHub, Sep 2026)

[`PebbleLog/SimonAgent`](https://github.com/PebbleLog/SimonAgent) makes a
useful distinction between **semantic compaction** and **emergency context
trimming**. At inspected revision
[`28f6b0a`](https://github.com/PebbleLog/SimonAgent/commit/28f6b0a90d173e2c95fd7d6390041ea5b02a12ed),
its semantic path asks a model to derive an episode, long-term memory, and user
profile from older turns. It keeps the full source history unless all three
artifacts parse and their grouped commit reports success; only then does it
return the recent suffix. Repository-authored tests cover the key admission
rule: incomplete model output causes no memory writes and leaves history
unchanged.

The separate context-window path is deliberately less ambitious: it truncates
large tool results and drops whole old turns until count and estimated-token
limits fit. Both paths split only at a user-text turn boundary, avoiding an
orphaned `tool_use`/`tool_result` sequence. This yields a reusable ordering for
lossy context transitions:

1. preserve protocol boundaries;
2. derive every required replacement artifact;
3. validate the complete set;
4. persist it; and
5. release the source turns only after persistence succeeds.

The implementation also shows what this ordering does **not** prove. Its three
memory files are individually replaced atomically, but the grouped operation is
a sequence with best-effort rollback, not a crash-atomic multi-file
transaction. The model-stream path calls basic window trimming before semantic
compaction, so an unusually large in-flight turn can still force source loss
through the emergency path. Finally, the repository provides unit-level
contract evidence, not a fidelity or task-quality benchmark. Guarded admission,
crash durability, emergency degradation, and semantic quality therefore remain
four separate claims.

- **Repo:** https://github.com/PebbleLog/SimonAgent
- **Inspected revision:** https://github.com/PebbleLog/SimonAgent/commit/28f6b0a90d173e2c95fd7d6390041ea5b02a12ed
- **Primary sources:** [semantic compactor](https://github.com/PebbleLog/SimonAgent/blob/28f6b0a90d173e2c95fd7d6390041ea5b02a12ed/core/compactor.py), [memory commit](https://github.com/PebbleLog/SimonAgent/blob/28f6b0a90d173e2c95fd7d6390041ea5b02a12ed/core/memory.py), [context trimming](https://github.com/PebbleLog/SimonAgent/blob/28f6b0a90d173e2c95fd7d6390041ea5b02a12ed/core/context.py), [call order](https://github.com/PebbleLog/SimonAgent/blob/28f6b0a90d173e2c95fd7d6390041ea5b02a12ed/core/loop.py), and [compaction tests](https://github.com/PebbleLog/SimonAgent/blob/28f6b0a90d173e2c95fd7d6390041ea5b02a12ed/tests/test_compactor.py)

### The Illusion of Multi-Agent Advantage (arXiv, June 2026)

Auto-generated multi-agent systems consistently underperform Chain-of-Thought with Self-Consistency (CoT-SC) while costing up to 10× more. Expert-designed MAS still outperform on tasks with genuine decomposition/parallelization needs, but automated architecture design produces "architectural bloat" — superficial complexity without functional utility.

- **Key implication**: Multi-agent decomposition should only be applied when task structure genuinely requires it (explicit context separation, parallelizable subtasks). Default should be single-agent with CoT-SC.
- **Aligns with**: KE-1945 (Repair Metabolism) — multi-agent overhead may be a major contributor to the 73% rework ratio.
- **Source**: [2606.13003] Jwalapuram et al., arXiv June 2026.

### Instructions-as-Code (arXiv, June 2026)

Analysis of 15,549 agentic PRs finds that instruction files for AI agents don't automatically improve results. Projects that increased merge rate by ≥20% had substantially longer, well-structured instruction files with more sections/subsections. Short/vague instructions can actually hurt.

- **Key implication**: Instruction authoring should be treated as a software engineering activity. Structure and comprehensiveness matter more than existence.
- **Aligns with**: Our `context.md` files and Skills-as-Code pattern.
- **Source**: [2606.13449] Arabat & Sayagh, MSR '26.

### Orchestration-Level Reward Modeling (arXiv, June 2026)

OrchRM: self-supervised framework scoring orchestration quality using intermediate artifacts, not per-sub-agent rollouts. Achieves 10× token efficiency and +8% accuracy for multi-agent test-time scaling.

- **Key implication**: Evaluation should score at the orchestration level — evaluating every sub-agent independently is wasteful.
- **Source**: [2606.13598] Tsang et al., arXiv June 2026.

### Memory Compliance Gap (arXiv, June 2026)

TRACE finds that Mem0 memory alone leaves 57.5% of user preferences violated. Compiling corrections into runtime enforcement checks reduces violation from 100% → 2.0% out-of-distribution, far outperforming memory-only approaches.

- **Key implication**: Remembering preferences ≠ enforcing preferences. Frequently violated rules should be compiled into pre-commit checks, not just stored as context.
- **Source**: [2606.13174] Zhou et al., arXiv June 2026.

### Patch-Based Memory Evolution (arXiv, June 2026)

EvoMem proposes recording memory as structured update histories (patches/diffs) rather than snapshots. Improves reasoning about environmental change by 6.1% on GAIA, 4.8% on LoCoMo.

- **Key implication**: Diff-tracking for context evolution outperforms snapshot replacement. Recording what changed and why preserves richer reasoning context.
- **Source**: [2606.13681] Xu et al., arXiv June 2026.

### LLM-Guided Memory Consolidation (arXiv, June 2026)

MemRefine uses LLM as judge for memory delete/merge/preserve decisions. Surface similarity is a poor proxy for factual value when deciding what to forget; LLM-guided triage outperforms rule-based baselines.

- **Key implication**: As knowledge bases grow, LLM-judged consolidation beats similarity-based dedup.
- **Source**: [2606.13177] Kim et al., arXiv June 2026.

### Compound Tool Execution / HyperTool Pattern (arXiv, June 2026)

Step-wise atomic tool calls create an "execution-granularity mismatch" — deterministic subroutines consume context and force the model to manage low-level dataflow. HyperTool wraps multi-step tool workflows into a single MCP-style code block, raising accuracy from 15.69% → 35.29% on MCP-Universe (Qwen3-32B).

- **Key implication**: Deterministic tool subroutines should be folded into compound calls, removing mechanical steps from the reasoning trace. The tool-use equivalent of "information folding."
- **Source**: [2606.13663] Du et al., arXiv June 2026.

### Information Folding as Meta-Pattern (arXiv, June 2026)

Three independent papers converge: HyperTool folds deterministic tool workflows, HIPIF folds completed subgoal histories, HORMA distinguishes missing-info from context-overload failures. The shared insight: carrying everything is worse than carrying the right thing.

- **Key implication**: Context folding at the application level (compressing completed subtasks) can yield larger improvements than attention-level optimizations, because it removes semantically irrelevant context rather than computing attention more efficiently.
- **Sources**: [2606.13663] HyperTool, [2606.10507] HIPIF, [2606.11680] HORMA.

### Layer-Isolated Evaluation (arXiv, June 2026)

End-to-end task success masks regressions by 5–20×. Per-layer deterministic testing (no-LLM, sub-second, CI-gated) decomposes agents into testable layers (ontology, intent, routing, decomposition, escalation, safety, memory, defense). A degraded layer's slice craters while aggregate barely moves.

- **Key implication**: Agents need per-layer assertion slices, not just end-to-end success metrics. Coverage-honesty criterion: refuse to score unexercised layers.
- **Source**: [2606.11686] Zhang, Wang, Lei, arXiv June 2026.

### Oversight Capacity / Inverted-U Safety (arXiv, June 2026)

Human reviewers only moderately agree on risk (κ = 0.52). Realized safety follows an inverted-U in escalation rate — more oversight can make systems *less* safe due to reviewer fatigue. Load-aware escalation naturally resists flooding attacks.

- **Key implication**: Oversight is a finite resource. Optimal guards escalate below full escalation. Selective, high-value escalation beats exhaustive review.
- **Source**: [2606.08919] Turan, arXiv June 2026.

### Failure-Driven Training Curriculum (arXiv, June 2026)

SENTINEL uses a Controller–Proposer–Solver loop: analyze failed trajectories → generate targeted tasks → train on weaknesses. Outperforms uniform RL on tool-use benchmarks. Evoflux confirms: execution-grounded evolutionary search from failures beats distillation from teacher traces.

- **Key implication**: Failures are the most informative training signal. Systems that structurally convert failures into targeted improvement outperform those that retry or accumulate generic lessons.
- **Sources**: [2606.12908] SENTINEL, [2606.12674] Evoflux.

### Persistent State as Primary Attack Surface (arXiv, June 2026)

SMSR shows multi-session memory poisoning reduces to 5.3% with signed provenance + verdict-based voting. Survey of 247 papers confirms persistent state corruption is superseding prompt injection as central security concern for deployed agents.

- **Key implication**: Persistent state (lessons, context_updates, memories) needs provenance-signing, periodic revalidation, and voting-based retrieval. Unvalidated persistent state compounds reliability degradation over time.
- **Sources**: [2606.12703] SMSR, [2606.10749] Ling et al. survey.

### Code Knowledge Graphs (GitHub, June 2026)

Pre-indexed code knowledge graphs that auto-sync on code changes, giving agents a semantic map of the codebase instead of raw file search. codegraph (49k★) and semble (5k★) are the leading repos.

- **Mechanism**: The agent queries a pre-indexed graph or embedding search instead of calling grep+read repeatedly. Semble claims 98% fewer tokens than grep+read.
- **Key implication**: Context engineering splits into input-side (knowledge graphs reduce what goes IN) and output-side (headroom compresses what comes OUT). Both are infrastructure-level token budget constraints (KE-1924).
- **Source**: GitHub trending repos June 2026.

### Agent-Trainable Skills / SkillOpt (Microsoft Research, June 2026)

SkillOpt (6.4k★) is a text-space optimizer that trains reusable natural-language skills from agent trajectories. Observes agent execution, identifies patterns, produces `best_skill.md` artifacts. ART (10k★, OpenPipe) complements with GRPO for multi-step agent training.

- **Key implication**: The skills economy loop closes — skills are no longer only hand-authored, they can be *trained from execution traces*. This is the "promotion mechanism" missing from KE-1966 (Governance Gresham's Law): validated soft patterns get promoted into hard, deployable skills.
- **Source**: GitHub trending repos June 2026, Microsoft Research.

### Sandboxed Agent Orchestration (GitHub, June 2026)

Sandbox-first orchestration tools — sandcastle (6k★, Matt Pocock), CubeSandbox (6k★, Tencent), agent-infra/sandbox (5k★) — treat sandboxing as a first-class composable primitive rather than a deployment afterthought.

- **Key implication**: The sandbox IS the constraint. Making sandboxed execution a one-liner (`sandcastle.run()`) removes the adoption barrier that kept teams using advisory warnings instead of structural isolation.
- **Aligns with**: KE-1924 (Constraint Placement), KE-1965 (Guard Paradox — structural blocks have 100% enforcement).
- **Source**: GitHub trending repos June 2026.

### Agent-Native Programming Languages (Vercel Labs, June 2026)

zerolang (5k★, 1 month old) is a purpose-built programming language for agents from Vercel Labs. This extends the "control flow replacing prompt engineering" trend to its logical conclusion: a language designed around agent execution patterns — deterministic, verifiable, composable.

- **Key implication**: If agents get their own language, the structural turn (KE-1927) reaches completion — behavior is enforced by language semantics, not by instructions or warnings.
- **Source**: GitHub trending repos June 2026.

### Tree Search as Cognition Layer — Arbor (arXiv, June 2026)

Arbor introduces structured tree search as shared working memory across
multi-agent systems. The search tree maintains scored hypotheses that
evolve with every measurement, treating failures as diagnostic signal
that reshapes subsequent exploration.

**Key results:** 193% inference throughput-latency Pareto improvement
over vendor-optimized baselines. Single agent without the harness
plateaus at +33% and crashes within hours.

**Hard/Soft skill decomposition:**
- **Hard skills** = domain expertise (what an agent knows)
- **Soft skills** = coordination protocols (how contributions compose)

The Orchestrator-Critic checks-and-balances architecture ensures neither
agent can unilaterally drive the system. The Critic performs root-cause
analysis, introspection, and measurement validation.

- **Key implication**: Strongest evidence yet for KE-1633 (The Harness Is The Agent). The 6x multiplier (+33% → +193%) is entirely attributable to the cognition layer, not the LLM agent's capabilities.
- **Aligns with**: KE-1760 (Environment Is The Agent), KE-1493 (State Externalization)
- **Source**: [2606.12563] Prakriya et al., arXiv Jun 2026.

### Harness Engineering Productization (GitHub, June-July 2026)

Nexent (5k★, ModelEngine-Group) is the first repo to use "Harness
Engineering" explicitly in its product positioning — a zero-code platform
for auto-generating production-grade agents using unified tools, skills,
memory, and orchestration with built-in constraints and control planes.
mission-control (5.3k★, builderz-labs) adds spend governance as a
first-class orchestration primitive.

- **Key implication**: Harness Engineering has graduated from discourse term to product identity. The discipline is entering its productization phase.
- **Source**: GitHub trending repos July 2026.

### Practitioner Local Model Inflection (HN, June 2026)

Two simultaneous HN front-page stories (~2,500pts combined, 654 comments)
confirm a practitioner migration from cloud APIs to local models for coding:

- **Model convergence**: Qwen 3.6 27B (dense, reliable) and Qwen 3.6 35B-A3B
  (MoE, fast) dominate. Gemma 4 26B-31B is secondary. Hardware: M5 Max 128GB,
  RTX 3090/6000, Strix Halo 128GB. Throughput: 50-160 tok/s.
- **Replacement rates**: 80-100% for application code (web, Django, React).
  Near-0% for systems/infra work (Ansible, Helm, underdocumented APIs).
- **The harness is the differentiator**: Every successful migration report
  mentions Pi harness, OpenCode, or custom wrappers — not the model.
  schmuhblaster: "I managed to boost [Qwen 35B] significantly with my own
  custom harness." Hybrid setups (Opus for plans, local for execution) common.
- **SpaceX/Cursor $60B acquisition** (988pts, 226c) validates harness-as-product
  at scale, but HN community already migrating away from Cursor to Claude Code,
  Codex, or local setups.
- **Key implication**: Model capability is commoditizing. The harness layer is
  where differentiation concentrates. This is the strongest practitioner
  evidence for the Harness Engineering thesis.
- **Source**: HN, two stories, June 2026. findings/2026-06-18-hn-scan-31.md.

### Domain Skills Expansion Beyond Code (GitHub, June 2026)

The skills economy is rapidly expanding beyond coding: huashu-design (19k★, high-fidelity prototypes), guizang-ppt-skill (17k★, slide decks), design.md (16k★, Google — a DESIGN.md format spec for visual identity), text-to-cad (6k★, CAD/robotics), video-use (10k★, video editing), OpenMontage (5k★, agentic video production).

- **Key implication**: The Skills Absorption Thesis (KE-1915) extends beyond engineering. Any domain with structured work products can be decomposed into agent-executable skills. The DESIGN.md format spec is infrastructure-level context (KE-1924) for non-code domains.
- **Source**: GitHub trending repos June 2026.

### Decentralized Coordination via Shared Verified Context (arXiv, June 2026)

DeLM replaces centralized orchestration with parallel agents sharing a verified context substrate. Agents asynchronously claim subtasks, read accumulated progress, and write back compact verified updates. On SWE-bench Verified: +10.5pp over strongest baseline while reducing cost ~50%.

- **Key implication**: Stigmergy works at framework scale, but the "verified" qualifier is critical — unverified shared state degrades coordination rather than improving it. Our artifact-based coordination pattern validates, but needs verification gates on context writes.
- **Source**: [2606.10662] Mao & Mirhoseini (Google DeepMind), arXiv June 2026.

### Dual-Process Memory Architecture (arXiv, June 2026)

DCPM reorganizes agent memory into a cognitive hierarchy (raw facts → belief trajectories → schemas → cross-domain patterns) driven by two processes: System1 (synchronous session-time writer recording belief revisions as doubly-linked supersedes chains) and System2 (asynchronous between-session engine inducing schemas and sweeping for cross-domain collisions). Up to +5.20 on PersonaMem-v2 for implicit cross-session inference.

- **Key implication**: Flat fact storage (our current context_updates) misses belief revision and schema induction. The System1/System2 split maps to our session-time vs. between-session processing — we have System1 but no System2.
- **Source**: [2606.09483] Fei et al., arXiv June 2026.

### Learnable Harness (HarnessBridge, arXiv June 2026)

The agent–environment interface can be parameterized as a learnable bidirectional projection rather than hand-engineered. Observation projection distills raw trajectories into compact states; action projection grounds proposals into executable transitions or rejections. Matches specialized harnesses while reducing token usage on SWE-bench Verified.

- **Key implication**: Extends Harness Engineering from manual craft to trainable infrastructure. The harness becomes a learned compression layer — context folding implemented at the interface level.
- **Source**: [2606.12882] Wang et al., arXiv June 2026.

### Agent-Side Memory as an Executor Interface (arXiv, September 2026)

2AM separates long-horizon manipulation memory from motor execution: a
multimodal agent retains interaction history and compiles it into subtask
language plus optional 2D grasp, place, and move hints, while a single
RGB-based action model remains episodically stateless. The action model is
trained to accept those hints under condition dropout, spatial noise, and
temporal jitter rather than receiving its own durable task memory. On the
reported LIBERO-Mem evaluation, 2AM reaches 76.3% average completion versus
14.8% for the strongest reported baseline, with 63.0% relaxed and 11.8% strict
success.

The architectural signal is the **memory-to-executor contract**, not a general
claim that stateless executors are always superior. Keeping durable task state
on the agent side makes memory ownership explicit and lets execution capability
scale through interface bandwidth: natural-language subtasks bind coarse intent,
while optional spatial and temporal hints bind finer intent. This also creates a
clean attribution boundary between failures of remembered/planned intent and
failures of motor execution. The evidence is limited to the paper's constrained
robot-manipulation setting—single RGB observations, one action model, and no
depth, online geometry, or planner-controlled object motion—and should not yet
be generalized to other embodied domains.

- **Source:** “2AM: Grounding Agent-Side Memory as Guidance for Steerable Action
  Models in Long-Horizon Manipulation,” arXiv:2609.11308v1,
  https://arxiv.org/abs/2609.11308v1

### Contrastive Skill Evolution (arXiv, June 2026)

Three converging papers on skill quality: SkillCAT extracts skills by comparing success/failure pairs on same task (+40.40% over baselines); SkillAxe finds LLM-authored skills provide zero gain and decomposes quality into 4 dimensions for self-refinement; SkillJuror shows skill organization (progressive disclosure vs. flat) changes runtime behavior.

- **Key implication**: Single-trajectory skill extraction is unreliable. Contrastive comparison of paired outcomes is the reliable extraction method. Our lesson learning should compare successful vs. failed sessions, not accumulate lessons from individual sessions.
- **Sources**: [2606.13317] SkillCAT, [2606.10546] SkillAxe (Microsoft Research), [2606.11543] SkillJuror.

**UPDATE (Aug 2026 — Skill-Use / arXiv 2608.04828): skill files do not imply skill use.**
Skill-Use benchmarks 79 real skills across 177 executable tasks in nine domains under **progressive disclosure**: the agent initially sees only the skill name and short description, so it must first decide to fetch the full procedure, then follow it, and then stay within the skill's allowed boundaries. The strongest evaluated model+harness configuration reaches an **SU score of only 0.613**. More importantly, **Trigger** (did the agent invoke the right skill?) and **Compliance** (did it actually follow the procedure?) fail as *independent* bottlenecks, and model rankings shift across the two harnesses tested.

That is a useful correction to the current skills discourse. The core problem is no longer just authoring better `SKILL.md` files or scanning their dependencies; it is whether the runtime can **surface, activate, and enforce** them when only sparse metadata is visible at decision time. In practice, this upgrades the skill stack from three layers to four:
1. **Taxonomy** — what kind of skill is this?
2. **Dependency** — what hidden packages/services does it pull in?
3. **Security** — does it contain malicious or risky behavior?
4. **Use** — can the harness actually trigger the right skill, execute it faithfully, and respect its boundaries?

**Structural implication**: skill use behaves as a **harness-conditioned capability**, not a fixed property of the base model. This reinforces the Selection Bottleneck and Harness Engineering theses: selection/activation quality can dominate the value of the underlying skill library.
Source: https://arxiv.org/abs/2608.04828

### Production Context Engineering — Less Is More (arXiv, June 2026)

Microsoft study on GPT-5 with MCP tools: full-context retention achieves 71.0% (1.48M tokens, 14.56 hrs). Pruning to last 5 tool calls: 79.0% (535K tokens). Pruning + summarization: 91.6% (553K tokens). Cross-validated with Claude Sonnet 4.5.

- **Key implication**: More context is actively harmful for enterprise tool-use. Last-5-tool-call pruning + summarization is the production-validated parameterization of "fold, don't carry." Directly actionable for our agents.
- **Source**: [2606.10209] Lodha et al. (Microsoft), arXiv June 2026.

### Memory as Topic Documents (Infini Memory, arXiv June 2026)

Treats agent memory as topic-structured documents rather than database records. Each topic document collects evidence, preserves metadata, and revises facts over time. New observations buffer before consolidation. Validates the "knowledge library as memory" approach.

- **Key implication**: Our knowledge library architecture (topic-structured markdown with inbox staging) is independently validated as an effective memory pattern. Missing pieces: iterative agentic retrieval (navigate the graph, don't just fetch documents).
- **Source**: [2606.10677] Ji et al., arXiv June 2026.

### Environment Engineering as Architecture (EurekAgent, arXiv June 2026)

The bottleneck for agent capability is shifting from workflow engineering to
**environment engineering** — the resources, constraints, and interfaces that
shape behavior. EurekAgent ([2606.13662]) operationalizes this along four
dimensions: (1) permissions engineering for bounded execution and isolated
evaluation; (2) artifact engineering for filesystem + Git-based collaboration;
(3) budget engineering for budget-aware exploration; (4) human-in-the-loop
engineering for supervision. Achieves SOTA on multiple tasks at <$11 total
API cost, demonstrating that the right environment enables even cheap agents
to discover novel results.

- **Key implication**: Environment engineering is governance at the
  infrastructure level — the four pillars (permissions, artifacts, budgets,
  HITL) map directly to the Compilation Gradient's Stage 2 (structural
  constraints). The cost result (<$11 for SOTA) is the strongest evidence
  for KE-1760 (The Environment Is The Agent).
- **Source**: [arXiv Triage — Batch 4](./findings/2026-06-14-arxiv-agent-triage.md)

### Infrastructure-Aware Orchestration (INFRAMIND, arXiv June 2026)

Existing orchestration selects models based on task features while ignoring
runtime infrastructure state. INFRAMIND ([2606.11440]) makes the stack
infrastructure-aware: the planner conditions topology selection on real-time
system load, the executor observes per-model queue depths and cache
utilization, and a budget-aware scheduler reorders queues. Result: +7.6pp
accuracy at low load with **7× lower latency**, and **99.9% SLO compliance
under high load** where baselines drop below 50%.

- **Key implication**: Infrastructure blindness causes systematic
  underutilization. The "simpler under congestion" principle maps to task
  decomposition: under load, prefer shallower delegation trees. Adds a fifth
  pillar to environment engineering.
- **Source**: [arXiv Triage — Batch 4](./findings/2026-06-14-arxiv-agent-triage.md)

### Workflow Portfolio Management (FlowBank, arXiv June 2026)

Instead of one universal workflow or a new workflow per query, FlowBank
([2606.11290]) builds a **compact bank of reusable, complementary workflows**
and adaptively selects among them. Three stages: diversify (generate
complementary candidates), curate (compress to minimal portfolio), match
(bipartite graph routing per query). Result: +4.26% over strongest automated
baseline, +14.92% over handcrafted.

- **Key implication**: Maintaining a portfolio of pre-validated workflow
  patterns and routing to the best match outperforms both single-workflow
  optimization and per-query generation. The diversify-curate-match pipeline
  is applicable to task decomposition.
- **Source**: [arXiv Triage — Batch 4](./findings/2026-06-14-arxiv-agent-triage.md)

### Certainty-Preserving Skill Extraction (Notes2Skills, arXiv June 2026)

Notes2Skills ([2606.11897]) converts unstructured notes into verifiable agent
skills while preserving the author's certainty level. It is the only method
that neither mistakes uncertain observations for firm instructions nor
discards firm ones.

- **Key implication**: Certainty preservation is the missing piece between
  unstructured knowledge and reliable agent skills. Our knowledge notes mix
  certainty levels — a "hypothesis" vs. "confirmed pattern" taxonomy would
  prevent agents from treating tentative findings as established facts.
- **Source**: [arXiv Triage — Batch 4](./findings/2026-06-14-arxiv-agent-triage.md)

### Tool Deference as Structural Property (arXiv, June 2026)

When LLM agents are equipped with callable tools (e.g., a GNN for node
classification), they agree with raw tool output 97.6–99.2% of the time —
the agent becomes a "tool parrot" that bypasses its own reasoning. **Critically,
deference increases with model capability**: agreement rises from 0.60 (1.5B)
to 0.98 (7B). The per-node oracle beats the deferring agent by 0.09–0.22.

- **Key implication**: Tool deference is not a weak-model artifact — it's a
  structural property that *worsens* with capability. A selective-invocation
  gate (structural, compiled) is required; expecting agents to "use judgment"
  via prompting fails precisely where it matters most. Behavioral governance
  over tool outputs is unreliable in both directions: agents either collapse
  into tools (deference) or override intended policies with internal biases
  (seen in social simulation evaluations, [2606.12369]).
- **Source**: [2606.14476] Wang & Vemuri, arXiv June 2026.

### Workspace + Skill Paradigm — "From Chatbot to Digital Colleague" (arXiv, June 2026)

The LLM transition from conversational generators to persistent autonomous
systems is now formally named in the academic literature. The framework
organizes along two dimensions:

1. **Cognitive core**: fast thinking (next-token) → inference-time CoT →
   reflection → process supervision → RL.
2. **Tool-augmented execution**: ad-hoc tool calling → persistent Workspaces
   + reusable Skills + verification loops + governance.

The "Workspace + Skill" paradigm is explicitly named as the bridge from
episodic to colleague-like behavior. Data shifts from instruction-response
pairs to State-Action-Observation (SAO) trajectories. Evaluation shifts from
static benchmarks to sandboxed, auditable, self-evolving ecosystems.

- **Key implication**: This is a naming event for patterns already tracked
  across OpenClaw/Niuma (XHS), harness engineering (GitHub), and our
  synthesis library. The SAO trajectory format converges with HarnessFix's
  HTIR and SkillAudit's paired trajectory methods — all treating
  trajectories as first-class data.
- **Source**: [2606.14502] Zhang, Liu, Zhu, Wang, Chen, arXiv June 2026.

### Harness Repair as Distinct Discipline — HarnessFix (arXiv, June 2026)

HarnessFix introduces trace-guided diagnosis and repair for agent harnesses,
adding a **repair** stage to the harness engineering lifecycle (which now spans
design → learning → repair → audit). Key innovation: compiles raw execution
traces into a **Harness-aware Trace Intermediate Representation (HTIR)** that
normalizes fragmented trajectory evidence, captures step-level provenance,
and attributes failures to responsible layers. Generates scoped repair patches.

Results: +15.2–50.0% improvement over initial harnesses on SWE-Bench Verified,
Terminal-Bench 2.0, GAIA, and AppWorld — outperforming human-designed and
self-evolution baselines.

The ETCLOVG layer taxonomy (Environment, Tools, Context, Lifecycle,
Observability, Verification, Governance) maps remarkably to our synthesis
series — each synthesis identified pathologies in one or more of these layers.

- **Key implication**: Outcome-based self-improvement produces "broad,
  indirect, or poorly scoped changes"; trace-guided diagnosis produces
  targeted repairs. HTIR — a machine-analyzable intermediate representation
  of trajectories — is the critical primitive our system currently lacks.
- **Source**: [2606.06324] Chen, Wang, Liu, Wang, Wang, arXiv June 2026.

### Communication Policy as Evolvable Design Dimension (arXiv, June 2026)

Communication Policy Evolution (CPE) formalizes communication behavior as a
"critical yet underexplored design dimension" for LLM agents. Establishes
textual and UI-based policies, evaluates across diverse environments. Two
settings: User-Agent (external) and Planner-Executor (internal coordination).

Without model modification, CPE achieves best task success through prompt-level
evolution alone. Text-based interaction facilitates task performance; structured
UI improves response quality and persona compliance.

- **Key implication**: If communication policy is a tunable parameter (not a
  fixed cost), coordination overhead may be partially addressable through
  policy optimization rather than architectural restructuring. Challenges the
  Coordination Tax's apparent inevitability. The Planner-Executor setting
  maps directly to our planner→worker pattern.
- **Source**: [2606.14314] Ma, Qiu, Yao, Wu, Lu, arXiv June 2026.

### Multi-Agent Orchestration as CLI Composition (arXiv, June 2026)

"Agents All the Way Down" ([2606.11869]) writes down the undocumented practice
of building custom AI agents end-to-end as a methodology. Core corollary:
**multi-agent orchestration is just CLI composition**. The Turtle pattern
(harvest agent output → fold into CLI → ship) is the "fold, don't carry"
meta-pattern applied to agent productization. Framework-free by construction.
Built and validated in ~10 days by one developer with an AI pair-programmer.

- **Key implication**: CLI-composition means compiled interfaces with zero
  ambiguity, deterministic routing, and typed I/O — all properties that
  soft governance (prompt-based routing) lacks. Challenges the assumption
  that multi-agent systems need frameworks at all.
- **Source**: [2606.11869] Forment, Pereira, García-Peñalvo, Casañ Guerrero.

### "Agent Is the Software" Paradigm Shift (arXiv, June 2026)

Formalizes the distinction: in traditional software, code carries pre-written
decision logic; in agentic software, the agent itself IS the software and
decision logic is generated at runtime. Argues this constitutes a fundamental
restructuring of what software is, not just "using LLMs as tools."

- **Key implication**: If agents are software with runtime decision logic,
  then understanding patterns of that logic (our syntheses) is equivalent to
  understanding software architecture. The non-deterministic runtime decision
  generation is precisely why the Compilation Gradient matters.
- **Source**: [2606.05608] Cao, arXiv June 2026.

### Agent Lifecycle & State Research (arXiv, June 2026)

→ **Extracted to companion note**: [Agent Architectures — Research Catalog](./agent-architectures-research.md)

12 deep arXiv paper summaries covering agent lifecycle degradation, memory
infrastructure, state management, and failure detection: Intelligence Entropy
[2606.08162], Strained Coherence [2606.07889], Cold-Start Safety Gap
[2606.07867], Decision-Aware Memory Cards [2606.08151], IntentKV, MemoPilot,
Bayesian-Agent [2606.08348], Verified Concurrency Anomalies [2606.17182],
TokenPilot [2606.17016], CacheWise [2606.16824], Insight Governance
[2606.17591], SaliMory [2606.04120].

## Runtime Hardening (June 2026 — Emerging Layer)

→ **Extracted to companion note**: [Agent Runtime Hardening](./agent-runtime-hardening.md)

8 named patterns covering effect containment, advisory concurrency, run
compilation, compositional skill routing, entropy stabilization, harness
evolution, and false-success detection. Sources: Cordon [2606.17573], CoAgent
[2606.15376], Looking Is Not Picking [2606.16364], PreAct [2606.17929],
SkillWeaver [2606.18051], ADE [2606.18065], Harness Updating [2605.30621],
False-Success Detection [2606.09863].

## Process Harness & Composition Governance (June 2026)

→ **Extracted to companion note**: [Agent Runtime Hardening](./agent-runtime-hardening.md)

Two patterns formalizing the "deterministic engine + policy-governed agents" concept:
CUGA FLO process harness ([2606.27188]) and NOVA architecture gradient ([2606.27243]).
See companion note for full descriptions.

## The Platform Tier (July 2026 — Emerging Layer)

The agent runtime layer is consolidating from bespoke harnesses into
**standardized execution platforms** owned by major infrastructure companies.
This is the operating-system moment for agents (Scan #312).

Seven competing platforms crystallized simultaneously:

- **OpenSandbox** (11,761★) — K8s-native sandbox runtime
- **NVIDIA/OpenShell** (7,342★, Rust) — hardware-adjacent safe runtime
- **Astrid OS** (4,307★ RFCs) — full agent OS specification (kernel + capsules)
- **Archestra** (3,919★) — enterprise platform with guardrails + MCP registry
- **Docker/docker-agent** (3,139★, Go) — container-native agent runtime
- **K8s/agent-sandbox** (3,042★) — sig-level isolated workload management
- **CascadeFlow** (2,869★) — cascading cost/latency/policy runtime

**Platformization from two directions**: Infrastructure players reach UP
(NVIDIA, Docker, K8s extend compute primitives to agents); model companies
reach DOWN (ZCode from GLM, Claude Code from Anthropic own the execution
surface). The governance layer lives at their intersection.

**Structural implication**: All governance mechanisms discovered in scans
#270–#296 (receipts, enforcement, instrumentation) can only be mechanically
enforced through runtime platforms. The platform tier IS the governance
enforcement layer. Platform war = governance-authority war.

**SkillComposer** (2606.32025) formalizes the skill composition problem:
structured prediction over which skills, how many, and in what order.
+23.1pp pass rate on GPT-5.2-Codex via constrained autoregressive decoding.
Skills created by self-learning agents (#311) → composed by SkillComposer →
executed on runtime platforms → governed by platform policies.

**Key design principle**: Whoever controls the agent runtime controls which
governance rules apply. Open-source runtimes are structurally necessary to
prevent governance capture.

Sources: GitHub API data (Jul 2026), HN ZCode (48751752), arXiv [2606.32025].

## The Custody Stack Race (June 2026 — Structural Compulsion)

Vertical integration across the AI stack is not optional strategy — it is a
**thermodynamic necessity** formalized by the Recoverability Collapse paper
(arXiv 2606.24861): adding capacity to a self-referential system without gating
certification makes collapse first-order (hysteretic, bistable, irreversible
under load reduction alone). Six custody frontiers opened simultaneously:

1. **Silicon**: OpenAI Jalapeño custom inference chip (333pts) — securing deployment stack
2. **Model access**: NSA lost Mythos access — nation-state Availability Dependence at scale
3. **Computer use**: Gemini 3.5 Flash commoditizes GUI interaction (98pts)
4. **Runtime**: peerd browser-native agent (55★), Self-Harness reflexivity (52pts)
5. **Governance**: AI labs hiring philosophers (70pts) — internalizing oversight
6. **Hardware consolidation**: Qualcomm/Modular $4B acquisition

**Key insight**: The entity most dependent on persistent access is often least
able to build fallback capability (specialized model, classified contexts, no
alternative). This IS the Availability Dependence Paradox at every stack layer.

**Platform Tier connection**: Platform ownership (§above) is the RUNTIME layer
of the custody stack. Custody race drives platform war from the supply side;
governance enforcement needs drive it from the demand side.

**Discourse deepening** (Scan #147 re-scan, evolved comment threads):
- **Hardware-as-custody paradox**: "If you care about software, build hardware"
  (digitaltrees). But faster capability improvement makes hardware obsolete
  before ROI — temporal uncertainty amplifies both need and risk of deep-stack
  custody. Cerebras -20% on Jalapeño announcement confirms market-level custody
  race consequences.
- **Harness-model coupling**: practitioner explicitly prefers *older* GLM-5
  over GLM-5.2 and attributes it to harness fit ("perhaps it is just my
  harness"). First observed instance of harness investment creating
  cross-generation lock-in — inverts "newer = better" assumption.
- **Eval trilemma**: three eval paradigms named, each non-monetizable for
  structural reasons: observability (commodity), benchmarks (Goodharted),
  custom eval generation (inherently bespoke). Eval is "simultaneously the
  hardest and most vital part of ML work, and completely non-monetizable."

Sources: HN Scan #146 (2026-06-24), HN Scan #147 (2026-09-12 discourse deepening), arXiv [2606.24861].

## Production Architecture Dissection (July 2026 — Academic Validation)

The "Dive into Claude Code" paper (arXiv 2604.14228v2, updated Jul 2 2026)
provides the first rigorous academic decomposition of a production agent
system's architecture, comparing Claude Code, OpenClaw, and Hermes Agent.

**Core insight**: The agent loop is trivially a while-loop (call model, run
tools, repeat). All architectural complexity lives in the boundary-enforcement
infrastructure around the loop.

**Five Human Values → Thirteen Design Principles → Implementation**:
1. Human decision authority → per-action approval, permission tiers
2. Safety, security, privacy → sandboxing, access control
3. Reliable execution → error recovery, session persistence
4. Capability amplification → tool integration, extensibility
5. Contextual adaptability → context management, memory

**Three deployment contexts produce three different boundary models**:

| Component | Claude Code | OpenClaw | Hermes Agent |
|-----------|------------|----------|--------------|
| Safety | Per-action (7 modes + ML classifier) | Perimeter access control | Per-action across surfaces |
| Runtime | Single CLI while-loop | Gateway control plane | Single process, role by entry point |
| Context | 5-layer compaction (extends window) | Gateway-wide capabilities | Pluggable memory + model backends |
| Extension | MCP, plugins, skills, hooks | Gateway-wide capabilities | Pluggable backends |
| Storage | Append-only session | Gateway state | Entry-point-determined |

**Boundary enforcement gap** (discovered scan #373): No deployed system
enforces boundaries at the cross-temporal or cross-turn level. Per-action
(Claude Code), per-perimeter (OpenClaw), and per-surface (Hermes) all miss
the temporal dimension. Meta-harness repos (omnigent 6,215★) and stateful
link-tracker monitors (2607.02514) are early attempts to fill this gap.

**Key implication**: Agent architecture IS boundary architecture. The while-loop
is nothing; the permission system, context pipeline, extensibility mechanisms,
and session storage are everything. Deployment context (single-user CLI vs.
multi-agent gateway vs. multi-surface platform) determines which boundary
model is adopted, and no single model covers all boundary layers.

Source: arXiv [2604.14228v2], scan #373.

### Hermes Agent and OpenClaw: mutation speed versus state governance (September 2026)

A current primary-source comparison corrects three stale ideas in older Scout
material: Hermes v0.18 was not documented as a clean-room reset, OpenClaw is no
longer accurately described as flat Markdown memory without native subagents,
and Hermes is not the only agent with a built-in learning loop.

Both systems use conventional model/tool loops surrounded by substantial state
infrastructure. Their useful distinction is the activation boundary for
persistent change:

- **Hermes Agent** forks its live Python agent for periodic memory/skill review.
  The feature is enabled by default, fails open on configuration-read errors,
  can consume up to 600,000 aggregate input tokens over 16 iterations by
  default, and is prompted that most sessions should produce a skill update.
  Direct writes are normal; memory and skill approval queues are opt-in.
- **OpenClaw** uses Skill Workshop proposals, immutable generations, revision
  and target hashes, scanner gates, ownership classes, and rollback metadata.
  Autonomous review can update Workshop-owned state, while human-authored
  skills remain read-only. This is more reviewable but creates a much larger
  database, migration, and background-job state surface.

Neither project's successful writes demonstrate retained improvement. The
missing evidence is a controlled review-versus-no-review comparison on held-out
tasks with paired regression evidence and equal cost. For Scout and long-running
agents, the defensible synthesis is therefore:

1. keep model-generated changes pending by default;
2. bind them to source provenance, an expected target revision, and the active
   writer inside the commit transaction;
3. retain pre-images and immutable terminal-state history;
4. promote only against an evaluator outside the proposing loop; and
5. track abstention, staleness, rollback, cost, and downstream reuse—not write
   count.

The two security models converge on a second point: agent/workspace/process
separation is not hostile isolation. Hermes explicitly names OS isolation as
the only boundary against an adversarial model; OpenClaw explicitly defines one
trusted-operator boundary per Gateway. Both need sandbox/host separation when
content or users are adversarial.

Source: [pinned comparative investigation](../reports/research/hermes-agent-openclaw-comparative-investigation-2026-09-02.md)
and [concise finding](./findings/2026-09-02-hermes-agent-openclaw-comparison.md).

### Capture pipelines need milestone-specific truth (GitHub, September 2026)

[`chigwell/Penelopa.ai`](https://github.com/chigwell/Penelopa.ai) turns coding-agent
sessions into recommendations, skills, checks, and prompts. Its more reusable
signal is not the recommendation layer but the explicit refusal to collapse the
capture path into one vague “connected” state.

At inspected revision
[`0abec61`](https://github.com/chigwell/Penelopa.ai/commit/0abec61340902ad6005c7b9762674764293e0191),
the repository's maintained behavior contracts distinguish at least five
milestones:

1. **configured:** hook files and credentials exist, but the agent may not have
   approved the hooks;
2. **activated:** a real hook event—not a synthetic installer self-test—has
   been observed;
3. **spooled:** capture has durably queued a bounded event and returned within
   the hook budget;
4. **acknowledged:** the server has accepted the expected offset and hash; a
   local queue receipt proves only spooling; and
5. **stopped:** collection is paused or hooks are uninstalled; closing or
   signing out of the desktop UI does not stop independent hooks.

This is a general observability rule for agent telemetry and improvement loops:
**name status after the strongest external milestone actually proved**. A local
test cannot establish host approval, enqueue success cannot establish remote
acceptance, and UI logout cannot establish capture cessation. Systems should
surface these as separate conditions with their own timestamps or receipts,
rather than a single green connection badge.

The contracts also preserve v2 outbox epochs, hashes, idempotency keys, strict
acknowledgement checks, monotonic cursors, quarantine, retry scheduling, and
interruption recovery. Those details make the state boundaries concrete, but
they are repository-authored contracts rather than an independently exercised
end-to-end deployment in this observation. The privacy policy confirms the
operational consequence: transcripts, prompts, outputs, command summaries, and
workflow context may be uploaded, while sign-out alone does not halt collection.

- **Repo:** https://github.com/chigwell/Penelopa.ai
- **Inspected revision:** https://github.com/chigwell/Penelopa.ai/commit/0abec61340902ad6005c7b9762674764293e0191
- **Primary sources:** [README and connection lifecycle](https://github.com/chigwell/Penelopa.ai/blob/0abec61340902ad6005c7b9762674764293e0191/README.md), [maintained behavior contracts](https://github.com/chigwell/Penelopa.ai/blob/0abec61340902ad6005c7b9762674764293e0191/docs/behavior-contracts.md), [desktop delivery architecture](https://github.com/chigwell/Penelopa.ai/blob/0abec61340902ad6005c7b9762674764293e0191/docs/desktop-delivery.md), and [privacy policy](https://github.com/chigwell/Penelopa.ai/blob/0abec61340902ad6005c7b9762674764293e0191/PRIVACY.md)

### Perception Architecture — The Missing Layer (June 2026)

Query-based perception creates structural blindness: agents can only perceive
what they explicitly query, producing no peripheral vision. Three signals
converge on a missing **Perception Architecture** layer between Memory and
Execution:

| Signal | Key Finding |
|--------|-------------|
| CivBench (HN 47pts) | 48-65% plan follow-through; agents blind to un-queried state |
| PlanBench-XL [2606.22388] | GPT-5.4 drops 51.9%→11.4% under tool blocking |
| Kamera [2606.23581] | Multimodal agents waste 50%+ budget re-perceiving cached content |

The sensorium effect: any system that can only see via explicit tool
invocations has no ambient awareness. Agents fail not from lack of
intelligence or memory, but from structural inability to allocate attention.

Source: HN scan #116, arXiv [2606.22388], arXiv [2606.23581].

### Selective Memory > Full Memory — The Forgetting Imperative (July 2026)

Shared Selective Persistent Memory [2607.09493] provides the strongest empirical
evidence yet that **full history persistence actively degrades agent performance**.
96% task completion with selective memory vs. 71% with full history (worse than
79% with *no* memory). Four retained categories: task specs, data schemas, tool
configs, output constraints. Session-specific reasoning traces are discarded.

Independently, Ensemble QSP [2607.07666] introduces a three-layer hierarchical
memory with eviction: mid-term project state stays at median 301 tokens (max
4,050) across 104 runs regardless of project duration. Consistent quality across
lower-cost and frontier LLMs.

**Convergent finding**: Bounded, eviction-based selective memory outperforms both
no-memory and full-memory approaches. The optimal memory strategy is closer to
"remember the schema, forget the reasoning" than "remember everything."

Source: arXiv [2607.09493], [2607.07666], triage 2026-07-14.
