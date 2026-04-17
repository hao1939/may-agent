# Deliverables Checklist — Mode B Tool Gap (2026-04-17 ~19:00 UTC)

Task: 6h bash pattern scan; find 1–2 multi-step bash patterns ≥3 consecutive calls across ≥2 sessions; propose fix; dispatch if actionable.

## Required deliverables

- [x] **Finding file** `agents/optimizer/workspace/finding-tool-gap-mode-b-0417-2.md`
  — Pattern: "git-when" archaeology (log → show → pickaxe chain). Evidence: 49 git calls across 7 top sessions in 6h; one session burned 20 calls for one question. Proposed fix: `scripts/git-when.sh <path> <pattern>`. Est. savings: 30–60 ops/day. ✅ 125 lines / 8492 bytes.
- [x] **Rotation marker updated** in `agents/optimizer/workspace/todo.md`
  — "Last exploration mode: B (git-when archaeology pattern — Apr 17 ~19:00 UTC). Next rotation: C."
- [x] **Dispatch to tech-lead** P2 with finding path cited.

## Verification evidence

- write tool: finding-tool-gap-mode-b-0417-2.md 125 lines / 8492 bytes.
- bash extraction: 49 git-log+git-show calls across 7 top-opCount sessions in 6h window.
- Prior-work cross-check: excluded gym-transcript (0417), gitignore-detective (0417-1030), scenario-inspect (0417-1430), gym-batch-inspect (0417 17:40 merged).
