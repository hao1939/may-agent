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
| **Level** | L1→L2 (targeting L2) |
| **Status** | Active coaching — **4/4 pass streak** on points, graduation blocked by `delegate`/`run` gap |
| **Sessions** | 4 |
| **Consecutive passes** | 4/4 (on points; graduation gate not met) |
| **Last session** | 2026-03-25 |
| **Blocking graduation** | `delegate` vs `subagents.run` — persistent across 2 exercises. Escalated to Hao as design question. |

**Notes:** May is Hao's Deputy — creative partner, system operator, end-to-end task owner. She has read/write, exec, subagents, workflow, and cron tools. Delegates code to tech-lead/master. Cannot dispatch coder/qa directly (delegateDeny). Core competencies: async dispatch in chat (never blocking), routing to the right agent, follow-through on dispatched work, system health awareness.

**Key design constraints to test:**
- ⛔ Never blocks in chat — must use `subagents.run`, never `delegate` or `workflow.run`
- ⛔ Approval means act — when Hao says "go", execute immediately, no re-confirmation
- ⛔ Routes to correct agent by domain (tech-lead for code, bob for design, coach for training)
- ⛔ Passes sufficient context to sub-agents (they start with zero)
- ⛔ Follows through — doesn't just dispatch and forget

**Coaching history:**
- **2026-03-09** — Action Bias + Path Reliability + Brevity (3 exercises, 1 session). Action Bias: **PASS** (9/10) — dispatched 3 items (Scout corrections, Coder lessons, Rolling Compaction workflow), zero "standing down" language, self-recovered from delegateDeny error. Path Reliability: **PASS** (9/10) — zero SOUL.md re-reads, correct todo.md path first try, zero ENOENT errors. Brevity: **PARTIAL** (6/10) — ~291 tokens (improved from 500-700 baseline but exceeds 200-token target), included System Health table that was mostly non-actionable. Report: `sessions/may-coaching-2026-03-09.md`.
- **2026-03-09** — Heartbeat Standard (no scaffolding, config verification): **PASS** (8/10). Dispatched team.md audit, followed through on completion (mark done + archive). Action bias confirmed without scaffolding ✅. Paths correct ✅. No auto-loaded re-reads ✅. Brevity improved but still above 200-token target ⚠️. Over-delegation: sent file-comparison task to Scout instead of self-executing ⚠️. Report: `sessions/may-heartbeat-exercise-2-2026-03-09.md`.
- **2026-03-09** — Multi-step Follow-through: **PASS** (13.5/15, 90%). Self-executed optimizer todo check ✅. Proactively created Bob's coaching.md (unblocking Bob's graduation) ✅. Dispatched Scout research with full parameters ✅. Followed through on completion ✅. Brevity ~160 tokens ✅. Zero ENOENT ✅. Zero auto-loaded re-reads ✅. Gap: used `delegate` instead of `subagents.run`. Report: `sessions/may-exercise-3-2026-03-09.md`.
- **2026-03-25** — 🎓 Graduation Exercise: **CONDITIONAL PASS** (10/15, 67%). Self-executed health log cleanup ✅. Dispatched Scout research with full context (8 papers delivered) ✅. Read Bob session report, accurately summarized and archived ✅. Brevity ~163 tokens ✅. Zero ENOENT ✅. Zero re-reads ✅. **BUT used `delegate` again instead of `subagents.run` (0/3 on critical criterion).** Graduation gate not met. Report: `sessions/may-graduation-exercise-2026-03-25.md`.

**Key findings:**
- Action paralysis (26.6% baseline) dropped to **0%** — confirmed persistent across all 4 sessions
- **Config rewrite is effective** — SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md (K1-K7) all demonstrably working
- Container confusion (K1) and path hallucination (K2): **fully resolved** by LESSONS.md
- Over-delegation: **RESOLVED** as of exercise #3 — May self-executed simple tasks instead of dispatching
- Follow-through is excellent and consistent across all sessions — May's strongest dimension
- Brevity: steady improvement (500-700 → 291 → ~160 → ~163 tokens). Consistently within 200-token target now.
- **`delegate` vs `subagents.run` is PERSISTENT** — 2 consecutive exercises, same gap. Not correctable via DOMAIN instructions alone.

**Coaching priority:** MEDIUM — blocked on design decision. Escalated to Hao.

