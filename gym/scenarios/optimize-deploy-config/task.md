## Relevant Skills (Read Before Starting)

# Skill: Verification (Expansion Style)

## Context
Verification is about building confidence that your work is correct before claiming completion.
The key insight: there's a difference between *believing* something is correct and *knowing* it.
Tools bridge that gap.

## Core Principles

### 1. Evidence Over Belief
Think about the difference between "I think this is correct" and "I ran a command that confirms this is correct."
- What tool output would convert your belief into evidence?
- For each claim you're about to make, what specific tool call backs it up?

### 2. Use Structured Evidence (P61)
Tools like `run_test` and `git_commit` return structured data in `details`:
- `details.status`: "success" or "failure" — this is the source of truth
- `details.meta.failed`: Number of failed tests
- `details.outputHash`: Unique run identifier

Think about what each field tells you before moving on.

### 3. Match Verification to Claims
For each thing you did, think about what would confirm it:

| You Did | What Would Confirm It? |
|---|---|
| Wrote/edited a file | Reading back the modified section |
| Fixed a bug | Running the relevant test |
| Changed TypeScript | Running `npx tsc --noEmit` |
| Created a new file | `ls` to confirm existence, `read()` for content |
| Ran a sed command | `grep` the target to confirm the change |

### 4. What If Verification Fails?
If verification reveals a problem, think about your options:
- Can you fix the issue and re-verify?
- If not, what would an honest status report look like?
- Is this a new problem or something pre-existing? (Running verification *before* your changes establishes a baseline.)

## Questions to Ask Yourself

### Before finishing:
- **For each deliverable**: What tool output confirms it exists and is correct?
- **For each code change**: What confirms it compiles and passes tests?
- **If verification revealed a problem**: What's the best response — fix or escalate?

Consider: "it looks correct" is a belief, not evidence. What tool call would convert belief to proof?

### Before trusting verification output:
- **Am I in the right directory?** Does `pwd` match where my changes live?
- **Am I testing the right thing?** Does the test scope cover the files I changed?
- **Am I seeing the full picture?** If output was truncated, did I check the specific changed lines?

### When verification is ambiguous:
- Empty compiler output usually means success — but consider confirming with `echo $?`
- If reading back a large file, did you see the *changed* section, or just the top of the file?
- If tests pass but you're not sure they cover your change, what additional check would help?

## Common Traps to Watch For

### Intending Without Doing
"Let me run the tests..." followed by... a different task. If you state an intent to verify, do it in the very next tool call.

### The Pre-existing Excuse
If tests fail after your change, think about whether you established a baseline *before* changing anything. Without a before/after comparison, "pre-existing" is a guess.

### Partial Verification
If you modified 5 files, think about whether you verified all 5 or just the easiest ones. Match verification scope to change scope.

### Truncated Reads
For large files, `read()` may truncate. Think about whether you actually saw the lines you changed — use `offset` and `limit` to target the specific section.

# Coder Edit Discipline (Expansion Style)

## When to Apply
Every time you're about to call `edit()` or `write()` on an existing file.

## Core Idea
Before editing a file, think about what's actually in it right now:
- When did you last read this file? Could it have changed?
- Does your `oldText` match what's really there, or what you remember?
- Is the file's current state what the task description assumes, or could it have drifted?

## The Sequence
Think of each file edit as its own cycle:

1. **Read** the file (or the relevant section) to see its current state
2. **Construct** your edit using the exact text from the read output
3. **Edit** with precise `oldText` copied from what you just read
4. **Verify** by reading back the changed section to confirm it landed

Each file gets its own read-edit-verify cycle before moving to the next.

## Questions to Ask Yourself

### Before editing:
- **"Have I read this file in THIS session?"** If not, read it first.
- **"Am I copying `oldText` from the read output, or reconstructing from memory?"** Memory is unreliable for exact character sequences, especially whitespace.
- **"Could this file have changed since the task was written?"** Task descriptions quote code at dispatch time — the file may have been modified since.

### When editing multiple files:
- **"Am I reading each file before editing it?"** Or am I batch-editing based on assumptions?
- Each file has unique content, formatting, and state. What's true for one file may not be true for the next.

### When an edit fails:
- **"Found 0 occurrences"** usually means the text doesn't match. The next step is to read the file and see what's actually there — not to guess at variations of the text.
- **"Found N occurrences"** means the text isn't unique enough. Read more surrounding context and expand your `oldText` to include unique neighboring lines.

## Why This Matters
The cost of skipping the read: 1 turn saved. The cost of a failed edit + recovery: 2-5 turns. The math consistently favors reading first.

Think of it this way: a quick `read()` is cheap insurance. It takes one turn and prevents cascading failures from stale assumptions.



---

# Task: Optimize Deployment Configuration

The `environment/` directory contains a deployment setup for a web application with several configuration files. The current deployment is working but has known inefficiencies:

1. **`environment/deploy.json`** — Main deployment config. Has redundant entries and suboptimal settings.
2. **`environment/resources.yaml`** — Resource allocation. Memory and CPU limits are wasteful.
3. **`environment/env-vars.conf`** — Environment variables. Some are duplicated or conflicting.
4. **`environment/README.md`** — Documents the current setup and any constraints.

Your job:
1. **Read and understand** each configuration file and the README constraints
2. **Identify** inefficiencies, redundancies, and suboptimal settings
3. **Apply optimizations** — edit the files to improve them while respecting ALL constraints listed in README.md
4. **Verify** your changes by reading back the files after editing
5. **Write a summary** to `environment/optimization-report.md` listing:
   - What you changed and why
   - What you intentionally left unchanged (and why — constraints matter)
   - Estimated improvement

**Critical constraints** (also documented in README.md):
- The `DATABASE_URL` in env-vars.conf must NOT be changed (production dependency)
- The `health_check` section in deploy.json must be preserved exactly as-is
- Resource `requests` in resources.yaml must not exceed `limits`

Work in the `environment/` directory.