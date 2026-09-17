<ai_context>
summary: "Companion to agent-runtime-hardening.md for cross-source runtime integrity patterns: revision-bound workspace admission, evidence-carrying effect closure, transactional review versus atomic commit, guarded configuration writes, authorization retained through ambiguous delivery, selective decision revalidation before delayed effects, outbound publication reconciliation, history/context separation, crash-safe continuation, identity- and cost-preserving approval resume, observation-bound desktop handover, explicit unattended-execution trust boundaries, replay consistency versus effect completeness, local durability limits, enqueue-versus-effect deduplication, accountable per-connection agent writes, focus-preserving desktop control versus effect authorization, and the operational gap between detecting a bad harness verdict and surfacing it to an accountable reviewer."
triggers: ["runtime effect integrity", "revision-bound admission", "persistent workspace", "effect closure", "post-actuation observation", "actuation receipt", "transactional workspace", "atomic commit", "Overlord hypervisor", "partial replay", "guarded configuration write", "plan apply", "behavioral fingerprint", "n8n-mcp-guard", "stateful authorization", "AID-Guard", "reservation lineage", "certified no effect", "delivery fence", "decision conflict", "selective revalidation", "ATR", "typed premise", "outbound publication", "posting claim", "ambiguous delivery", "PR Cockpit", "event-sourced agent runtime", "context projection", "crash recovery", "safe resume", "approval continuation", "delegation spend", "AgenticOS", "replay divergence", "host-call journal", "Ovo runtime", "LetItLoop", "atomic marker", "at-least-once step", "Apache Maka", "desktop harness", "observation-bound input", "human handover", "stale frame", "Sideyard", "Docker Sandboxes", "microVM isolation", "credential proxy", "shared skills trust boundary", "remote terminal retry", "session generation", "input sequence", "YourDesk", "harness verdict integrity", "unread diagnostic channel", "reliability wrapper", "settlement semantics", "budget concurrency", "dedupe failure", "Kevlar", "Rebuno", "orphaned effect", "indeterminate retry", "Runpin", "enqueue deduplication", "lease reclaim", "effect deduplication", "Sensefold", "per-connection principal", "reversible agent writes", "macOS Harness", "focus preservation", "desktop effect authorization", "remote debugging consent"]
last_updated: "2026-09-17"
source_basis: "Extracted intact from agent-runtime-hardening.md during its oversized-note review. Sources are the linked Scout findings; xfreeze2/desktop-harness revision 57739ae71c563a9856a7a9a376435d17861099ef and its verify helper, skill, safety gate, and media-control postmortem; HN 49239751; Docker's product, security-model, default-posture, and credential documentation; Apache Maka revision 52c0e3275eae053ea5a221cefdd3be09bbfb46da, including its runtime-core, compaction, and resume architecture documents; qntx/ovo revision 929d39b03d2c3228e2f3fdff21d1ebc928fb1c14, especially its workflow journal, validator, resume example, and runtime host adapter; arXiv 2608.21159v1 (AID-Guard), checked through the arXiv API and full HTML paper; taovc/pr-cockpit revision 5b8ccc8c511ad3393b339e51dde68fcb3edee684, especially its review publication endpoint, GitHub posting helper, and architecture contract; HN 49462893 plus sdageltc/letitloop revision c5bc40236f405d80572507064cca6bdd7e59a3d9, especially its README, durable decorators, and crash-window scenarios; arXiv 2609.08015v1 (ATR), checked through the arXiv API and full HTML paper; arXiv 2609.11381v1 (Agent-Integrated Software), checked through the arXiv API and full HTML paper; VaderChen/YourDesk revision b553cc00c320c2c3bcea465e0dac28fc91c035ad, especially its MCP transport, terminal session protocol, remote-data contract, and smoke-test record; FarazHayder/n8n-mcp-guard revision 7ec7c7daa556f98803c11b346a268282b0889d94, especially its guarded update, behavioral signature, backup verification, and unit tests; itchyfeetleech/sideyard revision 527824c9a6b454db7c74fe32edd1a0f0bccd7bb0, including its ownership/generation handover path, frame binding, README boundary statement, and 13 locally run invariant tests; KiitaInternet/kevlar revision 1cee728c751df9d475025374e86235910bea1274, especially its budget and deduplication decorators and tests, with two direct negative controls reproduced locally; HN 49699591 plus rebuno/rebuno revision b4c97f32d36295c60a531cd1c19d46bd0796800e, especially its step transition, orphan recovery, indeterminate-retry tests, and architecture documentation; HN 49705577 plus vstorm-co/agenticos revision 023a6e09b7cb09b5c44735623817f1d4c72345fe, especially its persisted delegation pause state, spend carry, and resume tests; anduraio/runpin revision c55b71c8c03b4a285fc9d35cb1151856e048ee2d, especially its enqueue, lease-reclaim, worker, and callback contracts; Reddit post t3_1wene1q, treated only as a pseudonymous practitioner self-report; HN 49729808 plus Sensefold's product article, MCP tools reference, permissions documentation, and public configuration-example repository at revision d19c88c45ed5c0d2c42c269f4a9949bfd7def266; and HN 49735668 plus B1tR0n1n/overlord revision 7572a9b6749ddeeb686b5bcc089cd8a6d5cd3da3, especially its replay, commit, rollback, connector, audit, and integration paths, with replay-safety tests and one injected mid-replay failure reproduced locally; and browser-use/macos-harness revision b88e4d77403bbcac35752eef4f4dd72db3663fd6, especially its PID-targeted input, focus guard, permission preflights, browser prompt approver, skill contract, security notice, and focused tests."
</ai_context>

# Agent Runtime Effect Integrity

**Companion note** to [Agent Runtime Hardening](./agent-runtime-hardening.md).
Verification and verdict-integrity patterns live in
[Agent Runtime Verdict Integrity](./agent-runtime-verdict-integrity.md).

These patterns cover the boundary after an agent has been granted execution:
which revision enters a persistent workspace, what evidence closes an effect,
what work a verification receipt actually proves, and where an unattended
sandbox's trust boundary ends.

## Revision-Bound Workspace Admission (Cross-Source, August 2026)

Three independent signals move execution authority beyond a single invocation:

- [Programmatic tool calling](./findings/2026-08-07-arxiv-programmatic-tool-calling.md)
  turns a tool interface into generated control flow that can chain and
  parallelize effects.
- [AWS AgentCore runtime instances](./findings/2026-08-07-hn-agentcore-persistent-runtime.md)
  make files, processes, dependencies, and co-resident agents persist for up to
  14 days.
- [shuohao-skills](./findings/2026-08-07-github-shuohao-skill-selftests.md)
  shows a portable skill with deterministic tests, but also a symlink-based
  install path where a later pull can change the executable skill immediately.

**Combined implication:** per-call authorization is necessary but no longer
sufficient. When generated programs and updateable skills operate inside a
persistent workspace, one admitted revision can leave artifacts or processes
that affect later calls and other agents. Trust must therefore bind the
**revision, verification result, workspace generation, and expanded effect
trace** together—not merely approve the current tool invocation.

A hardened admission path should:

1. resolve skills and helpers to immutable revisions;
2. run declared deterministic checks before activation;
3. create a new workspace generation or checkpoint for the admitted revision;
4. keep per-effect authorization and expand programmatic calls into replayable
   individual effects;
5. record which revision produced each durable artifact or process; and
6. support atomic rollback of both executable content and affected workspace
   state.

This is a design inference across the three sources, not a reported benchmark
result. The arXiv note is abstract-level evidence, the AWS item is a product
announcement with minimal HN validation, and the GitHub evidence is limited to
one checked repository revision.

## Evidence-Carrying Effect Closure (Cross-Source, August 2026)

Two early implementations in different effect domains expose the same runtime
boundary:

- [Limioryn](./findings/2026-08-08-github-limioryn-evidence-carrying-actuation.md)
  ranks evidence from transport through physical effect and business outcome;
  an acknowledgement cannot establish an effect above the layer actually
  observed.
