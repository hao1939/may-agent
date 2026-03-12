# System Operations Workbook

> **Historical snapshot** (2026-03-21). Many sections reference V1 concepts
> (persistent interface session, `resumeAgent()`, notification queue, external
> crontab). The V2 architecture uses ChatSession, `resumeStaleSessions({ kinds })`,
> built-in cron system, and JS handlers. Agent responsibilities and the meta-loop
> (evaluator → bob analysis → optimizer fix) are still accurate.
> Cron entries now live in `agents/may/cron.json`, not external crontab.

This is a working document for May. Use it to audit whether the system is
running properly, whether each automated task makes sense, and where gaps
exist that need new automation or fixes.

Read this periodically (daily or when cron triggers health-check). Walk
through each section. If something is off, act on it.

---

## 0. Last Audit (2026-03-21)

### What was found and fixed
1. **Evaluator false negatives on QA**: 3 of 4 recent QA "needs_improvement"
   scores were wrong. The evaluator confused the word "truncate" in test
   names with actual read truncation. Fixed: added rules to evaluator
   domain.md to distinguish file content from truncation markers.

2. **Bob's lessons.md bloated**: 201 lines, much of it general wisdom already
   covered by domain.md. Consolidated to 88 lines.

3. **Cron enabled field ignored**: disabled jobs still fired. Fixed in
   run/cron.ts (commit ff78cbb).

4. **No fix-effectiveness tracking**: bob's analysis now includes before/after
   score comparison when optimizer makes a change.

5. **Coach→optimizer pipeline gap**: optimize cron now reads coach's journal.md
   in addition to bob's analysis.md.

6. **Coach todo.md not drained**: coaching cron now checks todo.md first,
   enabled at 48h interval. Convention training items resolved via domain.md
   documentation instead of expensive coaching sessions.

7. **Lesson-consolidation enabled**: was disabled, now weekly. All lessons.md
   files currently under 100 lines.

### What still needs verification
- Do new QA evaluations score accurately after the evaluator fix?
- Is coder's improvement trend (0.63→0.80 quality) durable?
- Will the meta-loop correctly detect when an optimizer fix doesn't work?

---

## 1. The Automated Tasks

These are the things that run without human intervention. For each one:
does it actually work? Does it produce value? Is anything missing?

### 1.1 Auto-evaluation (on every session completion)

**What:** When a child session of May completes, `evaluateTask()` runs
automatically (3s debounce). Scores each agent in the task tree.

**Where it writes:** `.state/evaluations/<sessionId>.json`

**What it also does:** Appends `[agent] lesson` lines from evaluator output
to `agents/<agent>/knowledge/lessons.md`.

**What it skips:** evaluator, optimizer, may (hardcoded in `skipAgents`).
Bob is NOT skipped — bob gets auto-evaluated when delegated by May.

**Check:**
- `ls -t .state/evaluations/ | head -5` — are recent sessions evaluated?
- Are there sessions in `.state/sessions/` with no matching evaluation?
  If yes: either auto-eval failed silently, or the session was a meta agent.
- Are `lessons.md` files growing? `wc -l agents/*/knowledge/lessons.md`
  If bob's is 200+ lines and coder's is 79 lines, lessons accumulation
  may be unbalanced or bob's needs pruning.

**Known gap:** Auto-eval only triggers for direct children of May's session.
Sessions spawned by other agents (optimizer delegates to coder via workflow)
create grandchildren — those get evaluated because the workflow's child
sessions are also children of May's session graph. But `@agent` direct runs
(socket `run` command) have no parent — they're never auto-evaluated.

**Gap impact:** Meta-loop runs triggered by cron (bob, optimizer) go through
May as followUp, so they ARE children of May → auto-eval works. Direct
`@bob` runs via socket are orphaned → not evaluated. This is acceptable
for ad-hoc runs but means cron's evaluate-sessions job needs to catch them.

### 1.2 Cron: evaluate-sessions (every 4h)

**What:** Tells May to check for unevaluated sessions and delegate to evaluator.

