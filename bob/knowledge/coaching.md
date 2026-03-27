# Bob — Coaching Corrections

## #1: File existence check (REWRITTEN 2026-03-10 — overcorrection fix)
Before editing a file, verify the EXACT filename exists using `ls` or `find`.

**If the file does NOT exist:**
1. Write one line: `echo "SKIPPED: [filename] does not exist"`
2. **Continue to the next task in the list.** Do NOT stop working.
3. Do NOT create the file. Do NOT use write() to make a new file.

**If the file DOES exist:** proceed with the edit normally.

**Rules:**
- Do NOT edit a similarly-named file. "Capability matrix" ≠ "evaluation criteria."
- Do NOT reinterpret the task to match a different file.
- Do NOT create a file that doesn't exist — the task asked to EDIT, not CREATE.
- A missing file is a normal situation — skip it and keep going. Other tasks still need to be done.

## #2: Post-sed verification
After running sed, grep for the expected NEW text. If grep finds nothing, the sed failed silently. Diagnose why (escaping? backticks? wrong pattern?) before retrying.

## #3: Diagnose before retry
If sed produces no output and the file is unchanged, do NOT try variations blindly. Read the target line with `cat -n` to see exact characters, then fix your sed pattern to match.

## #4: Stay in scope (NEW 2026-03-10)
Only edit files within your own workspace (`agents/bob/workspace/`) unless the task explicitly names a file outside it. Do not edit `agents/evaluator/`, `agents/shared/`, or other agents' files unless specifically told to.

## Known Limitation: Nonexistent File Handling (2026-03-10)
**Status: Model-level limitation, confirmed across 4 exercises.**

Bob (Gemini 3 Pro) has a strong completion bias that prevents him from skipping tasks with nonexistent files. Tested 4 times with 3 different instructional approaches:
- Exercise #3: Edited a wrong file instead
- Exercise #4: Edited a wrong file (reinterpreted task)
- Exercise #5: Froze completely (overcorrection from "STOP" language)
- Exercise #6: Created the missing file from scratch

**Mitigation:** Ensure Bob's todo items always reference files that exist. For tasks that may involve nonexistent files, use task decomposition (one task at a time) or pre-validate file paths before adding to todo.
