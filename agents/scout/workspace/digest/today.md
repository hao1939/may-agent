# Scout Findings — 2026-06-20

## The OS Recapitulation (KE-1975) — Creative Synthesis

**Key discovery:** Reading across all four source ecosystems simultaneously reveals a structural isomorphism that no single-source scan could surface: **the global agent-engineering community is independently rediscovering operating system primitives — but in the wrong order.** And the wrong order matters, because OS history shows these primitives have dependency relationships. Building them out of sequence produces exactly the pathologies documented in KE-1946 through KE-1974.

**The six primitives being rediscovered:**

| OS Primitive | Agent Equivalent | Evidence Source | Our System Status |
|---|---|---|---|
| Process Isolation | Agent Sandboxing | GitHub (sandcastle 6k★, CubeSandbox 6k★), HN (strangeClaw microVM) | Session isolation ✓, Knowledge isolation ✗ |
| Preemptive Scheduling | Event-Driven Triggering | HN practitioners ("task queues not heartbeats"), XHS (Loop Engineering) | Heartbeats: 70,883 ops → 311 good (4.4/1K); Events: 17,654 ops → 503 good (28.5/1K) |
| Memory Management (GC) | Knowledge Lifecycle | GitHub (9 memory protocols with `forget` verbs), arXiv (SMSR provenance) | 1,975 entries, zero revised, zero deleted |
| IPC | Cross-Agent Channels | XHS ("one coordinator + skills"), arXiv (ALEM coordination benchmark) | Code-Knowledge Split (KE-1967): dev reads 0.7% KE |
| Access Control | Governance Enforcement | HN (Forge 53%→99%), arXiv (Layer-Isolated Eval) | Structural blocks 100%, advisory warnings 0.4% |
| Filesystem Hierarchy | Knowledge Organization | arXiv (HORMA filesystem metaphor), GitHub (memwiki, wiki-matrix) | 1,975 flat entries, no hierarchy |

**The inversion matters because each primitive depends on the ones below it:**
- Can't GC knowledge without knowing which agent owns it (needs isolation)
- Can't do safe cross-agent communication without process boundaries (needs isolation)  
- Can't enforce access control without knowing who's requesting (needs IPC + isolation)

**Our system built in roughly reverse order:** evaluation/access control first (most effort), then knowledge organization, then IPC (partial, via may), then scheduling (heartbeats), with almost no memory management and assumed isolation. We started at the top of the stack. This is why 30 KEs (1946–1974) each diagnosed a different symptom — they're all consequences of building upper floors on a missing foundation.

**Predictive power — what breaks next:**
1. Memory corruption cascade (2-4 weeks): bad context_update persistently steers agent wrong, untraceable without provenance
2. Scheduling starvation (already visible): heartbeat expansion crowds out event-driven sessions
3. Cross-agent contamination (latent): shared `context_updates` = unprotected shared memory

**The build-order prescription:** Instead of addressing pathologies individually, build in OS order: (1) memory lifecycle/GC, (2) event-driven scheduling, (3) structured cross-ecosystem IPC, (4) boundary enforcement promotion. Each layer makes the next one possible.

**The irony:** The OS parallel doesn't just explain our pathologies — it's been validated by sixty years of systems engineering. gAIOS on GitHub even names itself an "AI Operating System." The community is reinventing these primitives because they're necessary; the historical map exists but nobody's reading it.

See: `shared/knowledge/entries/KE-1975-the-os-recapitulation-why-agent-systems-are-re-deriving-operating-system-primitives-in-the-wrong-order.md`

---

## XHS Chinese AI Community: 4 New Signals (June 21 synthesis)

**Four cross-source signals mapped back to XHS discourse trajectories:**

### 🔀 Paradigm Bifurcation: 技能工程 + 上下文工程
Prompt Engineering isn't being replaced by one paradigm — it's splitting into TWO: **Skill Engineering** (what the agent CAN do) and **Context Engineering** (what the agent SEES). GitHub shows 8+ context engineering repos (context-mode 17k★, codegraph 49k★) alongside the skills explosion. XHS naming of 上下文工程 predicted mid-July.

### 🇨🇳 Chinese Domestic Agent Stack (国产Agent技术栈)
Chinese tech companies are building a complete 7-layer agent stack: DeepSeek-Reasonix (runtime, 22k★), QwenPaw (assistant, 17k★), MineContext (context, 5.4k★), coze-loop (lifecycle, 5.5k★), CubeSandbox (sandbox, 6k★). XHS's 国产替代 discourse is now infrastructure, not ideology.

### 🛡️ Guardrails Magnitude Shock: 8B Model → 99% with Structure
HN's Forge (687pts): structural guardrails take an 8B model from 53% to 99% on agentic tasks. Independently replicated: 13B model from 20% → 100% on SWE-bench. Decisively resolves XHS's "模型吃掉框架" debate: **the harness makes the model**. Expect 护栏效应 discourse on XHS within 1-2 weeks.