**Current message:**
```
[cron:evaluate-sessions] Check .state/sessions/ for unevaluated sessions
(no matching .state/evaluations/ file). For each, delegate to evaluator
to score it.
```

**Problem:** This is redundant with auto-eval for normal workflow. Auto-eval
already runs on every session completion. This cron only catches:
- Sessions that completed while May was down (missed onSessionComplete)
- Direct `@agent` runs that bypassed May's session tree
- Sessions where auto-eval failed silently

**Is it valuable?** Marginally. It's a safety net. But the message asks May
to manually find unevaluated sessions and delegate — May has to run shell
commands to compare directories, which is fragile. Better if it just called
`evaluateTask()` programmatically on orphaned sessions.

**Action needed:** Either make this job smarter (call evaluateTask on orphans
directly) or accept it as a best-effort catch-up. Current implementation
relies on May correctly scripting the comparison — May might miss sessions
or delegate wrong.

### 1.3 Cron: analyze-failures (every 8h)

**What:** May delegates to bob: read last 10 evaluations, identify patterns,
write analysis to `agents/bob/workspace/analysis.md`.

**Value:** This is the entry point of the meta loop. Bob reads real data and
produces actionable findings. Without this, nobody looks at evaluation scores.

**Check:**
- Is `agents/bob/workspace/analysis.md` recent? If it's days old, either
  cron isn't firing or bob is failing.
- Does the analysis match reality? Read the analysis, then spot-check 2-3
  evaluations it cites. Are the patterns real?
- Is bob's analysis getting stale? If the same finding persists across
  multiple analyses, either the optimizer isn't fixing it or the fix isn't
  working.

**Known gap:** Bob's analysis only looks at evaluations. It doesn't check:
- Whether optimizer's previous fix actually improved scores (no before/after)
- Whether lessons.md is getting bloated (no hygiene check)
- Whether coach's findings were acted on (no coach→optimizer pipeline check)

### 1.4 Cron: optimize (every 24h)

**What:** May reads bob's analysis, delegates to optimizer if actionable.

**Current message:**
```
[cron:optimize] Read agents/bob/workspace/analysis.md. If it contains
actionable findings, delegate to optimizer to implement the top
recommendation. Only update knowledge/prompt files — no code changes
without human approval.
```

**Value:** This closes the loop: evaluation → analysis → fix. One fix per
day, knowledge changes only (safe, no code risk).

**Check:**
- Did optimizer run recently? Check optimizer evaluations or session history.
- Did optimizer's change actually help? Compare agent scores before and after.
  If coder's quality was 0.45 before the fix and 0.90 after, the fix worked.
  If scores didn't change, the fix was ineffective — bob should note this in
  next analysis.
- Is optimizer changing the right files? `cd agents && git diff --stat` shows
  what changed.

**Known gap:** No feedback loop. Optimizer makes a fix, but nobody checks
whether it worked. Bob's next analysis looks at new evaluations, but doesn't
explicitly compare pre-fix vs post-fix scores. The system improves by
accident (new evals happen to be better) rather than by measurement.

**Possible fix:** Add a cron job or extend analyze-failures to include:
"Compare the last 5 evaluations against the 5 before the most recent
optimizer change. Did scores improve for the targeted agent?"

### 1.5 Cron: health-check (every 24h)

**What:** May runs `npx tsc --noEmit && npx vitest --run`, reports results.

**Value:** Catches regressions from optimizer code changes or dependency
updates. Simple and reliable.

**Check:** Is it actually running? If tests are failing and nobody noticed,
health-check either isn't firing or May isn't reporting.

### 1.6 Cron: coaching (weekly, DISABLED)

**What:** May checks agent scores, delegates to coach for agents below
threshold (eff < 0.5 or qual < 0.5 on 3+ sessions).

**Value:** Training closes the gap between "we know the problem" (evaluator)
and "we fixed the knowledge" (optimizer) by testing whether agents actually
follow the fixed knowledge.

**Why disabled:** Not enough organic sessions to trigger meaningful coaching
yet. Coach was calibrated manually.

