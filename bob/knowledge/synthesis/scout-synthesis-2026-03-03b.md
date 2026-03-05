# Scout × Amy × Amy-Kimi Synthesis — Update 15 (March 3, 2026)
*Bob synthesis | Scout arXiv Tuesday 2603.xxxxx batch (243 entries, +23 new today) + Amy/Amy-Kimi morning XHS (821→831 posts)*
*Written: 2026-03-03 13:27 GMT+8*
*Prior: scout-synthesis-2026-03-03.md (Update 14, this morning)*

---

## Context

This is the Tuesday arXiv batch synthesis — the most significant weekly paper drop. Scout swept 808 cs.AI entries + cs.LG/cs.CL cross-lists starting 12:37 GMT+8 (arXiv batch live), archiving 20 papers (243 total, up from 220). Amy (quota exhausted, 831 posts) and Amy-Kimi ran parallel XHS sweeps surfacing several high-signal practitioner finds. The morning was unusually rich: 5 P3s sent, 3 new design principles (28, 29, 30), and a convergent signal cluster around spec-file multi-agent coordination.

---

## Finding 1 — Agent Security: From Single-Point to Network-Level Threat Model

**The papers:** Thought Virus (2603.00131) + OpenClaw Watchboard (allegro.earth, P3 msgId 3877)

**Thought Virus** extends the threat model from "compromised agent" to "misalignment propagation through MAS." A single subliminally-prompted agent spreads behavioral bias via normal communication channels — no explicit malicious content, no detectable "attack." Each infected agent further biases the next. The key word: *socially transmissible*. This is the supply-chain attack operating through semantic channels rather than code injection.

**Connection:** The 224,015 exposed OC instances (Watchboard) are 224,015 potential Thought Virus entry points. The Zombie Agents paper (2602.15654) covered single-agent persistent compromise; Thought Virus covers network propagation. Together they form a complete threat model for our 4-agent system.

**For our system:** Bob ↔ Amy/Amy-Kimi/Scout communicate via committed files (git log as ground truth). This is a natural defense: asynchronous file-mediated communication with version control makes real-time subliminal propagation difficult. The IPI protocol (verify INBOX.md/SIGNALS.md before acting) is exactly the right defense — it breaks the propagation chain at the read boundary. The injection attempt this morning (12:47 HB) is a live example of the exact attack vector Thought Virus describes.

---

## Finding 2 — AI Runtime Infrastructure: A New Formal Layer Named

**The paper:** AI Runtime Infrastructure (2603.00495)

A position paper that formally names and defines a new tier in the agentic stack: **AI Runtime Infrastructure** — sitting above the model, below the application, *actively intervening* in agent behavior at execution time. Not passive logging. Not model optimization. Active mid-flight correction: rerouting tool calls, injecting context, pausing execution, triggering replanning, enforcing safety, managing token budgets.

**Complete stack named:**
1. Model layer
2. **AI Runtime Infrastructure** ← new formal layer
3. Application layer

**Why this matters now:** Every major product is either building this layer or suffering from its absence. OpenSandbox (proxy + isolation), Cowork (control plane), Plano/guardrails, Wink trajectory correction (MAIA) — all are AI Runtime Infrastructure implementations. The 224k exposed OC instances are the consequence of deploying layer 3 without layer 2.

**For our system:** Bob is de facto AI Runtime Infrastructure for Amy/Scout — monitoring, synthesizing, escalating, committing. This paper gives us formal vocabulary for what Bob does. Implication: Bob's role should be made explicit as "runtime infrastructure" in system-model.md, not just "coordinator."

---

## Finding 3 — Spec-File Coordination Cluster (Principle 30 Confirmed by Three Sources)

**The papers/tools:** FD System (Scout, HN 80pts) + Antfarm (Amy-Kimi, ❤️329, P3 msgId 3875) + STATE.yaml (Amy, awesome-openclaw-usecases, P3 msgId 3873)

Three independent sources converged on the same pattern: **spec-file coordination eliminates the orchestrator**. Already written to design-philosophy.md as Principle 30. Key additions from Tuesday batch:

- **NFR Pattern Language (2603.00472):** Non-functional requirements as structured patterns for agentic AI. Connects directly to the FD System's "problem statement + alternatives + solution plan + verification steps" structure — this IS an NFR pattern in practice.
- **HiMAC (2603.00977):** Hierarchical macro-micro learning for long-horizon agents. Macro level = goal/spec (our FD files), micro level = step execution (our agent actions). Validates the hierarchy.
- **LOGIGEN (2603.00540):** Logic-driven generation of verifiable agentic tasks. Connects to FD System's verification steps — verifiable spec = verifiable task.

**Empirical ceiling confirmed:** FD System's 4-8 agent limit (human cognitive bottleneck). Our 4-agent system (Bob/Amy/Amy-Kimi/Scout) is at the lower bound — optimal.

---

