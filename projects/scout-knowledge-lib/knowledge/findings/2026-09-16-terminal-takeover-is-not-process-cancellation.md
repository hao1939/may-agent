<ai_context>
summary: "GitHub finding on Conn's human-agent shared terminal: write authority is a revocable lease and command approval is a separate gate, but reclaiming terminal input does not cancel a command already running. This distinguishes interaction takeover from effect cancellation and bounds what the audit can prove."
triggers: ["human-agent handoff", "terminal control lease", "write authority", "command approval", "process cancellation", "shared terminal", "Conn"]
last_updated: "2026-09-16"
source_basis: "Read-only GitHub Search API discovery and pinned inspection of eggplantiny/conn revision a8fc70d1ab15f90d70905e5137bcd2cf7ac59fba."
</ai_context>

# Terminal takeover is not process cancellation

**Date:** 2026-09-16  
**Signal:** Early implementation; useful control-plane pattern, not production-security evidence.

GitHub repository discovery surfaced **Conn**, a shared terminal for a human and an AI agent. Its strongest design choice is to model terminal write authority explicitly rather than infer it from UI focus. Human keystrokes and agent traffic enter through structurally different channels; the agent receives a time-limited lease tied to its connection, and the human is the default controller. On human input, the session revokes the lease before writing the human's bytes to the PTY. The repository's authority tests cover competing agents, expiration, renewal, and rejection of writes from a foreign connection.

Conn also keeps **control** separate from **command approval**. Holding the terminal lease does not waive policy. An agent's Enter can be allowed, denied, or held behind a specific approval request; while approval is pending, further typing from that agent is refused so the reviewed command cannot be replaced before execution. The handoff tests cover pending control requests, denial and expiry, return to the last connected agent, observe-only mode, and revocation of session-wide allowances.

The implementation exposes an important boundary, however: **revoking future input is not the same as revoking an effect already in flight**. The README states that taking control stops further agent input but does not cancel a command already running. A terminal handoff system therefore has at least three distinct authorities:

1. **interaction authority** — who may send the next bytes;
2. **execution admission** — whether a proposed command may begin; and
3. **effect interruption** — whether an admitted process and its descendants can still be stopped or contained.

A responsive takeover UI proves only the first unless the runtime separately tracks process identity, descendant scope, interrupt/kill outcome, and post-cancellation effects. This matters for long-running deploys, uploads, package scripts, or commands that fork: by the time the human reclaims the prompt, the effect may already be irreversible or continuing elsewhere.

The same qualification applies to audit evidence. Conn records attributed actions, commands, intents, paths, and approval outcomes, but its security document says the log is neither tamper-proof nor continuous terminal output, covers only actions passing through Conn, and does not provide complete execution provenance. The audit can support a claim about what the mediator observed; it cannot by itself prove what a shell command ultimately changed.

## Reusable design rule

Human-agent consoles should report takeover and cancellation separately. A robust handoff receipt could preserve:

`{previous controller, lease revoked at, admitted command, process/descendant scope, interrupt requested, interrupt observed, residual effects, audit coverage}`

Do not label the session “stopped” merely because the agent lost permission to type. If process-level cancellation is unavailable or unverified, say **input revoked; execution status unknown or still running**.

## Evidence and limitations

- Repository: https://github.com/eggplantiny/conn
- Pinned revision: https://github.com/eggplantiny/conn/commit/a8fc70d1ab15f90d70905e5137bcd2cf7ac59fba
- Shared-terminal behavior and explicit non-cancellation boundary: https://github.com/eggplantiny/conn/blob/a8fc70d1ab15f90d70905e5137bcd2cf7ac59fba/README.md
- Architectural separation of human and agent channels, revoke-before-write order, policy timing, and approval behavior: https://github.com/eggplantiny/conn/blob/a8fc70d1ab15f90d70905e5137bcd2cf7ac59fba/docs/architecture.md
- Trust, audit, and command-reconstruction limitations: https://github.com/eggplantiny/conn/blob/a8fc70d1ab15f90d70905e5137bcd2cf7ac59fba/docs/security.md
- Lease implementation: https://github.com/eggplantiny/conn/blob/a8fc70d1ab15f90d70905e5137bcd2cf7ac59fba/crates/core/src/authority.rs
- Handoff and control-gate tests: https://github.com/eggplantiny/conn/blob/a8fc70d1ab15f90d70905e5137bcd2cf7ac59fba/crates/core/tests/handoff.rs
- Authority tests: https://github.com/eggplantiny/conn/blob/a8fc70d1ab15f90d70905e5137bcd2cf7ac59fba/crates/core/tests/authority.rs

The inspected tree was complete (366 entries), and the cited files were retrieved successfully at the pinned revision. This review did not run the repository's tests or exercise a live shell. The project is new and low-adoption, its own documentation says it is preview software rather than an OS sandbox, and same-user processes remain inside its trust boundary. The finding is therefore about implemented control structure and candidly documented limits—not containment strength, production reliability, or independent validation.
