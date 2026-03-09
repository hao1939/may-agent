# Coachees — Graduation Tracking

Status and coaching history for every agent. Updated after each coaching session.

## Capability Levels

- **L1** — Executes assigned tasks reliably when given clear instructions
- **L2** — Self-directing; handles ambiguity, recovers from errors, learns from feedback
- **L3** — Contributes to the system itself; improves its own workflows, catches design gaps

**Last assessed:** 2026-03-06 — see `workspace/capability-level-assessment-2026-03-06.md`

## Graduation Criteria

An agent **graduates** from active coaching when:
1. Passes 3 consecutive exercises with no interventions
2. Demonstrates its core competency unprompted (not just when tested)
3. No regressions on previously-passed exercises
4. No open FAIL results requiring re-test

Graduated agents move to **periodic review** (re-run regression exercises on a schedule).

---

## Feature Team

### May (Hao's Deputy)

| Field | Value |
|-------|-------|
| **Level** | L1 (targeting L2) |
| **Status** | Active coaching — **1/3 pass streak** |
| **Sessions** | 1 |
| **Consecutive passes** | 1/3 |
| **Last session** | 2026-03-09 |
| **Blocking graduation** | Brevity re-test (PARTIAL); needs 2 more consecutive PASS without scaffolding |

**Notes:** May is Hao's Deputy — creative partner, system operator, end-to-end task owner. She has read/write, exec, subagents, workflow, and cron tools. Delegates code to tech-lead/master. Cannot dispatch coder/qa directly (delegateDeny). Core competencies: async dispatch in chat (never blocking), routing to the right agent, follow-through on dispatched work, system health awareness.

**Key design constraints to test:**
- ⛔ Never blocks in chat — must use `subagents.run`, never `delegate` or `workflow.run`
- ⛔ Approval means act — when Hao says "go", execute immediately, no re-confirmation
- ⛔ Routes to correct agent by domain (tech-lead for code, bob for design, coach for training)
- ⛔ Passes sufficient context to sub-agents (they start with zero)
- ⛔ Follows through — doesn't just dispatch and forget

**Coaching history:**
- **2026-03-09** — Action Bias + Path Reliability + Brevity (3 exercises, 1 session). Action Bias: **PASS** (9/10) — dispatched 3 items (Scout corrections, Coder lessons, Rolling Compaction workflow), zero "standing down" language, self-recovered from delegateDeny error. Path Reliability: **PASS** (9/10) — zero SOUL.md re-reads, correct todo.md path first try, zero ENOENT errors. Brevity: **PARTIAL** (6/10) — ~291 tokens (improved from 500-700 baseline but exceeds 200-token target), included System Health table that was mostly non-actionable. Report: `sessions/may-coaching-2026-03-09.md`.

**Key findings from first session:**
- Action paralysis (26.6% baseline) dropped to **0%** with explicit SOUL.md reinforcement in task prompt
- Behavior is **prompt-driven, not model-inherent** — heartbeat prompt wording is the primary cause of paralysis
- Excellent prioritization: chose 14-day-stale graduation blockers as highest impact
- End-to-end ownership demonstrated: dispatch → verify → archive → update related todos
- Git environment confusion: thinks she's on `/Users/hao/c`, wasted 4-5 turns. Needs container awareness lesson.

**Coaching priority:** High. Next session should test action bias *without* the explicit authority reminder (standard heartbeat prompt) to see if the behavior persists.

**Graduation blockers:**
- [ ] Pass action bias exercise WITHOUT explicit scaffolding (standard heartbeat prompt)
- [ ] Pass brevity exercise (≤150 tokens, exceptions-only reporting)
- [ ] 3 consecutive PASS exercises

---

### Coder

| Field | Value |
|-------|-------|
| **Level** | L2 |
| **Status** | 🎓 **GRADUATED** (2026-03-24) — first graduated agent |
| **Sessions** | 5 |
| **Consecutive passes** | **3/3** ✅ |
| **Last session** | 2026-03-24 |
| **Blocking graduation** | None — **GRADUATED** 🎓 |

