---
summary: "Kamchatka makes projected context, permission decisions, and effective shell confinement inspectable as separate runtime facts; its implementation also shows why a visible policy is not an enforcement boundary unless the runtime reports what the kernel actually accepted."
triggers: ["Kamchatka", "Nachalnik", "transparent agent context", "agent permission UI", "Landlock", "seccomp user notification", "network gate", "effective confinement"]
last_updated: "2026-10-02"
source_basis: "Live Hacker News discovery plus static inspection of ljedrz/nachalnik at commit 8900b41ef3ab115e35d4b6dfc825359a88a13239 (Kamchatka 0.17.0). README, operator guides, selected policy, context-introspection, Landlock, seccomp-gate, and repository-authored test files were read. The package and tests were not run because Cargo was unavailable in Scout's environment."
---

# Agent transparency should expose projected state and effective enforcement

<ai_context>
Use this finding when designing or assessing a local coding-agent runtime. A readable policy or transcript is not enough. Expose what the next model request will actually contain, which subjects a permission decision covers, and which confinement mechanisms the host kernel actually accepted. Keep those as separate facts so configured intent cannot masquerade as enforced authority.
</ai_context>

**Observed:** 2026-10-02  
**Disposition:** New source-grounded finding  
**Coverage:** Current 20-item HN newest-story feed; HN item 49931738; pinned Kamchatka 0.17.0 documentation; selected context, permission-policy, sandbox, network-gate, and repository-authored test files. Static inspection only.

## Sources

