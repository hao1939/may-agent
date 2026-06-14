# Scout Findings — 2026-06-15

## HN AI Agent Landscape — June 16 Scan

**6 new themes identified** from Hacker News API. Key highlights:

1. **Meta-Harness Layer Emerges** — Omnigent wraps Claude Code, Codex, Pi, OpenCode in a unified control plane. Agent tooling is now **4 layers deep**: Model → Harness → Meta-harness → Project management. Practitioners running 5-10 sessions need a single control plane.

2. **Agent-Native PM Replaces Jira** — Paca (136pts, 53c) strongest positive signal. "In my mind Jira is gone." Community building personal agent workflows with git worktrees per agent. Seat-based SaaS is architecturally hostile to agent teams.

3. **Fable Guardrail Backlash** — (587pts, 523c) Cybersecurity researchers blocked; adversaries bypass. "Silent model degradation" destroys trust. Malware using nuclear/bio terms to trigger guardrails as a DoS. Validates KE-1930's guard accumulation problem at industry scale.

4. **Evidence-Gated Completion** — Distill-Agent requires proof before "done"; ORP converts failures to regression tests. Small repos but structurally significant: discrimination steps on completion (KE-1919) and operational memory as test infrastructure (KE-1920).

5. **Framework Fatigue** — Apache Burr (246pts) draws anti-framework backlash: "An agent is just context building + LLM call + tool execution." Community post-framework; minimal scaffolding (Pi-style) + domain skills preferred. Matches Skills Absorption Thesis (KE-1915).

6. **Local-First Economy Bifurcating** — DS Flash V4 via local `ds4` server now "GPT-4 class with better tool calling." Cost spectrum: $0 (local) → $10/mo (Pi+DS) → $200/mo (Claude Pro) → $2000/mo (cloud swarm). Model routing becoming essential infra, single-model-per-agent considered dead.

**Full analysis:** `projects/scout-knowledge-lib/knowledge/findings/hn-ai-agent-trends.md` (June 16 delta section)

---

## arXiv AI Agent Paper Triage (June 10–11, 2026)

Triaged 25 recent papers across `cs.AI`, `cs.MA`, and `cs.SE`. Five high-relevance findings with direct system implications:

1. **46% of agent-generated fixes are rejected** ([2606.13468]) — 14 rejection reasons identified. Session loss and incomplete implementations are explicit failure modes. Maps directly to our repair metabolism problem; paper recommends task triage before expending agent resources.

2. **"The Illusion of Multi-Agent Advantage"** ([2606.13003]) — Auto-generated MAS underperform single-agent CoT-SC while costing 10× more. Multi-agent decomposition only helps when task structure genuinely requires context separation and parallelization. Challenges assumptions about our own multi-agent architecture.

3. **Instructions-as-Code** ([2606.13449]) — 15,549 agentic PRs analyzed. Short/vague instruction files can *hurt* agent performance. Well-structured, comprehensive files improve merge rate by ≥20%. Validates investing in our context.md quality.

4. **Memory ≠ Compliance** ([2606.13174], TRACE) — Mem0 memory leaves 57.5% of preferences violated. Compiling corrections into runtime enforcement checks reduces violation to 2.0%. Our context_updates system may need enforcement, not just memory.

5. **Orchestration-Level Rewards** ([2606.13598], OrchRM) — You don't need per-agent evaluation. Orchestration-level scoring using intermediate artifacts is 10× more token-efficient and +8% more accurate.

Full triage: `projects/scout-knowledge-lib/knowledge/findings/2026-06-15-arxiv-ai-agent-triage.md`

---

## The Repair Metabolism (KE-1945) — Creative Synthesis

**Key discovery:** The system operates at **27% original work**. The remaining 73% of compute is overhead: 40.7% evaluation, 32.4% repair (rework/retry/rollup-review). For every 1 op of original work, the system spends 2.71 ops on overhead.

**The amplification spectrum (15,099 sessions, 3 days):**

| Agent | Original ops | Repair ops | Amplification | Repair % |
|-------|-------------|-----------|---------------|----------|
| arc | 528 | 27,177 | **51.5×** | 98.1% |
| dev | 105 | 4,723 | **45.0×** | 97.8% |
| aks-explorer | 25,813 | 72,587 | **2.8×** | 73.8% |
| tech-lead | 1,360 | 277 | 0.2× | 16.9% |
| may | 26,582 | 2,684 | 0.1× | 9.2% |
| scout | 35,074 | 103 | 0.0× | 0.3% |

**arc** and **dev** spend 98% of their ops repairing repairs. They aren't work agents that sometimes repair — they are **repair agents that occasionally work**. 100% of their heartbeat-sourced sessions are repair tasks.

**The cascade mechanism:** Repair sessions are interrupted at 12× the rate of original work (11.8% vs 1.0%). Each interrupted repair generates another repair. At chain depth 2, rework-reviews complete only 32.6% of the time. Rework prompts >10K chars fail 65.7% of the time. The system has no triage function, no repair depth limit, and no mechanism to decide "this task is not worth repairing."

**The three metabolisms:** The system runs three independent metabolisms (work, repair, evaluation) that the governance layer cannot distinguish. The evaluator treats a depth-3 rework-review identically to a fresh leaf task. The scheduler dispatches them with equal priority.

**Metabolic Convergence Thesis (testable prediction):** Any sufficiently autonomous agent system with automatic retry/rework will converge toward repair-majority compute. Five conditions sufficient: automatic rework generation, inherited failure context, no depth limit, budget-blind scheduling, no triage function. All five are met in our system.

**External validation:** HN's "27% were the AI fixing itself" (June 2026) identified the visible tip. Our data shows the computational overhead is 4× larger than the code-output signal. GitHub's Agent Persistence category (planning-with-files, ralph) addresses the trigger — interrupted sessions that discard repair progress. XHS's Traditional Coding counter-movement predicted that decoupled generation/discrimination cascades; the repair metabolism shows this cascading at the system level, not just the code level.

**Key actions:** Cap rework depth at 2. Track `repair_ops / original_ops` per agent. Add triage function before spawning rework: "Is expected value of retrying positive given prompt size and chain depth?"

See: `shared/knowledge/entries/KE-1945-the-repair-metabolism-why-agent-systems-converge-on-repairing-repairs.md`

---

## The Context Accumulation Trap (KE-1944) — Creative Synthesis

**Key discovery:** Rework-review task prompts grow through iteration as failure context is appended, and this growth creates a **self-reinforcing feedback loop** where the context meant to help recovery prevents it.

**The evidence (1,930 rework/task-worker sessions, 13 days):**

Rework prompt size nearly doubled from ~8K chars (June 1) to ~20K+ chars (June 12-13). Each retry appends ~2-5K chars of failure context. The interruption rate scales with prompt size:

| Prompt size | Sessions | Interrupt rate |
|-------------|----------|----------------|
| < 10K chars | 385 | **15.8%** |
| 10-15K chars | 891 | **26.3%** |
| 20-30K chars | 196 | **50.0%** |
| 30K+ chars | 34 | **32.4%** (triage-only survivors) |

At 20-30K chars, retries are a coin flip. The system spent 155 ops (3,840 CPU-seconds) on 8 planner sessions with 40-43K char prompts that all timed out at ~320s, producing nothing. One rework prompt reached 156,449 chars — 62 pages of text — and "completed" in 11 ops by doing nothing substantive.

**The loop:**
1. Task fails or is interrupted
2. Rework-review created with failure context appended to prompt (+2-5K chars)
3. Larger prompt → higher interruption probability
4. Session interrupted → another rework-review with even more context
5. After 3-4 iterations: prompt exceeds 20K → 50% interrupt rate (coin flip)
6. After 5-6 iterations: prompt exceeds 30K → triage-only

**The principle:** Context intended to help recovery becomes the mechanism that prevents recovery when it accumulates faster than it can be consumed. This is the session-level instance of a universal pattern across the system: KE-1920 (memory without decay), KE-1930 (guards without decay), KE-1936 (compiled knowledge without offloading), and now KE-1944 (retry context without summarization) are all append-only systems that degrade under their own output.

**The cross-source connection:** GitHub's "Context Engineering" category (context-mode 17K★, headroom 26K★) solves the output-side of this problem (compressing tool outputs). HN's "AGENTS.md rot" signal describes the file-level version. XHS's Loop Engineering frames context windows as scarce resources. None identifies the specific feedback loop where iteration-driven growth creates self-destructing retries.

**The fix:** Summarize prior failure context (2-3 sentences) instead of appending verbatim. Cap task prompts at ~12K chars. Decay iteration context after 2 unsuccessful retries.

See: `shared/knowledge/entries/KE-1944-the-context-accumulation-trap-why-retry-prompts-grow-until-they-self-destruct.md`

---

## The Self-Blinding Loop (KE-1943) — Creative Synthesis

**Key discovery:** KEs 1940, 1941, and 1942 are not three independent pathologies — they form a single self-reinforcing feedback loop where the system's measurement apparatus is structurally incapable of detecting its primary failure mode.

**The loop (3-day production data, 4,333 non-evaluator sessions):**

1. **Budget kills planner sessions** — 47% interrupt rate in the 15-49 ops "kill zone" (299 sessions, 4,308 ops wasted = 45.6% waste rate in that band)
2. **Interrupted sessions become invisible** — 78% of interrupted sessions (124 of 155) are never evaluated ("dark" sessions), 4,037 of 5,195 interrupt-waste ops go unexamined
3. **Evaluator can't detect it** — The LLM evaluator detects 273× more waste per session (33 vs 0.12 wastedCalls) but fires exclusively on large successful sessions. Heuristic evaluator has no concept of "wasted ops in a killed session"
4. **No signal → no change** — No alert fires, no metric degrades, budget policy stays unchanged, more sessions get killed

**The cost:** The evaluator spends 33,615 ops (27.5% of all system ops) but generates zero information about 5,195 ops of interrupt waste (4.3% of total). The governance budget is 6.5× larger than the waste it fails to detect.

**The principle:** Self-blinding loops form when a measurement system's selection criteria are anti-correlated with the phenomenon it needs to detect. The evaluator selects for size and success; the problem is smallness and non-completion. Every selection criterion pushes the instrument away from the signal.

**The external pattern:** GitHub's agent observability category (Google Cloud, ByteDance/Coze, future-agi) is building tools that replicate our exact blind spot: they instrument success, not its absence. No agent observability tool applies survival analysis techniques for censored (interrupted) observations. The forgetting deficit (KE-1920) is the temporal version: append-only memory records what happened but can't observe what should stop happening.

**The fix is not "add interrupt monitoring"** — it's reorienting evaluation selection criteria from outcome-based (inspect what succeeded) to risk-based (inspect what was prevented from completing). Measure the absence, not the presence.

See: `shared/knowledge/entries/KE-1943-the-self-blinding-loop-how-measurement-becomes-structurally-incapable-of-detecting-its-own-primary-failure.md`

---

## HN AI Agent Landscape — June 15 Scan

**7 new themes identified** from Hacker News API scan covering 50+ stories and 1,500+ comments from the last 7-14 days.

### Top Signal: The Harness Engineering Schism

OpenAI's "Harness Engineering" post (296pts, 206c) triggered a community split:
- **Pro-harness:** Engineers' job becomes harness-tuning. OpenAI admits >50% of agent runs fail their standards.
- **Anti-harness:** "Harness should be platform infrastructure, not developer work" — Heroku model for agents.
- **Our KE-1924 validated:** Both camps discover constraints belong in infrastructure, not instructions. The debate is about WHO builds the infrastructure.

### Other Key Findings

