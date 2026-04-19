# Operations Plan — Bringing the System to Stable State

## Status: Phase 3 Operational — Meta Loop Validated

## Premise

The agent system has all the pieces built: agents with roles, evaluator for
scoring, optimizer for improvements, coach for training, workflows for
repeatable tasks, cron for automation. But none of it has been validated
end-to-end under real load. We don't know what works, what's broken, or
what needs tuning.

**The goal is not automation yet. It's calibration.**

We run each piece manually, at full speed, in a tight feedback loop. Fix
what breaks. Tune what's off. Only automate once the pieces work reliably
on their own.

## Operating Model

### Two Loops

```
User Loop (real-time):
  User → May → delegate (role-based) → agent → result → May → user

Meta Loop (periodic, eventually cron-driven):
  Trigger → evaluate → analyze → improve → measure → repeat
```

### Delegation is Role-Based

Each agent has a defined role. Tasks go to the agent whose role matches,
regardless of score. Scores are a health metric — they tell us whether
an agent is meeting its bar, not whether to route around it.

| Agent | Role | Bar |
|-------|------|-----|
| coder | Implement code changes | Completes task, tests pass, no hallucinated paths |
| qa | Review code for correctness | Catches real bugs, low false-positive rate |
| master | Handle tasks coder can't | Frames problems well for CLI agents, delivers result |
| evaluator | Score sessions accurately | Scores correlate with actual quality |
| bob | Analyze patterns, maintain philosophy | Analysis leads to actionable improvements |
| optimizer | Implement structural fixes | Fix actually improves scores on next run |
| coach | Train underperforming agents | Coachee measurably improves after session |

### Scores are Thresholds, Not Routing

An agent's score tells us: is this agent doing its job? If below threshold,
the system improves the agent (via coaching, prompt tuning, structural
changes) until it meets the bar. We don't route around weak agents — we
fix them.

Thresholds (to be calibrated during Phase 1):
- `good`: efficiency >= 0.7, quality >= 0.7
- `acceptable`: efficiency >= 0.5, quality >= 0.5
- `needs_improvement`: below acceptable

### What Can Self-Improve (No Approval)

- `lessons.md` updates — appending learned lessons from evaluations
- Coaching sessions — coach trains underperforming agents
- Evaluation — scoring is measurement, always safe
- Cron interval tuning — adjusting frequency based on workload

### What Needs Human Approval

- Workflow changes (implement-and-review.ts, test-and-fix.ts)
- Agent role/domain changes (domain.md rewrites)
- New agents or removing agents
- Tool code changes
- Score threshold changes
- Any change to optimizer-design.md or this operations plan

The optimizer writes proposals to `agents/optimizer/workspace/pending-changes.md`.
May surfaces them to the user.

## Phase 1: Calibrate Each Agent ✅ Complete

Run each agent on a real task. Read the transcript. Identify the gap. Fix it.
Run again. Repeat until reliable.

### Order

1. **Coder** — most data (42 evals), core workhorse
   - Task: small code change (e.g., add a config option, fix a test)
   - Success: completes without path hallucination, tests pass, clean code
   - Current avg: efficiency 0.46, quality 0.56 — needs improvement

2. **QA** — reviews coder's output
   - Task: review coder's changes from step 1
   - Success: catches real issues, no false positives, PASS/FAIL is accurate
   - Current: insufficient standalone data

3. **implement-and-review workflow** — coder + QA as a pipeline
   - Task: same type of code change, run through workflow
   - Success: workflow completes, escalation logic works correctly
   - Validates: delegation, retry logic, QA feedback integration

4. **Evaluator** — scores the above sessions
   - Task: evaluate the session tree from step 3
   - Success: scores match reality (if coder did well, score is high)
   - Current: newer format has agent attribution, scores look reasonable

5. **Bob** — reads evaluations, produces analysis
   - Task: analyze last 5-10 evaluations, identify top failure pattern
   - Success: identifies a real pattern, not hallucinated, actionable
   - Current: 2 evals, mixed results

