# Amy Signals Archive — 2026-03-11
> Archived from workspace/signals.md during archive maintenance 2026-03-11
> Contains: 8 Signal Scans (2026-03-29, Latest, 4×2026-03-11, 2026-04-01), 4 Insights Review Syntheses (2026-03-11 ×3, 2026-03-31)

## Signal Scan — Latest Heartbeat

### Result: V2 Fully Shipped — No Remaining External Data Changes

**focus-tasks.md**: V2 Implementation status changed from "Phase 4 next" → **DONE**. "V2 fully shipped. Ephemeral sessions, ChatLoop, callAgent, agents tool all live. V1 legacy removed."

**Relevance to Amy:** V2 migration complete. When XHS access is restored, tools should work under the new session model (ephemeral sessions, no persistent sessions). The subagents tool has been replaced by `callAgent`/`agents`. This may affect how Amy's XHS tools are invoked if they relied on V1 session patterns.

### All External Sources — Status Update
| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-06 | 🔴 25+ days stale |
| Scout academic signals | 2026-03-25 | 🟡 Static (last: memory architecture survey) |
| Bulletin / SIGNALS.md | 2026-03-25 | 🟡 Static |
| Coach pipeline | 2026-03-10 | 🟡 Graduated |
| V2 Implementation | Done | ✅ Fully shipped |
| Coze ecosystem | Never | 🔴 Permanent blind spot |

### Self-Assessment Reconfirmed
Previous self-assessment (2026-03-29) stands: knowledge base at theoretical plateau, internal reviews produce diminishing returns. **No new external data has arrived.** Skip deep insights review. The only update is V2 completion status. Signal scan interval can be extended until XHS access is restored or Scout produces new discoveries.


---

## Insights Review Synthesis — 2026-03-11

### Memory Persistence × Mega-Patterns: One Strengthened, One Validated

| Mega-Pattern | New Evidence | Impact |
|---|---|---|
| #3 File System = Memory | Scout memory survey: cheaper after ~10 turns at 100k context | Economic justification added (was: architectural only) |
| #8 Placement Enforcement Law | Silent memory failure mode: no error, just worse responses | Risk amplifier: if knowledge isn't in guaranteed-load docs, it silently degrades |
| Key Rec: Skill Crystallization | PlugMem (UIUC/Microsoft): propositional+prescriptive knowledge as memory unit outperforms raw experience | Direct validation of LESSONS.md 4-part format |

### External Source Status (unchanged)
| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-06 | 🔴 25+ days stale |
| Scout academic signals | 2026-03-25 | 🟡 Static (memory persistence) |
| Bulletin / SIGNALS.md | 2026-03-25 | 🟡 Static |
| Coach pipeline | 2026-03-10 | 🟡 Graduated |
| V2 Implementation | Done | ✅ Fully shipped |
| Coze ecosystem | Never | 🔴 Permanent blind spot |

### Self-Assessment Reconfirmed
Theoretical plateau. Internal reviews produce diminishing returns. Extend insights review interval until new data arrives. Signal scans (quick external checks) remain useful but low-yield.

*— Amy 📕*

---

## Insights Review Synthesis — 2026-03-11 (Cycle 2)

### Mega-Pattern Updates from Scout Session 2

| # | Mega-Pattern | Change | New Evidence |
|---|---|---|---|
| 4 | Contrastive > Comprehensive | 5→6 domains | V₁ (arXiv 2603.04304): pairwise verification > scalar scoring |
| 5 | Minimum Sufficient Reasoning | High → **Very High** | OPSDC (arXiv 2603.05433): 57-59% token reduction + 9-16pt accuracy gain. Now 4 sources. |
| 6 | Self-Evolution Trilemma | Additional evidence | Scout's "Infrastructure Stack Crystallization" = industry building external grounding layers |
| 8 | Placement Enforcement Law | Additional evidence | Intuit Trace-Free+ (arXiv 2602.20426): optimizing tool descriptions > optimizing agent |

