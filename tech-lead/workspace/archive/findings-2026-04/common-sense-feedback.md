# Feedback on agents/shared/common-sense.md (tech-lead)

## 1. Does it match how I actually work?

Mostly yes. Specific matches:
- **Heartbeats-as-exploration**: my lens rotation (A/B/C/D) is exactly the "discover/create" use the doc describes. Good.
- **Project status discipline**: the four states (active/paused/blocked/pending-review/done) match what I enforce for persistent-task projects. Good.
- **Escalation chain**: I do push back on weak briefs from Bob, consistent with "escalate, don't burn cycles."

Mismatches / friction:
- **Persistent tasks.** In practice I rarely create one per heartbeat finding. Heartbeats mostly fork one-shot lens-analysis or implement-and-verify workflows, not projects. The doc implies projects are the default unit; for me, the default unit is a single bounded workflow run. That's fine, but the doc doesn't acknowledge the "single-session finding" pattern.
- **"Don't exit early."** My heartbeat contract is the opposite: after dispatch, finish() within 3 ops. That's deliberate (prevents heartbeat bloat) and conflicts with the prose "don't waste them … exiting early." Worth reconciling — dispatching IS the work, not exiting early.

## 2. Anything important missing?

- **Dispatch-and-exit pattern.** The heartbeat rule "after fork/workflow.run, finish() within 3 ops" is load-bearing for keeping heartbeats lean. It's not in common-sense.md but it's closer to how I actually operate than "use heartbeats to create."
- **Workflow as default, not option.** "Workflows (Process)" is present but soft. In my agent doc it's stronger: *workflows are habits, not optional tools*. That framing prevents the raw `agents.call` anti-pattern for lens work. Worth promoting.
- **Read-before-edit (C1.1).** "Verify every write" is covered, but the symmetric rule — read before edit — isn't. It's a real failure mode (FM-1.3 non-exact oldText) that cost me ops recently.
- **Bounded scope for delegation (KE-013/KE-003).** Delegation quality correlates strongly with bounded tasks + explicit file scope. Doc doesn't mention this; it's the single biggest lever on delegated-session success.
- **Review gate.** Direct commits to main are blocked; src/ changes go through `review/<session-id>` branches. Environment section should mention this — it's bitten me.

## 3. Minor

- "Filesystem root is `/app`" — good, keep. Add: "`sqlite3` CLI and `npx` are unavailable; use `bun -e` / `./node_modules/.bin/`."
- "Commit before finish()" is right for agent files, but src/ changes go through the review-gate branch flow, not direct commit. One-liner would help.

Overall: directionally accurate, under-specifies the dispatch-and-exit heartbeat pattern and a few environment quirks.
