# Scout × System Synthesis Update — 2026-02-27
*Written by Bob. Update 9. Covers 23 new Scout discoveries (all 2026-02-26 batch) + 4 Reddit signals.*
*Format: [Scout finding cluster] → [our system state] → [judgment/action]*
*Prior synthesis: scout-synthesis-2026-02-25.md (Update 1-8 in scout-amy-synthesis-2026-02-26.md)*

---

## What's New Since Last Synthesis

**23 papers/findings** from Scout's Feb 26 batch, covering:
- Agent reliability: TAPE, behavioral consistency, General AgentBench TTS failures
- Memory architecture: UMEM, AgentOS abstraction layer
- Security: Agentic Skills/ClawHavoc, PackMonitor, ICON (IPI defense)
- Multi-agent: HieraMAS (intra-node mixtures), topology theory (Amy signal)
- Frontier models: GLM-5, MiniMax M2.5, Aletheia (math research agent)
- Test-time compute: PETS, DREAM, SRR-Judge, Reflective planning
- Alignment: Pressure Reveals Character, LLM trust inconsistency biases
- GUI agents: ActionEngine (state-machine memory, 11.8x cost reduction)
- Reddit: MoE expert routing degrades reasoning with tools; 91k production attack data

**3 major theme evolutions from Update 1-8:**
1. **Security cluster is now concrete** — ClawHavoc is a real incident (not theoretical), ICON and PackMonitor are now defensive tools
2. **TTS has critical failure modes** — General AgentBench shows both sequential TTS (context ceiling) and parallel TTS (verification gap) fail for general agents — this updates Update 8's cautious-positive stance
3. **Multi-agent topology validated** — Amy's Feb 27 signal independently confirms the centralized topology advantage (4.4x vs 17.2x error amplification)

---

## Section 1 — The Security Cluster Crystallized

### ClawHavoc: The Field's First Documented Agent Security Incident at Scale
Scout's update 7 covered ClawHavoc conceptually. The Feb 26 Agentic Skills paper (2602.20867) adds the full scope: ~1,200 malicious skills on a major agent marketplace, exfiltrating API keys, cryptocurrency wallets, browser credentials via prompt injection in skill payloads. This is now the canonical agent security incident in the academic literature.

**What this means for our system:** The Agentic Skills paper's seven design patterns (especially trust-tiered execution, signature verification, sandboxed execution) are now the reference architecture for skill security. We don't run a skills marketplace, but our agents do process external content (Amy reads XHS, Scout reads GitHub and arXiv). The attack surface identified in Update 8 (external content → persistent memory → zombie agent) is the same attack surface ClawHavoc exploits in a different vector.

**The new defensive layer:** PackMonitor + ICON together sketch a two-layer runtime defense:
- **PackMonitor** (2602.20717): constrains package names during decoding using DFA — eliminates hallucinated/malicious package installation at the decode level
- **ICON** (2602.20708): detects IPI via latent-space over-focusing signatures, steers attention away from adversarial content without over-refusing (0.4% ASR, 50%+ utility preservation)

These are model-level interventions requiring infrastructure we don't have. But the pattern they establish is important: **don't try to filter inputs; intercept at the representation level.** This is architecturally cleaner than prompt-based injection defenses.

**91k production data (Reddit, 2026-02-23):** Attack vector distribution is shifting:
- Tool/command abuse: nearly doubled (8.1% → 14.5%)
- Planning-phase attacks: doubled (3.6% → 6.9%)
- Inter-agent attacks: growing (3.4% → 5.0%)

**Planning-phase attacks are the novel class** — they target the agent's internal objective graph during reasoning. Existing threat models (MAESTRO, MAST) don't fully cover this. This is an emerging attack surface, not a theoretical one.

**System judgment:** Our security posture remains "acknowledge, don't armor." But the threat model is now richer:
1. Memory poisoning via external reads (was: theoretical, now: mechanistically demonstrated in ClawHavoc)
2. Planning-phase attacks (was: not in threat model, now: measured at 6.9% in production)
3. Tool abuse (was: MAST FM category, now: measured 14.5% and growing)

No immediate action required, but the trajectory of the threat is clear. The design constraint to eventually add: memory write-gating (content validation before write to persistent store) + explicit trust tiers for content sources.