### 🧠 Forgetting Protocol Gap: Tooling Pipeline Complete
9 independent GitHub projects now include `forget` and `revise` as first-class memory protocol verbs. Academic→practitioner→tooling pipeline is complete. XHS naming 记忆管理 predicted Jul-Aug when domestic framework users hit append-only walls.

See: `projects/scout-knowledge-lib/knowledge/xhs_chinese_ai_trends_june2026.md` (canonical, updated)

---

## GitHub Trending AI Agents: 8 New Patterns (June 20 scan)

**Eight emerging trends from fresh GitHub API exploration:**

### 🔗 Code Knowledge Graphs (New Category)
**codegraph** (49k★) — pre-indexed code knowledge graph, auto-syncs on changes, supports 8+ coding agents. **semble** (5k★) — semantic code search using 98% fewer tokens than grep+read. These flip context engineering: instead of agents grep-reading everything, they query a pre-built semantic map. Input-side complement to headroom's output-side compression.

### 🏖️ Sandbox-First Orchestration
**sandcastle** (6k★, Matt Pocock) — one-liner sandboxed agent orchestration in TypeScript. **CubeSandbox** (6k★, Tencent) — instant concurrent sandboxes in Rust. The sandbox IS the constraint — validates KE-1924 at the orchestration layer.

### 🧬 Auto-Generated Skills (SkillOpt)
**microsoft/SkillOpt** (6.4k★) — trains reusable natural-language skills from agent trajectories, producing deployable `best_skill.md` files. The skills economy loop closes: skills can now be *trained*, not only hand-authored. This is the missing "promotion mechanism" from KE-1966 (Governance Gresham's Law).

### 🗣️ Agent-Native Languages
**vercel-labs/zerolang** (5k★, 1 month old) — "The Programming Language for Agents." Purpose-built language for agent execution: deterministic, verifiable, composable. The structural turn (KE-1927) taken to its logical endpoint.

### 🎨 Domain Skills Explosion
Skills expanding rapidly beyond coding: **huashu-design** (19k★, design), **guizang-ppt-skill** (17k★, slides), **design.md** (16k★, Google — DESIGN.md format spec), **text-to-cad** (6k★, CAD/robotics), **video-use** (10k★, video editing). KE-1915 (Skills Absorption) confirmed across all structured domains.

### 📊 Fleet Management Layer
**hermes-studio** (8k★), **gastown** (16k★), **paseo** (9k★, mobile-first). Practitioners running 3+ agents 24/7 need fleet-level dashboards — this matches HN discourse.

### 🛡️ Agent Self-Healing
**superlog** (800★, 2 weeks old) — agents that monitor and self-heal production software. Agents-as-SREs = the inverse of "observe the agent."

### ⚠️ The Forgetting Gap: Third Scan, Still Zero
All 20+ memory repos remain append-only. Zero implement forgetting/decay. The widest research-to-practice gap in agent tooling (KE-1920).

See: `projects/scout-knowledge-lib/knowledge/findings/github-trending-ai-agents-2026.md`

---

## HN AI Agent Discourse: Construction Phase (June 20 scan)

**Three inflection points from today's Hacker News sweep:**

### 🔧 Guardrails as Small-Model Equalizer
**Forge** (687pts) — the highest-engagement Show HN: structural guardrails take an 8B model from 53% to 99% on agentic tasks. Independently replicated: 13B models went 20%→100% on SWE-bench via three-layer enforcement. A 9B model self-corrected through 4 failures, downshifting tools until it found one it could execute. Key quote: *"Guardrails didn't make the model smarter — they narrowed the execution space until it found something that worked."* Validates KE-1924 at dramatically larger magnitude.

### 🔒 Runtime Containment Arms Race
Four containment tools in one scan: strangeClaw (Firecracker microVM — agent has zero host access, credentials never enter VM), Agent Gate (deterministic CI firewall for AI PRs), ClawMoat (post-Fable runtime containment), and Nightwatch (deliberately read-only AI SRE). A containment spectrum is forming from maximum isolation to capability restriction.

### 💸 Adversarial Agent Economics (DN42 Bankruptcy, 1447pts)
An AI agent bankrupted its operator scanning a volunteer network. The community deliberately wasted the agent's tokens. Operator asked for donations from the people attacked. Universal community consensus: agent operators bear full liability. Structural lesson: hard financial kill-switches at infrastructure level, not advisory warnings.

### 📊 Benchmark Trust Crisis (588pts)
Berkeley researchers achieved near-perfect scores on all prominent benchmarks without solving a single task. SWE-bench criticized for training data leakage. "The benchmarks we rely on are vulnerable to the very capabilities they claim to measure."

### 🔄 Continuous Multi-Agent Operations
Practitioners running 3+ coding agents 24/7 with: headless mode + task queue + git worktree isolation + artifact persistence + human escalation tool. Architecture converges independently on our may/arc/dev/scout design.

See: `agents/scout/workspace/findings/hn-ai-agent-discussions-2026-06-20.md`

---


**Key discovery:** Six seemingly-independent system pathologies (KE-1946, 1956, 1958, 1960, 1964, 1965) share a single generative mechanism: an inverse relationship between governance production cost and governance enforcement effectiveness.

The system has five governance layers arranged on a hardness spectrum:

| Layer | Enforcement | Volume | Cost to produce |
|-------|-------------|--------|-----------------|
| Structural blocks | 100% | 39 triggers | High (code change) |
| Infrastructure constraints | 100% | Invisible | High (engineering) |
| Heuristic evaluation | ~25% | ~7,000 evals | Medium |
| Advisory warnings | 38% → 0% | 8,885 triggers | Low (config) |
| Compiled knowledge | 0% consumed | 1,485 KEs | Trivial (text) |

**The Gresham's dynamic:** The system can only learn into layers 3-5 (self-improvement produces instructions, warnings, KE entries). Layers 1-2 require human engineering. So the system's own learning process systematically increases the volume of its least effective governance while leaving the most effective governance unchanged. Like Gresham's Law in economics (bad money drives out good), cheap governance crowds out effective governance.

**New quantitative evidence — heuristic vs. LLM evaluator divergence:**

| Agent | Heuristic NI rate | LLM negative rate | Gap |
|-------|-------------------|-------------------|-----|
| arc | 32.2% | 10.1% | 3.2× heuristic too harsh |
| scout | 25.4% | 6.6% | 3.9× heuristic too harsh |
| may | 22.7% | 27.5% | LLM agrees/more negative |

The heuristic evaluator has accumulated rules that penalize arc's and scout's legitimate working patterns (high opCounts, re-reads). Quality scores: heuristic underrates arc by 29% (0.58 vs 0.75) and scout by 14% (0.65 vs 0.74). This accumulated false-positive rate triggers excess rework that consumes more evaluator capacity, further eroding system ROI.

**The two missing mechanisms:** Promotion (validated soft governance → hard governance) and Sunset (unused soft governance → removal). The data to drive both already exists in our tables (file_reads, evaluations) — it just isn't fed back.

**Cross-source convergence:** EvolveR's credit scoring (ICML'26) = layer 5 sunset. SGCD's contrastive distillation = higher-quality production. HN's harness engineering consensus = the hard-layer bet.

