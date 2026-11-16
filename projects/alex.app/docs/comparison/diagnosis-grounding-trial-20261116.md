# Diagnosis evidence grounding — November 16, 2026

## Outcome

Alex selected **adopt_source** for reviewed candidate
`d173f56a967f3b5f410e4da4ab0ecc40b132b631`. The existing diagnosis workflow now
hands off retained evidence and canonical source locations, treats scores as
signals and aggregate usage neutrally, and validates actionable source paths
and evidence citations before preparing a candidate.

In a small paired comparison, it declined unsupported edits on two real
retained benchmark inputs and still diagnosed a constructed explicit defect.
That supports bounded source adoption. It does not establish less human
correction, cheaper overall delivery, fresh natural-work benefit, runtime
activation or broad Host handover.

This experiment follows the repeated specialist assumptions observed in the
[hosted diagnosis trial](host-diagnosis-trial-20261116.md). Scout and its disputed
wording requirement remain unchanged; no truth approval was invented.

## Alex's scope and source change

Alex selected one hypothesis: supplying actual source and retained trial
evidence, separating observations from causal judgments, and rejecting unsupported
recommendations should reduce unjustified edits without forcing universal
abstention. Implementation stayed in the existing
`alex/workflows/diagnose-improvement.ts` and its test.

- Resolve a unique canonical owner directory. A missing or ambiguous source
  cannot authorize candidate preparation. Current source and historical executed
  identity remain separate facts.
- Supply bounded requirement, result, artifact and transcript evidence with
  explicit truncation and exact directory references. Parse authoritative result
  JSON fully, independently of the excerpt size. Read-only inspection can resolve
  omitted context and referenced retained files.
- Treat a failed machine score as a scoring signal, not confirmed behavioral
  failure or human adjudication. Aggregate tokens and operations cannot alone
  authorize a behavioral edit. The no-failed-score early return avoids that
  usage-only diagnosis; it does not audit passing scorer correctness.
- Require actionable proposals to name existing files inside the resolved source
  directory and cite supplied requirement/output evidence IDs. Validate retained
  evidence and proposed file containment against real filesystem paths.
  Citation matching is structural support; semantic cause still needs judgment.
- Preserve insufficient-evidence and no-change results without preparing or
  removing a candidate. Missing evidence and blocked execution keep that boundary.

Source history is retained: `225cf2a375` implemented the first candidate,
`107a57eb3b` repaired evidence containment and restored regressions, and
`d173f56a96` completed the source/evidence handoff. Bob's second source review
passed without findings. That last review was text-only and used retained check
receipts; operator Git/source readback and executable verification were separate.

## Paired observations

Each arm used the same frozen input, installed SDK hash, Gym model
`gpt-5.6-sol` when a model was called, role guidance and Task requirements.
Generated standalone Task IDs and working roots differed. Baseline source was
`c0913f2c4568a8e90a322141f356b1d42e90c3fd`; candidate source was the reviewed
`d173f56a967f3b5f410e4da4ab0ecc40b132b631`.

There was one invocation per arm/input, with no case-specific warnings or steering
inside the six diagnosis invocations. These are small retained/synthetic trials,
not a randomized study, a blinded holdout or fresh natural work.

| Frozen input | Baseline | Reviewed candidate |
| --- | --- | --- |
| Retained real Scout run used for design | Actionable reporting/concision edit to nonexistent `agents/scout/AGENTS.md` | `no_change`; inspected actual guidance and retained evidence, declined an edit justified only by lexical scoring and aggregate usage |
| Separate real retained tech-lead benchmark run, frozen before implementation | Actionable concision edit to nonexistent `agents/tech-lead/AGENTS.md`, despite three passing cases | `no_change`; no model call for a usage-only signal |
| Synthetic conversion defect, frozen before candidate trials | Actionable conversion advice naming no existing source file | Actionable conversion repair naming the actual fixture source and citing the explicit requirement and wrong output |

The Scout candidate read the current instructions, actual artifact and retained
environment. The artifact preserved the in-place update, existing links and
rejected numbered path. The historical lexical check alone did not establish a
worthwhile Scout edit. This does not adjudicate whether the exact duplicate
wording should be required.

