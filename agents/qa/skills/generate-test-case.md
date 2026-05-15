# Skill: Generate Test Case (DIVE Reverse-Task)

## Goal
Turn a bug report, failing behavior, or unclear requirement into a **minimal, deterministic regression test** that (1) fails for the buggy behavior, (2) passes for the intended behavior, and (3) prevents future regressions.

This skill is for QA-style work: you are not designing new features. You are encoding the *expected* behavior as an executable example.

## When to Use
- You found a correctness issue during review, but the repo has no test that catches it.
- A bug was fixed, but only manually verified.
- A behavior is ambiguous; you need a crisp executable spec.

## Inputs
- A concrete scenario (bug report, stack trace, user story, or code path suspicion).
- The closest existing test file(s) in `test/`.
- The function/module under test in `src/`.

## Outputs
- A new or updated test that is:
  - **Minimal**: fewest moving parts.
  - **Deterministic**: no time/network/flaky randomness.
  - **Focused**: asserts one behavior.
  - **Readable**: communicates the requirement.

## Method: DIVE “Reverse-Task”
Reverse-Task means you start from the *failure you want to see* (a red test), then work backwards to the smallest setup that reproduces it.

### Step 1 — Define the Failure in One Sentence
Write a single-sentence statement of what must be true.
- Example: “If the handler throws, the cron should clear pending triggers and not re-fire immediately.”

### Step 2 — Find the Narrowest Test Surface
Prefer a unit boundary over end-to-end.
- If a pure function exists → test it directly.
- If only an integration boundary exists → mock dependencies to isolate the behavior.

Heuristics:
- **Don’t** spin up servers or sockets unless the bug is in that layer.
- **Don’t** depend on real timers unless the behavior is timer-specific.

### Step 3 — Build the Minimal Harness
Use existing helpers in `test/` first.
- Look for patterns: fixtures, fake clocks, temp dirs, in-memory stores.

Checklist:
- Control time (`vi.useFakeTimers()` / `vi.setSystemTime()`), if relevant.
- Control randomness (seed it or stub the RNG), if relevant.
- Avoid process-global pollution: restore mocks.

### Step 4 — Write the Red Test First
Encode the bug as an assertion.
- Arrange: smallest state.
- Act: one call.
- Assert: one expectation that would fail under the bug.

Rules:
- Use **specific assertions** (exact error type/message, exact state change).
- Avoid snapshot tests for logic bugs.

### Step 5 — Tighten the Test (Make It Hard to Cheat)
A good regression test should fail if someone reintroduces the bug “in spirit,” not just by matching an exact string.

Techniques:
- Assert on **observable outcomes**: state transitions, return values, emitted events.
- If order matters, assert on ordering.
- If there’s an error path, assert both (a) error surfaced/logged and (b) cleanup performed.

### Step 6 — Add a Companion “Green Path” If Needed
If the red-path is subtle, add one positive-path test to prevent over-fixing.
- Example: “On success, pending triggers are drained.”

### Step 7 — Prove Determinism
Run the test repeatedly or in isolation.
- `npx vitest --run path/to/test --repeat 5`

If flakiness appears:
- remove timing assumptions
- eliminate concurrency (await all promises)
- mock nondeterministic sources

## Patterns (Examples)
### A) Error-path cleanup
- Arrange: dependency throws.
- Act: call the handler.
- Assert: cleanup state is applied even on error.

### B) Idempotency
- Act: call the operation twice.
- Assert: second call is a no-op or yields the same result.

### C) Boundary validation
- Arrange: invalid input.
- Act: call function.
- Assert: throws/returns structured error (and does not mutate state).

## Review Checklist (QA Acceptance)
- [ ] Test fails against the buggy behavior (or would have failed pre-fix).
- [ ] Test passes now.
- [ ] No reliance on real time/network.
- [ ] Assertions are specific and meaningful.
- [ ] Cleanup: mocks/timers restored.

## Notes
If you cannot create a deterministic test without large integration setup, capture that explicitly and consider adding a narrower seam in the production code (but don’t do that as QA unless tasked).