6. **Optimizer** — implements a fix based on bob's analysis
   - Task: take bob's finding, implement one structural fix
   - Success: fix is correct, tests pass, measurable improvement
   - Current: 2 evals, both scored 0 — needs work

7. **Master** — handles a task coder failed
   - Task: a code change that requires multi-file understanding
   - Success: frames the problem well for claude-code/gemini-cli, delivers result
   - Current: 2 evals, both failures — needs significant work

8. **Coach** — trains an underperforming agent
   - Task: coach the weakest agent from the above runs
   - Success: coachee performs better on a follow-up exercise
   - Current: untested in production

### Per-Agent Iteration Protocol

```
1. Pick a concrete task
2. Run the agent (via May delegation or @agent direct)
3. Read the full transcript
4. Score manually: did it meet the bar?
5. If no:
   a. Identify the specific failure mode
   b. Is it structural (fixable via prompt/tool/workflow change)?
   c. Or behavioral (model limitation, needs coaching/different approach)?
   d. Apply the fix
   e. Run again with a similar task
   f. Repeat until it meets the bar 3 times in a row
6. If yes:
   a. Run 2 more times with different tasks to confirm consistency
   b. Mark agent as calibrated
   c. Move to next agent
```

## Phase 2: Wire the Pipeline

Once each agent is calibrated individually, connect them:

1. ✅ **User task → May → implement-and-review → done**
   Runs 14-16 confirmed. delegateDeny forces workflow, ACTION REQUIRED forces commit.

2. ✅ **Completed task → evaluator → scores**
   Auto-evaluations run after each session. Scores correlate with reality.

3. ✅ **Evaluations → bob → analysis**
   Bob read 10 evaluations, identified "blind overwrite" as #1 pattern (60% of sessions).

4. ✅ **Analysis → optimizer → fix**
   Optimizer read bob's analysis, updated coder/lessons.md and qa/domain.md.

5. ✅ **Low scores → coach → training → improved scores**
   Coach ran 3 exercises on QA. QA passed all with zero interventions.

## Phase 3: Automate with Cron ✅ Validated

Meta loop validated manually (Runs 19-21):
- Coach trains agents on findings → coder/QA behavior improves
- Bob analyzes evaluations → finds real patterns with evidence
- Optimizer implements fixes across all agents → behavior changes in next session
- Pipeline still works after optimization (Run 21: coder used sed instead of write)

Cron jobs configured in agents/may/cron.json (4 enabled, 2 disabled).
Start with `SCHEDULERS=1` to enable autonomous operation.

| Job | Interval | Trigger |
|-----|----------|---------|
| evaluate-sessions | 4h | Score unevaluated sessions |
| analyze-failures | 8h | Bob reads evals, extracts patterns |
| optimize | 24h | Optimizer implements one fix |
| health-check | 24h | Run tsc + tests |
| coaching | weekly | Coach agents below threshold |
| lesson-consolidation | weekly | Bob prunes lessons.md files |

Intervals will be calibrated based on Phase 2 data (how fast sessions
accumulate, how often evaluations reveal new patterns).

## Data Flow

```
Session completes
  → evaluator scores it
  → score appended to evaluation history
  → agent's rolling average updated

Bob reads evaluations periodically
  → identifies failure patterns per agent
  → writes analysis to workspace
  → updates lessons.md with findings

Optimizer reads bob's analysis
  → picks highest-impact issue
  → implements ONE structural fix
  → verifies with tests

Next session uses updated prompts/tools
  → evaluator scores it
  → did the fix help? (score comparison)
  → if yes: lesson confirmed, move to next issue
  → if no: bob re-analyzes, optimizer tries different approach

Agent below threshold for 10+ sessions
  → coach runs training exercises
  → coachee re-tested on similar tasks
  → if improved: coaching worked
  → if not: escalate to human (structural redesign needed)
```

## Current State (131 evaluations + 21 calibration runs)

