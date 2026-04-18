# Deliverables Checklist — Mode A: Coach 73-op C1.7 regression (2026-04-18 02:30)

- [ ] Read prior finding: `workspace/finding-mode-a-coach-convention-regression-20260418-0030.md`
- [ ] Query 73-op coach session (sessions WHERE agent='coach' AND opCount=73 AND startedAt>Date.now()-6h)
- [ ] Read transcript/jsonl of that session
- [ ] Check if `scripts/convention-check.ts` VERIFICATION_PATTERNS was patched per prior P1
- [ ] Write finding: `workspace/finding-mode-a-coach-c17-regression-20260418-0230.md` with TL;DR, op breakdown, patch-applied?, R1 decision
- [ ] Update `workspace/todo.md` with one-line rotation (Mode A done, next B)
- [ ] Commit both files from `agents/` dir
- [ ] Post-write verification (wc -l, git log) before finish(success)