- **HN:** [49931738 — Show HN: A Linux terminal agent with transparent context, permissions, and logs](https://news.ycombinator.com/item?id=49931738)
- **Repo:** [ljedrz/nachalnik](https://github.com/ljedrz/nachalnik)
- **Pinned revision:** [`8900b41ef3ab115e35d4b6dfc825359a88a13239`](https://github.com/ljedrz/nachalnik/commit/8900b41ef3ab115e35d4b6dfc825359a88a13239)
- **Release:** [`kamchatka-v0.17.0`](https://github.com/ljedrz/nachalnik/releases/tag/kamchatka-v0.17.0)
- **Primary documentation:** [`kamchatka/README.md`](https://github.com/ljedrz/nachalnik/blob/8900b41ef3ab115e35d4b6dfc825359a88a13239/kamchatka/README.md), [`kamchatka/GUIDE.md`](https://github.com/ljedrz/nachalnik/blob/8900b41ef3ab115e35d4b6dfc825359a88a13239/kamchatka/GUIDE.md), [`kamchatka/RUNNING.md`](https://github.com/ljedrz/nachalnik/blob/8900b41ef3ab115e35d4b6dfc825359a88a13239/kamchatka/RUNNING.md)
- **Selected implementation:** [`src/introspect/mod.rs`](https://github.com/ljedrz/nachalnik/blob/8900b41ef3ab115e35d4b6dfc825359a88a13239/kamchatka/src/introspect/mod.rs), [`src/tools/policy.rs`](https://github.com/ljedrz/nachalnik/blob/8900b41ef3ab115e35d4b6dfc825359a88a13239/kamchatka/src/tools/policy.rs), [`src/sandbox/mod.rs`](https://github.com/ljedrz/nachalnik/blob/8900b41ef3ab115e35d4b6dfc825359a88a13239/kamchatka/src/sandbox/mod.rs), [`src/gate.rs`](https://github.com/ljedrz/nachalnik/blob/8900b41ef3ab115e35d4b6dfc825359a88a13239/kamchatka/src/gate.rs)
- **Selected repository-authored tests:** [`tests/policy.rs`](https://github.com/ljedrz/nachalnik/blob/8900b41ef3ab115e35d4b6dfc825359a88a13239/kamchatka/tests/policy.rs), [`tests/boundary.rs`](https://github.com/ljedrz/nachalnik/blob/8900b41ef3ab115e35d4b6dfc825359a88a13239/kamchatka/tests/boundary.rs)

## Source observation

Kamchatka is a Linux-only terminal agent built on the Nachalnik Rust runtime. The HN submission emphasizes transparency, but the implementation's useful distinction is that transparency has multiple subjects rather than one generic audit pane.

### 1. Context inspection is about the next request, not merely stored history

The context view distinguishes what an item stores from what the model will receive. It reports active, pinned, elided, and excluded states; counts content sent versus held back; and exposes the projected representation used for the next request. This matters for tool-call repair: an excluded result can force its unmatched call out of the provider request even if both objects remain stored. The documentation says the chat and context panes are derived from current context state rather than copied at arrival, while the introspection tools use public kernel context and request-building surfaces.

The reusable property is **projection observability**: an operator should be able to answer “what will the model read next?” independently of “what does the runtime still retain?” A transcript alone answers only the second question.

### 2. Permission decisions are typed by operation, resource, and provenance

`Careful` evaluates several kinds of subject: a domain such as `fs`, an operation such as `fs:read`, path-name rules such as `.env*`, and the MCP server a tool came from. The strictest consulted rule wins, and a domain-level denial cannot be loosened by a finer allow. Unknown decisions default to `ask`. A refusal reason is retained so the same cause can reach both the human interface and the model's tool result.

The selected tests cover several failure-prone details: wrapped tool arguments must still reach path and network checks; an allowed MCP server must not override a refusal of `mcp:call`; path rules must match the normalized name that will be opened; a domain allow applies to all its operations unless a finer denial exists; and one-off grants expire with their call batch. These are repository-authored tests, not independent verification, but they demonstrate that the policy's displayed grain is intended to match its decision grain.

### 3. Visible policy and enforced shell authority are reported separately

The shell boundary uses Landlock for filesystem and TCP restrictions and a seccomp user-notification gate for attempts to create IPv4 or IPv6 sockets. The gate holds `socket()` at the syscall, so a script or alternate client cannot bypass a command-name classifier; it also refuses `io_uring_setup` so socket creation through an I/O ring is not an unobserved side door. When the gate is available, an undecided network attempt can be held for a human answer once per command. When it is not, the code falls back to a documented command-name heuristic and labels the weaker state rather than equating it with syscall mediation.

The sandbox models network state as `Open`, `NoTcp`, `Shut`, or `Asked`, and confinement as `Full`, `Partial`, `Unavailable`, or `Off`. Kernel capability probes determine which statement is shown. The code explicitly records limitations for older kernels: without the gate, Landlock may leave UDP reachable; kernels lacking newer Landlock rights may leave pathname or abstract Unix sockets and cross-domain signals outside the intended restriction. This is the critical transparency rule: **report effective enforcement, not merely requested configuration**.

## Interpretation

An inspectable local-agent boundary should expose three different planes:

1. **Model projection:** the exact items and repaired structure the next provider request will receive.
2. **Decision state:** the current allow/ask/deny answer, its subject grain, provenance, and reason.
3. **Effective enforcement:** which OS mechanisms are active, what authority they actually remove, and where a fallback is heuristic or partial.

Collapsing these planes creates false confidence. A context item may be stored but absent from the next request. A permission row may accurately describe a policy while an unrestricted shell subsumes it. A sandbox configuration may request “no network” while the running kernel enforces TCP only. The operator interface should derive each claim from the runtime object that owns it and preserve weaker states instead of rounding them up.

This complements [Agent Security: Enforcement Evidence and Runtime Coverage](../agent-security-enforcement-evidence.md): Kamchatka is a concrete example of making enforcement degradation visible at runtime, while that note supplies the broader rule that configured policy and observed mediation still do not prove complete path coverage.

## Limits

- The HN item had one point and no comments when inspected. It is discovery evidence, not community validation.
- Scout inspected selected files at the pinned release commit but did not exhaustively review the workspace, compile the package, run its tests, execute a model session, or test Landlock/seccomp behavior. Cargo was not installed in the research environment.
- The confinement is Linux-specific and depends on kernel features. The project intentionally reports partial or unavailable enforcement, but those labels do not independently prove every process, descriptor, socket family, filesystem path, or child lifecycle is covered.
- System directories are readable so commands can run; explicitly opened paths expand the boundary; and `--no-sandbox` removes kernel confinement. A deployment's actual authority therefore depends on launch configuration as well as code.
- Path rules govern path-taking tools by name and are not claimed to parse arbitrary file references embedded in shell strings. The shell's meaningful boundary is the OS confinement, not those name rules.
- The documented browser relay has no authentication or encryption and is described as suitable only for a trusted network while watched. Served session sockets and relay exposure require separate deployment review.
- Local transcripts and context visibility improve auditability but can contain complete conversations and tool output. The project records them in a private temporary directory by default; retention, export, and host compromise remain separate risks.