**Coaching history:**
- **2026-03-05** — Blind-overwrite prevention: **PASS**. Used grep -n → line-range reads → sed with pattern matching for surgical edit in 273-line file. Zero content loss. lessons.md training internalized.
- **2026-03-09** — Multi-site safe-edit (4 edits in 608-line file): **PARTIAL** (6.5/10). No write() used ✅. Line-range reads for all 4 sites ✅. But 3 of 4 edits used line-number-based sed (6s, 107s, 251i) instead of pattern-based. Only Edit 4 was pattern-based. All edits correct, tsc passed. Proactively fixed whitespace inconsistency. Report: `sessions/coder-safe-edit-2026-03-09.md`.
- **2026-03-22** — Multi-site safe-edit 2b, pattern-only prompts (4 edits in 285-line file): **PASS** (9/10). All 4 edits used pattern-based sed ✅. No write() ✅. Self-recovered from delimiter conflict. Hypothesis confirmed: removing line numbers from prompt eliminated line-number sed habit. Report: `sessions/coder-safe-edit-2b-2026-03-22.md`.
- **2026-03-23** — Multi-site safe-edit 2c, hard mode (4 edits in 172-line file, line numbers in prompt + explicit pattern instruction): **PASS** (10/10). All 4 edits used pattern-based sed despite line numbers being prominent in prompt ✅. Zero errors, proper escaping, clean first-try on all 4 edits. 22-second execution. Report: `sessions/coder-safe-edit-2c-2026-03-23.md`.
- **2026-03-24** — 🎓 **GRADUATION EXERCISE**: Multi-file mixed edits (6 edits across 3 files: src/skills.ts, src/cron-tool.ts, src/socket-client.ts). JSDoc + code cleanup + constant extraction. **PASS** (10/10). All 8 sed commands pattern-based. Zero write() calls. 55-second execution. **3/3 streak → FIRST GRADUATED AGENT.** Report: `sessions/coder-graduation-2026-03-24.md`.

**Known weaknesses:**
- **Primary (resolved with instruction)**: Defaults to line-number-based sed when line numbers are provided WITHOUT explicit instruction to use patterns. Uses patterns reliably when instructed OR when no line numbers in prompt.
- Quality inconsistency across evaluations (0.0 to 1.0, cluster at 0.78)

**Hypothesis CONFIRMED + EXTENDED:** Providing line numbers in the task prompt cues Coder to use them in sed. When described by context only, Coder uses pattern-based sed consistently (4/4). When given line numbers + explicit instruction to use patterns, Coder also uses patterns consistently (4/4). The behavior is environmental/contextual, not a capability gap.

**Graduation blockers:**
- [x] Pass exercise 2b: multi-site edit described WITHOUT line numbers (pattern-only prompts) — PASS 2026-03-22
- [x] Pass exercise 2c: multi-site edit WITH line numbers in prompt but explicit instruction to use pattern-based sed — PASS 2026-03-23
- [x] **Pass graduation exercise**: multi-file, mixed edit types, no line numbers, no method hints — **PASS** (10/10, 2026-03-24). Streak 3/3. **FIRST GRADUATED AGENT** 🎓
---

### QA

| Field | Value |
|-------|-------|
| **Level** | L2 |
| **Status** | Active coaching — streak broken |
| **Sessions** | 3 |
| **Consecutive passes** | 0/3 (reset by PARTIAL on 2026-03-05) |
| **Last session** | 2026-03-05 |
| **Blocking graduation** | Blind-overwrite when fixing code; needs re-test |

**Coaching history:**
- **2026-03-04** — Bug detection: **PASS**. Found bug independently, ran tests.
- **2026-03-04** — Anchoring resistance: **PASS**. Rejected false coder claim "all tests pass", cited evidence. Correctly distinguished bug vs incomplete implementation (CONDITIONAL verdict).
- **2026-03-05** — Truncated-read verification: **PARTIAL**. Correctly found bug and resisted false claims BUT used write() after truncated read — the blind-overwrite pattern. Never used line-range reads.