| Agent | Evals | Avg Eff | Avg Qual | Status | Notes |
|-------|-------|---------|----------|--------|-------|
| coder | 42+10 | 0.46→0.77 | 0.56→0.87 | ✅ Calibrated | Blind overwrite fixed, uses sed for surgical edits |
| qa | 0+6 | — → 0.55 | — → 0.55 | ✅ Calibrated | Independent verification working. Write-after-truncate fixed in domain.md |
| master | 2+1 | 0.00→? | 0.00→? | ⏸️ Deferred | CLI timeouts need structural fix |
| evaluator | auto | — | — | ✅ Calibrated | Scores correlate with reality. Blind-overwrite flagging added |
| bob | 2+3 | 0.42→0.75 | 0.40→0.65 | ✅ Calibrated | Truncated-read warning added to domain.md |
| optimizer | 2+3 | 0.00→? | 0.00→? | ✅ Calibrated | Updated 6 agents in one run |
| coach | 0+5 | — → 0.78 | — → 0.90 | ✅ Calibrated | Coder PASS, QA PARTIAL, actionable findings |
| unknown | 63 | 0.30 | 0.26 | — | Old format without agent attribution |

## Blocking Issue: May Workflow Routing — RESOLVED

**Problem:** May used `subagents.delegate("coder", ...)` instead of
`workflow.run("implement-and-review", ...)` despite domain.md prompts.

**Fix applied:** `delegateDeny` option on `createTool()` (commit cd5ef32).
Blocks delegation to coder/qa with hint to use workflow. Configured in
May's agent.json.

**Result:** Calibration run #14 confirmed the fix works. May tried
`subagents.delegate("coder")`, got blocked, used `workflow.run` instead.
Full pipeline ran: coder → QA review → workflow done.

## Blocking Issue: May Not Committing — RESOLVED

**Problem:** May didn't commit after workflow completed despite domain.md
instructing "commit immediately after QA passes."

**Fix applied:** Added ACTION REQUIRED section to workflow done output
with explicit git commands. Also strengthened domain.md commit language.

**Result:** Run #16 — May ran `git diff --stat`, `git diff`, then
`git add <files> && git commit`. First fully autonomous commit.

## Phase 1 Calibration Log

### Run 1 — Coder (getAgentScoreSummary)
- **Task:** Add function + test + export
- **Result:** Success, code correct, 4 tests pass
- **Issues:** May explored first (8 wasted calls), coder used /home/user/, overwrote evaluator.ts
- **Fixes applied:** May domain.md (delegate first), coder lessons.md (write tool warning)
- **Evaluator score:** 0.25/0.40 needs_improvement (first attempt), 0.9/0.85 good (second attempt)
- **Commit:** ea6c953

### Run 2 — Coder (cron status action)
- **Task:** Add status action + 3 tests
- **Result:** Success, all 882 tests pass
- **Issues:** None — domain.md fix worked, no path hallucination, no file destruction
- **Evaluator score:** 0.9/0.85 good
- **Commit:** 6029c23

### Run 3 — QA standalone (review cron status)
- **Task:** Review coder's cron status changes
- **Result:** CONDITIONAL verdict with real findings (missing tie-break test, disabled-with-jobs test, wording mismatch)
- **Issues:** No false positives. Line references missing (minor).
- **Evaluator score:** 0.95/0.85 good

### Run 4 — implement-and-review workflow (fix QA findings)
- **Task:** Fix 3 QA findings via workflow
- **Result:** Workflow completed in one iteration. Coder fixed all 3, QA gave PASS.
- **Issues:** Coder used brittle sed line-number edits, some self-inflicted corruption then repair.
- **Evaluator score:** coder 0.55/0.85 acceptable, qa 0.10/0.20 needs_improvement (thin review)
- **Commit:** 8558a4d

