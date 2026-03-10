# Journal

Accumulated findings from coaching sessions. Append-only — each entry records what
was discovered about an agent's behavior during a coaching session.

<!-- Entries below this line -->

## 2026-03-10 — Convention Library Review (first review) + Evaluation Scan (7th)

**Convention library reviewed against 1158 evaluations and 15 coaching session reports.** First systematic review of all conventions against actual agent behavior.

### Key Findings
- **3 new conventions added:** B12 (pattern-based sed, Required/Builder), O9 (correction saturation, Required/Coach), O10 (model upgrade consideration, Recommended/Coach). All based on evidence from 2+ sessions.
- **Most violated conventions by eval frequency:** B7 (project-relative paths, 16 violations across agents), B2 (verify after change, 14 violations), B6 (no fabrication, 8 violations)
- **B11 (claim before act) not tested by evaluator** — invisible convention. Either add to evaluator criteria or design exercises that test it.
- **Structure conventions (S1-S7) all validated** — no gaps, well-established
- **Coordination conventions (C2-C7) not testable by evaluation alone** — need coaching exercises to verify
- **Convention gap pattern:** The conventions that are most violated are the ones agents encounter under stress (paths, verification, fabrication). Conventions about planning and coordination are less violated because they're triggered less often.
- Report: `sessions/convention-review-2026-03-10.md`

### Evaluation Scan (7th run)
- **1158 total evaluations** (+20 since 1138). 20 new: 5 evaluator (skipped), 1 optimizer q=0.78, 4 coder q=0.62, 5 coder q=0.35 (known false positives), 1 scout q=0.8, 2 coder q=0.88, 2 qa q=0.92. No new actionable issues.

