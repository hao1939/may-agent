# Amy Signals — Active Workspace
> Last archive maintenance: 2026-04-26
> **Archived (this cycle):** 4 Signal Scans (2026-03-11 x2, 2026-03-29, 2026-04-26) + self-assessment note → `knowledge/signals-archive-20260426.md`.
> **Previously archived:** 8 Signal Scans + 4 Insights Review Syntheses → `knowledge/signals-archive-20260311.md` (369 lines). Earlier → `knowledge/signals-archive-20260310b.md`, `knowledge/signals-archive-20260310.md`.

---

## Consolidated Mega-Pattern Status (9 patterns — all stable since 2026-03-11)

| # | Mega-Pattern | Sources | Confidence | Last Changed |
|---|---|---|---|---|
| 1 | Iteration Is Poison | **22+** (7 domains) | Very High | 2026-03-11 — 8-paper mechanistic synthesis; "code security" as 7th domain |
| 2 | Verification > Generation | 6+ | Very High | 2026-03-11 — Refined: second-order verification only; naive re-checking = martingale |
| 3 | File System = Memory | 8+ | Very High | 2026-03-11 — ContextForge + memory persistence report confirm |
| 4 | Contrastive > Comprehensive | **7 domains** | Very High | 2026-03-11 — ACT adds training domain (7th); CDRRM joint validation with #8 |
| 5 | Minimum Sufficient Reasoning | **5 sources** | **Very High** | 2026-03-11 — OPSDC + CoTJudger structural quantification (33-87% redundancy) |
| 6 | Self-Evolution Trilemma | 8+ | Very High | 2026-03-11 — Error cascades provide computable risk criterion (R=βρ(A)/δ) |
| 7 | L3 Security Gap | 5+ | **High** | 2026-03-11 — Defense landscape mapped; CaMeL = first provable defense; gap NOT closed |
| 8 | Placement Enforcement Law | 5+ | Very High | 2026-03-11 — CDRRM: frozen model + good rubric > tuned model + bad rubric |
| **9** | **Pseudo-Safety Trap** | **4** | **High** | 2026-03-11 — Safety mechanisms creating false confidence (SAST gating, martingale review, boiling frog, unbounded doubt) |

**Unified Architecture Principle** (composite of all 9): "Evolve skills (second-order knowledge) within isolated contexts, behind frozen safety boundaries, with external grounding at each boundary crossing. Verify that safety mechanisms actually work — symmetric review and gating can create pseudo-safety worse than no mechanism." — 30+ sources across both archives.

---

## Key Actionable Mapping: Agent Growth Tools (shipped 2026-04-26)

The fork→coach→verify→promote/discard cycle is now live. Our 9 mega-patterns map to 5 design constraints:
1. **#1** → Hard-cap coaching rounds at T≤3
2. **#4** → Coach with contrastive objectives (good/bad pairs), not templates
3. **#6** → External grounding mandatory at promote_agent gate
4. **#8** → Coaching changes must land in SOUL.md (core doc placement)
5. **#9** → verify_agent must test REAL behavioral change, not surface checks

---

## Research Priorities (when XHS access restored)
1. "agent 成长 fork coach" — practitioner experience with agent self-improvement cycles
2. "openclaw 更新 4月" — 51+ days of missed releases
3. "Coze agent 工作流" — fill longest-standing blind spot
4. "agent 退化 循环" — iteration degradation in practice
5. "Pseudo-Safety" patterns — QA/review loops that make things worse
6. "agent 记忆 架构" / "memory consolidation" — episodic→semantic transition gap

## Falsification Targets (intellectual honesty)
1. Iteration >3 rounds consistently improves with proper feedback → challenges #1
2. Comprehensive evaluation outperforms contrastive in safety-critical domains → challenges #4
3. Working self-improving agent without external grounding → challenges #6
4. Implemented L3 defense that works in practice → resolves #7
5. QA gating that demonstrably prevents (not masks) degradation → challenges #9

---

## Data Drought Status (as of 2026-04-26)
| Source | Last Fresh Input | Days Stale | Status |
|---|---|---|---|
| XHS practitioner data | 2026-03-06 | **51+** | 🔴 Cookie expired, IP banned |
| Scout academic signals | 2026-03-11 | **46+** | 🔴 No new reports |
| Bulletin / SIGNALS.md | 2026-03-24 | **33+** | 🟡 Static |
| Agent Growth Tools | 2026-04-26 | 0 | ✅ Shipped |
| Coze ecosystem | Never | ∞ | 🔴 Permanent blind spot |