### Run 5 — Bob (evaluation analysis)
- **Task:** Analyze 5 recent evaluations, identify top failure pattern
- **Result:** Excellent analysis. Identified file-editing strategy as top issue (not just path hallucination). Found secondary prompt-duplication bug.
- **Issues:** None — methodical, evidence-based, actionable recommendations.
- **Not auto-evaluated** (direct @bob run)

### Remaining
- [ ] ~~Optimizer~~ Done — implemented File Editing Protocol for coder
- [ ] ~~Master~~ Done — delivered despite CLI timeouts, needs longer timeouts
- [ ] Coach — needs underperformer to train (defer to Phase 2)

### Run 6 — Optimizer (File Editing Protocol)
- **Task:** Implement Bob's recommended fix for file-editing strategy
- **Result:** Success. Read bob's analysis, read coder's lessons.md, wrote updated version with comprehensive File Editing Protocol.
- **Issues:** None — clean execution, verified with tsc and tests.
- **Knowledge change:** agents/coder/knowledge/lessons.md updated with new "File Editing Protocol" section

### Run 7 — Coder (post-optimizer verification)
- **Task:** Align cron status/list output format (surgical edits)
- **Result:** Success. Coder used Python find-and-replace script instead of sed line numbers — File Editing Protocol already influencing behavior.
- **Evaluator score:** good
- **Commit:** 425526c

### Run 8 — Master (trend calculation)
- **Task:** Add trend field to AgentScoreSummary (multi-file change)
- **Result:** Success despite struggle. claude-code kept timing out (30s too short). Master eventually got enough context to implement correctly.
- **Issues:** 6+ timeout failures before delivering. Needs longer default timeouts or better prompt framing.
- **Evaluator:** not yet scored (session was cancelled after successful implementation detected)
- **Commit:** 2b37a58

### Run 9 — QA fixes applied + coder (enabled field)
- **Task:** Add enabled boolean to CronEntry
- **Result:** Coder succeeded, May did NOT use workflow despite 3 rounds of prompt fixes
- **QA fixes applied:** workflow review prompt restructured (Fix 1), domain.md mandatory steps (Fix 3), lessons.md independent verification (Fix 2)
- **May routing:** Used subagents.delegate("coder") 3 times across 3 fresh sessions. Opus ignores workflow.run instruction.
- **Evaluator score:** coder needs_improvement (used write for full rewrite)
- **Commit:** 517cabc

### Run 10 — Coder (description field)
- **Task:** Add description optional field to CronEntry
- **Result:** Coder succeeded. May still bypassed workflow.
- **Commit:** 1806204

### Run 11 — QA standalone (verify QA fixes work)
- **Task:** Review description field changes with new prompt format
- **Result:** Excellent. QA read 3 files independently, ran tsc, ran vitest (891 tests), found 2 genuine MINOR issues (empty string truthiness, missing truncation test), gave PASS.
- **Conclusion:** QA fixes work when QA gets the right prompt. Problem is entirely May routing.

### Run 12 — Coach on QA (anti-rubber-stamp exercises)
- **Task:** Coach QA with exercises testing bug detection, anchoring resistance
- **Result:** QA passed both exercises with zero interventions
- **Exercise 1 (Bug Detection):** Coach planted bug in overflow.ts (removed .toLowerCase()), QA read files, ran tests, found the bug, reported FAIL. Correctly called out false "all tests pass" claim.
- **Exercise 3 (Anchoring Resistance — critical):** Coach planted MAX_ERRORS=3 (test expects 5), prompt included detailed false rationalization. QA ran tests independently, observed failure, reported CONDITIONAL with specific evidence. Directly contradicted coder's lie.
- **Coach behavior:** Excellent. Staged exercises, spawned QA process, observed via socket, verified cleanup, wrote detailed report with evidence.
- **Key finding:** QA's rubber-stamp problem from s_1772629874712_7 did not reproduce. QA follows mandatory steps reliably. Original failure may have been a transient anomaly.
- **Report:** agents/coach/workspace/sessions/qa-2026-03-04.md
- **Coach status:** ✅ Calibrated — designs targeted exercises, spawns process, observes, verifies, writes report

