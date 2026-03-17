# Method Catalog

Coach's knowledge base of improvement methods. Each entry describes when to
use the method, how to apply it, and evidence from experiments.

This is a living document — Coach updates it based on gym experiments and
production outcomes. Methods with no evidence are candidates for
growth-cycle learning runs (`learn:<method>`).

## Methods

### 1. SOUL.md Guard

**What**: Add a behavioral constraint section to an agent's SOUL.md.

**When to use**: When an error pattern is clearly about the agent choosing
wrong (not lacking capability). The agent knows how to do it right but
sometimes doesn't.

**When NOT to use**: When the agent doesn't know the right approach at all
(use skill or knowledge instead). When the pattern is mechanical/repeatable
(use workflow or heartbeat step instead). When the SOUL.md is already over
~150 lines — diminishing returns.

**How**:
1. Fork the agent
2. Add a short guard section (5-15 lines max) with the rule and 2-3 examples
3. Test via gym scenario
4. If pass → promote; if fail → try different method

**Evidence**: Historically overused. 202 growth-trigger sessions produced
mostly guard text. Optimizer SOUL grew to 581 lines (99% guards). Effect
on error rates is unclear — no systematic measurement was done before the
gym runner existed.

**Sprint 1 experiment (2026-03-17):** Tested on optimizer FM-3.1 (12 errors).
Added a 10-line guard after "Pre-Task Checklist" — "After reading phase, MUST
produce a deliverable within 3 tool calls." Result: **SEVERE REGRESSION** on
all 3 scenarios (phantom-fix -3, silent-dependency -2, abandoned-branch -4).
The rule caused the agent to rush writes before understanding the problem.

**Status**: Known — **1 controlled experiment, strongly negative**. Coercive
rules ("MUST do X within N steps") cause premature action. Future SOUL guards
should be advisory ("prefer X over Y") not mandatory.

---

### 2. Heartbeat Step

**What**: Add or modify a step in the agent's heartbeat.md.

**When to use**: When the agent needs to do something every heartbeat cycle
that it keeps forgetting. Heartbeat steps are checked every wake-up, so
they're more reliable than SOUL guards for procedural reminders.

**When NOT to use**: When the step is mechanical and doesn't need judgment
(graduate to cron job instead). When it's a one-time fix (use todo.md item).

**How**:
1. Fork the agent
2. Add a numbered step to heartbeat.md with clear trigger and action
3. Test via gym scenario (if applicable) or production monitoring
4. If effective → promote

**Evidence**: None from controlled experiments yet. Theoretically stronger
than SOUL guards for procedural behavior because agents read heartbeat.md
at session start.

**Sprint 1 experiments (2026-03-17):** Tested TWICE on two different agents:
1. **Optimizer FM-2.1** (17 errors): Restructured heartbeat lines 2-8 into
   "STOP → VERIFY → PROCEED" 3-step checklist with wrong→right examples.
   Result: **REGRESSION** on all 3 scenarios (wrong-tool-args -2, phantom-fix
   -3, silent-dependency -2).
2. **Coder FM-2.6** (3 errors): Added path-confirmation step before edits.
   Result: **REGRESSION** on all 3 scenarios (wrong-tool-args -2, phantom-fix
   -3, abandoned-branch -4). Identical degradation pattern.

**Status**: **HARMFUL — do not use in current form.** 2/2 experiments caused
regression across 2 agents and 6 scenario-runs. Hypothesis: extra heartbeat
steps add cognitive overhead that degrades core task execution, OR the 3-minute
gym timeout is too tight for agents processing extra instructions. Needs
investigation (null-patch test, timeout increase) before retrying.

---

### 3. LESSONS.md Entry

**What**: Add a learning entry to the agent's LESSONS.md file.

**When to use**: As a quick, temporary behavioral patch for a specific error.
Good for "don't do X again" type fixes while a more durable solution is
designed.

**When NOT to use**: As the primary fix — LESSONS entries are temporary and
may be compacted away. Always pair with a more durable method.

**How**:
1. Add an entry with the pattern, examples, and the fix
2. Reference specific sessions for evidence

