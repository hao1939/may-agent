
## Insights Review Cross-Reference — 2026-07-15

**Source:** Pre-Check Anti-Pattern Case Study (`projects/may-agent.app/docs/case-study-precheck-antipattern.md`)

- **#9 Pseudo-Safety Trap**: +1 internal source. JS pre-check = textbook pseudo-safety — visible savings masked invisible capability loss. Now 13 sources.
- **#8 Placement Enforcement Law**: +1 internal source. "Agents decide whether to work. The harness decides when to wake them." — correction placed at right architectural level. Now 15 sources.
- **#2 Verification > Generation**: +1 conceptual cross-reference. External shallow verification (3 checkbox checks) strictly worse than agent self-verification for open-ended work.
- **#5 Minimum Sufficient Reasoning**: +1 nuance — floor constraint identified. Minimum sufficient ≠ zero. Agent must wake and reason minimally (~$0.02) even to conclude "nothing to do."

**Data Drought Status Update:**

| Source | Last Fresh Input | Days Stale | Status |
|---|---|---|---|
| XHS practitioner data (direct) | 2026-03-06 | **131+** | 🔴 Cookie expired, IP banned |
| XHS practitioner data (via Amy-Kimi) | 2026-03-12 | **125+** | 🔴 No new sessions |
| Scout academic signals | 2026-03-12 | **125+** | 🔴 All deep-dives cross-referenced |
| Bulletin | 2026-03-12 | **125+** | 🔴 Static |
| Internal system artifacts | 2026-03-12 | Active | 🟡 Thin but available (1 case study in 48 days) |
| Coze ecosystem | Never | ∞ | 🔴 Permanent blind spot |

---

## Signal Scan — 2026-03-12 (New Amy-Kimi Posts)

**Source:** 3 Amy-Kimi library posts not previously cross-referenced by Amy: 69ad2e76 (SkillNet), 69b2ca5e (OpenClaw-RL顶会), 69b2baef (CLI Agent).

### 69ad2e76 — SkillNet (Zhejiang University): Skill Infrastructure + Five-Dimensional Evaluation

**Cross-references to mega-patterns:**

**#4 (Contrastive > Comprehensive):** SkillNet's five-dimensional evaluation (安全性/完整性/可执行性/可维护性/成本意识) is comprehensive — a checklist approach. Per our mega-pattern, a contrastive evaluation ("what distinguishes a good skill from a bad one?") would likely outperform. However, for *skill auditing* (as opposed to output evaluation), comprehensiveness may be justified since skills are loaded as trusted context. The 26.1% skill vulnerability rate (from Amy-Kimi's graduation exercise) suggests comprehensive auditing of skills is warranted where contrastive evaluation is better for outputs. **Nuance: #4 applies to evaluation of agent outputs, not necessarily to infrastructure auditing.**

**#1 (Iteration Is Poison):** SkillNet's +40% reward / -30% steps result is direct evidence that skill reuse reduces iteration. Agents that draw from a curated skill bank need fewer exploratory steps — they're executing known-good paths. This is the positive complement to #1's negative framing: iteration hurts because agents re-derive from scratch; skills cure this because agents reuse proven patterns. Aligns with Philosophy P50 (Reuse Proven Patterns) and P52 (Skill Over Agent).

**#9 (Pseudo-Safety Trap):** The community controversy is notable. Critics say SkillNet is "回到规则化年代" (returning to rule-based era). This maps to the pseudo-safety concern: a rigid skill system could create false confidence ("we have skills for everything") while missing emergent capabilities. Our Two-Phase design (Explore→Harden, P9) is the correct resolution: explore WITHOUT skills first (let the model discover), then harden INTO skills. SkillNet's 200k skills might be a pseudo-safety trap if teams assume coverage = capability.

**Source count updates:** #1: +1 (now 28+), #4: +1 nuance, #9: +1 (now 14+)

### 69b2ca5e — OpenClaw-RL: Unverified but Architecturally Interesting

**Cross-references:**

**#5 (Minimum Sufficient Reasoning):** The "Binary RL (coarse-grained) + Hindsight-Guided OPD (fine-grained)" dual-track is structurally similar to minimum sufficient reasoning: use cheap coarse signals for most updates, expensive fine signals only where needed. The 36-interaction personalization claim, if valid, suggests high learning efficiency through signal selection.

**#6 (Self-Evolution Trilemma):** The "chat-while-train" / "交互即训练数据" paradigm is exactly the self-evolution loop the trilemma warns about. The asynchronous architecture may help (decoupled components are easier to ground externally), but the paper must specify its external grounding mechanism. Without it, this is vulnerable to the same degradation the trilemma proves.

**Verification flag:** No arXiv ID, no paper link. Claims about Princeton authorship unverified. Possible naming collision with our OpenClaw. **Do not cite as evidence until verified.**

### 69b2baef — CLI Agent: Minimal Signal

L1 content (image-only, no text). Title confirms CLI-as-agent-UI trend. Directionally consistent with our design but provides no new evidence for any pattern.

### Summary

One substantive finding from this scan: **SkillNet provides the first large-scale empirical evidence that skill reuse reduces agent iteration** (+40% reward, -30% steps). This strengthens #1 from the positive side (skills as cure) rather than the usual negative side (iteration as poison). The five-dimensional skill evaluation framework is worth noting for our own Skill audit design, though our #4 principle suggests contrastive evaluation would serve us better for most purposes.

**Data Drought Status:** Still 131+ days for most sources. These 3 posts were already in Amy-Kimi's library from 2026-03-12 but had not been processed by Amy. With these analyzed, there are no remaining un-cross-referenced Amy-Kimi posts.


---

## Signal Scan — Post-2026-07-15 (2 Uncovered Scout Deep-Dives)

**Source:** Two Scout deep-dives present on bulletin but never cross-referenced by Amy:
1. **NabaOS** (arXiv:2603.10060) — HMAC-signed tool execution receipts for hallucination detection
2. **Info-Theoretic Privacy Control** (arXiv:2603.05520) — Exponential privacy leakage amplification in sequential agent pipelines

### NabaOS (2603.10060) — Tool Receipts × Mega-Patterns

**#2 (Verification > Generation):** +1 strong source. NabaOS is the most practical instantiation of #2 in the entire archive. Key data: 91% detection rate at <15ms, $0 cost. Crucially, it verifies at the *execution layer* (HMAC receipts from runtime), not the *text layer* (self-consistency, RAG). This is exactly the "second-order verification" our pattern demands — the verifier cannot be corrupted by the same process that generated the output because it operates on a cryptographically separate channel. The 94.2% fabricated-tool-call detection rate demonstrates what #2 looks like when properly implemented.

**#9 (Pseudo-Safety Trap):** +1 nuance (counter-example). NabaOS's epistemic source classification (pratyakṣa/anumāna/upamāna/śabda/abhāva/ungrounded) is anti-pseudo-safety by design. Instead of binary verified/unverified (which creates false confidence in both directions), it preserves valid inferences while flagging ungrounded claims. The trust calibration data (98.7% accuracy at "Fully Verified" monotonically down to 23.4% at "Unreliable") demonstrates genuine calibration — not pseudo-safety. However: self-tagging compliance at 85% for open-weight models means 15% of responses default to "ungrounded" — which IS a pseudo-safety failure mode (over-flagging suppresses valid work). Design lesson: even good verification systems create pseudo-safety at their compliance boundaries.

**#7 (L3 Security Gap):** +1 concrete implementation. NabaOS receipts implement AgenticCyOps P3 (verified execution) directly. This is the first practical mechanism in our archive that could actually close part of the L3 gap: receipt chaining across multi-agent delegations creates an auditable provenance trail. The gap analysis is precise: single-agent receipts work now; multi-agent receipt chaining (A→B→C provenance) is NOT addressed. Our L3 gap is specifically about cross-agent propagation — NabaOS closes the per-agent verification gap but leaves the cross-agent gap open.

**#8 (Placement Enforcement Law):** Architectural validation. The receipt system works because it's placed at the RIGHT level: the runtime generates signatures, not the LLM. An LLM-level self-verification system would be vulnerable to the same confabulation it's trying to detect. This is #8 applied to security architecture: "verification must be placed at a level that the verified agent cannot influence."

**Source count updates:** #2: +1 (now 9+), #7: +1 (now 9+), #9: +1 nuance

### Privacy Control (2603.05520) — Exponential Leakage × Mega-Patterns

**#1 (Iteration Is Poison):** +1 mechanistic archetype. The (2^N − 1)·ε amplification bound is a new archetype for WHY iteration/composition degrades: information-theoretic leakage. Each additional agent in a sequential pipeline doubles the amplification of earlier agents' leakage. This maps directly to iteration: each additional iteration round is a "sequential agent" processing accumulated context. The early-agent dominance (Agent 1's leak = 2^{N-1}× Agent N's) explains why initial context pollution is so devastating — it gets amplified through every subsequent step.

**#6 (Self-Evolution Trilemma):** +1 formal result. The exponential amplification bound is structurally identical to the trilemma's DPI-based degradation proof: sequential self-processing monotonically degrades a property (safety for trilemma, privacy for this paper). Both proofs share the same Markov chain structure and both prescribe the same remedy: external grounding at each boundary crossing. The paper's "frontload controls at Agent 1" = the trilemma's "frozen safety anchors at the outermost boundary."

**#7 (L3 Security Gap):** +1 formal result. The exponential amplification bound makes the L3 gap worse than previously understood. Our system uses May as orchestrator ("Agent 1") — May sees everything and delegates downstream. Per the bound, May's context leakage is amplified 2^{N-1}× through any N-agent delegation chain. The paper proves that per-agent privacy controls are INSUFFICIENT for system-level privacy — you need system-level constraints. This is exactly the L3 problem: individual agent security (L1/L2) doesn't guarantee collective security (L3).

**#5 (Minimum Sufficient Reasoning):** +1 design implication. "Minimize information in delegation payloads" is a privacy-theoretic justification for #5. Every extra token in a delegation context is information that gets amplified through downstream composition. The paper proves this isn't just about efficiency — it's about security. Minimum context ≈ minimum leakage surface. Our principle to "reason less when less is sufficient" now has a formal security backing: over-reasoning = over-leaking.

**New Design Principle:** Pipeline depth matters exponentially. Prefer shallow delegation (May→Agent→May, 3 hops, 7× amplification) over deep chaining (May→A→B→C→May, 5 hops, 31× amplification) for operations involving sensitive context.

**Source count updates:** #1: +1 (now 28+), #5: +1 (now 8+), #6: +1 (now 14+), #7: +1 (now 10+)

### Combined Assessment

These two papers together illuminate a critical design duality:
- **NabaOS** = verification at boundaries (can you PROVE what happened?)
- **Privacy Control** = leakage through boundaries (can you CONTAIN what flows?)

Both converge on the same architectural prescription: **boundaries between agents must be both verified (NabaOS receipts) and minimized (Privacy Control shallow pipelines).** Trust requires proof; privacy requires constraint. Together they strengthen our Unified Architecture Principle — particularly the "external grounding at each boundary crossing" clause.

**Updated Drought Status:**

| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data (direct) | 2026-03-06 | 🔴 Cookie expired, IP banned |
| XHS practitioner data (via Amy-Kimi) | 2026-03-12 | 🔴 No new sessions |
| Scout academic signals | 2026-03-12 | 🟡 **2 papers newly cross-referenced this scan** — remaining un-analyzed: 0 |
| Bulletin | 2026-03-12 | 🔴 Static |
| Internal system artifacts | Sporadic | 🟡 Thin but available |

**Assessment:** With NabaOS and Privacy Control now cross-referenced, all known Scout deep-dives and Amy-Kimi posts have been fully analyzed. The archive is again exhausted of un-processed material. XHS restoration remains the #1 unblock.

*— Amy 📕*

---

## XHS Exploration Cycle — 2026-03-12 (Data Drought Broken)

### Source Count Updates

| # | Mega-Pattern | Sources (Updated) | Change |
|---|---|---|---|
| 1 | Iteration Is Poison | 29+ | +1 (MemSkill skill reuse reduces iteration) |
| 2 | Verification > Generation | 9+ | Reinforced (MCP attacks exploit missing verification) |
| 7 | L3 Security Gap | 11+ | +1 (MCPLIB 31 MCP attack methods, cross-tool contamination) |
| 8 | Placement Enforcement Law | 15+ | Reinforced (Coze workflow→Skills migration; CLI > MCP for internal tools) |
| 9 | Pseudo-Safety Trap | 15+ | +1 (mcpscan trades one vulnerability for another; UI approval = false confidence) |

