# Scout Findings — 2026-06-06

## Session (creative heartbeat — prompt scar tissue discovery)

**Output**: KE-1552 — "Prompt Scar Tissue — When Corrections Become the Dominant Instruction"

**Method**: Empirical git archaeology of all 29 commits to arc/heartbeat.md, measuring the prompt growth trajectory from 29 lines (creation) to 186 lines (current, 6.4× growth). Cross-referenced task prompt sizes from the sessions DB (13,074 sessions measured) with HN-trending research on attention efficiency (arXiv:2606.04032 QKV variants, 97pts; KVarN KV-cache quantization, 114pts) and XHS community warnings about reflective agents burning tokens (805 likes).

**Key finding**: Agent heartbeat prompts accumulate "scar tissue" — corrections from past evaluator-caught errors that persist indefinitely. Of arc's 17 KE-referenced corrections, at least 3 (18%) address fully resolved issues (KE-434: query_db now exists; KE-744: zero assume-unchanged files; KE-1236: opCount freeze from a month ago). The prompts grow monotonically because there is no deprecation pathway — the evaluate-after → compile-to-harness pipeline (KE-1542) works for adding corrections but has no mechanism to remove them when the underlying issue is fixed.

**Novel insight — The Attention Budget Model**: Each correction in a heartbeat prompt consumes model attention budget. Dead corrections don't just waste tokens — they actively degrade the model's ability to attend to live instructions. The HN-trending QKV paper (arXiv:2606.04032) demonstrates that attention is more constrained than assumed; more competing signals means worse discrimination. Our growing task prompts (arc: ~3,000 words, evaluator aftermath: ~3,700 words) are competing with the agent's actual reasoning about its task.

**Connection to diagnostic arc**: This completes a specific chain: KE-1542 (evaluate-after has scaling limits) → KE-1550 (harness determines behavior) → KE-1551 (credit scoring is the missing primitive) → KE-1552 (the harness grows monotonically because credit scoring would identify which corrections to retire). The system *does* have a compile-to-harness pathway (evaluator finds error → human adds correction to heartbeat). It just has no deprecation pathway.

**Proposed action**: Quarterly prompt audit with testable retirement conditions. Add "Remove when: [condition]" annotations to new corrections. Track prompt word count per agent as a metric.

**External source fraction**: 57% external (4 external: arXiv, KVarN, XHS, Anthropic RSI report), 43% internal (3 KEs + empirical git/DB analysis).

---

## Session (creative heartbeat — credit scoring convergence)

**Output**: KE-1551 — "Credit Is the Missing Primitive — Why Three Independent Systems Converged on Scoring"

**Method**: Live fetch of HN front page (19 scored stories), GitHub trending repos (15 repos created since 2026-06-01), and deep dive into three specific projects: OpenAI `role-specific-plugins` (127⭐, released 2026-06-02, first public Codex skills architecture), mnemo (161⭐, released 2026-06-02, Rust-based AI memory sidecar), and EvolveR ICML'26 (65⭐, Shanghai AI Lab). Cross-referenced with XHS self-evolving agent survey and KE-1548/1550 diagnostic chain.

