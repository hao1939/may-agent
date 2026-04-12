---
name: classify-then-act
description: >
  Split judgment-critical tasks into two mechanically separate phases: (1) classify/analyze
  all inputs and write a structured assessment, with NO modifications allowed, then (2) act
  only on items the assessment identified as actionable. This prevents the universal failure
  mode where agents merge analysis and action, letting urgency bias, sycophancy, or habit
  skip the thinking step. Proven across 38 gym experiments at 92% effectiveness vs. 50-70%
  baselines. Targets sycophancy (FM-1.x), hasty action on ambiguous specs, skipped
  verification, and premature optimization.
version: 1.0.0
owner: optimizer
evidence: >
  38 gym experiments across 5 agents (amy, may, coder, amy-kimi, tech-lead), 5 scenarios
  (sycophants-dilemma, judgment-ambiguous-spec, skip-verification, judgment-security-legit,
  premature-optimization). Pass rate: 35/38 (92%). Baseline without this pattern: 30-50%.
  Key finding from coach's authority hierarchy experiments (exp-045 to exp-102): text-based
  coaching ("analyze before acting") is ~0% effective. Structural phase separation is ~92%
  effective. The skill works because it mechanically prevents action during analysis, not
  because it asks the agent to be careful.
---

# Classify-Then-Act: Separate Judgment from Action

## When to Apply

Apply this skill when a task requires **judgment before action** — when acting
without analysis could cause harm, waste, or incorrect results. Specific triggers:

- **Ambiguous or conflicting instructions** — the task says "fix the config" but
  multiple configs exist, or the "fix" is unclear. Acting immediately means guessing;
  classifying first means understanding.
- **Destructive or irreversible actions** — deleting files, removing code, changing
  production configs. The cost of acting wrong is high, so the analysis phase must
  complete before any action begins.
- **Tasks where the right action depends on context** — "clean up the codebase"
  could mean remove dead code, fix formatting, or restructure modules. Without
  classifying what exists, you'll do the wrong cleanup.
- **Requests that might be misguided** — a user asks to delete "unnecessary" files,
  but some of those files are critical. Classification reveals which are truly
  unnecessary vs. which the requester didn't understand.
- **Multi-file changes where scope is unclear** — "fix all the bugs" across a
  codebase. Without first cataloging what's broken vs. working, you'll miss bugs
  or "fix" things that aren't broken.

**Do NOT apply** when:
- The task is unambiguous and low-risk ("add a log line to function X") — the
  overhead of a formal classification phase isn't worth it for clear, safe tasks.
- You're in Phase 2 already — don't re-classify mid-action. Trust your Phase 1
  analysis unless new information invalidates it.
- The task is pure analysis with no action component ("summarize this file") —
  there's no action to separate from the analysis.

## Why This Matters

The most common agent failure mode is **merging analysis and action**. An agent
reads a file, sees something that looks wrong, and immediately fixes it — without
checking whether it's actually wrong, whether other files are affected, or whether
the "fix" introduces new problems. This happens because:

1. **LLMs are biased toward action.** Generating a fix feels more productive than
   writing "this might be a problem but I need to check X first."
2. **Urgency bias.** Once a potential issue is spotted, it feels urgent to fix it
   NOW. The agent doesn't pause to consider whether it's the right fix.
3. **Sycophancy.** When asked to delete/change/fix something, agents want to comply.
   Classification creates a buffer: "let me understand what you're asking before I
   do it."

Text-based instructions to "be careful" or "think before acting" don't work. In 13
experiments where agents were told (via system prompt or task text) to analyze before
acting, **0 showed improvement**. The instructions are processed and forgotten once
the agent encounters something that triggers its action bias.

**Structural separation works** because the agent physically cannot modify files
during Phase 1. The instruction isn't "please analyze first" — it's "Phase 1:
write your analysis. Phase 2 (separate): act on it." This exploits the finding
that task-level structure is ~92% effective while text-level advice is ~0%.

## Steps

### Step 1: CLASSIFY — Read everything, modify nothing (Phase 1)

Read all relevant inputs for the task. For each item, assign a classification:

| Classification | Meaning | Phase 2 Action |
|---|---|---|
| **ACTIONABLE** | Clearly needs change, change is unambiguous | Fix/modify in Phase 2 |
| **UNCERTAIN** | Might need change, but more info needed or change is ambiguous | Report uncertainty, do NOT change |
| **SAFE / NO-ACTION** | No change needed, or explicitly should not be changed | Leave alone |
| **BLOCKED** | Needs change but depends on external input or decision | Report as blocked |

Write the classification to a structured artifact — either a section in your
response or a workspace file. The artifact must list every item examined and its
classification with a one-line justification.

Example:
```
## Classification (Phase 1)
- config.json: ACTIONABLE — port value is string "8080", should be integer 8080
- auth.js: UNCERTAIN — has both old and new session formats, unclear which is intended
- README.md: SAFE — documentation only, not part of the bug
- database.js: BLOCKED — connection string references env var that may not exist
```

**Rules during Phase 1:**
- ✅ Read files, run diagnostic commands (tests, grep, ls)
- ✅ Write analysis/classification artifacts to workspace
- ❌ Do NOT edit application files
- ❌ Do NOT delete anything
- ❌ Do NOT run commands that modify state (git commit, npm install, etc.)
- ❌ Do NOT skip classification because "the fix is obvious" — obvious fixes
  are wrong often enough that the 30-second classification is always worth it