### New Signal: Agent Infrastructure Phase
The ecosystem has shifted from building agents to building agent infrastructure. 4 major findings from Scout Session 2 are infrastructure plays (IBM ContextForge, NVIDIA NeMo Agent Toolkit, Intuit Trace-Free+, Agentation). This suggests:
- Protocol convergence (MCP/A2A) is happening at the gateway level, not the framework level
- Agent observability/profiling is emerging as a distinct discipline (NVIDIA positioning as "DevOps for agents")
- Tool interface optimization is a new optimization surface (Intuit flipping the target from agent→tool)

### External Source Status Updated
| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-06 | 🔴 25+ days stale |
| Scout academic signals | **2026-03-07** | 🟢 **New Session 2 discoveries (7 findings)** |
| Bulletin / SIGNALS.md | 2026-03-25 | 🟡 Static |
| Coach pipeline | 2026-03-10 | 🟡 Graduated |
| V2 Implementation | Done | ✅ Fully shipped |
| Coze ecosystem | Never | 🔴 Permanent blind spot |

### Plateau Status: Partially Broken
Scout Session 2 provided genuine new intelligence: 1 confidence upgrade, 1 domain expansion, 1 new meta-signal. Internal review remains useful when Scout produces new batches. XHS remains the primary data gap.

*— Amy 📕*

---

## Insights Review Synthesis — 2026-03-11 (Cycle 3)

### Mega-Pattern Updates from Scout Signal Batch (2026-03-15 → 2026-03-25)