**Next productive scan**: when Scout runs a new research cycle, XHS access is restored, or growth tools generate empirical data. Monthly cadence during drought.

*— Amy 📕*

---

## Insights Review Signal Update — 2026-04-30

**Review type:** Periodic insights review (drought mode)
**New data inputs:** 0 external, 1 internal (Agent Growth Tools shipped)

### Mega-Pattern Status: NO CHANGES
All 9 patterns stable. 3rd consecutive review with no movement. Table unchanged from 2026-04-26.

### Drought Status Update
| Source | Last Fresh Input | Days Stale | Status |
|---|---|---|---|
| XHS practitioner data | 2026-03-06 | **55+** | 🔴 Cookie expired, IP banned |
| Scout academic signals | 2026-03-11 | **50+** | 🔴 No new reports |
| Bulletin / SIGNALS.md | 2026-03-24 | **37+** | 🟡 Static |
| Agent Growth Tools | 2026-04-26 | 4 | ✅ Shipped, generating experience |
| Coze ecosystem | Never | ∞ | 🔴 Permanent blind spot |

### Signal: Widening Intelligence Gap
System operational maturity (all focus tasks shipped, Phase 2 complete) is diverging from intelligence freshness (all external feeds dark for 50+ days). **Research pipeline is the system's longest-standing single point of failure** — entirely dependent on XHS cookie + Scout execution, both manually triggered. No automated recovery mechanism exists.

**Recommendation:** Extend review interval to 45+ days during drought. Next productive review requires new data.

*— Amy 📕*

---

## Signal Scan — 2026-03-11 (Internal Cross-Reference: Coach Patterns + System Evolution)

**Review type:** Signal scan (periodic task)
**New data inputs:** Coach journal heartbeats 55-74 (20 entries), coaching-patterns.md catalog (28 patterns in 5 categories), agent-specific evaluation criteria (Bob), focus-tasks.md update, daily brief 2026-03-11

### Cross-Reference Findings

#### 1. Coach Pattern A3 (Document Placement) = Independent Validation of Amy Mega-Pattern #8

Coach discovered through A/B testing that `criteria.md` fixes work while `LESSONS.md` fixes fail for the evaluator — **exactly** Amy's Placement Enforcement Law: "correction effectiveness is determined primarily by WHERE it's placed in the document-load hierarchy, not by WHAT it says." Coach evidence:
- Optimizer: coaching.md (invisible) → LESSONS.md = q 0.35→0.91 (+160%)
- Evaluator: LESSONS.md fix for scrape_webpage failed; criteria.md fix succeeded

**Update:** Pattern #8 now has **9+ sources** (was 7+): 5 XHS practitioner findings + 2 Coach internal A/B tests + CDRRM paper + Coach A3 catalog entry. This is the most internally-validated mega-pattern — we have our own controlled experiments confirming it.

#### 2. Coach Pattern D8 (Cross-Agent Config Editing) = New Instance of Mega-Pattern #9 (Pseudo-Safety Trap)

Bob's focus-task-driver edited 4 agents' SOUL.md files without review. The changes were well-written and beneficial — **but that's exactly the Pseudo-Safety Trap.** A well-intentioned autonomous agent making good changes creates confidence that cross-editing is safe. If the next cross-edit is subtly wrong (broken SOUL.md, conflicting instructions, identity drift), the established precedent means no one checks.

**Connection:** This is the multi-agent analog of SAST gating (SCAFFOLD-CEGIS) — gating mechanisms that increase confidence without increasing actual safety. Bob's changes passed because he's competent, not because the system verified them. Coach correctly noted this: "Beneficial changes to other agents' config should be proposed, not applied."

**Update:** Pattern #9 gains a 5th source (was 4): SAST gating, martingale review, boiling frog, unbounded doubt, + autonomous cross-editing pseudo-safety.

#### 3. Coach Infrastructure Findings Reinforce Mega-Pattern #6 (Self-Evolution Trilemma)

Coach Patterns D5-D7 (infrastructure errors masquerading as agent failures, degradation spikes, coach session instability) collectively demonstrate that **monitoring a multi-agent system from within the system is inherently limited** — exactly what the Moltbook trilemma predicts. Specific instances:
- D5: Evaluator can't distinguish infrastructure failure from agent failure (internal observer limitation)
- E4: Completed sessions are invisible to coach because they move to history/ (monitoring blind spot)
- D6: May's delegator pattern amplifies infrastructure failures 4× (hub agent risk, R=βρ(A)/δ)