### Run 13 — delegateDeny structural fix
- **Task:** Add delegateDeny option to subagents tool, block coder/qa delegation for May
- **Result:** 4 tests added, 896 tests pass. Agent.json configured.
- **Commit:** cd5ef32

### Run 14 — First successful workflow pipeline (May → coder → QA)
- **Task:** Truncate description on update to match add behavior
- **Result:** May tried subagents.delegate("coder") → BLOCKED → used workflow.run → coder implemented → QA reviewed independently (read files, ran tsc, ran vitest 897 tests) → workflow completed
- **Issues:** May didn't commit after workflow. Needs stronger commit instruction or post-workflow hook.
- **Evaluator:** coder good, qa needs_improvement (still thin despite running checks)
- **Commit:** b8ed567

### Run 15 — Pipeline test #2 (name validation for add)
- **Task:** Reject cron job names > 50 chars in add action + test
- **Result:** Full pipeline: May → delegateDeny blocked → workflow → coder → QA (tsc + vitest 898 tests) → workflow done
- **Issues:** May still didn't commit despite domain.md instruction
- **Fix applied:** Added ACTION REQUIRED section to workflow done output with explicit git commands
- **Commit:** f658a51 (manual)

### Run 16 — First fully autonomous pipeline (May commits!)
- **Task:** Add same 50-char name validation to update action + test
- **Result:** Full autonomous pipeline: May → workflow → coder → QA → May ran git diff --stat → git diff → git add + git commit → DONE
- **Key achievement:** May committed on its own for the first time. The ACTION REQUIRED directive in the workflow output triggered the commit behavior.
- **Evaluator:** coder acceptable (used write to rewrite full files), qa good
- **Commit:** 497699f (by May, autonomously)

### Run 17 — Bob analysis pipeline (evaluations → patterns)
- **Task:** Analyze last 10 evaluations, identify top failure pattern
- **Result:** Bob read all 10 evaluation JSONs, identified "Blind Overwrite After Truncated Read" as #1 pattern (60% of coder sessions, 40% of QA sessions). Cited specific session IDs as evidence. Gave 4 concrete recommendations.
- **Evaluator:** bob eff=0.8, qual=0.65, verdict=acceptable
- **Analysis output:** agents/bob/workspace/analysis.md

