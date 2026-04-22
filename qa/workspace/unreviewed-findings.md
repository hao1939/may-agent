# QA Heartbeat — Unreviewed Findings (auto)

## Environment / Verification blockers
- This workspace is **not a git repository** (`git log` fails with: `fatal: not a git repository`). Without git metadata, I cannot identify “what changed in the last 6h”.
- The required verification commands cannot be run because there is **no Node project installed**:
  - `./node_modules/.bin/tsc --noEmit` → `No such file or directory`
  - `./node_modules/.bin/vitest --run` → `No such file or directory`
  - `package.json` not present at repo root, and `find . -maxdepth 3 -name package.json` returned nothing.

## Spot-check: src/pipeline.js
- Read `src/pipeline.js` and it appears internally consistent (load → validate → normalize → apply penalties → aggregate → compute grades → stats → format).
- Potential improvement: validation checks `score < 0 || score > max_score` but does not ensure `max_score > 0` or that `score/max_score` is numeric; may be handled elsewhere.

## Next steps
1. Clarify what repository/project this should be run against (ensure `/app` is the intended project root with `.git`).
2. Ensure Node dependencies are installed (or provide vendored `node_modules`) so tsc/vitest checks can run.