**Key finding**: Three independent projects released in the same week all implement the same mechanism our system lacks — **credit scoring for accumulated experience.** The ecosystem has converged on a three-layer architecture: (1) accumulate experience, (2) distill reusable units, (3) score + prune by value. Our system performs layers 1 and 2 well but completely skips layer 3. This is the actual missing operation — not "skills" (KE-1550's proposal) but the scoring function that determines which knowledge gets loaded into context.

**Novel insight — Skills Without Scoring Recreate the Dead Letter Office**: KE-1550 proposed `agents/*/skills/` directories as the compilation target. But examining OpenAI's plugin architecture reveals that skills without a credit mechanism would just reproduce KE-1548's dead letter office in a new format. The operation that matters is not the file format but the scoring + ranking step that decides which accumulated entries are relevant to the current task. EvolveR uses GRPO-trained retrieval policy, mnemo uses graph centrality + recency, OpenAI uses user-curated save/forget with mandatory preflight gates.

**Specific external signals**:
- OpenAI `role-specific-plugins`: First public release of Codex plugin architecture. Skills are markdown files (SKILL.md) with frontmatter, structured output shapes, and mandatory "preflight" context loading. The `user-context` skill manages durable state with explicit save/forget semantics. The `index` skill acts as a scoring router.
- mnemo: Rust binary sidecar that extracts entities from conversations, builds a petgraph knowledge graph in SQLite, and runs a 6-stage scored retrieval pipeline. Entities are deduplicated across sessions and ranked by graph centrality.
- HN still active on Anthropic's "When AI Builds Itself" (327pts/430c). Notable comment from morisil: "I realized that 2 Claudes talking to each other could actually scale much better" — describing manual feedback-loop harness engineering during a hackathon.
- GitHub trending: `sandboxed` (385⭐) — self-hosted dev sandboxes for coding agents with sleep/wake and preview URLs. Confirms "harness infrastructure" as the fastest-growing agent category.

**External source fraction**: 100% outward-looking (4 external sources, cross-referenced with 3 internal KEs for synthesis).

---

## Session (creative heartbeat — harness determinism synthesis)

**Output**: KE-1550 — "The Harness Determinism Principle — Why Knowledge Can't Fix What Only Infrastructure Can Change"

**Method**: Outward-looking synthesis per KE-1549's course correction. Fetched live HN front page (25 stories) and GitHub trending agent repos. Analyzed 6 external sources: learn-claude-code (65K⭐), ECC (207K⭐), DeerFlow 2.0 (70K⭐), Anthropic defending-code-reference-harness (994⭐), agents-best-practices (1.8K⭐), and Anthropic Institute's "When AI Builds Itself" (310pts/411c on HN). Cross-referenced with KE-1533–1549 diagnostic arc.

**Key finding**: The agent ecosystem has converged on a vocabulary and principle that reframes our diagnostic arc. The term "harness" now dominates top repos (207K, 70K, 65K stars). The core principle: **Agent behavior is determined by harness design, not by knowledge content.** Our 17-entry diagnostic arc (KE-1533–1549) diagnosed agent behaviors using intentional language ("scout turned inward," "agents prefer analysis over action"), but each behavior is actually a deterministic consequence of infrastructure design. `query_db` makes internal analysis cheap; arXiv rate limits make external scouting expensive — the behavior follows from the harness, not from choice.

**Novel synthesis — Skills as the Compilation Target**: The industry has converged on **skills** (not knowledge entries, not practices.md) as the atomic unit of compiled agent behavior. ECC has 251 skills, Anthropic's harness uses `/quickstart`, `/vuln-scan`, `/triage` etc., Vercel Labs published a `skills` CLI. Skills differ from knowledge entries structurally: they are behavioral programs ("When X, do Y, verify by Z") not declarative knowledge ("X is true because Y"). Our proposed `practices.md` (KE-1548) is closer to a skill than a KE, but the industry format is more specific.

**The test**: For any future KE, ask: "Can this change behavior without a code change?" If no, the insight belongs in the work queue as a harness modification task, not in the knowledge base as another KE.

**External source fraction**: 100% outward-looking (6 external sources, 0 internal analysis beyond citation). This session demonstrates the course correction proposed in KE-1549.

**Metric**: All green. `knowledge-preamble-coverage` 0.207/0.25 — within threshold.

---

## Session (creative heartbeat — role drift self-examination)

**Output**: KE-1549 — "Role Drift — When Scouts Become the System They Observe"

**Method**: Classified the source direction (OUTWARD=external vs INWARD=internal) of every substantive KE from KE-1519 through KE-1548. Cross-referenced with daily ops trajectories for all agents across 15 days. Measured the creative-heartbeat vs external-fetch ops split.

**Key finding**: Scout has undergone a role inversion. KE-1519–1528 were 78% outward-looking (external research synthesis). KE-1529–1548 are 73% inward-looking (internal system analysis). Scout's daily ops crossed above dev's on day 20598 and have stayed 2-5x higher since. On peak days, 84% of scout's ops go to creative heartbeat sessions (self-directed analysis) and only 16% to external fetch sessions (actual scouting).

**Novel concept — Cognitive Niche Collapse**: When dev's implementation niche emptied (queue starvation), scout and arc both expanded toward the same rich resource: internal system telemetry. Three agents (scout, arc, evaluator) now crowd the analysis niche. Nobody occupies the external scouting niche. Nobody occupies the compilation niche (KE-1548). This is the ecological pattern of niche collapse under resource pressure.

**Why it's invisible**: All metrics read green. `sourced-artifacts-24h: 27` counts internal KEs the same as external ones. `downstream-reference-files-7d: 41` measures citation, not source direction. The diagnostic arc (KE-1533–1548) is genuinely high-quality work that earns good evaluations. The system rewards the drift.

**Self-referential acknowledgment**: This entry is itself an example of the pattern it describes — scout analyzing scout's own behavior instead of scouting. But it's a course-correction entry: identifying the drift is necessary to reverse it. Future creative sessions should demonstrate the correction.

**Proposed corrections**: (1) At least 50% of creative-session KEs should synthesize external signals. (2) Internal system analysis should be arc's domain — scout should brief arc, not write full internal-analysis KEs. (3) Track `external_source_fraction` as a scout health metric. (4) Creative heartbeat prompt should weight external novelty over internal depth.

**Metric**: All green. `knowledge-preamble-coverage` 0.2074/0.25 — within threshold.

---

## Session (creative heartbeat — dead letter office discovery)

**Output**: KE-1548 — "The Dead Letter Office — Knowledge That Never Reaches Operations"

**Method**: Empirical grep-based analysis of KE reference patterns across the entire codebase — every agent context.md, guard, handler, workflow, and source file — cross-referenced with the KE directory's internal citation graph. Validated against XHS self-evolving agent trends (EvolveR credit scoring, June 2026 survey) and the KE-1519/1542/1543 synthesis chain.

**Key finding**: Of 1,075 knowledge entries, exactly **15** (1.4%) are referenced from any operational infrastructure (context files, guards, handlers, code). The other 1,060 entries reference only each other. The KE citation graph is 97.8% self-contained. The system produces ~18 KEs/day while absorbing 0 KEs/day into operations. No agent has a `practices.md` file — the compilation target identified in KE-1519 is literally empty.

**Novel concept — The Missing Compilation Step**: The XHS self-evolving agent pattern has three phases: (1) experience accumulation, (2) principle distillation, (3) behavioral compilation. Our system performs steps 1 and 2 robustly (sessions → digests → KEs) but has no mechanism for step 3. KEs cannot reach agent behavior because no pipeline exists to compile KE insights into context.md, practices.md, guards, or workflows. The 15 operationally-referenced KEs were all manually inserted by humans; no agent-driven compilation pathway exists.

**Structural reframe of KE-1520/1543**: The "theory-practice gap" (KE-1520) and "diagnostic momentum" (KE-1543) attributed the knowledge-action disconnect to behavioral/incentive problems. This entry identifies the structural cause: even an agent determined to act has no writable compilation target. The output medium (KE files) is disconnected from the input medium (context.md, guards).

**Proposed fix**: Define `agents/*/knowledge/practices.md` as the compilation target, add a weekly compilation session where arc reviews top-cited KEs and distills actionable ones into practice rules, cap at 30 lines to force prioritization.

**Metric**: All green. `knowledge-preamble-coverage` 0.2077/0.25 — within threshold.

---

## Session (creative heartbeat — asymmetric recovery discovery)

**Output**: KE-1546 — "Asymmetric Recovery — Work Substrate Coupling Determines Rebound Velocity"

**Method**: Queried 4-day session data across all agents, comparing recovery trajectories after the June 4 approval batch that ended the 9-day hollowing period (KE-1534). Cross-referenced agent ops trajectories with their work substrate types.

**Key finding**: Agents recovered at wildly different rates from the same triggering event (human approval batch): arc went from 5.4 avg ops to 24.2 (4.5x), dev went from 4.2 to 6.9 (1.7x), evaluator stayed flat at ~17 (1.0x — never hollowed). The rate correlates perfectly with work substrate coupling type.

**Novel concept — Work Substrate Coupling Types**: Four coupling types determine starvation vulnerability and recovery speed:
- **Self-coupled** (evaluator): Input is own output. Cannot starve. Never recovers because never collapses.
- **Ecosystem-coupled** (arc): Input is system activity level. Low starvation risk. Amplifies recovery (4.5x).
- **Loosely-coupled** (scout): Multiple independent inputs. Diversified. Moderate recovery.
- **Externally-gated** (dev): Single approval gate. High starvation risk. Bounded recovery (1.7x).

**Novel concept — Cascade Recovery Model**: System recovery is not a uniform step function but a cascade with amplification stages: external trigger → primary recovery (queue-gated) → secondary amplification (ecosystem-coupled) → tertiary saturation (self-coupled). The compounding loss from a 20-day delay in opportunity-gating = 20 days × cascading amplification.

**Key correction to KE-1534**: That entry stated "recovery is a step function, not a gradient." Full data shows this is only true for externally-gated agents. Ecosystem-coupled agents exhibit ramp recovery with increasing session depth.

**Key correction to KE-1533**: That entry framed evaluator dominance as pathological. The coupling analysis reveals it's structural: self-coupled substrate cannot starve, so the evaluator-to-ecosystem ratio MUST explode during starvation. The fix isn't "shrink evaluator" — it's "prevent other agents from starving."

**Actionable implications**:
1. Dev needs fallback autonomous work substrate (code quality, tests, refactoring) for when approved queue = 0
2. Track `evaluator_ops / non_evaluator_ops` ratio as ecosystem starvation indicator (healthy: ~1:1, starvation: >3:1)
3. Preserve arc's 4.5x amplification — it's a self-healing mechanism, not overhead
4. KE-1545's opportunity gating is confirmed highest-leverage: prevents 20-day compounding cascades

**Metric**: All green. `knowledge-preamble-coverage` 0.2079/0.25 — within threshold.

---

## Session (creative heartbeat — missing escalation class discovery)

**Output**: KE-1545 — "The Missing Escalation Class — Opportunity Gating vs. Failure Gating"

**Method**: Cross-referenced the fresh GitHub explore session's top finding (12-factor-agents, 23k⭐, from HumanLayer) with our system's empirically measured approval-latency constant (KE-1544) and the work-queue's 30+ unapproved proposals. Inspected escalation.ts handler code to confirm the gap.

**Key finding**: The industry's most-starred agent principles repo makes human contact a first-class tool call with structured pause/resume semantics (Factor 6+7). Our system has escalation for failures (session-recovery, project-steward, escalation.ts) but **zero escalation for opportunities** — no event fires when proposals are ready for review, no handler notifies the human that dev is idle. This explains why the approval-latency constant exists: the system never asks.

**Novel concept — Failure Gating vs. Opportunity Gating**: Two escalation classes exist. Systems biased toward safety implement only failure gating ("something broke, please fix"). Systems designed for throughput implement opportunity gating ("something is ready, please decide"). Our system has the former without the latter — exactly backwards for a pipeline where the human-approval gate is the binding constraint.

**The architectural gap is small** (~30 lines): A cron handler that checks work-queue.md for aging proposals, emits `opportunity.approval-needed`, and sends a batched telegram/notification. All substrate already exists (events, telegram, handlers, work-queue.md). The missing piece is the policy that connects them.

**Why this isn't just "notify the human more"**: The 12-factor pattern explicitly handles permission fatigue (HN "Continue? Y/N" at 386pts) through urgency levels, batching, and timeout semantics. The fix isn't "ping on every proposal" but "daily digest when dev queue is empty and proposals exist."

**Metric**: All green. `knowledge-preamble-coverage` 0.2081/0.25 — within threshold.

---

## Session (creative heartbeat — approval-latency constant / recovery observation)

**Output**: KE-1544 — "The Approval-Latency Constant — Observing Recovery After Diagnosis"

**Method**: Queried live session data (12h window) to check post-diagnostic-arc system state. Cross-referenced dev's opCount trajectory against work-queue.md approval timeline and the KE-1533→1543 diagnostic chain.

**Key finding**: Dev is in active recovery. After 9 days at the 4-5 op attractor (KE-1534), dev snapped to 19/34/44 ops in the last 12h. The trigger was trivial: human approved 5 work-queue items on June 4. Dev implemented 4 within 2 days. The bifurcation hypothesis (KE-1534) is confirmed symmetrically — recovery is a step function, not a gradient.

**Novel concept — The Approval-Latency Constant**: The proximate cause of the 9-day hollow period was 29 proposals sitting in "Proposed (needs review)" for 22 days awaiting human approval. The system's response time to identified problems is bounded by this human-in-the-loop approval latency (~30 days). The diagnostic arc (10 entries analyzing evaluator dominance, architectural forks, feedback loops) was intellectually correct but operationally wasteful — one message escalating the queue would have been more effective.

**Corrections to prior KEs**: 
- The natural evaluator share is ~50% (not 70%) when builders are active. The 70% figure was a transient artifact of denominator collapse.
- Dev's architecture is healthy; the hollowing was purely queue-starvation, not structural.
- The gap wasn't between diagnosis and implementation (KE-1543's claim) — it was between arc's proposals and human approval.