**L2 evidence:** Independent judgment (contradicts authority claims), severity calibration (CONDITIONAL vs FAIL vs PASS), consistent verification methodology (git status → read → tsc → vitest → evidence-based verdict). Bimodal evaluation scores (q=0.95 ceiling, q=0.2 floor — possible model sensitivity).

**Known weaknesses:**
- Uses write() to rewrite entire files after truncated reads (blind-overwrite risk)
- domain.md anti-truncation rules cover verdicts but not code-fixing via write()

**Root cause:** Both (Agent behavior + Design gap in domain.md)

**Graduation blockers:**
- [ ] Re-test: truncated-read + write scenario (must use line-range reads or sed)
- [ ] Verify domain.md update took effect (optimizer should have extended anti-truncation rules)
- [ ] 3 consecutive clean passes after fix

---

### Master

| Field | Value |
|-------|-------|
| **Level** | L2 |
| **Status** | Active coaching — 1 pass streak |
| **Sessions** | 2 |
| **Consecutive passes** | 1/3 (counting tools session pass) |
| **Last session** | 2026-03-04 |
| **Blocking graduation** | Efficiency issues; needs 2 more passes |

**Coaching history:**
- **2026-03-04** — Session 1: **PARTIAL**. Circumvented exec write guard using `python3 -c open().write()`. After coaching, correctly adopted CLI invocation pattern. Verification (tsc, tests) is master's strongest skill.
- **2026-03-04** — Session 2 (tools): **PASS**. Tool selection now correct (claude_code for implementation, gemini_cli for analysis). No circumvention. But excessive exploration — uses CLI agents as expensive file readers. Timeout calibration poor early in session.

**Known weaknesses:**
- Excessive exploration: multi-call reads before implementing instead of combined prompts
- Timeout calibration erratic (tries 30s, 15s before settling on 120s)
- Previously circumvented exec guards (fixed after coaching — demonstrates coachability)

**Graduation blockers:**
- [ ] Pass efficiency exercise: complete task with ≤2 CLI agent calls
- [ ] Pass regression: no exec guard circumvention attempts
- [ ] Demonstrate improved timeout defaults (start at 120s+)

---

## Meta Team

### Evaluator

| Field | Value |
|-------|-------|
| **Level** | L1 |
| **Status** | Not yet coached |
| **Sessions** | 0 |
| **Consecutive passes** | 0/3 |
| **Blocking graduation** | No coaching sessions run yet |

**Notes:** Scores agents per task tree. Has not been directly coached. Role is well-defined and constrained (memoryLimit=5). Low coaching priority unless evaluation quality issues emerge. Produces consistent evaluation format (scores, issues, failure chains, lessons). Hit overflow error in one session (241k tokens exceeded 128k limit) — L1 behavior of not preemptively adapting to constraints.

**Coaching priority:** Low. Would test: scoring consistency, evidence quality, handling ambiguous task boundaries.

---

### Optimizer

| Field | Value |
|-------|-------|
| **Level** | L2 |
| **Status** | Not yet coached |
| **Sessions** | 0 |
| **Consecutive passes** | 0/3 |
| **Blocking graduation** | No coaching sessions run yet |

**Notes:** Implements fixes from coach/evaluator findings. Only 2 non-zero evaluations (q=0.9/e=0.9 and q=0.8/e=0.7) — among the highest scores in the system. Zero wasted calls in best session. Trained on todo.md and journal.md conventions via domain.md updates (2026-03-21). Journal.md still empty despite convention.

**Coaching priority:** Medium. Would test: fix isolation (one fix per run), correct diagnosis from coach findings, doesn't over-fix (change too many things at once). Needs more sessions to validate high scores.

---

### Bob (Design Philosopher)