**When to enable:** When the system runs autonomously (SCHEDULERS=1) and
accumulates enough sessions that score patterns are statistically meaningful
(10+ sessions per agent).

### 1.7 Cron: lesson-consolidation (weekly, DISABLED)

**What:** Bob reads all `lessons.md` files, deduplicates, removes stale entries.

**Value:** Prevents lessons.md bloat. Auto-eval appends lessons on every
evaluation — without pruning, lessons.md grows indefinitely and dilutes
important lessons with noise.

**Check:** `wc -l agents/*/knowledge/lessons.md` — if any file is over 100
lines, it needs pruning. Bob's is already at 201 lines.

**When to enable:** Now. Bob's lessons.md is already bloated. This should be
enabled or run manually.

---

## 2. The Process Gaps

Things the system should notice but currently doesn't.

### 2.1 No fix-effectiveness measurement — FIXED

The analyze-failures cron message now includes: compare last 5 evals against
5 before the most recent knowledge change. Bob should report whether the
targeted agent's scores improved.

**Verify:** After the next optimizer change, check whether bob's next
analysis explicitly compares before/after scores.

### 2.2 No workspace hygiene

Agent workspaces accumulate stale files:
- `evaluator/workspace/progress.md`: 863 lines (overflow recovery notes)
- `bob/workspace/`: 10 .md files, several from days ago
- `may/workspace/`: review-report.md, self-assessment.md, teaching-transcript.md
  (all from before calibration, now irrelevant)
- `coach/workspace/exercises/`: staging scripts from completed exercises

Nobody cleans these up. They don't directly hurt (agents don't read workspace
files unless told to) but they add noise when agents explore their workspace.

**What's needed:** A periodic cleanup job, or bob's lesson-consolidation job
could be extended to include workspace hygiene.

### 2.3 No coach→optimizer pipeline — FIXED

The optimize cron message now reads coach's journal.md in addition to bob's
analysis.md. Coach behavioral findings feed into optimizer's analysis.

### 2.4 No pending-decisions drain

Bob writes questions to `agents/bob/workspace/pending-decisions.md` when he
needs human input. Currently 1 item from 2026-03-03, waiting for human.
Nobody reminds the human or escalates stale decisions.

**What's needed:** A cron job or a check in health-check: "Are there items
in pending-decisions.md older than 3 days? If so, surface them."

### 2.5 Coach todo.md not drained — FIXED

Coaching cron enabled at 48h interval, now checks todo.md first. Convention
training items resolved via domain.md documentation.

### 2.6 Evaluator transcript truncation still affects scoring — PARTIALLY FIXED

Fixed: `formatTranscript()` now appends REVIEWER NOTE when truncating tool
results. But this depends on the evaluator model (gpt5.2) actually reading
and heeding the note. Need to verify with a few more evaluations that QA
scores are no longer falsely depressed.

**Check:** Next 3 QA evaluations — if QA still gets `needs_improvement` with
issues mentioning "truncated reads" despite the REVIEWER NOTE, the fix isn't
working and a different approach is needed (larger truncation limit, or
structured metadata instead of inline notes).

---

## 3. Agent Responsibility Audit

For each agent: is it doing its job? Is it measured? If it fails, will
the system notice?

### May (supervisor)
- **Measured?** No (skipped by evaluator). May's failures show up as bad
  delegation quality in child agent scores.
- **Can fail silently?** Yes — if May delegates wrong, the child might
  still succeed (wasting effort) or fail (attributed to child).
- **Gap:** No direct measurement of May's delegation quality.

### Coder (implementer)
- **Measured?** Yes, auto-eval on every session. 56 evaluations.
- **If it fails?** Evaluator catches it, bob analyzes pattern, optimizer
  fixes knowledge. Full loop exists.
- **Gap:** None. Best-covered agent.

### QA (reviewer)
- **Measured?** Yes, auto-eval. 6 evaluations.
- **If it fails?** Evaluator catches it. But QA failures are subtle —
  a false PASS (rubber-stamp) means bad code gets committed. The system
  only notices if that bad code later causes test failures.