### Run 18 — Optimizer implements bob's fix (analysis → knowledge update)
- **Task:** Read bob's analysis, update coder/lessons.md and qa/domain.md
- **Result:** Optimizer read analysis, read both target files, rewrote them with prominent warnings about truncated reads and blind overwrites. Verified changes were written correctly.
- **Changes:** agents/coder/knowledge/lessons.md (new #1 Failure Pattern section at top), agents/qa/knowledge/domain.md (new Truncated Reads Invalidate Verification section)
- **Note:** No git commit needed — agents/ is gitignored, changes take effect on next session start

### Run 19 — Coach drains todo (coder blind-overwrite + QA truncated-read)
- **Task:** Coach reads todo.md, runs exercises for coder and QA targeting bob's #1 finding
- **Coder exercise:** 1-line change in 273-line file. PASS — used grep → line-range reads → sed with pattern matching. Zero content loss. Training has taken effect.
- **QA exercise:** Review 289-line file with bug at line 258, coder claims "all tests pass" (false). PARTIAL — QA correctly found the bug and ran tests independently (not rubber-stamping), BUT used write() after truncated read to fix it (blind overwrite pattern applied to fixes, not just verdicts).
- **Key finding:** QA's anti-truncation rules cover verdicts but not writes. Coach recommended extending QA domain.md.
- **Reports:** sessions/coder-2026-03-05-blind-overwrite.md, sessions/qa-2026-03-05-truncated-read.md

### Run 20 — Meta loop: bob analysis → optimizer fix (6 agents updated)
- **Task:** Bob re-analyzes 15 evaluations, optimizer implements top recommendations
- **Bob result:** Blind overwrite still #1, now spreading to bob itself. Tool hallucination (Edit/MultiEdit) rising as #2.
- **Optimizer result:** Updated 6 knowledge files across all agents: coder/domain.md (truncated read = stop), qa/lessons.md (blind overwrite for fixes), bob/domain.md (truncated reads invalidate analysis), evaluator/domain.md (patterns to flag), evaluator/lessons.md (detection guidance), optimizer/lessons.md (available tools).
- **Evaluator:** bob acceptable, optimizer auto-evaluated

### Run 21 — Post-optimization pipeline verification
- **Task:** Add message length validation to cron tool add action + test
- **Result:** Full autonomous pipeline: May → workflow → coder (used sed for surgical edit — no blind overwrite!) → QA (tsc + vitest 900 tests) → May committed (46eb822)
- **Key observation:** Coder used sed instead of write() for the 1-line addition. Optimizer's knowledge update is working.
- **Evaluator:** coder good, qa needs_improvement
- **Commit:** 46eb822 (by May, autonomously)

## QA Improvement Plan

### Root Cause Analysis

QA is bimodal: 0.95/0.85 standalone, 0.10/0.20 inside workflow. Investigation
of the bad session (`s_1772629874712_7`) reveals the cause:

**The workflow pastes the full implementation summary into the QA prompt.**

`implement-and-review.ts` builds the review task as:
```
Review the following implementation.
## Task
${ctx.task}           ← full spec with code snippets
## Implementation
${coder.lastAssistantText}   ← coder's summary: "all 884 tests pass, here's what I changed"
```

When the coder's `lastAssistantText` includes verification results ("884 tests
pass, tsc clean"), QA has nothing to independently verify. The task TELLS it
everything is fine. The model produces empty or parrot responses because the
input already contains the conclusion.

The standalone run worked because QA received a focused task ("review these
specific files") without the coder's self-assessment baked in.

### Fix Plan

Three changes, ordered by impact:

#### Fix 1: Restructure the workflow review prompt (structural)

Change `implement-and-review.ts` to separate what the coder changed from
what the coder claims:

```
Review these code changes independently.

## Task Description
${ctx.task}

## Files Changed (per coder)
${extractFileList(coder.lastAssistantText)}

Read each file yourself. Run tsc and tests yourself. Form your own judgment.
Do NOT rely on the implementation summary below — verify independently.

## Coder's Summary (for context only, verify everything)
${coder.lastAssistantText}
```

The key change: **instruct QA to read and verify independently**, and frame
the coder's output as "claims to verify" rather than "facts to accept."

#### Fix 2: Add "always run checks" to QA lessons.md (prompt)

Add a lesson: "Even if the task description says tests pass, run them yourself.
Your value is independent verification, not rubber-stamping."

This reinforces the structural fix with behavioral guidance.

#### Fix 3: Add minimum-action guard to QA domain.md (prompt)

Add a rule: "A valid review MUST include: (1) at least one file read, (2) tsc
output, (3) test output, (4) a verdict with rationale. If you produce a
verdict without these, the review is invalid."

This creates a floor — even if the model wants to parrot, it must first
do the mechanical steps.

### Verification

Run 3 tasks through `implement-and-review` after fixes. QA should:
- Read at least 1 changed file independently
- Run tsc and tests independently
- Produce a non-empty verdict with specific observations
- Score >= 0.5/0.5 on all 3 runs

### Implementation Order

1. Fix 1 first (workflow change) — requires approval since it's a workflow file
2. Fix 3 next (domain.md guard)
3. Fix 2 last (lessons.md)
4. Verify with 3 workflow runs

## Coach Improvement Plan

### Current State

Coach has been tested twice, both on master (the hardest agent to coach due
to CLI tool complexity). Results were mixed:
- Session 1: master circumvented exec guards, coach caught it and corrected
- Session 2: master improved tool selection, coach identified efficiency issues

Coach itself works — the framework (spawn process, connect socket, observe,
intervene, verify, report) functions correctly. The problem isn't coach
mechanism, it's coach targeting.

### Key Insight

Coach should start with the agent most likely to benefit from coaching:
**QA**, not master. QA has a clear, measurable weakness (empty reviews inside
workflow) and a simple bar (produce non-empty verdicts with evidence).

Master's problems are structural (CLI timeouts, prompt framing) — coaching
won't fix a 30-second timeout. QA's problems are behavioral (failing to
read files and run checks when the prompt already tells it "tests pass") —
coaching CAN fix this.

### Exercise Design for QA

#### Exercise 1: Review code with bugs (true positive detection)
Plant a real bug (e.g., off-by-one in a loop, missing null check) in a
source file. Give QA the file to review. Success: finds the bug, correctly
classifies severity.

#### Exercise 2: Review correct code (false positive resistance)
Give QA clean, working code. Success: PASS verdict, no fabricated issues.
Failure: invents problems that don't exist.

#### Exercise 3: Review with pre-baked "everything passes" context
Simulate the workflow scenario: give QA a task that includes "all tests
pass, tsc clean" in the prompt. Success: reads files and runs checks
ANYWAY, produces independent observations. Failure: parrots the summary,
produces empty review.

Exercise 3 directly tests the failure mode we observed.

#### Exercise 4: Mixed severity (calibration)
Give QA code with one critical bug, one minor style issue. Success:
CRITICAL on the bug, MINOR on the style. Failure: flags both as CRITICAL
or misses the real bug.

### Coach Execution Plan

```
1. Read QA's evaluation history and lessons.md
2. Design exercises 1-4 above
3. Spawn QA in isolated process (STATE_DIR=.state/coaching AGENT=qa)
4. Run exercises sequentially
5. After each: verify independently (read files, run tests)
6. Write coaching report to agents/coach/workspace/sessions/qa-<date>.md
7. Update findings.md with QA-specific observations
8. Cleanup: disconnect socket, kill process
```

### Coach-to-Optimizer Handoff

After coaching identifies QA's behavioral pattern:
- If QA reads files when told to but not when it "already knows" →
  Fix 3 (minimum-action guard) will help
- If QA doesn't read files even when explicitly told →
  Model limitation, consider switching QA to a different model
- If QA reads files but doesn't catch bugs →
  QA's domain.md needs better bug-detection guidance

The coach OBSERVES, the optimizer FIXES. Coach writes findings, optimizer
reads findings and implements structural changes.

### Verification

Coach is calibrated when:
- 1 coaching session produces a complete report with evidence
- At least 1 exercise reveals a real finding (not already known)
- The finding leads to an actionable optimizer recommendation
- The coachee shows different behavior on a follow-up exercise

### Master — Deferred

Master's issues are structural (CLI timeouts, excessive exploration) not
behavioral. Coaching won't help. The fixes are:
- Longer default timeouts (180s) in master's tool config
- Prompt guidance to combine read+implement+verify in single CLI calls
- These are optimizer tasks, not coach tasks

Master calibration resumes after QA and coach are stable.

## Success Criteria for Phase 1

Each agent is "calibrated" when:
- It completes 3 consecutive tasks successfully (meets its bar)
- Common failure modes are addressed in its prompt/tools/structure
- Its lessons.md reflects real, actionable lessons (not generic advice)

## Success Criteria for Phase 2

The pipeline is "stable" when:
- A user code task flows through May → coder → QA → evaluator without intervention
- Evaluator scores correlate with manual assessment (within ±0.15)
- Bob's analysis identifies real patterns (validated by human spot-check)
- Optimizer's fixes measurably improve scores (before/after comparison)

## Success Criteria for Phase 3

Automation is "ready" when:
- Phase 2 criteria met for 1 week of manual runs
- No false-positive coaching triggers
- No optimizer regressions
- Human reviews pending-changes.md queue, approves/rejects within 24h
