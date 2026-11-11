<ai_context>
summary: "Pinned agentssh source shows that keeping SSH keys out of a coding agent is only the first control: the local broker must classify the resolved command, bind approval to the exact host and command, refuse requests after policy drift, and record the decision separately from command output. The implementation is an inspectable prototype, not proof of a hardened security boundary; its own threat model says a malicious same-user process can bypass hooks, access the keyring, debug or replace the daemon, and that separate-user hardening is planned."
triggers: ["agentssh", "agent SSH", "SSH key isolation", "remote command approval", "authority broker", "exact command approval", "policy drift refusal", "same-user threat boundary"]
last_updated: "2026-11-11"
source_basis: "Static inspection of ASromancer/agentssh at commit 1805b7474af1682eee9d2a0c5c51c94e5919bd94: complete non-truncated 123-entry Git tree plus README, design material, policy classifier and rules, daemon RPC and enforcement, vault, approval queue, audit log, producer-authored tests, plugin skill, and CI configuration."
</ai_context>

# Remote Agent Access Needs an Authority Broker, Not Just Hidden SSH Keys

**Date:** 2026-11-11  
**Disposition:** New knowledge  
**Repo:** https://github.com/ASromancer/agentssh  
**Reviewed revision:** [`1805b7474af1682eee9d2a0c5c51c94e5919bd94`](https://github.com/ASromancer/agentssh/tree/1805b7474af1682eee9d2a0c5c51c94e5919bd94)  
**Coverage:** Complete 123-entry repository tree; selected producer-authored documentation, implementation, tests, plugin guidance, and CI configuration, inspected statically.

## Question

What controls are required when a coding agent needs to operate remote hosts without receiving the operator's SSH private keys?

## Source observation

`agentssh` places SSH keys in an encrypted local vault and exposes remote operations through a local daemon. Its reusable contribution is broader than secret storage: it treats the daemon as an **authority broker** that decides whether a proposed remote effect may occur.

At the pinned revision:

1. **The broker classifies the command, not the agent's description.** The policy package parses shell syntax and assigns the highest observed level among `read`, `mutate`, `destructive`, and `forbidden`. It recursively inspects static nested shell commands, raises dynamic command names and parse failures, checks writes and pipelines, and blocks examples such as references to SSH secrets, downloaded code piped into interpreters, and reverse-shell forms. Per-host allow rules cannot lower built-in `forbidden` findings.
2. **Approval is bound to the exact effect proposal.** Pending requests retain the host, command, risk level, and reasons. A 30-minute sticky approval is keyed by the exact host and command string; the producer-authored daemon test verifies that approval for `rm <path>` does not cover `rm -f <path>`. The approval display is generated from broker-held data rather than agent prose.
3. **The display path is itself treated as security-sensitive.** Before requesting operating-system authentication, the daemon removes control, bidirectional-format, and invisible characters, collapses whitespace, and preserves both the beginning and end of an overlong message so padding cannot hide a command suffix. It serializes authentication dialogs so a human is less likely to approve a different overlapping request.
4. **Changed policy invalidates prior operating state.** The vault records a hash of `hosts.toml` and `rules.toml`. On unlock, a mismatch makes the daemon refuse agent requests until a human-approved reload. This turns out-of-band policy edits into an explicit stale-state condition rather than silently adopting them.
5. **Decision receipts and bulk output are separated.** The JSONL audit schema records command, host, caller-supplied context, risk level, decision, authentication mode, exit, duration, and byte count. Command output is excluded from that log and stored separately with seven-day retention. The distinction limits the permanent audit record while retaining effect and authorization evidence.

The repository also distinguishes enforcement layers. Agent hooks deny direct SSH tools and human-only subcommands, but the README calls those hooks a soft layer. The daemon enforces profiles, forbidden rules, and approvals for calls that reach it.

## Interpretation

Keeping a token or private key outside model context prevents direct secret disclosure, but it does not prevent the model from misusing the authority represented by that secret. A remote-access broker therefore needs four linked controls:

- **complete mediation of the effect path**, rather than a prompt asking the agent to behave;
- **effect-bound authorization**, using the resolved host, command, transfer, or job rather than an agent-written summary;
- **state-bound validity**, refusing execution when policy, target, or reviewed command has drifted; and
- **separate execution receipts**, so approval, policy decision, remote result, and retained output are not collapsed into one success message.

This extends the library's broader credential-isolation and exact-approval findings to remote shell authority. The additional lesson is that the broker must expose its real protection boundary. A secret-hiding proxy is not automatically a security boundary against every process that can call or tamper with it.

## Limits and unresolved risks

- Scout did not run the binary, tests, CI, an SSH server, OS authentication, hooks, GUI, vault, or failure recovery. Producer-authored tests are evidence of intended behavior, not independent validation or proof that the current suite passes.
- Static command classification is explicitly best-effort. Shell interpretation, remote programs, aliases, environment, filesystem state, alternate clients, and unmediated network paths can change the eventual effect.
- The repository's own threat model says the default daemon runs as the same user and does **not** protect against a deliberately malicious same-user process. Such a process may access the OS keyring, debug the daemon, alter agent settings, replace the binary, or use an unrecognized restart path. A separate-system-user hardened mode is described as planned, not present evidence.
- The working-directory and agent identity fields are self-reported. Repository scope is documented as a convenience constraint rather than a security boundary, and agent identity affects only a convenience approval path.
- OS-auth behavior varies by platform and is disabled by default on macOS and Windows pending real-machine verification. Code-mode notifications are readable by a same-user process, and the README explicitly warns that this weakens the boundary.
- Audit JSONL is append-oriented, not shown here to be tamper-evident, remotely anchored, or durable against a same-user attacker. Output retention is time-limited, and background jobs are lost when the daemon restarts.

## Related library work

- [Agent Security Event Log — credential isolation convergence](../agent-security-event-log.md#6-credential-isolation-convergence--full-stack-problem)
- [Human approval must bind the display and the protected effect](./2026-11-10-human-approval-must-bind-display-and-effect.md)
- [Hook policy needs host-coverage receipts](./2026-11-09-hook-policy-needs-host-coverage-receipts.md)

## Primary inspected sources

- [README and threat model](https://github.com/ASromancer/agentssh/blob/1805b7474af1682eee9d2a0c5c51c94e5919bd94/README.md)
- [Policy classifier](https://github.com/ASromancer/agentssh/blob/1805b7474af1682eee9d2a0c5c51c94e5919bd94/internal/policy/classify.go)
- [Policy decision model](https://github.com/ASromancer/agentssh/blob/1805b7474af1682eee9d2a0c5c51c94e5919bd94/internal/policy/policy.go)
- [Daemon enforcement and configuration hashing](https://github.com/ASromancer/agentssh/blob/1805b7474af1682eee9d2a0c5c51c94e5919bd94/internal/daemon/daemon.go)
- [Approval queue](https://github.com/ASromancer/agentssh/blob/1805b7474af1682eee9d2a0c5c51c94e5919bd94/internal/approval/approval.go)
- [Audit record](https://github.com/ASromancer/agentssh/blob/1805b7474af1682eee9d2a0c5c51c94e5919bd94/internal/audit/audit.go)
- [Producer-authored daemon tests](https://github.com/ASromancer/agentssh/blob/1805b7474af1682eee9d2a0c5c51c94e5919bd94/internal/daemon/daemon_test.go)
