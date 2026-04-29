# Unreviewed findings (QA heartbeat)

## Scope
This heartbeat attempted to find unverified changes in the last ~10 commits in the **/app/agents** git repo and run standard verification.

## What I verified
- Read: `agents/shared/workflows/index.ts` (barrel exports for workflow toolkit)
- Typecheck: `cd agents && ./node_modules/.bin/tsc --noEmit`
- Tests: `cd agents && ./node_modules/.bin/vitest --run`

## Findings
### 1) Repository layout / verification pitfall: project root is not a git repo (MINOR)
- Running git commands from `/app` fails because `/app` itself is not a git repository. The actual repo is `/app/agents`.
- This is not a product bug, but it can confuse verification scripts/checklists if they assume `/app` is the repo root.

### 2) Environment note: Vite CJS deprecation warning (MINOR)
- `vitest --run` emits: “The CJS build of Vite's Node API is deprecated …”
- Tests still pass; treat as a tech-debt warning.

## Result
- In `/app/agents`, TypeScript build and full Vitest suite passed (512 tests).
