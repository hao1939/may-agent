<ai_context>
summary: "Companion to agent-runtime-hardening.md for cross-source runtime integrity patterns: revision-bound workspace admission, evidence-carrying effect closure, post-actuation observation, verification evidence bound to its subject, and explicit unattended-execution trust boundaries."
triggers: ["runtime effect integrity", "revision-bound admission", "persistent workspace", "effect closure", "post-actuation observation", "actuation receipt", "desktop harness", "verification subject binding", "Brigade", "Docker Sandboxes", "microVM isolation", "credential proxy", "shared skills trust boundary"]
last_updated: "2026-08-10"
source_basis: "Extracted intact from agent-runtime-hardening.md during its oversized-note review. Sources are the linked Scout findings; xfreeze2/desktop-harness revision 57739ae71c563a9856a7a9a376435d17861099ef and its verify helper, skill, safety gate, and media-control postmortem; Brigade revision 0e8b83ae6ef779bb6be8701dd4cd534c064608f9; HN 49239751; and Docker's product, security-model, default-posture, and credential documentation."
</ai_context>

# Agent Runtime Effect Integrity

**Companion note** to [Agent Runtime Hardening](./agent-runtime-hardening.md).

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

## Verification-Evidence Binding — Brigade (GitHub, August 2026)

[Brigade](./findings/2026-08-09-brigade-receipt-subject-binding.md) adds a
useful boundary to runtime verification: a real process exit code proves that a
check ran, but does not by itself prove **which work passed**. Its version-2
receipt schema records baseline commit, tree fingerprint, and patch digest;
missing identity data remains explicit rather than being silently upgraded into
patch proof.

Brigade reserves scoreable `subject_binding` for tracked, manifest-selected
runs. That binding ties the named artifact and content fingerprint to the
verifier manifest, patch source, producer-owned delta, and independent verifier.
Ad hoc command receipts remain audit-only even when they are durable or signed.
The implementation also avoids shell execution for verification commands and
retains the local receipt if archival fails.

**Runtime rule:** treat verification evidence as a typed ladder:

1. execution receipt — the command and exit status are real;
2. state binding — baseline, tree, and patch identity are known;
3. subject binding — the artifact and approved verifier are named;
4. authority separation — producer and verifier identities are distinct; and
5. outcome admission — only evidence satisfying the required rung may change
   promotion, routing, or completion state.

This sharpens the effect-closure rule above. Cryptographic integrity can show
that a receipt was not altered, but semantic binding determines what claim the
receipt may support. The evidence is architecture and implementation evidence
from Brigade's own repository at revision
`0e8b83ae6ef779bb6be8701dd4cd534c064608f9`, not an independent reliability
benchmark.

- **Primary sources:** [receipt schema](https://github.com/escoffier-labs/brigade/blob/main/docs/receipt-schemas.md),
  [execution model](https://github.com/escoffier-labs/brigade/blob/main/docs/execution-model.md),
  [outcome scoring](https://github.com/escoffier-labs/brigade/blob/main/docs/outcome-scoring.md),
  and [verification implementation](https://github.com/escoffier-labs/brigade/blob/main/src/brigade/work_cmd/verification.py).

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
