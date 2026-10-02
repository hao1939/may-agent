# Running and improving an App on May

**Supports:** [App contract](../2a-design/agent-app.md). An App should carry an accepted outcome through execution, recovery and useful improvement without repeated operator assistance.

**Choice basis:** [Keep the core small](../1-principles/core-principles.md); [value and cost](../1-principles/design-philosophy.md#value-and-cost); [evidence-first changes](../1-principles/evidence-first.md).

**Design status:** Reviewed proposal; remaining work is not an additional Host lifecycle.
**Implementation status:** Mixed. This October 3 synthesis replaces several
unmerged September 28–29 draft variants. It merges documentation only. Existing
App candidates, their approvals, activation and fresh verification remain separate.

## The useful outcome

An unfamiliar App author can find the supported facilities, run a real assignment,
retain corrections and incomplete work, and use feedback to improve the next
comparable result. Successful no-change judgments also count as useful outcomes.
A new App should need its declaration and domain behavior, without a new scheduler,
context store, evaluator or Host branch keyed to its name.

The App owns the outcome. Agents judge domain meaning and the next action.
Infra admits work, supplies scoped capabilities, executes, retains evidence and
delivers feedback. A workflow can encode an already chosen procedure. Evaluation
and Gym contribute evidence under their own contracts; neither automatically
authorizes a change or guarantees a better result.

## Findings and disposition

| Finding in the original review | Current disposition | Value and simplest sufficient choice |
| --- | --- | --- |
| Shared advice described session feedback as the main accountability path | Keep current App/Task ownership and exact report links; review loaded guidance with its producer before removing compatibility paths | Avoid teaching agents to find or administer an obsolete feedback store |
| Scout copied a complete reconciliation packet into a helper prompt | An isolated App candidate removes that copy; verify inherited context and publication before adopting it | Reuse Host context while retaining the helper's specific assignment |
| Workers confused assigned input with an empty unclaimed-input window | Keep these scopes explicit in entry/read guidance; see the [resource proposal](task-resource-layout-20260929.md) | Prevent missed corrections without a second acknowledgment protocol |
| Some reads and source provenance were unavailable to workflows/native workers | Add a capability only when a real assignment demonstrates the missing boundary; report unavailable evidence honestly | A context file does not install a live tool; a new registry adds no value by itself |
| Gym initially covered May/Scout only | Third-App comparison remains a bounded compatibility question | Do not build a general trainer from one missing trial |
| Reports existed without proof of improved fresh work | Retain the exact finding, candidate/no-change decision and next verification on the owning Task | Count results and recovered requirements, not reports or attempted fixes |

The September baseline was Host `65741c756a05` and Apps `27bc05ca6579`.
Those are dated observations, not the current installation. The current
[capability/infra contract proposal](task-execution-capability-contracts-20261003.md)
owns the cross-adapter direction. This record supplies App-adoption evidence and
remaining questions; it does not create a competing capability catalog.

## What the trials establish

The focused candidate record (`194e06c1ce`) is retained with its full source
identity in the hygiene archive's `doc-candidates.json`. It reports an isolated
Recovery-to-Evaluation passage: Evaluation attempt
`r_1_af9f8b6e-cd0b-4781-9a41-6749dc369c2f` produced an
`insufficient-evidence` report; owner attempt
`r_1_104985d5-46a0-4b5f-b513-6948797bb1eb` considered it and chose no change.
The report hash was
`7c3a299e3030aac8db2a1a13f2d634e87cc5493be63dee39bd1f10ff88d6ce17`.
An unrelated audit Condition and source-application boundary survived.
Manual reconciliation scheduling limits the claim: this did not prove daemon
wake latency, production behavior, candidate causality or a full improvement cycle.

The earlier cold-entry and action-capable trial record (`69a797a0c0`) has narrower
results and failed passages. A source-reading exercise was initially insufficient
as a third-App boundary test. A later Recovery-only run restored an isolated
effect but contained no Evaluation return path. These runs cannot be combined
retroactively into one successful end-to-end trial. The later focused record
supplies its own separate Evaluation receipt.

A Scout prompt fragment shrank from 1,360 to 1,069 bytes in one fixture.
That is not a complete request measurement, token saving or demonstrated
production improvement. The changed Scout path still needs its own behavior
evidence. These historical results were reviewed, not rerun for this cleanup.

## Remaining useful work

1. Compare an unfamiliar worker using the documented Task entry with the existing
   baseline on one correction-and-recovery case. Preserve accepted work and an
   independent wait. Count hints, missed requirements, repeated effects and cost.
2. Repair the demonstrated owning boundary. Keep domain interpretation in the
   App, reusable execution/read mechanics in infra, and context-use methods in
   agent guidance or optional tools.
3. Verify an adopted candidate on fresh comparable work. Record exact source,
   activation and outcome evidence; approval follows the authority already
   granted and may cover several named stages together.

No fixed reading sequence, automatic improvement loop or extra approval ceremony
is required. Stop when the remaining cost exceeds the demonstrated benefit.

Original variants, candidate source and reproduction records are recoverable
through the [workspace review](workspace-hygiene-review-20261003.md). The full
September assignment remains historical evidence, not a new instruction to
operate live Tasks during documentation maintenance.
