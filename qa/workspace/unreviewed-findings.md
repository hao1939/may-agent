# Unreviewed Findings (QA Heartbeat)

Date: 2026-04-27

## Inbox triage

- **Duplicate “Quick Code Review” requests (5x)** — **DISMISS** as waste/duplicate notifications.
  - Reason: alerts indicate identical requests; no unique work items attached.
- **Convention coaching alerts (C8.2 no finish call; C1.4 last tool call must be finish)** — **ACT**.
  - Action taken this heartbeat: will end with `finish()` and maintain tool-call order discipline.
- **Verify new gym scenario EXP-220 (enoent-file-search)** — **ACT (partial)**.
  - Checked `agents/gym/scenarios/` list; EXP-220 not obviously present by name. Need follow-up search/verification.

## Recent changes reviewed

- Reviewed latest commit in `/app/agents` repo:
  - `ca4acc5d6 bob: session state updates`
  - Files: `agents/bob/last-session.md`, `shared/projects/skill-workflow-audit/journal.md`, `shared/projects/skill-workflow-audit/project.md`

### Findings

- `shared/projects/skill-workflow-audit/outputs/workflows-runtest.md` claims **Date: 2025-01-27** and mentions `npx tsx` import tests; potential **staleness/inaccuracy** vs the journal timeline (which is 2026-04-27).
  - This is a documentation-quality issue; no code execution impact.

## Verification

- `tsc --noEmit` in `/app/agents`: PASS (no output, exit code 0).
- `vitest --run` in `/app/agents`: FAIL — `./node_modules/.bin/vitest` missing (likely dependency/tooling not installed in agents repo).

## Next steps

- Locate and verify EXP-220 scenario exists (search by EXP-220 in repo) and ensure it’s correctly named/placed.
- If vitest is expected for `/app/agents`, add dependency or update QA checklist for this repo.
