# Journal

### Iteration 1 — 2026-04-20T19:20:39.740Z
**Worker**: Already committed in a prior step. Good.
**Reviewer**: CONTINUE — **Next iteration should tackle M2 and M3 together** since both require `src/lib/manager.ts`:

1. **M2**: Find the session completion handler in `src/lib/manager.ts` and wire in `extractLessons()` — call it when a session ends with failure/partial status, passing the session transcript and outcome. Store extracted lessons via the reflexion module's persistence layer.

2. **M3**: Find `buildSessionContext()` in `src/lib/manager.ts` and wire in `retrieveLessons()` — retrieve relevant lessons for the agent/task and append them to the context that gets injected into new sessions.

Read `src/lib/manager.ts` first to locate the exact insertion points, then implement both integrations.

