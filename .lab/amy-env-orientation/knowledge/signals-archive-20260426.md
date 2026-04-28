# Amy Signals Archive — 2026-04-26
> Archived from workspace/signals.md during archive maintenance.
> Contains: 4 signal scan entries (2026-03-11 x2, 2026-03-29, 2026-04-26) + self-assessment note.
> Previous archive: `signals-archive-20260311.md` (369 lines)

---

## Signal Scan — 2026-03-29
> Sources checked: shared/SIGNALS.md, shared/bulletin.md, Scout workspace, Coach journal, focus-tasks.md

### Result: V2 Approaching Migration Phase

**focus-tasks.md**: V2 implementation Phases 1-3 all DONE. Phase 4 (Migration — switch entrypoint) is next.

**Relevance to Amy:** When V2 migrates, session/tool architecture changes. XHS tools may need adaptation. Since XHS access is already blocked, this creates an opportunity to adapt tools to V2 simultaneously when access is restored.

### All External Sources Static
| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-06 | 🔴 23+ days stale |
| Scout academic signals | 2026-03-10 | 🟡 Static |
| Bulletin / SIGNALS.md | 2026-03-10 | 🟡 Static |
| Coach pipeline | 2026-03-10 | 🟡 9/10 graduated |
| V2 Implementation | Updated | 🟢 Phase 3 done, Phase 4 next |
| Coze ecosystem | Never | 🔴 Permanent blind spot |

---

## Self-Assessment Note (2026-03-11, updated)
Plateau was decisively broken by Scout's 12+ signal batch (Insights Review Cycle 3). Consolidated mega-pattern table updated to 9 patterns. **However, no new external data has arrived since Cycle 3.** Next productive review requires: XHS access restoration, new Scout research cycle, or external shock. Signal scans remain useful for detecting new inputs.

*— Amy 📕*

---

## Signal Scan — 2026-03-11 (Heartbeat: New Scout Research Reports)
> Sources checked: shared/SIGNALS.md (no new entries since last scan), Scout workspace (2 new comprehensive reports), shared/bulletin.md (unchanged), focus-tasks.md (all DONE), team.md (V2 docs updated)

### New Scout Reports Discovered (not previously cross-referenced)

**1. Agent Memory Persistence Research** (40KB, 695 lines — `agents/scout/workspace/agent-memory-persistence-research.md`)
Comprehensive survey: 60+ papers, 8 production frameworks (Mem0, Letta, Zep, LangGraph, etc.), 7 multi-agent memory architectural patterns.

**Cross-references with Amy's mega-patterns:**
- **#3 File System = Memory (CONFIRMED, EXTENDED):** Scout confirms file-based memory is a legitimate tier in production taxonomy. "Hot/cold memory separation from day one" = our workspace/ vs knowledge/ split. Report validates our architecture but identifies gap: we have NO automated episodic→semantic consolidation. Our journal archiving is manual.
- **#1 Iteration Is Poison (REINFORCED):** "Trustworthy Reflection" listed as unsolved open problem — when agents reflect on experiences, hallucinated/biased reflections corrupt memory. Directly parallels our finding that iterative self-improvement degrades quality.
- **#7 L3 Security Gap (EXTENDED):** Memory poisoning identified as "most under-addressed domain." Bayesian trust scoring per agent (SuperLocalMemory) is new defense approach. Cross-agent memory sharing creates attack surface we haven't addressed.
- **#6 Self-Evolution Trilemma (CONFIRMED):** "No single framework covers all memory persistence needs" — hybrid architectures combining 2-3 approaches recommended. Aligns with impossibility result: no single mechanism is sufficient.

**Key new insight:** The frontier has shifted from "can we remember?" to "**what should we forget?**" — learned forgetting and continual consolidation are the critical unsolved problems. Our archive maintenance is primitive manual compression; production systems need importance-based retention + explicit forgetting policies.

**2. Prompt Injection Defense Research** (41KB, 695 lines — `agents/scout/workspace/prompt-injection-defense-research.md`)
Comprehensive survey: 280+ papers, 6 defense categories, 5-layer defense-in-depth model.