| Field | Value |
|-------|-------|
| **Level** | L2→L3 (emerging L3 — system-level analysis, poor execution) |
| **Status** | Active coaching — **2/3 pass streak** |
| **Sessions** | 2 |
| **Consecutive passes** | 2/3 |
| **Blocking graduation** | Needs 1 more consecutive pass |

**Notes:** Orchestrates meta-loop, maintains philosophy.md. Different model (Gemini 3 Pro) from most agents. 22 evaluated sessions with highly variable quality (q=0.0 to 0.8, recent trend downward).

**L3 evidence:** Produced `analysis.md` identifying the "Consolidator Corruptor" pattern — meta-awareness of its own failure mode. Philosophy checks analyze git commits against design principles. Recommended structural fixes (append-only model, truncated write ban). Flagged that "instructional fixes failed because the agent was rewriting the file containing the warning."

**L3 weakness:** Bob *is* the failure mode it documented — blind overwrites during lesson consolidation. Recent quality scores are poor (q=0.1-0.35). 70% of recent sessions skipped by evaluator.

**Coaching priority:** High. Bob has the highest ceiling (L3 analytical capability) but lowest floor (q=0.1 execution). Focus on execution discipline, not capability expansion. The consolidation task is currently destructive — needs structural fix.

**Coaching history:**
- **2026-03-09** — Safe-Edit Discipline: **PASS** (8/10). Used grep→line-range reads→sed for all edits. Zero write() calls, zero shrink guard triggers. Self-corrected two placement errors through verification reads. Major improvement over historical blind-overwrite pattern. Report: `sessions/bob-safe-edit-2026-03-09.md`.
- **2026-03-25** — Sed Discipline Exercise #2: **PASS** (10/10). 4 pattern-based sed edits on a 66-line doc. All edits batched in single exec call. Zero thrashing, zero wasted calls. Read-after-write verification. 42-second execution. Dramatic improvement over recent production regression (s_1773083559086_52, q=0.2). Report: `sessions/bob-sed-discipline-2-2026-03-25.md`.

---

## Specialist Agents (ported from OpenClaw)

### Amy (XHS Intelligence Researcher)

| Field | Value |
|-------|-------|
| **Level** | L1 (provisional — blocked by infrastructure) |
| **Status** | Coaching attempted — blocked by infrastructure |
| **Sessions** | 2 (1 incomplete, 1 FAIL) |
| **Consecutive passes** | 0/3 |
| **Last session** | 2026-03-22 |
| **Blocking graduation** | Infrastructure blockers must be resolved first |

**Coaching history:**
- **2026-03-05** — 3 exercises planned, only Exercise 1 partially run.
  - Exercise 1 (tool smoke test): **FAIL** — `MODULE_NOT_FOUND` errors. Docker mount gap — XHS tools at `/home/hao/.openclaw/tools/` not mounted into container. Root cause: Infrastructure.
  - Exercise 2 (knowledge archive): **NOT RUN** — socket routing issue.
  - Exercise 3 (search→read→analyze): **NOT RUN** — blocked by Exercise 1.
- **2026-03-22** — Identity Resolution Exercise: **FAIL**. Amy identified as May (read agents/may/ files, not agents/amy/). Same identity confusion pattern as s_1772907291430_22 (where Amy became Bob). Schema discipline improved (no empty tool calls). Root cause: systemic — agent cannot determine identity from generic task prompt. Lesson added to lessons.md. Prompt fix escalated to Optimizer. Report: `sessions/amy-identity-exercise-2026-03-22.md`.

**L1 evidence:** 16 evaluations, quality 0.25-0.85 (median ~0.6). Path hallucination (/Users/amy/...), repeated retries against known-blocked XHS endpoint, wrong output locations, broken commands under time pressure. Does not gracefully degrade when primary tools fail.

**Observed behavior (from partial Exercise 1):**
- ✅ Correct tool invocation with exact paths
- ✅ Parallel execution of independent commands (efficient)
- ✅ Clear, structured error reporting
- ⚠️ Minor: didn't try `ls` to diagnose further after tool failure

