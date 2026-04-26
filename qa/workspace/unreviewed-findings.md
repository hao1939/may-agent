# QA Heartbeat — Unreviewed Findings (2026-04-26)

## Inbox triage (agent.notification)
- Duplicate “Quick Code Review” waste alerts (5 copies): **DISMISS as duplicates**. Action: treat as one; no distinct work items.
- Convention coaching: **ACT** — I investigated root causes this heartbeat (see below).
- Verify new gym scenario EXP-220: **ESCALATE/BLOCKED** — I cannot verify because `/app` is not a git repo and there is no obvious path to the EXP-220 scenario without broader repository context.

## Environment / process issues discovered (evidence-based)
1) **/app is not a git repository**
   - Evidence: `git log --oneline -10` and `git status` from `/app` both failed with: `fatal: not a git repository (or any of the parent directories): .git`.
   - Impact: prevents standard “what changed in last 6h” verification at system root.

2) **TypeScript project configuration missing**
   - Evidence: `./node_modules/.bin/tsc --noEmit` printed CLI help and exited code 1, consistent with no `tsconfig.json` and no input files.
   - Impact: QA mandatory step cannot meaningfully validate compilation.

3) **Vitest not installed**
   - Evidence: `./node_modules/.bin/vitest --run` failed: `No such file or directory`; `node_modules/.bin` contains only `tsc` and `tsserver`.
   - Evidence: `/app/package.json` lists only `typescript`.
   - Impact: QA mandatory test step cannot run in this environment.

## One reviewed file (changed in agents repo)
- `agents/scout/reports/heartbeat-2026-04-26.md`: looks like a routine heartbeat report; no code.

## Recommendations
- If QA is expected to run `tsc` + `vitest` at `/app`, the repo should include `tsconfig.json` and `vitest` as a dependency/devDependency.
- Otherwise, QA policy/guards should target the correct repository (likely `/app/agents`) and use the actual test toolchain there.
