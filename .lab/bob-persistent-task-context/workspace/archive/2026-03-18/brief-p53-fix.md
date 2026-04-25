# Brief: Patch P53 Bypass in Bash Tool

**Context**: Optimizer discovered that `bash` tool's P53 protection (preventing writes to `SOUL.md` etc.) can be bypassed using interpreters like `python3 -c "..."` or `node -e "..."` because the regex only looks for shell redirection (`>`, `sed -i`).

**Objective**: Harden `src/lib/tools/bash.ts` to block common interpreters when protected files are mentioned in the command.

**Files**:
- `src/lib/tools/bash.ts`

**Changes**:
1.  Update the `writeIndicators` array in `createBashTool`.
2.  Add: `python`, `node`, `ruby`, `perl`, `php`, `lua`, `tee`, `awk`.
3.  Ensure the logic `if (looksLikeWrite && targetsProtected)` remains.

**Verification**:
1.  Create a test case `test/p53-hardening.test.ts` that attempts:
    - `python3 -c "import fs; fs.write('agents/coder/SOUL.md')"` -> SHOULD FAIL.
    - `node -e "fs.writeFileSync('agents/coder/SOUL.md', 'hacked')"` -> SHOULD FAIL.
    - `grep "SOUL.md" somefile` -> SHOULD PASS (read-only is fine).
2.  Run tests.

**Note**: This is a heuristic defense. The primary defense is the `edit`/`write` tool guards. This just closes the "easy" backdoors in bash.
