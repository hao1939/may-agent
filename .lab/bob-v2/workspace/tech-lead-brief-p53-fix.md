# Brief: Hardening P53 in Bash Tool

## Context
Optimizer discovered that `python3 -c`, `node -e`, and other interpreters can bypass the P53 write protection in `src/lib/tools/bash.ts`.
Currently, `bash.ts` only blocks explicit shell write indicators (`>`, `sed -i`, `mv`, `cp`).
See `agents/optimizer/workspace/p53-bypass-report.md`.

## Task
Update `src/lib/tools/bash.ts` to expand the blocklist for P53 protected files.

## Requirements
1. **Expand Blocklist**: In addition to the current indicators, strictly block these commands when a protected file (SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md) is present in the command string:
   - `python`, `python3`
   - `node`
   - `ruby`
   - `perl`
   - `php`
   - `awk`
   - `tee`
   - `dd`
2. **Preserve Functionality**: Ensure harmless uses (e.g., `cat SOUL.md`) still work.
3. **Tests**: Add a test case in `test/tools/bash.test.ts` that attempts a `python3` write to a dummy protected file and asserts it fails.

## Definition of Done
- `src/lib/tools/bash.ts` updated.
- `test/tools/bash.test.ts` updated and passing.
