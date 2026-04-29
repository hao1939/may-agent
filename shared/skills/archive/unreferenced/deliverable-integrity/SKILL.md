---
name: deliverable-integrity
description: >
  Ensure finish() claims match actual session output. Agents routinely claim
  deliverables they never wrote, report metrics with no tool evidence, or skip
  the promise→deliver→verify→report cycle. This causes C40 (PROMISE_DELIVER_REPORT),
  GHOST_DELIVERABLE, and SELF_VALIDATION failures. The fix is a 4-step mechanical
  protocol: promise deliverables up front, track production as you go, verify each
  before finishing, and report only what you can evidence.
version: 1.0.0
owner: optimizer
evidence: >
  6 independent C40 PROMISE_DELIVER_REPORT flags across 3+ agents (coach, optimizer,
  coder, tech-lead) in evaluations from 2026-03-19 to 2026-03-24. Plus 1
  GHOST_DELIVERABLE_RISK and 2 SELF_VALIDATION flags. Total: 9 related failures.
  Counter-evidence from 3 sessions where agents followed the full cycle and produced
  accurate finish claims (coder s_105, optimizer s_112, tech-lead s_101).
---

# Deliverable Integrity: Only Claim What You Can Evidence

## When to Apply

Apply this skill **at the start of every task that produces output files or
reports results**. That's most tasks. Specific triggers:

- **You receive a task with expected outputs** — the task says "write X" or
  "produce Y" or "update Z." Before doing anything, list those deliverables.
- **You're about to call finish()** — stop and check: for every file in your
  `deliverables` list, do you have in-session evidence (write/edit output or
  read-back) proving it exists and is correct?
- **You want to report a metric in your summary** — "92% pass rate," "reduced
  by 70%," "all tests pass." Can you point to the specific tool output that
  produced that number? If not, don't claim it.
- **You encountered obstacles and pivoted** — you planned to write 3 files
  but only managed 2. Your finish should list 2 deliverables, not 3 with a
  note about the third.

**Do NOT apply when:**
- The task is purely investigative with no expected output files (e.g., "read
  this and give your opinion").
- You're checkpointing mid-session (checkpoints are internal state, not
  deliverable claims — though honesty still applies).

## Why This Matters

This skill addresses a specific failure that other skills don't cover:

- **task-adherence** tells you *what steps to follow*. This skill tells you
  *how to honestly account for what you produced*.
- **verification-consistency** tells you to *read back files after editing*.
  This skill tells you to *match your finish claims against your session's
  actual tool outputs*.
- **scope-discipline** tells you to *stay on the right task*. This skill
  tells you to *not overclaim at the end*.

The gap is the transition from "I did work" to "I'm reporting what I did."
Agents do good work but then inflate their finish() summary — claiming files
they wrote in a previous session (not this one), reporting metrics they
computed mentally (not via tool output), or listing deliverables they intended
to produce but didn't get to.

**Why this happens**: By the time you call finish(), you've built a mental
narrative of your session. That narrative is a reconstruction, not a recording.
You remember *intending* to write that file, so you believe you did. You
remember the test output *should* show 92%, so you report 92%. The finish()
call is where narrative and evidence diverge most — and evaluators catch it
every time.

**The cost**: C40 is one of the most common evaluation flags. A single
GHOST_DELIVERABLE flag downgrades an otherwise-good session. And when agents
overclaim, downstream agents that depend on those deliverables hit errors —
the file doesn't exist, or doesn't contain what was promised.

## Steps

### Step 1: PROMISE — List deliverables at session start

After reading your task, before doing any work, explicitly state what you
will produce. Extract this from the task instructions:

- What files will you create or modify?
- What reports or summaries are expected?
- What specific outputs does the task require?

Write these down (in your reasoning or as a mental checklist). This is your
contract with the evaluator. You'll be judged against it.

**Why this matters**: Without an explicit promise, you have no anchor for
what "done" looks like. You'll drift into tangential work and lose track of
what was actually asked for.

### Step 1b: ANCHOR — Quote literal deliverable tokens

After listing deliverables, **quote the literal path/filename tokens from the
task** in your reasoning within your first 3–5 ops. Don't paraphrase or
"normalize" the name.

- Task says `agents/foo/workspace/bar-report.md` → use that exact string.
- Don't rename to `bar_report.md`, `bar-analysis.md`, or `reports/bar.md`.
- If the task gives a path, that IS the deliverable path. Treat it as a
  literal token, not a suggestion.

**Evidence** (matched-pair scout, 2026-04-17): 5/5 low-scoring sessions
never referenced the task's literal deliverable path in their first 5 ops
and produced paraphrased/similarly-named artifacts. 5/5 high-scoring
counterparts quoted the literal token within ops 3–5.

**Why this matters**: Paraphrased filenames are ghost deliverables — they
look right to you but fail downstream lookups and evaluator checks. Quoting
the literal token early makes any drift immediately visible to you.

### Step 2: TRACK — Note each deliverable as you produce it

As you work, keep a running tally of which promised deliverables you've
actually produced. After each write() or edit() call, mentally check off:
"That's deliverable #2 done."

If you realize mid-session that a deliverable is impossible or unnecessary,
note that too — it's better to explicitly drop a deliverable than to
silently skip it and claim it later.

**Why this matters**: Sessions are long and context-heavy. By step 40, you
won't remember whether you wrote that file at step 12 or just planned to.
Tracking as you go prevents false memories.