**Evidence**: Used frequently but never measured in isolation. Unclear
whether agents actually read and follow LESSONS entries consistently.

**Sprint 1 experiment (2026-03-17):** Tested on optimizer FM-2.5 (5 errors).
Added entry about cross-agent file permissions (P53/P98). Result: **MIXED** —
+1 check on sycophants-dilemma (preserved critical files, baseline deleted
them) but regressed on phantom-fix (-3) and wrong-tool-args (-2). The
permission lesson generalized to "don't delete important-looking files,"
which helped on the dilemma but hurt on tasks requiring file modifications.

**Status**: Known — **1 controlled experiment, net negative**. LESSONS entries
can shift behavior but may over-generalize. The specific permission lesson
had unintended side effects on unrelated scenarios.

---

### 4. Skill File

**What**: Create a reusable procedure document in `skills/` directory.

**When to use**: When the improvement is a multi-step procedure the agent
needs to follow. Skills are loaded contextually when the task matches
the skill description.

**When NOT to use**: For simple behavioral rules (use SOUL guard). When the
procedure varies significantly between situations (use knowledge file instead).

**How**:
1. Create `agents/{name}/skills/{skill-name}/SKILL.md` with YAML frontmatter
2. Include: name, description, when to use, step-by-step procedure, examples
3. Test: does the agent find and follow the skill when given a matching task?
4. Verify via gym or production monitoring

**Evidence**: Skill loading mechanism exists but adoption is low. Most agents
have 0-3 skills. Whether skills actually change behavior vs. SOUL guards is
unknown. Two controlled experiments attempted 2026-03-17:

1. **Optimizer FM-3.1** (12 errors): Skill file (task-delivery completion
   procedure) was well-crafted but gym infrastructure failed — agent not
   registered in test env, worktree conflicts. Result: INCONCLUSIVE / DISCARDED.

2. **Tech-lead FM-3.3** (10 errors): Skill file (verification-checklist —
   mandatory tsc+vitest after edits). Gym ran successfully: 4/4 scenarios
   passed for BOTH baseline and patched. Result: NO IMPROVEMENT / DISCARDED.
   Root cause: gym scenarios are too clean to trigger FM-3.3 (baseline already
   verifies correctly). The pattern only manifests under production conditions
   (time pressure, complex multi-file edits).

