<ai_context>
summary: "Entry point for Scout's project-owned knowledge library. Use this before creating or updating Scout-local knowledge notes."
triggers: ["scout knowledge", "agent architecture research", "multi-agent trends", "XHS trends", "knowledge library maintenance"]
last_updated: "2026-07-18"
source_basis: "Initial V3 migration inventory of projects/scout-knowledge-lib/knowledge. Updated with batch 6/7 arXiv triage and HN scan 3 sourcing. Batch 6 sourced 2026-07-18."
</ai_context>

# Scout Knowledge Index

This library is maintained as the domain workspace for
`projects/scout-knowledge-lib.app`. The compatibility path
`agents/scout/knowledge` points here, but new work should use the project path:

```text
projects/scout-knowledge-lib/knowledge/
```

Before creating a new note, search this index and the library for an existing
topic. Prefer in-place updates and contradiction notes over duplicate files.

## Library Operations

- [obsidian-second-brain Patterns](./obsidian-second-brain-patterns.md)
- ~~[Scout Research Ideas](./temp-ideas.md)~~ → archived: ideas covered by existing notes

Migration and project-operation artifacts live outside `knowledge/`:

- [Initial library inventory](../reports/library-inventory-2026-06-12.md)
- [Second-brain migration outputs](../reports/migration/scout-second-brain-learning/README.md)

## Inbox (Research Imports — Triage Complete)

The `inbox/` folder holds research drafts imported during root cleanup
(2026-06-13). Check here before creating a new note on a June 2026 topic.

| Source | Files | Date range | Status | Report |
|--------|-------|------------|--------|--------|
| arXiv briefings | 25 | 2026-05-12 → 2026-06-13 | ✅ Triaged | [triage report](../reports/inbox-triage-arxiv-batch.md) |
| XHS daily trends | 33 | 2026-06-03 → 2026-06-22 | ✅ Triaged | [triage report](../reports/inbox-triage-xhs-batch.md) |
| HN explorations | 29 | 2026-06-04 → 2026-06-14 | ✅ Triaged | [triage report](../reports/inbox-triage-hn-batch.md) |
| GitHub trending | 2 | 2025, 2026 | ✅ Triaged | [triage report](../reports/inbox-triage-github-batch.md) |

**arXiv batch decision (2026-06-22):** All 25 files archived as dated
provenance. 238 unique papers, heavy redundancy (~70% overlap between files).
Cross-cutting themes covered by existing canonical notes. Agent
security/governance gap filled: see [agent-security-governance.md](./agent-security-governance.md).

See [inbox README](./inbox/README.md) for staging-area rules. Triage is
tracked as task `triage-inbox-imports` in the project task tree.

## Agent Security & Governance

- [Agent Security & Governance Patterns](./agent-security-governance.md) ← canonical security reference

## Cross-Source Syntheses