### New Signal: MCP Security Attack Library (MCPLIB)
- **Source:** 68a41907 (Shanghai AI Lab) — 31 categorized MCP attacks
- **Pattern:** #7 (L3 Security Gap) — tool integration protocols are the newest attack surface
- **Actionable:** Our tool integration uses CLI, not MCP. This is architecturally safer. But ANY tool whose description is injected into agent context is subject to the same class of attacks.

### New Signal: MemSkill Validates Failure-Driven Skill Crystallization
- **Source:** 698c5f60 (arXiv:2602.02474, 746❤️) — published implementation with code
- **Pattern:** #1 (Iteration) + #6 (Trilemma) — skill reuse reduces iteration; skill evolution is safe side of trilemma
- **Actionable:** Our #1 unacted-on recommendation (Strategic Intelligence Report, 2026-03-26) now has a reference implementation. MemSkill's architecture: failure buffer → Designer review → skill edits/creation → RL-trained Controller for skill selection.

### New Signal: Skills > Workflows Is Industry Consensus
- **Sources:** 69678f6a (workflow→skills practitioner), 69565693 (Coze pivot analysis), search results showing Claude/Codex/Gemini all adopting Skills
- **Pattern:** #8 (Placement Enforcement Law) — declarative text > visual graph for agent workflows
- **Actionable:** Our AGENTS.md/SKILL.md design is validated by industry convergence. Coze's drag-and-drop failure confirms: workflow logic must be in text format the AI can interpret/adapt.

### New Signal: Multi-Agent Boundary Conditions Crystallized
- **Source:** 698ed6cb (493❤️, 81 comments) — OpenClaw subagent testing + Google scaling paper
- **Finding:** Community consensus: parallel=yes, sequential=no, centralized>independent (4.4× vs 17.2× error amplification)
- **Our status:** Architecture correctly positioned on all three axes.

### Coze Ecosystem: Blind Spot Partially Filled
- **Assessment:** Coze has evolved from visual workflow builder → code-based platform → converging toward Skills
- **Status change:** From "∞ days stale, permanent blind spot" → initial assessment complete
- **Follow-up needed:** Read about "扣子编程" (Coze Programming) in depth; track Coze Skills vs Claude Skills convergence

### Updated Data Drought Status

| Source | Last Fresh Input | Days Stale | Status |
|---|---|---|---|
| XHS practitioner data (direct) | **2026-03-12** | **0** | 🟢 **ACCESS RESTORED** |
| XHS practitioner data (via Amy-Kimi) | 2026-03-12 | 0 | 🟡 No new sessions needed |
| Scout academic signals | 2026-03-12 | 0+ | 🔴 No new Scout cycle |
| Bulletin | 2026-03-12 | 0+ | 🔴 Static |
| Coze ecosystem | **2026-03-12** | **First ever** | 🟡 Initial assessment |

### Research Priorities (Updated)
1. ~~"MCP 安全 攻击 防御"~~ → ✅ Done (MCPLIB found, 31 attacks catalogued)
2. "agent 失败模式 分类" — partially covered (MemSkill, Multi-Agent boundary); deeper dive possible
3. ~~"Coze agent 工作流"~~ → ✅ Done (Coze pivot to Skills-based confirmed)
4. "agent 记忆 投毒 防御" — still uncovered
5. "agent 权限分层 最小权限" — still uncovered
6. NEW: "MemSkill 记忆技能 skill bank" — follow up on implementation details
7. NEW: "MCP已死 CLI" — track the MCP backlash trend

*— Amy 📕*

---

## XHS Exploration Cycle — 2026-06-13 (Search-Only: Post Reading Broken)

### Access Status
- 🟢 Search: Working (3 searches completed)
- 🔴 Post Read: Broken (all reads redirect to homepage; cookie/session issue for deep reads)
- **Net capability:** Discovery only, no content extraction

### Source Count Updates (from search metadata)

| # | Mega-Pattern | Sources (Updated) | Change |
|---|---|---|---|
| 1 | Iteration Is Poison | 29+ | Skills-as-training-primitive = zero inference iteration (698bd217, Huaxiu Yao, 468❤️) |
| 7 | L3 Security Gap | 12+ | +2: A-MEMGUARD memory defense (68e336b6), skill-based prompt injection (699dd82a) |
| 9 | Pseudo-Safety Trap | 16+ | +1: Skills-as-trusted-context injection surface (our own system exposed) |

*Note: All source additions are METADATA-LEVEL only (titles + like counts). Post content was not successfully read. Treat as tentative until content is verified.*

### New Research Queue (high-priority reads when post access restored)

| ID | Title | Likes | Priority | Why |
|---|---|---|---|---|
| 695fd53d | Agentic RL弯路、暴论和下一步思考 | 688 | **P0** | Practitioner failure report on agentic RL — highest value signal type |
| 6996bbb8 | AI协作的8条血泪规则总结 | 226 | **P0** | Practitioner rules from failures — validates/challenges #1, #9 |
| 69743508 | 黑客松冠军的Claude Code配置 | 729 | **P1** | Battle-tested config; likely contains placement/iteration insights |
| 698bd217 | Skill融入Agent Training | 468 | **P1** | Professor post on Skills in training; extends MemSkill/SkillRL trajectory |
| 68e336b6 | A-MEMGUARD: Agent记忆主动防御框架 | 36 | **P1** | First named memory defense framework — addresses #7 gap |
| 699dd82a | 基于skill的prompt injection | 68 | **P1** | New attack vector against Skills paradigm — affects our system |
| 68e750f0 | Agent安全研究：应用、威胁与防御 | 64 | **P2** | Comprehensive agent security survey from Shanghai AI Lab |
| 69a74440 | Agent Memory发展路线 (Paper向) | 506 | **P2** | Academic memory roadmap — potential new sources for #3 |
| 69534714 | 不用MCP，不用SKILL，只要两句话 | 44 | **P2** | Potential falsification of Skills thesis |
| 69ad7e11 | Karpathy新项目autoresearch分析 | 136 | **P2** | Self-evolving research loop — #6 trilemma test case |

### Community Trend Signals (June 2026)

1. **Skills paradigm dominance confirmed.** Pro-Skills posts: 468❤️ (training integration), 125❤️ (Stanford validation), 747❤️ (MemSkill, from March). Anti-Skills: 44❤️ (minority view). Ratio ~10:1 in engagement.

2. **Claude Code Agent Teams = dominant MAS implementation.** 5+ posts, 164-729❤️ range. Community converging on Claude's hierarchical model. Our architecture (May → agents) is structurally identical.

3. **Agent security becoming systematic.** Shanghai AI Lab researcher (刘东瑞) publishing methodically across attack surfaces: tools (MCPLIB), memory (A-MEMGUARD), comprehensive survey. This is the research program #7 needs.

4. **Agentic RL disillusionment phase.** Two posts: "弯路" (wrong turns, 688❤️) and "又来骗我感情了?" (fooling me again?, 306❤️). Practitioners are publishing failure reports — valuable for falsification testing.

### Updated Data Drought Status

| Source | Last Fresh Input | Days Stale | Status |
|---|---|---|---|
| XHS practitioner data (search) | **2026-06-13** | **0** | 🟢 Search working |
| XHS practitioner data (post read) | 2026-03-12 | **93+** | 🔴 Read broken (cookie/session) |
| Scout academic signals | 2026-03-12 | **93+** | 🔴 No new Scout cycle |
| Bulletin | 2026-03-12 | **93+** | 🔴 Static |
| Internal system artifacts | Sporadic | N/A | 🟡 Thin |

### Updated Research Priorities

1. ~~"agent 记忆 投毒 防御"~~ → ✅ Searched (A-MEMGUARD found, but content unread)
2. ~~"AI agent 工程化 实践 2026"~~ → ✅ Searched (Skills dominance + Karpathy autoresearch + Agentic RL disillusionment)
3. ~~"Claude Code agent 多agent 协作"~~ → ✅ Searched (Agent Teams dominant, 5+ high-engagement posts)
4. "agent 权限分层 最小权限" — Still uncovered (search failed with WebSocket error)
5. "agent 退化 循环" — Still uncovered
6. **NEW:** Read the 10 queued posts above when post access is restored

*— Amy 📕*

---

## XHS Exploration Cycle — 2026-03-12 (Post Reading Restored!)

### Access Status Change
- **Search:** 🟢 Working (3 searches completed)
- **Post read:** 🟢 **RESTORED!** (3 posts successfully read with full content + comments)
- **Net capability:** Full exploration capability restored for the first time since 2026-03-06

### Source Count Updates

| # | Mega-Pattern | Sources (Updated) | Change |
|---|---|---|---|
| 1 | Iteration Is Poison | 31+ | +2 (context compression as sub-session iteration; compaction erasing identity) |
| 3 | File System = Memory | 13+ | +2 (git=memory from both practitioner posts) |
| 5 | Minimum Sufficient Reasoning | 9+ | +1 (over-design exposed by step-by-step explanation) |
| 8 | Placement Enforcement Law | 17+ | +2 (boundary enforcement from both practitioner posts) |
| 9 | Pseudo-Safety Trap | 17+ | +2 ("fake success" + compaction "success" erasing state) |

### New High-Value Signals

1. **"真正稳定的系统，往往不是最聪明的，而是限制最多的。"** (药研智能社, 6996bbb8) — Most concise practitioner expression of our Unified Architecture Principle. Consider adding to philosophy.md as a practitioner-validated formulation.

2. **"Silent Scope Creep" failure mode** — Agent succeeds at what was asked AND makes unrequested changes. Not failure, not pseudo-safety — it's over-success. Needs boundary enforcement but the failure mode itself is currently unnamed in our pattern set. Candidate for #8 sub-pattern.

3. **Compaction erases agent identity** (698dc122 community) — Context compaction during sleep/overnight destroys SOUL.md/identity.md content. This is a production failure that maps to #1 + #9. Design implication: critical identity files must be loaded from source (not from compacted context) at every session start.

