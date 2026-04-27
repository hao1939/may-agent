## Relevant Skills (Read Before Starting)

# Budget-Before-Act (Expansion Style)

## When to Apply
At the start of any task that requires producing a deliverable (file, code change, analysis, plan).

## Why This Matters
The most common way sessions fail is: the agent explores thoroughly, understands the problem deeply, and runs out of turns before writing anything. The exploration was valuable but produced zero deliverable.

The key insight: sessions rated highest aren't the ones that explore most thoroughly — they're the ones that produce deliverables. A partial deliverable with honest `status: "partial"` is more valuable than a complete analysis with no output file.

## Thinking Prompts

### At the Start: Think About Your Turn Budget
Before diving in, consider:
- How many turns will each requirement cost? Which are highest-value?
- What's the minimum viable deliverable if you run short on time?
- If you can only finish one thing, which requirement matters most?

**Rules of thumb:**
- Reading one file + understanding: ~1 turn
- Reading multiple files for context: ~2-3 turns
- Writing/editing one file with verification: ~2-3 turns
- Running tests + interpreting: ~1-2 turns
- Each failed attempt + recovery: ~2 turns
- Finish/cleanup: ~1 turn

### Early On: Create a Deliverable Skeleton
After initial reading (think: 2-3 turns max), consider creating your output file — even if it's mostly placeholders:
- A code file with TODO comments for each section
- A report with headers and placeholder findings
- A plan with structure but incomplete details

Why? Even if the session ends unexpectedly, the skeleton communicates structure and intent.

### At the Halfway Point: Check Your Progress
Pause and think about:
- Does the deliverable file exist yet? If not, this is the moment to stop exploring and start writing.
- Does it contain real content, not just placeholders?
- Have you addressed the highest-priority requirement?
- Are you on track to finish, or do you need to scope down?

### At 75%: Shift to Refinement
Think about what's left:
- Read back your output — does it make sense as a standalone document?
- Are there remaining placeholders that need filling?
- What's the one thing you'd most regret not finishing?
- This is not the time to start new multi-turn exploration.

### At the End: Finish Honestly
Consider what you actually delivered:
- If everything is done: great, report success with specific deliverables.
- If partially done: report partial completion with what's done and what remains. This is correct behavior, not failure.
- If blocked: describe the blocker and what you tried.

A partial deliverable honestly reported is always better than a "success" with hidden gaps.

## Questions to Keep in Mind

- **Am I exploring or producing?** If you've been reading for many turns, consider writing what you know so far.
- **What would I write right now if this were my last turn?** If the answer is "nothing," you're behind on delivery.
- **Have I silently dropped any requirements?** If so, acknowledge them explicitly rather than hoping no one notices.

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



---

# Skill: Task Compliance

**Trigger**: Any task with numbered steps, referenced files, or "create/follow template" instructions.

## Protocol

### Step 1: Resource Enumeration
Before doing ANY work, scan the task description and list every file, directory, or resource mentioned. Write the list explicitly.

### Step 2: Read All Referenced Resources
Read EVERY file and explore EVERY directory mentioned in the task. Do not skip any. If the task mentions a directory, `ls` it and read representative files. If it mentions a template, read the template fully before proceeding.

**Anti-pattern**: Reading only the first mentioned file and starting work immediately. You MUST read ALL referenced resources before producing output.

### Step 3: Create vs Modify Distinction
When the task says "create X following/using template Y":
- **DO**: Create a NEW file at path X, populated with content inspired by template Y
- **DON'T**: Edit or modify template Y directly

When the task says "modify X" or "update X":
- **DO**: Edit the existing file X

**Anti-pattern**: Treating "create following template" as "edit the template". Templates are read-only references.

### Step 4: Verify Completeness
Before finishing, re-read the task and check each numbered step or requirement. Confirm you completed ALL of them, not just the ones that seemed most important.

## Assertions
- [ ] Every referenced file/directory was read before producing output
- [ ] Template files were not modified (if task said "create following template")
- [ ] All numbered steps in the task were addressed
Create a new knowledge entry from experiment results.

You have experiment results in `data/experiment-results.md`. Create a knowledge entry following the project's format.

1. **Read** `data/experiment-results.md` to understand the finding
2. **Read** `knowledge/entries/KE-TEMPLATE.md` to understand the format
3. **Create** `knowledge/entries/KE-042.md` following the template structure, populated with the experiment findings
4. **Verify** the new file exists and contains all required sections

Required sections: Title, Summary, Evidence, Recommendation, Tags