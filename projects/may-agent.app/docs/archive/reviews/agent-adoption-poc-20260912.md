# Agent adoption PoC: what actually changed behavior

> Historical record. Status, revisions and deployment observations below belong
> to the recorded review or trial, not the current installation. Follow the
> linked owning contracts for current behavior. Open limitations remain evidence;
> archiving this record does not establish that they were resolved.


**Supports:** [Teaching agents: from a correction to dependable behavior](../../proposals/agent-behavior-and-capability-extension.md). Tests whether taught guidance reaches later work and changes behavior.

**Choice basis:** [Applicable philosophy and convention](../../1-principles/evolution.md#promotion-tests); [compare competing choices](../../1-principles/core-principles.md#resolve-conflicting-designs).

**Status:** Focused local experiment completed, September 12, 2026.
**Scope:** Execution-side evidence for the [proposal](../../proposals/agent-behavior-and-capability-extension.md),
not production activation or the complete conversational teaching experience.

**Correction after review:** The workflow's primary purpose is process stability.
The initial comparison emphasized finding quality and execution cost too heavily.
Its raw observations remain valid, but lack of better findings does not show
that workflows lack value. The [follow-up investigation](workflow-stability-poc-20260912.md)
tests stable sequencing and failure handling instead.

## Recommendation

Start with guidance, not another subsystem. A short loaded instruction and a
discoverable skill both carried the correction into fresh relevant reviews.
Saving the same text in `context.md` without a retrieval path did not.

The initial collector remains experimental. Direct reviews handled these fixtures
correctly, but the comparison did not establish whether a workflow makes the
process more dependable. When the caller already has the evidence, supply it
clearly once; that helped avoid unnecessary rereads. Evaluate necessary sequencing
separately from judgment quality and discovery cost.

## What ran

The Host baseline was `49272b5ac545aa2c4b7ab887c10183f5a76a8bd0` (current fetched
main for this trial). Final reproducible experiment source is preserved in local
Host commit `dc4a2530` on branch `poc/agent-behavior-adoption-20260912`, under `scripts/poc/`:
`agent-adoption.ts`, `adoption-scope.ts`, `evidence-workflow.ts`,
`fixtures/collect-review-evidence.ts`, and `agent-adoption.test.ts`.
The accompanying `agent-adoption.README.md` documents reproduction.
No Host runtime source, live agent guidance, Task, real PR or deployment changed.
The local commit is not pushed or proposed for production installation.

The scripts used real May source-release storage, definition building, skill
discovery, prompt preparation, confined read tools, bounded agent execution,
and the existing workflow runner. Each experiment created its own synthetic
Git repository and temporary state. No personal conversation or private project
data was sent to the model.

There were **31 model-backed executions**, all returning `done`, using the same
`gpt-5.6-sol` registry route without fallback and a 90-second execution timeout.
The returned usage totals summed to **49,144 tokens** across model steps.
That includes repeatedly supplied context; it is not unique content or a billing
claim. Timing and usage are descriptive observations, not a benchmark.

The [sanitized evidence](../../proposals/evidence/agent-adoption-20260912.json) preserves answers,
tool calls, returned usage, durations and synthetic definition commit IDs.
It is not a full transcript or production trace. Fixture commits identify the
definitions supplied to the model, not Host code. Temporary paths are replaced
with `<fixture-root>`; credentials, endpoint settings and personal paths are absent.

## 1. Did the correction reach later work?

The standing correction asked for important-versus-cosmetic judgment, review
headings `Required changes` and `Optional suggestions`, honest CI evidence, and
review-only scope. Later review requests neither repeated it nor named a skill.
Executions had no original conversation history.

| Placement | Requested format in relevant reviews | What the execution received |
| --- | --- | --- |
| Baseline | 0 of 4 | Ordinary competent reviewer instructions |
| `context.md` only | 0 of 4 | File existed, but no retrieval path supplied it |
| Loaded `AGENTS.md` | 4 of 4 | Scoped correction in the prepared system prompt |
| Discoverable skill | 4 of 4 | Description in the catalog; agent read the body |

Each denominator includes the mixed-review pilot plus three review cases in the
main comparison. The main comparison reversed the pilot's arm order. Only the
mixed case was repeated; this is not a large or randomized evaluation.

All arms retained the supplied null-input defect, declined cosmetic-only blockers,
and recognized stale CI in the relevant cases. **The baseline was already good
at those judgments.** This proves observed format adoption and retention of a
given defect, not improved discovery of subtle bugs. The review evidence itself
contained the defect and reviewer explanation.

All four unrelated-writing executions gave an ordinary one-sentence welcome,
without review headings or skill reads. The skill catalog contained only one
skill, so this does not prove reliable selection in May's crowded real catalog.

An important weakness remained: the pilot baseline asserted that CI did not
cover the null case, and a later memory-only answer asserted missing coverage.
The fixtures supplied no coverage evidence. Passing CI and a real defect do not
establish why CI missed it. Do not count an otherwise useful review as perfectly
grounded, or fix this by blindly adding a rule for every new example.

## 2. Did temporary and amended instructions behave sensibly?

Three additional live executions showed:

- A current-request-only heading instruction affected that review.
- A later fresh execution using unchanged baseline definitions did not retain it.
- Replacing the standing heading preference, committing and activating it produced
  `Must fix` and `Non-blocking`, without the former headings, in a fresh review.

The experiment author chose scope and performed fixture publication. Agents had
no write tool. This does **not** prove May naturally infers scope, avoids saving a
temporary instruction, or safely authors a standing change by itself.

Offline checks also proved that dirty source was rejected, staging did not
activate, a prepared prompt stayed unchanged after a later activation, and a
new preparation used the selected active source. Existing reload tests exercised
publication rollback with controlled collaborators. They are not a live daemon
reload or same-Conversation/same-Task continuity trial.

## 3. Did a workflow help?

The small collector reads `pr.json`, `checks.json` and `comments.json` from the
fixture workspace. It returns raw source-labelled values and explicit missing
files. It does not judge readiness, fabricate missing checks, call another agent,
or preserve a second work lifecycle. Invalid input, malformed evidence, escaping
symlinks and removed workflow names return errors through the existing runner.

Each case contained the same null defect, cosmetic comment and either stale or
missing CI. Direct and optional-workflow arms had the same facts and direct-read
capability. The optional arm additionally exposed May's normal workflow tool.

| Case | Direct | Optional workflow | Already collected packet, clarified prompt |
| --- | --- | --- | --- |
| Stale CI | 3 reads; 2 model steps; 1,908 tokens; 12.4 s | Chose list + run; 3 model steps; 3,295 tokens; 17.5 s | 0 reads; 1 model step; 1,043 tokens; 6.8 s |
| Missing CI | 3 reads; 2 model steps; 1,773 tokens; 9.3 s | Chose 3 direct reads; 2 model steps; 2,204 tokens; 9.1 s | 0 reads; 1 model step; 992 tokens; 9.6 s |

All retained the defect, kept the cosmetic comment non-blocking, and reported the
CI gap. The selected workflow consolidated reads, but discovery added a model
step. Merely making the workflow available did not guarantee its use or improve
quality. Direct reads can already be batched in one model step.

The first precollected-packet prompt still pointed the reviewer at the files;
both runs reread all three. After stating clearly that the collected packet was
the evidence and original files were available if needed, both repeats used it
without rereading. Those first results remain in `workflowPilot`; corrected
repeats are `packetRepeat`. This was a prompt revision, not a hidden runtime fix.

Predispatch is caller orchestration, **not natural agent selection**. Its timing
above is agent time; local collection took tens of milliseconds separately.
The fixture files were immutable during each comparison. There were no network
delays, concurrent PR updates, access-denied provider responses, pagination or
large logs. Model/service variance and caching make these small timing samples
insufficient for speed guarantees. Do not infer a general billing saving from
the returned token counts.

The useful lesson is narrower: make already-collected evidence usable, with
source identity and missing information intact. Add a collector for real repeated
setup or observed omissions, not to enforce a ceremony around easy direct work.

## Verification and reproduction

From the local Host PoC branch after a frozen dependency install:

```sh
# No model calls: source preparation and collector mechanics.
bun scripts/poc/agent-adoption.ts
bun scripts/poc/evidence-workflow.ts

# Explicitly authorized model experiments only.
bun scripts/poc/agent-adoption.ts --live --pilot
bun scripts/poc/agent-adoption.ts --live --reverse
bun scripts/poc/adoption-scope.ts --live
bun scripts/poc/evidence-workflow.ts --live
```

The final workflow script uses the clarified packet prompt. Reproducing the
earlier redundant reads requires the earlier prompt preserved in this report:
the original review request pointing to files, followed by
`The read-only collector already returned:` and the same packet.
Do not repeat paid calls merely to reproduce incidental timings.

The scripts print temporary artifact directories and save results progressively.
They require the operator's existing authorized model configuration; no endpoint
or credential should be copied into the repository. The prepared read capability
is fixture-confined. Executable workflows are trusted code, not a general sandbox;
only the reviewed synthetic collector was made available here.

Checks passed: Host type check; explicit experiment-script type check, lint and
formatting; **57 tests across seven suites**, covering source release,
skill/preparation, workflow dispatch/cancellation, reload publication and three
new fixture contract tests. The owning suites are listed in the experiment
README. Canonical design integrity, SDK/control examples and App integrity also
passed. This was not a full release CI, container smoke test or live deployment.

## Proposal changes and remaining work

1. Recommend a concise loaded rule for stable behavior, or an existing discoverable
   skill for a substantial situational method. Do not duplicate the rule in both.
2. Do not promise durable adoption from a saved file, skill inventory, source commit
   or reload acknowledgement alone. Check supplied context and later behavior.
3. Keep workflow enablement conditional. Where the caller already collected facts,
   pass a clear evidence packet rather than telling the agent to collect them again.
4. Separate known facts from inferred causes in the existing review method; verify
   the change on broader examples before claiming improved review quality.
5. Before production rollout, close the actual experience gaps: conversational
   interpretation/authorized editing, crowded-catalog discovery, and a later
   execution adopting the active revision without replacing its Task/Conversation.

Those remaining gaps are an implementation/live-experience slice, not reasons
to add a preference database, automatic learner or new activation framework.
This report closes the first execution-side trial. The process-stability follow-up
addresses the corrected workflow question; it does not erase these results.
