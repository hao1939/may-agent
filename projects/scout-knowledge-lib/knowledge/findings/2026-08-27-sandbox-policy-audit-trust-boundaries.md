<ai_context>
summary: "HN surfaced Sandy, an experimental macOS coding-agent sandbox whose design cleanly separates pre-launch enforcement from runtime evidence. It can fail closed before execution and preserve immutable policy inputs, but hooks share the agent's sandbox identity, so writable records remain tamperable telemetry rather than an audit boundary."
triggers: ["Sandy sandbox", "coding-agent sandbox", "runtime controls", "sandbox identity", "audit identity", "tamperable telemetry", "fail-closed launch", "Numbat hooks"]
last_updated: "2026-08-27"
source_basis: "HN item 49467501 and the linked Sandy README and RUNTIME_CONTROLS.md design document; project version 0.1.x is self-described as experimental and unaudited."
</ai_context>

# A Sandbox Can Enforce Policy Without Owning the Audit Boundary

Date: 2026-08-27  
Source: https://news.ycombinator.com/item?id=49467501  
Repo: https://github.com/kontext-security/sandy

## Signal

HN surfaced Sandy, an experimental macOS process sandbox for coding agents. Its
most reusable contribution is not another sandbox wrapper, but an unusually
explicit split between **enforcement identity** and **evidence identity**.

Sandy resolves filesystem, network, profile, and optional runtime-control
permissions before launch. If it cannot validate or apply the sandbox, it does
not run the target; there is no unrestricted fallback. The target starts only
after the bootstrap applies the sandbox, and descendants inherit the same
restrictions. Provider-specific integration resolvers may emit bounded
capability data, but not raw Seatbelt policy, and core validation independently
checks the resulting manifest.

That is a meaningful fail-closed execution boundary. It is not automatically an
audit boundary. Sandy's design notes state that Kontext and Numbat hooks execute
as descendants of the agent and therefore share its Seatbelt identity. Their
registrations, executables, and rule inputs can be made immutable, but Numbat's
record files and sequence database must remain writable by the whole process
tree. The agent can therefore fabricate or modify that telemetry. Even an
outside collector reached through a single allowed local port does not solve
endpoint authentication, completeness, listener squatting, overload, or
fabricated events.

**Reusable interpretation:** policy enforcement and trustworthy evidence need
separate privilege analyses. A monitor running inside a sandbox may help enforce
or observe behavior while still being unable to prove what happened. The key
question is not merely whether the monitor is a different process, but whether
it has a different security identity and an independently authenticated output
path.

## Boundary model

| Layer | Sandy's documented property | What it does not establish |
|---|---|---|
| Pre-launch resolution | Permissions and integrations resolve before execution | Correctness of every selected policy |
| Launch enforcement | Invalid or unapplied sandbox prevents target startup | VM/container isolation or complete host confinement |
| Policy-input integrity | Recognized hook binaries, registrations, and rules can be immutable | Integrity of writable hook output |
| In-sandbox monitoring | Hooks can observe descendants under the same sandbox | Independent, tamper-evident audit records |
| Local collector path | Network can be blocked except one selected local TCP port | Endpoint identity, event authenticity, completeness, or availability |
| External decision service | Identified as the stronger future separation | Session authentication, framing, timeout, and fail-mode semantics are deferred |

## Design guidance

- Model **who can act** and **who can attest** as different principals. A process
  boundary without a security-identity boundary is insufficient for audit.
- Keep launch fail-closed: an unavailable policy compiler or invalid manifest
  should not silently downgrade to unrestricted execution.
- Compile integrations into typed, bounded capabilities rather than allowing
  plugins to inject raw sandbox rules into the trusted launch path.
- Describe writable in-boundary records as telemetry, not an audit ledger.
  Immutability of the logger binary does not imply integrity of its output.
- For high-assurance evidence, use an outside collector with authenticated
  session identity, ordered request/result binding, bounded framing, explicit
  timeout behavior, and a chosen fail-open or fail-closed policy.
- Test adjacent negatives for every policy loosening: exact port but wrong
  address, exact directory but protected sibling, recognized registration but
  malformed executable shape.

## Evidence limits

- This finding analyzes the project's own documentation; it does not claim an
  independent security assessment or successful adversarial validation.
- The README labels version `0.1.x` experimental, macOS-only, unaudited, and
  dependent on Apple's private, deprecated sandbox facility.
- The HN item had two points and no discussion when checked, so the signal comes
  from the linked design documents rather than community validation.

## Primary sources

- HN item: https://news.ycombinator.com/item?id=49467501
- Sandy README: https://github.com/kontext-security/sandy/blob/main/README.md
- Runtime-control architecture: https://github.com/kontext-security/sandy/blob/main/RUNTIME_CONTROLS.md
