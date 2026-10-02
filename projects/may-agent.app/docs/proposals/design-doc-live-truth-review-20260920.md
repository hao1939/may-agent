# Design documentation must match intended contracts and evidence

**Supports:** [System Model](../2a-design/system-model.md). Separates intended contracts, source evidence and installed behavior so reviews use truthful claims.

**Choice basis:** [Applicable philosophy and convention](../1-principles/core-principles.md#review-rule); [compare competing choices](../1-principles/core-principles.md#resolve-conflicting-designs).

**Status:** Reviewed documentation scope, corrected September 21, 2026.
**Original proposal:** preserved verbatim at
`/app/.state/review-pilots/design-doc-live-truth-20260921/proposal-original.md`.
**Review:** `/app/.state/review-pilots/scout-nested-publication-20260921/PROPOSAL-REVIEW.md`.

## Problem

A reader must be able to distinguish four independent facts: the intended
contract, the source revision inspected, the artifact actually running, and the
installed definition release. Several common design pages instead retained
pre-merge lifecycle language or treated a dated checkout baseline as current
installation identity. Session and terminal summaries also contradicted their
owning contracts.

This proposal records the corrected documentation scope. It does not redefine
the contract around one live observation and does not claim a runtime rollout.

## Corrected findings

Reviewed on September 20–21, 2026:

1. Current Host source implements the unified Task lifecycle for Conversation,
   ordinary work, and maintenance. Runtime and SDK pages still described that
   work as pending even though the owning lifecycle and message documents and
   Host source described the merged path.
2. A Conversation normally uses one stable Task. Fresh human input after
   terminal closure or cancellation can create a deterministic linked successor.
   Exact replay retains the original identity, and old system feedback alone
   cannot establish a successor.
3. `TaskIntent.mode` is retired for new intent, and current reconciliation
   rejects it. Retained compatibility data and stale code in the paused
   `may-agent.app` and an improvement-composition script do not restore the
   public contract. `requests.mode` is retired historical App vocabulary;
   current `conversation.mode` is a separate bounded-turn policy field.
4. The paused App's targeted typecheck reproduced 19 errors across several
   compatibility changes, not only mode. This documentation task does not
   migrate or activate that App.
5. The September 20 checkout revision observation (`3f9c46a2`) and later
   reviewed Host source (`1c8d8940`) are dated source facts. Neither identifies
   the running binary or installed definitions. Deployment receipts and the
   installed release record own those identities.
6. Port 6080 serves noVNC/websockify. Nginx `/terminal/` proxies ttyd through
   `/tmp/may-agent-ttyd.sock`. Published reachability does not prove an external
   authorization, authentication, proxy, or firewall boundary; the installation
   operator owns access to these trusted surfaces.
7. The September 20 Gym `recovery-pending` observations are historical. The
   retained input was repaired and no longer repeats. They do not justify a new
   age-triggered Condition or controller without first locating a remaining
   owner/intake gap.
8. The canonical `.disabled` marker excludes the App and its agents from
   discovery. Immutable source packaging may omit installation-only markers;
   the marker does not itself prove a `project_lifecycle=paused` runtime state.
   `may-agent.app` remains inactive for this change.

## Approved documentation changes

- Align `runtime.md`, `sdk.md`, `architecture.md`, and the accepted one-lifecycle
  proposal with current source and the owning lifecycle contracts.
- Qualify Conversation identity and link summaries to `message-lifecycle.md`
  rather than duplicating its complete successor rules.
- Remove heartbeat-workflow session examples from `sessions.md`; ordinary
  periodic App work uses input, Task, and attempt execution, while
  `heartbeat.md` and `cron.md` own liveness and time production.
- Replace README's volatile source baseline with the procedure for reading
  contract, source, artifact receipt, and installed-definition provenance.
- Add missing current-design and active-proposal navigation in `INDEX.md`.
- State installation-operator responsibility for Host-control and terminal
  access in `http-boundary.md`, and link `web-terminal.md` to that owner. Do not
  claim protections that inspected configuration does not demonstrate.
- Correct `runtime.md` deployment ownership: standalone deployment requires
  explicit operator authorization and installation permission, not a live Host
  Operations App Task. Optional App/Task metadata is notification correlation,
  not authority.

## Deferred and excluded work

Keep `may-agent.app` paused. Do not restore `TaskIntent.mode`, migrate paused App
code, alter runtime behavior, add age-based Conditions, monitoring controllers,
gates, release machinery, or reload/deploy the Host or definitions. Investigate
paused-consumer compatibility and Evaluation visibility as separate work only
when current evidence establishes their need.

The earlier claim that the App was active despite `.disabled`, the claim that
6080 served `/terminal/`, and the proposal to add an age Condition are withdrawn.
Historical observations remain evidence of what was seen, not current incidents.

## Evidence and verification

The material claim/source map is retained at
`/app/.state/review-pilots/design-doc-live-truth-20260921/EVIDENCE-MAP.md`.
The documentation candidate must pass `bun run check:may-design` and
`git diff --check` in its isolated worktree against the paired Host source. An
independent reviewer must inspect semantic claims because link and example gates
do not prove deployment or contract truth. Integration is local only after
supervisor clearance; no runtime rollout follows from documentation changes.