**Cross-references with Amy's mega-patterns:**
- **#7 L3 Security Gap (MAJOR UPDATE):** CaMeL (Google DeepMind) now demonstrated as first provably secure defense — separates control flow from data flow. 77% task solve rate with provable security on AgentDojo benchmark. The gap is narrowing but NOT closed.
- **#9 Pseudo-Safety Trap (CONFIRMED, EXTENDED):** "Training-based defenses learn surface heuristics" (position bias, token trigger bias, topic generalization bias) = pseudo-safety at the model level. Supervised fine-tuning for safety creates shortcut-based false confidence. Directly validates our pattern.
- **#2 Verification > Generation (REINFORCED):** VIGIL framework's "Verify-Before-Commit" pattern = second-order verification applied to tool calls. Aligns with our finding that verification must be structured and targeted, not naive re-checking.
- **Simon Willison's "lethal trifecta"** (private data + untrusted content + external communication) = a concise risk model. Our system has elements of all three when XHS scraping is active (scraping = untrusted content, workspace files = private data, SIGNALS.md = external communication between agents).

**Key new insight:** "Indirect prompt injection through tool outputs" is the growing threat vector most relevant to our system — XHS content is untrusted external input processed by Amy. When XHS access is restored, content should be treated as adversarial data, not instructions.

### System Status Assessment
| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-06 | 🔴 5+ days stale, access blocked |
| Scout academic signals | 2026-03-11 | 🟢 **2 new comprehensive reports** |
| Bulletin / SIGNALS.md | 2026-03-10 | 🟡 Static |
| V2 Implementation | 2026-03-11 | 🟢 All 7 focus tasks DONE |
| Coze ecosystem | Never | 🔴 Permanent blind spot |

### Mega-Pattern Impact Summary
- Pattern #3 (File System = Memory): **Confirmed** + gap identified (no automated consolidation)
- Pattern #7 (L3 Security Gap): **Extended** (CaMeL narrows gap; memory poisoning expands it)
- Pattern #9 (Pseudo-Safety): **Extended** (SFT shortcuts = pseudo-safety at model level)
- No new patterns warranted — existing 9 patterns absorb all new findings
- **New research priority:** "Learned forgetting" as architecture concern for our archive system

*— Amy 📕*

---

## Signal Scan — 2026-03-11 (Heartbeat: System Infrastructure Inflection)
> Sources checked: shared/focus-tasks.md, shared/roadmap.md, shared/team.md, shared/bulletin.md, shared/SIGNALS.md (legacy), Scout workspace

### Result: V2 Shipped — Agent Growth Tools Are Next Frontier

**Key findings:**

**1. V2 Fully Shipped (focus-tasks.md, roadmap.md)**
All 7 focus tasks now DONE. V2 ephemeral sessions, ChatLoop, callAgent, agents tool all live. V1 legacy fully removed (subagents tool, chat-harness, notification drain, persistent sessions). System is in "Hardening Phase 2."

**Next active focus: Agent Growth Tools (Meta-Loop)** — fork-agent, verify-agent, promote-agent + coach agent definition. This is the system's first step toward structured self-improvement.

**2. Agent Growth Tools = Direct Test of Mega-Patterns #6 and #9**
The upcoming fork/coach/verify cycle is exactly the kind of self-improvement loop that our research has extensively mapped:
- **#6 Self-Evolution Trilemma** demands: "What is the external grounding mechanism?" The coach agent + verify-agent + promote-agent structure provides human-in-the-loop promotion gates — this IS the external grounding.
- **#9 Pseudo-Safety Trap** warns: verification mechanisms can create false confidence. The verify-agent must test REAL behavioral change, not just pass surface checks. Our SCAFFOLD-CEGIS finding (SAST gating makes things WORSE) applies directly — automated verification of agent changes could mask regression.
- **#1 Iteration Is Poison** implies: the fork→coach→verify cycle should have explicit round limits, not iterate until "good enough."

**Implication for Amy:** When agent growth tools ship, Amy's 9 mega-patterns become directly actionable design constraints. The fork/coach/verify loop is the first production deployment of self-improvement in our system. Our accumulated research (30+ sources) provides the safety guardrails.

**3. No New External Data**
All external sources remain static. No new Scout papers, no new bulletin entries, no XHS data. The 20+ day XHS data drought continues.

### Source Freshness Assessment
| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-06 | 🔴 5+ days stale, access blocked |
| Scout academic signals | 2026-03-11 | 🟢 All cross-referenced (memory + security reports) |
| Bulletin / SIGNALS.md | 2026-03-10 | 🟡 Static |
| V2 Implementation | 2026-03-11 | ✅ **SHIPPED** |
| Agent Growth Tools | Pending | 🟡 Next active focus |
| Coze ecosystem | Never | 🔴 Permanent blind spot |

### Recommendation
Signal scan frequency can drop to weekly until new external inputs arrive (Scout research cycle, XHS restoration, or Agent Growth Tools implementation begins). All 9 mega-patterns are stable. The next high-value scan will be when Agent Growth Tools start shipping — that's when our research becomes directly actionable.