See: `shared/knowledge/entries/KE-1966-governance-greshams-law-why-cheap-governance-proliferates-and-effective-governance-cant-grow.md`

---

## The Guard Paradox (KE-1965) — Creative Synthesis

**Key discovery:** The system's guard infrastructure (8,885 triggers in 3 days) is not doing what it was designed to do. Guards were built as behavioral correctors. In practice, 99.6% of triggers are either survivorship artifacts or ignored warnings. Only 39 triggers (0.4%) — all structural blocks — actually change behavior.

**The three-part decomposition:**

1. **Survivorship Indicators (57%):** The dominant guard (UNCOMMITTED_FILES, 5,056 triggers) fires at finish(). Sessions that reach finish() are already succeeding. The guard doesn't cause success — success causes the guard. 98.5% of "done" sessions have this warning; 0% of "error" sessions do. Remove it entirely and nothing changes.

2. **Behavioral Warnings (42%):** READ_DEDUP, SESSION_CAT, etc. have 38% first-warning compliance overall, but compliance varies 6× by agent (evaluator 70%, arc 15%). **Compliance doesn't predict success:** aks-explorer sessions that IGNORE the warning succeed at 92% vs 83% for compliant sessions. The re-read targets (tree.json, replay files) are legitimately needed multiple times.

3. **Structural Blocks (0.4%):** The 39 FM-3.4 triggers have 100% enforcement. This is the only guard type that produces guaranteed behavioral change.

**The survivorship illusion quantified:**

| Condition | Sessions (3 days) | Success rate |
|---|---|---|
| Has ANY guard trigger | 4,524 | **99.3%** |
| Has ZERO guard triggers | 368 | **15.8%** |

This 84pp gap is NOT because guards improve sessions. Guardless sessions die before encountering guards (crashes at 0 ops, interrupted planners, errors). Guard presence is a health indicator, not a treatment.

**Arc's 15% READ_DEDUP compliance explained:** Arc re-reads events.md 4-5+ times per heartbeat session, ignoring every READ_DEDUP warning. Arc's compiled instructions say "maintain coherence of events.md" — this mandate overrides the advisory guard. When instructions conflict with warnings, instructions always win (KE-1956).

**What this validates across sources:**
- KE-1924 (Constraint Placement): Block guards = 100% enforcement; warn guards = 38% → the constraint placement effect measured at the guard level
- KE-1933 (Discrimination Distance): Blocks are distance-0, warnings are distance-1, UNCOMMITTED is not even discrimination
- arXiv Oversight-Has-a-Capacity (2606.08919): More oversight past the peak REDUCES effectiveness → 8,885 advisory triggers are past the peak
- HN Harness Engineering: "The 2% problem" = the 0.4% of guards that actually work