The positive control deliberately supplied a wrong multiply-by-100 instruction,
an explicit request defining 1 second as 1000 milliseconds, and an output of
200 milliseconds for 2 seconds. It remained actionable, so the mechanism did
not simply learn to abstain. Its proposed mandatory calculation display was
additional behavior not requested by the fixture user; Alex would trim that
before any application. Different historical/current identity paths also do
not prove different executed bytes. The fixture source bytes were identical in
both worktrees and retained before the temporary source directories were removed.
No fixture change was applied to a production agent.

## Time, cost and corrections

| Input | Baseline elapsed / reported tokens / estimated direct model cost | Candidate elapsed / reported tokens / estimated direct model cost |
| --- | --- | --- |
| Scout | 13.665 s / 7,368 / $0.028986 | 31.414 s / 68,678 / $0.151205 |
| Independent tech-lead | 9.590 s / 7,217 / $0.037892 | 0.407 s / no model call / $0 |
| Synthetic defect | 7.951 s / 6,974 / $0.022578 | 15.174 s / 16,358 / $0.037563 |

Costs are estimates, not verified billing. Reported tokens include repeated
context and do not establish causal waste. Source inspection made the Scout
case more expensive; it included unsuccessful local path reads before finding
the retained environment. The healthy case avoided an unnecessary specialist
call. These observations do not support an overall cost-reduction claim.

Setup/scope, development, recovery and source review added approximately $8.81
in direct model cost estimates before Alex's final disposition. Owner judgment
is additional. Operator effort and runtime overhead were not monetized, so
delivery ROI remains unknown.

Two operator interventions occurred outside the six diagnosis invocations:

1. Tech-lead committed its first implementation but returned partial while
   waiting for review owned by its caller. The development result was incomplete
   even though the runner completed. Manual full-Task checkpoint recovery reused
   that commit and prior reports. It supplied a confirmed parent-symlink evidence
   escape, restored regression requirements and clarified the helper's scope.
2. After workflow verification/review, the operator completed a small generic
   source/evidence handoff repair: exact directories and read-only access for
   omitted context. Focused checks and independent source review were repeated
   against that final commit.

The first standalone boundary script overwrote its initial result on rerun.
The initial failure is retained as a reconstructed observation from the recorded
command output, with that provenance disclosed. Later boundary receipts use
unique names. Do not treat the reconstructed observation as a byte-preserved
initial receipt or imply automatic checkpoint recovery.

## Verification and disposition

The final source passed 25 focused tests, zero failures and 93 assertions,
including the standalone runner's evidence/cancellation tests. App design,
canonical App and model-surface checks passed with zero errors or warnings.
Independent filesystem checks confirmed that valid large result JSON remains
usable while source directories, source symlinks outside the owner directory,
and evidence parent symlinks outside the retained run cannot authorize action.
Frozen input hashes remained unchanged after the trials.

Separate Gym changes were integrated on shared main while this experiment ran.
They do not overlap the reviewed Alex source. Integration preserves that work
and rechecks the reviewed source bytes and focused checks against current main;
the paired trials do not evaluate the independent Gym change.

Alex judged the reliability benefit sufficient for source adoption despite the
higher inspection cost on evidence-bearing failed cases. Source integration is
distinct from runtime activation: this experiment performed no runtime reload,
Host Task admission or deployment. At the final readback, runtime definitions
remained pinned to the preceding
`dfacd2adc4ec8c2523bccf35248757bc86af8b53-definitions-v6` bundle.

The next step before broader Host handover is controlled activation followed by
a bounded hosted comparison or shadow evaluation on frozen evidence from fresh
natural work. Include an evidence-rich failed-score case and a healthy case,
with no case-specific steering. Observe unsupported recommendations, owner
corrections, semantic overreach, elapsed time and total available cost. This
source trial does not close that milestone. The subsequent
[activation and natural intake follow-up](diagnosis-activation-natural-intake-20261116.md)
records controlled activation and an accepted fresh-work suitability decision;
it preserves the remaining diagnosis/behavioral evidence gap.

## Evidence

The [session index](/root/workspace-worktrees/alex-standalone-20261116/.state/standalone-improvement/20261116-session-6/README.md)
links scope, frozen inputs, development/recovery, exact candidate review, raw
trial output, compact comparison, usage, Alex's disposition and integration
receipts. Workflow operation followed the
[control-plane operation skill](/app/shared/skills/control-plane-operation/SKILL.md).
