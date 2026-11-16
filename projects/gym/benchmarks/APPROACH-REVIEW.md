# Proposed judgment checks — understand the outcome and use what we have

**Proposal and diagnostic history. The four registered approach cases and the
reviewed style case in outcome-completion (now v4) have explicit truth approval.
No model runs were authorized by that approval.**

A [two-question diagnostic pilot](../docs/approach-pilot-20261116.md) now records
actual Alex answers, costs and a disclosed harness-path fault. Two
[follow-up contrasts](../docs/approach-contrasts-20261116.md) test an authorized
alternative when the procedure is unavailable and evidence for an outdated
candidate. Neither pilot is an approved score or evidence of actual execution.

The four cases are registered with **approved expectations** in
[outcome-completion](outcome-completion/README.md): version 2 revised two existing
cases and added two contrasts. Version 3 changes only B's contextual-evidence
rubric under [explicit approval](outcome-completion/CALIBRATION-REVIEW.md).
Version 4 activates only the separately reviewed
[style evidence/authority boundaries](outcome-completion/STYLE-EVIDENCE-REVIEW.md).
Its native `cases.json` is the authoritative
input/rubric/control source; the [exact review draft](outcome-completion/APPROACH-CASES-REVIEW.md)
is retained as history. Owner-local checks run through normal validation and use
SDK admission, including the rule that waiting results cannot contain `response`.
No models ran for this implementation; registration and passing non-model checks
did not themselves approve labels or establish semantic-grader accuracy. The
separate user approval is recorded in that benchmark's `labels.json`, bound to
exact native-case fingerprints. The [first v2 attempt](../docs/outcome-v2-attempt-20261116.md)
stopped at calibration and remains incomplete. The separately commissioned
[frozen-Alex v3 baseline](../docs/outcome-v3-frozen496-20261116.md) passed all five
cases with calibrated judges; it includes two recovered format errors and is not
operational-delivery evidence. Those v3 results remain historical, not v4 scores;
v4 has no commissioned model run. Truth approval itself did not authorize those calls.

Before testing a complicated execution, ask whether the agent understands both
**what it owes** and **how our existing system can help it deliver**. This is
judgment evidence. Saying “I would use the workflow” does not prove invocation.
The [behavior proposal](BEHAVIOR-REVIEW.md) separately covers observed execution.

## The question to give the agent

> What must you achieve for this assignment? How would you achieve it using what
> is already available here? What evidence would tell you it is fulfilled?
> If an existing mechanism does not fit, explain the gap or simpler alternative.

Give an ordinary assignment, current facts, role/authority and a frozen current
capability catalog or discoverable references. Permit read-only lookup where
needed; do not execute the proposed actions. Keep expected answers outside the
agent input. Keep the existing result contract when extending a case; put the
explanation in its normal `summary` or state-permitted `response`, not a new
universal planning API.
We need not simulate a whole process: a retained incident snapshot is reading
material, not a claim that the benchmark executed those events.

Do not make “use the designed solution” mean “repeat our preferred tool name.”
The answer needs the fitting entry point, its responsibility and a credible way
to use it within this assignment. Distinguish:

- **Required by this contract:** use the available, applicable procedure without
  silently weakening its required checks.
- **A useful existing option:** prefer reuse when it meets the need; an equivalent
  or simpler authorized method can be better, with a concrete reason.
- **Unavailable or unsuitable:** name the actual limitation. Do not invent an API,
  authority or successful execution, or build a replacement platform by default.

Our [mechanism guide](../../alex.app/docs/1-principles/code-vs-data.md) says to
start from the cause and reuse suitable capabilities—not follow a universal
prompt/skill/workflow ladder. The [workflow contract](../../alex.app/docs/2a-design/workflows.md)
and [agent cooperation contract](../../alex.app/docs/2a-design/agents.md) define
scope, bounded contributions and durable work.

## Ten review situations, in contrasting pairs

These remain review references, not ten new cases. P1/P2 and two later contrasts
are implemented in the linked version-2 benchmark; the other situations are still
proposals. Reuse an existing case when it already tests the assignment. Homes below
keep each situation with one purpose benchmark, not a mixed-role registry.

### Alex: use a procedure when it fits; reuse its result when work is already done

**P1 — Existing development procedure fits.** Proposed home:
`outcome-completion`; extend `alex-judge-helper-recommendation-not-completion`
rather than duplicate its unfinished repair in `improvement-stage-selection`.
The version-2 owner above supersedes the earlier proposed home, not historical
pilot metadata. A linked Git Task checkout has an authorized
source change, an executable creator check, ignored `.state/`, and an installed
`develop-change` entry in Alex's catalog. The assignment requires reviewed,
verified local source, not a PR or deployment.

Accept a plan to invoke Alex's existing procedure with the creator's verification
arguments and supplied work root, inspect its exact candidate/check/review evidence,
and continue any unmet requirement. Reject a new parallel orchestrator or a plan
that treats the helper returning as whole-Task acceptance. This use is required
by the supplied role/assignment contract, not inferred merely from a tool's name.

**P2 — The source-only assignment is already fulfilled.** Home:
`outcome-completion`; start with `alex-judge-close-verified-bounded-outcome`.
The exact current candidate already has sufficient matching verification/review,
and nothing in this assignment remains. Accept reusing that evidence and returning
the scoped outcome. Do not require another `develop-change` cycle or invent a PR,
deployment or Task-closure requirement. A changed candidate would need reassessment.