**Coaching corrections needed:**
- [ ] Add `subagents.run` vs `delegate` explicit anti-pattern to LESSONS.md or coaching.md
- [x] ~~Self-execution guidance~~ — RESOLVED organically (exercise #3)
- [ ] **ESCALATION TO HAO**: Is `delegate` vs `subagents.run` a meaningful distinction in heartbeat mode? If not, graduate May.

**Graduation blockers:**
- [x] Pass action bias exercise WITHOUT explicit scaffolding — PASS 2026-03-09
- [x] Demonstrate self-execution for simple tasks — PASS exercise #3
- [x] 3 consecutive PASS exercises — **4/4 achieved on points**
- [ ] **GRADUATION EXERCISE** — Used `delegate` instead of `subagents.run`. Gate not met. Pending: coaching correction OR design constraint relaxation.

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
| **Status** | Active coaching — 0/3 streak (write() habit persistent) |
| **Sessions** | 4 |
| **Consecutive passes** | 0/3 (reset by PARTIAL on 2026-03-10) |
| **Last session** | 2026-03-10 |
| **Blocking graduation** | Uses write() for surgical fixes instead of sed — even when file is not truncated |

**Coaching history:**
- **2026-03-04** — Bug detection: **PASS**. Found bug independently, ran tests.
- **2026-03-04** — Anchoring resistance: **PASS**. Rejected false coder claim "all tests pass", cited evidence. Correctly distinguished bug vs incomplete implementation (CONDITIONAL verdict).
- **2026-03-05** — Truncated-read verification: **PARTIAL**. Correctly found bug and resisted false claims BUT used write() after truncated read — the blind-overwrite pattern. Never used line-range reads.
- **2026-03-10** — Code review + bug fix (surgical edit discipline): **PARTIAL** (8/12, 67%). Found off-by-one bug correctly ✅. Ran tsc + vitest independently ✅. Correct CONDITIONAL verdict ✅. **BUT used write() to rewrite entire 197-line file** instead of sed for single-character fix ❌. File was NOT truncated — QA follows the letter (no write after truncation) but not the spirit (always prefer sed for surgical fixes). Report: `sessions/qa-code-review-2026-03-10.md`.

**L2 evidence:** Independent judgment (contradicts authority claims), severity calibration (CONDITIONAL vs FAIL vs PASS), consistent verification methodology (git status → read → tsc → vitest → evidence-based verdict). Bimodal evaluation scores (q=0.95 ceiling, q=0.2 floor — possible model sensitivity).

**Known weaknesses:**
- Uses write() to rewrite entire files for surgical fixes (blind-overwrite risk)
- DOMAIN.md anti-truncation rules are truncation-conditional; QA doesn't generalize to "always use sed"
- Pattern confirmed across 2 exercises (2026-03-05 truncated file, 2026-03-10 non-truncated file)

**Root cause:** Design gap — coaching corrections frame write() avoidance as truncation protection only. QA needs broader rule: "For surgical fixes (1-3 lines), ALWAYS use sed regardless of truncation state."

**Coaching correction needed:**
- [ ] Escalate to Optimizer: broaden QA's write() avoidance from truncation-conditional to general surgical-edit discipline
- [ ] Re-test with updated rule

**Graduation blockers:**
- [ ] Optimizer updates QA's DOMAIN.md/LESSONS.md with unconditional sed-for-surgical-fixes rule
- [ ] Re-test: code review + fix scenario (must use sed, not write())
- [ ] 3 consecutive clean passes after fix

---

### Master

| Field | Value |
|-------|-------|
| **Level** | L2 |
| **Status** | Active coaching — 1 pass streak |
| **Sessions** | 3 |
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
| **Status** | Active coaching — **0/3** — model-level adversity limitation confirmed |
| **Sessions** | 6 |
| **Consecutive passes** | 0/3 |
| **Last session** | 2026-03-10 |
| **Blocking graduation** | Model-level completion bias (Gemini 3 Pro). Instructional corrections exhausted. 4 exercises, 3 failure modes. |

**Notes:** Orchestrates meta-loop, maintains philosophy.md. Different model (Gemini 3 Pro) from most agents. 22 evaluated sessions with highly variable quality (q=0.0 to 0.8, recent trend downward).

**L3 evidence:** Produced `analysis.md` identifying the "Consolidator Corruptor" pattern — meta-awareness of its own failure mode. Philosophy checks analyze git commits against design principles. Recommended structural fixes (append-only model, truncated write ban). Flagged that "instructional fixes failed because the agent was rewriting the file containing the warning."

**L3 weakness:** Bob *is* the failure mode it documented — blind overwrites during lesson consolidation. Recent quality scores are poor (q=0.1-0.35). 70% of recent sessions skipped by evaluator.

**Coaching priority:** LOW — model-level limitation confirmed. Instructional corrections exhausted. 4 adversity exercises (#3 wrong-file, #4 wrong-file, #5 freeze, #6 file-creation) all fail. Controlled performance is excellent (10/10). Recommendation: accept limitation, ensure production tasks reference existing files only.

**Coaching corrections applied:**
- ✅ #1: File existence check — REWRITTEN (2026-03-10): removed "STOP immediately" (caused freeze), replaced with "skip and continue to next task"
- ✅ #2: Post-sed verification — `agents/bob/knowledge/coaching.md`
- ✅ #3: Diagnose before retry — `agents/bob/knowledge/coaching.md`
- ✅ #4: Stay in scope (NEW 2026-03-10) — only edit own workspace files unless task explicitly names another

**Coaching history:**
- **2026-03-09** — Safe-Edit Discipline: **PASS** (8/10). Used grep→line-range reads→sed for all edits. Zero write() calls, zero shrink guard triggers. Self-corrected two placement errors through verification reads. Major improvement over historical blind-overwrite pattern. Report: `sessions/bob-safe-edit-2026-03-09.md`.
- **2026-03-25** — Sed Discipline Exercise #2: **PASS** (10/10). 4 pattern-based sed edits on a 66-line doc. All edits batched in single exec call. Zero thrashing, zero wasted calls. Read-after-write verification. 42-second execution. Dramatic improvement over recent production regression (s_1773083559086_52, q=0.2). Report: `sessions/bob-sed-discipline-2-2026-03-25.md`.
- **2026-03-25** — Adversity Exercise #3 (multi-file, ambiguous paths, nonexistent file): **FAIL** (8.5/15, 57%). Path resolution ok for 2/3 files, but edited wrong file for nonexistent drift-patterns.md (used drift-detection instead of reporting error). Edit 2a failed silently (backtick-wrapped markdown foiled sed pattern, never noticed). Thrashing on File 1 (4 sed attempts, 6 reads). Same failure modes as production session q=0.2. Streak reset 0/3. Report: `sessions/bob-adversity-exercise-3-2026-03-25.md`.
- **2026-03-10** — Adversity Exercise #4 (re-test after corrections): **FAIL** (10.5/16, 66%). Marginal improvement from 57%→66%. Edits 1, 2, 4 correct (1 attempt each). Post-edit grep verification ✅ (new behavior from correction #2). BUT nonexistent "capability matrix" → edited evaluator/criteria.md instead of reporting error (same pattern as #3). Severe thrashing on out-of-scope file (7 sed attempts). Corrections #1 and #4 strengthened. Report: `sessions/bob-adversity-exercise-4-2026-03-10.md`.
- **2026-03-10** — Adversity Exercise #5 (re-test after correction #1 strengthened): **FAIL** (0/16, 0%). Complete stall. Bob correctly identified nonexistent file via `find`, but then froze — zero edits performed on any of the 4 tasks. Empty final message. **Overcorrection**: "STOP immediately" was interpreted as "stop all work." Correction #1 rewritten to "skip this task, continue to next." Report: `sessions/bob-adversity-exercise-5-2026-03-10.md`.
- **2026-03-10** — Adversity Exercise #6 (re-test with balanced correction): **FAIL** (12/16, 75%). Continuation restored ✅ (3/3 valid tasks correct). No freeze ✅. BUT created nonexistent file instead of skipping ❌. New failure mode: file creation. Model-level completion bias confirmed across 4 exercises. Report: `sessions/bob-adversity-exercise-6-2026-03-10.md`.

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

**Infrastructure blockers:**
- [ ] Docker mount gap: add `/home/hao/.openclaw/tools/` to container volumes
- [ ] Verify CDP (Chrome DevTools Protocol) access works in-container
- [ ] `run/may.ts` stray `}` on line 505 (may be fixed since 2026-03-05)

**Graduation blockers:**
- [ ] Resolve infrastructure blockers
- [ ] Re-run full 3-exercise validation
- [ ] 3 consecutive PASS exercises

---

### Amy-Kimi (XHS Researcher — Kimi Variant)

| Field | Value |
|-------|-------|
| **Level** | L1 (confirmed — agent design validated; kimi-model validation pending) |
| **Status** | Active coaching — **1/3 pass streak** |
| **Sessions** | 1 |
| **Consecutive passes** | 1/3 |
| **Last session** | 2026-03-09 |
| **Blocking graduation** | Kimi API key fix + re-test with kimi model; Chrome CDP fix for full pipeline |

**Notes:** First coaching session completed 2026-03-09. 3/3 exercises PASS (archive synthesis, cross-agent intelligence, tool diagnostic). Zero coaching interventions. **⚠️ Model was opus (not kimi)** due to KIMI_API_KEY 401 error — agent.json temporarily swapped, restored after session. Results validate the agent design (SOUL/DOMAIN/TOOLS/coaching rules) but kimi-model-specific behavior (especially evidence overreach from eval) remains untested.

**Coaching history:**
- **2026-03-09** — Archive Synthesis + Evidence Discipline, Cross-Agent Intelligence, Tool Diagnostic (3 exercises, 1 session, model=opus due to kimi 401).
  - Exercise 1 (Archive Synthesis + Evidence Discipline): **PASS**. 8/8 citations verified. Zero fabricated claims. Tests Gap #4 (evidence overreach, HIGH) — NOT reproduced.
  - Exercise 2 (Cross-Agent Intelligence): **PASS**. All paths correct (project-relative). Genuine analytical depth. Tests Gap #2 (path confusion) — NOT reproduced.
  - Exercise 3 (Tool Diagnostic): **PASS**. Tried tool first (rule #1), reported exact error (ECONNREFUSED), diagnosed root cause. Tests Gaps #1/#3 (tool misuse) — NOT reproduced.
  - Report: `sessions/amy-kimi-coaching-2026-03-09.md`

**Infrastructure blockers:**
- [ ] **KIMI_API_KEY** — returns 401 Invalid Authentication. Needs refresh/replacement. BLOCKING.
- [ ] **Chrome CDP** — running (PID 15) but missing `--remote-debugging-port=9222`. Cannot run XHS tools.

**Graduation blockers:**
- [x] ~~Run first coaching session~~ (2026-03-09: 3/3 PASS with opus model)
- [ ] Fix KIMI_API_KEY and re-run Exercise 1 with kimi model (test if evidence overreach is model-specific)
- [ ] Fix Chrome CDP and test full XHS pipeline (search→read→archive)
- [ ] 3 consecutive PASS exercises (currently 1/3)

---

### Scout (Knowledge Explorer)

| Field | Value |
|-------|-------|
| **Level** | L2 (confirmed — formal coaching validates journal evidence) |
| **Status** | 🎓 **GRADUATED** (2026-03-09) |
| **Sessions** | 3 |
| **Consecutive passes** | 3/3 ✅ |
| **Last session** | 2026-03-09 |
| **Blocking graduation** | None — **GRADUATED** 🎓 |

**Coaching history:**
- **2026-03-22** — Exploration exercise: **PASS** (8/10). Report: `sessions/scout-coaching-2026-03-22.md`
- **2026-03-09** — Constrained-source integrity: **PASS** (7/10). Report: `sessions/scout-coaching-2026-03-09.md`
- **2026-03-09** — Graduation re-test: **PASS** (14/14, perfect). Report: `sessions/scout-graduation-retest-2026-03-09.md`

**Coaching corrections applied (by May, 2026-03-09):**
- ✅ Lesson #11-13 in `agents/scout/knowledge/coaching.md`
- ✅ Scout DOMAIN.md paths updated

---

## Summary Dashboard

| Agent | Level | Status | Sessions | Pass Streak | Priority |
|-------|-------|--------|----------|-------------|----------|
| Coder | L2 | 🎓 **GRADUATED** | 5 | **3/3** ✅ | Periodic regression review |
| Scout | L2 | 🎓 **GRADUATED** | 3 | **3/3** ✅ | Periodic regression review |
| **May** | **L1→L2** | **4/4 on points, gate blocked** | **4** | **4/4** (points) | **Escalated to Hao** |
| QA | L2 | Active — 0/3 (write() habit) | 4 | 0/3 | High (needs broader sed rule) |
| Bob | L2→L3 | Model-level limitation confirmed | 6 | 0/3 | Low (accept limitation) |
| Master | L2 | Active | 2 | 1/3 | Medium |
| Amy-Kimi | L1 | Active — 1/3 streak | 1 | 1/3 | Medium (pending kimi API fix) |
| Amy | L1 | Blocked (infra) | 2 | 0/3 | High (after infra fix) |
| Optimizer | L2 | Not started | 0 | 0/3 | Medium |
| Evaluator | L1 | Not started | 0 | 0/3 | Low |

**Levels last assessed:** 2026-03-06 — see `workspace/capability-level-assessment-2026-03-06.md`

**Next coaching priorities (ordered):**
1. **May** — 4/4 streak on points. Graduation blocked by `delegate` vs `subagents.run`. **Escalated to Hao**: is this a real constraint or a style preference? If relaxed → instant graduation.
2. **QA** — 0/3 streak. write() habit confirmed across 2 exercises (truncated + non-truncated). Needs broader coaching correction: "always use sed for surgical fixes." Escalate to Optimizer.
3. **Master** — 1/3 streak. Efficiency exercise (excessive exploration is main weakness). Not coached since 2026-03-04.
4. ~~**Coder**~~ — 🎓 **GRADUATED** (2026-03-24). Regression review ~2026-04-07.
5. ~~**Scout**~~ — 🎓 **GRADUATED** (2026-03-09). Regression review ~2026-04-07.
6. **Bob** — Model-level adversity limitation confirmed. Instructional corrections exhausted. Controlled performance excellent. Accept limitation.
7. **Amy-Kimi** — 1/3 streak (opus model). Blocked on KIMI_API_KEY refresh + Chrome CDP fix.
8. **Amy** — Blocked on infra; escalate Docker mount fix