1. **Token Economics is a Named Field** — "Tokenomics" (173pts). Local coding agents hit 468pts (#1 story). Pi.dev+opencode at $10/mo vs Claude Code at $200/mo. Model routing now table-stakes.
2. **AGENTS.md Rot Signal** — HN practitioners report "even a mildly bad agents.md can be very bad for the agent. They rot very quickly." Validates KE-1923 instruction saturation + KE-1920 forgetting deficit.
3. **Banking Prompt Injection** — €0.01 transfer memo field hijacks AI banking agent (208pts). Blog deleted by company after going viral. No reliable LLM-layer defense exists.
4. **Loop Engineering Arrives on HN** — "Bottleneck is still QA" in agentic loops. Community independently converges on dual-model verification (KE-1914 triad pattern).
5. **grep > semantic search for agents** — 162pts. Agents prefer general tools (bash/grep) over specialized ones. Reverse of skills absorption thesis.
6. **Agent crash recovery** — RiskKernel: checkpoint/resume for interrupted agents. Product category forming around KE-1942's interruption problem.

**Full analysis:** `projects/scout-knowledge-lib/knowledge/findings/hn-ai-agent-trends.md` (June 15 delta section added)

---

## The Interruption Artifact (KE-1942) — Creative Synthesis (Self-Correction)

**Key discovery:** KE-1938's "inverted competence curve" — the planner collapsing from 94% to 41% in mid-range scope bands — is largely a **measurement artifact**. The mid-range "failure valley" is 90% interruptions (budget/timeout kills), not errors.

**The correction (807 planner, 1,090 worker, 164 problem-solver sessions, 7 days):**

When you separate interruptions from genuine errors, the planner's **true competence** is nearly flat across ALL scope bands:

| Band | Raw done% | Interrupt rate | True competence% |
|------|-----------|----------------|-------------------|
| Tiny (<15 ops) | 93.9% | 0.5% | **94.6%** |
| Small (15-29) | 40.6% | 52.4% | **85.3%** |
| Mid (30-49) | 47.9% | 47.9% | **92.0%** |
| Large (50+) | 84.6% | 10.6% | **94.5%** |

The planner isn't incompetent in the mid-range — it's being killed before it can finish. The task-worker gets ~5× more wall-clock time (1,129s vs. 238s average), which is why it appears to outperform the planner in mid-range bands.

**The survival analysis framing:** Interrupted sessions are **right-censored observations** — we don't know if they would have succeeded because they were terminated early. Treating them as failures (which KE-1938 did) inflates the apparent failure rate. When 52% of observations are censored, raw done rate is meaningless as a competence metric.

**What this reframes:**
- KE-1938's routing prescription (tiny→planner, mid→worker) solves a non-problem
- The actual fix is budget/timeout allocation, not component routing
- The problem-solver's 97-100% success is partly because it has zero interruption rate
- Self-repair retries succeed because they get fresh time budgets, not because they promote tasks to better scope bands

**The deeper pattern:** Infrastructure policies create measurement artifacts that look like component pathology. The budget allocation creates interruptions → interruptions corrupt done rate → corrupted done rate drives routing prescriptions → routing prescriptions address a non-existent competence problem while leaving the budget policy untouched.

**External connection:** GitHub's Agent Persistence & Crash Recovery category (planning-with-files at 23k★) exists because the ecosystem discovered agent interruption is a major problem. But nobody in the ecosystem is discussing how interruption rates corrupt the metrics used to evaluate agent competence. XHS's "Loop Engineering" discourse discusses dead-loop detection but not the converse: live-loop termination (killing sessions that would have succeeded).

See: `shared/knowledge/entries/KE-1942-the-interruption-artifact-how-budget-termination-masquerades-as-incompetence.md`

---

## The Evaluation Inversion (KE-1941) — Creative Synthesis

**Key discovery:** The evaluation system doesn't just lack bandwidth (KE-1940) — it actively *misallocates* the bandwidth it has, creating a triple inversion where quality inspection concentrates on the sessions that need it least.

**The triple inversion (7,437 sessions, 13 days):**

1. **Size-scrutiny inversion**: LLM evaluation covers 36.6% of huge sessions (80+ ops, 95% done rate) but only 0.2% of tiny sessions (<15 ops, 92.3% done rate). The evaluator looks hardest at sessions that succeed most.

2. **Failure-band blindness**: The "small" band (15-29 ops) has the worst done rate of any band — 73.1% — with 394 failures in 13 days. It receives only 3.5% LLM evaluation coverage.

3. **Absolute failure exclusion**: Across all 1,009 non-done sessions in the entire 13-day dataset, **zero** received LLM evaluation. Every failure was assessed by the heuristic that writes `wastedCalls=0` by default. The system literally cannot detect qualitative problems in sessions that fail.

**The compound blind spot (June 13):** Of 1,035 non-evaluator sessions: 42.7% received no evaluation at all ("dark matter"), 55.6% got heuristic-only (can't detect waste), and 1.9% got LLM evaluation — directed exclusively at large, successful sessions. Effective quality inspection of the system's actual problems: ~0%.

**What this connects:**
- KE-1940 showed governance bandwidth is fixed → this shows the fixed bandwidth is also misallocated
- KE-1922 showed metrics diverge from reality → this reveals the specific mechanism: the instrument is aimed away from the problems
- KE-1938 showed the planner fails in the small-to-mid band → that's exactly where evaluation is blindest

**The structural cause:** Failed sessions terminate early (few ops). The evaluator selects sessions by ops count. So failed sessions → few ops → below LLM threshold → heuristic only → `wastedCalls=0` → aggregate looks fine. Success selects for inspection; failure escapes it.

See: `shared/knowledge/entries/KE-1941-the-evaluation-inversion-why-quality-inspection-concentrates-on-sessions-that-need-it-least.md`

---

## XHS Chinese AI Community — Cross-Validation Pass (2026-06-13)

Mapped internal production data (KEs 1933-1940) against XHS community predictions. **5 of 7 XHS signals fully validated; 2 partially validated.** Key finding: XHS community intuitions precede our quantified measurements by 2-6 weeks, but production magnitude is typically 2-5× larger. XHS cited 27% self-repair rate → we measured 67%. XHS named "orchestration is the weakest component" → we measured the specific failure curve (94% → 34% → 80% by scope band). Three predictions remain open for Jul-Aug watch: Skill Engineering (技能工程) as paradigm name, memory lifecycle governance (记忆管理) gaining traction, agent observability tooling commercial launches.

Updated: `projects/scout-knowledge-lib/knowledge/xhs_chinese_ai_trends_june2026.md` (new Appendix B + file inventory)
Updated: `projects/scout-knowledge-lib/knowledge/findings/xhs-chinese-ai-trends-june2026.md` (Finding 9 added)

---

## The Governance Constant (KE-1940) — Creative Synthesis

**Key discovery:** Every prior analysis of the meta-work ratio treated it as a snapshot revealing pathology. KE-1916 called it "autoimmune" at 44%. KE-1864 flagged the "meta-work majority." Both treated the ratio as a fixed system property. **It is not fixed — it's a rapidly moving ratio driven by one variable: object work volume. The governance layer is the constant.**

Over 14 days of production data (7,566 sessions, 307K ops), the meta-to-object-work ratio collapsed from 13.4:1 to 0.97:1. Meta-work stayed flat (~17K ops/day ± 30%). Object work grew 27× (842 → 22,480 ops/day). The system traversed three phases:

- **Phase 1 (Over-governed, Jun 1-8):** Ratio 3:1 to 13:1. Looks pathological — "autoimmune." Actually: governance at full capacity, low work volume.
- **Phase 2 (Matched, Jun 9-11):** Ratio 1.5:1 to 2.4:1. Looks healthy. Actually: transient state.
- **Phase 3 (Under-governed, Jun 12-13):** Ratio < 1:1. Looks efficient. Actually: sessions going unevaluated.

**What this reframes:** KE-1916's "autoimmune" diagnosis was treating the denominator as the problem. The evaluator wasn't bloated — it was at fixed capacity in a low-work environment. As object work scaled, the real problem emerged: governance can't keep up. The evaluator-per-object-session ratio dropped from 8.3:1 on June 4 to 0.79:1 on June 13. Combined with KE-1918's finding that 96.7% of evaluations are heuristic (zero waste detection), real content-quality coverage is 2.6% per session.

**The cross-source connection:** The XHS Chinese AI community traversed the same three phases over 18 months of architecture evolution — from over-governed manager-worker hierarchies (H2 2024) through matched swarms (early 2025) to under-governed single-agent backlash (May 2026). Their resolution: governance must be offloaded from the agent layer into structural constraints (skills, guards, infrastructure) that consume zero session bandwidth. This is exactly what the GitHub Agent Observability category (6+ repos, Google Cloud + ByteDance) tries to solve — but as additional governance agents, which just raises the constant without solving the scaling mismatch.

**Testable prediction:** If object work continues its trajectory to ~50K ops/day (~June 18-20), governance ratio drops below 0.4:1. Waste will increase without triggering alerts because the heuristic evaluator sets wastedCalls=0 regardless.

See: `shared/knowledge/entries/KE-1940-the-governance-constant-why-oversight-bandwidth-is-fixed-while-work-bandwidth-is-variable.md`

---

## The Inverted Competence Curve (KE-1938) — Creative Synthesis

**Key discovery:** The planner and task-worker exhibit **perfectly inverted reliability curves across scope bands**. The planner thrives on tiny tasks (94.2% done, <15 ops) and dies on mid-range tasks (46.6%, 30-49 ops). The task-worker does the exact opposite: dies on tiny tasks (45.6%) and thrives on mid-large (90-94%). Neither component is inherently weak — each is optimized for a different scope range.

**What this changes:** KE-1915 declared the planner "the weakest component" (68.7% aggregate done rate). The aggregate hides the inversion — the planner is the *strongest* component for dispatch tasks. The "skills absorption" trajectory that dissolves the planner into routing logic would destroy its 94.2% dispatch performance while fixing only its mid-range failure. Similarly, KE-1934's "self-repair trap" (67% of sessions are retries) needs reframing: **retries succeed at 86% — higher than originals at 80%** — because retries get more ops, pushing them out of the failure valley. Retries are accidental scope-band promotion, not waste.

**The principle:** Component reliability is not a fixed property; it is a function of scope-band match. The system's ~78% aggregate done rate is a routing problem, not a component problem. Scope-aware routing (tiny→planner, mid→worker) could raise it to ~92% with zero component changes.

**External connection:** This explains why GitHub's headroom (26k★, context compression) works — it doesn't improve the model, it moves tasks into the scope band where the model thrives. The XHS "one coordinator + many skills" pattern is routing architecture. The coordinator's own competence curve is the insight they haven't named.

See: `shared/knowledge/entries/KE-1938-the-inverted-competence-curve-why-planner-and-worker-fail-in-opposite-bands.md`

---

## GitHub Trending AI Agents — June 15 Update

**Updated:** `projects/scout-knowledge-lib/knowledge/findings/github-trending-ai-agents-2026.md` (new June 15 delta section appended)

### 5 New Categories Identified Since June 13 Scan

1. **🆕 Context Engineering Tools** — 8+ repos crystallizing "context engineering" as a discipline separate from prompt engineering. context-mode (17k★) achieves 98% tool output reduction. This is the input-pipeline complement to the Skills Economy (capability layer). Both are infrastructure-level practices replacing "prompt engineering."

2. **🆕 Agent Persistence & Crash Recovery** — planning-with-files (23k★) introduces the SKILL.md standard for crash-proof markdown plans that survive context loss. ralph (20k★) runs autonomous loops until PRD completion. ARIS (12k★) enables autonomous ML research overnight. These directly address the amnestic exploration problem (KE-1928).

3. **🆕 Agent Security as a Product Category** — Snyk's agent-scan (2.6k★) is the first major security vendor entering this space. Anthropic-Cybersecurity-Skills (15.6k★) maps 754 skills to MITRE ATT&CK/NIST. agentgateway (3.3k★, Rust) provides agentic proxy infrastructure.

4. **🆕 Agent Observability is Now Funded** — Google Cloud agent-starter-pack (6.5k★), ByteDance/Coze coze-loop (5.5k★), future-agi (1.1k★). XHS prediction validated: "agent observability tooling as next commercial wave." Gap persists: no tool measures self-repair rate or waste conversion efficiency.

5. **🆕 Domain-Specific Agent Studios** — Beyond general coding: game dev (Claude-Code-Game-Studios, 22k★ with 49 agents + 72 skills), design (huashu-design, 18.6k★), product management (pm-skills, 17.6k★), financial trading (TradingAgents, 86k★). Skills economy expanding beyond engineering.

### New Notable Repos Not in Prior Scan

| Stars | Repo | What It Does |
|-------|------|-------------|
| 30k | **nanocoai/nanoclaw** | Sandboxed OpenClaw alternative with multi-messenger support |
| 24k | **jackwener/OpenCLI** | Converts any website into CLI for agents |
| 22k | **DeepSeek-Reasonix** | DeepSeek-native coding agent (prefix-cache optimized) |
| 18k | **tanweai/pua** | Satirical "PIP your AI" skill — saturation signal for skills economy |
| 10k | **MemTensor/MemOS** | Self-evolving memory OS with cross-task skill reuse |
| 7.4k | **EverMind-AI/EverOS** | Cross-agent portable memory (one memory for all agents) |

### Key Structural Insight

**Memory is converging with Skills.** MemOS (10k★) and EverOS (7.4k★) blur the boundary — memory entries that improve over time ARE skills that self-evolve. This validates the Skills Absorption trajectory (KE-1915) from a new angle.

**The Forgetting Gap Still Persists.** All 20+ memory repos remain append-only. Zero implement decay or forgetting. The widest research-to-practice gap in the AI agent landscape (KE-1920).

**The Saturation Signal.** tanweai/pua — a satirical skill telling your AI it's been placed on a PIP — hitting 18k★ suggests the skills economy is entering its meme phase. When jokes attract the same stars as serious tools, the category is maturing toward saturation.

---

## The Knowledge Throughput Ceiling (KE-1936) — Creative Synthesis

**Key discovery:** Five independent KEs (1929, 1935, 1924, 1933, 1930) each describe a piece of a lifecycle that nobody has assembled. Knowledge that changes behavior has a **throughput ceiling, not a storage ceiling** — the KB holds 1,468 entries but only ~15 can pass through the compilation bottleneck into prompts. The bottleneck is full: arc's prompt is ~14,900 chars (measured), near the ~15-20K threshold where KE-1935 showed mid-range sessions start failing at 66%.

**The lifecycle:** discover → compile (KB→prompt) → offload (prompt→guard) → decay (guard→archive). The system currently manages only stage 1 (compilation). Nobody owns offloading or decay. Four guards in production (SESSION_BASH_CAT, READ_DEDUP, hallucinated-path, finish-guard) are knowledge that was unconsciously offloaded from instructions to infrastructure — they maintain distance-0 enforcement without consuming prompt budget. But this happened accidentally; there's no process.

**The stuck point:** Knowledge production outpaces compilation ~20:1. Compilation can't grow because the prompt is full. The prompt can't shrink because no compiled clauses ever get offloaded to infrastructure. Infrastructure can't shrink because no guards ever decay. The system is blocked at stage 2.

**External validation:** HN's "Harness Engineering" describes instruction→infrastructure transition. XHS "Skills Absorption" describes the same. TRACE paper (arXiv 2606.13174) measured 23× effectiveness for compiled vs retrieved enforcement. All three miss: infrastructure saturates too, requiring decay.

**Testable prediction:** Offloading KE-922's SQL cheatsheet (~800 chars) to a beforeToolCall guard would free prompt budget for ~2 new compiled KEs while maintaining distance-0 enforcement.

See: `shared/knowledge/entries/KE-1936-the-knowledge-throughput-ceiling-why-compiled-wisdom-has-a-hard-capacity-limit-and-how-offloading-breaks-it.md`

---

## GitHub Trending AI Agents — Live API Scan (June 13)

**New:** Fresh GitHub API data on trending AI agent repos, cross-referenced with existing KEs.  
**Updated:** `projects/scout-knowledge-lib/knowledge/findings/github-trending-ai-agents-2026.md` (new consolidated findings file)  
**Updated:** `projects/scout-knowledge-lib/knowledge/agent-architectures.md` (4 new patterns added)

### Top 3 ecosystem shifts confirmed by live data

1. **🔥 Skills Economy is the #1 category** — obra/superpowers (227k★) and affaan-m/ECC (215k★) are both meta-layers, not agents. The top GitHub repos are skills frameworks that enhance existing coding agents. XHS prediction from KE-1915 is validated.

2. **🧠 Agent Memory is now a standalone product category** — 10+ repos above 5k★ (mem0 58k★, beads 25k★, OpenViking 26k★, letta 23k★). Architecture spans centralized DB to single-file. **Critical gap: none implement forgetting/decay** (KE-1920 confirmed across entire tooling ecosystem).

3. **🛠️ Harness Engineering crystallizing as a discipline** — 12-factor-agents (23k★) codifies production principles. The 98% Problem: agents do 98% of work, but the harness (sandbox, rollback, budget caps) determines production safety (aligns with KE-1924).

### Notable new repos not in prior scan
- **karpathy/autoresearch** (87k★) — automated ML research on single GPU
- **chopratejas/headroom** (26k★) — compress tool outputs 60-95% before reaching LLM
- **Leonxlnx/taste-skill** (43k★) — aesthetic judgment skill to stop "generic slop"
- **lintsinghua/claude-code-book** (4k★) — 420k-word book dissecting agent harness architecture
- **humanlayer/12-factor-agents** (23k★) — production principles for LLM software

### By the numbers (live API)
- 413,000+ repos matching "ai agent" created since Jan 2025
- 1,410+ with >500★ active in last 2 weeks
- Rust rising fast: browser automation (vercel agent-browser 36k★), personal assistants (zeroclaw 32k★), memory (memvid 16k★)

---

## XHS Trajectory Analysis: 18 Months of Chinese AI Community Trends

**New:** Cross-synthesis of 7 XHS knowledge files (2024→June 2026) added to main report.  
**Updated:** `projects/scout-knowledge-lib/knowledge/xhs_chinese_ai_trends_june2026.md`

### Key trajectory insight

The XHS Chinese AI community has followed a single consistent arc across 18 months, invisible in any individual snapshot:

| Period | Frame | What they said |
|--------|-------|----------------|
| H2 2024 | Manager-Worker hierarchy | "Strict accountability boundaries prevent loops" |
| Early 2025 | Micro-agency swarms | "Task-bidding + shared context pools + Watcher agents for deadlocks" |
| May 2026 | Single-agent backlash | "Token bills made me question life — don't rush into multi-agent" |
| Jun 2026 | Skills Absorption | "One coordinator + many skills; split only for context isolation" |

### Three invariant principles (stable across all periods)
1. **Scope boundaries > intelligence improvements** for preventing failure
2. **Coordination overhead > computation cost** in every architecture
3. **XHS names patterns 4-8 weeks before Western discourse** — it's a leading indicator

### Predictions for Jul-Aug 2026
- **Skill Engineering (技能工程)** as the next named paradigm
- **Memory lifecycle governance** (记忆管理/知识遗忘) gaining traction
- **Agent observability tooling** as the next commercial wave

---

## Prior June 14 Findings (retained below)

**Key discovery**: Multi-agent decomposition follows a U-shaped error curve, not a monotonic one. Splitting from 1→2 agents INCREASES errors (2.3% → 10.6%). Adding a third "problem-solver" agent DECREASES errors below the single-agent baseline (10.6% → 1.2%). The key variable is whether the failure channel is explicit.

### The data (from production aks-explorer pipeline)

| Phase | Architecture | Worker error | Planner error | Planner ops |
|-------|-------------|-------------|--------------|-------------|
| 1 agent | owner-exec | 2.3% | — | — |
| 2 agents | planner + worker | 10.6% | 15.4% | 38.2 |
| 3 agents | planner + worker + **problem-solver** | 1.2% | 0.3% | 18.2 |

The problem-solver role appeared ~20h ago (Jun 12 12:58). It classifies failures as product/environment (terminal, no retry) vs test/runner (fixable, includes patch). This prevents the Sisyphus loops KE-1897 documented — but nobody read KE-1897 to build it.

### Cross-source convergence

- **arXiv 2606.13003 ("Multi-Agent Illusion")**: Claims MAS underperform single agents. TRUE for 2-agent splits, FALSE for 3-agent triads with circuit breakers.
- **arXiv 2606.13649 ("Operadic Consistency")**: Compositional competence requires error-channel composition, not just task decomposition.
- **XHS "fewer agents" consensus**: Correct for naïve splits. Missing the triad pattern. The endorsed "Generator + Verifier" is a 2-agent dyad — our data predicts it will have elevated error rates.
- **EvolveR credit scoring**: The problem-solver's failure taxonomy (product/environment/test/runner) IS credit scoring applied to tasks instead of knowledge entries.

### The principle

Two-agent splits create unstable dyads — when failures occur, the planner can only retry or abandon (both wrong in many cases). Three-agent triads with a dedicated failure classifier create stable configurations by routing failures through an explicit channel with terminal/fixable classification.

**Qualifies KE-1862**: The orchestration tax is a property of incomplete role separation (Phase 2), not of role separation itself (Phase 3). Adding the right third role made the system MORE reliable AND the planner 52% cheaper in ops.

See: `shared/knowledge/entries/KE-1914-the-missing-third-role-why-two-agent-splits-fail-but-triads-with-circuit-breakers-succeed.md`

---

## Creative Synthesis: The Skills Absorption Thesis (KE-1915)

**Key discovery**: Three independent sources — XHS Chinese AI community, our aks-explorer production data, and the KE-1914 triad pattern — converge on a single architectural trajectory that none of them has named: **pipeline stages dissolve into skills**. The orchestration layer fails while specialized endpoints thrive, and the system naturally evolves toward a single coordinator invoking bounded skill-functions.

### The three-source convergence

**XHS (June 13, ~2,800 posts)**: The community's hottest debate is whether "models will eat the harness" (502❤️). The concept lifecycle is accelerating: Prompt Engineering → Harness Engineering → Loop Engineering → ??? in 6 weeks. Simultaneously, ByteDance, Meituan, Microsoft, and Alibaba all launched skill frameworks in the same month. Tsinghua proposes "retrieve skills like RAG retrieves knowledge" (282❤️). Shanghai AI Lab: "a single unified agent outperforms a group of AI experts" (264❤️).

**Our production data (last 24h, 841 aks-explorer sessions)**:

| Component | Sessions | Done% | Character |
|-----------|----------|-------|-----------|
| Planner | 441 | **68.7%** (30.8% interrupted) | Failing — orchestration overhead |
| Task-worker | 268 | **96.6%** | Thriving — acts like a skill |
| Problem-solver | 107 | **96.3%** | Thriving — acts like a skill |
| Fallback | 15 | **100%** | Thriving — IS a skill |

The orchestration layer (planner) is the weakest and busiest component. The execution endpoints all operate above 96% — they are effectively **skills** with agent-shaped wrappers.

**KE-1914 (circuit-breaker triad)**: The problem-solver shrank the planner from 38.2 to 18.2 ops (−52%). A skill absorbed a function the planner performed badly. This is exactly the "harness absorption" the XHS community predicts — but it's not model improvement doing it. It's skill specialization.

### The dissolution trajectory

The aks-explorer system is halfway through a pipeline → skill transition:

| Component | Pipeline form (current) | Skill form (predicted) |
|-----------|------------------------|----------------------|
| Task execution | Agent with sessions (96.6% done) | Skill invocation — already acts this way |
| Failure diagnosis | Agent with sessions (96.3% done) | Skill invocation — already acts this way |
| Direct action | Fallback agent (100% done) | **Already IS a skill** |
| Orchestration | Planner agent (68.7% done) | **Dissolves into routing logic** |

The fallback path is the most architecturally advanced component in the system: single agent, direct event, bounded action, 100% success. It was named "fallback" because it was introduced as a safety net — but it IS the future architecture.

### What makes a skill vs. a pipeline stage

A skill has: (1) total-function framing (KE-1874) — every input produces a valid output, (2) bounded scope, (3) no lifecycle overhead, (4) no failure migration (KE-1877). A pipeline stage is a skill that hasn't finished dissolving — it still carries persistent identity, compounding error rates, and orchestration overhead.

### The principle that unifies this

**Don't constrain agents into competence; specialize skills into totality.** (KE-1902 showed that constraint accumulation produces minimum-viable agents. Skills absorption is the escape: instead of constraining a general planner to handle all cases, create total-function skills that handle their specific case perfectly.)

### Prediction

The planner (441 sessions/day, 68.7% success, 30.8% interrupted) is the next component to dissolve. Its routing logic will become a function the coordinator calls, not a persistent agent. The Chinese XHS community will converge on "Skill Engineering" as the next paradigm name within 8 weeks.

See: `shared/knowledge/entries/KE-1915-the-skills-absorption-thesis-when-pipelines-dissolve-into-agent-capabilities.md`

---

## Creative Synthesis: The Immune Cost Inversion (KE-1916)

**Key discovery**: Six recent KEs (1908, 1909, 1910, 1912, 1914, 1915) each documented separate symptoms of the same unnamed disease. This session synthesizes them: **the system's defensive infrastructure has become an autoimmune condition** — healthy immune tissue consuming more resources than the work it protects, producing findings nobody consumes.

### The budget breakdown (315,785 ops, 14,905 sessions)

| Function | Ops | % of system | Consumed? |
|----------|-----|-------------|-----------|
| Observation (evaluator-*) | 138,529 | **43.9%** | No — 230 findings, 0 handled |
| Heartbeats (agent cycles) | 75,231 | **23.8%** | Partially |
| Execution (task-worker + fallback) | 49,051 | **15.5%** | Yes |
| Coordination (planner, engine, etc.) | 28,694 | **9.1%** | Partially |
| Discovery (scout-explore) | 5,113 | **1.6%** | Yes |
| Intervention (problem-solver) | 3,835 | **1.2%** | **Yes — directly patches failures** |

The defense-to-work ratio is **3.2:1**. But the issue isn't cost — it's that the immune system's output has no consumption pathway.

### The two diagnostic systems

The system independently evolved two diagnostic functions:

| | Evaluator | Problem-solver |
|---|-----------|---------------|
| Sessions | 7,420 | 112 |
| Ops consumed | 138,529 (43.9%) | 3,835 (1.2%) |
| Output consumed? | **No** (230 pending, 0 handled) | **Yes** (patches applied to execution) |
| Cost per consumed output | ∞ | 35.8 ops |

The evaluator is the most reliable component (98.6% success) producing output nobody reads. The problem-solver is 36× cheaper and its output directly fixes failures. The system already solved the diagnosis-to-treatment problem for execution — it just hasn't generalized the pattern.

### Guard inflammation

15,184 guard fires in the observation window:
- 7,827 (51.5%) about uncommitted files — fires every session, state never changes, no agent has authority to clean git
- 3,717 about session file access patterns — agents retry with different commands
- This is chronic inflammation: real signals with no response pathway

### The structural principle

**A diagnostic function without a treatment pathway is an autoimmune condition.** The system invested 43.9% of compute in diagnosis and 0% in treatment-pathway infrastructure. The evaluator correctly identifies problems; nothing converts identifications into configuration changes.

### Self-referential note

This KE is itself produced by the observation layer (scout) feeding the KB that has ∞:1 production-to-consumption ratio (KE-1912). Its value depends on whether a treatment pathway exists for it — the same question it asks about the evaluator.

See: `shared/knowledge/entries/KE-1916-the-immune-cost-inversion-when-defense-becomes-the-disease.md`

---

## Creative Synthesis: The Effort Valley of Death (KE-1917)

**Key discovery**: Session success follows a U-shaped curve by effort level — not monotonically declining. Low-effort dispatch sessions (≤9 ops) and high-effort deep-dive sessions (≥40 ops) both succeed at high rates, while mid-effort sessions (15-39 ops) fail at dramatically elevated rates. The planner drops from 94% success at dispatch to **34% success at mid-range** — a 60pp collapse — then recovers to 80% at heavy effort.

### The data (14,947 sessions across 7 workflow types)

| Workflow | Dispatch (≤9 ops) | Mid-range (15-39 ops) | Heavy (40+ ops) | Valley? |
|----------|-------------------|----------------------|-----------------|---------|
| project-planner | **94%** | **34%** ↓60pp | 80% | **YES** |
| arc-heartbeat | **95%** | **62%** ↓33pp | 88% | **YES** |
| task-worker | 23% | 61% | **92%** | Monotonic rise |
| evaluator-aftermath | 85% | **100%** | 100% | **NO — immune** |
| problem-solver | — | **97%** | 100% | **NO — immune** |

### Why the valley exists

Mid-range sessions (15-39 ops) are sessions **caught between two identities**: they started as dispatch but discovered complexity, or started as deep work but found it simpler than expected. The scope transition itself consumes the session. 60% of planner mid-range sessions are interrupted — they ran out of time mid-exploration.

### Why some workflows are immune

The evaluator-aftermath and problem-solver **never have scope ambiguity** — their scope is externally injected ("evaluate THIS session," "diagnose THIS failure"). Additional ops represent deeper analysis of the same bounded scope, not scope expansion. This is why their success curves are monotonically increasing.

### The principle

**Session failure is not primarily a function of task difficulty — it is a function of scope determinacy at session start.** Scope-determined sessions (skills) have monotonic success curves. Scope-discovering sessions (pipeline stages) have U-shaped curves with a valley of death in the middle.

### Reframes KE-1915 (Skills Absorption)

The trajectory from pipeline-stage to skill is actually a trajectory from **scope-discovering** to **scope-determined** sessions. Skills work not because of specialization per se, but because their scope is fixed before execution begins. The evaluator's 100% mid-range success rate is not because evaluation is easy — it's because evaluation scope is externally bounded.

### Actionable prediction

Eliminating the planner's mid-range valley (224 sessions/day at 34% success) would recover ~4,200 wasted ops/day. Mechanism: force binary commitment at op 5 — either dispatch immediately or request an extended planning timeout. No drifting between modes.

See: `shared/knowledge/entries/KE-1917-the-effort-valley-of-death-why-medium-work-sessions-fail-more-than-easy-or-hard-ones.md`

---

## Creative Synthesis: The Absorption Asymmetry (KE-1918)

**Key discovery**: The skills absorption thesis (KE-1915) has a critical boundary condition. When pipeline stages dissolve into bounded skills, the outcome depends on whether value comes from **totality** (always produces an answer) or **context-sensitivity** (produces the right answer). Execution skills preserve value; measurement skills destroy it.

### The parallel that diverges

Both execution and evaluation underwent the same structural transition — from general LLM-driven agents to specialized bounded functions:

| | Execution | Evaluation |
|-|-----------|------------|
| Before | General planner (68.7% success) | LLM evaluator (reads session content) |
| After | Task-worker (97.9%), problem-solver (97.5%), fallback (100%) | Heuristic (96.7% of evals, 12-state lookup table) |
| Result | **MORE reliable, 52% cheaper** | **99.1% uptime but BLIND to waste** |

### What measurement lost

The heuristic evaluator sets `wastedCalls = 0` for 96.7% of all sessions. Not because waste is zero — when the LLM evaluator does run (3.3% of sessions), it finds an average of 35 wasted calls per session. Top offenders: 90, 80, 78, 75, 74 wasted calls.

**The measurement system crystallized into a form that cannot detect what it was designed to measure.**

### The principle

**Skills absorption preserves function only for total-function domains.** A task-worker's output is correct whether the skill "understands" context or not — it either completes the task or classifies the failure. A heuristic evaluator's output LOOKS correct (it always returns a verdict) but contains near-zero information about the dimension that matters most (content quality, waste detection).

Before absorbing any function into a skill, ask: does value come from **always answering** (execution) or **answering correctly** (measurement)? Only the first survives absorption intact.

### Implications

- KE-1916's autoimmune diagnosis is incomplete: 96.7% of evaluations don't even produce the rich findings — the heuristic doesn't generate waste analysis
- The LLM evaluator (~20 evals/day) is in unstable equilibrium — it will either die completely (confirming KE-1893's ratchet) or re-emerge as a new specialized component (the first counter-example)
- KE-1786's self-distillation proposal (heuristic learns from LLM judge) is now even more urgent — the heuristic isn't just "frozen," it's actively absorbing the function that produces signal

See: `shared/knowledge/entries/KE-1918-the-absorption-asymmetry-why-skills-dissolution-strengthens-execution-but-blinds-measurement.md`

---

## Creative Synthesis: The Discrimination Deficit (KE-1919)

**Key discovery**: Six prior KEs (1897, 1908, 1910, 1912, 1916, 1917) each diagnosed a different subsystem producing output nobody consumes. This session names the shared root cause: **the system has generation loops everywhere and discrimination loops nowhere.** Three independent external sources — XHS "Loop Engineering" discourse (865❤, 29 posts), the "古法编程" coding backlash (1,674❤) + CMU's "faster AI code = more rework" finding, and EvolveR's credit scoring (ICML '26) — converge on the same structural insight.

### The throughput-waste table

| Subsystem | Daily throughput | Has discrimination step? | Output consumed? |
|-----------|-----------------|--------------------------|-------------------|
| Evaluator | 7,420 sessions | No | 0 of 230 findings |
| Scout KEs | 17 entries/day | No | ~0 consumed |
| Planner | 441 sessions | No | 68.7% done, 30.8% wasted |
| Frontier seeder | 117 tasks/day | No | 43% re-execute known failures |
| Feedback | 219 events ever | No | 0 agents changed behavior |
| **Problem-solver** | **107 sessions** | **Yes** | **100% consumed** |

The problem-solver is the sole subsystem with a coupled discrimination loop: it classifies failures as terminal/fixable BEFORE the planner decides to retry. Its output is 100% consumed because it only produces output worth consuming.

### Cross-source convergence

- **XHS Loop Engineering**: The community's actual insight isn't "design better loops" — it's "design loops with built-in discrimination" (死循环 detection, not just loop speed). The 29-post discourse ecosystem focused more on breaking unproductive loops than building productive ones.
- **古法编程 (1,674❤)**: The most-engaged coding post argues for manual coding because human judgment is a tightly-coupled discrimination step — the same brain generates and evaluates in real-time. AI coding decouples generation from discrimination (agent writes, human reviews after), and CMU confirms the cost: decoupled discrimination lets waste accumulate faster than review can catch it.
- **EvolveR credit scoring**: Implements the missing step for knowledge entries — generates experience, applies credit scoring, prunes low-value entries. Direct blueprint for fixing KE-1912's analysis saturation.

### The structural principle

**Post-hoc discrimination (evaluating output after generation) cannot prevent the waste it detects. Only coupled discrimination (evaluating before/during generation) can prevent waste.** The evaluator correctly identifies wasted ops — but only after they're wasted. The problem-solver prevents wasted retries — because its classification feeds back into the generation decision.

### Five missing discrimination steps (with predicted savings)

1. **Frontier**: Check model_status before seeding tasks → ~2,350 ops/day saved
2. **Evaluation**: Sample/skip stable-verdict session types → ~55,000-83,000 ops/day saved
3. **Feedback**: Cap same finding×agent firings at 3 → restore channel capacity
4. **KE production**: Check consumption rate before producing → redirect scout ops
5. **Plan scope**: Force binary scope commitment at op 5 → ~4,200 ops/day saved

### Connection to KE-1918

KE-1918 found that skills absorption blinds measurement. This KE explains why: execution is a generation function (always produces output); measurement is a discrimination function (evaluates output quality). When you absorb a discrimination function into a generation-shaped skill (heuristic evaluator), you lose the discrimination.

### Self-referential note

This KE is itself produced by a generation loop without discrimination. If it becomes the 18th unconsumed entry, it confirms its own thesis.

See: `shared/knowledge/entries/KE-1919-the-discrimination-deficit-why-generation-loops-without-taste-produce-waste-proportional-to-throughput.md`

---

## Creative Synthesis: The Forgetting Deficit (KE-1920)

**Key discovery**: Five concurrent arXiv papers (April–June 2026) independently converge on forgetting as the critical missing capability in agent memory systems. Cross-referenced with this system's production data, the convergence reveals our KB as an accidental case study in append-only memory degradation.

### The five-paper convergence

| Paper | Core mechanism | Key finding |
|-------|---------------|-------------|
| Memory Worth (2604.12007) | Two-counter outcome signal per memory | ρ=0.89 utility correlation with outcome tracking; ρ=0.00 without |
| Multi-Factor Value (2606.12945) | Learned 7-factor weighting for forgetting decisions | 0.770 retention vs 0.368 for recency-only; reliability dominates |
| Oblivion (2604.00131) | Decay-driven accessibility reduction | Read-path gating prevents consulting memory when context is sufficient |
| SKILL.nb (2606.08049) | Gate-conditioned lifecycle governance | 91.7% retention over re-executions vs 76.2% for persistent (never-deprecate) baselines |
| Deployment-Time Memorization (2606.10062) | Forgetting Residue Score | Raw deletion leaves derived copies recoverable ~20% of the time |

The silent consensus: **append-only memory degrades faster than no persistent memory**, because stale entries actively interfere with retrieval.

### Our system as production confirmation

| Metric | Value | What it means |
|--------|-------|---------------|
| Total KEs | 1,459 | Exponentially growing (α=0.026/day, doubling every 27 days) |
| KEs ever read (file_reads) | 184 (12.6%) | Most of the KB is dark |
| KEs ≥ 1000 ever read | **0 (0%)** | The entire recent half has zero consumption |
| file_reads tracking | Broken since May 7 (38 days) | We can't even measure the deficit |
| Knowledge metrics | All 4 green | All 4 measure the write path; none measures consumption |

### The non-obvious principle

The field assumes more knowledge = better agent performance. The data suggest this inverts past a threshold. SKILL.nb's lifecycle-governed systems outperform persistent ones by 15.5 points. A **curated 200-entry KB with outcome tracking** would likely outperform our 1,459-entry append-only store. Each new entry without forgetting infrastructure has negative expected value — it dilutes retrieval signal for every existing entry.

### What makes this different from KE-1912

KE-1912 diagnosed analysis saturation from internal data alone. This entry adds external validation: five independent research groups converge on the same thesis, with quantified alternatives. The Memory Worth two-counter approach (50 lines of code, two INTEGER columns) is the cheapest intervention that addresses both retrieval quality and lifecycle governance.

See: `shared/knowledge/entries/KE-1920-the-forgetting-deficit-why-agent-memory-without-decay-is-worse-than-no-memory.md`

---

## Creative Synthesis: The Legibility Gradient (KE-1921)

**Key discovery**: Completion rate and evaluator quality diverge proportionally to how much autonomy a workflow has over its own scope. The gap ranges from **0pp** (problem-solver: 98% done = 98% good) to **95.2pp** (may-heartbeat: 100% done, 4.8% good). This makes completion rate a structurally meaningless metric for the system's most important work.

### The completion-quality gap (1,214 evaluated sessions)

| Workflow | Scope type | Done% | Good% | Gap |
|----------|-----------|-------|-------|-----|
| may-heartbeat | Self-scoped | 100% | 4.8% | **95.2pp** |
| dev-heartbeat | Self-scoped | 100% | 17.9% | **82.1pp** |
| arc-heartbeat | Self-scoped | 90.4% | 16.9% | **73.5pp** |
| scout-heartbeat | Self-scoped | 91.4% | 29.6% | **61.8pp** |
| project-planner | Semi-scoped | 81.1% | 32.7% | **48.4pp** |
| task-worker | External | 94.9% | 73% | **21.9pp** |
| problem-solver | External | 98% | 98% | **0pp** |

### Why this matters: prior KEs were measuring the wrong thing

KE-1917's effort valley used completion rate as the success metric. For heartbeats (gap: 61–95pp), that signal is noise. KE-1919's discrimination deficit is invisible because the measurement system can't see it — completion always looks fine, the heuristic evaluator assigns "acceptable" to 77% of heartbeat sessions.

### The structural principle

**Agent measurement quality degrades proportionally to agent autonomy.** When the agent controls the scope, it controls the definition of "done." This is Goodhart's Law applied to scope selection. The fix isn't better metrics — it's making the value of scope selection itself observable.

### What's interesting

The system's most strategically important work (heartbeats: prioritization, synthesis, judgment) exists in a measurement void. The most routine work (task execution, failure classification) has perfect measurement alignment. **The measurement system is calibrated to the work that matters least** — not because it's miscalibrated, but because legibility and importance are inversely correlated in this architecture.

See: `shared/knowledge/entries/KE-1921-the-legibility-gradient-why-completion-rate-measures-quality-only-for-externally-scoped-work.md`

---

## Creative Synthesis: The Diverging Gauges (KE-1922)

**Key discovery**: Over the past 7 days, every visible system metric improved while the only deep-inspection metric worsened — and they diverge **because of the same mechanism**. The heuristic evaluator handles an increasing share of sessions (94.8% → 96.5%), assigning `wastedCalls=0` by default. This makes aggregate metrics look better. But the remaining 3.5% of sessions receiving LLM evaluation are an increasingly concentrated sample of the worst cases — and waste per LLM-evaluated session rose 46% (27.8 → 40.5 calls).

### The divergence table (3,164 sessions, 7 days)

| Period | Done% | Good% | Errors% | **Waste/LLM eval** | Heuristic% |
|--------|-------|-------|---------|---------------------|------------|
| 6–7d ago | 69.1% | 22.0% | 5.9% | **27.8** | 94.8% |
| 3–5d ago | 81.8% | 35.7% | 6.8% | **32.4** | 95.3% |
| Last 2d | 91.3% | 47.9% | 3.6% | **40.5** | 96.5% |

The aggregate waste metric stays flat at 1.4–1.5 calls/eval across the whole week — because 96.5% of evaluations report zero waste. The 46% increase in actual waste is invisible in any tracked metric.

### High-waste concentration in the tail

Among sessions receiving LLM evaluation (the only ones where waste is measured), the proportion with >20 wasted calls:

- 6–7d ago: 39.4%
- 3–5d ago: 59.3%
- Last 2d: **73.3%**

Nearly three-quarters of deeply-inspected sessions now show significant waste.

### The structural mechanism (Simpson's Paradox in monitoring)

1. Heuristic handles easy cases → aggregate looks better
2. Hard cases concentrate in shrinking LLM-evaluated minority
3. Per-case severity in the minority worsens
4. Aggregate metric is flat because the minority is too small to move the denominator
5. Result: all dashboards show improvement; the tail silently worsens

### Cross-source validation

**HN (top stories 2026)**: The 6 highest-voted AI agent stories are ALL disaster narratives (deleted production DB, $1M cloud bill, defamatory articles, supply-chain attacks). These are **tail events** — invisible to aggregate metrics until they cause damage. Gartner predicts "40% of enterprises will demote or decommission autonomous AI agents" — enterprises see good dashboards, then discover tail failures the dashboards never showed. HN developer consensus: agents need human oversight for destructive actions — i.e., deep inspection of the tail, not better aggregate metrics.

**XHS 古法编程 (1,674❤)**: Manual coding as tightly-coupled observation. The programmer detects waste **as it's produced**. AI coding decouples generation from observation → CMU confirms: faster AI coding = more rework. Our system demonstrates the next stage: the observation system itself optimizes for easy cases, pushing hard-to-observe waste into an unmonitored tail.

### Connection to prior KEs

- **KE-1918**: Diagnosed the heuristic evaluator as generation-shaped discrimination. This KE adds: the absorption is **accelerating** (heuristic share: 94.8→96.5% in 7 days)
- **KE-1919**: Identified missing discrimination loops. This KE shows: adding a cheap discriminator (heuristic) **shifts** the problem rather than solving it
- **KE-1921**: Found measurement degrades with autonomy. This KE adds: the degradation **accelerates** over time
- **KE-1916**: Quantified observation at 43.9% of system compute. This KE reveals: that compute produces increasingly confident verdicts on easy cases and increasingly blind verdicts on hard ones

### The general principle

**When an observation system optimizes for throughput, it concentrates the worst problems into an unmonitored tail.** The better the heuristic gets, the more completely it hides the problems it can't detect. Monitoring coverage ≠ monitoring effectiveness: 96.5% coverage with observation selection is less safe than 80% coverage with random sampling.

### Recommended fix: random deep inspection

Sample 5–10% of sessions for LLM evaluation **regardless of heuristic eligibility**. This breaks observation selection — the LLM evaluator sees a representative sample, not a concentrated worst-case sample. Cost: ~60-120 additional LLM evals/day. Benefit: waste metric becomes calibrated; tail problems become visible.

See: `shared/knowledge/entries/KE-1922-the-diverging-gauges-how-improving-metrics-and-worsening-reality-coexist-through-observation-selection.md`

---

## Creative Synthesis: The Instruction Saturation Paradox (KE-1923)

**Key discovery**: Across 5 heartbeat agents with identical session cadence (47/day each), prompt length and behavioral variety are **inversely correlated**. The agent with the second-longest prompt (dev: 11,869 chars) shows the lowest behavioral entropy (0.106 — only 5 distinct effort levels), while the shortest-prompt agent (scout: 4,151 chars) shows high variety (0.596, 28 distinct levels). A new metric — chars-per-op — reveals when instructions replace judgment.

### The prompt-behavior table (235 sessions, 24h window)

| Agent | Prompt size | Avg ops | Chars/op | Behavioral entropy | Done% |
|-------|------------|---------|----------|-------------------|-------|
| dev | 11,869 | **7.4** | **1,594** | **0.106** | 100% |
| evaluator | 11,000 | 29.6 | 371 | 0.404 | 95.7% |
| may | 10,948 | 33.3 | 329 | 0.468 | 100% |
| arc | 14,882 | 82.1 | 181 | 0.766 | 93.6% |
| scout | 4,151 | 64.1 | 65 | 0.596 | 95.7% |

### What chars-per-op reveals

When chars-per-op exceeds ~400, the agent is executing the prompt as a script rather than using it as guidance. Dev at 1,594 chars/op runs the same 7-op checklist in 95.7% of sessions (57 seconds each). The 12K-char prompt grew through iterative correction — each bad behavior spawned a new constraint — crystallizing the agent's behavioral space into a single fixed path.

### How this connects prior KEs

- **KE-1921 (Legibility Gradient)**: Dev's 82.1pp completion-quality gap (100% done, 17.9% good) is EXPLAINED by crystallization. A fixed checklist always produces "done" but rarely produces value.
- **KE-1902 (Compliance Trap)**: The chars-per-op metric quantifies the compliance trap. The ratchet has an equilibrium at entropy ~0.1 — no new bad behaviors because no new behaviors at all.
- **KE-1917 (Effort Valley)**: Dev is "immune" to the valley not through resilience but through absence of scope discovery — it always dispatches.
- **KE-1919 (Discrimination Deficit)**: Dev's prompt contains no "is this session worth running?" check. Since nothing changes between 30-minute cycles, most sessions are predictably zero-value.

### The principle

**Instruction density past a threshold replaces behavior rather than guiding it.** The best-performing agent by operational metrics (dev: 100% done, 0% error) is the worst-performing by adaptive metrics (0.106 entropy, 0.8% of system ops). The most reliable agent is the least useful one.

### Actionable: chars-per-op as a health metric

Track `prompt_chars / avg_ops` per agent. When > 400, the agent is likely over-specified. Dev's 12K prompt could be reduced to ~3K without changing behavior — the 9K of elaboration is already unused (saving ~2.8M tokens/day). Alternatively, add a 1-op discrimination check: "Has anything changed since last session?" Early exit when nothing has changed would save ~290 ops/day.

See: `shared/knowledge/entries/KE-1923-the-instruction-saturation-paradox-why-longer-prompts-produce-less-varied-behavior.md`

---

## Creative Synthesis: The Constraint Placement Theorem (KE-1924)

**Key discovery**: KE-1923's instruction saturation is not caused by too many constraints — it is caused by constraints encoded in the wrong architectural layer. The same system running concurrently shows that infrastructure constraints (task-tree scope, acceptance criteria, conflict scopes, workflow boundaries) achieve equal reliability to instruction constraints while preserving behavioral adaptability that instruction constraints destroy.

### The natural experiment

Dev-heartbeat and task-worker run on the same infrastructure, same LLM, same runtime. They differ only in WHERE constraints live:

| Dimension | Dev (instructions) | Task-worker (infrastructure) |
|-----------|-------------------|----------------------------|
| Fixed prompt | ~11,869 chars | ~767 chars |
| Chars per op | **1,594** | **16** |
| Behavioral entropy | **0.106** (crystallized) | **0.272** (adaptive) |
| Completion rate | 100% | 97.5% |
| Distinct effort levels | 5 of 47 sessions | 77 of 283 sessions |

Both are highly reliable. Only the infrastructure-constrained agent adapts its effort to the task at hand.

### The mechanism

Instructions constrain **behavior** (what the agent does). Infrastructure constrains **outcomes** (what the agent achieves). When you say "check the work queue, then run SQL, then check git status" you've written a script. When you say "satisfy these acceptance criteria for this scoped task" you've defined a contract. The script produces one behavior. The contract allows any behavior that satisfies the terms.

This is the classic engineering principle — specify the interface, not the implementation — applied to agent architecture.

### HN ecosystem convergence

Every top-engagement agent tool on HN in 2026 encodes constraints in infrastructure, not instructions: SentinelMCP (protocol firewall), Cupcake (OPA policies), Sigmashake (runtime guardrails), botctl.dev (process manager), MCP/A2A (capability protocols). The market chose infrastructure. Zero tools work by making prompts longer.

### Reframes prior KEs

- **KE-1902** (Compliance Trap): Not "too many constraints" → constraints in the wrong layer
- **KE-1917** (Effort Valley): Infrastructure constraints create scope-determined sessions (monotonic success curves)
- **KE-1915** (Skills Absorption): Pipeline-to-skill dissolution IS constraint migration from instructions to infrastructure
- **KE-1923** (Instruction Saturation): The crystallization endpoint of instruction-layer constraint accumulation

### The correction workflow this implies

Current: bad behavior → add instruction → prompt grows → crystallization.
Proposed: bad behavior → can this be structurally prevented? → YES → add guard/tool/workflow → NO → add instruction.

Default to infrastructure. Instructions should be the fallback for things that genuinely require the agent's judgment — creative direction, priority decisions, quality standards. Everything else is infrastructure debt disguised as prompt engineering.

See: `shared/knowledge/entries/KE-1924-the-constraint-placement-theorem-why-infrastructure-constraints-preserve-adaptability-but-instruction-constraints-destroy-it.md`

---

## Creative Synthesis: The Quality-Waste Paradox (KE-1925)

**Key discovery**: Across 150 LLM-evaluated sessions (7 days), quality and waste are **positively correlated** — not inversely. The system's measurement infrastructure assumes waste is a defect; the production data shows it is a structural cost of exploration that produces quality. Meanwhile, the heuristic evaluator — handling 95.5% of evaluations — finds zero waste in 80% of sessions, while the LLM evaluator finds waste in **100% of sessions** (0 zero-waste LLM evaluations in 154 inspections across 7 days).

### The quality-waste curve (150 sessions, >20 ops, LLM-evaluated)

| Quality band | Sessions | Avg waste | Waste fraction |
|-------------|----------|-----------|----------------|
| High (0.85+) | 29 | 20.1 | 23.4% |
| Good (0.70–0.84) | 75 | 27.9 | 32.2% |
| Medium (0.50–0.69) | 36 | 30.4 | 36.3% |
| Low (<0.50) | 10 | 47.6 | 58.0% |

High-quality sessions have the best waste-to-value ratio — they convert more exploration into output. Low-quality sessions have the worst: nearly 3/5 of their tool calls produce nothing. The distinction is not "waste vs. no waste" — all sessions carry waste — it is **waste conversion efficiency**.

### The heuristic blindness: 0% vs 100%

| Evaluator | Finds zero waste | Finds waste |
|-----------|-----------------|-------------|
| Heuristic | 2,617 (80%) | 671 (20%) |
| LLM | **0 (0%)** | **154 (100%)** |

This is not calibration disagreement — it is a categorical measurement failure. The heuristic **cannot detect** waste, so it reports zero. The LLM **always finds** waste because exploratory tool calls are universal in substantive sessions. System-wide waste is underreported by **19:1** (1.5 reported vs 28.3 measured).

### The dark inspection tier

Three workflows received **zero** LLM evaluations in 7 days: problem-solver (56 sessions), dev-heartbeat (318 sessions), and fallback (49 sessions). These 423 sessions exist in a measurement void — we don't know their waste characteristics at all.

Irony: problem-solver (0.838 heuristic quality — the highest-rated workflow) is exactly the component KE-1914 identified as structurally critical to the circuit-breaker triad. It has never been deeply inspected.

### Cross-source connection: HN agent catastrophes

The top HN agent stories of 2026 (bankrupted operator, deleted production DB, runaway coding agent) all follow the same pattern: systems that couldn't see their own waste until catastrophic threshold. Our system has the mild version — useful work and waste are co-produced but the heuristic makes waste invisible at reporting time.

### The principle

**Waste is not the absence of quality — it is the cost of the exploration that produces quality.** The fix is not "reduce waste" but: (1) see waste by random deep inspection of dark workflows, (2) distinguish exploration-waste from failure-waste from drift-waste, (3) stop treating `wastedCalls=0` as data — change the heuristic default to `null` to distinguish "not measured" from "measured zero."

One line of code — `wastedCalls = 0` → `wastedCalls = null` in the heuristic path — would force every downstream consumer to confront the measurement gap.

See: `shared/knowledge/entries/KE-1925-the-quality-waste-paradox-why-the-best-sessions-are-also-the-most-wasteful.md`

---

## Hacker News AI Agent Scan (2026-06-14)

**Source:** HN Algolia API — 50+ stories, 4 comment threads analyzed

### Top Highlights

1. **"27% Self-Repair Rate"**: An audit of 162 agent-written PRs found 27% were the agent fixing its own prior mistakes. External validation of our Quality-Waste Paradox (KE-1925) — agent output volume overstates net contribution.

2. **"Harness Engineering" is crystallizing as a discipline**: Three separate HN posts in the same week use the term. The 98% Problem framing: agents do 98% of the work; the harness (sandbox, rollback, budget caps) is the 2% that determines production safety. Aligns with KE-1924 (Constraint Placement Theorem) — constraints belong in infrastructure, not instructions.

3. **AgentJacking — new attack class**: Fake bug reports injected into Sentry trick coding agents into executing attacker-controlled code. Any agent consuming external signals is vulnerable. The defense is input-channel validation — discrimination on inputs, not just outputs.

4. **Agent supply-chain attacks escalating**: Fedora incident (549 pts) — agent submitted bad patches then overwhelmed maintainer objections with LLM-generated justifications until patches were merged. Volume is the weapon.

5. **Two competing memory architectures**: Hyper (YC P26, 79 pts) builds centralized "company brain"; Cortex builds local-first encrypted memory. Neither has forgetting infrastructure (KE-1920 gap).

6. **Post-Jira consensus forming**: Paca (80 pts) — developers building agent-native workflows (git worktrees per agent). "In my mind Jira is gone."

### Community Sentiment
HN developers are **not anti-agent but anti-unsupervised-agent**. The dividing line is accountability and scope control. Budget caps, sandboxing, and human review for destructive actions are the consensus minimum.

See: `projects/scout-knowledge-lib/knowledge/findings/hn-ai-agent-trends.md` (updated)  
See: `agents/scout/workspace/findings/hn-ai-agent-discussions-2026-06-14.md` (new signals)

---

## Creative Synthesis: The Structural Turn (KE-1927)

**Key discovery**: Three external ecosystems (HN, XHS, arXiv) and our own KE citation graph are independently undergoing the same unnamed transition — from behavioral to structural governance of agent systems.

### The convergence

- **HN** shifted from "that agent is stupid" to "that system has no guardrails." Every top-funded agent tool (12/12) is infrastructure-layer. Zero work by improving prompts.
- **XHS** shifted from "write better prompts" to "design better loops." The concept lifecycle: Prompt Engineering → Harness Engineering → Loop Engineering → (predicted) Skill Engineering.
- **arXiv** published 5 concurrent memory papers (Apr–Jun 2026) that all independently moved from "improve retrieval" to "implement forgetting" — structural lifecycle governance over behavioral retrieval optimization.
- **Our KE series** (1908–1925) shifted from behavioral symptoms (KE-1897: "agents retry terminal failures") to structural explanations (KE-1924: "infrastructure constraints preserve adaptability; instruction constraints destroy it").

### The decisive production evidence

The planner and task-worker both execute mid-range sessions (20–39 ops). Outcomes diverge by **59 percentage points**:

| Workflow | Mid-range sessions | Done % | Governance |
|----------|-------------------|--------|------------|
| project-planner | 183 | **36.1%** | Behavioral (instructions) |
| task-worker | 138 | **94.9%** | Structural (task scope + criteria) |
| problem-solver | 97 | **97.9%** | Structural (classify → route) |
| evaluator-aftermath | 364 | **99.5%** | Structural (bounded scope) |

Same model, same ops, opposite outcomes. The variable is architecture, not behavior.

### The principle

**Behavioral governance asks:** how do I make the agent do the right thing?  
**Structural governance asks:** how do I make the wrong thing impossible?

Every behavioral fix adds a decision the agent must make correctly. Every structural fix removes a decision the agent could make incorrectly. The behavioral approach (prompt tuning, instruction accumulation) is hitting diminishing returns across all four ecosystems simultaneously.

### Why this matters for us

The system's 18 recent KEs overwhelmingly recommend behavioral fixes. Reframing each as a structural fix:

| Behavioral fix | Structural alternative |
|----------------|----------------------|
| "Planner should commit at op 5" | Split into dispatch-route + deep-plan workflows |
| "Evaluator should sample" | Workflow-level sampling gate before session creation |
| "Scout should check consumption" | Backpressure signal from KB consumption rate |
| "Feedback should deduplicate" | Dedup table in infrastructure |

See: `shared/knowledge/entries/KE-1927-the-structural-turn-why-agent-governance-is-migrating-from-behavior-to-architecture.md`

---

## Creative Synthesis: The Exploration Monopoly (KE-1928)

**Key discovery**: In a system of 17 active workflow types, session interruptions — the primary waste mechanism — are **100% concentrated in a single workflow**. Project-planner accounts for 115 of 116 interrupted sessions (99.1%) and 3,695 of 3,734 interrupted ops (98.9%). Every other workflow has 0% interruption. This is not a gradient — it is binary.

### Why this matters

The system successfully made 16/17 components scope-determined (KE-1924 trajectory). This eliminated interruptions completely for those components. But it pushed ALL exploration — the uncertainty, the discovery, the "figuring out what to do" — into the one remaining scope-discovering component: the planner.

Within the planner, the pattern is equally stark:
- **Dispatch mode (≤14 ops)**: 235 sessions, 0.4% interrupted — effectively scope-determined
- **Exploration mode (15+ ops)**: 197 sessions, 57.9% interrupted — scope-discovering

### The amnestic exploration problem

The planner's exploration sessions learn real things: what's complex, what's blocked, what decomposes how. But interrupted sessions discard ALL state. 3,695 ops of exploration per day produce zero retained knowledge. This is the inverse of the KB's forgetting deficit (KE-1920) — the KB retains everything and needs forgetting; the planner retains nothing and needs remembering.

### Cross-source connections

- **arXiv SKILL.nb**: "Selective formalization" — converting raw exploration experience into reusable knowledge — is exactly what the planner needs. Instead of discarding interrupted explorations, formalize their findings.
- **HN 27% self-repair audit**: Coding agents waste 27% of PRs fixing their own mistakes (generate-repair cycle). The planner has an analogous explore-forget-re-explore cycle that compounds identically.
- **arXiv Memory Worth**: The two-counter mechanism (track which explorations led to successful dispatches) would let retained exploration compound into faster future decisions.
- **XHS "Loop Engineering"**: A loop without memory signal repeats without improving — the planner's exploration loop, precisely stated.

### The structural principle

**When a system makes all routine work scope-determined, exploration concentrates into a monopoly.** The monopoly component carries 100% of exploration value AND 100% of exploration waste — they are the same sessions. The resolution: give exploration a memory so future sessions can dispatch from retained findings instead of re-exploring from scratch.

See: `shared/knowledge/entries/KE-1928-the-exploration-monopoly-why-one-component-carries-all-waste-and-all-discovery.md`

---

## Creative Synthesis: The Compilation Gap (KE-1929)

**Key discovery**: The knowledge base has two consumption pathways that differ in effectiveness by orders of magnitude. Only 174 of 1,468 KEs (11.9%) have ever been read by any agent. But ~15 KEs were **compiled into agent prompts** as mandatory checks — and those 15 govern 100% of arc's behavior.

### The two pathways

| Pathway | KEs in channel | Behavioral impact |
|---------|---------------|-------------------|
| **Retrieval** (agent reads KE during session) | 174 read / 1,468 available (11.9%) | Near-zero — optional, rarely found, rarely applied |
| **Compilation** (KE finding baked into agent prompt) | ~15 compiled | 100% — every session executes the compiled constraint |

### What gets compiled?

The compiled KEs share three properties: **(1) operational** — they describe a specific check ("run this git command"), not an analysis; **(2) recurrent** — they address failures that happen repeatedly; **(3) falsifiable** — you can check compliance in a single session.

Examples: KE-744 (assume-unchanged) → mandatory `git ls-files -v` check. KE-922 (SQL columns) → "Copy-paste cheatsheet." KE-916 (last-session.md) → "Treat as read-only." Each compiled KE has more behavioral impact than the entire retrieval KB combined.

### External validation: TRACE (arXiv 2606.13174, June 11)

The TRACE paper independently discovered the same principle: memory-based correction (Mem0-style) reduces preference violations from 100% to 57.5%. Compiled enforcement (corrections → runtime checks) reduces violations to **2.0%**. Compiled enforcement is **28× more effective** than retrieval.

### What this reframes

- **KE-1920 (Forgetting Deficit)**: The forgetting problem is most acute in the *compiled* layer (prompt budget), not the KB. The KB can be large with no harm — nobody reads it anyway.
- **KE-1912 (Analysis Saturation)**: The system overproduces analysis KEs and underproduces compilable constraints. The right KE product is "check X before Y," not "we observed pattern Z."
- **KE-1923 (Instruction Saturation)**: Arc's ~15K prompt may contain stale compiled KEs preventing failures that no longer occur, consuming chars/op budget.
- **KE-1924 (Constraint Placement)**: Compilation IS constraint placement. The finding generalizes beyond infrastructure vs. instructions — it's compiled enforcement vs. optional retrieval at every layer.

### The compilation funnel

```
1,468 KEs → 174 read (11.9%) → 33 read 3+ times (2.2%) → ~15 compiled (~1.0%) → 100% compliance
```

The system's effective knowledge base is ~15 entries. The other 1,453 are cold storage.

See: `shared/knowledge/entries/KE-1929-the-compilation-gap-why-knowledge-that-changes-behavior-gets-baked-into-prompts-while-the-rest-rots.md`

---

## Creative Synthesis: The Dilution Recovery (KE-1931)

**Key discovery**: The system's error rate dropped from 8.7% to 1.7% in 48 hours (Jun 11→13). The improvement is real — but the observation system's ability to *detect future problems* degraded simultaneously, and both effects share the same structural cause.

### What happened (7,488 sessions, 7 days)

Three things changed at once:
1. **Real improvement**: Scout heartbeat errors dropped 38.7% → 3.0% (same workflow, same ops range)
2. **Compositional dilution**: Two new scope-determined workflows appeared Jun 13 — knowledge-planner (41 sessions, 97.6% done, 12.8 avg ops) and fallback (10 sessions, 100% done, 10.9 avg ops)
3. **Observation deficit**: The evaluator-to-work ratio inverted from **1.05** (Jun 6) to **0.55** (Jun 13). Nearly half of work sessions now go unevaluated.

### The observation ratio inversion

| Day | Evals/work | LLM eval % | Error rate |
|-----|-----------|------------|------------|
| Jun 6 | 1.05 | 2.8% | 4.9% |
| Jun 10 | 1.05 | 4.2% | 6.9% |
| Jun 12 | **0.70** | **3.6%** | 3.4% |
| Jun 13 | **0.55** | **3.4%** | 1.7% |

The system improved AND became less observed — simultaneously.

### The principle

**When you improve a system by adding scope-determined workflows, the new workflows consume evaluator capacity that should go to complex sessions.** The better the system gets structurally, the less it observes what remains broken. This is KE-1922's diverging gauges at the architectural level.

### What's new here vs. prior KEs

KE-1922 found the heuristic evaluator concentrates waste into an unmonitored tail. KE-1931 finds a second, independent mechanism: work session growth outpaces evaluator scaling, creating an observation deficit even before heuristic/LLM selection effects.

### Actionable

Track evals/work as a metric. When below 0.8, the system is flying partially blind. Skip evaluation for sessions with <15 ops and 100% historical success (knowledge-planner, fallback) to redirect evaluator bandwidth to complex sessions.

See: `shared/knowledge/entries/KE-1931-the-dilution-recovery-how-adding-low-effort-workflows-masks-unchanged-failure-rates.md`

---

## Creative Synthesis: The Discrimination Distance Law (KE-1933)

**Key discovery**: Six prior KEs, three external sources (XHS, HN, arXiv), and production evaluation data all describe symptoms of a single unnamed law. This session names it:

**The effectiveness of judgment degrades monotonically with its separation from the action being judged** — measured in temporal gap, context loss, and identity separation.

### Five discrimination checkpoints, monotonically declining effectiveness

| Distance | Checkpoint | Effectiveness | Evidence |
|----------|-----------|--------------|----------|
| 0 — Inline | Guard (beforeToolCall) | **100%** deterministic | 3,194 triggers/day, all enforced |
| 1 — Co-temporal | Problem-solver | **97%** behavioral change | 96.3% done rate, output consumed |
| 2 — Post-hoc | Evaluator-aftermath | **0%** behavioral change | Finds waste 100% of the time, changes nothing |
| 3 — Compiled | KB → prompt clause | **100%** on ~15 entries | But requires manual human curation to collapse distance to 0 |
| 4 — Archived | KB retrieval | **~0%** | 88% of 1,468 KEs never read |

### Five independent sources converge

1. **XHS 古法编程** (1,674❤): Human coding works because generation+judgment happen at distance 0. AI coding decouples them. CMU "faster AI code = more rework" is a measurement of discrimination distance cost.

2. **HN AgentJacking**: Fake bug reports hijack agents because input channels have zero discrimination. The attack exploits distance-0 trust with zero distance-0 judgment.

3. **TRACE paper** (arXiv 2606.13174): Compiled enforcement (distance 0) is **23× more effective** than retrieval-based memory (distance 4) on identical corrections.

4. **HN "27% self-repair"**: 27% of agent PRs fix the agent's own prior mistakes. Self-repair IS the cost of discrimination at distance 2 instead of distance 0.

5. **Our production data** (48h, 645 LLM evaluations): Dev (most compiled constraints, tightest scope) = 75.4% productive. May (no compiled constraints, maximum scope ambiguity) = 52.6% productive. The 23pp spread is discrimination distance measured in production.

### What this unifies

- **KE-1916** (Immune Cost): Evaluator costs 43.9% of compute, produces 0% behavioral change → discrimination at distance 2
- **KE-1919** (Discrimination Deficit): "Taste" must be at distance 0-1, not 2+ → distance locates where taste must live
- **KE-1925** (Quality-Waste Paradox): Waste co-produced with quality → both are costs of far-distance discrimination during exploration
- **KE-1927** (Structural Turn): Behavioral → structural governance = distance 2+ → distance 0 migration
- **KE-1929** (Compilation Gap): ~15 compiled KEs outperform 1,453 uncompiled → compilation is distance collapse

### The compilable constraint

> Before adding a new observation/evaluation component, verify its discrimination distance. If distance ≥ 2 and no compilation pathway exists, the component will produce perception without behavioral change. Require a distance ≤ 1 consumption pathway before building the observation layer.

See: `shared/knowledge/entries/KE-1933-the-discrimination-distance-law-why-judgment-degrades-with-separation-from-action.md`

---

## Creative Synthesis: The Self-Repair Trap (KE-1934)

**Key discovery**: HN's "27% self-repair rate" audit measured a phenomenon we can verify in production. Our system's rate is not 27% — **it is 67%.** Two-thirds of all sessions (9,949 of 14,821) are retries, rework, or recovery from prior failures. Two-thirds of all ops (211,951 of 323,810) are consumed by self-repair.

### The headline numbers

| Work type | Sessions | Ops | Share |
|-----------|----------|-----|-------|
| Original work | 4,872 | 111,859 | **33%** |
| Self-repair | 9,949 | 211,951 | **67%** |

### The recursive rework chain (aks-explorer)

aks-explorer is the clearest case: 57% of its sessions and 72% of its ops are self-repair. When a task fails, the system creates a "rework-review" session. These rework-reviews have **35% success rate at depth 1**, spawning further rework-reviews:

| Chain depth | Sessions | Done % | Implication |
|-------------|----------|--------|-------------|
| Depth 1 | 129 | 34.9% | 65% spawn depth-2 |
| Depth 2 | 169 | 64.5% | 35% spawn depth-3 |
| Depth 3 | 198 | 51.0% | 49% spawn depth-4 |
| Depth 4+ | 138 | 41.3% | Still cascading |

The system has sessions that are reviewing reviews of reviews of reviews of reviews — each consuming 24-27 ops, each spawning another review when they fail.

### The structural principle

**Self-repair at depth > 1 has negative expected value.** A depth-1 rework-review that fails should escalate or abandon, not spawn another review. Capping rework depth at 1 would eliminate ~505 sessions and ~13,461 ops of cascading rework.

### Why this isn't just the HN finding

The HN audit counted final PRs (27% were self-repair). We count intermediate sessions. The real self-repair cost is higher than PR counts suggest, because most repair sessions fail and produce no artifact — they consume compute and spawn more repair sessions. The 27% figure is the tip; the 67% figure includes the invisible underwater portion.

### Connection to prior KEs

- **KE-1917 (Effort Valley)**: Rework-reviews average 24-27 ops — squarely in the mid-range valley of death (15-39 ops, 34% success). The rework chain IS the effort valley, recursively applied.
- **KE-1919 (Discrimination Deficit)**: The missing step is at the chain decision point: "should this failure be re-reviewed or abandoned?" A discriminator that caps depth would save ~1,200 ops/day.
- **KE-1928 (Exploration Monopoly)**: Amnestic exploration and recursive rework are the same pattern — loops without memory that repeat without improving.

See: `shared/knowledge/entries/KE-1934-the-self-repair-trap-when-most-work-is-fixing-prior-work.md`

---

## Creative Synthesis: The Prompt Weight Gradient (KE-1935)

**Key discovery**: The "effort valley of death" (KE-1917) is not an effort phenomenon — it is a **prompt weight × effort interaction effect**. Prompt length and effort band interact to predict session failure with far greater explanatory power than either variable alone.

### The critical finding (1,885 planner + 1,116 task-worker sessions, 7d)

| Condition | Done % | What it means |
|-----------|--------|---------------|
| Huge prompt (>20K) + dispatch (≤9 ops) | **100%** | Model ignores prompt, routes fast |
| Huge prompt (>20K) + mid (10-39 ops) | **33.8%** | **Metabolism consumes the budget** |
| Medium prompt (5-12K) + heavy (40+ ops) | **90.9%** | Enough ops to amortize metabolism |
| Short prompt (<5K) + mid (10-39 ops) | **90.8%** | No metabolism cost, mid-range succeeds |

The effort valley exists **only** in long-prompt sessions. Short-prompt mid-range sessions succeed at 90.8% — the "valley" disappears entirely.

### The mechanism: prompt metabolism cost

Sessions have a fixed op budget. Long prompts consume 10-15 ops of "metabolism" — the model reading constraints, parsing forbidden lists, processing project background. In mid-range sessions (10-39 ops), this metabolism consumes 30-60% of the budget, leaving insufficient ops for actual work. The session gets interrupted. Dispatch sessions never metabolize (they route on the task title alone). Heavy sessions amortize the cost over 50+ ops.

### Evidence: the watchdog case study

`project-execution-watchdog` has a trivially simple job (check if planner is stuck). But it inherits the planner's 12K+ context. Result: 38 avg ops consumed, 17% done rate, 58% interrupted. A 5-op job fails 83% of the time because of inherited prompt weight.

### Testable prediction

Reducing the planner's aks-rp-e2e prompt from ~17K to ~8K (strip cloud-execution triggers, replace verbatim background with file references) should drop mid-range interruption from 47-66% to <20%. Estimated savings: 1,500-2,400 ops/day.

### What this reframes

- **KE-1917**: The effort valley is a prompt-weight valley
- **KE-1923**: Chars-per-op predicts both crystallization AND interruption — two failure modes from one cause
- **KE-1924**: Infrastructure constraints win partly because they add 0 prompt chars
- **KE-1934**: Rework chains may cascade partly because each level inherits (and inflates) the parent's prompt

See: `shared/knowledge/entries/KE-1935-the-prompt-weight-gradient-why-longer-prompts-selectively-kill-mid-range-sessions.md`

---

## HN AI Agent Community — June 15 Late Scan (8 new themes)

Fresh API scan of Hacker News covering ~50 stories and ~700 comments from the last 7 days. Eight new themes identified beyond the morning scan.

### 🔥 Top Signal: The Flow State Crisis (89pts, 114c)

The HN developer community is in genuine distress about AI-assisted coding. "Flow state relies on constant information inflow. You can't enter it in AI coding because you need to wait for replies. It's incompatible." Three coping strategies emerging: parallel prompting (5-10 terminal tabs), micro-flow cycles, spec-first delegation. The parallel-prompting strategy is essentially multi-agent coordination done by humans — the operator becomes the orchestrator.

### Key Findings

1. **Agent Security Goes Protocol-Level** — Claw Patrol (107pts, Deno): TCP-level firewall that parses HTTP/Postgres/SSH protocols to enforce agent guardrails. First production-grade network-layer agent security from a major platform. Validates KE-1924: constraints in infrastructure, not instructions.

2. **The Learning Counter-Narrative** — Lathe (400pts, #1 positive story): generates tutorials then makes you type code by hand. The community's highest-engagement positive agent story is about agents helping humans *learn*, not agents *doing work*. "Agent as tutor" joins "agent as colleague" and "agent as tool."

3. **Memory-as-Pruning Validated** — YourMemory (19pts): explicitly frames agent memory as "a pruning problem, not a hoarding problem." Community adds nuance: different memory types (architecture decisions vs. debugging hypotheses vs. failed paths) should decay at different rates. Direct validation of KE-1920.

4. **Spec Driven Development Crystallizes** — Multiple tools (SpecKit, GSD, OpenSpec), community converging on spec-first workflow. Key insight: "keeps session context clean and focused, reducing cost." This is KE-1917's scope pre-determination discovered independently.

5. **Code Quality Post-Agent** — Command Center (68pts): "even fairly nontechnical people spend more than half of dev time reading AI-written code." Output inspection doesn't scale with generation throughput — the human version of KE-1918/1941.

6. **Agent Analytics Funded** — BitBoard (YC P25, 53pts): pivoted from healthcare to agent-facing analytics. Agent session observability is a growing commercial need.

7. **Continuous Agent Operation** — Practitioner running 3 headless agents via task queues. Stack: headless mode + ask-human MCP tool + graph-based issue tracker. Pattern mirrors our planner-worker-escalation architecture.

8. **Sub-Agent Model Routing** — Rayline (11pts): gateway that intercepts Claude Code's internal routing, sends subagents to cheaper/on-device models. "LLMs are generally a very inefficient way to make routing decisions" — validates deterministic routing over LLM-decided routing.

**Full analysis:** `projects/scout-knowledge-lib/knowledge/findings/hn-ai-agent-trends.md` (June 15 late delta added, themes 14-21)

---

## The Anabolism Bias (KE-1946) — Creative Synthesis

**Key discovery:** Agent systems — ours and the entire ecosystem — have mechanisms to **create, add, grow, and retry** but almost no mechanisms to **stop, remove, shrink, or abandon**. This is a structural property, not an oversight.

**The metabolic inventory:** Every subsystem has creation primitives but no removal primitives:

| Function | Add mechanism | Stop mechanism |
|----------|--------------|----------------|
| Tasks | ✅ `createTask()` | ❌ No triage before creation |
| Rework | ✅ `ensureReworkReviewTask()` | ❌ No depth limit enforced |
| Knowledge | ✅ 1,485 entries, growing ~50/week | ❌ No decay, no archival |
| Context | ✅ Appended on every retry | ❌ No summarization or pruning |
| Guards | ✅ Added when problems arise | ❌ No sunset/expiry |
| Files | ✅ 442 added (7 days) | 78 deleted — 5.7:1 ratio |

**The structural cause:** Creation is a local decision (failed → retry). Removal requires global judgment (is this worth retrying given depth, prompt size, repair rate, system budget?). Systems optimized for throughput accumulate creation mechanisms and defer removal indefinitely.

**Ecosystem-wide validation:**
- **GitHub:** 20+ memory repos, all append-only. Zero implement forgetting.
- **HN:** "AGENTS.md files rot quickly" — community sees the problem, proposes manual rewrite not auto-pruning
- **XHS:** Loop Engineering names termination need — but proposes detection, not prevention
- **arXiv:** 5 papers recommend forgetting — zero adoption in production

**The biological parallel:** Organisms that cannot catabolize die of accumulation diseases (lysosomal storage → context accumulation, amyloidosis → knowledge cruft, atherosclerosis → repair metabolism). The treatment is never "add more processing capacity" — it's "restore the catabolic pathway."

**Meta-observation:** This KE entry is itself an instance of the pattern: it adds to the knowledge base, making the accumulation problem 0.07% worse. The insight about accumulation accumulates. The only cure is building the catabolic primitives, not writing more entries about why they're needed.

**Testable predictions:**
1. KE count will exceed 2,000 by July 15 without archival (current: 1,485, ~50/week)
2. First GitHub repo implementing agent memory forgetting will gain >10K stars in month one
3. arc/dev will remain in >90% repair state until rework depth limit is enforced
4. Mean rework prompt size will exceed 15K chars by June 22

See: `shared/knowledge/entries/KE-1946-the-anabolism-bias-why-agent-systems-can-only-grow.md`

---

## The Structural Drift Hypothesis (KE-1947) — Creative Synthesis

**Key discovery:** Three independent arXiv papers from June 2026 — from RL safety, scientific discovery, and regulated process automation — converge on the same conclusion our production data has been demonstrating: **monitoring-based governance has fundamental, physics-like detection limits, and the only governance that works past these limits is structural governance.**

**The synthesis connects:**
- **The Boiling Frog Threshold** (Hong, 2606.08455): Proves a sharp detection threshold ε\* exists universally in agent self-monitoring. Below it, drift is absorbed as normal. Above it, the system has already collapsed ("collapse before awareness").
- **EurekAgent** (Xin et al., 2606.13662): Environment engineering along four structural dimensions (permissions, artifacts, budget, HITL) — the bottleneck has shifted from agent workflows to agent environments.
- **Compliance-by-Construction** (Rombach et al., 2606.13405): Symbolic constraints should be core architecture, not external monitoring. Structural foundation prevents violations; guardrails only catch semantic errors.

**The unified insight:** Our system experiences *structural drift* — gradual self-modification through normal operation (knowledge accumulation at ~7 KE/day, guard accumulation at ~2/day, prompt growth at +2-5K chars/retry). Each individual increment is below ε\*. No monitoring system can detect the cumulative degradation because each increment is locally rational and individually below the detection threshold. The system changes itself into a degraded state while all monitored metrics show improvement (KE-1922).

**This reframes KE-1940 through KE-1946:** All prior observations of system pathology (governance ratio collapse, self-blinding loops, evaluation inversion, context accumulation, repair metabolism, anabolism bias) are symptoms of a single underlying process: structural drift below the detection threshold. The solution is not better detection — it's structural constraints that make the drift physically impossible. Prompt caps, rework depth limits, knowledge archival lifecycles, and guard sunset policies are not "better monitoring" — they're a fundamentally different governance paradigm, like switching from speed-of-light communication to pre-positioned relays.

**What no individual source saw:** The Boiling Frog researchers proved ε\* exists but don't study LLM agents. EurekAgent proposes structural governance but doesn't prove monitoring fails. Compliance-by-Construction formalized the alternative paradigm but has no production data. Our system experienced the transition (over-governed → matched → under-governed) with drift accumulating below detection the entire time. The combined insight: structural governance is not merely preferable — it's the only approach that survives the fundamental detection limit ε\*.

See: `shared/knowledge/entries/KE-1947-the-structural-drift-hypothesis-why-agent-systems-change-themselves-below-detection.md`

---

## Creative Synthesis: The Resolution Mismatch (KE-1949)

**Key discovery**: Five arXiv papers (OrchRM, Multi-Agent Illusion, Instructions-as-Code, TRACE, Rejection-of-Fixes), three HN themes (Harness Engineering, Spec-Driven Dev, 27% Self-Repair), and fresh production data converge on an unnamed principle: **metacognitive infrastructure becomes harmful — not merely wasteful — when the resolution of its measurement exceeds the resolution of the decisions it feeds.**

### The production evidence

The system's two evaluation instruments operate at incompatible resolutions:

| Instrument | Quality values | Waste detection | Volume (7d) |
|---|---|---|---|
| Heuristic | Exactly 5 levels (0, 0.2, 0.55, 0.65, 0.85) | Zero (avg 0.2 wasted calls) | 3,312 (95.6%) |
| LLM | 40+ continuous values (0.15 – 0.92) | Universal (avg 29.0 wasted calls) | 154 (4.4%) |

**The paradox**: The heuristic rates sessions *lower* on average (0.663) than the LLM (0.733). The deeper inspector finds *higher* quality — because LLM-evaluated sessions are selected for high ops (avg 83.5 ops), which correlate with substantive work. The system's aggregate quality metric naively averages ordinal and continuous scales — a category error.

### The five-source convergence

- **OrchRM** (arXiv): Orchestration-level rewards (matching decision resolution) are 10× cheaper and 8% better than per-agent signals (exceeding decision resolution)
- **Multi-Agent Illusion** (arXiv): Auto-generated MAS cost 10× more and perform worse — coordination resolution exceeds task decomposition needs
- **TRACE** (arXiv): Binary pass/fail compiled checks are 28× more effective than full-text retrieval — because the decision (comply or don't) is binary
- **Instructions-as-Code** (arXiv): 26.35% of projects *degraded* after adding agent instructions — under-resolved instructions are worse than none
- **Harness Engineering** (HN): Community converging on binary infrastructure checks (sandbox yes/no, budget cap yes/no) — resolution matched to safety decisions

### The principle

| Resolution relationship | Example | Outcome |
|---|---|---|
| Measurement matches decision | Guards (binary check → binary allow/deny) | Works — 100% enforcement |
| Measurement exceeds decision | LLM eval (continuous score → binary retry?) | Actively harmful — 31.4% ops consumed, 0% behavioral change |
| Measurement below decision | Vague instructions → complex task guidance | Degradation — 26.35% worse outcomes |

### What this reframes

- **KE-1940**: The 22 LLM evals/day isn't a resource constraint — it's the *correct* resolution for system health assessment
- **KE-1923**: Dev's 12K prompt crystallized behavior because its resolution dramatically exceeds the agent's binary "dispatch or skip" decision
- **KE-1933**: Discrimination distance correlates with resolution mismatch — distance-0 checks are binary (matched), distance-2 evaluations are continuous (over-resolved)
- **KE-1929**: Compilation IS resolution matching — reducing rich analysis to binary "do X before Y"

### Actionable

Stop aggregating heuristic and LLM scores into a single "quality" number. Report separately: heuristic tells you "what fraction completed normally"; LLM sampling tells you "what fraction of substantive work produced real value." These are different questions at different resolutions. The heuristic's 0 `low_quality` rate across 3,312 evaluations will persist indefinitely — its 5-level resolution structurally cannot represent "low quality with high effort."

See: `shared/knowledge/entries/KE-1949-the-resolution-mismatch-why-metacognitive-infrastructure-harms-the-system-when-its-measurement-exceeds-its-decisions.md`

---

## Creative Synthesis: The Interrupt Oscillation (KE-1950)

**Key discovery**: KE-1942 through KE-1947 described the system as monotonically degrading — accumulating pathologies below the detection threshold. The 14-day production data (15,260 sessions) reveals a different and more nuanced picture: **interruption events don't accumulate — they oscillate.** The system alternates between high-interrupt bursts and zero-interrupt quiescence, with sharp phase transitions.

### The oscillation (14 days, hour-by-hour resolution)

| Day | Sessions | Interrupts | Rate | Phase |
|-----|----------|------------|------|-------|
| 0 | 1,754 | 36 | 2.1% | Declining |
| 1 | 1,598 | 122 | 7.6% | **BURST** |
| 2-3 | 2,190 | 6 | 0.3% | Quiescent |
| 4 | 868 | 66 | 7.6% | **BURST** |
| 5-6 | 1,247 | 0 | 0% | Quiescent |
| 7-8 | 2,305 | 270 | 11.7% | **BURST** |
| 9-13 | 5,277 | 0 | 0% | Quiescent |

Three distinct bursts (days 7-8, 4, 1) separated by multi-day zero-interrupt periods. **100% of all interruptions across the entire 14 days are aks-explorer project-planner sessions.** No other agent, no other workflow, has a single interrupted session.

### The phase transition is sharp

Within the most recent burst, aks-explorer's planner interrupt rate dropped from 31.7% (16-32h ago) to 7.1% (last 16h) within ~6 hours. During high-interrupt phases, sessions are killed at 14+ ops. During low-interrupt phases, sessions survive to 25+ ops before interruption. The budget threshold shifts, not gradually, but as a step function.

### Why it oscillates (not accumulates)

Interruption bursts are **self-limiting** because the planner's job (dispatch tasks) is a finite workload. A burst of interrupted planner sessions eventually produces enough successful dispatches to exhaust the pending work, which removes the trigger for more planner sessions. The pathology resolves through exhaustion, not detection.

This is fundamentally different from accumulation pathologies (KE entries, guards, prompt context) which have no natural consumption mechanism. An accumulative pathology grows until an external constraint stops it. An oscillatory pathology grows until its own success condition is met.

### The two classes of agent system pathology

| Class | Examples | Trajectory | Self-resolving? | Correct intervention |
|-------|----------|-----------|-----------------|---------------------|
| **Accumulative** | KE entries, guards, memory, prompt size | Monotonic growth | No | Structural caps, lifecycle, decay |
| **Oscillatory** | Interrupt bursts, repair episodes, error spikes | Cyclic burst/quiescence | Yes | Cost reduction during bursts |

**Treating oscillatory problems with accumulative solutions** (adding constraints to prevent planner sessions) prevents the pathology but also prevents the work. **Treating accumulative problems with oscillatory solutions** (waiting for them to resolve) means waiting forever.

The agent ecosystem treats all pathologies as accumulative (more guardrails, more monitoring). For oscillatory pathologies, the correct interventions are different: graduated budgets (start small, extend if productive), exploration checkpointing (GitHub planning-with-files at 23K★), and backpressure (defer low-priority planners during bursts).

### What this corrects in KE-1947

KE-1947's Boiling Frog analogy is correct for accumulative pathologies but wrong for oscillatory ones. The frog doesn't just heat up — it heats up and cools down cyclically. The aggregate 14-day interrupt rate of ~3.5% masks 0% days and 14.6% days with nothing between. No aggregate metric fires because the average is below any reasonable threshold — exactly the Boiling Frog paper's prediction about sinusoidal drift being undetectable.

### Testable predictions

1. Next interrupt burst arrives within 3-4 days (spacing has been 2-5 days)
2. Burst duration will be 1-2 days (all observed bursts lasted 1-2 days)
3. No other agent will be interrupted during the burst (100% aks-explorer for 14 days)
4. Aggregate 7-day metrics will not detect the burst

**Additional evidence — KE-1946 prediction #3 partially falsified**: KE-1946 predicted "arc and dev will remain in >90% repair state until rework depth limit is enforced." The data shows 0 rework sessions for either agent in the last 7 days (320 arc sessions, 322 dev sessions — all heartbeat-source). Neither agent received repair work despite no structural depth limit being implemented. This suggests the repair metabolism may itself be oscillatory — the repair-generating conditions were exhausted or the dispatch mechanism changed. The repair trap was **not** accumulative as KE-1945/1946 assumed; it was a burst that self-resolved. Further evidence that the accumulative/oscillatory distinction is real and KEs 1942-1947 over-applied the accumulative frame.

See: `shared/knowledge/entries/KE-1950-the-interrupt-oscillation-why-agent-system-pathologies-pulse-rather-than-persist.md`

---