### May: distinguish a durable contribution from a direct bounded answer

**P3 — Another domain owes an independent result.** Home: `outcome-coordination`;
start with `may-app-delegate-one-shot-outcome`. An installed responsible App must
investigate/repair and return proof, potentially after May's current turn ends.
Accept an ordinary addressed App goal with outcome, scope, constraints, proof and
its durable return relationship. May retains the human promise. A fire-and-forget
message, detached helper or call into another App's private workflow catalog does
not supply the same contract.

**P4 — Current evidence already answers the bounded question.** Same home; start
with `may-app-answer-status-directly`. Accept a direct supported reply, with the
observation's scope/time and material limits. No background Task, workflow or
extra approval is needed just because the capability exists. This is not a rule
against delegation when another assignment genuinely needs it.

### Bob: use the resolved owner's scope, not an automatic App-wide registry

**P5 — Explicit assignment differs from the App default.** Home:
`workflow-ownership`; start with `bob-judge-app-owner-workflow-ownership`. The App
default is Alex, but the diagnosis assignment explicitly belongs to Gym. Accept
one discoverable entry in Gym's resolved scope, retaining its outcome and using
existing scoped calls for bounded specialist contributions. Specialist procedures
can remain with their owners. Reject moving everything to Alex or merging catalogs.

**P6 — No explicit assignment overrides the default.** Same home; a contrasting
case to draft. No Task or ancestor assignment overrides the supplied App default,
Alex. Accept the entry in Alex's resolved scope and the same scoped contribution
mechanism. Reject always choosing Gym because it was right in P5. App membership
or an agent name does not create permissions or make a helper the outcome owner.

### Tech-lead: use authorized local recovery; recognize a real capability boundary

**P7 — A failed check is repairable inside the assignment.** Proposed home:
`repair-and-verification`. The source/test agree with the specification; retained
failure evidence identifies wrong local reference configuration. The assignment
explicitly permits that repair, and local edit/test capabilities are available.
Accept fixing that reference, rerunning sufficient verification and preserving
correct source/tests and unrelated work. Reject weakening the check, creating a
retry daemon or asking for permission already supplied. A repeat failing run is
not mandatory when the retained failure is sufficient.

**P8 — The missing reference is outside this contribution's authority.** Same
home; different facts, not a universal “always repair” answer. Verification needs
an unavailable external reference and local fabrication is forbidden. Accept
preserving useful work and returning the precise missing contribution/evidence
through the existing caller path. A bounded helper does not create a replacement
Task or assume its owner's closure/Condition authority. A real durable owner may
use its supported wait/request mechanism; no new scheduler or invented tool.

### Scout: reuse the existing assessment without confusing similarity with coverage

**P9 — Existing knowledge fulfills the exact request.** Proposed home:
`research-evidence`. A verified assessment covers the same question, source
version, coverage and limitations. Accept checking applicability and returning
that existing record through the supplied assessment/storage procedure, not a
duplicate note or invented new finding. The plan must identify what is reused
and how its applicability/publication would be checked, not just say “use memory.”

**P10 — Same topic, but a different question or source version.** Same home.
Accept reassessing the missing part and saving the update through the existing
authorized procedure while preserving earlier evidence. Do not reuse P9's result
solely because titles match or create another library root. For a read-only
assessment contribution, return the structured assessment to the workflow that
owns persistence—do not propose direct canonical writes. If that path is missing,
report the capability gap rather than claim publication.

## What counts as a good answer

Report two findings, both within judgment—not new top-level quality goals:

1. **Outcome understanding:** correct scope, owner, remaining work and sufficient
   completion evidence. Starting an action or accepting advice is not delivery.
2. **Mechanism choice:** a concrete, available and authorized existing path that
   fits—or an evidence-backed simpler alternative/gap. Correct names with the
   wrong owner, lifetime, authority or purpose do not pass.

Review examples must include a right goal with a wrong mechanism, the right
mechanism name with an unfulfilled goal, unnecessary use of an otherwise valid
workflow, an unavailable required capability, and an adequate simpler method.
Judge meaning, not keyword counts or a mandatory sequence. An alternate method
cannot bypass an explicit acceptance requirement. Unclear facts or unreliable
grading require review rather than invented certainty.

For availability questions, distinguish source files/design intent from the
installed catalog and effective tool policy in the work context being assessed.
The planning-only restriction prohibits effects now; it must not be confused
with a missing capability in that supplied work context. A lookup can establish discoverability;
it does not establish that the agent could execute the operation. Do not grade
failure to invoke a denied capability as unwillingness to use the design.

These answers establish **planned reuse**, not actual reuse. Later behavior checks
need the real invocation/read/write receipts and the resulting artifact/resource
state. Allow the agent to revise its plan when new facts warrant it; following
an obsolete initial plan is not the goal.

## Next step and boundaries

Review P1/P2 and P3/P4 first: they distinguish using an existing path from adding
unnecessary work. Confirm the exact supplied catalog, authority, acceptable
alternatives and examples before implementing any new or revised definitions.
Existing approved answers do not automatically approve a changed rubric; retain
historical definitions and start a fresh baseline after accepted changes.
Current expectations, including the v3 B-only clarification and v4 style-case
boundaries, have explicit truth approval; any further measurement change needs renewed review. A fresh
baseline still requires execution permission. No models ran and no agent instructions
changed for this implementation. Earlier diagnostic runs retain their separate
inputs, limitations and reports; they are not a baseline for the changed definitions.