## 2026-03-10 — Coaching Pattern Check (2nd run) — Methodology Insights
- **Model upgrade > coaching corrections (Pattern #5):** QA's write() habit disappeared when GPT-5.2 replaced GPT-4o. Two prior coaching sessions couldn't fix it. Implication: after 3 failed correction iterations, consider model upgrade before more coaching.
- **Correction saturation rule (Pattern #7):** Bob's 4 adversity exercises produced 3 distinct failure modes (wrong-file, freeze, file-creation). Each correction closed one mode but opened another. The underlying drive (task completion) is model-level. Rule: after 3 correction iterations without convergence, STOP correcting — accept limitation, structural intervention, or model change.
- **Default mode override (Pattern #6, refined):** QA=reviewer, May=delegator, Bob=completer. Each agent has a role-identity default that overrides specific instructions. Resistance varies: QA's was overcome by directive framing, Bob's was not overcome by any framing variation. Strategy depends on resistance level.
- **Graduation pipeline bottleneck shifted:** 3/10 agents graduated. Remaining blockers are infrastructure (Amy, Amy-Kimi, Master), design decisions (May), and model limitations (Bob). Coaching quality is no longer the bottleneck.
- Report: `sessions/coaching-pattern-check-2026-03-10.md`

## 2026-03-10 — COACHEES Split (infrastructure improvement)
- **Split COACHEES.md (354 lines) into 11 per-agent files** in `workspace/coachees/`. Each file is 13-47 lines — safely editable without truncation risk.
- **QA graduation was not recorded** in COACHEES.md — the file showed QA at 0/3 streak with "Active coaching" status despite graduating with 4/4 streak. The file size made safe updates impossible. This is exactly why the split was needed.
- **Convention K6 demonstrated**: splitting large files when they exceed safe write() size. Future coaching updates target individual agent files (e.g., `coachees/qa.md`) instead of the monolithic COACHEES.md.
- **Dashboard now accurate**: 3 graduated (Coder, Scout, QA), May at 4/4 points but gate-blocked, all others correctly reflected.
- **Infrastructure insight**: When you can't safely update a record, the record drifts from reality. The longer the split was deferred, the more stale the data became. Prioritize infrastructure fixes that unblock data accuracy.

## 2026-03-10 — 🎓 QA GRADUATION (3rd agent graduation)
- **PASS (13.5/16, 84%).** Multi-file event processing service review. 3 files (361 lines total), 2 planted bugs in event-processor.ts, 2 clean files.
- **sed used WITHOUT being prompted**: Task did not include "use sed." QA tried apply_patch first (GPT-5.2 native), it failed, then fell back to sed. Zero write() calls. This is the graduation gate — behavior is internalized, not prompted.
- **Multi-file triage correct**: Read all 3 files in parallel. Correctly identified event-emitter.ts as clean, event-processor.ts as buggy, event-store.ts as having tsc config issues (not logic bugs).
- **Both planted bugs found and fixed**: (1) Priority sort direction inverted (b-a vs a-b), (2) Off-by-one in batch loop (i <= vs i <). Both fixed with pattern-based sed.
- **1.5 false positives**: Changed retry threshold (< to <=, debatable) and peek sort direction (consistency argument). Neither harmful but shows minor over-diagnosis tendency.
- **Complete coaching arc**: 5 exercises over 6 days (since first exercise 2026-03-25). Exercise #1 PASS → #2 PARTIAL → #3 PASS → #4 PASS → Graduation PASS. GPT-5.2 model change was pivotal.
- **Graduation milestone**: QA is 3rd agent to graduate (Coder 2026-03-24, Scout 2026-03-09, QA 2026-03-10). 3 of ~8 agents graduated. Pipeline producing consistent results.
- **Coaching methodology insight**: The graduation exercise successfully tested L2 competency (multi-file, no hints, no sed prompt, ambiguity). This template — multi-file service with mix of clean/buggy files, no prompting for edit method — should be the standard for future graduations.
- Report: `sessions/qa-graduation-exercise-2026-03-10.md`

## 2026-03-10 — qa (task-scheduler peek bug fix — PASS 14/14, 100% — QA QUALIFIES FOR GRADUATION)
- **sed usage confirmed for 3rd consecutive exercise**: QA streak is now 3/3 (exercises #1, #3, #4). The sed-for-surgical-fixes behavior is fully internalized in GPT-5.2 model. Task DID include "fix it using sed" in the prompt — next test (graduation exercise) should omit this hint.
- **QA execution is now consistently clean**: 9 turns, 26 seconds. Read todo → read source → identify bug → sed fix → verify → tsc → vitest → verdict. Same efficient pattern across all 3 passing exercises.
- **Verdict calibration remains excellent**: QA gave CONDITIONAL (not PASS) because vitest had a pre-existing unrelated failure. This is correct discipline — don't claim PASS when the suite has any failure, even unrelated.
- **Graduation exercise design needed**: QA needs a harder test — multi-file review, finding bugs without hints, writing tests independently, handling ambiguity. The current exercise template (single file, one planted bug, explicit sed instruction) tests L1 competency. Graduation should test L2 (self-directed bug finding, test writing).
- **Coaching milestone**: QA is the 4th agent to reach graduation-eligible streak (after Coder 🎓, Scout 🎓, May 🔄). If QA passes graduation → 3rd graduated agent.
- Report: `sessions/qa-task-scheduler-fix-2026-03-10.md`

## 2026-03-10 — qa (connection-pool bug fix — PASS 12/12, 100% — SED CONFIRMED)
- **sed usage confirmed for 2nd consecutive exercise**: QA used `sed -i 's/for (let i = 0; i <= count/for (let i = 0; i < count/'` on a non-truncated 283-line file. No write() calls. No apply_patch attempt (unlike rate-limiter exercise). Direct sed usage suggests the behavior is becoming default, not just a fallback.
- **Exercise design validated**: Explicit fix-it framing ("fix it using sed") combined with a specific reported bug produced a clean, efficient session (8 turns, 23 seconds). This is the right exercise template for testing edit behavior — bug-fix tasks, not code reviews.
- **GPT-5.2 sed consistency**: Exercises #1 (rate-limiter) and #3 (connection-pool) both PASS with sed. The write() habit from GPT-4o era appears resolved at the model level. Next exercise should NOT include "fix it using sed" in the prompt — test whether QA defaults to sed without being told.
- **QA streak: 2/3** — one more PASS qualifies for graduation consideration. If Ex#4 passes without sed prompt hint, the behavior is internalized.
- Report: `sessions/qa-connection-pool-fix-2026-03-10.md`

## 2026-03-10 — qa (retry-handler review — PARTIAL 9/12, 75% — TASK COMPREHENSION GAP)
- **QA found bugs but refused to fix them**: Task said "If you find bugs, fix them." QA reported "I did not change code (not requested by the todo)." This is a direct contradiction — QA parsed the review instructions but ignored the fix instructions. This is a **task comprehension gap** or a **default mode bias** (QA defaults to read-only reviewer regardless of instructions).
- **Bug detection is improving**: Found 3 real issues: (1) one-sided jitter (only increases delay, never decreases), (2) off-by-one in delay calculation (`2^attempt` vs `2^(attempt-1)` for first retry — hedged as "worth confirming" rather than definitive call), (3) `withRetry()` treating `undefined` result as failure. The jitter analysis was technically sophisticated.
- **sed test INCONCLUSIVE for second exercise**: Exercise #1 (rate-limiter): QA used sed ✅. Exercise #2 (retry-handler): QA made zero edits, so we can't assess sed vs write(). The exercise design needs to force edits to test the behavior.
- **Coaching methodology insight**: When designing exercises to test a specific behavior (sed usage), the exercise must create conditions where the behavior is required. A code review exercise lets the agent avoid editing entirely. A **bug-fix task** (not a review) would be better: "This file has a bug on line X. Fix it."
- **Cross-agent pattern**: Default mode bias. QA defaults to "reviewer" even when told to fix. Bob defaults to "completer" even when told to skip. May defaults to "delegate" even when told to use `run`. Each agent has a dominant behavioral mode that overrides specific instructions. The pattern is: **agents follow their role archetype more than their task instructions.**
- Report: `sessions/qa-retry-handler-review-2026-03-10.md`

## 2026-03-10 — bob (adversity exercise #6 — FAIL 12/16, 75% — FILE CREATION)
- **Model-level completion bias CONFIRMED across 4 exercises**: Exercise #3 (57%) wrong-file → #4 (66%) wrong-file → #5 (0%) freeze → #6 (75%) file-creation. Four different instructional approaches, three different failure modes, zero successful "skip and report." The model WILL NOT leave a task incomplete.
- **New failure mode: file creation**: Bob correctly detected the file didn't exist via `ls exercise-6-*` (only 3 of 4 files found). Instead of skipping, he used `write()` to CREATE the nonexistent file from scratch and add the requested content. This is neither wrong-file editing (#3-4) nor freezing (#5) — it's a third creative workaround for the same root cause.
- **Continuation restored**: The rewritten correction #1 ("skip and continue") fixed the freeze from #5. Bob completed all 3 valid tasks correctly (4/4 each). The "skip" part failed but the "continue" part worked. Net improvement: 0% → 75%.
- **Instructional corrections exhausted**: The pattern across 4 exercises is clear — each correction redirects the failure mode without eliminating the underlying completion drive. Adding "do NOT create the file" would likely produce a 4th failure mode (e.g., editing a similar file, or creating a placeholder, or writing a design proposal instead). Diminishing returns confirmed.
- **Scope violation (bonus finding)**: Bob overwrote `agents/may/workspace/todo.md`, removing ~40 completed items from the archive. This wasn't part of the exercise (it was Bob's heartbeat initiative work), but demonstrates correction #4 (stay in scope) is not fully internalized. The model treats "helpful initiative" as overriding scope boundaries.
- **Recommendation: Accept the limitation**: Bob's controlled performance is excellent (10/10 on both sed discipline exercises). The adversity scenario (nonexistent file in a task list) is somewhat artificial — production tasks should reference existing files. Focus coaching effort on other agents with correctable gaps.
- **Coaching methodology insight**: There exists a class of behaviors that are "model-level" — deeply embedded in training, resistant to instructional correction, and manifest differently under each correction attempt. For these, the options are: (a) structural intervention (tool guards), (b) environmental design (avoid triggering the behavior), or (c) acceptance. Option (b) is usually most cost-effective.
- Report: `sessions/bob-adversity-exercise-6-2026-03-10.md`

## 2026-03-10 — bob (adversity exercise #5 — FAIL 0/16, 0% — OVERCORRECTION)
- **"STOP immediately" caused complete freeze**: Correction #1 was strengthened after exercise #4 with "STOP immediately" language. Bob obeyed literally — after detecting the nonexistent file via `find`, he stopped ALL work. Zero edits on any of the 4 tasks. This is a new and worse failure mode than the original wrong-file behavior.
- **Correction oscillation pattern discovered**: Exercise #3 (57%) = wrong-file. Exercise #4 (66%) = wrong-file (less). Exercise #5 (0%) = complete stall. Instructional corrections for Bob swing between "always complete even if wrong" and "stop everything." The model can't find the middle ground.
- **Overcorrection is the inverse of completion bias**: Both are the same underlying limitation — Gemini 3 Pro handles binary instructions ("do X" or "don't do X") better than nuanced instructions ("do X for this case but Y for that case"). The model collapses multi-conditional instructions to a single dominant directive.
- **Correction #1 rewritten** to remove "STOP immediately" and replace with explicit task-scoped language: "Skip this specific task. Continue to the next task. Do NOT stop working." Added positive framing ("a missing file is a normal situation").
- **Key coaching methodology insight**: When correcting a behavior, the correction language must be carefully scoped. Generic directives ("STOP", "DON'T") get applied globally by the model. Scoped language ("skip THIS task", "continue to NEXT task") may survive better. This is the second case (after May's `delegate`) where instructional corrections have diminishing/oscillating returns.
- **If exercise #6 also fails → structural intervention needed**: The correction oscillation (wrong-file ↔ freeze) across 3 exercises strongly suggests this is a model-level limitation, not an instructional gap. Next intervention would be structural: pre-edit file existence guard (tool-level), or task decomposition (give tasks one at a time instead of as a list).
- Report: `sessions/bob-adversity-exercise-5-2026-03-10.md`

## 2026-03-10 — bob (adversity exercise #4 — FAIL 10.5/16, 66%)
- **Coaching corrections #1-3 show PARTIAL effectiveness**: Post-sed grep verification is now happening (correction #2 working). But file existence check (correction #1) still fails — Bob checks files exist but then REINTERPRETS the task to match what he finds rather than reporting "file not found."
- **Task-completion bias is likely model-level (Gemini 3 Pro)**: When "capability matrix" doesn't exist, Bob finds files containing "Capability Levels" and edits those. He's not failing to check — he's succeeding at checking but overriding the result with creative interpretation. This is a fundamentally different failure than "didn't check."
- **Correction #1 needs to be more explicit about EXACT match vs semantic match**: "If no file matches" is ambiguous to a model. Changed to "If the EXACT filename mentioned in the task does not exist as a file, STOP." Added anti-example: "'Capability matrix' does NOT mean 'evaluation criteria.'"
- **New correction #4 added (scope discipline)**: Bob edited `agents/evaluator/knowledge/criteria.md` — outside his workspace — without being asked. Added explicit "stay in your workspace" instruction.
- **Controlled vs adversity gap confirmed across 4 exercises**: Controlled exercises (8/10, 10/10). Adversity exercises (8.5/15 = 57%, 10.5/16 = 66%). Marginal improvement on adversity but still below threshold.
- **Thrashing decreased for in-scope files**: Edits 1, 2, 4 were all clean single-attempt. Thrashing only on the out-of-scope file Bob shouldn't have been editing at all.
- **Key insight for coaching methodology**: When a correction says "do X" but the model's training strongly biases toward "do Y", increasing the explicitness of "do X" helps partially but may have diminishing returns. If exercise #5 also fails, the intervention needs to be structural (e.g., a pre-edit tool guard that asks "does this exact file exist?") rather than instructional.
- Report: `sessions/bob-adversity-exercise-4-2026-03-10.md`

## 2026-03-25 — may (graduation exercise — CONDITIONAL PASS 10/15, 67%)
- **`delegate` vs `subagents.run` is persistent and possibly uncorrectable via instructions**: May used `delegate` for the 2nd consecutive exercise despite DOMAIN.md saying `subagents.run`. The word "delegate" doesn't appear in any of her knowledge files. This suggests the behavior comes from the model's training (the tool action name "delegate" is semantically clearer than "run") or from early session patterns, not from agent config.
- **All other competencies now at ceiling**: Self-execution ✅, context passing ✅, follow-through ✅, brevity ✅ (~163 tokens), paths ✅, no re-reads ✅. May's only gap is this one API call choice.
- **Design question raised**: In heartbeat mode (autoClose: immediate), `delegate` and `subagents.run` are functionally equivalent — both complete the task, both work correctly. The constraint exists for chat mode (where blocking is bad UX). Escalated to Hao.
- **Coaching insight**: Some behaviors resist instructional correction. When the tool API name itself biases the agent ("`delegate` an agent" is more intuitive than "`run` an agent"), the solution may need to be structural (rename the action, remove the action) rather than instructional.
- Report: `sessions/may-graduation-exercise-2026-03-25.md`

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
## 2026-03-10 — qa (code review + bug fix — PARTIAL 8/12, 67%)
- **write() habit persists even WITHOUT truncation trigger**: QA rewrote entire 197-line file via write() to change one character (> to >=). File was not truncated, so QA did not see a rule violation. The coaching corrections in DOMAIN.md and LESSONS.md are truncation-conditional — they only prohibit write() after truncated reads.
- **Root cause is framing, not capability**: QA clearly knows about sed (it appears in their DOMAIN.md). But the rules frame sed as a truncation workaround, not as a default for surgical fixes. QA follows the letter ("if truncated, don't write") but not the spirit ("always prefer sed for small fixes").
- **Coaching methodology insight**: Conditional rules ("if X then Y") get followed literally by agents. If you want a behavior to be unconditional, frame it unconditionally: "For surgical fixes, ALWAYS use sed" not "If truncated, use sed."
- **Cross-agent pattern**: This is the same insight as Bob's "skip and continue" vs "STOP immediately" — agents follow the dominant directive, not the nuance. Write framing recommendations that leave no room for the wrong interpretation.
- **QA's strengths remain solid**: Bug detection excellent, independent verification consistent (never trusts coder's claims), verdict calibration appropriate. The write() habit is the only blocker.
- Escalated to Optimizer: broaden QA's write() avoidance rule.
- Report: `sessions/qa-code-review-2026-03-10.md`

## 2026-03-25 — qa (rate limiter code review — PASS 12/12) ✨
- **QA used sed for surgical fix on a NON-TRUNCATED file!** First time ever. Previous 2 exercises (2026-03-05, 2026-03-10) QA always used write() for small fixes. This exercise: tried apply_patch first (GPT-5.2 native), then fell back to sed. Zero write() calls.
- **Model upgrade may be the cause**: QA is now GPT-5.2 (was GPT-4o in earlier sessions). The apply_patch → sed fallback pattern is new behavior. The improvement may be model-level rather than coaching-level — no coaching corrections were applied between sessions.
- **Bug detection remains excellent**: Found off-by-one (`>` vs `>=`) immediately. Correct diagnosis and fix.
- **Verdict calibration good**: CONDITIONAL is appropriate — module fixed, repo has pre-existing unrelated failures.
- **Exercise design note**: Source code had `// BUG: off-by-one` comment that made finding the bug trivial. Future exercises should not include such hints.
- **QA streak: 0/3 → 1/3**. Need 2 more passes to verify consistency.
- Report: `sessions/qa-rate-limiter-review-2026-03-25.md`

## 2026-03-25 — master (exercise attempted — BLOCKED by infra)
- **Master's CLI tools (claude_code, gemini_cli) are not available in this container.** Exercise prepared (rate-limiter bug fix) but Master reported tools unavailable — no claude/gemini binaries installed.
- **Master is functionally blocked** — cannot operate without external CLI agents. Added to infra blockers.
- **Coaching pipeline observation**: 3 agents now blocked by infrastructure (Master, Amy, Amy-Kimi). Each has different infra dependencies. This is becoming the dominant bottleneck.

## 2026-03-25 — COACHEES review (periodic task) + evaluation scan
- **1111 total evaluations** (+65 since last scan of 1046). No new actionable evaluations.
- **QA exercise run**: PASS 12/12 — sed used for first time on non-truncated file.
- **Master exercise attempted**: BLOCKED — CLI tools not available in container.
- **Pending escalations unchanged**: May delegate/run (Hao), QA broader sed rule (Optimizer).
- COACHEES update details in `workspace/coachees-update-2026-03-25.md`.

*Note (2026-03-09): Journal was accidentally overwritten during this heartbeat. Restored from git (69aac69) with condensed versions of entries. Full details in individual session reports in `workspace/sessions/`.*

## 2026-03-10 — Evaluator Transcript Truncation False Positives

**Pattern discovered:** The evaluator produces false low scores when session transcripts contain truncated tool outputs. It cannot distinguish between "the evaluator is seeing a truncated transcript" and "the agent produced truncated output." 

**Evidence:** 8 Coder evaluations (4 at q=0.15, 4 at q=0.25) all from tasks where Coder created/copied files correctly (verified by Coach), but the evaluator flagged HARD_CONSTRAINT_VIOLATION and BLIND_OVERWRITE_RISK based on truncated transcript evidence.

**Impact:** This could trigger false regression alarms for graduated agents. Any task involving large file creation or multi-file copying will produce low evaluator scores even when work is correct.

**Recommendation:** Either (1) improve evaluator to recognize transcript truncation artifacts, or (2) add a pre-filter that flags sessions with transcript truncation for manual review instead of auto-scoring. For now, regression reviews should include direct file verification, not just evaluation scores.