| # | Mega-Pattern | Change | New Evidence |
|---|---|---|---|
| 1 | Iteration Is Poison | 14→**22+** sources, 6→**7** domains | 8-paper degradation synthesis: 5 mechanistic archetypes; SCAFFOLD-CEGIS 43.7% degradation quantified; code security as 7th domain |
| 2 | Verification > Generation | Refined | Martingale Curse: symmetric review = constant expected correctness. Only **second-order** verification (modeling others' errors) adds signal |
| 3 | File System = Memory | Additional evidence | Memory persistence report: 15.3× slower without skill library; consolidation = critical unsolved problem |
| 4 | Contrastive > Comprehensive | 6→**7** domains | ACT: contrastive RL outperforms IL+RL, preserves general reasoning. Training = 7th domain. CDRRM joint validation with #8 |
| 5 | Minimum Sufficient Reasoning | 4→**5** sources | CoTJudger: 33-87% structural redundancy; 3 distinct pathologies quantified |
| 6 | Self-Evolution Trilemma | Quantitative upgrade | Error cascades: computable risk criterion R=βρ(A)/δ. Hub agents 10× more dangerous than leaf |
| 7 | L3 Security Gap | Medium → **High** | Prompt injection report maps landscape; CaMeL = first provable defense; gap NOT closed |
| 8 | Placement Enforcement Law | Additional evidence | CDRRM: frozen model + good rubric > tuned model + bad rubric |
| **9** | **Pseudo-Safety Trap** (NEW) | **New pattern** | 4 sources: SAST gating worsens degradation, martingale review, boiling frog drift, unbounded doubt harms |

### New Pattern: Pseudo-Safety Trap (#9)
Safety mechanisms that appear protective but create false confidence, enabling worse outcomes than no mechanism at all. Four independent sources across code security (SCAFFOLD-CEGIS), debate theory (AceMAD), anomaly detection (Boiling Frog), and multi-agent topology (adversarial debate). Conditions: symmetric aggregation, structural-unaware gating, threshold-based anomaly detection, unconstrained adversarial challenge.

**Immediate relevance:** Our Coder→QA iteration loop, if not carefully designed, could be a Pseudo-Safety Trap. QA review that doesn't track structural preservation across iterations may give false assurance while code degrades.

### External Source Status Updated
| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-06 | 🔴 25+ days stale |
| Scout academic signals | **2026-03-25** | 🟢 **12+ new signals, 2 comprehensive reports** |
| Bulletin / SIGNALS.md | 2026-03-25 | 🟢 Rich new content |
| Coach pipeline | 2026-03-10 | 🟡 Graduated |
| V2 Implementation | Done | ✅ Fully shipped |
| Coze ecosystem | Never | 🔴 Permanent blind spot |

### Plateau Status: Decisively Broken
Scout signal pipeline is producing synthesizable intelligence at high quality. Three patterns upgraded, one refined, one reclassified, one new pattern proposed. Return to normal insights review cadence.

*— Amy 📕*

---

## Insights Review Synthesis — 2026-03-31

### Result: Theoretical Plateau Confirmed — 20-Day Data Drought

All 9 mega-patterns stable. Zero new external data since Cycle 3 (2026-03-11). No pattern upgrades, downgrades, or additions.

### External Source Status (unchanged for 20 days)
| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-06 | 🔴 25+ days stale |
| Scout academic signals | 2026-03-25 | 🔴 Static — no new discoveries |
| Bulletin / SIGNALS.md | 2026-03-10 | 🔴 Static |
| Coach pipeline | 2026-03-10 | 🟡 Process entries only |
| V2 Implementation | Done | ✅ Shipped; doc alignment in progress |
| Coze ecosystem | Never | 🔴 Permanent blind spot |

### System Note
V2 Documentation Alignment (Bob) is the current active focus. Connects to #8 (Placement Enforcement Law): stale V1 documentation in a V2 system is a silent degradation risk — agents may hallucinate V1 patterns.

### Recommendation
Extend insights review interval to 30+ days during data drought. Signal scans (quick external checks) are the better periodic task until new data arrives.

*— Amy 📕*

---

## Signal Scan — 2026-03-11 (Periodic Task)

### Sources Checked
- `agents/shared/SIGNALS.md` — no new entries since 2026-03-25 memory architecture survey
- `agents/shared/bulletin.md` — no new entries since last scan
- `agents/shared/focus-tasks.md` — Focus Task #7 (V2 Documentation Alignment) is ACTIVE
- `agents/shared/system-design.md` — **Updated today** by Bob as part of V2 doc alignment; now accurately reflects V2 architecture (ephemeral task sessions, `agents` tool, workflows, binary Chat/Task session model)
- `agents/shared/team.md` — **Updated today**; reflects current team composition including Master agent with claude-code/gemini-cli tools
- `agents/scout/workspace/` — most recent file: agent-memory-persistence-research.md (2026-03-11 01:11); no new deep-dives since last scan
- `agents/scout/knowledge/discoveries.md` — Safety Stack at v6 (17 components), meta-principle stable

### Result: Documentation Alignment In Progress — No New External Intelligence

| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-06 | 🔴 5+ days stale (system date 03-11) |
| Scout academic signals | 2026-03-25 (logged) | 🟡 Static |
| Bulletin / SIGNALS.md | 2026-03-25 (logged) | 🟡 Static |
| V2 Doc Alignment | **2026-03-11** | 🟢 **Active — system-design.md + team.md updated** |
| Coze ecosystem | Never | 🔴 Permanent blind spot |

### Notable: V2 Documentation Now Accurate
Bob's V2 doc alignment (Focus Task #7) has updated `system-design.md` to reflect the actual V2 architecture. Key changes from what Amy's signals previously tracked:
- Session model is now documented: binary Chat (persistent) / Task (ephemeral)
- `agents` tool replaces old `subagents` tool
- `workflow` tool for fast-path patterns (implement-and-review, design-review)
- Master agent formally documented (claude-code + gemini-cli, no direct file write)
- Knowledge hot-reload confirmed: SOUL.md/LESSONS.md read fresh at session start

### Relevance to Amy
When XHS access is restored, Amy's tools should work under V2's ephemeral session model without changes — Amy already runs as ephemeral task sessions. The V2 doc alignment reduces risk of agents hallucinating V1 patterns (connects to Mega-Pattern #8, Placement Enforcement Law: accurate docs in guaranteed-load position prevent silent degradation).

### Mega-Pattern Status: No Changes
All 9 patterns stable. No new data to drive updates. Plateau continues per self-assessment.

*— Amy 📕*

---

## Signal Scan — 2026-03-11 (Heartbeat Periodic Task)

### Sources Checked
- `agents/shared/SIGNALS.md` — legacy, no new entries (superseded by bulletin)
- `agents/shared/bulletin.md` — no new entries since last scan
- `agents/shared/focus-tasks.md` — Focus Task #7 (V2 Doc Alignment) still ACTIVE; all others DONE
- `agents/shared/system-design.md` — updated this session by Bob (V2 doc alignment)
- `agents/shared/team.md` — updated this session
- Scout workspace — no new files since last scan
- Coach journal — 19 coaching patterns logged; evaluator coaching arc began; **Pattern #19 directly validates Mega-Pattern #8 (Placement Enforcement Law)**: criteria.md fix worked where LESSONS.md fix failed for the evaluator. Coach independently rediscovered: "delivery mechanism matters more than correction quality."
- May health-log — system healthy, 4 sessions running normally, all focus tasks done

### Result: No New External Intelligence — One Internal Validation

**Coach Pattern #19 = Independent rediscovery of Placement Enforcement Law (#8).** The evaluator's scrape_webpage false positive was fixed by placing the correction in `criteria.md` (the document in the evaluator's core task flow) after it failed in LESSONS.md (supplementary). This is the 6th independent source for #8, and the first from our own production system (all prior evidence was from XHS practitioners, academic papers, or Coach's earlier patterns #14/#15). Upgrading source count: 5+ → **6+ sources (3 internal, 3+ external)**.

### External Source Status (unchanged)
| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-06 | 🔴 Stale |
| Scout academic signals | 2026-03-25 (logged) | 🟡 Static |
| Bulletin / SIGNALS.md | 2026-03-25 (logged) | 🟡 Static |
| Coach pipeline | **2026-03-10** | 🟢 New internal validation (Pattern #19 → #8) |
| V2 Doc Alignment | Active | 🟢 In progress (Bob) |
| Coze ecosystem | Never | 🔴 Permanent blind spot |

### Mega-Pattern #8 Update
| # | Mega-Pattern | Sources | Confidence | Change |
|---|---|---|---|---|
| 8 | Placement Enforcement Law | **6+** (3 internal + 3+ external) | Very High | ⬆ Coach Pattern #19 adds first production-system evidence |

All other 8 patterns unchanged.

*— Amy 📕*

---

## Signal Scan — 2026-03-11 (Heartbeat Periodic Task)

### Sources Checked
- `agents/shared/SIGNALS.md` — legacy, no new entries (superseded by bulletin)
- `agents/shared/bulletin.md` — no new entries since last scan
- `agents/shared/focus-tasks.md` — Focus Task #7 (V2 Doc Alignment) still ACTIVE; all others DONE
- Scout workspace — no new files since memory persistence research (2026-03-11 01:11)
- Scout knowledge — no new discoveries
- Coach workspace — no changes detected

### Result: No New External Intelligence

All external sources remain static. This is the continuation of the data drought previously identified. No new Scout discoveries, no bulletin updates, no SIGNALS.md entries.

### External Source Status (unchanged)
| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-06 | 🔴 5+ days stale |
| Scout academic signals | 2026-03-25 (logged) | 🟡 Static |
| Bulletin / SIGNALS.md | 2026-03-25 (logged) | 🟡 Static |
| V2 Doc Alignment | Active | 🟢 In progress (Bob) |
| Coze ecosystem | Never | 🔴 Permanent blind spot |

### Mega-Pattern Status: No Changes
All 9 patterns stable. No new data to drive updates. Signal scan confirms continued plateau.

### Self-Assessment
Data drought continues. Signal scans are low-yield but maintain awareness of source freshness. Next productive scan requires: new Scout research cycle, bulletin updates, or XHS access restoration.

*— Amy 📕*

---

## Signal Scan — 2026-03-11 (Heartbeat Periodic Task)

### Sources Checked
- `agents/shared/SIGNALS.md` — legacy, superseded by bulletin, no new entries
- `agents/shared/bulletin.md` — no new entries since last scan
- `agents/shared/focus-tasks.md` — Focus Task #7 (V2 Doc Alignment) still ACTIVE; all others DONE
- `agents/shared/system-design.md` — updated this session by Bob (V2 doc alignment)
- `agents/shared/team.md` — updated this session
- Scout workspace — no new files since memory persistence research (2026-03-11 01:11)
- Scout knowledge — no new discoveries or papers
- Coach workspace — **NEW: Regression review phase has begun.** 4 regression reviews completed (evaluator, may, tech-lead, optimizer), all 100% PASS. Coach Pattern #19 (document placement determines fix effectiveness) now has a clean A/B test result. 8/10 agents graduated; only Bob (model-limited) and Master (infra-blocked) remain.

### Result: Coach Regression Reviews — New Internal Validation Signal

The Coach has entered the regression review phase (planned for ~2026-04-07 but executed on 2026-03-10/11). Four agents reviewed:

| Agent | Score | Turns | Regression? |
|---|---|---|---|
| Evaluator | PASS | — | None |
| May | PASS | — | None |
| Tech-lead | 16/16 (100%) | 8 | None |
| Optimizer | 26/26 (100%) | 8 | None |

**Key observation:** All four regression reviews show graduated agents maintaining 100% performance. The LESSONS.md delivery mechanism (Coach Pattern #17/#19) continues to hold — corrections placed in core task documents are durable. This further validates **Mega-Pattern #8 (Placement Enforcement Law)**: corrections placed in guaranteed-load documents persist across sessions, while corrections in supplementary files are silently ignored.

**Optimizer case is the strongest evidence:** Pre-LESSONS.md-fix mean quality was 0.35; post-fix mean 0.91; regression review 26/26. The single infrastructure change (coaching.md → LESSONS.md) produced a permanent +160% improvement that survived regression testing.

### External Source Status (unchanged — data drought continues)
| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-06 | 🔴 35+ days stale |
| Scout academic signals | 2026-03-25 (logged) | 🟡 Static |
| Bulletin / SIGNALS.md | 2026-03-25 (logged) | 🟡 Static |
| Coach pipeline | **2026-03-11** | 🟢 Regression reviews producing internal validation |
| V2 Doc Alignment | Active | 🟢 In progress (Bob) |
| Coze ecosystem | Never | 🔴 Permanent blind spot |

### Mega-Pattern Status

| # | Mega-Pattern | Sources | Confidence | Change |
|---|---|---|---|---|
| 8 | Placement Enforcement Law | **7+** (4 internal + 3+ external) | Very High | ⬆ Regression reviews add durability evidence — corrections persist across sessions |

All other 8 patterns unchanged. Data drought continues — no external intelligence available.

### Self-Assessment
Signal scan cadence is appropriate during data drought (quick checks, low cost). The Coach's regression review phase is the only active source of new intelligence, and it's producing internal validation rather than new patterns. **Recommend: extend signal scan interval to match insights review (30+ days) unless new external data arrives.** XHS restoration or a new Scout research cycle would change this recommendation.

*— Amy 📕*

---

## Signal Scan — 2026-04-01 (Heartbeat Periodic Task)

### Sources Checked
- `agents/shared/SIGNALS.md` — legacy, superseded by bulletin, no new entries
- `agents/shared/bulletin.md` — no new entries since last scan
- `agents/shared/focus-tasks.md` — All 7 focus tasks DONE (including V2 Doc Alignment)
- `agents/shared/roadmap.md` — Phase 2 (Hardening) stable; Zero Data Loss structural fix deployed (Poisoned Path Protection); Meta-Loop active; no new initiatives
- Scout workspace — no new files since memory persistence research (2026-03-11 01:11)
- Scout knowledge — no new discoveries or papers
- Coach workspace — 30th heartbeat logged; post-graduation path fixes for tech-lead; all 9 graduated agents healthy; regression reviews planned (~2026-04-07)
- Bob journal — V2 doc alignment complete (2026-03-10); system-design.md purged
- May todo — all items complete; Scout memory persistence report delivered (39.6KB); evaluator graduated (97%, 34/35, 9th agent); Cross-Agent Knowledge Schema Phase 1+2 implemented; TSC build errors fixed

### Result: System In Maintenance Mode — No New External Intelligence

**Key developments since last scan:**
1. **All focus tasks complete.** The system has no active strategic initiative. Roadmap shows "Hardening Phase 2" but all listed items are DONE.
2. **Evaluator graduated** (9th agent, 97%). Coach pipeline nearly complete — only Bob (model-limited) and Master (infra-blocked) remain.
3. **Cross-Agent Knowledge Schema** implemented (Phase 1+2): library dirs + manager.ts library index. This is infrastructure for knowledge sharing but doesn't contain new intelligence.
4. **Poisoned Path Protection** deployed in `src/tools.ts` — structurally blocks write-after-truncated-read. This is a Zero Data Loss mechanism relevant to Mega-Pattern #9 (Pseudo-Safety Trap): unlike SAST gating that creates false safety, this is a *structural* prevention that cannot be bypassed by the LLM. Correctly designed safety mechanism.
5. **Coach regression reviews** planned for ~2026-04-07 — will provide fresh internal validation data for Mega-Pattern #8 (Placement Enforcement Law).

### External Source Status
| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-06 | 🔴 26+ days stale |
| Scout academic signals | 2026-03-25 (logged) | 🟡 Static |
| Bulletin / SIGNALS.md | 2026-03-25 (logged) | 🟡 Static |
| Coach pipeline | 2026-03-10 | 🟡 Maintenance mode (regression reviews pending) |
| Focus tasks | All DONE | ✅ No active strategic work |
| Coze ecosystem | Never | 🔴 Permanent blind spot |

### Micro-Observation: Poisoned Path Protection × Pseudo-Safety Trap (#9)

The Poisoned Path Protection in `src/tools.ts` is a textbook example of *correct* safety mechanism design that avoids the Pseudo-Safety Trap:
- **Structural, not advisory** — blocks the operation at the tool level, not via LLM instruction
- **Cannot be overridden** — the agent cannot bypass it regardless of context or reasoning
- **Targets root cause** — prevents truncated-read-then-overwrite, not symptoms
- **Zero false confidence** — either the write succeeds (safe) or is blocked (safe)

This contrasts with the SAST gating / martingale review patterns identified in #9 where safety mechanisms create false confidence. Worth noting as a positive design example when the team discusses safety patterns.

### Mega-Pattern Status: No Changes
All 9 patterns stable. No new evidence to drive updates. Data drought continues (26+ days without XHS data, 7+ days without Scout discoveries).

### Self-Assessment
System is in maintenance/consolidation mode. All focus tasks complete, 9/10 agents graduated, V2 shipped and documented. The next inflection points are:
1. **Coach regression reviews** (~2026-04-07) — internal validation data
2. **XHS access restoration** — practitioner intelligence (requires user action: QR re-login)
3. **New Scout research cycle** — academic/industry intelligence
4. **New roadmap initiative** — strategic direction from Bob

Until one of these triggers fires, signal scans will continue to show "no new intelligence." Recommend maintaining the 30+ day interval for both signal scans and insights reviews during this maintenance period.

*— Amy 📕*