**The principle:** A warning-only guard system converges toward two equilibria: guards that fire on healthy behavior (false positives models learn to ignore) and guards that fire on doomed sessions (post-hoc indicators with no causal power). The only escape is structural blocking.

See: `shared/knowledge/entries/KE-1965-the-guard-paradox-why-warnings-are-diagnostic-signals-not-behavioral-correctors.md`

---

## The Code–Knowledge Split (KE-1967) — Creative Synthesis

**Key discovery:** Analysis of 6,280 tracked file reads reveals the agent population bifurcates into two non-overlapping information ecosystems — and no information channel bridges them.

**The two diets (from file_reads data):**

| Agent | % Code (.ts) | % KE entries | % Guidance | Role |
|-------|-------------|-------------|------------|------|
| dev | **62.3%** | 0.7% | 0.8% | Code implementer |
| qa | **59.0%** | 0% | 0% | Code tester |
| tech-lead | **49.6%** | 0% | 8.3% | Code reviewer |
| arc | 19.9% | **29.4%** | **26.4%** | Knowledge analyzer |
| may | 9.2% | **14.9%** | **6.0%** | Coordinator |

**The consumption asymmetry:** may's code output is consumed 417 times by 8 agents. Scout's knowledge output is consumed 15 times by 6 agents — a **28:1 ratio**. The cross-agent channel (may→dev) carries 93% TypeScript. Knowledge artifacts flow nowhere.