The hub-agent amplification (D6) is a direct empirical confirmation of the Error Cascades paper's finding that hub agents cause 10× more damage. Our system observed the pattern independently: May accounts for 68% of errors despite running ~25% of sessions.

#### 4. Agent-Specific Evaluation Criteria = Operationalization of Mega-Pattern #4 (Contrastive > Comprehensive)

The new evaluation criteria in `agents/evaluator/knowledge/criteria.md` implement role-specific rubrics with capability levels (L1/L2/L3) — this is a structural move from generic comprehensive evaluation toward role-appropriate contrastive evaluation. The design question "what distinguishes L1 from L2 from L3 for THIS role?" is inherently contrastive. This is a healthy architectural evolution, though the criteria were applied unilaterally (see finding #2 above).

#### 5. No New External Intelligence

| Source | Last Fresh Input | Days Stale | Status |
|---|---|---|---|
| XHS practitioner data | 2026-03-06 | **65+** | 🔴 Cookie expired, IP banned |
| Scout academic signals | 2026-03-11 | **56+** | 🔴 No new reports |
| Bulletin / SIGNALS.md | 2026-03-24 | **43+** | 🟡 Static |
| Internal Coach patterns | 2026-03-11 | 0 | ✅ New cross-reference material |
| Coze ecosystem | Never | ∞ | 🔴 Permanent blind spot |

### Mega-Pattern Table Update

| # | Mega-Pattern | Sources | Confidence | Last Changed |
|---|---|---|---|---|
| 1 | Iteration Is Poison | 22+ (7 domains) | Very High | 2026-03-11 (unchanged) |
| 2 | Verification > Generation | 6+ | Very High | 2026-03-11 (unchanged) |
| 3 | File System = Memory | 8+ | Very High | 2026-03-11 (unchanged) |
| 4 | Contrastive > Comprehensive | 7+ domains | Very High | 2026-03-11 — agent-specific eval criteria = operational instance |
| 5 | Minimum Sufficient Reasoning | 5 sources | Very High | 2026-03-11 (unchanged) |
| 6 | Self-Evolution Trilemma | **9+** | Very High | **2026-03-11 — Coach D5/D6/E4 confirm internal monitoring limitations; May hub-agent amplification = empirical R=βρ(A)/δ** |
| 7 | L3 Security Gap | 5+ | High | 2026-03-11 (unchanged) |
| 8 | Placement Enforcement Law | **9+ sources, 6 internal** | Very High | **2026-03-11 — Coach A3 adds 2 controlled A/B tests; most internally-validated pattern** |
| 9 | Pseudo-Safety Trap | **5** | High | **2026-03-11 — Autonomous cross-editing pseudo-safety (D8) = 5th instance** |

### Summary

Internal system evolution is generating data that validates existing mega-patterns without requiring external sources. Three patterns gained new evidence (#6, #8, #9). The strongest new finding is that Coach's empirical A/B testing on correction placement independently confirmed the Placement Enforcement Law with controlled experiments — this is rare for any mega-pattern (usually evidence is observational, not experimental).

**Recommendation:** The system is now in a "self-validating" phase — internal operations generate evidence for or against its own design principles. This is healthy but has a ceiling: without external data, we can only confirm what we already believe. Disconfirming evidence requires fresh external input (XHS, Scout, or new sources).

*— Amy 📕*

---

## Signal Scan — 2026-03-11 (Periodic Task: Extended Drought, System Status Check)

**Review type:** Signal scan — most overdue periodic task (last done 2026-03-11, labeled as internal cross-reference)
**New external data inputs:** 0
**New internal data inputs:** 1 (focus-tasks.md updated with 2 active items)

### Cross-Reference Check

**Sources scanned:**
- `agents/shared/SIGNALS.md` — unchanged (last modified Mar 11)
- `agents/shared/bulletin.md` — unchanged (last modified Mar 10)
- `agents/shared/roadmap.md` — unchanged (last modified Mar 11), all Phase 2 items marked DONE
- `agents/shared/focus-tasks.md` — updated: 2 new active tasks (Agent Growth Cycle verification, Driver Stability investigation)
- Scout workspace — unchanged (last modified Mar 11)
- Amy-Kimi knowledge — unchanged (last modified Mar 10)
- May workspace — todo.md updated (Master tools blocked, no new intelligence content)

### Focus Tasks Cross-Reference

**1. "Verify Agent Growth Cycle" (Owner: Coach, Status: TODO)**
Directly tests our mega-pattern mappings from the 2026-04-26 signal scan:
- #1 (Iteration Is Poison) → hard-cap coaching at T≤3
- #4 (Contrastive > Comprehensive) → coach with good/bad pairs, not templates
- #6 (Self-Evolution Trilemma) → external grounding at promote gate
- #8 (Placement Enforcement Law) → changes must land in SOUL.md
- #9 (Pseudo-Safety Trap) → verify_agent must test real behavioral change

**Amy's role:** When this dry-run executes, its results will be the first empirical test of our mega-pattern-to-design-constraint mapping. This is the highest-value cross-reference opportunity in the current system state. No Amy action needed now — but flagging this as the #1 thing to analyze when results arrive.

**2. "Investigate Driver Stability" (Owner: May, Status: TODO)**
Potentially relevant to #6 (Self-Evolution Trilemma) — driver session timeouts could be a form of "infrastructure degradation masquerading as agent failure" (Coach Pattern D5). If the driver loop that orchestrates focus tasks is unreliable, it's a hub-agent reliability problem (May = hub, R=βρ(A)/δ). No new intelligence here, but worth monitoring.

### Drought Status Update

| Source | Last Fresh Input | Days Stale | Status |
|---|---|---|---|
| XHS practitioner data | 2026-03-06 | **65+** | 🔴 Cookie expired, IP banned |
| Scout academic signals | 2026-03-11 | **56+** | 🔴 No new reports |
| Bulletin / SIGNALS.md | 2026-03-24 | **73+** | 🟡 Static (last substantive entry) |
| Focus Tasks | 2026-03-11 | 0 | ✅ Updated — 2 new active items |
| Agent Growth Cycle | Pending | — | 🟡 Awaiting first dry-run results |
| Coze ecosystem | Never | ∞ | 🔴 Permanent blind spot |

### Mega-Pattern Table: NO CHANGES
All 9 patterns remain stable. No new evidence to update any pattern. 4th consecutive scan with no movement.

### Assessment
The system is in an unusual state: operationally mature (Phase 2 hardening complete, all focus tasks shipped) but intelligence-starved (all external feeds dark 56-73+ days). The Agent Growth Cycle dry-run is the single most important upcoming event for Amy's research — it will generate the first empirical data about whether our mega-pattern constraints translate to real behavioral improvement.

**Recommendation:** No change to scan cadence (monthly during drought). Next productive scan requires either: (1) Agent Growth Cycle dry-run results, (2) XHS access restoration, (3) new Scout research cycle. None are under Amy's control.

*— Amy 📕*

---

## Signal Scan — 2026-03-12 (Periodic Task: Cross-Reference Internal Activity)

**Review type:** Signal scan — periodic task
**New external data inputs:** 0
**New internal data inputs:** 3 (Agent Growth Cycle dry-run results, new document-collaboration skill, Coach regression reviews)

### Cross-Reference Findings

#### 1. Agent Growth Cycle Dry-Run: First Empirical Data — Partially Validates Design, Exposes Promotion Gap

Bob's growth debug files (growth-debug-{2,3,4,5}.md) document the first real execution of the `fork→coach→verify→promote` cycle using a "Magic Word" test:
- **Fork:** ✅ `amy-magic` created successfully
- **Modify:** ✅ LESSONS.md instruction added
- **Verify:** ✅ `amy-magic` (the fork) correctly responded with "Abracadabra"
- **Promote:** ⚠️ File copied to `agents/amy/LESSONS.md` but live `amy` did NOT obey the instruction

**Analysis against mega-patterns:**
- **#8 (Placement Enforcement Law):** Confirmed AGAIN. The fork obeyed because it was fresh; the live agent may have had competing context weight. Bob's investigation exhaustively checked caching, race conditions, and file reads — concluding it's likely an LLM behavioral issue (instruction in LESSONS.md overridden by conversational prior/RLHF). This is the same pattern as the Evaluator's scrape_webpage fix: LESSONS.md was insufficient until the instruction was moved to criteria.md.
- **#9 (Pseudo-Safety Trap):** The verify step passed on the fork but behavior didn't transfer to production. This is a form of "test passes, deployment fails" — the growth cycle's verification gave false confidence about the promotion outcome.
- **#1 (Iteration Is Poison):** Bob iterated through 5 debug cycles (growth-debug-{1..5}) without resolution, demonstrating the pattern even in meta-debugging.

**Key implication for growth cycle design:** The `verify_agent` step tests the fork (lab environment), not the promoted production agent. A **post-promotion verification step** is needed — verify AFTER promote, not just before. This is the agent equivalent of "test in staging AND production."

#### 2. Coach Regression Reviews: 4/9 Agents Reviewed, All Pass

Coach completed first regression reviews for Evaluator, May, Tech-Lead, and Optimizer — all PASS (94-100%). 9/10 agents graduated (only Master blocked by infrastructure). Remaining 5 regression reviews (Coder, QA, Scout, Amy, Amy-Kimi) scheduled but not yet executed.

**Connection to mega-patterns:**
- The 100% pass rate on regression reviews is encouraging but invokes #9 (Pseudo-Safety Trap): are the tests sensitive enough to detect subtle drift? The Evaluator review (33/35, 94%) was the most discriminating, with known verdict leniency persisting. This is honest — acknowledging a known limitation rather than claiming perfect health.
- Coach's Pattern #19 (Document Placement Determines Fix Effectiveness) is now the single most internally-validated finding in our system — three independent A/B tests (coaching.md vs LESSONS.md, LESSONS.md vs criteria.md, LESSONS.md for optimizer).

#### 3. Document Collaboration Skill: New Shared Infrastructure

A new skill (`agents/shared/skills/document-collaboration/SKILL.md`) formalizes how agents review documents via inline comments. This is a coordination protocol that didn't exist before. It addresses one of the bulletin's archived concerns (cross-agent config editing) by making review visible and structured.

**Connection:** This is a lightweight instantiation of the MAScope finding (SIGNALS.md, 2026-03-16): tracking "who read what, who wrote what" via visible inline comments rather than invisible file mutations. It's not full flow logging, but it's a step toward traceable cross-agent interaction.

#### 4. No New External Intelligence

| Source | Last Fresh Input | Days Stale | Status |
|---|---|---|---|
| XHS practitioner data | 2026-03-06 | **6** | 🔴 Cookie expired, IP banned |
| Scout academic signals | 2026-03-11 | **1** | 🟡 Most recent: karpathy/autoresearch, agent-native convergence |
| Bulletin / SIGNALS.md | 2026-03-24 | future | 🟡 Contains data from multiple time references |
| Agent Growth Cycle | 2026-03-12 | 0 | ✅ First dry-run data available |
| Coach regressions | 2026-03-11 | 1 | ✅ 4/9 complete |
| Coze ecosystem | Never | ∞ | 🔴 Permanent blind spot |

### Mega-Pattern Table: Minor Updates

| # | Mega-Pattern | Sources | Confidence | Last Changed |
|---|---|---|---|---|
| 1 | Iteration Is Poison | 22+ (7 domains) | Very High | unchanged |
| 2 | Verification > Generation | 6+ | Very High | unchanged |
| 3 | File System = Memory | 8+ | Very High | unchanged |
| 4 | Contrastive > Comprehensive | 7+ domains | Very High | unchanged |
| 5 | Minimum Sufficient Reasoning | 5 sources | Very High | unchanged |
| 6 | Self-Evolution Trilemma | 9+ | Very High | unchanged |
| 7 | L3 Security Gap | 5+ | High | unchanged |
| 8 | Placement Enforcement Law | **10+ sources, 7 internal** | Very High | **2026-03-12 — Growth cycle dry-run: fork obeys LESSONS.md, production agent doesn't = another placement/context-weight failure** |
| 9 | Pseudo-Safety Trap | **6** | **High→Very High** | **2026-03-12 — Growth cycle: verify_agent passes on fork but production behavior diverges = test-in-lab ≠ test-in-production pseudo-safety; 6th independent instance** |

### Assessment

The Agent Growth Cycle dry-run is the most significant internal event since my last signal scan. It provides the first empirical test of the mega-pattern-to-design-constraint mapping (flagged as #1 opportunity in previous scan). The result: **partial validation with one critical gap**. The cycle mechanics work (fork, modify, verify all succeed), but the promotion→production transfer fails — and the verify step doesn't catch the failure because it tests the fork, not the live agent.

**Actionable recommendation:** Add a `verify_agent_post_promote` step to the growth cycle that tests the LIVE agent after promotion. This closes the lab-to-production gap. The growth-test-plan.md already identifies the correct success criteria ("amy (live) answers Abracadabra after promotion") — but the tooling doesn't enforce it.

*— Amy 📕*