- **Gap:** No way to detect false PASSes after the fact. If QA passes
  buggy code and tests don't cover the bug, nobody notices.

### Master (fallback implementer)
- **Measured?** Barely — 2 evaluations, both needs_improvement. Deferred.
- **If it fails?** May notices (task not done), escalates to human.
- **Gap:** Not actively used, not actively improved. CLI timeout issues
  are structural but nobody is assigned to fix them.

### Evaluator (scorer)
- **Measured?** No (skips itself). Evaluator accuracy is checked manually.
- **If it fails?** Bad scores propagate through the meta loop — bob
  analyzes wrong patterns, optimizer makes wrong fixes.
- **Gap:** No automated evaluator-accuracy check. We trust the evaluator
  is right. Calibration was manual (spot-checking scores vs transcripts).

### Bob (analyst)
- **Measured?** Yes, auto-eval when delegated by May. 4 evaluations.
- **If it fails?** Analysis is wrong → optimizer makes wrong fix → scores
  don't improve → bob's next analysis should notice (but currently doesn't
  explicitly check fix effectiveness, see gap 2.1).
- **Gap:** Bob's analysis is forward-looking (what's the top issue?) but
  not retrospective (did the last fix help?).

### Optimizer (improver)
- **Measured?** Partially — 2 evaluations, both old format. Auto-eval
  skips optimizer by default.
- **If it fails?** Changes are knowledge-only (safe to revert). But nobody
  measures whether the change helped (gap 2.1).
- **Gap:** Optimizer is not auto-evaluated. Its success/failure is only
  measured indirectly through improved agent scores on subsequent runs.

### Coach (trainer)
- **Measured?** Partially — 1 evaluation. Coach sessions are infrequent.
- **If it fails?** Coaching reports go to workspace but aren't read
  automatically (gap 2.3).
- **Gap:** Coach's value is only visible through improved agent scores,
  which are hard to attribute (was it coaching or optimizer?).

---

## 4. Checklist: Is the System Healthy?

Run through these periodically.

### Data flow
- [ ] Recent sessions have evaluations: `ls -t .state/evaluations/ | head -5`
- [ ] Bob's analysis is recent (< 24h old): `stat agents/bob/workspace/analysis.md`
- [ ] Lessons.md files aren't bloated: `wc -l agents/*/knowledge/lessons.md`
  (flag anything > 100 lines)
- [ ] No stale pending-decisions: `cat agents/bob/workspace/pending-decisions.md`

### Code health
- [ ] Tests pass: `npx vitest --run` (900+ tests, 0 failures)
- [ ] Types check: `npx tsc --noEmit` (no output = clean)
- [ ] No uncommitted code changes: `git status` (agents/ is separate)

### Agent scores (last 5 evaluations per agent)
- [ ] Coder: quality ≥ 0.7 on 3+ of last 5
- [ ] QA: quality ≥ 0.7 on 3+ of last 5
- [ ] Bob: quality ≥ 0.5 on 2+ of last 3

### Process integrity
- [ ] Cron jobs firing: check logs for `[cron:*]` messages
- [ ] Auto-eval firing: check logs for `[eval]` messages
- [ ] Optimizer changes are safe: `cd agents && git diff --stat` (knowledge
  files only, no src/ changes without review)

---

## 5. Evolution Opportunities

Things that could make the system better but aren't urgent.

### 5.1 Archive old-format evaluations
63 evaluations have no `agent` field (pre-format). They pollute aggregate
analysis. Move to `.state/evaluations/legacy/` or add agent field retroactively.

### 5.2 Workspace hygiene job
Periodic cleanup of stale workspace files. Could be part of health-check
or a new cron job.

### 5.3 Pending-decisions surfacing
Add a check: if `pending-decisions.md` has items > 3 days old, include in
health-check report.

### 5.4 Better evaluate-sessions cron
Instead of asking May to shell-script the comparison, have it call a
purpose-built function that finds orphaned sessions and evaluates them.