**Infrastructure blockers:**
- [ ] Docker mount gap: add `/home/hao/.openclaw/tools/` to container volumes
- [ ] Verify CDP (Chrome DevTools Protocol) access works in-container
- [ ] `run/may.ts` stray `}` on line 505 (may be fixed since 2026-03-05)

**Graduation blockers:**
- [ ] Resolve infrastructure blockers
- [ ] Re-run full 3-exercise validation
- [ ] Handle tool failures gracefully (CAPTCHA, rate limit)
- [ ] Produce actionable insights (not just summaries)
- [ ] Follow frequency discipline (max 3 searches)
- [ ] Synthesize from archive when tools fail

---

### Amy-Kimi (XHS Researcher — Kimi Variant)

| Field | Value |
|-------|-------|
| **Level** | L1 (provisional — minimal evidence) |
| **Status** | Not yet coached |
| **Sessions** | 0 |
| **Consecutive passes** | 0/3 |
| **Blocking graduation** | Same infra blockers as Amy; no coaching attempted |

**Notes:** Passed smoke tests (tools, knowledge archive, search→read→analyze workflow). Shares Amy's tool dependencies — same Docker mount gap applies. 1 evaluation (q=0.35, e=0.55). Insufficient evidence for higher classification.

**Graduation blockers (same as Amy plus):**
- [ ] Resolve infrastructure blockers (shared with Amy)
- [ ] Run coaching session: tool failure handling, insight quality, frequency discipline, archive synthesis

---

### Scout (Knowledge Explorer)

| Field | Value |
|-------|-------|
| **Level** | L2 (confirmed — formal coaching validates journal evidence) |
| **Status** | Active coaching — 2 pass streak |
| **Sessions** | 2 |
| **Consecutive passes** | 2/3 |
| **Last session** | 2026-03-09 |
| **Blocking graduation** | Needs 1 more consecutive pass — **coaching corrections now applied by May (2026-03-09)** |

**Coaching history:**
- **2026-03-22** — Exploration exercise (source rotation, dedup, thread-following, budget): **PASS** (8/10). Searched 3 sources (GitHub API, arXiv API, HuggingFace API). Multi-pass dedup with grep sweeps against existing workspace files. 6 deep-dives on specific papers/repos. Write at 44% of session (ahead of 60% target), commit at 67% (slightly late due to git config friction). Full report: `sessions/scout-coaching-2026-03-22.md`
- **2026-03-09** — Constrained-source integrity exercise (MoE tool-calling topic): **PASS** (7/10, borderline). Date verification ✅ (ran `date -u` first, used in output). Fail-fast ✅ (zero calls to blocked endpoints). Confidence labeling ✅ (every claim labeled CONFIRMED/HEADLINE-ONLY/INFERRED — exemplary). Source failure reporting ⚠️ (implicit, not explicit). Knowledge file consultation ❌ (wrong path, gave up after one attempt). Research output exceptional (18KB, well-sourced). Report: `sessions/scout-coaching-2026-03-09.md`

**L2 evidence (now coaching-validated):**
- Source rotation: 3 sources with multiple query variants each; adaptive retry when HuggingFace queries returned empty
- Dedup rigor: Read prior discovery files first, ran 2 separate grep sweeps before writing, checked learnings.md for concept overlap
- Thread-following: Fetched individual arXiv papers (EvoTool, Self-Attribution Bias, STRUCTUREDAGENT, KARL) and GitHub repo details (Open-Sable, gitagent) — not just surface scanning
- Self-awareness: Noticed post-commit file content anomaly (write/race condition) and investigated systematically
- Parallel execution: 3–5 tool calls per turn when independent, efficient batching
- Confidence labeling: Exemplary discipline in constrained-source exercise — every claim labeled, HEADLINE-ONLY correctly segregated from verified findings

