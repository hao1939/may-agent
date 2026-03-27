# Behavior Conventions

How agents should act — tool usage patterns, verification, error handling,
escalation. These are the behavioral standards the evaluator checks.

## B1: Read Before Write (Required, Builder)

Never write to a file without first reading the relevant section. This prevents
the blind-overwrite pattern — one of the most common and damaging agent failures.

Good:
```
read("src/manager.ts", { offset: 140, limit: 30 })  // read the area
write("src/manager.ts", { ... })                      // then edit
exec("npm run check")                                 // then verify
```

Bad:
```
write("src/manager.ts", { ... })  // blind overwrite — may lose content
```

After compaction, an agent's memory of file contents is a *summary*, not the
actual content. Writing from memory produces partial/truncated files.

## B2: Verify After Every Change (Required, Builder)

After editing code or config, verify immediately:
- `npm run check` or `npx tsc --noEmit` for TypeScript
- Run relevant tests if they exist
- Read back the changed section to confirm correctness

Don't wait until the end of a task to verify. Early verification catches
problems when they're cheap to fix.

## B3: Line-Range Reads for Large Files (Required, All)

If a file is >100 lines, use `offset` and `limit` — never read the whole thing
into context. For files <100 lines, full reads are fine.

Good: `read("src/manager.ts", { offset: 400, limit: 50 })`
Bad: `read("src/manager.ts")` on a 2400-line file

## B4: Don't Re-Read Within a Session (Recommended, All)

If you read a file earlier in this session, don't read it again unless it was
modified since your last read. Your earlier read is still in conversation context.

This saves tool calls and context space. Exception: after compaction, if you
need precise content (not just the gist), re-reading is justified.

## B5: Stay In Scope (Required, All)

Each agent has a defined domain. If a task falls outside it:
1. Flag it explicitly ("This is outside my domain")
2. Recommend the right agent
3. Don't attempt the work

Scope creep wastes tokens and produces lower-quality results than routing
to the domain expert.

## B6: Report Failures, Never Fabricate (Required, All)

If a tool fails or information is missing, report the failure explicitly. Never:
- Make up file contents
- Invent command output
- Pretend a task succeeded when it didn't
- Guess at data you haven't verified

Empty/ambiguous results are worse than explicit failures.

## B7: Use Project-Relative Paths (Required, All)

The Runtime Environment section in the system prompt shows:
- Project root (exec cwd)
- Agent directory (e.g., `agents/coach/`)
- Agent files (e.g., `DOMAIN.md, LESSONS.md, SOUL.md, TOOLS.md, heartbeat.md`)
- Workspace path (e.g., `agents/coach/workspace`)

Always use paths relative to the project root:

Good: `read("agents/coach/workspace/todo.md")`
Bad: `read("/home/user/SOUL.md")` — absolute path, will break across environments
Bad: `read("workspace/todo.md")` — ambiguous, may resolve wrong

If you need a path and don't have it, check the Runtime Environment first.
Then DOMAIN.md. Then `exec("ls agents/<name>/")`. Never `find / -name "..."`.

## B8: Escalate After 2 Attempts (Required, All)

If the same approach fails twice, stop and escalate:
1. Mark the item `[STUCK]` in todo.md with a clear reason
2. Write a journal entry explaining what was tried
3. Move on to the next task or end the session

Spinning on a failing approach wastes tokens and produces no value.
A different agent, a different approach, or human input will break the impasse.

## B9: Evidence-Based Claims (Required, All)

Claims should trace to something observable: file contents, command output,
evaluation data, or explicit instructions. "I believe X" without evidence
is not actionable. "File Y at line Z shows X" is.

## B10: Surgical File Updates (Recommended, Builder)

For updating a section in a large file:
1. `exec("grep -n 'pattern' file.md")` to find the line number
2. `read(file, { offset, limit })` to read just that section
3. Write the precise update

Bad: reading the entire file 6 times trying to find the right section.
Bad: rewriting the entire file to change one paragraph.

For append operations, `exec("echo '...' >> file.md")` is often simpler
and safer than reading + rewriting.

## B11: Claim Before Act (Required, All)

Before taking action, state what you plan to do and why. Every significant
step should be preceded by a brief claim:

Good:
```
I'll update the validation logic in src/validate.ts to handle empty strings.
The current code at line 42 doesn't check for this case. After the edit I'll
run the tests to verify.

[tool call: read("src/validate.ts", { offset: 40, limit: 10 })]
```

Bad:
```
[tool call: read("src/validate.ts")]
[tool call: write("src/validate.ts", ...)]
[tool call: exec("npm test")]
```

The claim doesn't need to be long — one or two sentences. The point is
legibility: anyone reading the transcript should understand the agent's
intent without reverse-engineering it from tool calls.

This enables:
- **Coaching**: coach can intervene before a mistake happens
- **Auditing**: evaluator can assess planning quality, not just outcomes
- **Debugging**: transcripts are readable without replaying every tool call
- **Human oversight**: user can redirect before tokens are wasted

See philosophy.md #46.

## B12: Pattern-Based Sed for Edits (Required, Builder)

When using sed for file edits, always use pattern-based addressing, never
line-number addressing. Line numbers shift after any modification, making
line-number edits fragile and error-prone.

Good:
```
exec("sed -i 's/function oldName/function newName/' src/utils.ts")
exec("sed -i '/class MyClass/,/^}$/s/private count/private _count/' src/utils.ts")
```

Bad:
```
exec("sed -i '42s/oldName/newName/' src/utils.ts")   // line 42 may shift
exec("sed -i '85 a\\newline' file.md")                // fragile line reference
```

Pattern-based sed is self-documenting (the pattern explains *what* is being
changed, not just *where*) and robust across file modifications within the
same session.

Also avoid GNU-sed-specific features (`e` command, etc.) — stick to
POSIX-compatible sed for portability.

**Evidence:** 5 evaluator violations from Coder sessions using line-number
sed during COACHEES.md split (2026-03-10). Pattern-based sed exercises
(Coder graduation, QA exercises) consistently PASS.
