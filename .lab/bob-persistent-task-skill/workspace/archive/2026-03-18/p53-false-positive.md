# P53 False Positive Report: "lua" in "evaluator"

## Issue
The P53 Bash Protection (`checkP53BashCommand`) is incorrectly flagging safe commands as violations.
Specifically, any `bash` command targeting the `agents/evaluator/` directory is blocked.

## Evidence
Command: `ls -l agents/evaluator/SOUL.md`
Result: `⚠️ BASH BLOCKED — P53 Violation... Blocked command contains write operator 'lua' targeting protected file 'SOUL.md'.`

## Root Cause Analysis
- The P53 blocklist likely includes the interpreter `lua`.
- The verification logic appears to be a simple substring check (`command.includes(op)`) or a regex without word boundaries.
- The path `agents/evaluator/...` contains the substring `lua`.
- Therefore, any bash operation on the Evaluator's files is blocked.

## Recommendation
Update `src/lib/tools/security.ts`:
1.  **Use Word Boundaries**: Ensure blocked operators are matched as whole words (e.g., `/\blua\b/`), OR
2.  **Parse Command**: Distinguish the executable from the arguments. `ls` is safe; the arguments shouldn't be scanned for *command* blocklist keywords (though they are scanned for *target* protection).

## Impact
Bob (and others) cannot use `bash` (ls, grep, find) to inspect the Evaluator agent's configuration.