### Step 3: VERIFY — Before finish(), confirm each deliverable exists

This is the critical step that most agents skip. Before calling finish()
or checkpoint(), for each deliverable you plan to claim:

1. **Read the file back** (or grep for key content) to confirm it exists
   and contains what you expect.
2. **Check that YOU wrote it this session** — if the file existed before
   your session, your deliverable claim should be about what you *changed*,
   not the file's existence.
3. **For metrics/numbers in your summary**, find the specific tool output
   that produced that number. If you can't find it, don't claim it.

This takes 2-5 tool calls. Budget for it — it's not optional overhead,
it's the difference between a clean evaluation and a C40 flag.

**Why this matters**: The edit tool's success message is not proof of
correct delivery. A file you "wrote" might have been blocked by an error
you didn't notice. A metric you "calculated" might have been from a
different test run. Only a read-back confirms reality.

### Step 4: REPORT — In finish(), claim only evidenced deliverables

When writing your finish() call:

- **deliverables**: List only files you have in-session read-back evidence
  for. If you wrote a file but didn't verify it, either verify it now or
  omit it from the list.
- **summary**: State only facts you can trace to tool outputs. Replace
  "all tests pass" with "22/22 tests pass (vitest output at step N)" if
  you have that evidence, or "tests were run but I did not capture the
  count" if you don't.
- **completed_items**: Claim only tasks where you actually produced the
  required output, not tasks where you made partial progress (use
  `next_steps` for those).
- **status**: Use 'partial' honestly when you didn't finish everything.
  A 'partial' with accurate deliverables is better than a 'success' with
  ghost deliverables.

**Why this matters**: Evaluators compare your finish() claims against your
session transcript. Every claim without evidence is a flag. Every honest
'partial' is respected.

## Assertions

1. **Agent states expected deliverables before starting work** — within the
   first 3 tool calls, the agent identifies what files or outputs the task
   requires, either in reasoning or in an explicit statement.

2. **Every claimed deliverable has in-session write evidence** — for each
   file listed in finish()'s `deliverables`, there is a corresponding
   write(), edit(), or bash command in the session that created or modified
   that file.

3. **Every claimed deliverable has in-session read-back evidence** — for
   each file listed in finish()'s `deliverables`, there is a read(), bash
   cat/grep, or similar command that confirms the file's contents after it
   was written.

4. **Quantitative claims in the summary trace to tool outputs** — any number
   in the finish summary (pass rates, byte counts, percentages) can be found
   in a prior tool output in the same session.

5. **Unfinished work is reported as partial, not success** — if the task
   required N deliverables and the agent produced fewer than N, the finish
   status is 'partial' (not 'success') and next_steps describes what remains.

## Anti-Patterns

### AP-1: "Ghost Deliverable"

**Pattern**: Agent lists a file in finish()'s `deliverables` that was never
written during the session. The file might exist from a previous session, or
might not exist at all.

**Why it happens**: The agent planned to write the file, spent time thinking
about it, and by session end genuinely believes it was written. The mental
narrative of "I worked on X" becomes "I produced X." This is especially
common when the agent was blocked on prerequisites and pivoted — the
original deliverable stays in the mental checklist even though work shifted.

**Evidence**: eval optimizer_task_tree_2026-03-24: `[C1.5][GHOST_DELIVERABLE_RISK]`
— multiple finishes claimed deliverables without corresponding write/edit
evidence. eval coach s_1774341266928_4: finish claimed deliverables it had
not produced; tool blocked the finish.

**Fix**: Step 3 (VERIFY) catches this mechanically. If you can't read back
the file, you can't claim it.

### AP-2: "Self-Validated Metrics"

**Pattern**: Agent reports specific numbers in finish summary ("92% pass rate,"
"reduced from 18K to 5K bytes") that were computed mentally or estimated rather
than observed in tool output.

**Why it happens**: The agent ran tests or measured files, saw results, then
summarizes from memory rather than quoting the actual output. Memory of numbers
is approximate — "about 90%" becomes "92%" in the summary because it sounds
more precise and authoritative.

**Evidence**: eval s_1774348459409_47: `[SELF_VALIDATION]` — finish includes
'92% pass rate' and strong claims not directly evidenced in visible tool outputs.
eval s_1773992107935_179: `[C26]` — multiple quantitative claims not verifiable
from tool outputs.

**Fix**: Step 4 (REPORT) requires tracing every number to a specific tool output.
If you can't point to the line that says "22/22 passed," don't write "100% pass
rate."

### AP-3: "Promise-Free Execution"

**Pattern**: Agent dives into work without identifying expected deliverables,
then finishes with whatever they happened to produce — which may not match what
the task actually asked for.

**Why it happens**: The task feels clear enough that the agent doesn't need to
plan. They start reading files, making edits, and let the deliverables emerge
organically. By finish time, they list what they did — which may have drifted
from what was asked.

**Evidence**: eval s_1774343027581_9: task required structured report (FM code +
description + method + scenarios) but agent ran tests and finished with an
unstructured summary. eval s_1774345162511_34: no explicit deliverables stated
before state-changing actions; immediately appended to experiments.jsonl and
finished without the required deliverable mapping.

**Fix**: Step 1 (PROMISE) forces the agent to identify deliverables before
starting work. This creates an anchor that prevents drift.