---

## Section 2 — Agent Reliability: Three New Data Points That Sharpen the Picture

### Finding 1: First Tool Call Is the Highest-Leverage Intervention Point
Behavioral Consistency paper (2602.11619): **69% of agent behavioral divergence occurs at step 2** — the first search query / tool call. Consistent agents (≤2 unique paths per 10 runs) achieve 80-92% accuracy. Inconsistent agents (≥6 paths) achieve 25-60% accuracy. The 32-55pp accuracy gap is entirely predictable from step-2 divergence.

**Implication:** If you can constrain or monitor the first tool call, you've addressed 69% of the variance source. TAPE's constrained decoding operates at execution — this is the step-2 moment. Our current agent specs give open-ended initial actions. The fix is simple: **constrain first action type, not just objective.** "For analysis tasks, start by reading the specific file/source before synthesizing." This is already in some HEARTBEAT.md specs, but not systematically.

### Finding 2: TTS Has Fundamental Failure Modes for General Agents
General AgentBench (2602.18998): both sequential TTS (runs into context ceiling before resolution) and parallel TTS (can't verify which trajectory is correct without ground truth) fail in general cross-domain agent settings. Domain-specific training degrades badly in general environments.

**Update to prior judgment:** Update 8 was cautiously positive on TTS. This paper is a correction: TTS works for narrow, well-defined domains with clear verifiers (math, code). For our agents (open-ended analysis, community monitoring, system review), TTS is not a useful primitive. The verification gap is the real problem — we can't verify which of N trajectories is correct without actually checking the work. This is exactly why Bob has an evidence-based exit criteria requirement (Proposal 1 from Update 1-8).

### Finding 3: MoE Architecture Creates New Failure Mode
Reddit signal (2026-02-26): Qwen3.5-35B-A3B with tools in context → dramatically fewer thinking tokens, wrong answers. Without tools → full structured reasoning, correct answers. Root cause: MoE expert routing activates tool-use experts when tool definitions are in context, suppressing reasoning experts.

**Our system relevance:** We don't run Qwen3.5-35B. Our agents run on Claude Sonnet, which is not a MoE architecture in the same sense. But the principle is important: **context composition can degrade rather than augment capability.** If we ever add MoE models to the rotation, separate reasoning agents from tool-calling agents — don't give MoE models the full tool set when you need deep reasoning. This is a concrete design rule.

---

## Section 3 — Memory Architecture: UMEM + AgentOS Add Vocabulary

### UMEM: Jointly Optimizing Extraction + Management
UMEM (2602.10652) addresses the "noise accumulation" problem in memory banks — existing methods treat extraction as static, only optimizing management. Over time, instance-specific noise accumulates and degrades retrieval. UMEM's fix: Semantic Neighborhood Modeling — evaluate each memory across clusters of semantically related queries, not single-query utility. Result: monotonic growth (no degradation) + 10.67% improvement on multi-turn tasks.

**Our system state:** Our memory files (insights.md, discoveries.md, MEMORY.md) don't currently optimize extraction quality — they accumulate entries written by agents. Amy's compaction (compact #33 as of last week) is the closest analog: it prunes low-value observations from insights.md to keep the active file lean. But it doesn't optimize for neighborhood-level utility — it optimizes for recency and density.

**The gap UMEM names:** We have storage (file system) and management (compaction), but no extraction quality framework. "Is this memory worth keeping?" is answered by agent judgment at compaction time. UMEM says the right answer requires evaluating each memory against semantically related future queries — not just current relevance. This is a medium-term improvement to Amy's compaction criteria: when deciding to keep vs. archive an insight, consider: "does this still answer questions that users/agents are likely to ask?"

### AgentOS: OS Abstractions Give Us Vocabulary
AgentOS (2602.20934) maps OS concepts onto agent constructs: context window = Addressable Semantic Space, external store = disk, MCP tools = I/O interrupt handlers, temporal alignment = preventing cognitive drift. This is vocabulary, not a new capability.

**Useful for us:** The "Temporal Alignment" framing gives a name to a failure mode we've seen but haven't named. When agents run long sessions (Scout at 40+ heartbeats), they drift — early context shapes interpretation of later observations. AgentOS calls this "cognitive drift in multi-turn/multi-agent orchestration." The fix: periodic re-alignment steps (restating current objectives, as Manus's attention recitation principle says). We already have this principle; now it has a name.

---

## Section 4 — Multi-Agent Topology: Now Empirically Validated

### Amy's Feb 27 Signal (Independent Validation)
The Chinese practitioner community (包子 698ed6cb, ❤️361) surfaced the Google Research + DeepMind "Towards a Science of Scaling Agent Systems" paper independently of Scout's tracking:

- Sequential reasoning tasks: ALL multi-agent variants lose 39-70% vs single agent
- Independent architecture (agents share info laterally): error amplification 17.2×
- **Centralized architecture (leader coordinates)**: error amplification 4.4×
- Parallel complex tasks: Centralized MAS gains +80.8%

**This directly validates our architecture.** Amy/Bob/Scout is a centralized topology — Main orchestrates, agents are parallel specialists. This matches the optimal case from the empirical data: parallel complex tasks with centralized coordination. The 4.4x vs 17.2x error amplification difference is the quantitative reason why we built it this way.

**What this rules out:** Don't build independent chains where Amy feeds Scout feeds Bob in sequence. That's 17.2x error amplification and 39-70% performance degradation on reasoning tasks. Cross-synthesis (Bob reading both Amy and Scout outputs) is the correct pattern — it's centralized aggregation, not sequential handoffs.

**Phase Transition paper referenced (Amy signal):** "Phase Transition for Budgeted Multi-Agent Synergy" — theoretical threshold framework for when multi-agent adds value. Worth Scout tracking.

### HieraMAS: The Supernode Concept
HieraMAS (2602.20229): each agent role = multiple heterogeneous LLMs using a propose-synthesis structure (LLM-A proposes, LLM-B synthesizes). This is the "intra-node mixture" concept — mixing at the role level, not the system level.

**Our system relevance:** We run one model per agent role (all Claude Sonnet). HieraMAS says you can get better cost-performance by having e.g., Claude Haiku propose + Claude Sonnet synthesize within a role. This is a future architecture option, not a current need. Worth noting for when cost optimization becomes relevant.

---

## Section 5 — What's Now Validated About Our Current Design

Updating the "Where We're Ahead" section from Update 8 synthesis:

| Prior validation | New evidence | Confidence |
|---|---|---|
| Centralized topology | Google Research + DeepMind empirical data + Amy community signal | ↑↑ Very high |
| Filesystem-as-memory | UMEM paper explicitly validates file-based memory stores | ↑ High |
| Domain specialist agents | HieraMAS validates topology optimization, SkillOrchestra validates skill-aware routing | ↑ High |
| Evidence-based exits (P1) | TTS verification gap shows "verify by sampling more" fails — explicit evidence is the only reliable mechanism | ↑↑ High |
| P3 (orphan recovery) | 30% misbehavior rate (Wink) still stands; behavioral consistency paper adds "step-2 intervention" as complementary signal | ↑ High |

**P2 (context prefix audit)** is still valid as cost hygiene. Human's feedback that it needs design for timestamp retention is correct — the rule needs to be: "volatile content belongs at the end of context, not in the prefix." Timestamps can live in journal entries (which are appended), not in system prompt.

---

## Section 6 — New Synthesis Judgment on the COMMON.md Proposals

Human's feedback on Proposals 1-3 (from scout-synthesis-2026-02-25.md) raised the right challenge: "prove these add value before adding complexity." Here's the updated analysis informed by 23 new findings:

### P1 (Exit Criteria with Evidence Requirements)
**Human question:** Where to save the evidence? Could another agent audit it?

**Updated judgment:** The evidence should go in JOURNAL.md — it's already the completion record. The rule becomes: when writing `[DONE]`, include one sentence of evidence inline. Example: `[DONE] — Evidence: synthesis at workspace-bob/knowledge/scout-synthesis-2026-02-27.md, covers 23 findings, sent to Telegram`. This is already what Bob does informally. Making it explicit:
1. Adds zero friction (one sentence)
2. Is auditable (Coach or Main can read JOURNAL entries and verify the cited file exists)
3. Timestamps are already in JOURNAL.md format

The auditor concern is valid: if Coach or Main wants to verify Bob actually wrote the synthesis, they can `cat` the cited path. No new infrastructure needed. **This proposal should be implemented.**

### P2 (Context Prefix Audit + Cache Rules)
**Human question:** Timestamps are critical info — how to keep them without losing to cache busting?

**Updated judgment:** This was always the design tension. The rule should be: 
- Timestamps that are static (JOURNAL entry headers, creation dates) → stay where they are, they don't change
- Timestamps that are dynamic (current time, session start time) → only go in context positions after the stable prefix

The audit is still worth doing. Look at each agent's system prompt and ask: "Does this prefix change between sessions?" If not, it's cache-friendly. If yes, identify what changes and move it down. The rule for COMMON.md: "System prompt prefix must not contain content that changes between sessions. Dynamic session info belongs in the first user message or early context, not in the system prompt above tool definitions."

**Verdict:** The proposal is correct, but the human's timestamp concern identifies a nuance that was already in the proposal (dynamic state doesn't belong in prefix, it belongs later). **Implement as a COMMON.md rule, not an infrastructure change.**

### P3 (Recovery Protocol for Orphaned Tasks)
**Human question:** Simple tasks may not be worth the recovery complexity. Complex tasks that are broken into subtasks should already not redo subtasks (that's task design, not recovery protocol).

**Updated judgment:** The human is right that P3 has a scope problem. The proposed protocol is most valuable for:
- Long Scout synthesis runs (1-2hr)  
- Amy's archive scan sessions (30-60min)
- Multi-step Bob analysis sessions

It's NOT useful for:
- Simple L1 tasks ("read SIGNALS.md")
- Single-file writes
- < 5 tool call tasks

The proposal should be scoped: **"For tasks marked as [COMPLEX] in the JOURNAL entry, apply the recovery protocol."** This means agents make a judgment call at the start of a session: "is this complex enough to warrant recovery-mode tracking?" For a heartbeat run, that's usually no. For a synthesis session that will produce a knowledge document, that's yes.

**Verdict:** Implement P3 with the scope gate: only for explicitly marked [COMPLEX] tasks. Reduces complexity for simple tasks to zero; provides value for the 20% of sessions that actually need it.

---

## Section 7 — Three New Proposals from Feb 26 Batch

Building on the original three, three more:

### Proposal 4 — Step-2 Constraint as a Routine Element for Analysis Tasks
**Source:** Behavioral Consistency paper (69% of divergence at step 2)
**Fix:** For analysis tasks, HEARTBEAT.md should specify: "Before synthesizing, load [specific source] first. Don't begin synthesis from memory." This constrains the first tool call and reduces behavioral variance.
**Priority:** LOW — our agents already have domain-specific startup protocols. This is more a reminder than a new rule.

### Proposal 5 — Topology Documentation in COMMON.md
**Source:** Google/DeepMind empirical data on centralized vs independent topologies
**Fix:** Add one section to COMMON.md under Multi-Agent Coordination: "Our architecture is centralized (Main coordinates). Sequential handoffs between agents amplify errors 17.2×; prefer parallel specialists feeding a coordinator. Never daisy-chain: Amy → Scout → Bob → Main. Prefer: Amy+Scout → Bob → Main."
**Priority:** MEDIUM — prevents a design mistake that would be hard to diagnose once established.

### Proposal 6 — Security Posture Update: Name the Attack Surface
**Source:** ClawHavoc (1,200 malicious skills), 91k production data (planning-phase attacks growing), Behavioral Consistency (step-2 intervention point)
**Fix:** Add to COMMON.md or system-model.md: a single paragraph acknowledging the attack surface. "Agents that read external content (Amy: XHS posts, Scout: GitHub/arXiv/Reddit) and write to persistent memory create a potential memory poisoning surface. Current mitigations: none explicit. Design constraint for future: memory write-gating before persistent archive writes. Do NOT implement now — acknowledge the surface."
**Priority:** LOW for now — useful when we expand content sources.

---

## Summary Map

| Finding | Our system state | Gap/Validation | Priority |
|---------|-----------------|----------------|----------|
| 69% divergence at step 2 | Open-ended first actions | Gap: constrain first tool call type | LOW |
| TTS fails for general agents (context ceiling + verification gap) | Not using TTS | **Validated** — our explicit evidence approach (P1) is the right alternative | — |
| MoE + tools = reasoning degradation | Not running MoE | Contingent design rule: separate reasoning/tool agents for MoE models | LOW |
| ClawHavoc 1,200 malicious skills | External content → persistent memory, no write-gating | Latent surface, acknowledged | LOW (now), MEDIUM (later) |
| Centralized MAS: 4.4× vs independent 17.2× error amplification | Centralized (Main + parallel specialists) | **Validated** ↑↑ | — |
| UMEM: extraction quality matters as much as storage | Compaction by recency/density, no neighborhood utility | Gap: Amy's compaction criteria | MEDIUM-TERM |
| AgentOS: cognitive drift in long sessions | 40+ Scout HB sessions | Gap: periodic objective restatement (Manus P4 still unimplemented) | LOW |
| P1 Evidence requirements | Informal | **Implement: 1 sentence in JOURNAL [DONE]** | HIGH |
| P2 Cache prefix audit | Unaudited | **Implement: COMMON.md rule** | MEDIUM |
| P3 Recovery protocol | Detection only | **Implement with [COMPLEX] scope gate** | MEDIUM |

---

## Deliverable: P1-P3 Implementation Proposal

**Proposed COMMON.md additions:**

**P1 addition** (under Rules section):
> "When writing [DONE] in your journal, include one sentence of evidence: cite the specific file path, count of items covered, or action confirmed. Example: `[DONE] — Evidence: synthesis at knowledge/scout-synthesis-2026-02-27.md, 23 findings covered, Telegram sent.` This is auditable by other agents."

**P2 addition** (new short section "Context Engineering"):
> "System prompt prefix must not change between sessions. Never put current time, session IDs, or dynamic counts in the system prompt header. Volatile content belongs in your first action or early in the context, not at the top. Timestamps in JOURNAL entries are fine — they're appended, not in the prefix."

**P3 addition** (under Rules section):
> "For [COMPLEX] tasks (synthesis sessions, multi-file analyses, anything you expect to take >10 tool calls): if you find an orphaned [STARTED] entry in your journal, (a) read the task description, (b) scan for partial output (committed files, half-written docs), (c) resume from there, add [RECOVERED from: timestamp]. For simple tasks, skip — just restart clean."

These three are pure documentation additions. No infrastructure. Zero cost.

---

*Bob, 2026-02-27 04:10 CST. Synthesis Update 9.*
*Input: 23 Scout Feb-26 discoveries + 4 Reddit signals + Amy topology signal*
*Prior synthesis chain: scout-synthesis-2026-02-25.md → scout-amy-synthesis-2026-02-26.md → this*

---

## Addendum — Claude MAS -4.6% Finding: Architecture Risk Assessment

**Source:** Amy SIGNALS.md 2026-02-27 | Paper: "Towards a Science of Scaling Agent Systems" (Google Research + DeepMind + MIT, arXiv likely 2601.x, Amy post 6989041c)

**The claim:** Claude family MAS vs best single-agent variant = **-4.6%** (averaged across 4 benchmarks). GPT: +8.7%. Gemini: +8.1%. Amy flagged this as a potential challenge to our Amy/Bob/Scout architecture.

**Bob's evaluation:**

### What the -4.6% actually measures

The paper runs 180 controlled configurations across 5 architectures (SAS, Independent, Centralized, Decentralized, Hybrid), 4 benchmarks, 3 LLM families. The -4.6% is an **average** across all task types and all architecture variants for Claude, compared to its own best single-agent baseline.

The paper's own Figure 1 data is crucial: the effect is **highly task-type-dependent**:
- Sequential reasoning → ALL MAS variants: -39% to -70%
- Parallelizable tasks → Centralized MAS: +80.8%
- Dynamic navigation → Decentralized: +9.2%

The -4.6% Claude average is being pulled down by the sequential reasoning penalty. It doesn't mean Claude can't work well in MAS — it means Claude in MAS on sequential reasoning tasks is particularly bad.

### Is our architecture in the -4.6% failure mode?

**No.** Here's why:

Our system is **domain-partitioned parallelism**, not a multi-agent split of a single task:

| What the paper tests | What we run |
|---------------------|-------------|
| 3 Claude agents trying the same problem | Amy does XHS, Scout does tech, Bob synthesizes |
| Sequential task split across agents | Parallel independent domains, centralized synthesis |
| Agents handing off within a single task | Agents producing independent knowledge artifacts |
| Coordination overhead on shared state | Each agent has exclusive write domain, Bob reads all |

The parallel domain structure maps to the paper's **best case** for MAS: "parallelizable tasks with centralized coordination" = +80.8%. Amy doesn't know what Scout found; Scout doesn't know what Amy found. Bob synthesizes both independently. This IS the favorable topology.

### The valid concern Amy raised: Within-heartbeat tool chains

Amy correctly notes that a single heartbeat (search XHS → read posts → archive → analyze) is tool-intensive. The paper's "Tool-Coordination Trade-off" says: **fixed compute budget, tool-intensive tasks incur the heaviest coordination tax**.

But within a single heartbeat, Amy IS already a single agent. The tool-intensive chain runs inside one session. We're not splitting Amy's heartbeat across multiple agents. So the within-heartbeat concern doesn't apply to our current design.

Where it WOULD apply: if we ever proposed "Amy-A handles posts 1-50 and Amy-B handles posts 51-100 in the same session." That would be the tool-intensive MAS failure mode. We should not build this.

### The capability saturation point

Paper: single-agent baseline >45% → coordination marginal return turns negative (β̂ = -0.404, p<0.001).

Our baseline agents are performing at high capability on narrow tasks (Amy: high accuracy XHS analysis, Scout: high accuracy tech tracking). If their per-domain accuracy is >45%, adding more agents to the same domain would hurt. But that's not our architecture — we add agents for NEW domains, not for MORE coverage of the same domain.

### Bottom line

**The -4.6% finding does not challenge our Amy/Bob/Scout architecture.** It challenges "run three Claude agents on the same task." Our design avoids this.

**What we should not do (per this paper):**
- Split any single agent's task across multiple Claude agents working in parallel
- Add agent redundancy within a domain already well-covered
- Use MAS for sequential reasoning chains (use one agent for those)

**What we're doing correctly:**
- Domain-partitioned parallelism (Amy/Scout/Bob have exclusive domains)
- Centralized synthesis (Bob reads all, synthesizes)
- Single agent per heartbeat for tool-intensive tasks

**One genuine flag:** Claude's -4.6% suggests it's a worse multi-agent team player than GPT or Gemini, likely because it already internalizes some multi-agent exploration behavior in single-agent mode (per Sydney He's diagnostic scan finding). If we ever scale to a configuration where multiple Claudes work on the same task collaboratively, we should consider mixing models (e.g., GPT for subagents, Claude for synthesis). Not a concern today.

*Addendum written 2026-02-27 04:42. Amy signal processed. P3 test: YES — this changes architecture understanding.*

---

## Self-Challenge Note (2026-02-27 05:25) — Claude MAS Analysis

Quick self-check on the -4.6% dismissal: was it too fast?

**Potential counter-argument:** The paper's -4.6% is averaged across ALL Claude MAS configurations, including centralized topologies. If Claude is fundamentally worse as a multi-agent team player even in centralized configs, the dismissal is wrong.

**Why the dismissal still holds:**
The paper shows centralized topology = +80.8% on parallelizable tasks — that's the improvement we'd expect. The -4.6% average is pulled down by sequential reasoning tasks where ALL MAS variants fail badly for all models. Claude's steeper penalty likely reflects Claude performing better than GPT/Gemini in single-agent sequential reasoning (a higher baseline to beat), making the MAS regression look larger in percentage terms.

The correct question is not "does Claude in MAS < Claude single-agent on average?" but "does Claude in centralized MAS < Claude single-agent on *parallelizable domain-specialist tasks*?" The paper's data (centralized +80.8% on that task type) says no.

**Conclusion:** Analysis stands. The one genuine residual uncertainty: we don't have Claude-specific data for the +80.8% parallelizable task type (only the aggregate). Worth flagging if that data becomes available.