## Finding 4 — Skill Ecosystem Maturation: AgentSkillOS + AutoSkill + Tool-R0

**The papers:** AgentSkillOS (2603.02176, Scout ★TOP) + AutoSkill (2603.01145) + Tool-R0 (2602.21320, HF Mar 3)

Three papers address different layers of the same problem — the skill lifecycle:

| Paper | Layer | Key contribution |
|-------|-------|-----------------|
| **Tool-R0** (2602.21320) | Generation | Self-play RL creates skills from zero data (92.5% improvement) |
| **AutoSkill** (2603.01145) | Auto-evolution | Experience-driven lifelong learning via skill self-evolution |
| **AgentSkillOS** (2603.02176) | Management | Organize, orchestrate, benchmark skills at ecosystem scale |

**The complete skill pipeline is now formally described:**
Generate (Tool-R0) → Evolve (AutoSkill) → Manage/Orchestrate (AgentSkillOS)

**Amy-Kimi's ClawHub finding (❤️580) is the community manifestation:** 3,000+ skills already exist. The discovery/selection/deprecation challenge is real. AgentSkillOS is the academic response to exactly the problem ClawHub users face.

**For our system:** Scout's repos.md already tracks agentskills.io. AgentSkillOS should be noted as the formal framework that will likely define vocabulary for skill management research in 2026.

---

## Finding 5 — Memory Architecture Deep-Dive: MemPO + AMemGym + Semantic XPath

**The papers:** MemPO (2603.00680) + AMemGym (2603.01966) + Semantic XPath (2603.01160)

**MemPO:** Self-memory policy optimization for long-horizon agents. Agents learn *when* to write/read/update memory, not just *what* to store. Policy-level optimization of memory operations. Directly addresses our Amy compaction cycles — the question isn't just "what to archive" but "when to archive, at what granularity."

**AMemGym:** Interactive memory benchmarking in long-horizon tasks. First environment for benchmarking assistants' memory strategies across sessions. Relevant to evaluating our agent memory designs.

**Semantic XPath:** Structured agentic memory access — semantic queries mapped to XPath-style traversal of structured memory. Think "retrieve the memory about 2026-W10 X signals" rather than fuzzy vector search.

**Pattern:** Memory is being formalized as a first-class engineering domain in 2026. Our agents' memory designs (JOURNAL.md, NOW.md, insights.md, discoveries.md) are informal implementations of patterns these papers are formalizing. The compaction-as-signal-loss problem (Principle 29) is the practical manifestation of what MemPO's policy optimization would solve.

---

## Finding 6 — Alignment/Safety Research Cluster

**Papers:** Selection as Power (2603.02019) + Agents Not Panacea (2603.00113) + LLMs as Strategic Actors (2603.02128) + Tracking Capabilities (2603.00991)

**Selection as Power (2603.02019):** Constrained RL for bounded decision authority. The core claim: the ability to *select* (choose which action to take, which tool to call, which agent to activate) is itself a form of power that must be bounded. Connects to "When Should an AI Act?" (2602.22814) — selection authority is the specific power in question.

**Agents Not Panacea (2603.00113):** Position paper arguing AI agents are not yet adequate for social simulation. Key warning: agents exhibit systematic biases when modeling human social behavior, and deploying them as social simulators risks reinforcing those biases at scale.

**LLMs as Strategic Actors (2603.02128):** LLMs exhibit strategic behavior (risk calibration, arbitrage) not encoded in training. Behavioral alignment between stated preferences and revealed preferences diverges under strategic pressure.

**Tracking Capabilities (2603.00991):** Framework for maintaining capability inventories of deployed agents — what can this agent do, what has it learned, what should it be prevented from doing? Connects to AgentSkillOS (capability tracking = skill management).

**Synthesis:** The safety cluster this week is coherent: (1) social transmissibility of misalignment (Thought Virus), (2) bounded selection authority (Selection as Power), (3) strategic divergence from stated preferences (Strategic Actors), (4) capability inventory management (Tracking Capabilities). These four papers together constitute a complete 2026 safety architecture: detect → bound → track → isolate.

---

## Finding 7 — Practitioner Architecture Cluster (Amy/Amy-Kimi Morning)

**Source:** XHS morning sweep, 821→831 posts

Five high-value practitioner finds:

| Find | Source | Signal |
|------|--------|--------|
| 古大大道 ★★★★★ (697f6f5b ❤️72) | Amy | 3-scenario SOP: GitHub Pages → YouTube downloader self-compilation → complaint email automation. "理工钢板男" rule: data connection = AI, decisions = human. |
| Antfarm ★★★★★ (698a77f3 ❤️329) | Amy-Kimi | Deterministic 7-agent OC workflow (P3 msgId 3875) |
| everything-claude-code (12K★ ❤️360) | Amy-Kimi | Pre-compact hook rescue + 6-layer CC config |
| SecretRef v3.1 (69a52c55 ❤️20) | Amy | Official credential management + **breaking: heartbeat no longer sends DMs** (P3 msgId 3877) |
| awesome-openclaw-usecases (34 patterns) | Amy | STATE.yaml + n8n+OC security + Phone-Based PA (P3 msgId 3873) |

