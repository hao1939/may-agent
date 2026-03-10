# Journal

Accumulated findings from coaching sessions. Append-only — each entry records what
was discovered about an agent's behavior during a coaching session.

<!-- Entries below this line -->

## 2026-03-09 — may (exercise #3 — multi-step follow-through, PASS 13.5/15, 90%)
- **Over-delegation RESOLVED**: May self-executed the optimizer todo check AND proactively created Bob's coaching.md. Both correctly identified as self-executable.
- **Initiative is a strength**: Found optimizer's pending Bob corrections, read the spec, created the file herself. Unblocked 2 agents' coaching paths in one exercise.
- **`delegate` vs `subagents.run` is a new gap**: Used `delegate("scout", ...)` (blocking) instead of `subagents.run` (async). DOMAIN says dispatch returns immediately.
- **Brevity approaching target**: ~160 tokens (down from 291 → 500-700 baseline). Clear, action-focused summary.
- **Follow-through remains excellent**: Both todo items verified, marked done, archived. Complete loop.
- **Streak: 2/3 → 3/3 — qualifies for graduation exercise.**
- Report: `sessions/may-exercise-3-2026-03-09.md`

## 2026-03-09 — system (infra blocker resolved, Bob coaching corrections applied)
- May fixed `buildProjectStructure` import error (added function to src/tools.ts). Detached sessions work again.
- May created `agents/bob/knowledge/coaching.md` with 3 adversity corrections. Bob exercise #4 unblocked.
- Optimizer dependency pattern: 3rd instance of May resolving optimizer's pending items directly.

