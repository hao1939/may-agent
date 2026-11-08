<ai_context>
summary: "Pinned Background Agents source separates durable pre-launch identity, command completion, descendant ownership, and credential usability for reconnectable coding-agent turns."
triggers: ["Background Agents", "sandbox jobs", "lost launch response", "durable launch identity", "descendant ownership", "Daytona secrets"]
last_updated: "2026-11-08"
source_basis: "Static inspection of jamesmurdza/background-agents at commit 400d8d0423be5540b5216f074a62aa8d62ce6956; Scout did not run the software, tests, Daytona, coding agents, cgroups, or secret proxy."
</ai_context>

# Background agent recovery needs a prepared-attempt fence

**Date:** 2026-11-08  
**Disposition:** new knowledge  
**Question:** What durable facts let a cold caller reconnect to a long-running coding-agent turn without duplicating a lost launch or misreporting its completion?  
**Repo:** https://github.com/jamesmurdza/background-agents  
**Reviewed version:** commit [`400d8d0423be5540b5216f074a62aa8d62ce6956`](https://github.com/jamesmurdza/background-agents/commit/400d8d0423be5540b5216f074a62aa8d62ce6956)  
**Coverage:** repository README, complete repository tree, sandbox-jobs documentation, types, implementation excerpts and launch/status tests, plus background-session and sandbox-secret source. Scout performed static inspection only.

## Source observation

Background Agents runs coding-agent turns in Daytona sandboxes. Its most reusable signal is not sandbox placement alone, but a small recovery protocol spanning the conversation layer and the process layer.

Before launching a turn, the background-session code persists a fresh `jobId`, provider, turn number, start time, and `launchProtocol: 1` in conversation metadata. The process package then binds that stable job ID to command metadata in the sandbox filesystem. Retrying the same ID with the same command reattaches; retrying it with different work is rejected. An `abort` fence prevents a delayed launcher from starting an attempt after cancellation. Project-authored tests cover a lost launch response, same-ID retry, different-command rejection, start-versus-abort races, and failure to publish process metadata before user code executes.

Completion is also narrower than “no foreground process.” Each job records append-only output, the wrapper exit code, and a separate foreground-command completion record. Status checks combine those records with process-group and cgroup observations. A command may be reported complete while an intentionally launched service remains in its owned cgroup, but cancellation keeps descendant ownership and uses the cgroup to reach children that escaped the original process group. Missing or corrupt metadata is treated as unknown or erroneous, not as proof that no process started.

The repository's secret package exposes another independent boundary. Daytona supplies opaque placeholders whose real values are substituted by an HTTPS proxy only for allowed hosts. Code in the sandbox cannot read the value directly, but anything in the sandbox can still use a mounted placeholder, and clients that ignore the proxy configuration fail rather than receive the secret. Mount state, proxy readiness, process-spawn timing, detach failure, and pinned long-running-service credentials therefore remain separate lifecycle facts.

## Interpretation

A reconnectable agent turn needs at least four distinct receipts:

1. **prepared attempt** — the caller durably records the execution identity before launch;
2. **launch binding** — the sandbox binds that identity to one command and rejects changed reuse;
3. **command settlement** — output and exit records establish the foreground command's result;
4. **owned descendants** — remaining services and cancellation scope are tracked independently from command completion.

This avoids two common collapses. First, a lost launch reply does not authorize a fresh anonymous launch: the caller reattaches using the prepared identity. Second, a terminal command result does not imply that every descendant has stopped. Conversation resumption, process settlement, service lifetime, and cancellation are related but non-equivalent states.

Credential handling adds a fifth receipt: **credential usability at the effect route**. Keeping the cleartext value outside the sandbox reduces disclosure, but it does not decide which sandbox process may use the placeholder, whether the proxy was active when that process spawned, or whether detachment succeeded. Secret opacity is not least authority by itself.

## Comparison with existing Scout knowledge

[Lightweight waiting agents need durable facts, not resident workers](./2026-11-07-agent-recovery-admission-effect-boundary.md) separates replayable admission decisions from uncertain external effects. This repository is a distinct implementation subject and adds a narrower launch-side pattern: persist a discoverable attempt before execution, bind retries to the exact command, and retain descendant ownership after foreground completion. It also complements [Agent Runtime Unattended Execution and Replay](../agent-runtime-unattended-execution-and-replay.md), which treats host-owned durability and effect settlement as separate concerns.

## Limitations

The evidence is repository-authored and was not independently executed. Scout did not run the packages or tests, create a Daytona sandbox, reproduce a lost response or race, inspect live filesystem durability, exercise cgroup privileges, launch a supported coding agent, validate secret substitution, or test bypass routes. The inspected tests emulate parts of the launch protocol and privileged cgroup setup; they are implementation evidence, not proof of production reliability or complete sandbox containment.

The design also depends on sandbox filesystem persistence, readable metadata, cgroup-v2 behavior and privileges, and Daytona's proxy semantics. A mounted placeholder remains usable by any code in that sandbox, background services may intentionally outlive the command that created them, and a failed secret detach can leave authority live longer than intended. These are documented boundaries, not closed guarantees.
