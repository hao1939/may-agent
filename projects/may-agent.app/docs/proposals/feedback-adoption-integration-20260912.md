# Reachable feedback and honest source promotion

**Status:** Isolated source candidate and four model checks completed, September
12, 2026. Not merged into installation source, activated or deployed.
**Parent:** [Agent-extension proposal](agent-behavior-and-capability-extension.md).

## What changed

The [method investigation](extension-methods-poc-20260912.md) found that saved
feedback could be missed, and an approved source copy could look like completed
adoption. This slice fixes those two misleading boundaries without adding a
learning framework or granting Gym deployment authority.

### One feedback location, owned by Evaluation

Evaluation now writes `generated/agent-feedback/<key>.md` in its own shared
App workspace. Existing shared agent guidance already points there. Normal
agent names map directly; unusual identities retain the App's safe key in the
feedback Task input. There is no agent-directory scan, hardcoded agent-to-App
map or cross-agent `last-eval.md` write.

An unloaded agent does not prevent evidence from being saved. Projection is
not delivery to a running agent or acceptance of remediation work. Summaries
and the generated file now say saved/read-back verified, with reading and
remediation unverified. The text asks the reader to assess the critique, not
treat it as permission to edit standing instructions or abandon current work.

An issue-free latest evaluation clears the projection. Stale replay protection,
explicit corrected replay, safe filenames and read-back checks remain. Old
agent-local files are untouched; this is not a data migration. Durable Evaluation
facts remain authoritative, and no standing guidance or credentials changed.

### A source copy is not completed adoption

Gym still requires the exact candidate fingerprint and existing approval before
copying an agent overlay. After the copy it now records `activation_status:
unverified` and leaves the same campaign at existing owner attention. It does
not mark that track complete. Its `agent.revision.changed` fact carries the same
qualification and does not trigger another training cycle by itself.

The existing result verifier rejects a premature converged claim while this
checkpoint needs owner action. Replaying the recorded result does not copy the
candidate again; a test preserves a newer owner source edit across that replay.
Benchmark/scorer-only approval behavior is unchanged.

**This does not complete automatic activation.** An authorized operator still
needs to commit/reload through the existing path and verify the active revision
and a fresh relevant execution. The source-only fact is not confirmation. This
slice deliberately leaves adoption pending instead of inventing another
activation controller, treating another approval as proof, or allowing Gym to
deploy. The precise completion handoff remains a later integration step.

The pre-existing overlay copy is not a transactional deployment or a
concurrent-source-edit guarantee. Replay after a recorded result is covered;
crash during copy/publication and source drift before first application still
need the owning activation boundary's evidence before production adoption.

## Four model checks through the real projection

The new harness invokes Evaluation's real input mapping and projection, then
May's real definition preparation, execution and confined read tool. It uses
the current shared section containing the feedback reference and adjacent
defaults, not an injected feedback body. The evidence preserves that exact excerpt.
One definition/source revision remains active throughout. Each probe is a
fresh direct-runner execution without previous conversation history.

The fixture supplies separate approved Orion policy files. Feedback points to
the relevant policy; it is not itself the policy or permission to deploy.

| Condition | Observed result |
| --- | --- |
| No generated feedback | Agent attempted the normal feedback path; calculated 39 slots but reported the policy unavailable. |
| Real projection saved feedback | Agent read the generated file, followed its v1 reference and correctly rejected 39 against the production limit of 37. |
| Real projection replaced feedback | Without reload, agent read the replacement and its v2 reference; correctly rejected staging demand 13 against 12. |
| Real projection cleared feedback | Fresh execution no longer found the reference and honestly reported the staging limit unavailable. |

All four completed on the configured `gpt-5.6-sol` route with fallback disabled,
90-second deadlines and no retries. Total reported execution time was about
52 seconds. No permanent guidance edit or deployment operation was available.
The [sanitized evidence](evidence/feedback-adoption-20260912.json) retains every
input, projection outcome, answer, tool call, prompt and reported usage.

This proves a useful ordinary read path for changing operational evidence. It
does not prove a daemon/Task wake, old-session forgetting, autonomous improvement
or installed production adoption. The policy references deliberately change;
this is not learning new model weights.

Selection was imperfect. The agent unnecessarily read a PR-review skill in
three cases, and guessed many paths when the feedback reference was absent.
The fixture has a read tool but no directory listing. Keep these costs visible;
do not claim optimal discovery, a general speed gain, or blanket reliability
from four controlled observations. The successful feedback path needs no new
always-loaded prompt body or semantic routing service.

The trial uses the ordinary agent name `reviewer`. Source tests cover safe
storage for unusual identities, but do not prove an agent can discover its
hashed feedback key from the generic `<you>.md` instruction. That lookup remains
unverified; safe storage alone is not proof of reachability for every identity.

## Verification and known baseline failure

- **107 focused tests pass**, covering both App input routes, projection and
  the candidate approval/replay path. These are not separate from the suites below.
- **Gym full suite: 107 pass, no failures.**
- **Evaluation full suite: 104 pass, 3 fail.** The same three heartbeat Condition
  tests fail on unchanged workspace main: the baseline file run has 6 pass and
  3 fail. They are not changed by this slice and are not counted as passes.
- Both App type checks and syntax builds pass. The PoC has a separate explicit
  TypeScript check, and its no-model preflight passes.
- Source checks cover exact approval, source-only attention, rejection of
  premature completion, non-reapplication after a newer source edit, no reload
  event, reference location, freshness, clearing, replay and safe identity keys.

The source candidate is not advertised as having a green full Evaluation suite.
Resolve or separately disposition those existing heartbeat expectations before
using an all-green suite as a merge/adoption claim. No baseline failure was
silenced or removed to make this change pass.

## Source and next boundary

Local branch: `fix/learning-feedback-adoption-20260912`, based on workspace
`60d6ab989d`. Model execution used candidate `0588a7ba1a` and Host PoC source
`886ae455`. Later changes add documentation, clarify the harness comment and add
a completion-verifier assertion; they are not a second model trial. The candidate
reduces production code by about 199 lines; the separate experimental harness is
not shipped runtime code.
This `/app` repository has no GitHub PR workflow; the candidate remains local
for review. Host #159/#160/#161 were not changed by this slice.

Reproduce the bounded experiment from the candidate checkout:

```sh
bunx tsc --noEmit -p scripts/poc/tsconfig.feedback-adoption.json
bun scripts/poc/feedback-adoption.ts --host-poc-root /path/to/host-method-matrix
# Separate model authorization/credentials are required:
bun scripts/poc/feedback-adoption.ts --host-poc-root /path/to/host-method-matrix --live
```

Next, connect one **authorized activation and subsequent ordinary Task execution**
to its existing owning work. Verify the exact active source, retain the same
Task through any wait, and admit completion only from the actual result. Do not
unblock the source-only checkpoint with a model assertion or a plain change
event. The Host details view's old `last-eval.md` prompt label remains a separate
presentation defect; this App change neither injects that file nor repairs the UI.
