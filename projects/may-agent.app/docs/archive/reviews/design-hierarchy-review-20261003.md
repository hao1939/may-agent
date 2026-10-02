# Design hierarchy and rationale review

> Historical record. Status, revisions and deployment observations below belong
> to the recorded review or trial, not the current installation. Follow the
> linked owning contracts for current behavior. Open limitations remain evidence;
> archiving this record does not establish that they were resolved.


**Supports:** [Documentation hierarchy](../../README.md#design-hierarchy). Makes the reasons for features and design choices inspectable across the documentation set.

**Choice basis:** [Value and cost](../../1-principles/design-philosophy.md#how-to-decide-a-tradeoff), [convention over configuration](../../1-principles/core-principles.md#convention-over-configuration), and [conflict review](../../1-principles/core-principles.md#resolve-conflicting-designs).

**Status:** Documentation organization and rationale review, 2026-10-03. No runtime or deployment change.

## The two questions

Purpose and value justify **the feature we need**. Philosophy, conventions and
verified practice justify **the design we choose for that feature**. A design
needs both explanations. A feature's value does not justify every mechanism
that could implement it; a familiar convention does not establish a need for
another feature.

The goal remains in Design Philosophy. System Model derives needed abilities
and links their owners. Subsystem designs own precise behavior; proposals name
the parent they refine, and manuals explain how to use the accepted contract.
Archived documents retain earlier rationale and evidence with links to current
topic owners. These links do not promote a draft or certify an implementation.

The hierarchy is logical. One contract can support several feature needs;
additional links express that relationship without copying the contract. Primary
parent links provide a straightforward path back to the purpose. Dependencies
and evidence links answer different questions and may cross that hierarchy.

## Scope and changes

The starting set contained 177 Markdown documents: 6 principles, 33 current
designs, 11 manuals, 50 proposals/implementation records, 75 archive documents,
and README/INDEX. This record brings the set to 178.

The review covered their organization, declared purpose/status and contract
relationships, with focused cross-document checks of responsibility, waiting,
recovery, execution, capabilities and evidence. It is not a new line-by-line
source audit, verification of every historical result, or certification of
every installed App.

- Current designs, principles, manuals and proposal records now link the parent
  need they serve and explain their contribution. Choice links point to the
  applicable philosophy/convention; existing practice and trial records remain
  beside their detailed decisions.
- System Model supplies the missing connection between the project goal and
  feature responsibilities. INDEX links every proposal and retained trial to
  its parent, including records missing from the previous selected list.
- Archived bodies and historical conclusions remain intact. Navigation added
  to each record identifies its current topic owner and its evidence-only role.
- The capability proposal is one feature design under the Host/App boundary,
  with detailed calling contracts in a linked reference. It is not a second
  project-purpose or system-model authority.
- Process isolation moved from the oversized Task contract to Runtime, which
  owns process lifecycle and responsiveness. The Task anchor still links there;
  the moved requirements are unchanged.

Scope/ownership, evidence/uncertainty and status/revisit conditions support each
decision. They do not require more hierarchy levels or a new metadata schema.
Cost belongs in comparing choices: human attention, compute, delay, maintenance
and failure consequences matter alongside outcome quality.

## Conflicts and distinctions checked

| Apparent conflict | Shared need and basis for choosing | Disposition |
| --- | --- | --- |
| Earlier finite retry/exhaustion versus continuing retries with backoff | Continue useful work with acceptable cost; agent owns strategy and infra carries declared execution. | The current Task lifecycle supersedes the older controller policy. Explicit supersession notes now cover both lifetime modes and retry counts; historical tests do not reintroduce a limit. |
| Precise execution resumption versus fresh work using retained evidence | Avoid losing responsibility after interruption. Simple-first and actual redo/failure cost determine how much execution state is worth retaining. | These can serve different workloads. Preserving Task inputs/results is required by the current contract; exact step resumption is not a universal feature requirement. |
| Pending Conditions versus an agent's completion judgment | Preserve useful independent progress and truthful outstanding facts. Agent decides; infra records accepted decisions and exact scope. | A pending fact does not itself decide execution or fulfillment. Contribution completion, Task lifetime closure and withdrawal remain distinct; their owning contracts must be read separately. |
| Final-result dependency declaration versus live request submission; state/continue versus proposed decision/reply | Let agents request contributions with less bookkeeping through one admission owner. | Existing interfaces remain current. #285's narrowed scope and deferred schema are stated in the attempt/capability proposals; later convenience APIs remain proposed. A draft example cannot silently change SDK obligations. |
| Workflow value measured by better findings versus dependable procedure | Reuse a justified sequence at acceptable total cost. Mechanism selection depends on the need. | The retained workflow stability trial corrects the earlier comparison question. Equal findings do not disprove process value; measured process reliability also does not guarantee better semantic judgment. |
| Lower context cost versus worse behavioral acceptance | Complete comparable work affordably, preserving useful outcomes and appropriate actions. | The context trials retain both reduced calls and repeated-write failures. Cost reduction does not establish an overall improvement. |
| Console Esc described as both implemented and missing | Keep human work steerable through shared exact controls. | Corrected the stale Console implementation summary against the source keypress handler and its retained test. The expected feature did not change; installed behavior still needs separate evidence. |

The last check read Host `0317016b67ade1cce2e083cee3c80ac36a7e1821`, specifically
`packages/terminal/bin/may-console.cjs`'s TTY keypress handler and the matching
test in `packages/terminal/src/may-console.test.ts`. This is source evidence,
not a new live terminal trial. The other comparisons use the current owning
contracts and their dated proposal/trial records.

## How future choices use the hierarchy

Find the common feature need, then compare sufficient outcomes at the same
scope and workload. Apply the relevant philosophy and conventions, with practical
evidence for the tradeoff. Record any justified exception and its consequences.
If evidence is missing, investigate the decisive uncertainty rather than combine
both designs or choose by document age. The
[conflict rule](../../1-principles/core-principles.md#resolve-conflicting-designs)
owns this procedure.

The evidence should be capable of changing the decision. Revisit a design when
the feature need, usage, failure cost or observed behavior changes. Acceptance
does not make a design permanently correct, and code presence does not make a
proposed contract accepted.

## Validation

Document checks cover parent/choice links, paths back to the goal, primary-parent
cycles, current/proposal index coverage, historical-body preservation and the
existing design integrity rules. These establish navigability and organization;
they cannot prove the benefit of a feature or resolve every semantic disagreement.

Checks passed for 178 documents: 177 non-root parent paths reach the project
goal without cycles, 363 rationale/choice/reference links resolve, every current
design and proposal is indexed, and all 75 archived bodies are preserved. The
moved process-isolation contract is unchanged. `git diff --check` also passed.

The documentation-only integration onto `main` passed `bun run check:may-design`
against Host `0317016b67ade1cce2e083cee3c80ac36a7e1821`: document integrity, SDK
examples with Task admission/replay and Condition/dependency admission, and
canonical App integrity. Existing App code and checked examples are unchanged.
The integrity check retains one unrelated root-layout warning for `reports`.

The earlier design-branch check used its paired candidate Host
`c8a8513da83a396d2dce43037dd844821defab28`. That branch's runtime changes and
candidate SDK examples are excluded from this documentation merge. Candidate
interfaces remain labeled in proposals; neither check establishes deployment.

The local check records are retained under
`/app/.state/may-design-hierarchy-20261003/`.