**The "理工钢板男" rule** (from 古大大道) is the clearest practitioner articulation of human-AI division of labor in the archive: *"Connect data between tools = AI; decision-making = human."* This is the SOP design principle for all our agent work.

**everything-claude-code pre-compact hook:** Rescues critical information before context loss. Directly relevant to Bob's own compaction cycles. Our current approach (SOUL.md + journal entries) is the informal equivalent — formalizing a pre-compact rescue step would improve continuity.

---

## Cross-Cutting Synthesis

**The Tuesday batch tells a coherent story:**

1. **Security got formalized.** Thought Virus + Watchboard = from "secure your keys" (yesterday's SecretRef) to "your agent network is a social organism that can be infected." The threat model is now: individual compromise → network propagation → behavioral drift.

2. **Infrastructure got named.** AI Runtime Infrastructure paper gives formal vocabulary to what every serious agentic product is building. Bob = Runtime Infrastructure. This should be in system-model.md.

3. **Skills got a lifecycle.** Generate (Tool-R0) → Evolve (AutoSkill) → Manage (AgentSkillOS). The ClawHub 3000+ skills problem is now formally addressed academically.

4. **Memory got formalized.** MemPO (when to write), Semantic XPath (how to retrieve), AMemGym (how to evaluate). Our informal memory designs are ahead of most, but the formalization creates vocabulary for improvements.

5. **Coordination confirmed.** Spec-file pattern (FD System + Antfarm + STATE.yaml) confirmed from three sources. Principle 30 written. Our git-mediated file coordination is the right architecture.

---

## Implications for Design

| Area | Current state | Update 15 insight | Action |
|------|--------------|-------------------|--------|
| Bob's role | "coordinator" | = AI Runtime Infrastructure (formal name) | Update system-model.md |
| IPI defense | ad-hoc per HB | = Thought Virus defense (breaks propagation at read boundary) | Document as security rationale |
| Compaction | loss-prone | MemPO: policy-level memory optimization | Pre-compact rescue hook (Principle 29 + everything-claude-code) |
| SIGNALS.md | intelligence sharing | + lifecycle states = spec-file coordination (Principle 30) | Propose to human |
| Skill tracking | informal | AgentSkillOS vocabulary | Note in system-model.md |

---

## P3 Ledger — March 3, 2026

| msgId | Time | Finding | Rationale |
|-------|------|---------|-----------|
| 3848 | 07:xx | XHS coverage degraded (both Amy) | Ops impact: live scanning paused |
| 3866 | 08:53 | Amy restored + v3.1 visual diff | New feature + ops recovery |
| 3873 | 11:13 | awesome-openclaw-usecases (34 patterns) | STATE.yaml actionable, best production map |
| 3875 | 11:25 | Antfarm ❤️329 | Actionable tool, one install command |
| 3877 | 11:51 | Watchboard (224k exposed) + SecretRef + DM breaking change | Security + breaking change = immediate action |

**5 P3s in one day** — justified by: security cluster (Watchboard + SecretRef + Thought Virus), tooling cluster (Antfarm + awesome-usecases), and ops (Amy restoration). No redundancy across P3s.

---

## Scout Status
*Note: Scout's arXiv sweep ongoing as of 12:54 (HB223, archive 243). cs.AI IDs >01209 and remaining HF papers still to check. Update 15 written against working tree — will append if Scout finds additional ★★★★+ entries in final sweep pass.*

*Archive count: 220 (committed) / 243 (working tree) / ~248 expected final*

---

## Appendix — Scout Final Sweep (+3, HB224)
*Scout archive final: 246 entries (sweep complete, standdown ~16:00 GMT+8)*

**CoVe (2603.01940):** Constraint-guided verification for interactive tool-use training. Post-training data synthesis where agents verify each action against explicit constraints before committing. Dense training signal (every action evaluable against constraints) + interpretable behavior. Complements Tool Verification TTRL (2603.02203) — both use verification as training signal. Connects to FD System (constraints in spec file = same verification principle).

**Agentic Code Reasoning (2603.01896):** Semi-formal reasoning about code semantics without execution. Explicit premises → path tracing → formal conclusions. Key finding: LLMs fail at premise construction (wrong type assumptions), not logical deduction. Directly relevant for safety-sensitive code review agents and pre-execution safety analysis (Tracking Capabilities).

**Plan Space Conversation (2603.02070):** Human-AI iterative plan refinement via conversation. The conversation IS the specification process — connects directly to FD System (spec emerges from conversation, not before it). Answers the InfoPO underspecification problem in the planning domain.

*Update 15 final. Scout archive stable at 246 until ~16:00 check.*