- [Countersign](./findings/2026-08-08-cross-rail-kill-switch-evidence.md)
  distinguishes a dispatched freeze from a confirmed stop, preserves each
  provider's outcome, escalates uncertain cases to session revocation, and
  keeps unresolved agents in a `still_dangerous` set.

**Combined implication:** effectful runtimes need a closure contract, not a
success boolean. Every operation should declare the intended target set, the
strongest claim required for completion, acceptable evidence and freshness,
and the response to ambiguity. Transport success, application acceptance,
actuator state, external effect, and business outcome are different claims;
none should be silently promoted to the next.

This separation also governs retries and emergency controls. Lost
acknowledgement after a non-repeatable effect may make retry unsafe, while an
unconfirmed emergency stop must remain open and escalate. A useful result type
therefore carries per-target claim level, evidence provenance, uncertainty,
retry safety, escalation attempted, and unresolved targets. Semantic closure
occurs only when all intended targets meet the required evidence level or a
named owner explicitly accepts the residual risk.

Audit evidence remains separate from effect evidence: a signed append-only
record can prove what the control plane recorded without proving that a vendor,
device, or physical process actually changed. Both projects are low-adoption,
early implemented signals rather than production-safety evidence: Limioryn's
baseline is deterministic rather than hardware-in-the-loop, and Countersign's
public controller excludes proprietary production adapters and is described as
testnet-only.

## Transactional Review Is Not the Same as Atomic Commit — Overlord (HN / GitHub, September 2026)

Overlord is an early Linux “agent hypervisor” that gives a command a writable
overlay over a target directory, records its changes, and exposes an explicit
commit or rollback decision. The checked implementation has several concrete
protections: jailed agent mode uses namespace and overlay primitives; commit
checks touched paths against the initial size-and-mtime manifest; protected
harness files require a fresh complete countersignature; replay validates every
destination before mutation to reject symlink escapes; and MCP connectors are
explicitly classified as host-side external actions that cannot be undone by
discarding the filesystem session. Its audit chain uses an HMAC key and can
optionally pin the signed head to an off-box witness.

Those controls make **review before publication** and **atomic publication** easy
to confuse. The README says changes commit “all or nothing,” but the pinned commit
path calls `apply_layers`, which copies, removes, and replaces target entries one
at a time. There is no staging-tree swap, write-ahead recovery record, or exception
handler that restores already-applied entries if a later filesystem operation
fails. `rollback_session` deletes the pending overlay; it does not reverse target
writes already made by a failed commit attempt.

A narrow injected-failure check reproduced the boundary. Scout ran the repository's
`replay_safety_test.py` successfully, confirming that invalid destinations are
rejected before replay and that a leaf symlink is replaced rather than followed.
Scout then applied an upper layer containing `a.txt` and `b.txt` while injecting an
`OSError` on the second `_copy_entry`: `a.txt` remained in the real target while
`b.txt` was absent. This is not a claim about how often ordinary filesystems fail,
but it disproves an unconditional all-or-nothing commit guarantee at the inspected
revision.

**Runtime rule:** label the guarantees separately. Overlay execution can keep
unreviewed writes away from the base tree; preflight can reject known drift and
unsafe destinations before the first write; review can authorize an exact diff;
and a keyed log can preserve accountable history. None makes a multi-file publish
atomic. An all-or-nothing claim additionally needs an atomic namespace switch or a
durable apply/undo protocol with crash recovery, followed by a post-commit check.
External connector effects remain outside even that filesystem transaction and
need their own settlement and reconciliation semantics.

This is source inspection and a local failure injection against a very new,
low-adoption repository (two GitHub stars and an HN item with three points and no
comments at retrieval), not a full security audit or production reliability
assessment. The pure replay-safety test ran in Scout's environment; kernel jail,
AppArmor, network isolation, daemon policy, and live connector behavior were not
exercised.