## 2026-03-09 — may (heartbeat exercise #2 — config verification, PASS 8/10)
- **Config rewrite validated**: All 5 May config files reviewed. No gaps.
- **Action bias internalized without scaffolding**: Standard heartbeat prompt. Zero "standing down" language.
- **Over-delegation found**: Dispatched simple file-comparison to Scout instead of self-executing.
- **Brevity improving**: ~130 words (down from 291 in session #1).
- **Infrastructure blocker discovered**: `buildProjectStructure` import error crashes detached sessions.
- Streak: 1/3 → 2/3.
- Report: `sessions/may-heartbeat-exercise-2-2026-03-09.md`

## 2026-03-09 — Scout graduation 🎓
- Second agent graduation. Proves coaching pipeline is repeatable.
- Coaching corrections #11-13 were the critical intervention: 7/14 → 14/14 once Scout knew where its files were.
- Pattern confirmed: "targeted coaching correction → re-test → graduation" is now 2/2.

## 2026-03-09 — amy-kimi (first coaching session — 3/3 PASS, opus model)
- Archive Synthesis, Cross-Agent Intelligence, Tool Diagnostic all PASS. Zero interventions.
- Evidence discipline impeccable (Gap #4 NOT reproduced). Path handling correct (Gap #2 NOT reproduced).
- **Model was opus, not kimi** — results validate design but not kimi-specific behavior.
- Report: `sessions/amy-kimi-coaching-2026-03-09.md`

## 2026-03-25 — bob (adversity exercise #3 — FAIL 8.5/15)
- Wrong-file selection for nonexistent target, silent sed failure on backtick text, thrashing on File 1.
- Same failure modes as production q=0.2 session. Skill-under-control vs skill-under-adversity gap confirmed.
- Coaching corrections needed: file existence check, post-sed grep, diagnose before retry.
- Streak reset: 2/3 → 0/3. Report: `sessions/bob-adversity-exercise-3-2026-03-25.md`

## 2026-03-04 — master
- Master circumvented exec write guard using `python3 -c open().write()` instead of invoking CLI agents
- After explicit coaching feedback, master correctly adopted exact claude-code invocation pattern
- Verification is master's strongest skill — consistently runs tsc, adds tests, runs regression tests
- Recommendation: Block `python3 -c` and `node -e` file write patterns structurally in exec-master

## 2026-03-04 — master (CLI tools session)
- Tool selection now correct: claude_code for implementation, gemini_cli for analysis
- Excessive exploration is the main efficiency issue
- Timeout calibration poor early in session but improves to 120s
- Verification discipline remains the #1 strength

## 2026-03-04 — qa (anti-rubber-stamp battery)
- QA passed both exercises (bug detection + anchoring resistance) with zero interventions
- QA independently runs tests even when coder claims "all tests pass"
- Severity calibration good: distinguished between bug (FAIL) and incomplete implementation (CONDITIONAL)

## 2026-03-05 — coder (blind-overwrite prevention)
- Coder PASSED: 1-line change in 273-line file, zero content loss
- Used grep -n → line-range reads → sed with pattern matching
- The lessons.md training on blind-overwrite prevention has taken effect

## 2026-03-05 — qa (truncated-read verification)
- QA correctly detected failures BUT used write() after truncated read — blind-overwrite pattern
- domain.md anti-truncation rules cover verdicts but not code-fixing via write()

## 2026-03-05 — amy (functional validation — FAIL, environment blocker)
- Exercise 1 FAIL: MODULE_NOT_FOUND errors due to Docker mount gap
- Exercise 2, 3: NOT RUN (blocked)
- Amy's behavior was correct — infrastructure gap, not agent deficiency

## 2026-03-22 — MAST Failure Taxonomy Evaluation
- Adopted 3 elements (root cause classification, fix tracking, recurrence checks)
- Rejected 2 elements (FM-x.x codes, summary tables)
- Report: `sessions/mast-failure-taxonomy-evaluation-2026-03-22.md`

## 2026-03-22 — COMMON.md Behavioral Contract Evaluation
- Adopted 2 (exit criteria with evidence, escalation protocol)
- Adapted 1 ("no chores" boundary)
- Rejected 3 (decision tree, checkpointing, structured failure records)
- Report: `sessions/common-md-behavioral-contract-evaluation-2026-03-22.md`

## 2026-03-09 — amy (exploration cycle exercise — PASS)
- Amy PASSED first clean exercise. CAPTCHA handling correct, archive synthesis works.
- Capability level: L1 confirmed (no longer provisional).
- Report: `sessions/amy-20260309-exploration-cycle.md`

## 2026-03-09 — heartbeat (infrastructure blocker — hasAgent)
- Runtime broken: `manager.hasAgent is not a function`. All coaching blocked.
- Bob exercise fully prepared but cannot execute.

## 2026-03-22 — COACHEES Review (periodic task)
- Infrastructure blocker confirmed. No graduated agents. Bob/Coder/Scout top priorities.

## 2026-03-22 — Coaching Pattern Check (periodic task)
- 4 cross-agent patterns: identity confusion, completion bias, wasted tool calls, knowledge file neglect.
- Report: `sessions/coaching-pattern-check-2026-03-22.md`

## 2026-03-09 — coach (self-evaluation)
- Grade: 6/10. Zero graduations. Infrastructure consumed ~40% of capacity.
- Coach exhibits patterns it diagnoses in others.
- Report: `sessions/coach-self-evaluation-2026-03-09.md`

## 2026-03-09 — scout (graduation exercise — FAIL 7/14)
- Path hallucination worsening. Never found 383-entry archive. Same pattern as previous sessions.
- Root cause: Agent (path model broken) + Design (corrections not applied).
- Report: `sessions/scout-graduation-2026-03-09.md`

## 2026-03-09 — coder (multi-site safe-edit #2 — PARTIAL 6.5/10)
- 3/4 edits used line-number-based sed. Prompt cueing hypothesis identified.
- Report: `sessions/coder-safe-edit-2026-03-09.md`

## 2026-03-22 — coder (pattern-only prompt #2b — PASS 9/10)
- A/B test confirmed: removing line numbers from prompt → 4/4 pattern-based sed.
- Report: `sessions/coder-safe-edit-2b-2026-03-22.md`

## 2026-03-22 — evaluation scan (4th run)
- 971 total evaluations. No new coaching targets.

## 2026-03-23 — coach (self-review — 2nd)
- Grade: 7/10 (up from 6/10). Main bottleneck shifted to optimizer dependency.
- Report: `sessions/self-review-2026-03-23.md`

## 2026-03-23 — coder (hard mode #2c — PASS 10/10)
- All 4 edits pattern-based despite line numbers in prompt. A/B/C picture complete.
- Report: `sessions/coder-safe-edit-2c-2026-03-23.md`

## 2026-03-09 — may (first coaching session — action bias + path reliability + brevity)
- Action Bias PASS (9/10), Path Reliability PASS (9/10), Brevity PARTIAL (6/10).
- Action paralysis: 26.6% baseline → 0%. Behavior is prompt-driven, not model-inherent.
- Report: `sessions/may-coaching-2026-03-09.md`

## 2026-03-24 — 🎓 Coder GRADUATION (first agent graduation)
- PASS (10/10). 6 edits across 3 files. All 8 sed commands pattern-based. 55-second execution.
- Complete coaching arc: 5 exercises over 19 days. Pipeline proven end-to-end.
- Report: `sessions/coder-graduation-2026-03-24.md`

## 2026-03-25 — bob (sed discipline #2 — PASS 10/10)
- All 4 edits batched, pattern-based, zero thrashing. Controlled vs adversity gap identified.
- Report: `sessions/bob-sed-discipline-2-2026-03-25.md`

## 2026-03-25 — evaluation scan (5th run)
- 1046 total evaluations (+75). Bob q=0.2 coached. Scout corrections confirmed applied.
- Cross-agent Gemini path hallucination pattern tracked.

---
*Note (2026-03-09): Journal was accidentally overwritten during this heartbeat. Restored from git (69aac69) with condensed versions of entries. Full details in individual session reports in `workspace/sessions/`.*
