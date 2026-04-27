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