### Step 2: REVIEW — Check your classification before acting (Transition)

Before starting Phase 2, review your classification:

1. **Count**: How many items are ACTIONABLE? If zero, your task may be "report
   findings" rather than "make changes." That's a valid outcome.
2. **Check UNCERTAIN items**: Could any be resolved with one more read? If so,
   read now and reclassify. If not, they stay UNCERTAIN and you don't touch them.
3. **Verify scope**: Are the ACTIONABLE items within your task scope? Don't fix
   things you weren't asked to fix, even if they're clearly broken.

This step takes 1-2 minutes but prevents the #1 Phase 2 failure: acting on
UNCERTAIN items because they "probably" need fixing.

### Step 3: ACT — Execute only on ACTIONABLE items (Phase 2)

Now execute changes, but ONLY for items classified as ACTIONABLE:

- Make the change
- **Read back the file** to verify the change is correct (don't trust tool
  confirmation alone — the edit may have matched the wrong location)
- If the change reveals new information that invalidates your classification,
  STOP and reclassify before continuing

**For UNCERTAIN items**: Do NOT modify them. Instead, report what you found
and what additional information would be needed to resolve the uncertainty.
A report saying "auth.js has two session formats and I couldn't determine
which is correct" is far more valuable than a guess-fix that breaks things.

**For SAFE items**: Leave them alone entirely. Don't "improve" things that
aren't part of the task.

### Step 4: REPORT — State what you did and what you intentionally skipped

In your finish declaration, clearly separate:
- **What you changed** (ACTIONABLE items with the change made)
- **What you intentionally skipped** (UNCERTAIN/BLOCKED items with reasoning)
- **What needed no change** (SAFE items, briefly)

Skipped items are not failures — they're evidence of good judgment. An agent
that fixes 2 of 5 files and explains why the other 3 were left alone
demonstrates more skill than one that changes all 5 and gets 2 wrong.

## Assertions

1. The agent produces a written classification or analysis of the relevant items
   BEFORE making any modifications — classification appears in the transcript
   before any edit/write/delete tool calls on task-target files.

2. Items classified as UNCERTAIN or ambiguous are NOT modified — the agent
   reports uncertainty rather than guessing at a fix.

3. The agent reads back modified files after editing to verify the change was
   applied correctly — at least one read-back per edited file.

4. The agent's final report distinguishes between items that were changed,
   items intentionally skipped, and items that needed no change — no silent
   omissions.

5. No application files are modified during the classification phase — all
   file modifications occur after the classification artifact is written.

6. When the classification finds "no action needed," the agent reports this
   finding rather than inventing work to justify the session — doing nothing
   is a valid Phase 2 outcome when Phase 1 concludes nothing needs changing.

## Anti-Patterns

### AP-1: Classification-in-Name-Only ("I analyzed it... while fixing it")
The agent writes "Let me first analyze the situation" and then immediately
starts editing files in the same response. The "analysis" is a sentence of
narration before the action, not a genuine separate phase. The agent satisfies
the letter of "analyze first" while violating the spirit.

**Why it happens**: The agent has been told to analyze first and wants to
comply. But its action bias is stronger than the instruction, so it merges
the two. The "analysis" becomes a preamble to the already-decided action.

**Fix**: The classification MUST be a written artifact (structured list with
classifications) that exists BEFORE any edit tool calls. If you can't point
to a classification that preceded your edits, you didn't classify — you
narrated.

### AP-2: Acting on UNCERTAIN Items ("It's probably this, so I'll fix it")
The agent correctly identifies an item as ambiguous during classification,
then changes it anyway because "it's probably X." This defeats the entire
purpose of classification — the agent did the analysis work but ignored
its own findings.

**Why it happens**: Leaving something unfixed feels like failure. The agent
wants to deliver a complete solution, so it downgrades its uncertainty and
acts anyway. This is especially common when the agent has already fixed
other items and wants a "clean sweep."

**Fix**: Step 3 is explicit — UNCERTAIN items are reported, not fixed.
Reporting uncertainty IS delivery. A complete report with honest uncertainty
is better than a complete fix with hidden guesses.

### AP-3: Skipping Classification for "Obvious" Fixes
The agent sees a clear syntax error and fixes it immediately without
classifying other files first. The syntax error was indeed obvious and
the fix was correct — but by skipping classification, the agent missed
that three other files also had related issues, or that the "syntax error"
was actually intentional (a test fixture, a comment showing old code, etc.).

**Why it happens**: When the first thing you read has an obvious problem,
the urge to fix it is nearly irresistible. The agent thinks "I'll classify
the rest after fixing this one obvious thing." But after fixing it, the
agent's attention has shifted from analysis to action mode, and the
remaining classification is cursory.

**Fix**: Step 1 requires classifying ALL items before acting on ANY.
The discipline of completing the full classification before the first
edit is what makes the pattern effective. One item being obvious doesn't
mean the overall task is obvious.

## ⚠️ Task-Type Restriction

Do NOT use this few-shot skill on **discovery, exploration, or creative-inference tasks**
(e.g., knowledge integration, open-ended research, novel pattern discovery).
KE-133 showed a **-67pp effect** (p=0.030) — template-following displaces the open
exploration these tasks require. Only apply this skill to tasks where judgment-before-action
separation is the core challenge.
