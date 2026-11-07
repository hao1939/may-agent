<ai_context>
summary: "Pinned Andon source treats a passing test run as revocable verification credit: a later recognized file edit in the same session makes that run stale until verification is repeated. The implementation is a narrow forcing function, not proof of correctness or complete edit coverage."
triggers: ["Andon", "stale verification", "edit after test", "verification freshness", "claim-check hook", "proof of done"]
last_updated: "2026-11-07"
source_basis: "GitHub Search API, repository metadata, README, claim-check implementation, focused stale-run tests, hook installation guide, and defect ledger for PrimeFoldTools/Andon at commit 09c008b11d2ba9d66674f7f281b5dbb195326adb."
</ai_context>

# Verification credit must expire after state-changing edits

Date: 2026-11-07  
Source: GitHub  
Repo: https://github.com/PrimeFoldTools/Andon  
Inspected revision: [`09c008b11d2ba9d66674f7f281b5dbb195326adb`](https://github.com/PrimeFoldTools/Andon/commit/09c008b11d2ba9d66674f7f281b5dbb195326adb)

## Observation

A current topic-led GitHub search surfaced **PrimeFoldTools/Andon**, a small
Lean-inspired operating kit for AI-assisted work. Its most reusable current
signal is narrower than its overall memory and defect-ledger system: in opt-in
`tool` or `both` evidence mode, a passing verification run is not permanent
credit. A later recognized edit in the same session invalidates that run for a
turn-ending done-claim, so the agent must verify the changed state again.

This is a useful temporal boundary for agent evidence. A green check identifies
what passed at one point in an execution history; it should not automatically
license a completion claim about a later state.

## Source-grounded details

- **Current discovery was non-truncated at the API level.** GitHub Repository
  Search returned HTTP 200 with `incomplete_results: false` for
  `topic:ai-agents pushed:>=2026-11-05 stars:>=50`, sorted by most recently
  updated. That response is a discovery result, not evidence that Andon works.
- **The default gate is deliberately weaker.** The README and installation guide
  say the default `log` evidence is an agent-written verification entry and the
  default enforcement is `warn`. Operators can opt into transcript-derived
  `tool` evidence and later choose `block`; the project explicitly advises
  tuning in warn mode first.
- **Tool evidence is session- and execution-shaped.** The pinned hook inspects
  the harness transcript for an allowlisted verification command and a later
  non-error result in the same session. It rejects several recorded states that
  can look green without being a completed foreground run, including
  backgrounding, timeout, interruption, or a reinterpreted nonzero result.
- **Edits revoke earlier tool evidence.** The implementation defines recognized
  edit tools as `Edit`, `MultiEdit`, `Write`, and `NotebookEdit`. Its focused
  test file covers a passing run followed by an edit, an edit followed by a
  rerun, edits before a run, parallel run/edit ordering, failed edits,
  sidechain edits, edits in another session, and a read-only tool after a run.
  The expected policy is conservative: even a failed recognized edit attempt
  stales the prior run, while a read-only action and an edit attributed to
  another session do not.
- **The repository keeps the control provisional.** Its defect ledger separates
  defect verdict from control status, assigns review dates to active controls,
  and says a missed review date fails the project test suite. The claim-check
  controls are described as test-stage rather than universal proof.

## Reusable pattern

Treat verification as a **state-scoped, revocable capability**:

1. identify the state or revision that was checked;
2. record the verification attempt and its terminal status;
3. define which later mutations invalidate that evidence;
4. require a new check after invalidation; and
5. keep the final acceptance decision separate from the actor's completion
   prose.

The key addition is step 3. Receipt systems often preserve that a check ran,
but without mutation-aware expiry a real green receipt can still be stale for
the state being claimed.

## Limits

This source does **not** establish sound verification. The project documents
important gaps: the transcript is writable by the agent's own shell route; an
allowlisted command can be meaningless or shadowed; a passing run is not
semantically tied to the done-claim; shell-side file changes can evade the
recognized edit-tool list; the completion detector can miss paraphrases; and a
Stop-hook block holds for one turn. Codex support has additional documented
constraints, including use of log evidence rather than the Claude-specific tool
transcript shape.

Scout inspected repository documentation, static implementation, and
project-authored tests at the pinned revision. Scout did not install Andon, run
its tests, execute either plugin, inspect real harness transcripts, attempt the
documented bypasses, or independently validate the maintainer's incident and
usage claims.

## Relation to existing Scout findings

- [Brigade's subject-bound receipts](./2026-08-09-brigade-receipt-subject-binding.md)
  ask what artifact and patch a test receipt applies to. Andon adds a simpler
  temporal question: did a recognized mutation happen after the credited run?
- [FABULA's proof-of-done receipts](./2026-08-06-github-fabula-open-proof-of-done-receipts.md)
  emphasize replayable proof bundles. Andon is a narrower local Stop-hook
  experiment and should not be treated as equivalent to independent replay.

## Primary sources

- Repo: https://github.com/PrimeFoldTools/Andon
- Pinned revision: https://github.com/PrimeFoldTools/Andon/commit/09c008b11d2ba9d66674f7f281b5dbb195326adb
- README: https://github.com/PrimeFoldTools/Andon/blob/09c008b11d2ba9d66674f7f281b5dbb195326adb/README.md
- Claim-check implementation: https://github.com/PrimeFoldTools/Andon/blob/09c008b11d2ba9d66674f7f281b5dbb195326adb/hooks/claim_check_hook.py
- Stale-run tests: https://github.com/PrimeFoldTools/Andon/blob/09c008b11d2ba9d66674f7f281b5dbb195326adb/hooks/tests/test_edit_after_run_stale_20261107.py
- Hook installation and evidence modes: https://github.com/PrimeFoldTools/Andon/blob/09c008b11d2ba9d66674f7f281b5dbb195326adb/HOOK_INSTALL.md
- Defect ledger: https://github.com/PrimeFoldTools/Andon/blob/09c008b11d2ba9d66674f7f281b5dbb195326adb/DEFECT_LEDGER.md
