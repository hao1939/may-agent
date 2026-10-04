# Working on May Host

Read [CONTRIBUTING.md](CONTRIBUTING.md) for checks, review, and release boundaries.
This repository implements a generic Host. Its [source map](src/app/README.md),
[control guide](packages/control/README.md), SDK types and owning tests describe
the contracts being changed. A standalone checkout must be sufficient for Host
implementation and portable verification.

Keep App policy, named-agent privileges, installation routing and App operating
procedures outside generic Host behavior. Apps supply meaning and requirements;
trusted installation configuration selects operational scope and destinations.
The Host validates those declarations and executes their shared contracts.
An App move, rename or removal should not require a Host source edit.

For cross-repository changes, include the relevant App requirements and exact
references in the work item or PR. They are supplied context, not a dependency
on a particular sibling App or its documentation layout. Preserve generic
Host safeguards when removing installation-specific assumptions.

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
