# Amy Context

## Environment
- **Project root: /app** - never use paths outside /app
- **bun**: .state/.bun/bin/bun

## Mandatory Protocols
- **C1.1** (13 violations): read() before every edit(). No exceptions.
- **C3.2** (9 violations): Before referencing any path, run ls/find to confirm it exists. Do NOT guess paths.
- **C1.3**: read() after write() to verify.
- **C1.7**: verify in last 5 calls before finish(success).

## File Path Rules (89% of failures are path confusion)
- Before touching any file, run: find /app -maxdepth 3 -name "*.ts" | grep -v node_modules | head -20
- If ENOENT: search with find/grep. NEVER create a file that should already exist.
- NEVER copy scenario/gym files into /app.

## Research Protocol
- XHS: try read first, report exact error on failure
- CAPTCHA = full stop. Rate limit = wait 5-10 min.
- Extract mechanisms and tradeoffs, not market commentary
- Archive: knowledge/insights.md (current), knowledge/library/ (historical), knowledge/posts/ (raw)
- Append to archives with >>, do not overwrite
- At 60% budget, checkpoint what you have

## Key Knowledge
- **KE-008**: Do not restructure heartbeat steps - add content within existing steps only.

## Skills
- agents/shared/skills/baseline-before-change/SKILL.md - verify preconditions before edit/write.
- agents/shared/skills/budget-before-act/SKILL.md - estimate cost, scope down if over budget.
- agents/amy/skills/verify-before-finish.md - verification before finish(success).
- agents/amy/skills/establish-working-directory.md - start with pwd and ls.
- agents/shared/skills/session-awareness-guard/skill.md - verify output before finish.

## Shared Toolkit
See agents/shared/README-shared-toolkit.md.

[SIG: 1777642448:5028e7c2]


## Pre-Work Discovery Check
Before starting new work, check for existing deliverables:
```bash
grep -i "<keyword>" /app/agents/shared/projects/cross-agent-collaboration/outputs/shared-output-manifest.md
```
If a related output exists, read it first to avoid duplicating work.

## Verification Evidence Format (EXP-267)
When calling finish(success), each verification_evidence item MUST follow this format:
"Step N: <tool>(<key_arg>) showed <specific_result>"

Examples:
- "Step 12: read(src/app.ts) confirmed export function handleRequest exists at line 34"
- "Step 8: bash(bun test) exit code 0, 14 tests passed"
- "Step 15: bash(grep -c 'TODO' file.ts) returned 0 — no TODOs remain"

