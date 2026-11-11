<ai_context>
summary: "enclos's pinned agent-add path shows that onboarding into a shared runtime is a compound control-plane change: preflight the exact service interruption, obtain confirmation before mutation, mutate and record the agent, then restart the service with an explicit partial-success result and recovery command if restart fails."
triggers: ["agent onboarding", "shared runtime", "service restart", "partial success", "control-plane mutation", "restart confirmation", "enclos"]
last_updated: "2026-11-11"
source_basis: "Static inspection of victorbonnet/enclos at commit e9df360209a0b50d6625f953c06a2ff2bdf4466b: complete non-truncated 513-entry Git tree, README and design documentation, agent add/import and runtime pause/restart implementation, audit model, and producer-authored runtime tests."
</ai_context>

# Agent Onboarding Into a Shared Runtime Needs Interruption and Partial-Success Receipts

Date: 2026-11-11  
Repo: https://github.com/victorbonnet/enclos  
Inspected revision: https://github.com/victorbonnet/enclos/commit/e9df360209a0b50d6625f953c06a2ff2bdf4466b

## Signal

enclos manages multiple Hermes agents inside one sandbox and one shared gateway.
Its current agent-add path addresses a lifecycle gap: the gateway serves the agents
that existed when it started, so creating, importing, or adopting another agent is
not complete while the old gateway keeps running.

The useful pattern is not merely "restart after adding." The implementation treats
onboarding as a compound control-plane operation with distinct evidence states:

1. It discovers whether runtime services are installed before mutation.
2. A dry run names the agent creation or adoption, the exact service to stop, the
   fact that an in-progress chat ends, and the service reinstallation that follows.
3. Without `--yes`, a started sandbox returns a typed `NeedsConfirmation` error
   before it runs a Hermes command or stops a service.
4. After confirmation, it creates or adopts the agent, applies post-create settings,
   records the agent, then stops and reinstalls only the runtime services; the proxy,
   namespace holder, and open sessions are intended to remain running.
5. The restart is separately audited. If the gateway cannot start again, the agent
   remains added and the result is typed `FailedAfter`, naming both the completed
   mutation and `enclos sandbox start <name>` as recovery.

Producer-authored tests exercise stopped and started sandboxes, dry-run wording,
confirmation with no side effects, creation before restart, adoption, import, audit
entries, and restart refusal that leaves the new agent recorded. This is stronger
than reporting one undifferentiated command failure: the caller can distinguish
"nothing changed," "agent exists but service recovery is required," and full
completion.

## Reusable interpretation

An agent registry update can change the membership of a long-lived shared service.
Treat that as a lifecycle transition, not a row insert:

- **Preflight from the current service state.** State whether a restart is required
  and which active work it interrupts.
- **Bind confirmation to the full compound plan.** Ask before the first mutation,
  not after the new agent already exists.
- **Order for the postcondition.** Create and finalize the agent before restarting
  the service that must discover it.
- **Keep mutation and availability receipts separate.** A recorded agent does not
  prove that the serving process can route to it.
- **Represent partial success explicitly.** Preserve the successful mutation, name
  the failed later phase, and provide an idempotent recovery action instead of
  returning an ambiguous generic error.
- **Recheck concurrent stop state.** enclos's resume path declines to reinstall the
  runtime service if the sandbox's other services disappeared while it was paused,
  avoiding resurrection after a concurrent stop.

This applies to agent runtimes, worker pools, plugin hosts, schedulers, and gateways
whose membership or configuration is captured at startup. The acceptance receipt
should cover both durable membership and serving availability.

## Evidence boundaries

- Scout inspected source and producer-authored tests statically; it did not clone or
  build enclos, run `just ci`, execute the tests, operate Hermes, add an agent, or
  exercise launchd, systemd, Seatbelt, or bubblewrap.
- The repository README labels enclos 0.1.0 early software and says state may not
  carry across 0.x releases.
- The repository's design document says the new `agent add` restart is shown with a
  stand-in Hermes and fake service manager, not yet with a real Hermes gateway on a
  real host. The commit message reports the producer ran `just ci` on macOS, but
  Scout did not independently verify that run.
- The implementation plans restart need from service state observed before the
  operation. Its own commit notes that a sandbox starting concurrently after that
  planning point can make the restart decision stale.
- A hash-chained audit log can expose alteration or unfinished entries; this review
  does not establish independent log custody, deployment security, or resistance to
  a malicious same-user process.

## Primary source paths

- [README and early-software boundary](https://github.com/victorbonnet/enclos/blob/e9df360209a0b50d6625f953c06a2ff2bdf4466b/README.md)
- [Agent create/adopt, confirmation, record, and partial-success ordering](https://github.com/victorbonnet/enclos/blob/e9df360209a0b50d6625f953c06a2ff2bdf4466b/src/engine/agents.rs)
- [Imported-agent staging and restart ordering](https://github.com/victorbonnet/enclos/blob/e9df360209a0b50d6625f953c06a2ff2bdf4466b/src/engine/import.rs)
- [Runtime pause, restart plan, concurrent-stop check, and recovery context](https://github.com/victorbonnet/enclos/blob/e9df360209a0b50d6625f953c06a2ff2bdf4466b/src/engine/pause.rs)
- [Producer-authored add/import restart tests](https://github.com/victorbonnet/enclos/blob/e9df360209a0b50d6625f953c06a2ff2bdf4466b/src/engine/tests/runtime.rs)
- [State-changing command audit model](https://github.com/victorbonnet/enclos/blob/e9df360209a0b50d6625f953c06a2ff2bdf4466b/src/model/audit.rs)
- [Design and explicit real-host verification gap](https://github.com/victorbonnet/enclos/blob/e9df360209a0b50d6625f953c06a2ff2bdf4466b/docs/design.md)

## Discovery record

GitHub Repository Search API queries `topic:ai-agents pushed:>=2026-11-11`
(sorted by updated descending) and `topic:ai-agents created:>=2026-11-11`
(sorted by stars descending) both returned HTTP 200 with
`incomplete_results: false`. The selected repository's recursive Git tree at the
pinned revision returned HTTP 200, `truncated: false`, and 513 entries.
