# Scout reuse guidance and durable return links

Source and isolated trials are complete. Running definitions were not activated.
This applies the [Task-context comparison](../../../may-agent.app/docs/proposals/task-context-reuse-followup-20260926.md)
to the existing Apps, without adding a Host reuse policy.

## Review and change

May's `develop-change` already retains checked candidate/review evidence and
reconsiders new input. Evaluation's `task-outcome-review` reuses a matching
accepted report before a model call and can republish staged evidence. Scout's
agent instructions already distinguish fitting assessments from changed evidence.
Those paths remain unchanged. The ordinary coding tools accurately describe
their read/write effects; the synthetic comparison's misleading creation tool
was not found in these Apps.

Two Scout instructions still said to update a note whenever the topic exists:
`agents/scout/context.md` and the `scout-explore` assignment. They now ask Scout
to compare the current question and source evidence first. Keep a fitting note
unchanged; update it for changed evidence or required coverage; create a finding
when none fits. A shared topic does not make different subjects interchangeable.
The existing no-change result and publication path handle reuse.

The first trial exposed a concrete return-path defect. Scout correctly kept a
matching note unchanged but cited its temporary candidate path in the accepted
summary. The publisher had removed that worktree. After successful publication,
`scout-explore` now translates candidate-root paths in both returned summary
fields to canonical library paths. Source assessment already uses this approach.
The same translation covers changed and unchanged results. Failure evidence
retains its original identity. There is no new state, observer, retry rule, or
generic link parser.

The value is consistent reuse instructions and usable returned references. The
cost is a small amount of prompt text, one path translation at the existing
publication boundary, and two regression cases. This does not validate arbitrary
links, prove semantic reuse, or change the requested-source assessment archive.

## Trial evidence

Six matched runs compared workspace `cf2a3ada72` against the wording candidate:
one run per version for matching evidence, changed evidence at the same URL,
and a different subject in the same topic. All six made the correct content
decision. The candidate's matching run returned the dead path described above.
That failure remains in the evidence. After fixing the projection, three fresh
candidate runs checked the same scenarios.

| Result | Baseline | Wording candidate | Final follow-up |
| --- | ---: | ---: | ---: |
| Correct keep/update/create decision | 3/3 | 3/3 | 3/3 |
| Complete checks, including readable summary references | 3/3 | 2/3 | 3/3 |
| Model requests | 15 | 14 | 15 |
| Serialized request bytes | 867,220 | 802,407 | 876,406 |

Each accepted result preserved unrelated content and matched committed Git
bytes. Matching runs made zero commits; changed and distinct-subject runs each
made one. The review followed actual model inputs, tool calls/results, finish
payloads, workflow results and files. No independent model grader was used.
This small trial demonstrates the returned-link fix and no observed regression;
it does not establish improved model judgment or general cost/reliability gains.

The pilot uses Scout's configured `gpt-5.6-sol`, real managed execution/finish,
and the real exploration admission and Git publisher in temporary repositories.
Host checkout `5e29c0ef` retains PR #230's unchanged runtime source `063a9f53`.
The SDK testing helper supplies workflow context. Source documents are explicitly
synthetic. This is not a live source scan, Task scheduler, or Telegram trial.

Two startup preparations failed before model requests because instrumentation
tried to clone tool functions. Two later model executions exposed a pilot adapter
mistake: workflow `schema` needed translation to manager `outputSchema`.
All four attempts remain recorded separately; they are not evidence of an App
regression or included in the six-run comparison. The measured runs and final
follow-up had no dropped or retried outcomes.

## Validation and reproduction

The full App check passed syntax, types, formatting, seed projection, relative
links and navigation checks. Its tests initially recorded 434 passes and one PDF
failure because this shell lacked the declared `pypdf==6.19.0`; unchanged baseline
failed the same test. Installing that existing dependency in the pilot directory
and setting `PYTHONPATH` made all 18 source-assessment tests pass. No global
Python or running App environment was changed.

Both new summary-reference regression cases failed before the code correction.
Afterward, all 61 exploration/publication tests passed, including changed/no-change
read-back and removal of the temporary candidate. Syntax, type and formatting
checks passed again on the final source. This records a full initial suite plus
focused rechecks; it does not claim a second complete suite run.

Changed-document links resolve. The broad May design-integrity check still fails
on the unchanged 927-line `task-resource-engine.md` exceeding its 900-line limit;
the same violation is present on baseline. This scoped fix leaves it unchanged.

Evidence: `/app/.state/review-pilots/scout-reuse-guidance-20260926/`.
`PLAN.md`, `PREFLIGHT.md` and `FOLLOWUP.md` retain the sequence and boundaries;
`VERIFIED.json` records each check. Each run includes assignment, provider inputs
and outputs, execution messages, source hashes, final note bytes and Git diff.
`run.ts` accepts `baseline|candidate`, `matching|changed|distinct`, and a fresh
directory label. `verify.py` checks the saved runs against their retained Git
repositories. The runner references the named baseline and candidate checkouts;
reproduction must restore their recorded source hashes. Model trials require the
configured local provider. Final runner SHA-256:
`ea9651515442aebd256541aa04f3fa5bc35139877f24c0de198a0ecc738fb5a8`.

PR #230 remains a separate, open Host change. This App fix is locally reviewable;
activation of an immutable definition release remains a separate operation.