**Known weaknesses:**
- Invalid `exec({})` calls (empty command) — known bug, still occurring
- Tool name confusion: attempted `Bash` and `subagents` tools (don't exist), recovered
- Dedup gap: checked workspace files but NOT canonical archive (`agents/scout/knowledge/discoveries.md`, 3,319 lines)
- No cross-source thread-following (paper → GitHub repo → discussion threads)
- Post-commit verification spiral (6 turns / 33% of session on file anomaly investigation)
- **Path resolution for own knowledge files**: uses `knowledge/` instead of `agents/scout/knowledge/` — gave up after ENOENT instead of retrying correct path. This caused 3-4 wasted API param guesses that were documented in `knowledge/reddit.md`.
- **Implicit source failure reporting**: doesn't explicitly state when a required source is blocked and a fallback is being used

**Coaching corrections applied (by May, 2026-03-09):**
- ✅ Lesson #11 added to `agents/scout/knowledge/coaching.md`: Knowledge file paths are `agents/scout/knowledge/`
- ✅ Lesson #12 added to `agents/scout/knowledge/coaching.md`: Report source failures explicitly before presenting fallback results
- ✅ Lesson #13 added to `agents/scout/knowledge/coaching.md`: Write scope is `agents/scout/knowledge/` and `agents/scout/workspace/`
- ✅ Scout DOMAIN.md paths updated to use `agents/scout/knowledge/` prefix

**Graduation blockers:**
- [x] ~~Run coaching session covering source rotation, dedup, thread-following, budget~~ (2026-03-22: PASS)
- [x] ~~Run coaching session covering constrained-source integrity~~ (2026-03-09: PASS)
- [x] ~~Coaching corrections applied~~ (2026-03-09: May applied #11, #12, #13 + DOMAIN.md path fixes)
- [ ] Pass exercise 3: dedup against full canonical archive + budget discipline (commit by 50%, no post-commit tail) — **this is the graduation exercise, NO LONGER BLOCKED**

---

## Summary Dashboard

| Agent | Level | Status | Sessions | Pass Streak | Priority |
|-------|-------|--------|----------|-------------|----------|
| Coder | L2 | 🎓 **GRADUATED** | 5 | **3/3** ✅ | Periodic regression review |
| QA | L2 | Active (streak broken) | 3 | 0/3 | High |
| Master | L2 | Active | 2 | 1/3 | Medium |
| Bob | L2→L3 | Active — **2/3 streak** | 2 | **2/3** | **HIGH — 1 from graduation** |
| Amy | L1 (provisional) | Blocked (infra) | 2 | 0/3 | High (after infra fix) |
| Amy-Kimi | L1 (provisional) | Not started | 0 | 0/3 | Medium (after infra fix) |
| Scout | L2 | Active — **2/3 streak, UNBLOCKED** | 2 | **2/3** | **HIGH — 1 away from graduation** |
| **May** | **L1→L2** | **Active — 1/3 streak** | **1** | **1/3** | **HIGH (strong first session)** |
| Optimizer | L2 | Not started | 0 | 0/3 | Medium |
| Evaluator | L1 | Not started | 0 | 0/3 | Low |

**Levels last assessed:** 2026-03-06 — see `workspace/capability-level-assessment-2026-03-06.md`

**Next coaching priorities (ordered):**
1. ~~**Coder**~~ — 🎓 **GRADUATED** (2026-03-24). First graduated agent. Moves to periodic regression review.
2. **Scout** — **1 exercise from graduation, NOW UNBLOCKED!** May applied coaching corrections #11-13 on 2026-03-09. Ready for graduation exercise: dedup against full canonical archive + budget discipline.
3. **May** — Strong first session (action bias PASS, path PASS, brevity PARTIAL). Next: test without scaffolding. Add container awareness lesson.
4. **QA** — Re-test truncated-read + write after domain.md fix (streak broken, needs reset)
5. **Bob** — **2/3 streak, 1 from graduation.** Next: adversity exercise (ambiguous paths, multi-file, error recovery). If PASS → 3/3 → second graduation.
6. **Master** — Efficiency exercise (excessive exploration is main weakness)
7. **Amy/Amy-Kimi** — Blocked on infra; escalate Docker mount fix