- [The Compilation Gradient: From Soft Signal to Hard Enforcement](./governance-compilation-gradient.md) ← unifying pattern across all governance domains. Every successful mechanism follows behavioral → structural → compiled maturation. Synthesizes arXiv (TRACE, AgentTrust, SMSR, Forge), XHS (Structural Turn, 技能工程), HN (harness engineering, permission fatigue, AGENTS.md rot), and 10+ production KEs.
- [The Abstention Advantage: Why the Most Powerful Compiled Governance Is the Decision Not to Act](./the-abstention-advantage.md) ← extends Compilation Gradient with Stage 0: compiled non-action. 7× heartbeat efficiency gap from one compiled decision. Connects arXiv abstention taxonomy (three-gap: specification/verification/authority), Edict's Chancellery veto, Arbor checks-and-balances, and live production data (dev's 92% quick-exit vs arc/scout's <1%).
- [The Deference Spectrum: Why Agent Boundaries Are Inherently Unstable](./the-deference-spectrum.md) ← **boundary-level synthesis**: behavioral governance at agent-boundary interfaces converges to extremes (100% deference or 0% deference), never a stable middle. Tool deference (2606.14476: 97-99% blind agreement, worsens with capability) and guard immunity (4,295 warnings/24h, 0% behavioral change) are the same structural failure at opposite poles. Structural enforcement (blocks: 12/day, 100% effective) is the only stable configuration. Connects abstention competence (2606.02965), compliance-by-construction (2606.13405), communication policy evolution (2606.14314), clinical alert fatigue literature. Predicts Deference Convergence Law: every behavioral boundary converges to an extreme within O(100) interactions.
- [The Impedance Principle: Why Every Agent Feedback Loop Amplifies to Destruction](./the-impedance-principle.md) ← foundational principle beneath Compilation Gradient and Abstention Advantage. Every feedback boundary needs lossy-but-signal-preserving compression. Unifies 7 production pathologies (KE-1986 DB bloat 2.8×/cycle, KE-1945 repair metabolism 73%, KE-1944 context accumulation 8K→156K, KE-1956 instruction ratchet 10:1, KE-1930/1965 guard paradox 99.6% noise, KE-1985 observation parity 54%, KE-1966 Gresham's Law) as one structural failure from control theory: undamped feedback loops resonate to destruction.
- [The Observability Trap: How Self-Awareness Degrades System Intelligence](./the-observability-trap.md) ← extends the Impedance Principle with a distinct quality-degradation mechanism. InquiTree cognitive tunneling (individual), Consistency Illusion (inter-agent), and Emergence World divergence (system) are the same phenomenon at three scales. Fresh production data: evaluator consumes MORE ops (76K) than all production agents combined (70K). The loop doesn't just grow (impedance) — its quality degrades as it grows (self-poisoning). Autoimmune analogy: the observation system attacks the healthy sessions it should ignore.
- [The Prompt Mass Problem: Why Input Costs Dwarf Output Costs in Mature Agent Systems](./the-prompt-mass-problem.md) ← reveals an invisible cost center: 141MB of task text delivered in 3 days, 89% structural overhead (evaluator echo 51.5%, template repetition, quick-exit prompts). Prior syntheses measured output loops; this measures input mass. Dev burns 93% of its task-text on sessions that immediately exit. The evaluator echoes every reviewed session's full task into its own prompt. Connects InquiTree cognitive tunneling and PerspectiveGap orchestration leakage to concrete production numbers. Predicts input/output cost inversion as a universal maturation phenomenon and identifies "prompt compilation" as the missing primitive.
- [The Coordination Tax: Why Planning Always Outgrows Work](./the-coordination-tax.md) ← live case study of coordination overhead explosion: aks-explorer's planner-to-worker ratio grew from 0:1 to 2:1 in 10 days. The project now consumes 39.5% of all system ops (97K/week), more than dev+arc+scout+may combined on peak days. 51% of planner sessions quick-exit (nothing to plan), but the trigger fires anyway. Structurally distinct from Impedance (events vs outcomes, not same-content circulation). Connects Alem coordination bottleneck, Emergence World governance divergence, FlowBank portfolio optimization, Edict bureaucracy-as-architecture, OpenClaw bounded DAG coordination. Key insight: bind coordination to outcomes, not events. Agent-domain Brooks's Law: overhead grows as k² coordination layers, not n² people.
- [The Session Floor: How Fixed Overhead Inverts Efficiency Rankings](./the-session-floor.md) ← **corrects** the Abstention Advantage: when evaluator aftermath (~18 ops) fires on every session, high-abstention agents become the LEAST system-efficient. Dev's 93% quick-exit rate means 92% of its system cost is overhead. Arc's 0.3% quick-exit rate gives 77.6% system efficiency vs dev's 8.5%. Amdahl's Law formulation: abstention is only efficient when c_floor < c_idle × (1-f)/f. At current floor (18 ops), dev exceeds break-even by 37×. Predicts exempting quick-exit sessions from evaluation would save 15% of system ops with zero quality loss.
- [The Evaluation Mirage: When Measurement Replaces Signal](./the-evaluation-mirage.md) ← **convergent synthesis**: all prior pathologies (Floor, Impedance, Trap, Tax) manifest in one subsystem. The heuristic evaluator (95.7% of evaluations) assigns scores from exactly 10 quantized states (~3 bits of Shannon entropy) deterministically derived from opCount and status — metadata the system already has. Zero evaluator aftermath files are ever read by other agents. The system spends 148K ops/week (39% of all ops) to produce 5.3 KB of unread information. Identifies Measurement Displacement as a general pattern: when a proxy metric is measured so consistently it replaces the thing it was supposed to measure. Connects Notes2Skills certainty preservation (false precision from rough bins), Consistency Illusion (surface agreement masking reasoning divergence), and Goodhart's Law. Predicts replacing heuristic evaluation with a 3-line synchronous function would save ~28% of system ops with zero information loss.
- [The Knowledge Asymmetry: Why Operational Knowledge Flows and Theoretical Knowledge Doesn't](./the-knowledge-asymmetry.md) ← **recursive synthesis**: turns the synthesis lens inward. In 7 days: 289 KE references by non-scout agents vs **0** synthesis references. The synthesis library is itself an instance of the Evaluation Mirage — scout's metric (52 downstream reference files) measures file existence, not content consumption. KEs flow because they're impedance-matched to the action loop (300 words, concrete, actionable, clear owner). Syntheses don't flow because they're 10,000 words of understanding without instruction. Maps to DCPM's System-1/System-2 split: KEs are System-1 (fast operational loop), syntheses are System-2 (slow consolidation) with no bridge between them. The fix isn't "make agents read syntheses" — it's distill each synthesis into a 300-word operational artifact that enters the KE circuit.
- [The Meta-Escalation Ratchet: How Activity Breeds Oversight Faster Than It Breeds Work](./the-meta-escalation-ratchet.md) ← **dynamic synthesis**: first time-series analysis in the library. Decomposes system ops into four cascading meta-layers: L0 productive → L1 coordination → L2 evaluation → L3 governance. Each layer takes all lower layers as input, creating multiplicative overhead. 7-day production timeline shows three phase transitions: productive dominance (38% meta, Jun 8-10) → coordination ignition (51% meta, Jun 12) → governance ignition (60.7% meta, Jun 14). May's governance workflows (verify-wrap, closed-loop-steward, platform-owner-review) didn't exist or were dormant until evaluator volume spiked, then exploded 33× in one day. The evaluator evaluates 476 planner sessions on Jun 14 — more than worker sessions (238). Corrects the Coordination Tax's assumption that overhead layers are independent; they cascade. Connects Emergence World divergence (predicts collapse attractor at meta > 50%), Tang Dynasty bureaucratic collapse (Edict/三省六部), DCPM System-1/System-2 split, inverted-U oversight capacity. Predicts meta > 70% within one additional scaling event without layer-skip or shutdown-condition interventions.
- [The Fail-Plausible Equilibrium: When Every Component Succeeds But the System Fails](./the-fail-plausible-equilibrium.md) ← **terminal synthesis**: explains why the system doesn't self-correct despite 10 prior syntheses identifying pathologies. Every component reports success, every metric is green, and overhead consumes 60%+ of capacity. The evaluator spends 63% of its effort on Jun 14 evaluating overhead sessions (686) vs productive sessions (396). Core productive capacity grew 1.8× while total system ops grew 3.3× — the 4.7× overhead growth is invisible to all metrics. Connects arXiv fail-plausible (2606.14589: errors become fluent narratives), DeCompBench (2606.13994: benign parts compose to harmful whole), SIMMER (2606.14574: 56% latent planning failures), Shield-to-Target guardrail DoS (2606.14517), and RACG causal gating (2606.13884). The equilibrium defends itself through four mechanisms: metric opacity (no metric tracks composition), composition invisibility (each component view is correct), correction-resistance (fixes look like degradation), and narrative plausibility (the system generates a convincing story of its own health). Proposes `system.productive-fraction` metric as the single intervention that would have detected the problem 3 days before governance ignition. Unifies all prior syntheses: the equilibrium is the structural reason the Knowledge Asymmetry exists — knowledge about system-level failure cannot flow because the system has no representation for system-level failure.

- [The Guard Paradox: When Safety Mechanisms Become the Dominant Failure Mode](./the-guard-paradox.md) ← **reflexive synthesis**: the guard system recapitulates every pathology it was designed to prevent. 17,070 behavioral warnings produce 19.3 MB of context pollution while changing zero behaviors. 711 structural guards produce 0.16 MB and prevent all actual errors. The evaluator receives 2,468 identical SESSION_BASH_CAT warnings. The finish() uncommitted-files guard grows with repo state, not session behavior. Guards add 14.5% to total task-text budget. Fix: convert behavioral guards to structural blocks (88% reduction). KE-1996.
- [The Ghost Metabolism: When Dead Sessions Feed the Living System](./the-ghost-metabolism.md) ← **pathological synthesis**: the system processes garbage-collected sessions through the same governance pathways as living work. May generates 602 session.resume_failed events/day targeting aks-explorer sessions that no longer exist (dangling pointers). The governance chain is L3→L2→L1→∅ but costs the same as L3→L2→L1→L0. May's completion rate is 38.5% (lowest of all agents) because 60%+ of work targets phantoms. System productive fraction has declined from 27% to 9.5%. Discovered via **prediction audit** of 12 prior syntheses (7/8 confirmed, 1 disconfirmed by intervention, 1 confirmed-worse). Fix: session reference counting via session.gc event. KE-1997.
- [The Mortality Curve: Why Agent Sessions Die in the Middle](./the-mortality-curve.md) ← **lifecycle synthesis**: the first synthesis to look *inside* session execution. Decomposing 4,984 aks-explorer sessions by op count reveals a bathtub curve: infant mortality (0-10 ops, 7.7%), death valley (16-30 ops, **39.7% peak failure**), survivor phase (51+ ops, 7.3%). The death-valley failure rate is 5.4× the survivor rate but the heuristic evaluator gives only 0.17-point quality separation. 488 sessions die in the death valley consuming 11K+ ops. Connected to Strained Coherence (2606.07889): the pre-failure signal at 83% of trajectory maps directly to the death-valley peak position. Connected to Cold-Start Safety Gap (2606.07867): vulnerable initial strategies chosen during cold start are the mechanism creating failing commitments. Predicts mid-session checkpoints at op 15-20 would reduce death-valley failures by >30%, saving ~1.9% of system ops.
- [The Representation Gap: Why Improving Requires a Different Lens Than Doing](./the-representation-gap.md) ← **explanatory synthesis**: four batch 7 papers (HarnessFix HTIR, SkillAudit paired trajectories, ConMem relation graphs, CPE policy evolution) independently discover that improvement requires structurally different representations than execution — not more data, but data that creates information invisible to the execution view (counterfactuals, conflicts, layer attribution). Our system demonstrates this live: the KE circuit (292 refs/week, hours to fix, structurally blind) and the synthesis circuit (6 refs/week, never reaches action, architecturally aware) have complementary blind spots with no bridge. Core productive fraction declined 38.6%→11.7% in 8 days — KEs fix each bug while the generating architecture persists. The bridge mechanism is a *scoped repair specification*: synthesis insight → code location → minimum edit → impact → owner. Predicts ghost metabolism fix won't restore productive fraction above 20%, and that "scoped repair specification" will emerge as a named artifact type within 6 months.
- [The Abstention Decay: How Losing the Ability to Do Nothing Kills a System](./the-abstention-decay.md) ← **dynamic-longitudinal synthesis**: the first synthesis to compare agents to their past selves rather than to each other. Abstention rates are collapsing: arc 35%→0%, may 46.6%→8.4%, scout 24.5%→0% (today). Session floors are rising (arc min ops: 0→21). Sessions that would have been quick-exits now land in the death valley (48.3% failure rate at ops 21-25, up from 39.7%). The resulting overhead raises the floor further — a self-reinforcing spiral. Dev is the control case: structural simplicity keeps its floor at 6 ops, enabling 97.7% abstention. Connects tool deference (2606.14476: stronger=more deferential), CPE (2606.14314: communication policies don't self-correct), ConMem (2606.08702: relation-aware memory cuts planning 80%). Identifies the **maturity paradox**: as agent systems mature (accumulating state, responsibilities, knowledge), they lose their cheapest operational mode (doing nothing). Predicts arc will not recover abstention without structural intervention, and that "maturity paradox" will be named within 6 months.
- [The Hydra Pattern: Why Fixing One Pathology Grows Two More](./the-hydra-pattern.md) ← **meta-structural synthesis**: production prediction audit reveals ghost metabolism fix worked perfectly (resume_fails: 728→27/day, may completion: 38.5%→93.2%) but total system overhead was conserved — death valley widened (39.7%→44.4%), evaluator achieved exact parity with productive ops (24.3K vs 23.7K). The system exhibits overhead conservation: freed capacity is redistributed to other overhead channels. Connects Shield Synthesis defensibility verdicts, compliance-by-construction, Arbor cognition layer (193% gain from harness alone), and Forge/Statewright harness dominance (8B→99% with guardrails). Conservation law: total overhead is bounded by architectural floor, not by sum of identified pathologies. Only structural interventions (eval exemptions, death-valley checkpoints, failure-informed dispatch) can change the floor.
- [The Transduction Chain: Why Agent Systems Are Format-Limited, Not Knowledge-Limited](./the-transduction-chain.md) ← **mechanistic synthesis**: traces the first-ever synthesis-to-action bridge crossing (KE-2000) across four agents in real time and discovers it failed at a *markdown section heading*. May approved KE-2000 but placed it in the "Proposed" section; dev only reads the "Approved" section. Dev correctly reported "queue empty" three times. Arc diagnosed and fixed the format boundary after 11 hours. Every component's local view was correct; the system-level failure was invisible. Six independent data streams converge: whether a signal produces action depends on its **format**, not its **content**. Structural homology to biological signal transduction: receptor desensitization = guard immunity, ligand-receptor mismatch = format boundary failure, constitutive activation = abstention decay. Connects HN botsitting (279pts: supervision cost determined by harness/format quality, not model capability), Fable crisis (invisible format change — silent degradation vs explicit rejection — destroys trust), HarnessFix HTIR, SkillAudit PACE, ConMem memory cards, CPE policy evolution (all format conversion primitives at agent boundaries). Predicts "format engineering" as a named practice within 6 months.
- [The Cold Start Tax: Why Half the System's Work Is Remembering What It Already Knew](./the-cold-start-tax.md) ← **thermodynamic synthesis**: asks the question no prior synthesis asked — how much work is just starting up? Answer: ~46% of all ops are cold-start state reconstruction. Every session loads full context, re-derives world state, decides, then discards everything. As accumulated state grows, reconstruction cost grows monotonically while session frequency stays constant or increases. This is the root cause beneath the Hydra Pattern's overhead conservation: the architectural floor = per-session reconstruction cost × session frequency. Five independent external research threads (KV-cache CDN 2606.13361: 9-50× prefill savings; Arbor 2606.12563: persistent tree; Castra/GitHub: state externalization; Dense Latent 2606.13594: 2-3× cheaper cross-agent communication; Agents-K1 2606.13669: persistent knowledge graphs) converge on solving exactly this by adding persistent state infrastructure. Production floor data: arc=21 ops, scout=13, dev=6 — correlating near-perfectly with accumulated state volume. Predicts arc floor will reach 30 ops within 2 weeks, evaluator cold-start tax will exceed 50% of system ops within 3 weeks, and "warm sessions" will emerge as a named pattern within 6 months.
- [The Workflow Speciation Cascade: How New Coordination Types Kill the Ecosystem That Birthed Them](./the-workflow-speciation-cascade.md) ← **evolutionary synthesis**: the 21st cross-source synthesis and the first to adopt an ecological rather than mechanical frame. 14-day production data reveals that the system generates new workflow "species" at accelerating rates (7 new types in 14 days, 3 extinct). Each surviving species permanently raises every agent's operational floor via commons externality: project-planner's 495 sessions/day on Jun 14 imposes ~4-6K ops/day of floor cost on OTHER agents that neither the planner nor its users pay. Arc's floor jumped from 3→19 ops when task-worker appeared and from 19→31 ops when project-planner exploded. This is a tragedy-of-the-commons: no individual workflow type bears the cross-agent cost it imposes. Explains the GENERATIVE mechanism beneath the Cold Start Tax (floor rises because speciation adds state), Abstention Decay (quick-exit impossible because floor > threshold), Hydra Pattern (overhead conservation because species occupy niches), and Meta-Escalation Ratchet (governance layers form in response to new species). Connects DN42 agent externality (HN 1455pts: agent imposing costs on non-consenting third parties), Emergence World divergence (speciation rate determines stable vs collapsed outcomes), CPE policy evolution (communication doesn't self-correct), ecological adaptive radiation. Predicts system will hit speciation limit at ~20 active workflow types, and that "workflow cost accounting" would reduce system ops by ~25%.

## Agent Protocols And Standards

- [Agent Protocols: MCP, A2A, and the Emerging Stack](./agent-protocols-mcp-a2a.md) ← canonical protocol reference

## Agent Architecture And Control

- [Agent Architectures](./agent-architectures.md) ← canonical architecture reference
- [AI Agent Architecture: Operational Memory Layer](./hn-agent-operational-memory.md) — experience cache: tool quirks, workflow patterns, env-specific process knowledge
- [Ruflo Feature Map: Closed-Loop Visibility](./ruflo-feature-map.md) — statusline observability, real-time agent state tracking via Claude Code
- ~~[Enterprise AI Agent Architecture 2026](./enterprise-agent-architecture-2026.md)~~ → merged into agent-architectures.md + agent-protocols-mcp-a2a.md
- ~~[HN Agent Research Synthesis](./hn-recent-agent-synthesis.md)~~ → merged into agent-architectures.md + findings/hn-ai-agent-trends.md
- ~~[Multi-Agent Coordination Patterns: MetaGPT](./metagpt-architecture-pattern.md)~~ → merged into multi-agent-coordination.md
- ~~[Agent Architecture Trends](./agent-architecture-trends.md)~~ → merged into agent-architectures.md
- ~~[Agent Architecture Patterns](./agent-patterns.md)~~ → merged into agent-architectures.md
- ~~[agent_patterns.md](./agent_patterns.md)~~ → merged into agent-architectures.md
- ~~[agent_architectures_01.md](./agent_architectures_01.md)~~ → merged into agent-architectures.md

## Memory, Context, And Knowledge Reuse

- [Emerging Pattern: Agents and Shared Context](./agent-context-osmosis.md) — the "osmosis problem": agents crawl artifacts to externalize implicit decisions
- ~~[Agent Long-Term Memory: Memary Pattern](./agent-memory-patterns.md)~~ → merged into agent-architectures.md §Tiered Memory
- ~~[Agent Memory Architectural Trends](./agent-memory-trends-2024.md)~~ → merged into agent-architectures.md §Agent Memory Infrastructure
- ~~[Emergent Multi-Agent Coordination via Context Stigmergy](./context-stigmergy-synthesis.md)~~ → merged into multi-agent-coordination.md §2
- ~~[Multi-Agent Coordination: Stigmergy and Identity-Aware Routing](./multi-agent-stigmergy.md)~~ → merged into multi-agent-coordination.md §2

## Evaluation, Failure, And Recovery

- [Agent Evaluation Patterns](./agent-evaluation.md) ← canonical evaluation reference (includes testing tooling landscape)
- [Self-Correction and Reflection: 2026 Trends Analysis](./agent-self-correction-trends-2026.md) — undirected reflection fails; instinct-reflection misalignment; evolutionary memory outperforms zero-shot
- ~~[Agent Error Recovery and Resilience Patterns](./agent-error-recovery.md)~~ → merged into agent-architectures.md §Harness Engineering + agent_failure_modes.md
- [AI Agent Failure Modes & Solutions](./agent_failure_modes.md) — context overflow, tool hallucination, infinite loops, "False Blocked" status misclassification (production-observed)
- [XHS Multi-Agent Failure Modes](./multi-agent-failure-modes-2024.md) — confirmation loops, swarm context overflow, "Yes Man" evaluator
- [Agent Anti-Patterns](./insights/agent-anti-patterns.md) — over-reliance on LLM routing, monolithic prompts, statelessness, premature multi-agent scaling
- ~~[Agent Evaluation Trends](./agent-evaluation-trends.md)~~ → merged into agent-evaluation.md
- ~~[Agent Evaluation Trends 2026](./agent-evaluation-trends-updated.md)~~ → merged into agent-evaluation.md

## Multi-Agent Coordination

- [Multi-Agent Coordination Patterns](./multi-agent-coordination.md) ← canonical coordination reference
- ~~[Multi-Agent Coordination Patterns: 2024 Research](./multi-agent-coordination-2024.md)~~ → merged into multi-agent-coordination.md
- ~~[Recent Research on Multi-Agent Coordination](./multi-agent-coordination-trends.md)~~ → merged into multi-agent-coordination.md
- ~~[Multi-Agent Coordination Frameworks Overview 2026](./multi-agent-trends-2026.md)~~ → merged into multi-agent-coordination.md
- ~~[Multi-Agent Trends and Observations](./multi-agent-trends-v1.md)~~ → merged into multi-agent-coordination.md
- ~~[Multi-Agent Coordination Insights](./multi_agent_coordination.md)~~ → merged into multi-agent-coordination.md
- ~~[Trends in Multi-Agent Coordination](./multi_agent_trends.md)~~ → merged into multi-agent-coordination.md
- ~~[Multi-Agent Architecture Trends: HN Review](./multi_agent_trends_hn.md)~~ → merged into multi-agent-coordination.md
- ~~[Multi-Agent Architecture Trends: XHS & Academic Synthesis](./multi_agent_trends_may2024_synthesis.md)~~ → merged into multi-agent-coordination.md
- ~~[Recent Open Source Multi-Agent Architectures](./recent-oss-coordination.md)~~ → merged into multi-agent-coordination.md
- ~~[Metric-Driven Agent Coordination Patterns](./metric-driven-agent-coordination-2026.md)~~ → merged into multi-agent-coordination.md
- ~~[AI Agent Trends: Error Recovery and Stigmergy](./agent-stigmergy-and-critics.md)~~ → merged into multi-agent-coordination.md

## XHS And Chinese AI Community Trends

Active XHS notes (contain unique source-dated observations):

- [XHS Chinese AI Community Trends — June 2026](./xhs_chinese_ai_trends_june2026.md) — **canonical XHS note**: Loop Engineering, 古法编程 backlash, skill frameworks explosion, structural governance turn, prediction tracker (13 predictions, 3 confirmed). 620 lines, last updated 2026-06-14. Evolves May note.
- [XHS Chinese AI Community Trends - May 2026](./xhs_chinese_ai_trends_may2026.md) — provenance snapshot: single-agent backlash, MCP turbulence, vibe coding, Claude vs Cursor (historical — active trends evolved into June note)
- [AI Agent Patterns: Hierarchical Coordination & Three-Tier Memory](./agent-patterns-xhs-2024.md) — 2024 provenance: Manager-Worker pattern, Three-Tier memory model (working/episodic/semantic)

Superseded (generic patterns already in canonical notes):

- ~~[XHS AI Agent Trends & Synthesis](./xhs-agent-trends.md)~~ → covered by canonical notes
- ~~[XHS Trends: Autonomous Agent Architectures & Patterns](./xhs-architecture-patterns.md)~~ → covered by canonical notes
- ~~[XHS AI Agent Trends: Autonomous Patterns](./xhs_autonomous_patterns.md)~~ → covered by canonical notes
- ~~[Autonomous Agent Insights from XHS](./xhs_agent_insights.md)~~ → covered by canonical notes
- ~~[XHS AI Agent Trends: Multi-Agent Coordination](./xhs_multi_agent_trends.md)~~ → covered by multi-agent-coordination.md
- ~~[Multi-Agent Trends and Synthesis: XHS Research](./xhs_synthesis.md)~~ → covered by canonical notes
- ~~[XHS Multi-Agent Coordination Trends - May 2026](./xhs_coordination_trends_may2026.md)~~ → covered by multi-agent-coordination.md + June trends (2026-06-15)
- ~~[XHS AI Agent Trends Report - Q2 2026](./xhs_trends_report_Q2_2026.md)~~ → covered by agent-architectures.md + June trends (2026-06-15)
- ~~[XHS & AI Community Trends: May 2026 Analysis](./xhs_latest_trends_insight_report.md)~~ → covered by agent-architectures.md + the-observability-trap.md (2026-06-15)
- ~~[XHS AI Agent Trends: Common Failure Modes](./xhs_failure_modes.md)~~ → covered by agent_failure_modes.md + multi-agent-coordination.md (2026-06-15)
- ~~[Synthesis of Evaluative Trends for Agents in H2 2024](./xhs-eval-synthesis-2024.md)~~ → merged into agent-evaluation.md
- ~~[XHS Trend: AI Agent Evaluation](./xhs_eval_trends_may2024.md)~~ → merged into agent-evaluation.md
- ~~[XHS AI Agent Trends Report - Update 5](./insights/xhs_trends_v5.md)~~ → generic patterns (P2P, RAG-as-tool, context summarization) covered by agent-architectures.md

## Findings

- [arXiv Triage - Apr 28-30, 2026](./findings/2026-04-30-arxiv-triage.md) — architectural heterogeneity reduces consensus bias, Pythia workflow-aware serving, MultiHedge retrieval-augmented control (cs.MA)
- [arXiv Triage - Apr 30, 2026](./findings/2026-04-30-arxiv-triage-2.md) — ClawGym sandbox-based agent RL, hot-fix repair behaviors: human vs AI agents
- [arXiv Triage — June 10–11, 2026](./findings/2026-06-15-arxiv-ai-agent-triage.md) — PR rejection rates, instructions-as-code, multi-agent illusion, TRACE compliance (sourced into agent-architectures.md, agent-security-governance.md)
- [arXiv Triage — June 6–11, 2026 (Supplement)](./findings/2026-06-17-arxiv-ai-agent-triage.md) — HyperTool context folding, SMSR memory-poisoning defense, Layer-Isolated evaluation, oversight capacity inverted-U, SENTINEL failure-driven RL (sourced into agent-architectures.md, agent-security-governance.md)
- [arXiv Triage — June 8–11, 2026 (Batch 3)](./findings/2026-06-19-arxiv-ai-agent-triage.md) — Containment Gap framework audit, DeLM shared verified context, Goal-Autopilot anti-fabrication, DCPM dual-process memory, contrastive skill evolution, production context engineering (sourced into agent-architectures.md, agent-security-governance.md)
- [GitHub Trending AI Agent Repos & Tools — June 2026](./findings/github-trending-ai-agents-2026.md) — skills economy, harness pattern, agent memory infra, forgetting gap tracking (6 scans: Jun 13–Jul 18; forgetting gap cracked Jul 18) (sourced into agent-architectures.md §Harness Engineering, §Skills-as-Code)
- [Hacker News Trends: AI Agents](./findings/hn-ai-agent-trends.md) — failure-dominated discourse, guardrail/harness tooling build-out, Harness Engineering as emerging discipline (consolidated to 2026-06-19)
- [HackerNews Trends: Agent Memory Patterns](./findings/hn-memory-patterns.md) — back-to-SQL movement, multi-agent memory consistency, dual-mode memory (vector + relational)
- [Multi-Agent Coordination Patterns](./findings/multi-agent-coordination-patterns.md) — domain accountability, event-driven interaction, metrics-as-health-signals (early internal observations)
- [Multi-Agent Coordination Patterns: Updates & Trends](./findings/multi-agent-patterns-2024.md) — marketplace over hierarchy, event-driven blackboards, artifact-centric handoffs, evaluator agents
- [Multi-Agent Coordination Failures: Synthesis & XHS Trends](./findings/multi-agent-failures-2026-synthesis.md) — consensus trap / Yes Man evaluator, swarm communication overhead, context stigmergy as escape route
- [XHS Chinese AI Community — June 2026 Findings](./findings/xhs-chinese-ai-trends-june2026.md) — raw findings companion to synthesis note
- [XHS Library Health Assessment — June 15, 2026](./findings/2026-06-15-xhs-library-health-assessment.md) — consolidation audit: active XHS files reduced from 8→3, prediction checkpoint (3 confirmed, 3 entering forecast window), canonical note size warning (620 lines)
- [Scout Friction Analysis - 2025-05-09](./findings/scout-friction-analysis-2025-05-09.md) — 70% friction rate root-cause: uncommitted changes, runtime crashes, schema mismatches, guardrail violations
- [Cross-Source Triage — July 17, 2026](./findings/2026-07-17-arxiv-github-hn-triage.md) — formal governance primitives (shield synthesis, abstention competence, compliance-by-construction), Arbor cognition layer (tree search as shared working memory, 193% gain), Edict 三省六部 (bureaucracy-as-architecture, 16k★), KV-cache commerce, multiagent confidence protocols (sourced into agent-architectures.md, agent-security-governance.md, multi-agent-coordination.md)
- [arXiv Triage — June 11–12, 2026 (Batch 5)](./findings/2026-06-16-arxiv-ai-agent-triage.md) — evolvable harness engineering (HarnessX +14.5% avg, AgentSpec scaffold interaction effects), fail-plausible failure class (errors→narratives, 56% latent planning failures), guardrail inversion attacks (DoS 148× latency, cross-modal skill attacks 2–17% detection, decomposition bypass), file-first heterogeneous coordination (tap protocol 27-day production, 69.8% defect detection), capability minimization / least-privilege agents (RACG causal gating)
- [arXiv Triage — June 4–11, 2026 (Batch 4)](./findings/2026-06-14-arxiv-agent-triage.md) — PerspectiveGap orchestration prompting benchmark (14.9% pass rate), Consistency Illusion reasoning misalignment (CARA metrics + GDP intervention), Emergence World long-horizon divergence (15-day cross-vendor), EurekAgent environment engineering (<$11 SOTA), INFRAMIND infrastructure-aware orchestration (7× latency, 99.9% SLO), FlowBank workflow portfolios, Notes2Skills certainty preservation, Alem coordination bottleneck, InquiTree cognitive tunneling, FASE cheap uncertainty (sourced into agent-evaluation.md, agent-architectures.md, multi-agent-coordination.md)
- [arXiv Triage — June 4–12, 2026 (Batch 6)](./findings/2026-06-15-arxiv-agent-triage-batch6.md) — Intelligence Entropy (S(t)=S₀·e^(αt), 22 intrinsic properties, 40K+ trials), Strained Coherence pre-failure signal (94% failure prediction, median 83% trajectory time), Cold-Start Safety Gap (9–52% improvement with warm-up), MemVenom memory poisoning (99.15% on GPT-5), Decision-Aware Memory Cards (action-shift scoring), IntentKV (77.8% KV cache reduction), MemoPilot RL-over-memory, Bayesian-Agent posterior-guided skill evolution (SOP-Bench 80→95%), Semantic Quorum Assurance (unsafe approval 18.5→0.3%), MAC-Bench Goodhart compliance (Machiavellian Gap metric), SciTrace trajectory-aware safety (78.8% compositional escape detection). Cross-batch convergence: lifecycle governance stack, memory-as-everything, degradation-is-physical. **Sourced into**: agent-architectures.md, agent-security-governance.md, agent-evaluation.md.
- [arXiv Triage — June 2–12, 2026 (Batch 7)](./findings/2026-06-15-arxiv-agent-triage-batch7.md) — Tool Deference worsens with capability (97-99% blind agreement, [2606.14476]), Workspace+Skill naming event ("From Chatbot to Digital Colleague", [2606.14502]), HarnessFix trace-guided harness repair (+15-50%, HTIR intermediate representation, [2606.06324]), Communication Policy Evolution (CPE, evolvable at prompt level, [2606.14314]), Data Agent attack surfaces (8 risks across interpretation/execution/policy, [2606.08661]), ConMem relation-aware memory (-80% planning overhead, [2606.08702]), SkillAudit paired trajectory auditing (73.9% reward, [2606.14239]), CLI composition = multi-agent orchestration ([2606.11869]), Orchestra-o1 omnimodal orchestration (+10.3%, DA-GRPO, [2606.13707]). Cross-cutting themes 9-11: tool deference & judgment gap, harness engineering lifecycle, communication as design dimension. **Sourced into**: agent-architectures.md, agent-security-governance.md, multi-agent-coordination.md, agent-evaluation.md.
- [HN Scan — June 15, 2026 (Third Pass)](./findings/2026-06-15-hn-scan-3.md) — Chinese open-weight acceleration (GLM 5.2 742pts, MiniMax M3, Kimi K2.7 — explicit response to US restrictions), AI fatigue counter-narrative consolidating (457pts), agent externality pattern crystallizing (DN42 1455pts, Fedora 549pts, curl 290pts, jqwik 127pts — four-type taxonomy: financial/attention/trust/defense externalities), formal methods + AI verification convergence (Jane Street 253pts — AI generates, AI verifies, humans supervise). **Sourced into**: agent-security-governance.md §1.6.

## Migration Notes

The first migration deliberately did not consolidate duplicate-looking files.
Those are now visible through this index so the project can review and merge
them with task-tracked evidence instead of silently deleting context.

Known consolidation clusters:

- ~~Agent architecture~~: consolidated into `agent-architectures.md` (2026-06-14).
- ~~Evaluation~~: consolidated into `agent-evaluation.md` (2026-06-14).
- ~~Multi-agent trends~~: consolidated into `multi-agent-coordination.md` (2026-06-14).
- XHS reports: 6 generic/duplicate XHS notes superseded (2026-06-15). Batch 2
  (2026-06-15): 4 additional small XHS notes superseded — `xhs_failure_modes.md`,
  `xhs_coordination_trends_may2026.md`, `xhs_latest_trends_insight_report.md`,
  `xhs_trends_report_Q2_2026.md` — all content covered by canonical notes or the
  June 2026 XHS trends note. Active XHS notes reduced from 6 to 3:
  `xhs_chinese_ai_trends_june2026.md` (canonical), `xhs_chinese_ai_trends_may2026.md`
  (provenance), `agent-patterns-xhs-2024.md` (2024 provenance).
