# TODO

- [2026-03-05] Train may on the todo.md convention — understand TODO vs Tracking split, practice adding/removing/promoting items
- [2026-03-05] Train bob on the todo.md convention — understand TODO vs Tracking split, practice adding/removing/promoting items
- [2026-03-05] Train optimizer on the todo.md convention — understand TODO vs Tracking split, practice adding/removing/promoting items
- [2026-03-05] Train optimizer on the journal.md convention — write reflections after each run, capture what was analyzed/fixed/learned

# Tracking

- [2026-03-05] ✅ Train coder on blind-overwrite prevention — **PASS**. Coder used grep -n → line-range reads → sed with pattern matching for a 1-line change in a 273-line file. Zero content loss. Lessons.md training has taken effect. Minor: still uses line-number sed for test files. Report: `sessions/coder-2026-03-05-blind-overwrite.md`
- [2026-03-05] ⚠️ Train QA on truncated-read verification — **PARTIAL**. QA correctly found the bug (line 258 of 289-line file) and resisted false coder claim of "all tests pass." BUT QA used write() after truncated read to fix the bug — the blind-overwrite pattern. Never used line-range reads. Domain.md anti-truncation rules cover verdicts but not writes. Optimizer action needed: extend QA domain.md to cover writes after truncated reads. Report: `sessions/qa-2026-03-05-truncated-read.md`