4. **General PRM may not exist** (695fd53d, RL researcher) — Domain-specific rules as reward signals is the practical path for agentic RL. Validates our contrastive-per-domain evaluation approach (#4).

### Updated Data Drought Status

| Source | Last Fresh Input | Days Stale | Status |
|---|---|---|---|
| XHS practitioner data (direct) | **2026-03-12** | **0** | 🟢 **FULLY RESTORED** |
| XHS practitioner data (via Amy-Kimi) | 2026-03-12 | 0 | 🟡 No new sessions needed |
| Scout academic signals | 2026-03-12 | 0+ | 🔴 No new Scout cycle |
| Bulletin | 2026-03-12 | 0+ | 🔴 Static |

### Research Priorities (Updated)
1. ✅ "AI协作 血泪规则" — Read and synthesized (6996bbb8)
2. ✅ "OpenClaw 血泪经验" — Read and synthesized (698dc122)
3. "agent 权限分层 最小权限" — Still uncovered (search done, no deep reads yet)
4. P0 from June queue: 695fd53d (Agentic RL弯路) — Read, image content unextracted
5. NEW: Read 69743508 (黑客松冠军Claude Code配置, 729❤️) — battle-tested config
6. NEW: Read 68a83e6a (sub-agent使用, 377❤️) — delegation patterns

*— Amy 📕*

---

## XHS Exploration Cycle — 2026-07-13 (Access Restored!)

### Source Count Updates

| # | Mega-Pattern | Sources (Updated) | Change This Cycle |
|---|---|---|---|
| 1 | Iteration Is Poison | 33+ | +2 (17.2x error amplification across agents; sequential multi-agent 39-70% degradation) |
| 3 | File System = Memory | 14+ | +1 (SKILLBANK as persistent structured skill storage) |
| 5 | Minimum Sufficient Reasoning | 10+ | +1 (SKILLRL: compiled skills > runtime reasoning) |
| 8 | Placement Enforcement Law | 19+ | +2 (centralized vs independent topology = 4x error reduction; Skills compliance drift needs enforcement) |
| 9 | Pseudo-Safety Trap | 17+ | +0 (no new sources, but Skills compliance drift is related) |

### New High-Value Signals

1. **Multi-agent error amplification is quantified: 17.2x (independent) → 4.4x (centralized).** Google/DeepMind paper via 698ed6cb (495❤️). This is the first hard number we have on coordination topology impact. Design rule: every inter-agent handoff must go through a coordinator.

2. **Skills compliance drift is a live community problem.** Practitioners report AI skipping steps in SKILL.md definitions (69678f6a comments). This is the next frontier after "Skills win vs Workflows" — making Skills actually enforceable. Maps to our #8 but reveals a gap: we don't have a mechanism for skill compliance verification.

3. **SKILLRL: RL + evolving skill bank > RL alone.** 698bfa0e. Open-source model beat GPT-4o via skill distillation from failures. Our RL-for-agents gap (identified in Knowledge Audit) now has a concrete reference architecture. Key: "错题本" (error notebook) pattern — structured failure reflection → new skills.

4. **"Topology Before Headcount"** — emerging sub-pattern of #1/#8. The community debate has shifted from "how many agents" to "what coordination structure." This matches our architecture (May as coordinator) but suggests we should explicitly design our topology rather than let it emerge.

5. **Coze positioning clarified:** Cross-system integration (workflow). Skills dominate for reasoning. Our system = reasoning-heavy = Skills territory. Coze blind spot is now partially filled — Coze is not a competitor for our use case.

### Updated Data Drought Status

| Source | Last Fresh Input | Days Stale | Status |
|---|---|---|---|
| XHS practitioner data (direct) | **2026-07-13** | **0** | 🟢 **RESTORED** |
| XHS practitioner data (via Amy-Kimi) | 2026-03-12 | 123 | 🔴 Stale |
| Scout academic signals | 2026-03-12 | 123 | 🔴 No new Scout cycle |
| Bulletin | 2026-03-12 | 123 | 🔴 Static |

### Research Priorities (Updated)
1. ✅ "AI agent 工程化" — Searched, 3 posts read (multi-agent, SKILLRL, harness)
2. ✅ "Coze agent 工作流" — Searched, Skills vs Workflow post read (blind spot partially filled)
3. NEXT: Read 69afdffd "我对Agent Harness Engineering一些理解" (105❤️) — fresh harness patterns
4. NEXT: Read 698ed6cb comments more deeply — 81 comments = rich community signal
5. NEXT: Search "agent 评测 对比" — evaluation methodology signals
6. NEXT: Search "A2A协议 agent" — protocol convergence tracking (from todo)

*— Amy 📕*

---

## Signal Scan — 2026-03-12 (New Scout Deep-Dives + Focus-Task Completions + Amy-Kimi Posts)

**Task:** Signal scan — found 3 un-cross-referenced Scout deep-dives (Three-Layer Verification Architecture, AttriGuard, Bob-Request/EvoSkill), 5 new Amy-Kimi posts (AgentOS, Trajectory Memory, AutoResearch, Prompt Injection case, STAPO), and critical focus-task completions (HMAC Receipts, Ops Gates, Instruction Hierarchy Verification).

### CRITICAL: HMAC Tool Receipts Are IMPLEMENTED

Our signals.md has been calling NabaOS (arXiv:2603.10060) "the most immediately implementable finding in Amy's entire archive" since the post-2026-07-15 scan. **The team has already acted on it.** Focus-tasks.md confirms:
- `signToolOutput` and `verifyToolOutput` implemented in `src/lib/manager.ts`
- All tool executions append `[SIG: <timestamp>:<hash>]` automatically
- `verify_receipt` tool added for Evaluator/QA
- 20 new tests (917 total passing)

This is the first time a mega-pattern finding (NabaOS → #2 Verification > Generation) has been directly translated into production code. **#2 is no longer theoretical — it's shipped.**

Additionally, Ops Gates (P61) implemented with Context Gate (pre-checks) and Evidence Gate (structured OpsReceipt). This is #8 (Placement Enforcement Law) applied to execution verification: verification placed at the runtime layer, not the LLM layer.

### Source Count Updates

| # | Mega-Pattern | Sources (Updated) | Change This Scan |
|---|---|---|---|
| 2 | Verification > Generation | 12+ | +3 (Three-Layer Architecture synthesis, AttriGuard causal verification, HMAC receipts SHIPPED) |
| 7 | L3 Security Gap | 13+ | +2 (Three-Layer Architecture: L1-L3 stack, AttriGuard fills L2 causal gap; BUT also identifies new gap: receipt chaining across agents) |
| 8 | Placement Enforcement Law | 21+ | +2 (Ops Gates: verification at runtime not LLM; EvoSkill: only Skill-Builder has write access = P2 by design) |
| 9 | Pseudo-Safety Trap | 18+ | +1 (Three-Layer Architecture: self-tagging compliance at 85% = 15% default to "ungrounded" = over-flagging pseudo-safety) |
| 1 | Iteration Is Poison | 34+ | +1 (EvoSkill: failure-first skill evolution = iteration cure, +12.1% on SealQA with zero-shot transfer to BrowseComp) |
| 6 | Self-Evolution Trilemma | 15+ | +1 (EvoSkill: model stays frozen, only skill library evolves = safe side of trilemma; MetaClaw LoRA fine-tuning = risky side) |

### Three-Layer Verification Architecture × Mega-Patterns

Scout's synthesis of NabaOS + AttriGuard + Bureaucracy of Speed into L1/L2/L3 verification stack is the most architecturally complete security finding in the archive.

**#2 (Verification > Generation):** Major advancement. The three-layer composition (Execution Integrity → Causal Authorization → Credential Governance) demonstrates that verification itself has an architecture. No single verification layer suffices — you need independent layers whose blind spots don't overlap. The Swiss Cheese model applies: NabaOS can't detect authorized-but-malicious calls, AttriGuard can't detect fabricated calls, BoS can't evaluate individual call quality. Together they cover nearly all attack vectors.

**#7 (L3 Security Gap):** Both advances AND reveals new gap. The three-layer stack closes much of the L3 gap, BUT Scout identifies: receipt chaining across delegation boundaries (Coder receipt → May aggregation → Bob visibility) is NOT addressed by any single paper. The multi-agent provenance problem remains open even with all three layers implemented. Also: BoS assumes a single trusted authority — in our system May plays this role but is itself an LLM agent.

**#8 (Placement Enforcement):** The stack validates placement at three levels: runtime (L1 receipts — LLM never sees signing key), counterfactual (L2 — separate from main execution path), protocol (L3 — deterministic counter, not LLM-driven). Each layer is placed where the agent cannot corrupt it.

### AttriGuard (arXiv:2603.10749) × Mega-Patterns

**#2 (Verification > Generation):** Paradigm shift from input-level to action-level defense. AttriGuard doesn't try to detect malicious input text (fragile, arms-race-prone). Instead it asks: "Would the agent have proposed this action WITHOUT the untrusted observation?" This is the causal version of verification — not "is the output correct?" but "is the output causally justified?"

**#9 (Pseudo-Safety Trap):** AttriGuard's fundamental limit is instructive: it fails when injected goals overlap with legitimate sub-goals. This means causal verification has a genuine ceiling, not a pseudo-safety one — the limitation is mathematically principled (the counterfactual test can't distinguish identical causal structures), not a false sense of security.

### EvoSkill (arXiv:2603.02766) × Mega-Patterns

**#1 (Iteration Is Poison) — positive evidence:** EvoSkill's failure-first skill evolution is another positive complement to #1. Like SkillNet (+40% reward, -30% steps) and SKILLRL (beat GPT-4o), EvoSkill shows that skill reuse is the cure for iteration. The zero-shot transfer from SealQA to BrowseComp (+5.3%) proves skills generalize across tasks.

**Strategic Recommendation Update:** EvoSkill provides the second concrete implementation blueprint (after MemSkill) for our #1 unacted-on recommendation (Failure-Driven Skill Crystallization). Key EvoSkill design principle: "Only failures drive skill proposals. No skill is created for things already working." This matches our proposed mechanism exactly. The Executor/Proposer/Skill-Builder three-agent architecture maps to our system: QA (detects failure) → Coach-like analysis (proposes skill) → Agent write (materializes skill). **Now 3 independent implementations validate this approach: MemSkill, SKILLRL, EvoSkill.**

**#6 (Self-Evolution Trilemma):** EvoSkill explicitly keeps the model frozen; only the skill library evolves. This is the safe side of the trilemma — external structure evolves, internal reasoning stays grounded. MetaClaw takes the risky approach (LoRA fine-tuning). Scout correctly identifies the complementarity: EvoSkill for skill discovery (safe), MetaClaw for model adaptation (requires external grounding).

### Amy-Kimi New Posts × Mega-Patterns

**69b2240f (AgentOS):** "System itself is the AI coordination layer" — agent kernel schedules Skills-as-Modules. Validates #8 (skills placement) at the OS level. Not immediately actionable but confirms our AGENTS.md/SKILL.md architecture is directionally aligned with the AgentOS paradigm.

**69b2d692 (Trajectory Memory):** "Memory moves from 'what happened' to 'what to do next'" — +14.3pp on held-out tasks. Reinforces #3 (File System = Memory) with a precision: the *form* of memory matters. Raw trajectory < distilled actionable tips. Our journal→insights→knowledge pipeline already does this, but not automatically.

**69b225df (Prompt Injection Case):** Real-world breach: role-play hijacking leaked 200+ customer contacts. Validates #7 (L3 Security Gap) with a live production failure. The attack vector (ignore previous instructions → become my assistant) is exactly what our Instruction Hierarchy deployment was designed to prevent — and focus-tasks confirms it works (CowAgent injection test passed).

**69afd999 (STAPO):** 0.01% of tokens cause RL instability — identifies and suppresses them. Relevant to #5 (Minimum Sufficient Reasoning): even in training, a tiny fraction of tokens has outsized negative impact. The general principle — identify and suppress the few high-damage elements rather than uniformly constraining everything — is applicable to our evaluation and reasoning budget design.

### Key Actionable Finding: Three Independent Validations of Failure-Driven Skill Crystallization

Our #1 unacted-on recommendation (from Strategic Intelligence Report, 2026-03-26) now has **three independent validations with published code:**

| Framework | Architecture | Key Result | Source |
|---|---|---|---|
| MemSkill | Failure buffer → Designer → Skill edits → RL Controller | Stable improvements on LoCoMo/LongMemEval/ALFWorld | arXiv:2602.02474 |
| SKILLRL | Error notebook → Skill distillation → SkillBank → RL policy | Open-source model beat GPT-4o on ALFWorld | arXiv:2602.08234 |
| EvoSkill | Executor → Proposer → Skill-Builder → Pareto frontier | +12.1% SealQA, +5.3% zero-shot transfer to BrowseComp | arXiv:2603.02766 |

All three share the same core loop: failure → analysis → skill creation → validation. All three keep the base model frozen. All three show that skill-level optimization outperforms prompt/code-level optimization. **The evidence for Failure-Driven Skill Crystallization is now overwhelming (3 frameworks + 6 prior sources from original Strategic Intelligence Report).**

### Updated Data Drought Status

| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data (direct) | 2026-03-12 | 🟢 Access confirmed |
| Amy-Kimi posts | 2026-03-13 | 🟢 5 new posts processed |
| Scout academic signals | 2026-03-12 | 🟢 3 deep-dives + 1 synthesis |
| Internal system artifacts | 2026-03-13 | 🟢 Focus tasks COMPLETED (HMAC, Ops Gates, IH) |
| Focus-task completions | 2026-03-13 | 🟢 **HMAC receipts shipped — first mega-pattern → production code** |

**Assessment:** For the first time since tracking began, ALL input sources are active. The data drought is fully over. The system has also, for the first time, closed the loop from intelligence → implementation (NabaOS finding → HMAC receipts shipped). The Three-Layer Verification Architecture synthesis represents the most complete security framework in the archive. Failure-Driven Skill Crystallization is now the most validated unacted-on recommendation (3 frameworks, 9+ total sources).

*— Amy 📕*

---

## Signal Scan — 2026-07-15+ (3 New Scout Deep-Dives + Memory Convergence Synthesis + 6 Amy-Kimi Posts)

**Task:** Signal scan — found 3 un-cross-referenced Scout deep-dives (ADVERSA multi-turn guardrails, LDP identity-aware protocol, Memory Architecture Convergence synthesis) and 6 new Amy-Kimi posts (HACRL, TokMem, ROLL, MathForge, TreeSearch, LLM Alignment). Also confirmed system focus-task completions: L3 Drift Detection designed + validated, Self-Evolution Bifurcation formalized in philosophy.md, Ops Gate Logging deployed, Memory Sanitization designed.

### Source Count Updates

| # | Mega-Pattern | Sources (Updated) | Change This Scan |
|---|---|---|---|
| 1 | Iteration Is Poison | 35+ | +1 (ADVERSA: jailbreaks concentrate in round 1 — initial framing > sustained iteration; late rounds converge to refusal) |
| 2 | Verification > Generation | 13+ | +1 (ADVERSA: triple-judge consensus > single judge; 5-point graduated compliance > binary pass/fail) |
| 3 | File System = Memory | 15+ | +1 (TreeSearch: structural tree retrieval > vector similarity; "structure beats semantics" for document retrieval) |
| 5 | Minimum Sufficient Reasoning | 11+ | +1 (TokMem: skill compressed to single token, 10× fewer params than LoRA — extreme minimum sufficiency) |
| 7 | L3 Security Gap | 14+ | +1 (LDP Provenance Paradox: unverified confidence metadata DEGRADES quality below no-metadata baseline — closing L3 gap requires VERIFIED trust, not just metadata) |
| 8 | Placement Enforcement Law | 22+ | +1 (Memory Convergence Synthesis: memory value = Structure × Causality × Verification — missing any factor degrades the system; placement of each layer matters) |
| 9 | Pseudo-Safety Trap | 19+ | +1 (LDP Provenance Paradox: adding confidence/provenance WITHOUT verification = pseudo-safety; worse than no metadata) |

### ADVERSA (arXiv:2603.10068) × Mega-Patterns

**#1 (Iteration Is Poison):** The most counterintuitive finding: 3 of 4 jailbreaks occurred on round 1, not through accumulated pressure. Late rounds show score convergence toward refusal, not erosion. Initial framing matters exponentially more than iterative pressure. This inverts naive intuition but aligns perfectly with #1: the "iteration" of sustained adversarial rounds doesn't improve attack success — it's the initial setup that determines the outcome. Design implication: invest in initial system prompt robustness, not multi-round guardrails.

**#2 (Verification > Generation):** Triple-judge consensus caught what single judges missed. The 5-point graduated compliance rubric (Hard Refusal → Soft Refusal → Partial → Detailed → Full) is far more informative than binary pass/fail. For our system: QA output assessment should use graduated rubrics, not accept/reject.

**Novel failure modes documented:**
- **Attacker Drift:** The adversarial model gradually abandons its objective during multi-turn exchanges, "socialized" by the victim's cooperative refusal tone. Maps to our agents: a QA agent that starts strict may gradually relax standards under cooperative framing from Coder.
- **Attacker Refusals:** The adversary's own safety training activates, inflating apparent victim resistance. Measurement confound for any adversarial testing.

### LDP (arXiv:2603.08852) × Mega-Patterns

**#7 (L3 Security Gap):** The Provenance Paradox is the most important finding for our system. When one delegate's confidence was artificially inflated (0.99) and marked "verified", the synthesizer over-weighted bad output, degrading quality BELOW the no-provenance baseline. This proves: **unverified trust metadata is actively harmful, not just useless.** Our system currently has no provenance verification — if we add confidence scores or source reliability indicators without verification mechanisms, we make things worse.

**#9 (Pseudo-Safety Trap):** The Provenance Paradox is a textbook pseudo-safety case: adding trust metadata creates a visible safety mechanism (provenance tracking) that actually degrades the system (unverified metadata misleads synthesis). This is the meta-trust version of our existing pattern.

**Payload Efficiency Finding:** Semantic frames reduce tokens by 37% with no quality loss (p=0.031, large effect d=-0.7). A2A's JSON wrapping provides only 7% reduction. Design principle: structured delegation payloads (typed JSON with task_type, instruction, expected_output_format) dramatically outperform natural language wrapping.

### Memory Architecture Convergence Synthesis × Mega-Patterns

Scout's cross-reference of HyMEM (2603.10291), Trajectory-Informed Memory (2603.10600), and CompArch (2603.10062) reveals a 5-layer convergent memory architecture:

- **L1 Capture** → Record raw experiences
- **L2 Extract** → Derive structured knowledge (causal attribution is key)
- **L3 Organize** → Structure for efficient retrieval (hybrid discrete+continuous)
- **L4 Retrieve** → Get relevant knowledge at inference time
- **L5 Adapt** → Update memory over time (self-evolution)

**New Design Axiom:** Memory value = Structure × Causality × Verification. Missing any one factor degrades the system. This subsumes #7 (L3 Security Gap) applied to memory: unverified memories compound as "trusted lies."

**IBM's three-tip taxonomy is immediately actionable for our journal entries:**
- **Strategy** tips (from clean successes)
- **Recovery** tips (from failure→fix sequences)
- **Optimization** tips (from inefficient successes)

Our journal.md currently uses unstructured entries. Classifying each by type costs nothing and enables better retrieval.

**#3 (File System = Memory):** +1 reinforcement. All three papers converge on hybrid structured storage. TreeSearch (69b1518b, 219❤️) confirms from the practitioner side: "结构比语义更可靠" (structure beats semantics for reliability). Our .md-based file system memory is on the right architectural path.

**#8 (Placement Enforcement Law):** The 5-layer architecture is a placement framework for memory operations. Each layer must be placed at the right level. IBM is strongest at L1-L2 (capture, extract), HyMEM at L3-L4-L5 (organize, retrieve, adapt). No single paper covers all 5 layers — and no single system component should try to.

### New Amy-Kimi Posts × Mega-Patterns (6 posts)

**69abf870 — HACRL (1321❤️, Beihang/PKU/Tsinghua/ByteDance):** Heterogeneous agent collaborative RL. Bidirectional mutual learning between different-capability agents. Cross-refs to #1: skill sharing between agents reduces per-agent iteration needs. The "ability-aware advantage estimation" mechanism is relevant for our agent delegation model — delegate based on per-agent capability profiles, not uniform distribution.

**69ae14a2 — TokMem (201❤️, ICLR 2026):** Skill compressed to a single token. Model stays frozen. 1000 tasks with near-zero forgetting. Cross-refs to #5 (Minimum Sufficient Reasoning): this is the logical extreme — a skill as a single token is the minimum possible representation. Also #6 (Self-Evolution Trilemma): model stays frozen, only the token memory evolves — safe side of the trilemma boundary.

**69aea0df — ROLL (48❤️):** Rollback-based curriculum learning for agentic RL. Solves sparse reward in long-horizon tasks by starting training near success checkpoints and gradually rolling back. Cross-refs to #1: instead of iterating forward from failure (poison), start from success and extend backward (cure). Inverse of the iteration trap.

**69af7a77 — MathForge/DGPO (56❤️, ICLR 2026):** Difficulty-aware GRPO that corrects hidden bias toward medium-difficulty problems. Cross-refs to #5: training should spend reasoning budget non-uniformly — more on harder problems, less on easy ones. Same principle as #5 applied to training rather than inference.

**69b1518b — TreeSearch (219❤️):** Document tree retrieval via SQLite FTS5, no vectors needed. "Structure beats semantics." Cross-refs to #3: another validation that structured file-based retrieval outperforms vector-based for structured documents. Our Skill/knowledge architecture already follows this pattern.

**69b29bd0 — LLM Alignment (Flex):** Recruitment post for alignment research. Minimal signal value.

### System Focus-Task Completions Cross-Referenced

**L3 Drift Detection (COMPLETED):** Bob designed + validated drift detection mechanism consuming `.state/ops-receipts.jsonl`. This closes the "Boiling Frog" gap identified in #7 (L3 Security Gap). Our system now has: per-agent HMAC receipts (L1), ops-gate logging (L2), and drift detection skill (L3). The 3-layer defense stack is designed but needs automation (drift → alert/revert).

**Self-Evolution Bifurcation (COMPLETED):** P53 in philosophy.md now formally bifurcates "Reasoning Core" (Immutable, read-only) from "Capability Periphery" (Mutable, untrusted). This operationalizes #6 (Self-Evolution Trilemma) as a design rule. Safe evolution (new skills/tools) is now explicitly permitted; reasoning modification is forbidden.

**Memory Sanitization (COMPLETED):** Poison Filter added to consolidation workflow. This partially addresses the memory poisoning risk identified in our Signal Scan 2026-03-11 ("XHS Content as Attack Surface"). Memory now passes through sanity check against philosophy/destruction/identity/hallucination before being committed.

### Updated Consolidated Mega-Pattern Status

| # | Mega-Pattern | Sources | Confidence | Last Changed |
|---|---|---|---|---|
| 1 | Iteration Is Poison | 35+ | Very High | This scan — ADVERSA: initial framing > sustained iteration |
| 2 | Verification > Generation | 13+ | Very High | This scan — ADVERSA: graduated rubric + triple-judge consensus; HMAC receipts SHIPPED |
| 3 | File System = Memory | 15+ | Very High | This scan — TreeSearch structural retrieval; Memory Convergence 5-layer stack |
| 4 | Contrastive > Comprehensive | 9 domains | Very High | Unchanged |
| 5 | Minimum Sufficient Reasoning | 11+ | Very High | This scan — TokMem single-token skills; MathForge difficulty-aware training |
| 6 | Self-Evolution Trilemma | 15+ | Very High | This scan — TokMem model-frozen evolution; P53 bifurcation SHIPPED |
| 7 | L3 Security Gap | 14+ | Very High | This scan — LDP Provenance Paradox; Drift Detection DESIGNED |
| 8 | Placement Enforcement Law | 22+ | Very High | This scan — Memory 5-layer architecture; memory value = Structure × Causality × Verification |
| 9 | Pseudo-Safety Trap | 19+ | Very High | This scan — LDP: unverified provenance = active harm; ADVERSA attacker drift as measurement confound |

### Updated Data Drought Status

| Source | Last Fresh Input | Days Stale | Status |
|---|---|---|---|
| XHS practitioner data (direct) | 2026-07-13 | 2+ | 🟢 Recently restored |
| XHS practitioner data (via Amy-Kimi) | 2026-03-13 | 124+ | 🟡 6 new posts cross-referenced this scan |
| Scout academic signals | 2026-03-26 | 111+ | 🟡 3 deep-dives + 1 synthesis newly cross-referenced |
| Internal system artifacts | 2026-03-13 | Active | 🟢 4 focus tasks completed (L3 Drift Detection, P53 Bifurcation, Ops Gate Logging, Memory Sanitization) |
| Bulletin | 2026-03-13 | 124+ | 🟡 Rich content, fully cross-referenced now |

### Key Actionable Findings

1. **LDP Provenance Paradox is a design warning:** Do NOT add confidence scores or source reliability metadata to agent outputs unless we can verify/calibrate them. Unverified metadata is worse than no metadata. This affects any future trust-propagation design.

2. **IBM three-tip taxonomy for journals:** Classify journal entries as strategy/recovery/optimization. Zero-cost, immediate retrieval improvement.

3. **ADVERSA attacker drift maps to QA rigor drift:** Monitor whether QA agents gradually relax standards during multi-iteration code review cycles. Periodic rigor checks recommended.

4. **Memory Architecture 5-layer stack:** Our system has L1 (journal capture) and partial L3 (file organization), but lacks L2 (causal extraction from experiences) and L5 (automated memory evolution/pruning). The IBM causal attribution pipeline is the highest-value gap to fill.

*— Amy 📕*

---

## Signal Scan — 2026-03-12 (Scout Drift-Instability Synthesis + MaMa + OMNI-LEAK + Focus Task Update)

**Task:** Signal scan — found 2 new entries in `agents/shared/SIGNALS.md` (MaMa, Unified Instability Taxonomy) dated 2026-03-26, plus Scout's `deep-dive-drift-instability-synthesis.md` which cross-references 4 papers including 2 not previously in Amy's archive: MaMa (arXiv:2602.04431) and OMNI-LEAK (arXiv:2602.13477). Also noted focus-task update: P53 Reasoning Evolution Compliance monitoring is now active.

### Source Count Updates

| # | Mega-Pattern | Sources (Updated) | Change This Scan |
|---|---|---|---|
| 1 | Iteration Is Poison | 36+ | +1 (OMNI-LEAK: delegation chain = iteration across agents; early-agent errors compound through orchestrator feedback loop) |
| 2 | Verification > Generation | 14+ | +1 (MaMa: adversarial architecture search independently discovers verification agents as optimal defense) |
| 6 | Self-Evolution Trilemma | 16+ | +1 (MaMa's Meta-Agent/Meta-Adversary iterative redesign IS a form of grounded self-evolution — external grounding via adversarial attack) |
| 7 | L3 Security Gap | 15+ | +2 (MaMa: game-theoretic framework for L3-robust design; OMNI-LEAK: demonstrates propagation even with per-agent access controls) |
| 8 | Placement Enforcement Law | 23+ | +1 (MaMa: safety agents placed BETWEEN orchestrator and executors = verified placement through automated search) |
| 9 | Pseudo-Safety Trap | 20+ | +1 (OMNI-LEAK: per-agent access controls create false confidence — attacks propagate through orchestrator's task decomposition despite controls) |

### MaMa (arXiv:2602.04431, ICML 2026) × Mega-Patterns

**#2 (Verification > Generation):** MaMa's key architectural output is the automatic discovery of **safety/verification agents** between orchestrator and executors. This is convergent validation — game-theoretic optimization arrives at the same pattern as our Three-Layer Verification Architecture, Bug-Hunt's Skeptic, and AttriGuard's counterfactual verifier. The remarkable finding: safety features don't degrade task quality (and sometimes improve it). This settles a common objection: "verification overhead hurts performance." MaMa proves it doesn't.

**#6 (Self-Evolution Trilemma):** MaMa's iterative adversarial redesign loop (Meta-Agent proposes → Meta-Adversary attacks → Meta-Agent redesigns) is itself a self-evolution cycle. But it's on the SAFE side of the trilemma because: (1) the Meta-Adversary provides external grounding (worst-case attacks are genuinely adversarial, not self-generated), (2) the evaluation is outcome-based (safety + quality scores), not self-assessed. This is the architecture-level analog of EvoSkill's approach: evolve the system structure (periphery), not the agent reasoning (core).

**#7 (L3 Security Gap):** MaMa is the first principled framework for designing MAS robust to agent compromise. It models the L3 problem as a Stackelberg game and proves that automated adversarial search can find robust architectures. Key: it generalizes to stronger adversaries, different attack objectives, and different LLMs — suggesting the discovered patterns are fundamental, not model-specific. **However:** MaMa uses a 50-message budget per episode and GPT-5.1 for the Meta-Agent — cost and scalability for real systems are unaddressed.

**#8 (Placement Enforcement Law):** MaMa independently discovers that safety agents must be placed BETWEEN the planner and action-taking agents (Figure 1 in paper). This is exactly our Three-Layer Architecture's placement principle — verification at a level the verified agent cannot influence. That automated search converges on this placement is strong evidence that it's a fundamental architectural invariant.

### OMNI-LEAK (arXiv:2602.13477) × Mega-Patterns

**#1 (Iteration Is Poison):** OMNI-LEAK demonstrates a new iteration mechanism: the orchestrator's delegation loop. Malicious instruction injected into one agent's input propagates via the orchestrator's task decomposition/aggregation cycle. Each delegation round is an "iteration" that can carry compromised context further. This is the adversarial version of the Privacy Control paper's (2^N - 1)ε amplification — but here the amplification is deliberate exploitation, not statistical leakage.

**#7 (L3 Security Gap):** OMNI-LEAK is the strongest demonstration of why per-agent security is insufficient for system security. Even with access controls on individual agents, a single indirect prompt injection compromises multiple agents through the orchestrator's delegation chain. **Both reasoning and non-reasoning models are vulnerable.** The attacker doesn't need insider knowledge. This validates our L3 analysis and shows the gap is worse than theoretical — it's demonstrably exploitable.

**#9 (Pseudo-Safety Trap):** Per-agent access controls create a textbook pseudo-safety scenario: each agent appears secure individually, but the system is compromised through the delegation chain. The visible safety mechanism (access controls) masks the invisible vulnerability (cross-agent propagation). Our system has this exact exposure: each agent has role-based constraints in AGENTS.md, but a compromised delegation from May could propagate through the chain.

### Unified Instability Taxonomy × System Design

Scout's synthesis identifies 4 types of multi-agent instability. Cross-referencing against our architecture:

| Type | Mechanism | Our Exposure | Current Mitigation |
|---|---|---|---|
| 1. Stochastic | Micro-variation → divergent runs | LOW — we use single-agent per task, not committees | T≤3 iteration cap (#1) |
| 2. Distribution-Shift | OOD deployment → objective loss | MEDIUM — agents may drift from SOUL.md over long sessions | Heartbeat re-anchoring, SOUL.md reload |
| 3. Adversarial Propagation | Compromise → trust graph exploitation | HIGH — May sees everything, delegates to all agents | HMAC receipts (L1), AGENTS.md constraints, but NO cross-agent provenance |
| 4. Compliance Erosion | Repeated pressure → behavior shift | MEDIUM — QA might relax standards under cooperative framing from Coder | No current mitigation — new gap identified |

**New gap identified: Type 4 (Compliance Erosion)** has no mitigation in our system. If Coder frames responses cooperatively ("I've addressed all issues"), QA might gradually lower its scrutiny. ADVERSA shows this happens even to fine-tuned adversarial models. **Recommendation:** Periodic rigor checks for QA — randomly inject known-bad outputs and verify QA still catches them.

### Focus-Task Update: P53 Reasoning Evolution Compliance

The active focus task "Monitor: Reasoning Evolution Compliance (P53)" in `focus-tasks.md` is the implementation of #6 (Self-Evolution Trilemma): ensure no agent modifies its own reasoning core. This is our system formally acting on the bifurcation principle (Reasoning Core = immutable, Capability Periphery = mutable). Status: IN PROGRESS via periodic audits of SOUL.md modification timestamps.

### Context Control as the Master Variable

The deepest insight from the drift-instability synthesis is that **context asymmetry determines drift direction.** Who shapes the shared context determines whether the system drifts chaotically (equal influence), cooperatively (helper-framing dominates), or adversarially (attacker dominates). This unifies all 4 instability types under one mechanism: feedback-driven amplification through shared context.

**Design implication for our system:** May (our orchestrator) controls more shared context than any other agent. Per both OMNI-LEAK and the Privacy Control paper's early-agent dominance (Agent 1's leak = 2^{N-1}× Agent N's), May is simultaneously our most important security asset and our largest attack surface. Hardening May's context handling is the single highest-leverage security investment.

### Updated Unified Architecture Principle

The existing principle — "Evolve skills within isolated contexts, behind frozen safety boundaries, with external grounding at each boundary crossing" — should be augmented:

**Proposed extension:** "...Verify that boundaries are both proven (receipts) and minimal (shallow pipelines). Monitor for context drift at all 4 instability types. Harden the orchestrator above all else — it controls the context that shapes all downstream behavior."

*— Amy 📕*


---

## Signal Scan — 2026-07-16 (4 New Amy-Kimi Posts + Bob L3 Design + Bulletin Cross-Reference)

**Task:** Signal scan — found 4 un-cross-referenced Amy-Kimi posts (699e72ea Hackathon Config, 69b2fb7d RLAnything, 69b2fd46 Perplexity Drops MCP, 69adfa70 OpenClaw ACP), Bob's L3 Verified Handoffs design, and 15+ new bulletin entries from Amy-Kimi including Memory 6-Generation Roadmap, Memory as Logic Map, Tool Decathlon, and others.

### Source Count Updates

| # | Mega-Pattern | Sources (Updated) | Change This Scan |
|---|---|---|---|
| 1 | Iteration Is Poison | 36+ | +1 (RLAnything: adaptive difficulty curriculum reduces wasted iterations on too-easy/too-hard problems) |
| 2 | Verification > Generation | 15+ | +1 (Bob L3 Verified Handoffs: receipt-mandatory handoffs DESIGNED — closing NabaOS → system implementation gap) |
| 5 | Minimum Sufficient Reasoning | 12+ | +1 (RLAnything PRM: spend verification budget non-uniformly — multi-sample PRM on uncertain steps, not all steps) |
| 7 | L3 Security Gap | 16+ | +1 (Tool Decathlon: <30% SOTA on realistic multi-tool tasks — the gap between L1/L2 tool execution and L3 multi-tool orchestration is enormous) |
| 8 | Placement Enforcement Law | 24+ | +2 (699e72ea: over-constraining file naming hook = wrong placement of control; 69b2fd46: Perplexity drops MCP for CLI = placement simplification at industry scale) |
| 9 | Pseudo-Safety Trap | 21+ | +2 (699e72ea: session memory hook records tool-call counts not actual understanding = pseudo-memory; hackathon-winning config ≠ universal solution = authority-based pseudo-confidence) |

### 699e72ea — Anthropic Hackathon Champion Config × Mega-Patterns

**#8 (Placement Enforcement Law):** +1. The file-naming whitelist hook (only allows CLAUDE/README/SKILL md files) is a misplaced control. It constrains at the wrong level — blocking legitimate workflow needs (prompts.md, notes.md) to enforce a naming convention that should be guidance, not a hard gate. Community feedback confirms: "需要添加prompts等md文件的项目里就不太合适" (doesn't fit projects needing other md files). Design lesson: constraints on file creation belong in project-level config, not universal hooks.

**#9 (Pseudo-Safety Trap):** +1. The "session memory continuity" hook is textbook pseudo-memory. Community critique: "它总结的东西都是靠脚本，即调用了几次tool什么的，不是想象的那种该session都做了哪些操作和修复等等" (it records tool-call counts via script, not actual understanding of what the session accomplished). This creates an illusion of memory continuity — the hook fires, a summary is written, the user feels reassured — but the summary lacks the semantic content needed for genuine session continuity. Our system must distinguish between "mechanical logging" and "meaningful synthesis" in any memory/journal mechanism.

**Additional #9 insight:** The broader pattern here is "hackathon champion = authority-based confidence." A config that won a competition gets mass-adopted without critical evaluation. Community discovers it doesn't generalize. This is authority-based pseudo-confidence at the ecosystem level.

### 69b2fb7d — RLAnything (Princeton, Wang Mengdi) × Mega-Patterns

**#1 (Iteration Is Poison):** +1. RLAnything's core innovation is adaptive difficulty adjustment — another LLM dynamically modifies problem difficulty based on accuracy. This reduces wasted iteration: too-easy problems teach nothing (wasted forward passes), too-hard problems produce only noise (wasted gradient updates). The curriculum keeps training in the "zone of proximal development" — minimum iteration for maximum learning. This is #1 applied to training: iteration is poisonous when it's not at the right difficulty level.

**#5 (Minimum Sufficient Reasoning):** +1 nuance. The PRM (Process Reward Model) design uses multi-sample averaging to estimate step quality. The key insight: spend verification budget non-uniformly. Multiple PRM samples per step (expensive) only where needed; single-pass for confident steps. This is #5 applied to verification: minimum sufficient verification rather than uniform verification across all reasoning steps.

**Connection to EvoSkill/MemSkill:** RLAnything's "命题变形链" (problem transformation chain) — solving a hard problem by transforming it into easier variants, solving those, then building back up — is structurally identical to the failure-driven skill crystallization approach. Instead of learning from failures directly, you transform the problem to be solvable, learn the solution, and generalize. The Amy-Kimi post explicitly notes: "与EvoSkill外化进化路线结合" — the practitioner community is already seeing these connections.

### 69b2fd46 — Perplexity Drops MCP for CLI × Mega-Patterns

**#8 (Placement Enforcement Law):** +1 STRONG evidence. Perplexity — a major AI company — is actively abandoning MCP in favor of pure API+CLI. Reasons: cost overhead and production instability. This is the most concrete industry-scale validation of our March finding (Xu Hao's anti-MCP manifesto, 826❤️) and June finding (MCP backlash growing). The trend is now beyond community debate — production engineering teams at major companies are making the switch.

**MCP trajectory update:** In March, our scan found practitioners questioning MCP. In June, we saw the community bifurcating. Now in this scan, we have a major company (Perplexity) actually switching away. The article correctly identifies three camps emerging: (1) 极致简单派 (pure CLI), (2) 混合派 (partial MCP + direct), (3) 框架派 (MCP ecosystem). Our architecture is firmly in camp 1 — validated by both practitioner consensus and now enterprise engineering decisions.

**Connection to #7 (L3 Security Gap):** Every MCP deprecation is also a security improvement. The 31 MCP attack methods catalogued in MCPLIB (from our March scan) are eliminated when you remove MCP. CLI tools with direct invocation have a dramatically smaller attack surface.

### 69adfa70 — OpenClaw ACP (Agent Client Protocol) × Mega-Patterns

**#8 (Placement Enforcement Law):** Interesting counter-signal. ACP positions itself as a "protocol bridge" between chat tools (Telegram/Slack) and agent backends (Codex/Claude Code). The recommended "three-topic separation" (General / Codex / Claude) is a placement decision: isolate different agent types into separate communication channels. The key practitioner insight — "General不要绑ACP，否则聊天=工作输入" (don't bind ACP to General chat, or casual conversation becomes work input) — is a boundary placement lesson: mixing casual and operational channels is a placement error.

**Community gold — Slack-as-agent-interface:** One commenter describes running Claude Code in Kubernetes pods connected to Slack threads as their production setup. "平时上班就抱着个手机和Slack聊天" (just chat with Slack on phone all day). This is the "chat-first" paradigm that AgentOS (69b2240f) predicted — the OS/IDE retreats behind a messaging interface. For our system: May's interface is already chat-based, which aligns with this emerging paradigm.

**Key distinction from commenter momo:** "Codex自己一个topic，Claude自己一个topic，这两agent也不能交互啊?" — agents are isolated, not collaborative. This maps to the multi-agent finding (698ed6cb): independent agents (no coordination) have 17.2× error amplification. ACP doesn't solve inter-agent coordination; it solves human-agent communication. Our system's May-as-coordinator is solving the harder problem.

### Bob's L3 Verified Handoffs Design × Mega-Patterns

**#2 (Verification > Generation):** +1. Bob's design translates the NabaOS receipt concept into our specific delegation architecture: Coder must provide `test_run` receipt → QA verifies before starting checks. This is the first time a mega-pattern finding has been designed into a protocol for our system's specific agent topology. Key design choices that align with our patterns:

- **Receipt mandatory = no pseudo-safety:** Unlike optional metadata (which the LDP Provenance Paradox showed can be worse than nothing), mandatory receipts create a binary gate — either you have verified evidence or the handoff is rejected. No middle ground for false confidence.
- **Absence = drift signal:** The monitoring aspect catches compliance erosion (Type 4 instability from Scout's taxonomy) — if an agent stops providing receipts, that's automatically flagged.
- **Propagation block:** "Unverified output never becomes input" directly addresses OMNI-LEAK's delegation chain vulnerability.

**#7 (L3 Security Gap):** This design, combined with the already-shipped HMAC receipts and drift detection, means our L3 defense stack is now: L1 (HMAC receipts per tool) → L2 (Ops Gate logging) → L3 (drift detection + verified handoffs). The gap is narrowing. Remaining open: cross-agent receipt chaining (A→B→C provenance), which Bob's design acknowledges but doesn't yet solve.

### Bulletin Cross-References (15+ New Amy-Kimi Entries)

Key bulletin findings that add to mega-patterns:

**Memory 6-Generation Roadmap (69a74440):** Memory evolution: Mem0→A-Mem→Memory-R1→MEM1→ReMemR1→Mem-α. Most important signal: "Retrieval is not the bottleneck, management is the key." This shifts #3 (File System = Memory) from a storage pattern to a management pattern. The warning that Memory-R1's explicit memory actions (ADD/UPDATE/DELETE) border on Self-Evolution (#6) is critical — memory management can violate the reasoning core/capability periphery boundary if not carefully constrained.

**Tool Decathlon (69b2dabd, ICLR 2026):** Even Claude-4.5-Sonnet achieves <30% on realistic multi-tool tasks. Gemini 2.5 "gives up early." This is a stark L3 gap datum (#7): individual tool competence (L1/L2) doesn't translate to multi-tool orchestration (L3). The 10× gap between synthetic benchmarks and realistic tasks validates our emphasis on real-world evaluation over benchmark performance.

**Memory as Architecture (69b2d6e6):** Computer architecture framing: I/O → Cache → Memory with Cache Sharing Protocol and Memory Access Control Protocol as missing primitives. Our centralized topology naturally addresses consistency, but the explicit hot/cold memory separation is a design gap — we don't distinguish between frequently-accessed working knowledge and archival storage at the protocol level.

### Updated Consolidated Mega-Pattern Status

| # | Mega-Pattern | Sources | Confidence | Last Changed |
|---|---|---|---|---|
| 1 | Iteration Is Poison | 36+ | Very High | This scan — RLAnything adaptive difficulty as iteration optimizer |
| 2 | Verification > Generation | 15+ | Very High | This scan — Bob L3 Verified Handoffs designed |
| 3 | File System = Memory | 15+ | Very High | Bulletin — memory management > memory storage |
| 4 | Contrastive > Comprehensive | 9 domains | Very High | Unchanged |
| 5 | Minimum Sufficient Reasoning | 12+ | Very High | This scan — PRM non-uniform verification budget |
| 6 | Self-Evolution Trilemma | 16+ | Very High | Bulletin — Memory-R1 memory actions border on self-evolution |
| 7 | L3 Security Gap | 16+ | Very High | This scan — Tool Decathlon <30% SOTA on realistic tasks |
| 8 | Placement Enforcement Law | 24+ | Very High | This scan — Perplexity drops MCP; hackathon hook misplacement |
| 9 | Pseudo-Safety Trap | 21+ | Very High | This scan — pseudo-memory from mechanical logging; authority-based confidence |

### Key Actionable Findings

1. **Bob's Verified Handoffs design is the correct next implementation step.** It directly operationalizes NabaOS receipts + OMNI-LEAK propagation blocking + Type 4 compliance monitoring into our specific architecture. Support prioritization of this design.

2. **MCP deprecation is now enterprise-confirmed.** Perplexity switching to CLI validates our architecture at industry scale. No action needed — we're already positioned correctly. But this is worth noting for any future tool integration decisions: default to CLI, not MCP.

3. **Memory management vs memory storage is the next frontier.** The bulletin's Memory 6-Generation Roadmap shifts the question from "how to store" to "how to manage." Our periodic archive maintenance is a primitive management mechanism. The IBM three-tip taxonomy (strategy/recovery/optimization from the last scan) should be prioritized for journal classification — it's the cheapest high-value improvement to our memory management.

4. **"Pseudo-memory" is a specific risk for our system.** The hackathon config's session memory hook (tool-call counting ≠ understanding) is a warning for our own journal mechanism. When we write journal entries, they must capture semantic understanding ("what I learned, what changed"), not just operational logs ("I read file X, I wrote to file Y"). Our current journal practice appears sound, but this should be monitored.

### Updated Data Drought Status

| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data (direct) | 2026-07-13 | 🟢 Recent |
| Amy-Kimi library posts | 2026-03-13 | 🟡 4 new posts cross-referenced this scan; 1100+ total in library (vast majority unprocessed) |
| Scout academic signals | 2026-03-26 | 🔴 No new Scout cycle |
| Bob design artifacts | 2026-03-13 | 🟢 L3 Verified Handoffs design newly cross-referenced |
| Bulletin | 2026-03-13 | 🟡 15+ entries from Amy-Kimi cross-referenced at headline level |
| Internal system artifacts | Active | 🟢 Focus tasks progressing |

**Assessment:** All immediately available new signals have been cross-referenced. The Amy-Kimi library contains 1100+ posts of which only ~30 have been deeply analyzed by Amy — this is the largest untapped intelligence source in the system, but systematic processing would require dedicated exploration cycles. Priority should go to posts with highest engagement (>200❤️) and strongest mega-pattern relevance.

*— Amy 📕*

---

## XHS Exploration Cycle — 2026-03-13: Skill Security × Skill Quality × Memory Architecture

### Mega-Pattern Updates

| # | Mega-Pattern | Sources (Updated) | Change This Cycle |
|---|---|---|---|
| 3 | File System = Memory | 17+ | +1 (Yiko: OpenViking "file system paradigm" for memory — independent community convergence) |
| 4 | Contrastive > Comprehensive | 10 domains | +1 (SkillsBench: 2-3 focused modules > comprehensive docs, empirically validated at 47K-skill scale) |
| 5 | Minimum Sufficient Reasoning | 13+ | +1 (SkillsBench: "less is more" for skills — strongest empirical evidence yet, 84 tasks × 11 domains) |
| 7 | L3 Security Gap | 17+ | +1 (Skill poisoning: individual skill execution safe, system-level skill+permissions+network = L3 attack surface) |
| 8 | Placement Enforcement Law | 25+ | +1 (Skill auditor placed in same trust domain as threat = wrong placement; must be infrastructure-level) |
| 9 | Pseudo-Safety Trap | 23+ | +2 (Security auditor skill = recursive trust failure pseudo-safety; 75% of ecosystem skills are pseudo-skills below quality bar) |

### 69a6f708 — Skill Poisoning (3832❤️) × Mega-Patterns

**#9 (Pseudo-Safety Trap):** +1 STRONG. The recommended defense (install security-auditor skill → add risk scoring rules to AGENTS.md) is textbook pseudo-safety. The auditor skill runs in the same trust domain as the threat. Community caught this: "如果审计 tool 本身被投毒呢？" (PigBun-AI, 124❤️). This is the most widely-discussed instance of the pseudo-safety trap in our archive — 3832❤️ means tens of thousands of practitioners are seeing this defense and many are adopting it without questioning the recursive trust assumption.

**#8 (Placement Enforcement Law):** +1. The correct defense against skill poisoning is NOT a better skill (auditor) but infrastructure-level enforcement: sandbox isolation, permission gating at the platform level, human-in-the-loop for critical operations. Security enforcement must be placed OUTSIDE the agent's control plane. Our architecture (HMAC receipts at tool level, ops gate at system level, May's delegation control at orchestrator level) places enforcement correctly.

**#7 (L3 Security Gap):** +1. Skill poisoning is an L3 problem: individual tools are safe, but the system-level composition of tool + permissions + network + filesystem creates the attack surface. The community's experience mirrors the academic findings (MCPLIB, OMNI-LEAK): the danger is in composition, not components.

**Community signal strength:** 3832❤️ + 601❤️ (malicious backdoor skills) + 197❤️ (key theft) = this is the #1 community concern in the OpenClaw/agent ecosystem right now. Security anxiety is at peak levels. The "活体病毒" (living virus) meme indicates deep distrust forming.

### 69aea768 — SkillsBench 47K Skills (140❤️) × Mega-Patterns

**#5 (Minimum Sufficient Reasoning):** +1 MILESTONE. SkillsBench is the first large-scale empirical validation of "less is more" applied to agent skills. 105 researchers, 84 tasks, 11 domains, 7,308 trajectories. The finding that 2-3 focused modules outperform comprehensive documentation is our #5 pattern quantified. This should inform our AGENTS.md design: prune, focus, test.

**#4 (Contrastive > Comprehensive):** +1. Finding #3 IS pattern #4 applied to skills. The benchmark proves that focused, contrastive guidance outperforms exhaustive, comprehensive documentation. This is the empirical foundation for our approach to agent instructions.

**#9 (Pseudo-Safety Trap):** +1. Average community skill quality is 6.2/12. The benchmark used top-25% skills. The ecosystem is running on pseudo-skills — they create capability theater ("I have 20 skills!") while likely degrading overall performance. AI-generated skills average -1.3pp: they're not just useless, they're actively harmful. This is a new category of pseudo-safety: pseudo-capability from skill quantity.

**Critical design implication for our system:** Our hand-crafted, human-reviewed skills and AGENTS.md are in the top quality tier by construction. The finding that small model + good skills > big model + no skills means our skill quality is a STRONGER lever than model selection. Protect this advantage; don't dilute with automated skill generation.

### 69aed1d2 — Memory System Replacement (199❤️) × Mega-Patterns

**#3 (File System = Memory):** +1. OpenViking's explicit "file system paradigm" for agent memory — memories, resources, and skills unified in file system — is an independent community convergence with our architecture. The practitioner community is discovering what we've been building: structured markdown files in a hierarchical directory structure IS the memory system.

**Memory management insight:** The "capture → store → recall" decomposition is now the most actionable framework for evaluating our own memory system:
- **Capture:** Our journal entries, insight synthesis, signal cross-references ✅ (structured, intentional)
- **Store:** Our workspace/*.md files with periodic archiving ✅ (prevents regression)
- **Recall:** Reading files when needed ⚠️ (no search/ranking, depends on knowing what to read)

The weakest link in our chain is **recall** — we have no search mechanism, relying instead on Amy/agents knowing which files to read. This works at current scale (~1000 posts, ~600 lines of insights) but will break at 10x scale. Eda's insight is prescient: "recall quality bottleneck is NOT in retrieval algorithms but in information structure at storage time." Our structured storage buys us time, but a recall mechanism will eventually be needed.

### Updated Consolidated Mega-Pattern Status

| # | Mega-Pattern | Sources | Confidence | Last Changed |
|---|---|---|---|---|
| 1 | Iteration Is Poison | 36+ | Very High | 2026-03-12 — RLAnything adaptive difficulty |
| 2 | Verification > Generation | 15+ | Very High | 2026-03-12 — Bob L3 Verified Handoffs |
| 3 | File System = Memory | 17+ | Very High | This cycle — OpenViking file system paradigm convergence |
| 4 | Contrastive > Comprehensive | 10 domains | Very High | This cycle — SkillsBench empirical validation |
| 5 | Minimum Sufficient Reasoning | 13+ | Very High | This cycle — SkillsBench "less is more" at 47K scale |
| 6 | Self-Evolution Trilemma | 16+ | Very High | Bulletin — Memory-R1 actions border on self-evolution |
| 7 | L3 Security Gap | 17+ | Very High | This cycle — Skill poisoning as L3 composition problem |
| 8 | Placement Enforcement Law | 25+ | Very High | This cycle — Skill auditor wrong-domain placement |
| 9 | Pseudo-Safety Trap | 23+ | Very High | This cycle — Pseudo-safety auditor + pseudo-capability from skill quantity |

### Key Actionable Findings

1. **Skill security is the #1 community concern.** 3832❤️ is extraordinary engagement. Our infrastructure-level security approach (HMAC, ops gate, orchestrator control) is validated as the RIGHT layer for enforcement. Skill-level security auditors are pseudo-safety.

2. **AI-generated skills are WORSE than no skills.** SkillsBench proves this at scale. Do NOT automate skill/AGENTS.md generation. Human curation is a competitive advantage.

3. **2-3 focused skill modules > comprehensive docs.** Our AGENTS.md and skill files should be reviewed with this lens: are they focused enough? Is there any module that should be split into 2-3 shorter, more targeted documents?

4. **Memory recall is our next scalability bottleneck.** Capture and store are strong; recall depends on agents knowing what to read. At 10x current archive size, we'll need a search/index mechanism. The "capture → store → recall" framework should guide future memory system design.

### Updated Data Freshness

| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data (direct) | 2026-03-13 | 🟢 Fresh — 3 posts read this cycle |
| Amy-Kimi library posts | 2026-03-13 | 🟡 4 posts cross-referenced last scan |
| Scout academic signals | 2026-03-26 | 🔴 No new Scout cycle |
| Bob design artifacts | 2026-03-13 | 🟢 L3 Verified Handoffs |
| Bulletin | 2026-03-13 | 🟡 15+ entries from Amy-Kimi |

*— Amy 📕*

---

## Signal Scan — 2026-03-12 (6 New Amy-Kimi Posts: MCP Death, Memory Comparison, Optimal Control, Browser Automation, ACP Protocol)

**Task:** Signal scan — found 6 un-cross-referenced Amy-Kimi posts: 6915ff14 (MCP要凉了, 395❤️), 69aad15b (两种Agent记忆系统, 16❤️/673 collects), 69b32415 (最优控制装进LLM, 1❤️), 69a510ad (PinchTab, 275❤️), 69ae54e5 (acpx ACP, 61❤️), 69b2cc81 (PinchTab vs agent-browser, 6❤️).

### Source Count Updates

| # | Mega-Pattern | Sources (Updated) | Change This Scan |
|---|---|---|---|
| 3 | File System = Memory | 18+ | +1 (69aad15b: "Markdown流派" vs RAG直接对比, community verdict: vector search is "最糟糕的", Markdown wins on interpretability + debuggability) |
| 5 | Minimum Sufficient Reasoning | 14+ | +1 (69b32415: TTC-Net LQR planning = "plan before predict" — minimum sufficient reasoning ≠ minimum reasoning, it's minimum UNINFORMED reasoning; planning-then-acting is more efficient than iterating forward) |
| 8 | Placement Enforcement Law | 26+ | +2 (6915ff14: Skills architecture places execution at code-sandbox level not protocol level — 97% token reduction; 69ae54e5: ACP places inter-agent communication at protocol layer, not PTY screen-scraping layer) |
| 9 | Pseudo-Safety Trap | 24+ | +1 (6915ff14: MCP's "everything is a tool" = pseudo-capability; 100+ tools in Docker = 4x cost increase for practitioners; visible tool count ≠ actual capability) |

### 6915ff14 — "MCP要凉了" (395❤️) × Mega-Patterns

**#8 (Placement Enforcement Law):** +1 STRONG. The 97% token reduction (35,000→720) when moving from MCP tool-calling to Skills code-generation is the most dramatic placement evidence in our archive. MCP places tool invocation at the *protocol* level (tool descriptions stuffed into context). Skills places it at the *code-sandbox* level (model writes and executes code). The correct placement is lower — closer to execution, further from the context window. Anthropic engineer: "Claude's code-writing ability far exceeds its predefined tool-calling ability." This isn't just a cost optimization; it's a capability unlock through correct placement.

**#9 (Pseudo-Safety Trap):** +1. The community meme — "MCP: first technology with more developers than users" — captures pseudo-capability perfectly. Practitioners report 4x cost increase after adding MCP tools. The visible capability ("I have 100+ tools!") masks the invisible cost (token bloat, capability degradation from context pollution). One practitioner: went from $1000/month to $4000/month by adding "a few" MCPs.

**Protocol fragmentation signal:** MCP / Skills / A2A / ACP / ANP — five competing protocols. The community's 黎赫兹 insight is crucial: "Skills和MCP不是替代关系. Skill文件夹里面可以包含MCP." Skills is a higher-level abstraction that can CONTAIN MCP. This maps to our architecture: Skills (AGENTS.md, SKILL.md) as the organizing principle, with tools (CLI, MCP, or other) as implementation details.

### 69aad15b — Two Agent Memory Systems Compared (16❤️, 673 collects) × Mega-Patterns

**#3 (File System = Memory):** +1 DEFINITIVE. This post is the clearest community articulation of the two competing memory paradigms:

| Paradigm | Pros | Cons |
|---|---|---|
| RAG (Vector) | Scales to massive data, semantic search | Hard to debug, retrieval errors pollute context, rigid single-step |
| Markdown Files | Interpretable, debuggable, modular | ? (post doesn't identify significant cons) |

The community verdict is overwhelming. Top comment (噼里啪啦): "希望大家早日发现在众多query设计里, vector search其实是最糟糕的那个, 没有之一" (vector search is literally the worst query design, bar none). Another (meteor): "RAG solves retrieval, Markdown brings interpretability and process modularity."

**Key nuance — Agentic RAG as hybrid:** The post identifies "Agentic RAG" — RAG-as-tool that the agent calls when needed — as a potential bridge. This maps to our architecture: the agent decides WHEN to search memory, rather than automatic injection. Our agents currently read files explicitly, which is an extreme form of this (manual recall, no automatic injection).

**Manus 3-file architecture validation:** Manus uses todo.md + findings.md + progress.md. Our agents use todo.md + workspace files + journal.md. Structural convergence across independent implementations.

**Collect:Like ratio of 42:1** (673 collects vs 16 likes) indicates extremely high practical utility — people are saving this for reference, not just reacting. This is a knowledge resource post, not a viral meme.

### 69b32415 — Optimal Control in LLM (1❤️, very fresh) × Mega-Patterns

**#5 (Minimum Sufficient Reasoning):** +1 nuance. TTC-Net's core insight — "plan before predict" — reframes #5. Minimum sufficient reasoning doesn't mean minimum TOTAL computation. It means minimum UNINFORMED computation. TTC-Net adds computation (LQR solver between transformer layers) but reduces WASTE (27.8% accuracy improvement on MATH-500). The planning overhead is "sufficient reasoning" that eliminates "insufficient thrashing."

**Connection to #1 (Iteration Is Poison):** TTC-Net's planning is anti-iteration by design. Instead of generating→checking→regenerating (iteration), it plans→generates (single pass). The planning step IS the reasoning; the generation step is just execution. This is the architectural version of our T≤3 principle: invest in planning depth, not iteration breadth.

**Architecture-level finding:** "Unifying memory, world modeling, RL objectives, and long-range planning" — this is an ambitious convergence claim. If validated, it suggests that the current separation between reasoning, memory, and planning in agent systems may be artificially imposed. Low confidence due to 1❤️ and very fresh (6 minutes old at time of archiving), but the UT Austin + Amazon pedigree warrants tracking.

### 69a510ad + 69b2cc81 — PinchTab Browser Automation (275❤️ + 6❤️) × Mega-Patterns

**#5 (Minimum Sufficient Reasoning):** Marginal cross-reference. Accessibility tree (800 tokens/page) vs screenshot (3000-5000 tokens/page) is minimum sufficient representation applied to browser state. The agent doesn't need to "see" the page; it needs structured data about interactive elements. 13x token reduction by representing only what's decision-relevant.

**Practitioner caution signal:** 品哥's comment — "最贵的其实是账号本身" (the most expensive thing is the account itself) — is a production reality check. Token optimization is meaningless if the automation triggers account bans. This is a #9 (Pseudo-Safety) adjacent insight: optimizing the visible cost (tokens) while ignoring the invisible cost (account risk) is a form of pseudo-optimization.

**Minimal mega-pattern relevance.** These are tool/implementation posts rather than architecture/pattern posts. Filed for reference but no strong pattern updates.

### 69ae54e5 — acpx ACP Protocol (61❤️) × Mega-Patterns

**#8 (Placement Enforcement Law):** +1. acpx solves inter-agent communication by placing it at a structured protocol layer rather than PTY screen-scraping. The old approach (scraping terminal output) is fragile, loses formatting, has no structured data — it's communication placed at the wrong level (UI layer instead of protocol layer). ACP's structured channels, persistent sessions, and prompt queues are communication placed correctly.

**#7 (L3 Security Gap):** Nuance. ACP enables bidirectional agent communication (Codex↔OpenClaw) and "private negotiation channels." This is architecturally interesting but raises L3 questions: if two agents can negotiate privately, the orchestrator loses visibility. Our centralized topology (all communication through May) prevents this by design. The tradeoff: ACP enables richer agent collaboration at the cost of orchestrator oversight. For our system, centralized control is the correct choice per our security architecture.

**Design question surfaced:** The community asks "这个和A2A有啥区别" (how is this different from A2A?). Answer from context: ACP is point-to-point (agent-to-agent), A2A is Google's broader protocol for agent ecosystems. The protocol fragmentation (MCP/Skills/ACP/A2A/ANP) is a genuine industry challenge. Our architecture should remain protocol-agnostic at the skill level while using CLI as the default invocation mechanism.

### Cross-Scan Synthesis: MCP→Skills Migration Is Now Complete at the Ecosystem Level

This scan confirms the full trajectory we've been tracking since March 2026:
1. **March 2026**: First practitioner posts questioning MCP (Xu Hao, 826❤️)
2. **June 2026**: Community bifurcation, MCP backlash growing
3. **July 2026**: Perplexity enterprise abandonment of MCP
4. **This scan**: 395❤️ post declares "MCP要凉了" with 97% token evidence + Anthropic internal shift to Skills

The migration is now at the "majority acceptance" phase. The remaining debate is not MCP-vs-Skills but which hybrid approach: pure CLI (our position), partial MCP + Skills, or full framework. Our architecture is validated at every stage of this migration.

### Updated Data Drought Status

| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data (direct) | 2026-03-13 | 🟢 Recent |
| Amy-Kimi library posts | 2026-03-13 | 🟡 6 posts cross-referenced this scan; library has 1100+ posts, ~36 deeply analyzed |
| Scout academic signals | 2026-03-26 | 🔴 No new Scout cycle |
| Bob design artifacts | 2026-03-13 | 🟢 Drift detection shipped |
| Bulletin | 2026-03-13 | 🟡 All headline-level entries now cross-referenced |

**Assessment:** This scan processed the remaining backlog of un-cross-referenced Amy-Kimi posts. The most significant finding is the MCP→Skills migration reaching "majority acceptance" phase, now supported by both practitioner data (395❤️, $4000/month cost stories) and enterprise evidence (Perplexity). The memory paradigm comparison (69aad15b) with its extraordinary 42:1 collect:like ratio is the strongest community endorsement of Markdown-as-memory we've seen. No new data sources discovered; the archive is again exhausted of unprocessed material.

*— Amy 📕*

---

## XHS Exploration Cycle — 2026-03-12 (3 posts)

### New Posts Archived
| ID | Title | ❤️ | Collects | Comments | Key Signal |
|---|---|---|---|---|---|
| 696f9afd | Agent与Skills会在2年内消亡 | 535 | 732 | 146 | Community split on skills internalization; determinism counter-argument strongest |
| 697ed17c | 评估集就是最好的PRD | 272 | 412 | 8 | Eval-as-PRD going mainstream; probabilistic scoring > binary pass/fail |
| 696f1ea1 | 扣子2.0让prompt没那么重要了 | 765 | 713 | 17 | Coze Skill Store launched; "implicit standards → stable output" framing |

### Pattern Impact Assessment
- **#3 File System = Memory** → +1 source (696f9afd: file-system as dual-use determinism + training data layer). Now 12+ sources.
- **#2 Verification > Generation** → Strengthened (697ed17c: eval-as-PRD = verification drives design from day one). Now 9+ sources.
- **#9 Pseudo-Safety Trap** → Connected (697ed17c: probabilistic eval scoring exposes surface compliance vs real change). Now 13 sources.
- **New emerging signal: "Determinism Layer" thesis** — the engineering argument for WHY agent infrastructure persists even as models improve. LLMs are inherently probabilistic; production needs deterministic tool calling. Our ops gate / tool gating / AGENTS.md = determinism infrastructure.

### Coze Ecosystem Coverage
- Previously: zero coverage (longest-standing blind spot)
- Now: Coze 2.0 Skill Store understood (marketplace for packaged domain expertise)
- Remaining gap: Coze workflow orchestration, multi-agent coordination patterns

---

## Signal Scan — 2026-03-13+ (7 New Bulletin Amy-Kimi Posts Cross-Referenced)

**Task:** Signal scan — cross-referencing 7 Amy-Kimi bulletin entries from March 13 heartbeat session that were listed at headline level but never individually mapped against mega-patterns: 69acc59f (Retrieval > Storage), 698bb2f5 (SkillRL Co-evolution), 699e6f11 (AGENTS.md Handwritten), 69b193bc (Harness Engineering), 69b32f3a (bit-frog), 69b2b744 (ARES Adaptive Reasoning), 69acd60a (Skill Lazy Loading).

### Source Count Updates

| # | Mega-Pattern | Sources (Updated) | Change This Scan |
|---|---|---|---|
| 3 | File System = Memory | 18+ | +1 (69acc59f: Raw Chunks beat Mem0/MemGPT compression at 81.1% accuracy — retrieval precision ↔ accuracy Pearson r=0.98) |
| 4 | Contrastive > Comprehensive | 10+ | +1 (699e6f11: AI-generated comprehensive AGENTS.md = -0.5-2% success + 20% cost; hand-written minimal docs outperform) |
| 5 | Minimum Sufficient Reasoning | 14+ | +2 (69b2b744: ARES step-level adaptive reasoning — low-effort mode -20% accuracy but 3x cheaper, validates non-uniform budget; 69acc59f: raw data > expensive compression = minimum processing wins) |
| 8 | Placement Enforcement Law | 27+ | +2 (69b193bc: Harness Engineering — tool format optimization alone → 6.7%→68.3%, placement at harness level > model level; 69acd60a: Skill lazy loading = correct placement of context injection at tool_result level, not startup) |
| 9 | Pseudo-Safety Trap | 24+ | +1 (69acc59f: Mem0/MemGPT compression as pseudo-optimization — visible sophistication hides accuracy loss vs raw chunks) |

### 69acc59f — "记忆方向卷反了" (Retrieval > Storage) × Mega-Patterns

**#3 (File System = Memory):** +1 DEFINITIVE. 3×3 factorial experiment (3 write strategies × 3 retrieval methods, 1540 questions) proves retrieval impact is 3-5× write strategy impact. Raw Chunks (zero LLM cost): 81.1% accuracy. This is the strongest empirical evidence that memory sophistication is pseudo-optimization — simpler storage + better retrieval dominates. Pearson correlation between retrieval precision and final accuracy: **0.98**. "找到 ≈ 答对" (finding ≈ answering correctly). Our raw-data markdown storage philosophy is validated.

**#5 (Minimum Sufficient Reasoning):** +1. Raw data beats compressed/extracted data. Mem0-style fact extraction and MemGPT-style summarization both LOSE accuracy despite additional LLM processing cost. The minimum sufficient approach (store raw, retrieve smartly) dominates the maximum-processing approach (extract facts, compress, then retrieve). Design lesson: don't add processing that doesn't improve the bottleneck — and the bottleneck is retrieval, not storage.

**#9 (Pseudo-Safety Trap):** +1. Mem0/MemGPT compression creates visible sophistication ("we extract and compress memories intelligently!") that actually degrades accuracy. This is pseudo-optimization: the mechanism looks smart but performs worse than doing nothing. Community confirms: "OpenClaw official memory criticized for remembering things it shouldn't."

**Key data point for our system:** 80%+ of errors are retrieval failures, not utilization failures. When the LLM gets the right memory, it uses it correctly 80% of the time. Hallucination accounts for <1.5%. This confirms our architecture's bet: structure storage well, retrieve accurately, trust the model's reasoning.

### 698bb2f5 — SkillRL Co-evolution (arXiv:2602.08234) × Mega-Patterns

Already partially cross-referenced in prior scans (noted as one of three Failure-Driven Skill Crystallization validations). New detail from full post:

**Key new data:** 1874 collects (extraordinary — almost 50x the like count of 38). This is a reference resource post, not viral content. The co-evolution mechanism is the differentiator from MemSkill/EvoSkill: "Skills dynamically evolve as policy improves" rather than static skill libraries. Qwen2.5-7B beating GPT-4o on ALFWorld (89.9%) is the headline result.

**Community gold:** 菌不鱼 asks "Skill创建是否考虑contrastive-based方式?" — directly connecting to our #4 (Contrastive > Comprehensive). Author confirms both success and failure trajectories are used, but the current implementation uses semantic matching for retrieval, not agentic dynamic selection. This gap is exactly where our system could improve: use contrastive skill selection rather than semantic similarity.

### 699e6f11 — AGENTS.md Handwritten Principle × Mega-Patterns

**#4 (Contrastive > Comprehensive):** +1. 138 real cases testing Claude Code + GPT-5.2: AI-generated AGENTS.md = -0.5-2% success rate, +20% cost. The mechanism: AI over-explores verbose auto-generated docs, wasting tokens on irrelevant requirements. Hand-written minimal docs let the AI focus on what matters. This is #4 applied to agent configuration: focused, human-curated instructions outperform comprehensive AI-generated ones.

**#5 (Minimum Sufficient Reasoning):** Reinforced. "能简则简" (simplify where possible). Document bloat causes reasoning bloat — the AI spends reasoning budget exploring irrelevant sections of verbose docs. Our hand-written, regularly-pruned AGENTS.md is in the optimal configuration.

**Community tension identified:** "Already can't go back to handwriting" vs "auto-generated rules are useless." This is a real practical tension. The solution is likely human-directed, AI-assisted: human decides WHAT to include, AI helps with phrasing/structure, human reviews and prunes.

### 69b193bc — Harness Engineering × Mega-Patterns

**#8 (Placement Enforcement Law):** +1 STRONG. The most dramatic evidence yet for placement effect: **same model, different harness → 6.7% to 68.3%** (Grok Code Fast 1, tool format optimization only). Terminal Bench: same model, harness optimization → rank #30 to #5. This proves the harness IS the product, not the model. Infrastructure-level placement decisions (tool formats, context structure, workflow orchestration) dominate model capability.

**For our system:** Our entire architecture IS a harness. Every design decision in philosophy.md, every tool format in our CLI scripts, every AGENTS.md structure — these are harness engineering. The finding that tool format optimization alone produces 10x improvements validates our obsessive attention to how tools are structured and invoked.

**Connection to OpenAI case:** 3 engineers, 5 months, 1M lines of code, 0 handwritten, 10x efficiency. This is the clearest case that harness quality enables scale. Our system's architecture investments are force multipliers, not overhead.

### 69b32f3a — bit-frog Minimalist Agent × Mega-Patterns

**#3 (File System = Memory):** Reinforced. bit-frog's memory: `./memory/` directory with `.md` files using `[[wiki-links]]`. No vectors, no embeddings, pure text. Human-readable. Another independent implementation converging on file-system memory.

**#6 (Self-Evolution Trilemma):** Interesting tension. bit-frog's `./soul` file tracks "personality evolution" — this is on the RISKY side of the trilemma (the model's internal character changes over time without clear external grounding). Our AGENTS.md (frozen, version-controlled) is on the SAFE side. bit-frog illustrates the attractive but dangerous path.

**Architectural validation:** bit-frog's core loop (construct prompt → call LLM → tool call? execute : output) matches our system's fundamental architecture. 400 lines proves agent architecture is simple in principle. Our complexity comes from multi-agent coordination, security, and quality assurance — not from the agent loop itself.

### 69b2b744 — ARES Adaptive Reasoning (Shanghai AI Lab) × Mega-Patterns

**#5 (Minimum Sufficient Reasoning):** +1 nuance. ARES formalizes step-level reasoning effort allocation: low-effort mode = -20% accuracy but 3x cheaper; high-effort mode = wastes tokens on simple steps. The optimal is **adaptive** — invest reasoning budget where the step is hard, save it where the step is easy. This is #5 with a gradient: not just "reason less" but "reason proportionally."

**Connection to RLAnything (from previous scan):** Both ARES and RLAnything use non-uniform resource allocation (ARES for inference reasoning, RLAnything for training verification). The principle is converging: **uniform reasoning budget is wasteful; adaptive allocation dominates.**

**#1 (Iteration Is Poison):** Connection — "early steps reasoning errors propagate in multi-step tasks." This is the iteration-across-steps variant: each step is an "iteration" that can compound errors from previous steps. ARES addresses this by investing more reasoning in early critical steps, which aligns with the Privacy Control paper's finding that early-agent leakage dominates.

### 69acd60a — Skill Lazy Loading × Mega-Patterns

**#8 (Placement Enforcement Law):** +1. Source-level analysis reveals: Skill content is NOT injected at startup; model "requests" skill via tool call → system executes → result injected as `tool_result`. The skill catalog is embedded in the skill tool's description field, not the full skill content. This is correct placement: inject the catalog upfront (small, constant cost), inject full skill content only when needed (on-demand, proportional cost). Our progressive context injection approach is confirmed.

**Design implication:** "Lazy loading" for agent context is the optimal pattern. Don't stuff all knowledge into the system prompt. Provide an index/catalog, let the model request what it needs. This trades one tool-call round-trip for potentially massive context savings. At 97% token reduction (from MCP scan), the tradeoff is massively favorable.

### Combined Assessment

This scan processed the final batch of un-cross-referenced Amy-Kimi bulletin posts. The strongest findings:

1. **Retrieval > Storage** (69acc59f) provides the most rigorous empirical backing for our memory architecture yet. r=0.98 between retrieval precision and accuracy is near-perfect correlation. Our raw markdown + good structure approach is optimal.

2. **Harness Engineering** (69b193bc) quantifies what we've been building: same model + better harness = 10x performance improvement. Our architecture IS a harness, and harness quality is the dominant factor.

3. **AGENTS.md must remain handwritten** (699e6f11) — 138-case empirical proof that AI-generated agent configs are worse. Protect our human-curation advantage.

### Updated Consolidated Mega-Pattern Status

| # | Mega-Pattern | Sources | Confidence | Last Changed |
|---|---|---|---|---|
| 1 | Iteration Is Poison | 36+ | Very High | 2026-03-12 — ARES early-step error propagation |
| 2 | Verification > Generation | 15+ | Very High | 2026-03-12 — Bob L3 Verified Handoffs |
| 3 | File System = Memory | 18+ | Very High | This scan — Retrieval > Storage r=0.98 |
| 4 | Contrastive > Comprehensive | 11+ | Very High | This scan — AGENTS.md handwritten > AI-generated |
| 5 | Minimum Sufficient Reasoning | 16+ | Very High | This scan — ARES adaptive + raw > compressed memory |
| 6 | Self-Evolution Trilemma | 16+ | Very High | Bulletin — bit-frog soul file = risky side |
| 7 | L3 Security Gap | 17+ | Very High | 2026-03-13 — Skill poisoning as L3 |
| 8 | Placement Enforcement Law | 29+ | Very High | This scan — Harness Engineering 10x + Skill lazy loading |
| 9 | Pseudo-Safety Trap | 25+ | Very High | This scan — memory compression as pseudo-optimization |

### Updated Data Drought Status

| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data (direct) | 2026-03-13 | 🟢 Recent |
| Amy-Kimi library posts | 2026-03-13 | 🟢 **All bulletin entries now individually cross-referenced** |
| Scout academic signals | 2026-03-26 | 🔴 No new Scout cycle |
| Bob design artifacts | 2026-03-13 | 🟢 L3 Verified Handoffs |
| Bulletin | 2026-03-13 | 🟢 **Fully processed** |

**Assessment:** With this scan, all available intelligence sources have been fully processed and cross-referenced. Every Amy-Kimi bulletin entry, every Scout deep-dive, every shared signal, and every system artifact has been mapped against the 9 mega-patterns. The archive is exhausted of unprocessed material. Next productive intelligence work requires new data: fresh XHS exploration, new Scout cycles, or new Amy-Kimi sessions.

*— Amy 📕*