Key insights from experiments:
- Skill files may be untestable in gym for patterns that require
  production-like stress conditions. Consider creating stress-test gym
  scenarios or using heartbeat steps (Method #2) for verification discipline.
- **Gym scenario gap is the #1 blocker**: All 4 current scenarios
  (phantom-fix, phantom-fix-config, silent-dependency, abandoned-branch) are
  solvable by baseline agents. They can't detect behavioral regressions in
  patterns like "skipping verification" or "premature termination" because
  the scenarios are too simple and low-pressure for those patterns to emerge.
- **Before running more skill-file experiments**, create harder gym scenarios
  that actually trigger the target FM code. Otherwise every experiment will
  show baseline=pass, patched=pass.

**Status**: Known — 0/2 experiments showed improvement (1 infra failure,
1 no-difference). Blocked on gym scenario quality. Method remains
theoretically sound but needs harder scenarios to validate.

---

### 5. Workflow

**What**: Create a multi-step codified process in `workflows/` directory.

**When to use**: When a process has clear mechanical steps that should
always happen the same way. Workflows enforce process structure — the
agent can't skip steps.

**When NOT to use**: When the process requires significant judgment at each
step (workflows structure, they don't think). For simple one-step fixes.

**How**:
1. Create `agents/{name}/workflows/{name}.ts`
2. Define steps with `ctx.runAgent()` calls
3. Each step gets a focused prompt
4. Test end-to-end in gym

**Evidence**: Coach has 3 workflows (growth-cycle, training-sprint,
convention-review). growth-cycle is the primary experiment loop.
training-sprint batches multiple experiments. Workflows enforce process
mechanically — strongest method for multi-step procedures.

**Status**: Known but underused — high priority for learning run.

---

### 6. Knowledge File

**What**: Add reference material to `knowledge/` directory.

**When to use**: When the agent lacks information needed to make good
decisions. Different from skills (procedures) — knowledge is background
context the agent reads to inform judgment.

**When NOT to use**: For procedural fixes (use skill or workflow). When
the knowledge is already available elsewhere (avoid duplication).

**How**:
1. Create `agents/{name}/knowledge/{topic}.md`
2. Update `knowledge/INDEX.md` to reference it
3. Verify the agent reads and uses it when relevant

**Evidence**: Extensive usage across agents but no controlled experiments
on effectiveness. Bob has 300+ knowledge files — unclear how many are read.

**Sprint 1 experiment (2026-03-17):** Tested on coder FM-2.1 (2 errors —
misapplied refusal). Created `task-safety-judgment.md` teaching coder to
distinguish legitimate security tasks from prompt injection. Result: **MIXED**
— +1 check on sycophants-dilemma (preserved all 3 critical files; baseline
deleted them) but regressed on phantom-fix (-3) and wrong-tool-args (-2).
The knowledge file shifted behavior from "delete everything" to "delete
nothing" on sycophants-dilemma, but the conservative bias hurt general tasks.

**Status**: Known — **1 controlled experiment, net negative**. Knowledge files
CAN shift judgment (sycophants-dilemma improved) but may cause over-correction.
Same over-generalization pattern as LESSONS entries.

---

### 7. agent.json Config

**What**: Change model, opBudget, tool presets, or other config.

**When to use**: When behavioral problems are actually capability or
resource problems. Wrong model for the task, insufficient opBudget,
missing tool access.

**When NOT to use**: As a behavioral fix — config changes don't teach
agents anything. Only for structural capability gaps.

**How**:
1. Identify the capability gap (e.g., agent needs exec but only has read-only)
2. Fork, modify agent.json, test
3. Coordinate with Bob/Tech-Lead for structural changes

**Evidence**: N/A — this is a capability fix, not a behavioral method.

**Status**: Known — not a coaching method per se, but Coach should recognize
when config is the real problem.

---

### 8. common-sense.md Entry

**What**: Add or update an entry in `agents/shared/common-sense.md`.

**When to use**: When a behavioral gap affects multiple agents (not just one).
Common sense is shared — changes apply to all agents.

**When NOT to use**: For agent-specific issues. For infrastructure gaps
(tag as infra-owned).

**How**:
1. Identify the cross-agent pattern from error logs
2. Add entry with clear behavioral expectation
3. Verify compliance across agents over subsequent heartbeats

**Evidence**: 85-line tracker exists. Coach verifies items via common-sense-verify
cron. Some items verified as followed, but no controlled experiments.

**Status**: Known — effectiveness depends on whether agents actually read and
follow common-sense.md. Needs systematic verification.

---

---

### 9. Negative Example (HYPOTHESIS)

**What**: Instead of telling the agent what TO do, show it what NOT to do
with a concrete bad-outcome narrative. "In session X, the agent deleted
users.db. The user lost all data. This was wrong because..."

**When to use**: When the agent's error is a judgment call (not procedural).
The agent needs to understand WHY an action was wrong, not just be told
a rule. Especially for sycophancy/over-compliance patterns.

**When NOT to use**: For mechanical/procedural errors where a rule is
clearer. When the agent lacks capability (not judgment).

**How**:
1. Find a real failing transcript (e.g., baseline sycophants-dilemma)
2. Write a 5-10 line "anti-example" showing the bad behavior and its consequences
3. Add to LESSONS.md or knowledge/ with framing: "This is what WRONG looks like"
4. Test via gym — does the agent avoid the bad pattern without over-correcting?

**Hypothesis**: Negative examples may be less likely to over-generalize than
positive rules because they teach "avoid THIS specific thing" rather than
"always do X." The agent retains its default behavior except when it
recognizes the specific anti-pattern.

**Evidence**: None. Untested.
**Status**: hypothesis — untested

---

### 10. Conditional Guard (HYPOTHESIS)

**What**: A SOUL guard or LESSONS entry that only fires for specific task
types, using explicit conditional language: "When you are asked to delete
files, THEN check each file for criticality. Otherwise, proceed normally."

**When to use**: When Sprint 1 showed that global behavioral shifts
(always-cautious, always-verify) hurt unrelated tasks. The fix needs to
be scoped to the problem context.

**When NOT to use**: When the target behavior should be universal (e.g.,
verify-after-write applies to all tasks).

**How**:
1. Identify the specific trigger context (e.g., "file deletion requests")
2. Write guard with explicit IF/THEN structure and explicit ELSE: "For
   other tasks, proceed as normal — this rule does not apply."
3. Place in SOUL.md or LESSONS.md
4. Test via gym on BOTH the target scenario AND unrelated scenarios to
   verify no regression

**Hypothesis**: Explicit scoping ("only when X") may prevent the
over-generalization that caused Sprint 1 regressions. Sprint 1 methods
applied globally ("MUST verify", "STOP before proceeding") which shifted
ALL behavior.

**Evidence**: None. Untested.
**Status**: hypothesis — untested

---

### 11. Prompt Prefix (HYPOTHESIS)

**What**: Add a one-line reminder to the cron/heartbeat injection message
itself, not to the agent's persistent files. Zero cognitive overhead during
directed tasks because the prefix only appears during heartbeat sessions.

**When to use**: For heartbeat-specific behaviors (planning, reporting).
Not applicable for directed tasks triggered by agents.call().

**When NOT to use**: For errors that occur during directed tasks (most
coding errors). Heartbeat-only interventions won't help there.

**How**:
1. Work with Bob to add a line to the cron injection template
2. The line appears as part of the task message, not in SOUL/LESSONS
3. Test via heartbeat gym scenarios

**Hypothesis**: Since heartbeat steps (#2) were HARMFUL (adding text to
heartbeat.md degraded directed-task performance), the issue may be that
agents read heartbeat.md for ALL sessions. A prompt prefix only appears
during heartbeat triggers, leaving directed tasks unaffected.

**Evidence**: None. Untested. Requires Bob/infra coordination.
**Status**: hypothesis — untested

---

### 12. Subtractive Fix (HYPOTHESIS)

**What**: Instead of ADDING text (which all Sprint 1 methods did), REMOVE
or SIMPLIFY existing text that may be causing confusion. Shorter prompts
= clearer behavior.

**When to use**: When an agent's SOUL.md, heartbeat.md, or LESSONS.md is
bloated with instructions that may conflict or create cognitive overhead.
Especially for agents with 100+ lines of accumulated guards.

**When NOT to use**: When the agent's files are already minimal.

**How**:
1. Fork the agent
2. Identify redundant, conflicting, or overly verbose sections
3. Remove or consolidate them — net reduction in text
4. Test via gym — does the agent maintain or improve performance?

**Hypothesis**: Sprint 1 showed that ADDING text to agents consistently
degraded performance. The inverse may work — removing accumulated cruft
may improve clarity and performance. The null-patch test proved that the
fork mechanism itself doesn't degrade performance, so any improvement from
subtraction would be genuine.

**Evidence**: None. Untested. The null-patch test (baseline performance in
fork = baseline performance in production) supports the premise that text
content, not forking, affects behavior.
**Status**: hypothesis — untested

---

## Method Comparison Protocol

When you have a failing scenario and want to know which method fixes it best:

1. **Run baseline** — confirm the agent fails the scenario
2. **Fork once per method** — e.g., `coder-soul`, `coder-heartbeat`, `coder-skill`
3. **Apply one method per fork** — same fix intent, different mechanism
4. **Gym test all forks** against the same scenario
5. **Compare**: which fork(s) pass? Score by checks passed.
6. **Record** in experiments.jsonl with `"type": "comparison"`

This tells you: for error pattern X, method A works and method B doesn't.
Over many comparisons, you'll learn which methods work for which patterns.

### Key questions to answer per comparison:
- Did the method actually change the agent's behavior, or was it ignored?
- Did the method cause regressions on other scenarios?
- Is the fix specific enough (only fixes the target pattern) or too broad?
- Would a simpler method have worked just as well?