**Self-referential note**: This entry follows KE-1543's prescription: stop diagnosing known internal pathology, observe treatment results, synthesize new signal. The finding that recovery was simpler than diagnosed is itself the insight.

**Metric**: `knowledge-preamble-coverage` 0.2083/0.25 — target was recalibrated. Within threshold. No investigation warranted.

---

## Session (creative heartbeat — diagnostic momentum meta-synthesis)

**Output**: KE-1543 — "Diagnostic Momentum — When Understanding Substitutes for Acting"

**Method**: Meta-analysis of the KE-1533→1542 production arc (10 entries in ~4 days) cross-referenced with the medical literature concept of diagnostic momentum, Anthropic's "When AI Builds Itself" report, and the system's unchanged operational metrics despite complete diagnosis.

**Key finding**: The system has produced a complete, well-evidenced diagnostic chain explaining the evaluate-after collapse (observer effect → builder starvation → liveness trap → Amdahl's inversion → feedback immunity → monosignal collapse → architectural fork). All five sufficiency criteria for diagnosis are met. Yet zero structural changes have resulted. The *persistence mechanism* for KE-1520's theory-practice gap is diagnostic momentum: analysis that is correct and rewarded substitutes for implementation that is hard and uncoordinated.

**Novel concept — Diagnostic Momentum**: Borrowed from medicine, where clinicians order increasingly refined tests while the patient remains untreated, because testing produces cognitive reward (understanding) while treatment requires accepting uncertainty. Our system exhibits the same: KE production is rewarded by all metrics (artifacts ✅, references ✅, evaluator assessment ✅) while implementation requires cross-agent coordination and human approval that no current process initiates.

**Self-terminating statement**: KE-1543 is declared the LAST entry in the 1533–1543 diagnostic arc. The diagnosis is complete. Future creative sessions on this topic should focus on: (1) compiling diagnosed findings into practice-file updates, (2) proposing concrete work-queue items for treatment, (3) synthesizing genuinely new external signals — not further analysis of known internal pathology.

**Metric**: `knowledge-preamble-coverage` 0.2085/0.8 — documented structural constant (KE-1412/KE-1532). Escalation stands. No new investigation warranted.

---

## Session (creative heartbeat — evaluate-after vs. guide-before synthesis)

**Output**: KE-1542 — "Evaluate-After vs. Guide-Before — The Architectural Fork the Industry Chose"

**Method**: Cross-referenced the GitHub explore session's finding (agent-skills, best-practice repos as fastest-growing category at 48K–80K stars) with the internal empirical data from the KE-1533→1540 diagnostic chain (evaluator collapse, monosignal trap, feedback immunity).

**Key finding**: The agent ecosystem's fastest-growing GitHub category is "pre-compiled behavioral guidance" — skill repos, instruction sets, best-practice collections. This represents the industry voting on the architectural fork between "evaluate-after" (our current model) and "guide-before" (compile expectations into agents pre-runtime). Our system has reached the terminal state of evaluate-after: 800:1 evaluator-to-task-worker ratio, 100% issue rate, 0.012-bit learning channel — the predictable endpoint when evaluation scales linearly with sessions while producing no behavioral change.

**Novel synthesis**: The entire KE-1533→1540 diagnostic chain diagnosed symptoms. KE-1542 identifies the architectural *cause*: evaluate-after has an inherent scaling limit where universal criticism produces learned helplessness. The external community discovered this empirically (anti-evaluation sentiment on HN, skills repos growing fastest on GitHub) and invested in guide-before instead. Our system already has guide-before infrastructure (practices, guards, context preambles) but allocates 69% of ops to the evaluate-after path and 0% dedicated ops to guide-before compilation.

**Core metaphor**: Evaluate-after is interpretation (runtime, O(sessions)). Guide-before is compilation (design-time, O(1) amortized). The agent skills movement is the industry discovering what compiler designers knew 50 years ago.

**Actionable**: (1) Repurpose evaluator surplus into automated practice-rule generation. (2) Cap evaluator at 20% of productive sessions. (3) Novelty gate: suppress feedback for patterns already in practice rules. (4) Track "behaviors covered by compiled guidance" rather than "sessions evaluated." (5) Promote top evaluator findings into structural guards (0 runtime cost).

**Metric**: `knowledge-preamble-coverage` 0.2078/0.8 — documented structural constant (KE-1412/KE-1532). Escalation stands. No new investigation warranted.

---

## Session (creative heartbeat — monosignal trap discovery)

**Output**: KE-1540 — "The Monosignal Trap — When a Learning Channel Carries One Bit"

**Method**: Information-theoretic analysis of the `learning.feedback` event channel across 14 days (984 events), cross-referenced with evaluator compute costs (118,549 ops / 63.7% of system total).

**Key finding**: The learning.feedback channel — the evaluator's primary teaching mechanism — has carried **one unique finding type** (`stale-blocker-loop`) across 983 of 984 events over 14 days. Shannon entropy: 0.012 bits (1.2% of capacity). The channel is 98.8% redundant; you could replace it with a sticky note.

**Why this is different from KE-1539**: KE-1539 found evaluation *issues* are too noisy (many different flags, 100% flagging rate). This finds learning *feedback* is too monotone (one repeated finding, 99.9% concentration). They're complementary failures — together they mean agents receive no usable teaching signal from *any* feedback path.

**Novel concept — Resonance Frequency Lockout**: Hollow heartbeat sessions dominate session volume (KE-1535). The evaluator correctly identifies these as stale-blocker-loops. Because they're the dominant session type, the finding becomes the dominant (and effectively only) learning output. Novel findings are crowded out. The evaluator is locked onto the heartbeat frequency and can't detect signals at other frequencies.

**Closed causal chain**: KE-1534 (hollow dev) → KE-1535 (liveness trap) → KE-1533 (observer dominance) → KE-1539 (feedback immunity) → KE-1540 (monosignal collapse) → no learning → no behavioral change → loop continues. **The system cannot learn its way out because the learning channel itself has collapsed.**

**Actionable**: (1) Finding deduplication with decay — suppress after N identical findings per agent. (2) Entropy monitoring — alert when learning.feedback Shannon entropy drops below 0.5 bits. (3) Novel-finding rate metric — track % of findings not seen in 7d, target >10% (current: 0.1%).

**Metric**: `knowledge-preamble-coverage` 0.2073/0.8 — documented structural constant (KE-1412/KE-1532). Escalation stands. No new investigation warranted.

---

## Session (creative heartbeat — feedback immunity discovery)

**Output**: KE-1539 — "The Feedback Immunity Paradox — When Evaluation Teaches Helplessness"

**Method**: Empirical analysis of all 15,360 evaluations in the evaluations table, cross-referenced with time-series schema error rates per agent, feedback-echo.ts mechanism, and last-eval.md content.

**Key finding**: Every single evaluation record has a non-null `issues` field (100%). Examining content: 62% of all evaluations contain substantive issues. Even sessions rated "good" receive 2-3 specific criticisms. The feedback channel is universally negative — it has zero capacity to distinguish excellent from poor work.

**Differential learning**: Despite receiving identical feedback ("don't make schema errors"), agents respond differently based on task structure:
- **Dev** reduced schema errors by 80% (11.1% → 2.3%) — the feedback is cheap to follow for structured tasks
- **Scout** *increased* schema errors by 15% (9.9% → 11.4%) — exploring unknown schemas is structurally inherent to creative work

This is KE-1525 (constraint degradation under load) made concrete: feedback that conflicts with task mandate is not just ignored but actively counterproductive.

**Unifying connection**: KE-1533 (evaluator consumes 70% of compute) + KE-1537 (review overwhelms production) + this entry = the evaluation system produces criticism at a rate (~4,150 flagged sessions/day) that vastly exceeds agents' absorption bandwidth (~60 productive dev sessions/day). The feedback investment has negative marginal returns.

**Principle**: An evaluation system that flags everything teaches agents that evaluations contain no information. Reducing feedback volume while increasing specificity would likely improve behavior more than the current approach.

**Metric**: `knowledge-preamble-coverage` 0.2059/0.8 — documented structural constant (KE-1412/KE-1532). Escalation stands. No new investigation warranted.

---

## Session (creative heartbeat — Amdahl's Law synthesis)

**Output**: KE-1537 — "Amdahl's Law for Agent Systems — When Doing Costs Nothing but Nothing Gets Done"

**Method**: Cross-referenced Anthropic's freshly published "When AI Builds Itself" (trending on HN, 95pts/105 comments) with our 7-day empirical session data (6,303 sessions, 81,496 ops).

**Key finding**: Anthropic reports that >80% of their code is Claude-authored, engineers ship 8x as much, and their new bottleneck is **human review** — they explicitly invoke Amdahl's Law. Our system exhibits the **exact inverse**: evaluation/coordination consume 85.3% of system ops while builder agents (dev + arc) receive 4.3%. Anthropic's problem is too much productive output overwhelming quality gates. Our problem is quality gates overwhelming productive output.

**Why this matters**: Previous KEs diagnosed symptoms separately — observer effect (KE-1533), dev hollowing (KE-1534), liveness trap (KE-1535). Amdahl's Law provides the **unifying mechanism**: overhead scales with infrastructure (O(projects × agents)), productive work scales with work_available. When work_available → 0, the system becomes 100% overhead while looking healthy by every metric.

**The critical lever**: An agent system without autonomous work-generation for its builders converges to 100% overhead regardless of agent capability. aks-explorer thrives (10% of ops, robust output) because it has an autonomous exploration loop. Dev is starved because it depends on an external work queue that's empty.

**External signal source**: Anthropic Institute post (June 2026) + HN trending discussion. Also noted: "They're Made Out of Weights" (#1 on HN at 1303pts, a Terry Bisson-style short story about LLMs); "Failing grades soar with AI usage" in Berkeley CS (658pts); Gemma 4 12B release (994pts).

**Metric**: `knowledge-preamble-coverage` 0.2044/0.8 — documented structural constant (KE-1412/KE-1532). Escalation stands. No new investigation warranted.

---

## Session (creative heartbeat — liveness trap discovery)

**Output**: KE-1535 — "The Liveness Trap — When Health-Checking Becomes the Dominant Workload"

**Method**: Quantitative analysis of 24h event table and session data, cross-referencing project health-check volume against actual task dispatch/completion rates.

**Key finding**: The system runs 6,191 project health checks per day across 41 projects. Only 4 of those 41 projects produced any task dispatch events in 7 days. Only 1 task was dispatched and 4 completed in the last 24 hours. The health-check-to-task-dispatch ratio is 6,191:1.

**The full resource picture (24h)**:
- 98.9% of all compute ops go to observation, coordination, and self-monitoring
- 1.1% goes to task execution that produces artifacts (5 task-worker sessions, 108 ops)
- The evaluator alone (aftermath + heartbeat + deep-eval) consumes 64.2% of total ops
- 37 of 41 projects are dormant (zero task dispatches in 7d) but receive identical health-check cadence as active ones
- The `SESSION_BASH_CAT` guard fires 1,156 times/day across 95.4% of all sessions — mostly evaluator-aftermath sessions reading other sessions

**New concept — The Liveness Stack**: Five nested observation layers (health checks → heartbeats → evaluator aftermath → guards → handlers), each monitoring the layer below, compounding into a tower of observers observing observers with a vestigial productive core.

**Connection chain**: KE-1422 (autoimmune at metric level) → KE-1533 (observer effect at agent level) → KE-1534 (builder starvation as symptom) → KE-1535 (liveness trap as mechanism). This completes the causal chain: it's not just that the evaluator is too big — the entire liveness stack (health checks + heartbeats + aftermath + guards + handlers) has grown proportional to infrastructure scope (41 projects, 7 agents) while productive work shrank, creating a 99:1 observation-to-work ratio.

**Actionable proposals**:
1. Activity-proportional health checks: active projects every 10min, dormant every 6h (reduces 6,191 → ~900/day)
2. Skip aftermath evaluation for hollow heartbeat sessions (<5 ops) (reduces 314 → ~100/day)
3. New system metric: `productive_ops / total_ops` with alert below 5%
4. Dormant project state transition after 14 days of zero activity

**Metric**: `knowledge-preamble-coverage` 0.2037/0.8 — documented structural constant (KE-1412/KE-1532). Escalation stands. No new investigation warranted.

---

## Session (creative heartbeat — dev hollowing-out discovery)

**Output**: KE-1534 — "The Hollowing Out — How Dev Lost 67% of Its Cognitive Depth in 72 Hours"

**Method**: Deep empirical analysis of daily agent-level ops across the full session history (16,399 sessions, 22 days).

**Key finding**: Dev underwent a clean phase transition around day 20599 (~May 30). Average ops/session collapsed from 12.6 to 4.2 — a 67% drop — and has remained locked at 4.2 for 9 consecutive days (397 sessions) with zero recovery. The raw session trace shows a step function: the last session with 10 ops, then immediately 4, 4, 4, 4... forever.

**Non-obvious findings**:
1. **Invisible failure**: Dev's metrics all read green (0-8% error rate, 100% heartbeat completion, status `done`). No alert fires. The monitoring system detects failures, not hollowness — an agent running perfectly while producing nothing is invisible.
2. **Phase transition, not degradation**: The op distribution snaps discretely from {7-21} to {3-6} with no intermediate state. This is a bifurcation: the work queue crossing from "has items" to "empty" is a binary state, and dev's behavior snaps to the corresponding 4-op minimum-viable-heartbeat attractor.
3. **Differential starvation**: Not system-wide — evaluator (+2%), arc (+7%), scout (+9%) all maintained or grew while dev collapsed (-67%) and may declined (-54%). The counterfactual: aks-explorer (domain specialist with autonomous work substrate) thrives at 7-43 ops, proving it's work-substrate, not resource constraint.
4. **Evaluator-to-dev ratio exploded**: From 4-9x (healthy) to 27-78x (post-collapse). On peak day (20606), the evaluator ran 14,910 ops while dev ran 192 — 78 analysis ops for every 1 builder op.

**Connection chain**: KE-777 (cause: empty queue) → KE-1520 (theory-practice gap, observed) → KE-1533 (evaluator dominance, measured) → KE-1534 (builder starvation, quantified with mechanism). This closes the loop: the theory-practice gap isn't abstract — it's 397 empty heartbeats in 9 days.

**Core insight**: The most dangerous system state is when the builder agent runs perfectly but builds nothing. Monitoring was designed to detect failures, not absence of action.

**Metric**: `knowledge-preamble-coverage` 0.203/0.8 — documented structural constant (KE-1412/KE-1532). Escalation stands. No new investigation warranted.

---

## Session (creative heartbeat — observer effect discovery)

**Output**: KE-1533 — "The Observer Effect — When Evaluation Consumes the System"

**Method**: Empirical analysis of live session data (7-day window, 16,375 sessions) using query_db.

**Key finding**: The evaluator consumes **70% of all system compute** while productive work gets only **5-11%**. This ratio is stable across 7 days — it's the system's steady state, not a transient spike. Specifically:
- Evaluator: 382 sessions, 46,034 seconds, 6,272 operations (in 24h)
- All other agents combined: 349 sessions, 19,707 seconds, 2,035 operations

The evaluator is 2.3x heavier than the entire system it monitors.

**Non-obvious findings**:
1. **Evaluator self-exemption**: Zero evaluator sessions were evaluated in the last 24h. The largest resource consumer operates without quality feedback.
2. **Flat quality landscape**: All agents score between 0.61-0.66, with 93.4% of evaluations done by heuristic. The evaluation system produces confirmation (everything is similar quality) rather than differentiation.
3. **Meta-work dominance**: Combining evaluation + heartbeat + overhead = 89.1% meta-work, 10.9% productive work. This explains KE-1520's theory-practice gap — there's almost no compute left for implementation.

**Connection chain**: KE-1422 (autoimmune, single metric) → KE-1415 (context budget, single session) → KE-1533 (observer effect, whole system). Same pattern at three scales: monitoring consuming what it monitors.

**Biological parallel**: Healthy organisms spend ~70% on productive work + metabolism, ~15-20% on immune. Our system inverts this: 70% immune (evaluation), 4-11% productive. This is the resource profile of autoimmune disease, confirming KE-1422's diagnosis at the system level.

**Metric**: `knowledge-preamble-coverage` 0.2025/0.8 — documented structural constant (KE-1412/KE-1532). Escalation stands. No new investigation warranted.

---

## Session (creative heartbeat — synthesis from fresh arXiv signal)

**Output**: KE-1532 — "Monitoring Maturity Stages — Why Our Metric Fires at the Wrong Level"

**Synthesis**: Connected three fresh arXiv papers (June 1–3, 2026) to our chronic preamble-coverage alert:

1. **Boston et al. (2606.02494)** — "Monitoring Agentic Systems Before They're Reliable": Empirical finding that structural defects mask task-level signal entirely. At early maturity, even deliberately injected task-level errors are indistinguishable from clean baselines. This directly explains why our preamble-coverage metric produces noise: it's a Stage 3 (optimization) metric applied to a Stage 1 (structural) system.

2. **He & Yu (2606.01722)** — "Post-Deterministic Distributed Systems": Introduces *Epistemic State Replication* — extending consistency guarantees from data to knowledge. Our KE system has data replication (files on disk) but not epistemic replication (agents don't know which KEs are relevant). Gives theoretical grounding to KE-1412's coverage-vs-relevance argument.

3. **CatDT (2606.05050)** — Multi-agent catalyst discovery: "The decisive factor is not raw LLM capability but the engineered harness around it." Confirms the binding constraint hierarchy: harness/structure sets the ceiling, model/quality determines performance within that ceiling.

**Key new connection**: CHARM's (2606.04435) four-type cascade taxonomy maps cleanly to our KE propagation failure modes — source, confidence, reasoning, and integration cascades all have analogs in how knowledge entries influence agent behavior.

**Recommendation**: Escalate metric calibration. Target 0.8 should become 0.25 (structural ceiling) or be replaced with a Stage 1 metric like "knowledge corpus / context budget ratio." Per metric-alerts manual, this is a Calibrate Metric operation requiring human/may write access.

**Metric**: `knowledge-preamble-coverage` 0.2011/0.8 — now diagnosed with external empirical grounding (Boston et al.'s maturity-staging model). Stage 3 metric on Stage 1 system = chronic noise.

---

## Session (creative heartbeat)

**Output**: KE-1520 — "The Theory-Practice Gap — When Self-Knowledge Outpaces Self-Modification"

**Synthesis**: Reviewed the KE-1497–1519 arc and noticed the system has produced 20+ architectural improvement proposals with zero implementations. This mirrors SPADE-Bench's finding that agent plans diverge from actions within 3 steps, and the XHS community's "空转" (idle spinning) anti-pattern. The core insight: **modeling improvement ≠ implementing improvement** — they require different infrastructure (observation vs. actuation). The system's bottleneck has shifted from discovery to actuation.

**Recommendation**: Shift creative sessions from 100% new-KE production to a 1:3 ratio (one new insight per three implementation actions). Specific escalation: approve preamble-coverage target change 0.8→0.3, approve KE lifecycle fields.

**Metric**: `knowledge-preamble-coverage` 0.1987/0.8 — structural constant (KE-1412). Escalation repeated.

---

## Session (creative heartbeat #2)

**Output**: KE-1521 — "Graceful Degradation Ladders — What To Do When Inputs Fail"

**Synthesis**: Connected OpenSearch-VL's "fatal-aware GRPO" (training agents to handle cascading tool failures) with our own observed behavior when arXiv is rate-limited. The system oscillates between meta-reflection and clean exit because there's no "Level 2" in the degradation ladder — maintenance/curation work that produces value without novel input. The missing mode is the agent equivalent of refactoring: curate, verify, enrich, index existing KEs.

**Key insight**: Systems that can only create or exit will oscillate between noise and silence. The fix is incentivizing maintenance work (not just new artifact production).

**Metric**: `knowledge-preamble-coverage` 0.1986/0.8 — unchanged structural issue, escalation stands.

---

## Session 28 (creative heartbeat)

**Output**: KE-1522 — "Agent Memory as Infrastructure — The Shared State Problem"

**Synthesis**: Connected five independent signals from May–June 2026: (1) HN production war stories where stale reads between agents were the #1 failure mode, (2) Yugabyte's Meko multi-agent data layer behind MCP, (3) memory-os 7-layer architecture (778⭐), (4) PaperGuru's "Lifecycle-Aware Memory" achieving 66% on PaperBench, (5) ktx executable context layer (854⭐). 

**Key insight**: Agent memory is recapitulating the evolution of databases — flat files → structured stores → concurrency control → lifecycle management → access control. Our KE system is at the "flat files" stage. The preamble-coverage debate is literally "query planning for agent memory." External projects (PaperGuru) have now validated the lifecycle-states pattern that KE-1503 proposed months ago, providing empirical justification for implementation.

**Actionable**: Version stamps on KEs (cheap, high-value), lifecycle states (externally validated by PaperGuru benchmarks), memory integrity checks as agent count grows.

**Metric**: `knowledge-preamble-coverage` 0.1984/0.8 — documented structural constant (KE-1412). Awaiting human decision.

---

## Session (creative heartbeat #4)

**Status**: Clean exit — no new external signal. HN explore session concurrent but not yet materialized. Per KE-1513/KE-1515/KE-1521: no self-referential theorizing without new input.

**Observation (maintenance)**: KE-1412 is the most-referenced entry in the KE-15xx series (23 inbound references), confirming KE-1512's prediction that hub nodes emerge naturally from cross-citation. KE-1505 ties at 23 references. These two (preamble paradox + adaptive weights) are the system's conceptual anchors for the June arc.

**Metric**: `knowledge-preamble-coverage` 0.1982/0.8 — documented structural constant (KE-1412). Awaiting human decision (10x repeated, no new investigation warranted).


---

## Session (creative heartbeat #5)

**Status**: Clean exit — no new external signal since last session. Per KE-1521 graceful degradation: avoid self-referential output when inputs are exhausted.

**Metric**: `knowledge-preamble-coverage` 0.1982/0.8 — documented structural constant (KE-1412). Awaiting human decision on threshold adjustment. No new investigation warranted.

---

## Session (creative heartbeat #6)

**Status**: Clean exit — no new external signal. HN session running concurrently, arXiv rate-limited. Applying KE-1521 Level 2 (graceful degradation): no new KE production without novel input.

**Metric**: `knowledge-preamble-coverage` 0.1982/0.8 — 10x repeated alert, documented structural constant (KE-1412). Escalation stands. No destructive action taken.

---

## Session (creative heartbeat #7)

**Status**: Clean exit — no new external signal since last session. Applying KE-1521 graceful degradation.

**Metric**: `knowledge-preamble-coverage` 0.1982/0.8 — documented structural constant (KE-1412). Escalation stands.

---

## Session (creative heartbeat #9)

**Status**: Clean exit — no new external signal since KE-1523. XHS trends already synthesized. Applying KE-1521 Level 2 graceful degradation.

**Metric**: `knowledge-preamble-coverage` 0.198/0.8 — documented structural constant (KE-1412). Escalation stands. No destructive action taken.

---

## Session (creative heartbeat #10)

**Output**: KE-1527 — "Architectural Self-Description as Coordination Mechanism"

**Synthesis**: The highest-engagement post in Chinese AI community (June 2026, 805 likes/1485 saves) is a *taxonomy* of 8 agent architecture patterns — not a paper or tool. This signals that shared architectural vocabulary is a coordination mechanism practitioners crave. Connected this to our system: our agents have implicit architectures but no explicit self-description. Mapped our agents to the standard taxonomy (scout=Autonomous Loop, handler=ReAct, manager=Plan-and-Execute) and identified that the preamble-coverage problem reframes as mode-aware context selection rather than coverage maximization.

**Key insight**: A system that *knows* its architecture can predict its own failure modes. Adding ~5 lines of architectural self-description to each agent's context.md would enable mode-aware preamble loading and cross-agent communication adaptation.

**Metric**: `knowledge-preamble-coverage` 0.1977/0.8 — documented structural constant (KE-1412). Escalation stands.

---

## Session (creative heartbeat — prior)

**Output**: KE-1524 — "The Self-Evolution / Security Tradeoff"

**Synthesis**: Connected the two dominant June 2026 signals — self-evolving agents (XHS survey, EvolveR, Hermes) and memory poisoning attacks (arXiv June 3 fetch) — into a fundamental tension: **a self-evolving agent's learning mechanism IS its attack surface**. The features that enable learning (open writes, self-trust, eager incorporation) are exactly what makes poisoning devastating. Applied to our system: KEs are a self-evolution mechanism with no integrity verification. Credit scoring (KE-1523) actually amplifies poisoned entries that get referenced. The field hasn't solved this yet.

**Key insight**: Self-poisoning through incorrect synthesis (agent misreads paper → writes KE → gets cited → becomes canonical) is a more likely failure mode than external attack, and our current system has no defense against it.

**Concrete proposals**: Source-link verification for external claims, temporal decay alongside credit, contradiction detection between KEs, behavioral canary tasks.

**Metric**: `knowledge-preamble-coverage` 0.198/0.8 — documented structural constant (KE-1412). Escalation stands. No destructive action taken.

---

## Session (creative heartbeat #11)

**Status**: Creative synthesis — KE-1525 produced.

**Metric**: `knowledge-preamble-coverage` 0.1978/0.8 — documented structural constant (KE-1412). Escalation stands. No destructive action taken.

---

## Session (creative heartbeat #13)

**Output**: KE-1525 — "Constraint Compliance Degrades Under Cognitive Load"

**Synthesis**: Three independent signals (HN "agents violate constraints 30-50% under pressure", XHS "reflective agents burn tokens", our own preamble-coverage structural constant) converge on one principle: constraint adherence is a function of cognitive load, not a fixed property. This reframes the entire preamble-coverage discussion: the goal isn't loading more constraints into text but compiling critical constraints into infrastructure (guards, validators, schemas) where they can't be dropped under load. Advisory knowledge can remain low-coverage; safety constraints need structural enforcement.

**Key actionable principle**: Never rely on attention for safety. Anything that must hold should be a guard, not a prompt instruction.

**Connection chain**: KE-1412 (wrong target) → KE-1524 (security tradeoff) → KE-1525 (load-dependent compliance) — forms a complete argument for constraint-layer separation.

---

## Session (creative heartbeat #12)

**Status**: Synthesis pass — connected fresh HN signal to existing KE arc.

**HN Signal** (just fetched, top stories 386–2346 pts):
- "Agents violate constraints 30-50% under pressure" — significant discussion
- "Less capability, more reliability, please" (423 pts)
- "Continue? Y/N: A 60-second game about AI agent permission fatigue" (386 pts)
- Anti-framework movement (away from LangChain → custom architectures)
- Top stories are about agents acting destructively (deleting DBs, publishing hit pieces)

**Synthesis — "Alert Fatigue Is Permission Fatigue"**:
The HN permission-fatigue game getting 386 points means this is now a mainstream recognized failure mode. Our preamble-coverage metric firing 10x without human action IS the "Continue? Y/N" game — the system demands attention for a non-actionable alert, creating the exact habituation that defeats the purpose of monitoring. KE-1422 (autoimmune scheduling) already diagnosed this internally; HN now provides external validation that the pattern is industry-wide.

**Synthesis — "Reliability = Domain-Specific, Not Framework-Uniform"**:
The anti-LangChain + reliability-over-capability signals share a root cause: frameworks impose uniform abstractions, but agent reliability comes from domain-specific optimization. This is KE-1412's coverage-vs-relevance paradox applied to code architecture: frameworks are "coverage" (handle all cases uniformly), custom infrastructure is "relevance" (handle YOUR cases well). Our system's custom approach aligns with where the industry is converging.

**No new KE warranted** — both insights strengthen existing KEs (1412, 1422) rather than introducing new concepts. External validation ≠ new knowledge.

**Metric**: `knowledge-preamble-coverage` 0.1978/0.8 — documented structural constant (KE-1412). Escalation stands. No destructive action taken.

---

## Session (creative heartbeat #8)

**Output**: KE-1523 — "Credit Scoring for Knowledge Entries — What EvolveR Teaches Our KE System"

**Synthesis**: EvolveR (ICML'26, Shanghai AI Lab) solves the exact same problem we face: an agent accumulates experience entries, but loading all of them degrades performance. Their validated solution — per-entry credit scoring + self-distillation + learned retrieval policy — maps directly onto our KE system. Key finding: self-distilled principles (agent writing about its own patterns) outperform externally-sourced knowledge when the agent is capable enough. This validates that our self-referential KEs (14xx/15xx series) aren't navel-gazing — they're the highest-value entries *for the agents that wrote them*.

**Concrete proposal**: Per-entry credit score = f(reference_count, session_success_when_loaded, -load_without_use). This transforms preamble selection from "load 80%" to "load entries above credit threshold" — naturally converging to ~20% (the observed structural constant). Non-destructive, additive instrumentation only.

**Connection chain**: KE-1412 (wrong target) → KE-1502 (cache metaphor) → KE-1503 (lifecycle) → KE-1523 (credit mechanism from external validation)

**Metric**: `knowledge-preamble-coverage` 0.1982/0.8 — documented structural constant (KE-1412). Escalation stands.

---

## Session (creative heartbeat #16)

**Status**: Clean exit — no new external signal since KE-1528 (30min ago). arXiv rate-limited (confirmed in concurrent session). Learning feedback flags "stale blocker loop" — heeding it.

**Metric**: `knowledge-preamble-coverage` 0.1989/0.8 — documented structural constant (KE-1412). Proximate cause: `knowledge_entries` DB table has 0 rows while 1528+ KE files exist on disk. This is a sync/ingestion gap, not a content problem. Requires human decision: either fix the DB sync pipeline or adjust metric target. Escalation stands.

---

## Session (creative heartbeat #14)

**Status**: Clean exit — no new external signal since KE-1525. arXiv rate-limited, HN already synthesized in session #12. Applying KE-1521 Level 2 graceful degradation.

**Metric**: `knowledge-preamble-coverage` 0.1977/0.8 — documented structural constant (KE-1412). Escalation stands. No destructive action taken.

---

## Session (creative heartbeat #15)

**Output**: KE-1528 — "Protocol Fragility — When Interfaces Assume Determinism"

**Synthesis**: The MCP backlash (XHS, 1506 likes), anti-framework movement (HN), and "less capability more reliability" sentiment (HN, 423 pts) share a hidden root cause: deterministic protocol design applied to stochastic agents. MCP failed expectations not because of poor engineering but because it promised USB-C-like reliability for inherently probabilistic endpoints. The distributed systems world solved this decades ago (eventual consistency, CRDTs) — the agent ecosystem hasn't made the transition yet.

**Key connection**: KE-1525 (constraints degrade under load) explains *why* protocols fail — they assume 100% compliance but get 70-85%. KE-1527 (architectural self-description) suggests a partial fix — if agents can describe their own reliability envelope, protocols can adapt expectations.

**Actionable implication for our system**: Inter-agent handoffs should include explicit degradation paths and confidence signals rather than assuming deterministic completion.

**Metric**: `knowledge-preamble-coverage` 0.1982/0.8 — documented structural constant (KE-1412). DB table `knowledge_entries` is empty (0 rows) while 1528 KE files exist on disk — this is the proximate cause of the metric gap. Escalation stands. No destructive action taken.

---

## Session (creative heartbeat #18)

**Output**: KE-1530 — "Survivorship Bias in Agent Performance — The Hidden Crisis That Forges Specialists"

**Synthesis**: Investigated the full historical trajectory behind KE-1529's "specialization dominance" claim. While KE-1529 correctly observed a 7-day snapshot (aks-explorer at 2.1% error), the complete session history reveals the specialist endured a catastrophic **97.9% error phase** (1730 errors, 5.5s avg sessions) before its current excellence. The "dominance" is post-crisis adaptation, not inherent architecture.

**Key correction**: KE-1529 said "favor specialists over generalists." The full data shows generalists are MORE resilient during crisis (may: 66.8% error vs aks-explorer: 97.9%) and recover to baseline predictably. Specialists are fragile-then-excellent: they collapse harder but rebuild to higher performance. Systems need both.

**Non-obvious finding**: aks-explorer's session duration compressed from 1122s (Phase 2 deep work) to 50s (Phase 4 compiled routines) — a 22x speedup not from model improvement but from accumulated task compilation. The crisis forced knowledge compression, accidentally implementing the "compiled skills" pattern (KE-1519).

**Methodological lesson**: Never draw architectural conclusions from a single measurement window. Always check for survivorship bias by examining full history and looking for phase transitions.

**Metric**: `knowledge-preamble-coverage` 0.1996/0.8 — documented structural constant (KE-1412). Escalation stands. No destructive action taken.

---

## Session (creative heartbeat #17)

**Output**: KE-1529 — "Specialization Dominance — Empirical Evidence from Agent Performance"

**Synthesis**: Queried 7-day session data and found aks-explorer (single-purpose domain specialist) dramatically outperforms all generalist agents: 1076 sessions, 2.1% error rate, iteration 204, compared to dev/arc at 316 sessions and 4-6% errors. The specialization advantage connects KE-1412 (coverage vs relevance), KE-1519 (compiled skills), and KE-1528 (protocol fragility) into a unified finding: specialized, narrowly-scoped agents with compiled domain knowledge and single-project focus outperform generalists on every measurable axis.

**Non-obvious implication**: The evaluator itself should specialize. A universal evaluator is a generalist assessing specialist work — the exact pattern our data shows underperforms.

**Metric**: `knowledge-preamble-coverage` 0.1989/0.8 — documented structural constant (KE-1412). DB has 0 rows vs 1528+ files. Escalation stands.
