# Working on May Host

Read `CONTRIBUTING.md` for checks, review, and release boundaries. This is the
generic Host repository; App policy and system design live in the sibling
`may-agent.app` repository tree, not in a second design folder here.

Before changing behavior, read the relevant current design through
`../may-agent.app/docs/README.md`, especially `1-principles/core-principles.md`
and `2a-design/system-boundary.md`. In an isolated checkout where those docs
are unavailable, request the exact design reference needed for the change;
do not invent a replacement design. Routine CI does not require that tree.

- Apps own meaning, desired outcomes, and acceptance. The Host owns storage,
  scheduling, bounded execution, recovery, and exposing results.
- Keep one authority for each fact and one durable Task per owned outcome.
  Sessions and receipts are execution evidence, not another work lifecycle.
- Prefer the smallest demonstrated fix. Preserve exact identity, accepted
  state, and restart behavior; add a regression test for the broken contract.
- Preserve unrelated edits and use an isolated branch when the checkout is
  shared. Do not deploy, operate a live installation, publish an image, or
  alter App state just to test a source change.
- Use committed fixtures and temporary directories. Never require the
  developer's `/app`, credentials, or running services for portable tests.
- Explain changes and limitations plainly. Report what actually ran, failed,
  or was skipped; a passing synthetic check is not live deployment proof.
