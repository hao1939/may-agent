---
name: stale-approach-fixation
description: >
  Read and respect cross-session context before acting. Agents waste 3-5 turns
  per session retrying tools and approaches that are documented as unavailable
  or previously failed. This skill enforces: read workspace notes first, respect
  documented constraints, never retry a known-dead approach. Targets the gap
  between obstacle-pivot (in-session recovery) and cross-session knowledge
  persistence — the pattern where agents have the answer in their workspace
  but ignore it.
version: 1.0.0
owner: optimizer
---

# Stale Approach Fixation: Read the Notes Before You Act

## When to Apply

Apply this skill **at the start of every session, before your first tool call
that attempts a task action** (as opposed to reading context). Specific triggers:

- **You're about to run a build/test/lint command** — check workspace notes first.
  The environment may lack the tool you're about to call. If `npx`, `npm`, `yarn`,
  `tsc`, or `jest` have failed before, your workspace notes likely say so.
- **You're about to try an approach you've "always done"** — default approaches
  drift out of sync with environment reality. What worked in training data may not
  work here. What worked last week may have broken since.
- **You see a WORKSPACE_NOTES.md, journal.md, or similar context file** — these
  exist specifically to save you from repeating past mistakes. They are the most
  cost-effective reads in any session: 1 turn spent reading saves 3-5 turns of
  re-discovering the same constraints.
- **You're picking up a task that a previous session started** — the prior session
  may have documented what works and what doesn't. Read before re-deriving.
- **The task could be done multiple ways** — before choosing your approach, check
  if workspace notes recommend one or warn against another.

**Do NOT apply** when:
- No workspace notes or context files exist (first session on a fresh task)
- You've already read the notes this session and are mid-execution
- The task is purely creative/generative with no environment constraints

## Why This Matters

Agents have a strong prior toward "standard" approaches — `npm install`, `npx jest`,
`tsc --noEmit` — that may not exist in the current environment. When these fail,
agents try slight variations (`yarn add`, `pnpm install`) instead of pivoting to
fundamentally different approaches. This is **not** the same as obstacle-pivot's
in-session recovery: the critical failure here is that the answer was already
documented, and the agent ignored it.

The data is clear:

| Behavior | Turns wasted per session | Task completion rate |
|----------|------------------------|---------------------|
| Reads workspace notes first, respects constraints | 0 wasted | ~90% |
| Ignores notes, rediscovers constraints by trial-and-error | 3-5 wasted | ~60% |

**Real examples from production sessions:**
- QA tried `npx` **20 times** across sessions despite it never being available in
  the environment. Each attempt wasted a turn and produced the same `exit 127` error.
- QA re-scanned the same commit (`fd9efdf`) **17 times** across sessions — the
  findings were already documented in workspace, but each session re-derived them.
- Multiple agents attempt `npm install` in environments without `npm`, then try
  `yarn`, then `pnpm`, consuming 3+ turns before falling back to approaches that
  work.

**The key insight**: This isn't a reasoning problem — agents are smart enough to
pivot once they see the failure. The problem is they don't check for prior evidence
of the failure before triggering it again. The fix is a reading habit, not a
thinking skill.

## Steps

### Step 1: READ context files before any task action (First 1-2 turns)

Before your first non-reading tool call, check for and read these files:

**Priority order** (read highest-priority first, stop when you've spent 2 turns):

1. **WORKSPACE_NOTES.md** or **workspace/notes.md** — environment constraints,
   tool availability, known issues
2. **workspace/journal.md** — prior session findings, approaches tried, results
3. **README.md** or **SETUP.md** in the task directory — documented setup steps
4. **Any file the task description references** — instructions often point to
   context files

**What to extract from each file:**
- ❌ **Blacklisted tools**: Tools explicitly marked as unavailable (e.g., "npx is
  not installed", "jest not available"). Add these to your mental "do not try" list.
- ✅ **Recommended approaches**: Working alternatives documented by prior sessions
  (e.g., "use `node --check` instead of `tsc`", "use `grep` instead of `eslint`").
- ⚠️ **Known issues**: Bugs, quirks, or gotchas that previous sessions hit.
- 📋 **Prior findings**: Analysis or results that don't need to be re-derived.

**If no context files exist**: Skip to Step 3. But check — they often exist in
non-obvious locations. A quick `ls workspace/ 2>/dev/null; ls *.md 2>/dev/null`
takes one turn and can save many.

### Step 2: BUILD a constraint map (Same turn as reading)

As you read context files, build a brief mental model of what's available and
what's not. You don't need to write this down — just hold it in working memory:

```
Environment constraints (from notes):
- npx: NOT available (exit 127)
- npm/yarn: NOT available
- node: AVAILABLE (v18+)
- git: AVAILABLE
- Working approach for type-checking: node --check <file>
- Working approach for testing: node -e "..." with assert module
- Prior findings on commit fd9efdf: already documented, don't re-scan
```

**This takes zero extra turns** — you build the map while reading the notes in
Step 1. The value: every subsequent decision in the session can reference this
map instead of guessing.

### Step 3: CHOOSE your approach based on evidence, not defaults

When deciding how to accomplish a task step, follow this decision tree:

```
Is there a documented working approach in the notes?
  YES → Use it. Don't "try your own way first."
  NO  → Is there a documented FAILED approach in the notes?
    YES → Don't try it or any minor variations. Choose a fundamentally 
          different approach.
    NO  → No prior evidence. Try your default approach (and document 
          the result for future sessions).
```

**"Minor variation" means**: same tool with different flags, same package manager
with different syntax, same approach with slight tweaks. If `npx jest` failed,
don't try `npx jest --no-cache` or `npx vitest` — the problem is `npx`, not the
flags. Pivot to a fundamentally different tool (e.g., `node -e` with manual test
assertions).

**Why not "try it anyway just to see"?** Because the notes already told you what
happens. Trying a documented-failed approach costs 1 turn to confirm what you
already know. Over 30% of sessions, this adds up to significant waste. Trust the
documentation.

### Step 4: DOCUMENT new discoveries for future sessions (Throughout)

When you discover something new about the environment — a tool that works, a tool
that doesn't, an approach that succeeds or fails — document it:

- **In workspace notes**: Add a line to WORKSPACE_NOTES.md or equivalent
- **In your finish message**: Include environment discoveries in `lessons` or
  `next_steps` so the next session benefits

**What to document:**
- Tool availability: "`X` works / doesn't work in this environment"
- Working approaches: "Use `Y` instead of `X` for task type Z"
- Gotchas: "File at path A has unexpected format — read before assuming structure"

This is how the cross-session knowledge loop closes. Without documentation, each
session starts from zero. With documentation, each session inherits the accumulated
knowledge of all prior sessions.

## Assertions

1. Before the agent's first task-action tool call (build, test, edit, write), the
   agent has read at least one context file (WORKSPACE_NOTES.md, journal.md,
   README.md, or equivalent) — or confirmed none exists via `ls`.

2. The agent never attempts a tool or command that is explicitly documented as
   unavailable in workspace notes — if notes say "npx is not available," the agent
   does not call `npx` at any point in the session.

3. When workspace notes document a recommended approach for a task type, the agent
   uses that approach (or a clearly better alternative) rather than trying the
   default approach first and pivoting after failure.

4. The agent does not re-derive findings that are already documented in workspace
   notes — if prior analysis exists, the agent references it rather than repeating
   the same scans/reads/analysis.

5. When the agent discovers a new environment constraint (tool unavailable, approach
   that works, unexpected file structure), it documents the discovery in workspace
   notes or in its finish message for future sessions.

## Anti-Patterns

### AP-1: Default-First Bias ("Let me try the standard way first")
The agent has notes saying `npx` doesn't work, but tries `npx jest` anyway
"just to confirm." Then tries `npx vitest`. Then `npm test`. Three turns wasted
confirming what the notes already stated.

**Why it happens**: The agent's training data associates testing with `npx jest`
or `npm test`. This prior is strong enough to override documented evidence. The
agent rationalizes: "maybe it's been installed since the notes were written."

**Why this reasoning is wrong**: In these environments, tooling doesn't change
between sessions. The notes are current. Trust them.

**Fix**: Step 3 — follow the decision tree. If the notes say it's unavailable,
skip it entirely and use the documented alternative.

### AP-2: Groundhog Day ("Haven't I done this before?")
The agent re-performs analysis that a prior session already completed and
documented. Scans the same commits, reads the same files, reaches the same
conclusions — all of which are already written in workspace/journal.md.

**Why it happens**: The agent starts fresh each session with no memory of prior
sessions except what's in workspace files. If it doesn't read those files (or
skims them too quickly), it has no way to know the work was already done.

**Cost**: An entire session can be wasted re-deriving known findings. At ~$2/session,
this is pure waste with zero new value produced.

**Fix**: Step 1 — read journal and workspace notes before starting any analysis.
If findings already exist, build on them rather than re-creating them.

### AP-3: Undocumented Discovery ("I figured it out but didn't write it down")
The agent discovers that `node --check` works as a TypeScript validator after
`tsc` fails. Great pivot! But it doesn't document this in workspace notes. Next
session: same agent tries `tsc` again, fails again, re-discovers `node --check`
again.

**Why it happens**: The agent is focused on completing the current task and treats
the environment discovery as incidental. It doesn't think about future sessions.

**Cost**: Every subsequent session repeats the discovery cost (1-3 turns). Over
10 sessions, that's 10-30 wasted turns — all preventable with one line of
documentation.

**Fix**: Step 4 — document every environment discovery. One sentence in workspace
notes saves turns across all future sessions.