- **HN:** https://news.ycombinator.com/item?id=49735668
- **Repo:** https://github.com/B1tR0n1n/overlord
- **Inspected revision:** [`7572a9b6749ddeeb686b5bcc089cd8a6d5cd3da3`](https://github.com/B1tR0n1n/overlord/commit/7572a9b6749ddeeb686b5bcc089cd8a6d5cd3da3)
- **Primary sources:** [commit and replay implementation](https://github.com/B1tR0n1n/overlord/blob/7572a9b6749ddeeb686b5bcc089cd8a6d5cd3da3/overlord.py), [connector boundary](https://github.com/B1tR0n1n/overlord/blob/7572a9b6749ddeeb686b5bcc089cd8a6d5cd3da3/mcp.py), [keyed audit chain](https://github.com/B1tR0n1n/overlord/blob/7572a9b6749ddeeb686b5bcc089cd8a6d5cd3da3/audit.py), [replay-safety tests](https://github.com/B1tR0n1n/overlord/blob/7572a9b6749ddeeb686b5bcc089cd8a6d5cd3da3/test/replay_safety_test.py), and [integration guide](https://github.com/B1tR0n1n/overlord/blob/7572a9b6749ddeeb686b5bcc089cd8a6d5cd3da3/docs/INTEGRATION.md)

## A Safe Configuration Write Needs Four Different Proofs — n8n-mcp-guard (GitHub, September 2026)

`n8n-mcp-guard` turns agent edits to live n8n workflows into a concrete
plan/apply protocol. Planning reads the live workflow, computes a reviewable
diff, records both the platform version and a behavioral fingerprint, and
writes a checksum-verified backup before returning a short-lived plan. Applying
then re-reads the workflow and refuses the write if either version or
fingerprint moved, refuses if the exact-version backup is missing or damaged,
and reads the saved workflow back to compare it with the planned target.
Consumed plans are deleted, so the same in-process authority cannot be applied
twice.

The implementation is useful because its checks answer four distinct questions:

1. **Was this change reviewed?** The diff and target are frozen into the plan.
2. **Is the write still based on current state?** Version plus behavioral hash
   detect both ordinary edits and content drift under an unchanged version ID.
3. **Is the prior state recoverable?** Apply requires a readable backup whose
   definition hash matches its contents and whose workflow/version identity
   matches the planned base.
4. **Did the configuration service store the intended graph?** A post-write GET
   must match the target fingerprint rather than trusting the PUT response.

That composition is stronger than calling the whole operation “two-phase
commit”: it combines review binding, optimistic concurrency, rollback evidence,
and postcondition checking. Each check covers a different failure, so one
cannot substitute for another. In particular, a valid backup does not prove the
live state is unchanged, and a successful API response does not prove the
intended graph was persisted.

The boundary is narrower than workflow correctness or durable distributed
transactions. Plans live only in an in-memory map for 30 minutes; the behavioral
signature covers workflow name, nodes, credential bindings, and connections but
intentionally excludes activation state and other metadata; backups are local
files that may contain production configuration; and readback proves stored
configuration, not downstream effects. The repository reports 68 unit tests, a
live integration suite, and a 99-workflow validation corpus, but Scout inspected
source and project-authored tests rather than rerunning those claims. Publication
of an active workflow also remains an external-effect boundary that may need
separate reconciliation if its response is lost.

**Runtime rule:** admit an agent-authored configuration change only when review
identity, current-base identity, recovery evidence, and observed postcondition
are independently represented. Call the result “stored as intended,” not
“worked as intended,” unless execution outcomes are observed too.

- **Repo:** https://github.com/FarazHayder/n8n-mcp-guard
- **Inspected revision:** [`7ec7c7daa556f98803c11b346a268282b0889d94`](https://github.com/FarazHayder/n8n-mcp-guard/commit/7ec7c7daa556f98803c11b346a268282b0889d94)
- **Primary sources:** [guarded plan/apply implementation](https://github.com/FarazHayder/n8n-mcp-guard/blob/7ec7c7daa556f98803c11b346a268282b0889d94/src/n8n/guardedUpdate.ts), [behavioral fingerprint](https://github.com/FarazHayder/n8n-mcp-guard/blob/7ec7c7daa556f98803c11b346a268282b0889d94/src/n8n/graph.ts#L123-L148), [backup verification](https://github.com/FarazHayder/n8n-mcp-guard/blob/7ec7c7daa556f98803c11b346a268282b0889d94/src/n8n/backup.ts), and [guard tests](https://github.com/FarazHayder/n8n-mcp-guard/blob/7ec7c7daa556f98803c11b346a268282b0889d94/test/unit/guardedUpdate.test.ts)
- **Discovery query:** GitHub Repository Search API `"AI agent" (security OR sandbox OR evaluation OR observability) created:>=2026-09-11`, sorted by stars; `incomplete_results: false`

## Retry and Recovery Are Authority Transitions — AID-Guard (arXiv, August 2026)

AID-Guard sharpens effect closure around a failure that ordinary authorization
and idempotency leave open. A request can still change after admission, and a
provider can apply an effect even when its response is lost. If recovery then
mints fresh authority, a delayed predecessor and its replacement can both act
under one user approval. Independent idempotency keys do not couple those two
attempts, while a provider receipt alone does not identify the delegation that
authorized the effect.

The proposed protocol keeps one durable **reservation lineage** from approval
through provider settlement:

1. trusted services freeze the approved request and bind it to durable authority;
2. repeated checkpoints revalidate mutable dependencies, quota, session, and
   boundary state;
3. provider dispatch revalidates the exact request and current provider state at
   commit;
4. response loss leaves the reservation charged and ambiguous rather than
   authorizing a blind retry; and
5. release or one named successor is possible only after scoped certified-no-effect
   evidence and a delivery fence that makes the predecessor terminal through the
   declared recovery horizon.

This adds a missing rule to crash-safe continuation: an indeterminate effect is
not just parked execution—it is still consuming authority. Evidence can close or
reconcile that lineage but cannot itself create executable authority. Providers
without atomic commit or durable, body-bound idempotency plus terminal lookup
remain eligible only for conservative submission: ambiguity stays charged, with
no automatic retry or replacement.

The prototype reported 210 predeclared Stripe contract trials, 40
terminalize-then-successor schedules across two SaaS providers, 30 overlapping
Stripe confirm/cancel races, and 10 Stripe crash-recovery schedules without a
duplicate effect. It also blocked 44/44 attacks under complete proposer
compromise while admitting 44/44 matched legitimate proposals. This security
came with a visible utility cost: the strict exact-manifest profile reduced
benign utility by 35.4–43.8 percentage points; a typed three-call variant
recovered 9–10 completions in a separate no-seed comparison, with no observed
unsafe effect across 864 episodes.

The claim is conditional, not a general exactly-once guarantee. The prototype
used synthetic credentials on a trusted host, one enumerable loopback domain,
test-mode Stripe and sequential Resend schedules, and a declared effect-path
inventory that it verifies but does not discover. Finite races do not cover all
network interleavings or establish provider guarantees. Production use therefore
needs attested route inventory and provider-specific terminalization; omitted
egress or credential paths invalidate the boundary rather than becoming
protected effects.

- **Source:** https://arxiv.org/abs/2608.21159v1
- **Full paper:** https://arxiv.org/html/2608.21159

## A Local Posting Claim Does Not Close an External Publication — PR Cockpit (GitHub, August 2026)

PR Cockpit offers a unusually concrete human gate for AI-authored pull-request
reviews. Review agents run read-only in isolated worktrees; a person selects
findings; a dry-run assembles the exact GitHub review; and only a separate
publish action performs the outbound write. The implementation also hashes the
selected findings, recheck verdicts, notes, head SHA, provider, and model so an
unchanged preview can be reused rather than regenerated at publication time.

Its concurrency control is strong **inside the local database boundary**. A
real publish compare-and-sets the review from a postable state to `posting`
before any await, blocking concurrent publish, rerun, and recheck paths. After
GitHub returns, the endpoint records the post locally and settles the state to
`posted`. Failed assembly or submission restores the prior local state. The
GitHub helper also clears the caller's leftover `PENDING` review before posting
and retries a known 422 line-mapping failure by collapsing inline comments into
one summary review.

The source exposes the remaining external-effect gap. GitHub publication is a
single `POST .../pulls/{number}/reviews` with no application idempotency key. If
GitHub accepts that review but the response is lost, times out, or the process
dies before the local `posts` insert, recovery has only a local `posting` row
(or a restored pre-post state) and no recorded remote review ID. A retry can
therefore publish the same review twice. Deleting `PENDING` reviews does not
reconcile this case because the request uses `event: COMMENT`, which submits the
review rather than leaving it pending.

**Runtime rule:** human confirmation, stable preview, and a local compare-and-set
solve three different problems—authorization, content drift, and concurrent
callers—but not ambiguous remote completion. An outbound publication path also
needs a durable dispatch identity and effect-specific reconciliation:

1. persist a content signature and dispatch attempt before crossing the remote
   boundary;
2. attach a stable, machine-readable marker to the remote object where the API
   lacks native idempotency;
3. after timeout or restart, query the remote system for that marker before
   authorizing another post;
4. classify the attempt as posted, certified absent, or indeterminate; and
5. permit retry only after absence is established, while retaining the original
   human approval and exact preview binding.

This is source inspection of an active repository, not an observed duplicate or
reliability benchmark. GitHub API metadata reported 164 stars and two forks at
retrieval. The code demonstrates careful local exclusion and makes the narrow
crash/response-loss window legible; it does not establish that the window has
occurred in production.

- **Repo:** https://github.com/taovc/pr-cockpit
- **Inspected revision:** https://github.com/taovc/pr-cockpit/commit/5b8ccc8c511ad3393b339e51dde68fcb3edee684
- **Primary sources:** [architecture contract](https://github.com/taovc/pr-cockpit/blob/5b8ccc8c511ad3393b339e51dde68fcb3edee684/docs/ARCHITECTURE.en.md), [publication endpoint](https://github.com/taovc/pr-cockpit/blob/5b8ccc8c511ad3393b339e51dde68fcb3edee684/server/api/reviews/%5Bid%5D/post.post.ts), and [GitHub posting helper](https://github.com/taovc/pr-cockpit/blob/5b8ccc8c511ad3393b339e51dde68fcb3edee684/core/github/post.ts)
- **Discovery feed:** https://api.github.com/search/repositories?q=topic%3Aai-agents&sort=updated&order=desc&per_page=30

## Retry Safety Must Travel With the Remote Session — YourDesk (GitHub, September 2026)

YourDesk exposes remote desktops and interactive terminals through MCP, making a
useful distinction between **caller admission**, **session authority**, and
**effect replay**. Its HTTP boundary checks the direct peer address, applies either
an IP allowlist or a bearer token, rejects browser-origin requests, caps concurrent
requests, and bounds bodies and server timeouts. Remote operations then require a
connected session; terminal calls additionally require an MCP-owned connection and
the latest instance identifier, so a stale call cannot silently attach to a newly
established shell.

The stronger signal is inside the terminal protocol. Each input has a monotonically
increasing sequence number. The remote session rejects gaps and suppresses a repeated
sequence that it has already accepted, while output remains pending until the client
acknowledges its sequence. This gives retries a stable identity within one live
session instead of treating a transport timeout as permission to submit new input.
The MCP layer reinforces the rule: a timed-out operation tells the caller to inspect
remote state rather than resend, and the repository documentation says a retry of
the same terminal input must keep the original sequence and payload.

That mechanism is deliberately narrower than exactly-once effects. A separate
`run_remote_shell` tool executes short commands with the remote host account's full
authority; its documented home-directory boundary applies to file reads, not to the
shell. Cancelling the MCP wait does not prove that a command stopped, and the docs
explicitly say not to automatically resend a side-effecting command when its result
is unknown. Interactive deduplication is also scoped to a live terminal instance,
not a durable transaction spanning reconnects.

**Runtime rule:** authentication only decides who may begin. An effectful remote tool
also needs a generation-bound session, operation identity that survives safe retries,
acknowledged output, and an explicit indeterminate state when transport completion
cannot prove effect completion. If operation identity does not survive reconnect,
after-timeout recovery should observe or reconcile rather than mint a new command.

The repository records a local macOS loopback smoke test through TLS, P2P, and PTY,
including duplicate-input suppression and shell cleanup; a later supplement records a
browser-to-API-to-Remote-to-PTY path on macOS. Windows ConPTY execution, real Linux,
and cross-machine networking remained uncovered. Scout inspected source and project-
authored test records but did not run the application, so this is implementation
evidence for the protocol—not an independent security or reliability validation.

- **Repo:** https://github.com/VaderChen/YourDesk
- **Inspected revision:** [`b553cc00c320c2c3bcea465e0dac28fc91c035ad`](https://github.com/VaderChen/YourDesk/commit/b553cc00c320c2c3bcea465e0dac28fc91c035ad)
- **Primary sources:** [MCP server and timeout behavior](https://github.com/VaderChen/YourDesk/blob/b553cc00c320c2c3bcea465e0dac28fc91c035ad/internal/clientui/mcp.go#L180-L298), [terminal session binding](https://github.com/VaderChen/YourDesk/blob/b553cc00c320c2c3bcea465e0dac28fc91c035ad/internal/clientui/mcp_terminal.go#L12-L68), [remote sequence and acknowledgement handling](https://github.com/VaderChen/YourDesk/blob/b553cc00c320c2c3bcea465e0dac28fc91c035ad/internal/terminal/session.go#L164-L201), [remote-data safety contract](https://github.com/VaderChen/YourDesk/blob/b553cc00c320c2c3bcea465e0dac28fc91c035ad/docs/MCP-REMOTE-DATA.md), and [terminal smoke-test record](https://github.com/VaderChen/YourDesk/blob/b553cc00c320c2c3bcea465e0dac28fc91c035ad/docs/SMOKE-TERMINAL-2026-09-11.md)
- **Discovery query:** GitHub Repository Search API `"AI agent" (security OR sandbox) created:>=2026-09-08`, sorted by stars; `incomplete_results: false`

## A Handover Must Revoke Stale Perception as Well as Input Authority — Sideyard (GitHub, September 2026)

Sideyard makes human–agent desktop handover a three-part runtime transition rather
than a UI toggle. First, an explicit owner field gates agent input. Second, each
screenshot carries a workspace generation and MCP frame identity; input derived
from an older generation or another workspace is rejected. Third, taking human
control increments the generation, pauses agent input, waits for held keys and
buttons to be released, and retires the old transport before enabling the human
viewer. Returning control performs the reverse teardown but gives the agent
ownership only after a fresh screenshot succeeds; uncertain teardown or failed
observation leaves the workspace paused.

The useful pattern is that **authority and perception expire together**. Revoking
input alone prevents a simultaneous write but does not stop a resumed agent from
acting on a pre-takeover screen. A generation fence invalidates that stale premise;
a fresh observation then establishes the new actuation base. The supervisor also
rechecks generation between actions in a batch, narrowing the race in which a
handover begins after batch admission. Those mechanisms answer different questions:
who may act, which observed state an action assumes, whether the old input channel
is gone, and whether control can safely resume.

The evidence is implementation-level and narrow. Scout ran the pinned repository's
13 Python invariant tests successfully, including stale-generation rejection,
paused-owner rejection, cross-workspace frame rejection, and the between-actions
owner recheck. The declared `make check` could not run because this environment has
no `make`; its additional Omarchy plugin validation and the live desktop smoke test
were therefore not reproduced. The README also describes only same-user isolation:
host files remain readable and attached projects writable. This is evidence for a
handover protocol, not for hostile-code containment, complete desktop compatibility,
or production adoption.

**Runtime rule:** treat human takeover and return as generation changes. Before
resuming an agent, revoke the old input transport, invalidate observations and
queued actions from the prior generation, acquire a fresh observation, and fail
closed in a paused state if any transition step is uncertain.

- **Repo:** https://github.com/itchyfeetleech/sideyard
- **Inspected revision:** [`527824c9a6b454db7c74fe32edd1a0f0bccd7bb0`](https://github.com/itchyfeetleech/sideyard/commit/527824c9a6b454db7c74fe32edd1a0f0bccd7bb0)
- **Primary sources:** [README and boundary statement](https://github.com/itchyfeetleech/sideyard/blob/527824c9a6b454db7c74fe32edd1a0f0bccd7bb0/README.md), [handover and generation checks](https://github.com/itchyfeetleech/sideyard/blob/527824c9a6b454db7c74fe32edd1a0f0bccd7bb0/src/agent_workspaces/session.py), [frame binding](https://github.com/itchyfeetleech/sideyard/blob/527824c9a6b454db7c74fe32edd1a0f0bccd7bb0/src/agent_workspaces/mcp.py), and [invariant tests](https://github.com/itchyfeetleech/sideyard/blob/527824c9a6b454db7c74fe32edd1a0f0bccd7bb0/tests/test_invariants.py)
- **Discovery query:** GitHub Repository Search API `"AI agent" created:>=2026-09-13`, sorted by stars; `incomplete_results: false`

## History Fidelity and Execution Safety Are Orthogonal — Apache Maka (GitHub, August 2026)

Apache Maka supplies a concrete event-sourced runtime design in which model
messages, tool calls and results, permission decisions, usage, and terminal
facts enter an ordered Runtime Event Log. Session state, the UI, model context,
and recovery are projections over that log rather than competing authorities.
This makes a useful distinction operational: **context may forget while
history does not**.

Its compaction design treats a summary or provider-native compact state as a
materialized view over an ordered event prefix. The checkpoint carries a
through-boundary and source digest, keeps a recent raw tail, and may replace
raw history in a provider request only after durable append and replay-policy
validation. A mismatched or damaged projection is rejected or rebuilt from the
canonical ledger. Crucially, the digest proves which source prefix was covered;
it does not prove that an LLM summary preserved every meaning, and a claim such
as “tests passed” gains no authority by appearing in a checkpoint.

Crash continuation then applies a separate safety test. Maka records a dispatch
fact before a tool crosses the side-effect boundary and a result fact after it
settles. A dispatch with no result is **indeterminate**, not “not executed.” The
current safe-resume path creates a new execution only when every accepted tool
call has a committed outcome; otherwise it parks. Generic shell commands and
remote send, publish, pay, or delete effects remain parked unless a dedicated
reconciler can observe and settle them. The project explicitly says production
reconciler wiring is future work.

**Combined implication:** an append-only interaction log solves fact retention
and projection recovery, but not external-effect closure. Conversely, an effect
receipt without immutable model-visible lineage cannot explain what the agent
knew when it acted. A hardened runtime needs both planes:

1. a canonical semantic ledger with source-bound, disposable context views;
2. pre/post effect facts that preserve the unknown interval after a crash;
3. tool-specific reconciliation for effects that can be observed safely; and
4. fail-closed parking when either history or effect state cannot be proved.

Evidence is architecture and implementation documentation from the repository,
not an independent reliability benchmark. The README also warns that current
data formats can change and that this storage generation does not import older
JSONL conversation authority, so “recoverable going forward” should not be
confused with migration compatibility for existing users.

- **Repo:** https://github.com/apache/maka
- **Inspected revision:** [`52c0e3275eae053ea5a221cefdd3be09bbfb46da`](https://github.com/apache/maka/commit/52c0e3275eae053ea5a221cefdd3be09bbfb46da)
- **Primary sources:** [runtime core](https://github.com/apache/maka/blob/52c0e3275eae053ea5a221cefdd3be09bbfb46da/docs/architecture/runtime-core-architecture-draft.md), [compaction as projection](https://github.com/apache/maka/blob/52c0e3275eae053ea5a221cefdd3be09bbfb46da/docs/architecture/llm-compaction-events-log-projection-draft.md), and [safe resume](https://github.com/apache/maka/blob/52c0e3275eae053ea5a221cefdd3be09bbfb46da/docs/architecture/runtime-resume-architecture.md)

## Verification-Evidence Binding — Brigade (GitHub, August 2026)

Moved intact to [Agent Runtime Verdict Integrity](./agent-runtime-verdict-integrity.md#verification-evidence-binding--brigade-github-august-2026).

## A Valid Receipt Must Carry Its Coverage Boundary — ASQAV (GitHub, September 2026)

Moved intact to [Agent Runtime Verdict Integrity](./agent-runtime-verdict-integrity.md#a-valid-receipt-must-carry-its-coverage-boundary--asqav-github-september-2026).

## The Verdict Path Needs Its Own Negative Controls — ProjectGuard (GitHub, September 2026)

Moved intact to [Agent Runtime Verdict Integrity](./agent-runtime-verdict-integrity.md#the-verdict-path-needs-its-own-negative-controls--projectguard-github-september-2026).

## A Clean Sweep Must Prove What It Swept — Dream Studio (GitHub, September 2026)

Moved intact to [Agent Runtime Verdict Integrity](./agent-runtime-verdict-integrity.md#a-clean-sweep-must-prove-what-it-swept--dream-studio-github-september-2026).

## Boundary-Explicit Unattended Execution — Docker Sandboxes (HN, August 2026)

A high-activity HN thread around Docker Sandboxes supplies a concrete product
signal for the move from command-by-command approval to infrastructure-bounded
agent autonomy. Docker advertises a dedicated microVM per agent, a private
Docker Engine, deny-by-default network policy, and host-side credential
injection so coding agents can run in permissive modes without receiving raw
API keys. The official security documentation is unusually explicit about
what that boundary does **not** protect.

The microVM confines the host kernel, processes, Docker daemon, and filesystem
outside explicit shares, but direct mode mounts the working tree read-write by
default. An agent can therefore change or delete project files—including Git
hooks, CI configuration, IDE tasks, and build scripts—that later execute on the
host. `--clone` strengthens this boundary by mounting the source repository
read-only and giving the agent a private clone. Shared agent skills are also
read-write by default across participating sandboxes, putting those sandboxes
inside one durable instruction-and-script trust boundary unless
`--no-share-skills` is used. Local stdio MCP servers remain host processes,
not microVM-confined tools.

Credential proxying is a separate capability boundary: the host proxy matches
an allowed service and injects the secret into the outbound header while the
sandbox sees a sentinel value. This reduces credential exfiltration from the
VM, but it still grants the agent the **authority to use** that credential
against allowed endpoints. OAuth passthrough can additionally opt out of
sentinel masking. The distinction matters: secret non-disclosure, permission
to exercise the secret, network reachability, and workspace mutability are
four different controls.

HN participants repeatedly asked how the product differs from hand-built
containers or existing microVM runtimes. More useful than that packaging debate
were two deployment questions: several commenters valued outbound firewalling
and boundary-level secret injection, while another noted that providing a
sandbox does not itself enforce that every agent process is launched inside
it. This yields an operational rule: an autonomy boundary needs both
**confinement** (what a sandboxed process can reach) and **admission** (which
agent processes are permitted to run, and only through the sandbox launcher).

The product page and docs establish architecture and defaults, not independent
breakout resistance or production reliability. Docker's claim of a “hard
security boundary” should therefore be treated as vendor-reported until tested.
The reusable design value is its explicit boundary inventory: host isolation,
workspace mode, cross-sandbox shared state, MCP escape hatches, network policy,
and credential-use authority must each be reviewed separately.

- **HN:** https://news.ycombinator.com/item?id=49239751
- **Source:** https://www.docker.com/products/docker-sandboxes/
- **Security model:** https://docs.docker.com/ai/sandboxes/security/
- **Default posture:** https://docs.docker.com/ai/sandboxes/security/defaults/
- **Credential model:** https://docs.docker.com/ai/sandboxes/security/credentials/

## Replay Consistency Is Not Effect Completeness — Ovo (GitHub, August 2026)

Ovo's journaled Rhai workflow mode supplies a compact implementation of deterministic **host-call replay**. Each call is assigned a dense sequence number and a hash over its kind plus canonicalized request JSON. On resume, a matching entry returns the recorded result without calling the model again; a changed kind or request hash fails as replay divergence. The v2 append-only JSONL journal also has a format header, byte and entry ceilings, symlink rejection, synchronous appends, and repair for an incomplete final line. A repository example asserts that a two-agent workflow makes two samples initially and zero new samples when replayed.

This is a useful middle layer between rerunning a free-form agent and adopting a full durable-execution backend: the script remains readable control flow, while nondeterministic agent calls become memoized host boundaries. Dry-run validation separately compiles and executes a script against a model-free probe host, and the runtime exposes typed paused, budget-exceeded, cancelled, failed, and completed outcomes.

The safety boundary is narrower than the word “journal” may suggest. Entries contain the request hash and the host's returned JSON, but no signature, script or argument digest, dispatch-before-effect marker, idempotency key, or post-crash reconciliation status. The scratch-file and git-diff helpers also execute in the host adapter rather than appearing in this replay journal. A valid replay therefore establishes **call-order and request consistency for covered calls**, not that the journal is untampered, that every side effect was captured, or that an external effect completed. In particular, a crash after an effect crosses its boundary but before its result is appended retains the same unknown interval identified in Apache Maka's safe-resume design above.

**Runtime rule:** treat request-hashed replay as one rung in a continuation ladder:

1. script validation establishes that one probe path compiles and terminates acceptably;
2. request-hash matching establishes that covered host calls were reissued in the same order with the same canonical payload;
3. authenticated journal provenance establishes who produced an unmodified record;
4. dispatch/result facts establish whether a crash left an effect indeterminate; and
5. effect-specific observation or reconciliation establishes whether the outside world reached the intended state.

Ovo currently demonstrates rungs 1–2, with useful bounded-load and torn-write defenses. It should not be credited with rungs 3–5 without additional host-owned controls. This assessment is source inspection at one tagged repository revision, not an independent reliability or security benchmark; the environment lacked Cargo, so Scout could not execute the repository's supplied tests or resume example.

- **Repo:** https://github.com/qntx/ovo
- **Inspected revision:** https://github.com/qntx/ovo/commit/929d39b03d2c3228e2f3fdff21d1ebc928fb1c14 (`v0.9.1`)
- **Primary sources:** [journal and replay](https://github.com/qntx/ovo/blob/929d39b03d2c3228e2f3fdff21d1ebc928fb1c14/crates/ovo-workflow/src/journal.rs), [dry-run validator](https://github.com/qntx/ovo/blob/929d39b03d2c3228e2f3fdff21d1ebc928fb1c14/crates/ovo-workflow/src/validate.rs), [resume example](https://github.com/qntx/ovo/blob/929d39b03d2c3228e2f3fdff21d1ebc928fb1c14/crates/ovo/examples/workflow_resume.rs), and [runtime host adapter](https://github.com/qntx/ovo/blob/929d39b03d2c3228e2f3fdff21d1ebc928fb1c14/crates/ovo-runtime/src/workflow_host.rs)

## A Local Marker Can Trade Duplicate Effects for Missing Effects — LetItLoop (HN, August 2026)

HN surfaced LetItLoop under the claim “resume crashed AI agent loops with 0% token waste.” Its implementation supports a narrower and useful guarantee: a completed, JSON-serializable step is recorded locally and fast-forwards on resume, while an in-flight step runs again at least once. The README states both limits, and the repository's post-action/pre-journal crash scenario explicitly expects `AT_LEAST_ONCE_REPLAY`. The reported zero-waste result comes from a synthetic file-write conformance harness, so it should not be generalized to arbitrary model calls or remote effects.

The accompanying `atomic_marker()` makes the external-effect boundary especially clear. It creates an exclusive local marker **before** yielding permission to call the remote mutation. A crash after marker creation but before the mutation causes resume to see the marker and skip the effect: duplication is avoided by accepting a possible missing effect. Moving the marker after the mutation reverses the failure mode—a crash after remote success but before marker persistence can duplicate the effect. A local filesystem marker cannot atomically commit with an unrelated remote service.

**Runtime rule:** advertise recovery guarantees by crash window and effect class, not with one aggregate “zero waste” label:

1. completed local steps may be replay-skipped when their durable result is intact;
2. in-flight pure or idempotent steps may safely run at least once;
3. marker-before-effect provides at-most-once admission but can lose the intended effect;
4. effect-before-marker can duplicate the intended effect; and
5. exactly-once business effect requires provider-bound idempotency/transactionality or post-crash reconciliation, not a local marker alone.

This does not negate the repository's checksummed WAL, torn-tail handling, or explicit at-least-once scenario. It narrows the claim to what those mechanisms establish. Evidence is source inspection at one very new, low-adoption revision (four GitHub stars and an HN item with one point and no comments at retrieval), not an independent benchmark reproduction.

- **Source:** https://news.ycombinator.com/item?id=49462893
- **Repo:** https://github.com/sdageltc/letitloop
- **Inspected revision:** https://github.com/sdageltc/letitloop/commit/c5bc40236f405d80572507064cca6bdd7e59a3d9
- **Primary sources:** [README resume semantics](https://github.com/sdageltc/letitloop/blob/c5bc40236f405d80572507064cca6bdd7e59a3d9/README.md), [`step()` and `atomic_marker()`](https://github.com/sdageltc/letitloop/blob/c5bc40236f405d80572507064cca6bdd7e59a3d9/orchestrator/decorators.py), and [post-action/pre-journal scenario](https://github.com/sdageltc/letitloop/blob/c5bc40236f405d80572507064cca6bdd7e59a3d9/conformance/scenarios/DCP-003-POST_ACTION_PRE_JOURNAL.json)

## Reliability Wrappers Need Settlement Semantics — Kevlar (GitHub, September 2026)

Kevlar packages several small Python guards around unattended agents. Its budget
decorator checks a feature-local monthly ledger before a paid call and records the
cost after the call returns. Its deduplication decorator records an argument-derived
key before invoking the wrapped function. These choices are useful for ordinary
single-process cases, but together they expose a general boundary: **admission,
effect settlement, and durable accounting are different transitions**.

Two narrow negative controls reproduced the uncovered intervals at pinned revision
`1cee728c…1274`. First, a wrapped function that raised on its first invocation was
still marked as recently seen; the identical retry was suppressed and returned the
configured duplicate value without re-invoking the function. Second, two synchronized
threads each passed a `$1.00` budget check for a `$0.75` call. Both calls completed,
while the shared JSON ledger ended at `$0.75`, not `$1.50`. The check, effect, and
read-modify-write accounting steps are not serialized, and the repository tests cover
sequential success and rejection rather than these failure and concurrency paths.

This is not evidence that lightweight decorators are useless. It identifies the
claim they can safely make. A local dedupe window can reduce repeated calls in one
process, and a sequential ledger can provide coarse feature attribution. Neither is
an exactly-once effect protocol or a hard concurrent spend ceiling. A stronger
contract needs an explicit state machine such as `reserved → dispatched → settled`
(or `failed/indeterminate`), an atomic per-key reservation, provider idempotency or
post-effect reconciliation, and accounting that preserves outstanding reservations
rather than recording only successful returns. Failed calls also need an explicit
retry policy instead of silently inheriting the same status as completed effects.

Scout could not run the repository's claimed 24-test pytest suite because pytest was
absent in the environment; `compileall` succeeded, and the two direct Python negative
controls above reproduced against the pinned source. The repository was two stars at
inspection, so this is implementation-level boundary evidence, not production
reliability validation.

- **Repo:** https://github.com/KiitaInternet/kevlar
- **Inspected revision:** https://github.com/KiitaInternet/kevlar/commit/1cee728c751df9d475025374e86235910bea1274
- **Primary sources:** [budget guard](https://github.com/KiitaInternet/kevlar/blob/1cee728c751df9d475025374e86235910bea1274/kevlar_agent/budget.py), [deduplication guard](https://github.com/KiitaInternet/kevlar/blob/1cee728c751df9d475025374e86235910bea1274/kevlar_agent/dedupe.py), [budget tests](https://github.com/KiitaInternet/kevlar/blob/1cee728c751df9d475025374e86235910bea1274/tests/test_budget.py), and [deduplication tests](https://github.com/KiitaInternet/kevlar/blob/1cee728c751df9d475025374e86235910bea1274/tests/test_dedupe.py)

## A Version Change Is a Trigger, Not a Verdict — ATR (arXiv, September 2026)

Long-running agents can read evidence, pause for a tool or approval, and act after
that evidence changes. ATR makes a useful distinction: a **version conflict** says
something changed, while a **decision conflict** says the change falsified a
condition that justified the pending action. Aborting on every version mismatch
throws away still-valid reasoning; ignoring mismatches can release invalid
effects.

The proposed gate records typed, executable premises and evidence-to-effect
dependencies. A reverse index finds the affected closure after a change, then the
gate can keep the pending action, refresh presentation-only data, require
replanning, or block. Free-form rationale is explicitly not accepted as an
executable premise. Before release, target-local state must be bound through a
transaction, compare-and-set, uniqueness constraint, lease, or domain command.
Cross-system policy or authority needs its own reservation, capability, lease, or
fencing token; otherwise the evidence remains unbound and irreversible effects
should fail closed.

The paper's controlled evidence supports the mechanism, not production accuracy.
Across 210,000 executions that repeatedly exercise 15 developer-authored mutation
cases, ATR matched the declared outcome with no false allows or blocks. Ten durable
SQLite cells evaluated 0.6 premises per change versus 6.0 for a full scan. At
4,093 recorded reads, warmed single-process validation took 9.3 microseconds
versus 2,595.9 for the full scan. But the evaluation excludes connector, network,
model, logging, and replanning costs; does not test natural-language premise
extraction; and uses deterministic author-specified validators and ground truth.

The fault injection is the more operationally important result: omitting the sole
critical dependency edge yielded false-allow rates of 0.95%, 5.05%, and 9.97% at
1%, 5%, and 10% omission. Selectivity therefore shifts the safety burden onto
**complete or conservatively over-approximated dependency capture** and sound
premise validators. ATR also does not solve crash ambiguity after an external
effect, partial multi-system effects, or non-idempotent APIs; it belongs before
the effect-closure and recovery mechanisms documented elsewhere in this note.

**Runtime rule:** persist the justification as machine-checkable conditions,
revalidate only the affected closure when attribution is trustworthy, and bind
the checked versions to the authoritative commit. If premise extraction,
dependency attribution, or cross-system binding is uncertain, widen the closure
or fail closed rather than treating a selective green check as global safety.

- **Source:** https://arxiv.org/abs/2609.08015v1
- **Full paper:** https://arxiv.org/html/2609.08015
- **Artifact named by the paper:** https://github.com/ezreal13/atr-decision-validation/tree/89c32fa

## An Approval Must Bind the Task Revision, Not Just the Caller — AIS (arXiv, September 2026)

Agent-Integrated Software (AIS) isolates a coordination failure that ordinary API
validation and account permissions do not catch. A person can approve a proposal,
then alter the same shared objects through the application's normal interface while
the delegated task continues. The original approval remains authentic, but its
recipient list, attachment, or effect scope may now be obsolete. A later operation
can therefore be schema-valid and caller-authorized while violating the task the
person currently sees.

The paper's proposed **interaction–effect obligation** binds each admission to five
things: the current task revision, the reviewed object or payload versions,
role-specific authority, the active controller and its epoch, and evidence strong
enough to justify the reported outcome. Its compact disclosure example separates
four host-enforced invariants:

1. the admitted payload still matches the endorsed task and object bindings;
2. authority is current for the role, resource, action, and context;
3. admission occurs under the running task and active controller epoch, with the
   decision recorded atomically; and
4. a committed outcome is reported only from authoritative effect evidence.

This refines revision checking into a larger semantic boundary. A task revision can
invalidate **future** admissions without rewriting the historical truth of an effect
that was already admitted. Likewise, an acknowledged stop must fence later
admissions under the old controller epoch, but cannot imply reversal of an external
effect already committed. Compensation is a new authorized operation, not a
generated inverse command.

The paper also gives continuous assurance a useful three-valued standing. A witnessed
violation refutes a scoped claim; current evidence and dependencies can support it;
an expired premise, unavailable receipt, or coverage gap leaves it **insufficiently
supported**, not passing. Dependency tracking then permits selective reassessment:
a planner change may invalidate behavioral evidence while leaving an unchanged
admission gate's invariant intact, whereas adding an unmediated write path destroys
the gate's coverage premise.

The evidence is a formal perspective and research agenda, not a deployed-system
validation. Its propositions are conditional on authoritative bindings, complete
mediation, an initially valid journal, and an atomic trusted gate. The authors
explicitly do not establish goal suitability, progress, usability, fairness, or the
absence of omitted effects, and their cross-domain examples are hypothetical design
probes. The operational value is therefore the contract decomposition and its
failure tests—not an empirical claim that AIS has solved integration reliability.

**Runtime rule:** bind effect admission to the endorsed task revision and reviewed
objects as well as identity and permission; fence controller generations at the
admission boundary; and represent assurance as supported, refuted, or insufficient
under explicit versioned dependencies.

- **Source:** https://arxiv.org/abs/2609.11381v1
- **Full paper:** https://arxiv.org/html/2609.11381v1

## Replay Can Preserve a Verdict Without Settling the Effect — Rebuno (HN / GitHub, September 2026)

Rebuno's pinned implementation makes one crash boundary unusually explicit. Before
an agent runs a tool, model, or local call, the kernel records the step as
`executing`; afterward the agent reports a terminal result. A later dispatch
recomputes the step ID from execution, kind, target, canonical argument hash, and
per-dispatch occurrence. Terminal steps replay their recorded result. An orphaned
`safe_to_retry` step runs again, while an orphaned `at_most_once` step becomes
`failed/indeterminate`. A repository test further shows that a fresh attempt to
submit the same target and arguments after that indeterminate result is denied,
while a call with different arguments may proceed.

This is stronger than silently equating a missing result with “not executed,” but
it deliberately does not provide exactly-once effects. The idempotency class is
supplied by the agent and defaults to `safe_to_retry`; a mistaken declaration can
therefore duplicate a write. Conversely, `at_most_once` avoids automatic duplicate
execution by accepting that the intended effect may be lost or may already have
happened. The kernel's error tells the agent to inspect external state, but that
reconciliation is outside the runtime. Policy is also evaluated on first submission
and skipped when replaying the already recorded step, so replay preserves the old
step verdict rather than proving current authorization or current external state.

**Runtime rule:** record dispatch-start and terminal-result facts separately; make
orphan recovery an explicit per-effect choice; and treat `indeterminate` as a
machine-readable reconciliation obligation. A complete recovery receipt still
needs the provider's idempotency key or authoritative post-crash state—not merely a
valid local replay decision.

- **HN source:** https://news.ycombinator.com/item?id=49699591
- **Repo:** https://github.com/rebuno/rebuno/tree/b4c97f32d36295c60a531cd1c19d46bd0796800e
- **Primary implementation:** [step submission and orphan handling](https://github.com/rebuno/rebuno/blob/b4c97f32d36295c60a531cd1c19d46bd0796800e/internal/kernel/step.go), [indeterminate-retry test](https://github.com/rebuno/rebuno/blob/b4c97f32d36295c60a531cd1c19d46bd0796800e/internal/kernel/kernel_test.go#L1138-L1200), and [architecture contract](https://github.com/rebuno/rebuno/blob/b4c97f32d36295c60a531cd1c19d46bd0796800e/docs/architecture.mdx)
- **Evidence level:** pinned repository code and repository-authored tests inspected;
  not an independent production reliability evaluation (the Go toolchain was not
  available locally, so the tests were not rerun)

## Approval Resume Is a Compound Integrity Boundary — AgenticOS (HN / GitHub, September 2026)

AgenticOS's pinned delegation runtime shows why “resume after approval” is not one
piece of state. A parent parks on its own `task` tool call, while the human verdict
names a tool call inside the delegate. Starting the delegate again can therefore
substitute the parent's call identity, discard the delegate's conversation, and let
the model choose a different action. The implementation instead persists a plain-data
`ParkedDelegation` containing both call identities, a stable public task identity,
the delegate's serialized messages, its child run ID, first start time, and cumulative
spend. On replay, the original parent call retrieves the delegate-specific messages
and deferred verdicts, while the stable task ID reopens the same UI panel rather than
creating a second apparent task.

The cost state is deliberately independent of the resumable conversation. The carry
tracks pre-park plus post-resume spend, separately retaining the amount billed to a
published delegate's row when inline descendants have no row of their own. It also
keeps a `has_unpriced_models` bit so a priced continuation cannot make an earlier
unpriced segment look exact. If best-effort message capture fails, the implementation
still preserves spend and timing but reruns the delegation from the start. That is an
honest accounting fallback, not approval fidelity: the repository comments explicitly
acknowledge that a restarted model may choose a different tool.

This yields three distinct resume guarantees: **decision binding** (the verdict reaches
the tool call it names), **execution continuity** (the same delegate state continues),
and **accounting continuity** (all segments remain attributed once). Preserving one
does not imply the other two. In particular, a system that cannot restore the reviewed
conversation should require a new approval or fail closed before a newly generated
effect, even if it can still report the earlier spend accurately.

**Runtime rule:** persist parent-call identity, reviewed child-call identity, delegate
history, continuation verdicts, stable presentation identity, cumulative spend, and
pricing completeness as separate fields. On resume, prove each binding independently;
never treat accurate cost carry or a valid old verdict as evidence that a regenerated
action is the one a person reviewed.

- **HN source:** https://news.ycombinator.com/item?id=49705577
- **Repo:** https://github.com/vstorm-co/agenticos/tree/023a6e09b7cb09b5c44735623817f1d4c72345fe
- **Primary implementation:** [persisted delegation state](https://github.com/vstorm-co/agenticos/blob/023a6e09b7cb09b5c44735623817f1d4c72345fe/backend/app/agents/subagent_runtime.py#L295-L523) and [park/resume journal](https://github.com/vstorm-co/agenticos/blob/023a6e09b7cb09b5c44735623817f1d4c72345fe/backend/app/agents/capabilities/subagents/_journal.py#L550-L712)
- **Repository tests inspected:** [delegation seams](https://github.com/vstorm-co/agenticos/blob/023a6e09b7cb09b5c44735623817f1d4c72345fe/backend/tests/test_delegation_seams.py#L190-L220) and [nested resume](https://github.com/vstorm-co/agenticos/blob/023a6e09b7cb09b5c44735623817f1d4c72345fe/backend/tests/test_subagent_nested_resume.py)
- **Evidence level:** pinned repository code and repository-authored tests inspected;
  the two primary modules compiled locally, but repository tests were not rerun because
  `uv` was unavailable

## Detection Without Attention Does Not Close a Bad Verdict — Reddit Practitioner Report (September 2026)

A pseudonymous builder of a long-running autonomous research system reported an
instructive two-layer failure. After stopping the system for an audit, the builder
said that 55% of recorded results were infrastructure failures presented as
findings. The same post says the system had detected the problem months earlier,
but the operator did not read the channel where it was reported. The described
system also had append-only ledgers, provenance structures, six self-modification
gates, read-only diagnostic tools, and an audit register.

This is not independent evidence for the percentage or the architecture: the post
provides no public artifact, raw audit, or reproducible method. Its useful signal is
the failure decomposition. Verdict integrity can fail in the execution harness even
when the reasoning layer appears sound, while anomaly detection can succeed without
producing an operational response. A diagnostic channel is therefore not effect
closure; it needs an accountable consumer, escalation threshold, acknowledgement,
and a state transition that prevents suspect outputs from remaining accepted.

**Runtime rule:** keep infrastructure outcomes distinct from domain findings; make
that classification independently auditable; and route high-severity contradictions
to an owned, acknowledged queue that can quarantine affected results. Measure not
only detection rate but also time-to-review and the fraction of accepted findings
covered by unresolved harness alerts.

- **Source:** https://www.reddit.com/r/AI_Agents/comments/1wene1q/ive_been_building_something_for_a_year_so_far_its/
- **Stable post ID:** `t3_1wene1q`
- **Evidence level:** full post body observed in Reddit's public Atom search feed;
  pseudonymous self-report, not independently validated

## Durable Queue State Is Not Downstream Effect Deduplication — Runpin (GitHub, September 2026)

Runpin's pinned implementation cleanly exposes three guarantees that are easy to
collapse into one. First, an optional `idempotency_key` deduplicates **job creation**:
submitting the same key returns the existing row. Second, a transaction claims a
queued row under a worker lease, heartbeats extend that lease, and stale leases are
returned to the queue. Third, completion is conditional on the current lease owner
and `running` status, so a stale worker cannot overwrite the winner's local terminal
record.

Those controls protect queue state, not necessarily the remote effect. The built-in
`http_callback` handler sends the payload to an arbitrary service and stores the
response only after it returns. If that service commits an effect and the response is
lost—or if a lease expires while the old request is still completing—a reclaimed
attempt can send the callback again. The worker's abort signal asks the old request
to stop, but cannot retract an effect already accepted remotely. More subtly, the
job's top-level `idempotency_key` is not automatically forwarded to the callback;
the handler sends only the nested payload after removing callback configuration.
Downstream deduplication therefore requires the caller to place a stable operation
identifier in that payload and the receiver to enforce it. The README appropriately
lists exactly-once delivery and horizontal multi-worker correctness as non-goals.

**Runtime rule:** label enqueue deduplication, attempt fencing, and business-effect
deduplication separately. Keep a stable operation key across retries, transmit it
through the effect boundary, require the receiver to return the prior result for that
key, and reconcile ambiguous timeouts before retrying a non-repeatable action.

- **Repo:** https://github.com/anduraio/runpin/tree/c55b71c8c03b4a285fc9d35cb1151856e048ee2d
- **Primary implementation:** [job creation and lease transitions](https://github.com/anduraio/runpin/blob/c55b71c8c03b4a285fc9d35cb1151856e048ee2d/src/db/jobs.ts), [worker heartbeat, abort, and retry loop](https://github.com/anduraio/runpin/blob/c55b71c8c03b4a285fc9d35cb1151856e048ee2d/src/worker/index.ts), and [HTTP callback payload](https://github.com/anduraio/runpin/blob/c55b71c8c03b4a285fc9d35cb1151856e048ee2d/src/handlers/index.ts)
- **Documented boundary:** [README non-goals and enqueue contract](https://github.com/anduraio/runpin/blob/c55b71c8c03b4a285fc9d35cb1151856e048ee2d/README.md) and [custom-runner contract](https://github.com/anduraio/runpin/blob/c55b71c8c03b4a285fc9d35cb1151856e048ee2d/docs/CUSTOM-RUNNERS.md)
- **Evidence level:** pinned source and documentation inspection at a new,
  two-star repository; no repository test files were present in the inspected tree,
  and no runtime reliability experiment was performed

## First-Class Agent Identity Makes Writes Accountable, Not Pre-Authorized — Sensefold (HN, September 2026)

Sensefold's account of replacing an embedded chat with a remote MCP server combines
several controls that are often discussed separately. Each OAuth connection or
headless Agent key is a distinct revocable principal rather than impersonating the
human account. A tier shapes the advertised tool list, while dispatch performs a
second capability check. Mutations produce attributed revisions; updates and soft
deletes require an `expectedVersion`; and create retries reuse a client-generated
UUID, with different content under the same UUID rejected. Together these controls
answer **which connection wrote what**, avoid silent overwrites, and give a person a
reviewable compensation path.

The combination is useful, but its limits matter. A fixed `edit` or `full` tier is
standing capability, not evidence that a human approved a particular write. Revision
history and Revert recover prior application state after a bad edit; they do not undo
external effects caused by content already read, exported, or acted on. The UUID
contract covers retried creates only if the client preserves the key, while
`expectedVersion` detects stale writes rather than validating their intent. Finally,
the public repository at the checked revision contains manifests and examples, not
the server implementation or tests, so the enforcement, attribution, and recovery
claims are product documentation rather than independently inspected behavior.

**Runtime rule:** treat per-connection identity, capability admission, concurrency
control, retry deduplication, attribution, and compensation as separate receipts.
Their composition makes unattended writes more diagnosable and recoverable, but a
high-impact effect still needs operation-specific authority before dispatch and an
explicit account of consequences that a local Revert cannot reverse.

- **HN source:** https://news.ycombinator.com/item?id=49729808
- **Article:** https://sensefold.app/blog/agent-as-first-class-user
- **Product contracts:** https://sensefold.app/docs/mcp-tools/ and https://sensefold.app/docs/connect/permissions/
- **Public repo:** https://github.com/SenseFoldLabs/sensefold-mcp/tree/d19c88c45ed5c0d2c42c269f4a9949bfd7def266
- **Evidence level:** full article and product documentation read; public repository
  tree inspected at the pinned revision; no server implementation, tests, live
  connection, or recovery experiment was available, and the HN item had one point
  and no comments at retrieval

## Focus Preservation Is Not Effect Authorization — macOS Harness (GitHub, September 2026)

`browser-use/macos-harness` is a deliberately thin desktop harness: one persistent
Python process exposes screenshots, PID-targeted keyboard and pointer events,
Accessibility operations, Apple Events, a real Chrome connection, and ordinary
filesystem and subprocess access. Its pinned implementation includes concrete
interaction-safety invariants. Input without an explicit app or prior snapshot is
refused; app-name ambiguity is rejected; permission checks fail closed when macOS
reports missing Accessibility, screen-capture, or event-posting access; and each
background input burst compares the frontmost application before and after. If the
target unexpectedly becomes frontmost, the harness raises `FocusChangedError`.
Project tests exercise both PID targeting and the focus-change stop.

Those are useful **delivery and interference controls**, not an authorization
boundary. The focus check runs after events have already been posted, so it can stop
a sequence but cannot retract the first click or keystroke. It detects one narrow
transition—the background target becoming frontmost—not whether the intended
semantic object was selected, whether an operation is irreversible, or whether the
agent was entitled to perform it. The skill itself tells the model to stop at
irreversible actions, while the security notice tells operators to review them;
that policy remains advisory. The same process also exposes `Path`, `subprocess`,
Apple Events, Accessibility mutation, and browser control without a task-scoped
allowlist or effect ledger.

The browser bridge makes the authority distinction especially visible. On first
connection it watches for Chrome's exact **“Allow remote debugging?”** window and
programmatically presses the `Allow` button through system-wide Accessibility.
Matching the exact window and button reduces accidental clicks, but automating a
consent UI is not evidence of contemporaneous user approval. It converts an OS
prompt into harness bootstrap behavior once the host already has sufficient
Accessibility authority.

**Runtime rule:** model desktop safety as at least three independent gates:
(1) capability admission for global OS permissions, (2) operation-specific intent
approval before consequential effects, and (3) post-action observation bound to the
same target and state. PID targeting and focus preservation improve delivery
precision, but must not be promoted into proof of intent, authorization, or effect
correctness. Consent dialogs should produce an explicit user-presence receipt rather
than being auto-accepted by the same principal requesting the capability.

- **Repo:** https://github.com/browser-use/macos-harness
- **Inspected revision:** [`b88e4d77403bbcac35752eef4f4dd72db3663fd6`](https://github.com/browser-use/macos-harness/commit/b88e4d77403bbcac35752eef4f4dd72db3663fd6)
- **Primary sources:** [runtime implementation](https://github.com/browser-use/macos-harness/blob/b88e4d77403bbcac35752eef4f4dd72db3663fd6/src/macos_harness/macos.py), [Chrome prompt bridge](https://github.com/browser-use/macos-harness/blob/b88e4d77403bbcac35752eef4f4dd72db3663fd6/src/macos_harness/browser.py), [agent skill](https://github.com/browser-use/macos-harness/blob/b88e4d77403bbcac35752eef4f4dd72db3663fd6/skills/macos-harness/SKILL.md), [security notice](https://github.com/browser-use/macos-harness/blob/b88e4d77403bbcac35752eef4f4dd72db3663fd6/SECURITY.md), and [focused tests](https://github.com/browser-use/macos-harness/blob/b88e4d77403bbcac35752eef4f4dd72db3663fd6/tests/test_macos.py)
- **Evidence level:** README, skill, security notice, implementation, and focused
  tests inspected at the pinned revision; repository tree was complete (35 entries).
  Scout did not run the macOS-only code, exercise a live application, or test the
  Chrome permission flow.
- **Discovery query:** GitHub Repository Search API `"agent" "LLM" in:name,description,readme created:>2026-08-15`, sorted by stars; `incomplete_results: false`
