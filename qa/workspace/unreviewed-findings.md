# QA Heartbeat — Unreviewed Findings (2026-04-26)

## Inbox triage (agent.notification)
- Waste detected: 5 identical “Quick Code Review” requests: **DISMISS** as duplicates (treat as one; no distinct work items).
- Convention coaching (C1.4 last tool call must be finish): **ACT** — verified current heartbeat ends with `finish()` and documented environment mismatches that can cause compliance churn.
- Verify new gym scenario EXP-220 (enoent-file-search): **ESCALATE/BLOCKED** — scenario not present under `agents/gym/scenarios` in the `/app/agents` repo available in this session.

## Environment / verification blockers (evidence-based)
1) **`/app` is not a git repository**
   - Evidence: `git log --oneline -10` from `/app` failed with `fatal: not a git repository (or any of the parent directories): .git`.
   - Impact: cannot follow the usual “scan recent commits” process at `/app`.

2) **Vitest not installed in `/app/agents` repo**
   - Evidence: `cd /app/agents && ./node_modules/.bin/vitest --run` failed: `No such file or directory`.
   - Evidence: `cd /app/agents && ls node_modules/.bin | head` shows `tsc` but no `vitest`.
   - Evidence: `cd /app/agents && cat package.json` lists only `puppeteer-core` deps and `typescript` devDep.
   - Impact: mandatory QA step “run vitest” cannot be completed here.

3) **TSC check in `/app/agents` is non-informative**
   - Evidence: `cd /app/agents && ./node_modules/.bin/tsc --noEmit` produced no output (exit code not visible in tool output).
   - Impact: can’t conclusively assert compile success from captured evidence alone.

## One reviewed changed file (agents repo)
- Commit `674f86639` only changed `amy/last-session.md` (from `git show --name-only --oneline 674f86639`).
  - Note: I did not review file contents in this heartbeat because it appears to be non-code session notes; if required, request explicit review target.

## Recommendation
- Clarify which repo QA should verify (root `/app` vs `/app/agents`) and ensure the required toolchain (Vitest) exists there, or update QA policy to match the repo’s actual test runner.