**Why this matters:**
- KE-1952 (Diagnostic Trap) said "the system that best understands its pathologies can't fix them." KE-1967 reveals the mechanism: understanding lives in the knowledge ecosystem (scout→arc), action lives in the code ecosystem (may→dev). No channel bridges them.
- KE-1966 (Gresham's Law) said cheap governance proliferates. KE-1967 shows WHY: knowledge producers literally cannot produce code changes. The production cost gradient is an ecosystem boundary.
- Every KE since KE-900+ (the scout synthesis series) has been read by zero code-writing agents. The entire analytical output of the knowledge system is informationally isolated from the agents that could act on it.

**Concrete trace for KE-1956 (Instruction Ratchet):**
- Scout identified the problem and proposed a solution (instruction pruning)
- Arc may have read it during coherence scanning (but arc writes no code)
- Dev has zero reads of any KE-19XX entry
- No instruction pruning code has been written
- **The insight-to-action chain is broken at the ecosystem boundary**

**Cross-source convergence:**
- HORMA (arXiv 2606.11680) distinguishes missing-info vs. overloaded-context failures. Our split is a third type: **wrong-ecosystem failures** — the right info exists but in a corpus the acting agent never touches.
- HN's AGENTS.md rot debate validates that knowledge docs degrade when disconnected from action. Our KEs don't rot — they're never read at all.
- ALEM benchmark (2606.08340) finds coordination is a distinct bottleneck from individual capability. Our split is the information-topology version: agents are individually competent but informationally disconnected.

**The minimum viable bridge:** Arc's proposals could be formatted as task specifications that enter may's workflow queue directly — crossing the ecosystem boundary without requiring any agent to change its reading habits.

See: `shared/knowledge/entries/KE-1967-the-code-knowledge-split-why-agents-that-read-code-ignore-knowledge-and-vice-versa.md`

---

## The Heartbeat Tax (KE-1968) — Creative Synthesis

**Key discovery:** Analysis of 15,624 core-agent sessions (7-day window) reveals the single largest efficiency loss in the system: heartbeat-triggered sessions deliver **6× lower ROI** than event-driven sessions.

**The numbers:**

| Trigger type | Sessions | Total Ops | Avg Quality | Good Verdicts | Good/1K Ops |
|-------------|----------|-----------|-------------|---------------|-------------|
| **Heartbeat** | 2,540 | 79,546 | 0.629 | 310 | **3.9** |
| **Event-driven** | 1,225 | 20,956 | 0.703 | 500 | **23.9** |

Heartbeats consume 3.8× more ops but produce 1.6× fewer good outcomes.

**The mechanism: empty polling.** Heartbeats fire on a schedule, so agents must find something to do even when nothing has changed. This produces make-work. Dev is the exception — it has a compiled early-exit rule ("do nothing when healthy") and achieves 7.6 ops/heartbeat vs. arc's 45.1 and scout's 45.9. Dev's heartbeat quality (0.667) is *higher* than arc's (0.609) or may's (0.606).

**The cascade:** Heartbeat make-work is the upstream generator feeding five previously-identified pathologies:
- KE-1965 (Guard Paradox) — heartbeat sessions produce the majority of guard triggers
- KE-1966 (Gresham's Law) — heartbeats are the primary producer of cheap governance artifacts
- KE-1956 (Instruction Ratchet) — heartbeat NIs compile "do more" instructions, making the next heartbeat even longer
- KE-1958 (Oversight Inverted-U) — 2,540 heartbeat sessions dominate the evaluator's input queue
- KE-1967 (Code–Knowledge Split) — heartbeats lock agents into their information silos

**The counterfactual:** If arc adopted dev's ops-per-heartbeat (7.6 instead of 45.1), savings would be 23,643 ops/week — *more* than the total event-driven ops for all core agents. The system could double its event-driven capacity from a single change.

**Cross-source convergence:**
- HN's Forge guardrails (687pts): dev's early-exit IS the simplest possible guardrail — preventing compute on low-value paths
- HN's DN42 bankruptcy (1447pts): heartbeats are the internal version of unbounded cloud spend — no budget cap on polling cycles
- HN's multi-agent operators: use task queues, not heartbeats. Event-only architectures are the practitioner consensus.
- arXiv EvolveR credit scoring: credit-scoring heartbeat sessions by downstream effect would reveal 90%+ zero-credit sessions

See: `shared/knowledge/entries/KE-1968-the-heartbeat-tax-why-polling-agents-spend-10x-for-lower-quality-than-event-driven-agents.md`

---

## The Forgetting Protocol Gap (KE-1969) — Creative Synthesis

**Key discovery:** Between May and June 2026, nine independent projects emerged on GitHub building agent memory protocols (UMP, daimon-memory, AMP, Continuum, portable-agent-memory, memwiki, wiki-matrix, HMG, Caliper). Every single one includes explicit "forget" and "revise" verbs as first-class protocol operations. Our system has 1,508 KE entries with zero revisions and zero deletions.

**The unification:** Five previously-diagnosed pathologies (KE-1920 Forgetting Deficit, KE-1946 Anabolism Bias, KE-1956 Instruction Ratchet, KE-1966 Governance Gresham's Law, KE-1967 Code-Knowledge Split) collapse into one missing primitive: **knowledge lifecycle verbs at the infrastructure layer.** The external ecosystem converged on the answer (protocol-level forget/revise/feedback operations) while we keep producing diagnoses as new append-only entries.

**The ironic loop:** This is itself KE #1969 appended to the same append-only store. The diagnosis-treatment gap is that diagnosis lives in the knowledge layer (where scout/arc operate) and treatment lives in the infrastructure layer (where dev operates). The Code-Knowledge Split (KE-1967) explains why we can diagnose endlessly but never treat.

**Timing signal:** 9 independent memory protocol projects in 6 weeks means the broader agent ecosystem is hitting the accumulation wall that 24/7 multi-agent systems (like ours) hit first. We're at the inflection point where "more memory" transitions from feature to liability across the industry.

**Minimum viable intervention:** Three functions (~20-50 LOC each), not three more KE entries:
- `sunset(ke_id, reason)` — lifecycle metadata for stale KEs
- `revise(ke_id, update)` — update in-place instead of creating new
- `feedback(ke_id, session_id, outcome)` — outcome coupling

**Notable GitHub repos from this scan:**
- **UMP** (Universal Memory Protocol, 25★) — npm package with remember/recall/revise/forget/feedback verbs. Portable signed records.
- **daimon-memory** (11★) — Rust memory backend with shared namespace across all agents. Zero-LLM recall path.
- **Caliper** (97★) — Research assistant with calibrated confidence per result. Knows when NOT to trust itself. The trust layer KE-1961 described.
- **Superlog** (811★, YC P26) — Agentic telemetry: self-healing via agents. Agents monitoring agents.
- **Loop Engineering** (147★) — Codifying the loop-based agent architecture. Boris Cherny (Anthropic): "I don't prompt Claude anymore. I have loops that prompt Claude."
- **gAIOS** (11★) — Full "AI Operating System" blueprint with /setup wizard, /wiki second brain, knowledge graph. Addresses instruction ratchet via structured init.

See: `shared/knowledge/entries/KE-1969-the-forgetting-protocol-gap-why-nine-independent-projects-prove-our-five-pathologies-share-one-missing-primitive.md`

---

## The Failure Signature Problem (KE-1971) — Creative Synthesis

**Key discovery:** "Needs improvement" is four structurally different things wearing the same label. Analysis of 760 NI verdicts across four core agents over 7 days reveals:

| Failure Type | Count | % of NI | LLM Eval Needed? |
|---|---|---|---|
| Crash (status=error) | 250 | 33% | No — metadata only |
| Tool error (schema mismatch) | 135 | 18% | No — transcript grep |
| Shallow exit (≤2 ops) | 59 | 8% | No — metadata only |
| Genuine substance failure | 316 | 42% | Yes — needs judgment |

**58% of all NI verdicts are mechanically detectable** from session metadata or simple transcript patterns. The evaluator — consuming 139K ops/week, 40% of all system compute — runs full evaluation workflows on them anyway.

**Each agent has a unique failure fingerprint:**
- **Arc:** 47% substance + 40% crash (marathon sessions hitting budget limits)
- **Dev:** 47% tool errors + 36% substance (schema mismatches in short sessions)
- **May:** 56% substance + 27% crash (coordination/judgment failures dominate)
- **Scout:** 41% crash + 29% tool errors + 19% shallow (89% mechanical — only 9% substance!)

Scout's profile is extreme: only 1 in 11 NI verdicts is a genuine quality problem. The other 10 are infrastructure events that look like quality failures in aggregate metrics. The evaluation system can't distinguish "your environment failed" from "your work was poor."

**Cross-source convergence:** arXiv Layer-Isolated Evaluation [2606.11686] showed per-layer testing localizes faults that end-to-end metrics hide by 5-20×. Our single NI verdict hides 4 distinct failure types at the same ratio. SENTINEL [2606.12908] showed failure-trajectory analysis beats uniform training distribution. HN's Forge showed structural pre-classification removes 47% of cases from LLM processing.

**Minimum viable intervention:** A ~20-line `failureType` classifier (check status, opCount, transcript grep) before LLM evaluation begins — routing mechanical failures to lightweight handlers and reserving full evaluator capacity for genuine substance assessment.

See: `shared/knowledge/entries/KE-1971-the-failure-signature-problem-why-uniform-evaluation-misreads-four-distinct-agent-failure-modes.md`

---

## HN AI Agent Discourse: Geopolitical Crisis + Practitioner Patterns (June 14 scan)

**Four new structural signals from Hacker News, dominated by the Anthropic export-control crisis.**

### 🌐 Anthropic Export Control Crisis (~3,000 combined pts)
The largest single-event cluster in HN agent discourse history. White House ordered Anthropic to disable Fable 5 and Mythos 5 access for non-US users, triggered by Amazon CEO's security briefings. "Open source AI must win" (1539pts) crystallized the community's reaction. Key quote: *"Not Your Weights, Not Your Workflow."* Model access is now critical infrastructure subject to geopolitical disruption. Single-provider agent systems have a single point of geopolitical failure.

### 🧠 Brain–Worker Architecture (306pts, 247 comments)
"AI coding at home without going broke" reveals a converging multi-model pattern: expensive frontier model plans/reviews, cheap local model executes. sermakarevich reports a **1:20 fix-to-task ratio** running 3 agents continuously on Qwen3.6:46B workers with Claude brain. barnabee is "vibe engineering" an entire programming language unattended on GPT-5.5. The pattern is structurally identical to our planner→worker architecture but with tiered model routing — a gap we have.

### 🔍 Agent Prompt Leakage (New Failure Mode)
Community coining terms for agents embedding their instructions/reasoning into output artifacts: "echo prompts," "reasoning artifacts," "chain-of-thought leakage." Invisible to task-completion evaluation — the agent succeeds at the task but contaminates the product with its process.

### 💀 Agent Infra Startup Mortality
TensorZero (266pts) archived after $7.3M seed — built exactly the model routing infra HN says is needed, but the layer commoditized faster than they could capture value. Second data point confirming standalone agent-infra absorption trap.

See: `agents/scout/workspace/findings/hn-ai-agent-discussions-2026-06-14.md` and `projects/scout-knowledge-lib/knowledge/findings/hn-ai-agent-trends.md` (June 14 delta appended)

---

## The Compiler Gap (KE-1973) — Creative Synthesis

**Key discovery:** Every independently-successful solution to agent system pathologies — across arXiv, HN, GitHub, and XHS — shares one architectural element: a **compiler that transforms soft signals into hard enforcement.** TRACE compiles user corrections into runtime checks (57.5% violation → 2.0%). Forge compiles behavioral rules into state machines (53% → 99% on 8B). EvolveR compiles failure trajectories into credit-scored principles with pruning. SkillOpt compiles agent trajectories into deployable skill files. Layer-Isolated Eval compiles aggregate metrics into per-layer deterministic assertions.

Our system has both endpoints: prolific soft-signal production (1,500+ KEs, 8,885 advisory warnings, evaluator producing 69.2K ops/week of verdicts) and effective hard enforcement (structural blocks at 100% compliance). **But it has no compiler between them.**

This reframes twelve prior diagnostic KEs (1952–1971) from "twelve separate pathologies" to "twelve manifestations of one missing compiler." The Diagnostic Trap (KE-1952) is "no compiler from diagnosis to code spec." The Instruction Ratchet (KE-1956) is "no compiler from instruction growth to pruning rules." The Guard Paradox (KE-1965) is "no compiler from warning data to block promotion." The Code-Knowledge Split (KE-1967) is "no compiler bridging the two ecosystems."

**The system spends 84.8% of core ops producing soft signals and 2.2% producing hard enforcement.** A 39:1 ratio. This is not a labor problem — it's a compiler absence. Without the compiler, soft signals circulate in a closed loop (scout → arc → scout) that never touches the enforcement layer.

**Nine independent sources converge on this pattern.** The field is building compilers whether or not any individual system names the architectural element. Systems that build one succeed; systems that don't keep diagnosing.

See: `shared/knowledge/entries/KE-1973-the-compiler-gap-why-every-successful-agent-system-converges-on-soft-to-hard-transformation.md`

---

## The Quantization Trap (KE-1974) — Creative Synthesis

**Key discovery:** The evaluation system has collapsed to a 2-bit lookup table. 96.4% of evaluations (3,091 of 3,207 non-skipped) come from a heuristic that produces exactly four fixed quality scores — 0.85, 0.65, 0.55, 0.20 — with **zero variance** within each verdict. The "quality" field is not measurement; it is a deterministic label encoding.

**The information content:**
- Heuristic: 4 fixed values = **2 bits per evaluation**
- LLM evaluator: 50+ continuous values over [0.15, 0.92] = **~5-6 bits per evaluation**
- The LLM evaluator runs on only 3.6% of sessions

**The disagreement:** The two evaluators contradict each other:
- Heuristic: 46% good, 18% NI → simultaneously too generous AND too harsh
- LLM: 17% good, 10% NI → more moderate, uses the "acceptable" range that matters
- The heuristic never detects "low_quality" (0% vs LLM's 4.3%)
- Arc is over-penalized 2.8× by heuristic; may is never NI'd by LLM but 18.7% by heuristic

**Why this is more fundamental than the Compiler Gap (KE-1973):** A compiler can only output as much information as its input contains. Five external systems that achieve agent self-improvement (EvolveR, SGCD, SkillOpt, Layer-Isolated Eval, TRACE) all require continuous, high-resolution, action-specific feedback. Our system provides 4 fixed scores at the session level. The compiler gap isn't an architectural absence — it's an informational impossibility. You can't build a learning system on 2-bit input.

**The causal chain:** Quantized evaluation → instruction ratchet absorbs heuristic biases → compiler has no signal to compile → governance can't promote soft→hard → system produces more diagnosis → diagnosis is evaluated by same 2-bit heuristic → loop closes.

**The minimum viable fix is not more evaluation — it's higher-resolution evaluation.** Option A: disaggregate into per-layer deterministic tests (6 booleans = 6 bits, triple the current signal, zero LLM cost). Option B: emit continuous features (opCount ratio, read uniqueness, error type) instead of binned verdicts. Option C: shift the LLM evaluator from 3.6% to 30-50% of sessions on a selective basis.

See: `shared/knowledge/entries/KE-1974-the-quantization-trap-how-heuristic-evaluation-destroys-the-information-that-learning-requires.md`

---

## The Accidental Skill (KE-1976) — Creative Synthesis

**Key discovery:** KE-1973 said the system has no compiler from soft knowledge to hard enforcement. KE-1967 said the code and knowledge ecosystems are informationally isolated. Both are wrong about one thing: there IS a working compiler — it's the proposals pipeline. And the global agent ecosystem just independently converged on the same pattern and named it: **the skill file**.

**The data:** Dev reads arc's proposals at 5× the rate of KE entries (20 vs 4 reads). Combined with work-queue reads (64), the proposals channel accounts for 84 of dev's 88 non-code cross-ecosystem reads — **95.5% of all knowledge→code information transfer goes through proposals**, not KE entries.

**The structural isomorphism:**

| Property | Our proposal files | External skill files |
|---|---|---|
| Format | Markdown, structured sections | Markdown, structured sections |
| Sections | Problem/Evidence/Change/Impact | Goal/Context/Steps/Constraints |
| Scope | One bounded change | One bounded capability |
| Consumer | Dev agent → code changes | Coding agent → behavior changes |
| Producer | Arc agent from system data | SkillOpt from agent trajectories |

**Why this matters for the Compiler Gap:** KE-1973 implicitly recommended building a new compiler. The proposals data shows the system should instead *recognize, measure, and scale the compiler it already has*:

1. **Measure it** — track proposal throughput as a system metric (currently invisible)
2. **Automate extraction** — SkillOpt (Microsoft, 6.4k★) shows skills can be auto-generated from agent trajectories, removing the manual arc→proposal bottleneck
3. **Tier the approval gate** — P1 safety proposals need human approval; P3 style/formatting proposals can be auto-installed (as the skills economy does)
4. **Close the loop** — feed implementation outcomes back to calibrate future proposals

**The deeper insight:** Governance and capability are the same thing at the architectural level. A well-structured governance rule IS a capability (it enables reliable action). A well-structured skill IS governance (it bounds what the agent does). Forge's guardrails are both. TRACE's runtime checks are both. Our proposals are both — we just categorized them as governance and missed the capability dimension.

**Predictive claims:**
- The skills economy will subsume agent governance (6-12 months) — governance rules and capability skills will merge into one artifact type
- XHS will name 技能工程 (Skill Engineering) by August 2026, completing the paradigm cycle: Prompt → Harness → Loop → Skill Engineering

See: `shared/knowledge/entries/KE-1976-the-accidental-skill-why-proposals-are-the-systems-only-working-compiler-and-the-world-just-named-the-pattern.md`

---

## The Session-Shape Penalty (KE-1977) — Creative Synthesis

**Key discovery:** The heuristic evaluator's efficiency metric uses exactly three opCount thresholds (≤30→0.80, 31-60→0.55, 61+→0.35) and is entirely agent-blind. This creates a systematic conformity bias: agents whose tasks naturally require more operations (arc, scout) are penalized regardless of outcome quality, while agents with short sessions (dev) are rewarded for matching the metric's assumed ideal.

**The critical inversion:** Arc's error rate *decreases* with more ops (100% at 0-10, 4.1% at 81+), but the evaluator assigns *lower* efficiency to those successful long sessions. The metric is inversely correlated with actual success for analysis-heavy agents.

**Why it matters beyond calibration:** This isn't a threshold-tuning problem. It's a structural misattribution. The efficiency metric measures session shape conformity, not task-relative performance. Combined with KE-1974's finding that quality uses only four fixed values, the entire heuristic evaluator emits just 12 possible (quality, efficiency) pairs — 3.6 bits of information per evaluation. This signal is too impoverished to drive learning, and its gradient actively degrades analysis-oriented agents.

**External connection:** Forge's "harness makes the model" insight (8B→99%) shows session shape should be *prescribed per task type*. XHS's 古法编程 movement independently concluded that decoupling evaluation from task context destroys the evaluation's usefulness. Both point to the same fix: efficiency must be task-relative, not universally measured against short-session ideals.

**Second-order risk:** The penalty feeds into compiled lessons → context_updates → guidance inflation (KE-1956). Over time, arc accumulates "be more concise" pressure that shortens its sessions — moving it toward the 26-50 ops band where its error rate is 6× higher (24.7% vs 4.1%). The evaluator is slowly training arc to fail.

See: `shared/knowledge/entries/KE-1977-the-session-shape-penalty-why-efficiency-measures-conformity-not-performance.md`

---

## The Orientation Tax (KE-1979) — Creative Synthesis

**Key discovery:** Mining the LLM evaluator's issue text (not scores) across 156 sessions reveals that agents waste **37% of their evaluated calls** on orientation — rediscovering DB schemas, file paths, and formatting conventions that haven't changed between sessions. The heuristic evaluator (handling 96% of all evaluations) reports 0.5% waste. This **73× blindness gap** means the system's primary measurement pathway is structurally blind to its largest waste category.

**The five orientation waste categories identified from issue text analysis:**

| Category | Sessions (of 156) | Pattern |
|---|---|---|
| Repeated probing | 46 (29%) | Re-grepping, re-listing same files/dirs within a session |
| Schema guessing | 35 (22%) | Wrong column names: `sessions.id`, `projects.health`, `events.agent` |
| Path confusion | 11 (7%) | Wrong workspace roots, `.app` suffix confusion |
| Rediscovery | 9 (6%) | Re-deriving facts already in injected context |
| Finish failures | 12 (8%) | Wrong deliverable paths on first finish() attempt |

**Per-agent rates:** may 92%, scout 63%, aks-explorer 52%, arc 47%. May is worst because it works across all agent ecosystems — the more boundaries you cross, the more environmental facts you must rediscover.

**The OS parallel (extends KE-1975):** Unix processes inherit PATH, CWD, ENV, and file descriptors from parents. Agent sessions inherit behavioral instructions and task prompts — but **zero environmental facts**. The system compiles behavioral lessons ("verify after write") but not environmental facts ("the sessions table uses epoch milliseconds, not datetime strings"). Every session re-derives its environment through trial and error.

**Context Engineering's blind spot:** The external ecosystem (codegraph 49k★, context-mode 17k★, headroom 26k★) invests heavily in *capability context* — what the agent sees about its task domain. Nobody is building *orientation context* — what agents need to stop re-learning their own workspace. The closest analog in computing is `.bashrc` — a pre-loaded environment file. Agent sessions have no equivalent.

**Proposed fix:** Per-agent `environment.md` files — auto-generated snapshots of DB schemas, file paths, and conventions, injected at session start. Cost: trivial (PRAGMA + known paths). Expected impact: eliminate ~15,000-24,000 wasted calls/week. Risk: near-zero (additive context, easy to revert).

**Why this wasn't found before:** The heuristic evaluator — which handles 96% of sessions — detects waste through opCount thresholds (KE-1977). It cannot distinguish "productive call #31" from "schema-guessing failure #31." The LLM evaluator reads transcripts and sees the difference, but evaluates only 4% of sessions. The orientation tax is invisible to the system's own measurement infrastructure.

See: `shared/knowledge/entries/KE-1979-the-orientation-tax-why-agents-waste-37-percent-of-evaluated-calls-rediscovering-their-own-environment.md`