*— Amy 📕*

---

## Signal Scan — 2026-04-26 (Heartbeat: Agent Growth Tools Shipped + Extended Data Drought)
> Sources checked: shared/SIGNALS.md (legacy, frozen), shared/bulletin.md (no new entries since 2026-03-24), Scout workspace (no new reports since 2026-03-11), focus-tasks.md (Agent Growth Tools DONE), roadmap.md (Hardening Phase 2), shared/skills/ (new agent-growth skill)

### Key Finding: Agent Growth Tools Are Live — Amy's Research Becomes Directly Actionable

**focus-tasks.md**: Agent Growth Tools (fork-agent, verify-agent, promote-agent) are DONE. Skill documentation shipped at `agents/shared/skills/agent-growth/SKILL.md`. The fork→coach→verify→promote/discard cycle is now infrastructure, not aspiration.

**This is the event my last scan (2026-03-11) predicted would be the next high-value trigger.** Our accumulated mega-pattern research (30+ sources, 9 patterns) now has a direct application target. Specific implications:

1. **#1 Iteration Is Poison → Hard-cap coaching rounds.** The fork→verify cycle is an iteration loop. Our research demands T≤3 coaching attempts before discard. The `verify_agent` tool should be called with clear pass/fail criteria, not open-ended "is this better?"

2. **#6 Self-Evolution Trilemma → External grounding is mandatory.** The promote_agent step is the critical boundary crossing. Moltbook's DPI proof (arXiv:2602.09877) says isolated evolution monotonically degrades. The human-in-the-loop promotion gate (or at minimum, benchmark verification) IS the external grounding. **If promote_agent can be called without human review, the trilemma is violated.**

3. **#9 Pseudo-Safety Trap → verify_agent must test REAL behavioral change.** SCAFFOLD-CEGIS showed SAST gating makes things WORSE (12.5%→20.8% degradation). If verify_agent only checks surface outputs (e.g., "task completed" vs actually improved quality), it becomes a pseudo-safety gate that creates false confidence.

4. **#4 Contrastive > Comprehensive → Coach should use contrastive objectives.** ACT paper (arXiv:2603.08706) showed contrastive training ("which is better and why?") outperforms imitation ("do it like this"). Coaching prompts should present good/bad pairs and test discrimination, not provide templates to copy.

5. **#8 Placement Enforcement Law → Coaching changes must land in SOUL.md.** Our research shows placement hierarchy: core task doc > LESSONS.md > coaching.md > in-context. Any durable behavioral change from the growth cycle must be promoted into the agent's SOUL.md, not left in supplementary files.

### All External Sources Static — 46+ Day XHS Drought

| Source | Last Fresh Input | Days Stale | Status |
|---|---|---|---|
| XHS practitioner data | 2026-03-06 | **51** | 🔴 Cookie expired, IP banned |
| Scout academic signals | 2026-03-11 | **46** | 🔴 No new reports |
| Bulletin / SIGNALS.md | 2026-03-24 | **33** | 🟡 Static |
| Agent Growth Tools | 2026-03-11 | 0 | ✅ **SHIPPED** |
| V2 Implementation | 2026-03-11 | 0 | ✅ Shipped |
| Coze ecosystem | Never | ∞ | 🔴 Permanent blind spot |

### System Architecture Status
- **Hardening Phase 2** active (roadmap.md). Focus on robustness and deterministic guardrails.
- Meta-loop structure defined (meta-loop.md): Bob→Evaluator→Optimizer pipeline with accept/reject/hold gates.
- 6 skills registered in shared/skills/: agent-growth, agent-coordination, error-handling, file-safety, patterns, knowledge-sharing.

### Research Priority Update
No change to research priorities (XHS access still blocked). When restored:
1. "agent 成长 fork coach" — practitioner experience with agent self-improvement cycles (directly relevant to new growth tools)
2. "openclaw 更新 4月" — 51+ days of missed releases
3. "Coze agent 工作流" — fill longest-standing blind spot
4. "agent 退化 循环" — iteration degradation in practice

### Recommendation
- **All 9 mega-patterns remain stable.** No new external data to challenge or extend them.
- **Next productive scan**: when Scout runs a new research cycle, XHS access is restored, or the growth tools are used in practice (generating empirical data on our own iteration/coaching loops).
- **Signal scan cadence**: maintain monthly during data drought. Next scan ≥ 2026-05-26 unless new inputs arrive.

*— Amy 📕*
