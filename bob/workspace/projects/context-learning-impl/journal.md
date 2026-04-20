# Journal

### Iteration 1 — 2026-04-20T19:20:39.740Z
**Worker**: Already committed in a prior step. Good.
**Reviewer**: CONTINUE — **Next iteration should tackle M2 and M3 together** since both require `src/lib/manager.ts`:

1. **M2**: Find the session completion handler in `src/lib/manager.ts` and wire in `extractLessons()` — call it when a session ends with failure/partial status, passing the session transcript and outcome. Store extracted lessons via the reflexion module's persistence layer.

2. **M3**: Find `buildSessionContext()` in `src/lib/manager.ts` and wire in `retrieveLessons()` — retrieve relevant lessons for the agent/task and append them to the context that gets injected into new sessions.

Read `src/lib/manager.ts` first to locate the exact insertion points, then implement both integrations.

### Iteration 2 — 2026-04-20T19:24:13.639Z
**Worker**: All 19 tests pass (9 original + 10 new).
**Reviewer**: CONTINUE — Now I have a clear picture. M1 is done (lessons.ts + lessons-hooks.ts + tests). But M2 and M3 require wiring into `manager.ts` — and **there is no `manager.ts` in the codebase** (outside of gym scenario environments). The hooks are prepared in `lessons-hooks.ts` with clear integration comments, but the actual manager file doesn't exist in this repo.

CONTINUE — **M2 and M3 cannot be completed as described** because `src/lib/manager.ts` does not exist in this codebase. The `lessons-hooks.ts` file already provides ready-to-wire `onSessionFinish()` and `getLessonsContext()` functions with integration instructions, but the actual session management code (where `finish()` is processed and `buildSessionContext()` lives) is not in this repository — it's likely in the platform/infrastructure layer outside this repo.

**Recommendation for next iteration: Skip M2/M3 (mark as blocked/external) and proceed to M4 (reflexion gym experiments)**:

1. Look at existing gym scenarios in `agents/gym/scenarios/reflexion-npx-recovery/` and `reflexion-read-before-edit/` to understand the experiment format.
2. Read `agents/src/gym/runner.ts` to understand how to run gym experiments.
3. Design a baseline vs treatment comparison: run scenarios WITHOUT lessons injected, then WITH lessons pre-seeded, and measure pass rates.
4. Execute the experiments and record results.
5. If gym experiments complete, write `phase2-results.md` (M5) documenting the quantitative comparison.

Mark M2 and M3 as **blocked on external dependency** (`manager.ts` is not in this repo; `lessons-hooks.ts` provides the integration surface — wiring must happen in the platform repo).

