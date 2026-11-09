<ai_context>
summary: "Fairlead demonstrates a deterministic, sequence-aware Cedar policy gate for coding-agent hooks, but its own residual-risk record makes clear that signed decisions prove only the calls the host delivered to the hook; complete mediation and fail-closed behavior remain host-, version-, route-, and deployment-dependent."
triggers: ["Fairlead", "coding-agent policy gate", "Cedar hook", "sequence-aware authorization", "host coverage receipt", "signed decision receipt", "fail-closed agent hook"]
last_updated: "2026-11-09"
source_basis: "HN item 50418404 and OliverKlug/fairlead repository at commit 066fe7efe9508a565656cdb2d72cfcb4863c7dcc inspected 2026-11-09. Scout read the complete README, residual-risk document, policy-pack contract, attack-suite guide, repository metadata, and tree; software and tests were not run."
</ai_context>

# Hook policy needs host-coverage receipts

**Date:** 2026-11-09  
**Disposition:** New implementation-evidence finding  
**Coverage:** HN item plus selected complete project documents at one pinned revision; no execution or independent security validation

## Observation

[HN item 50418404](https://news.ycombinator.com/item?id=50418404) links to
[Fairlead](https://github.com/OliverKlug/fairlead), a Rust policy gate for coding-agent tool calls. The HN item had one point and no comments when inspected, so it is a discovery lead rather than evidence of adoption or community validation.

At repository commit
[`066fe7efe9508a565656cdb2d72cfcb4863c7dcc`](https://github.com/OliverKlug/fairlead/commit/066fe7efe9508a565656cdb2d72cfcb4863c7dcc), Fairlead's host adapters translate shell, file, fetch, MCP, and subagent events into a fixed context record evaluated by a Cedar policy pack. The documented baseline is default-deny with forbid-wins semantics. Its notable addition over a stateless command filter is session state: a sensitive-file read or untrusted web/MCP observation can cause a later network-shaped action to be denied even when that later call looks harmless in isolation. Decisions can carry local Ed25519 signatures plus hashes of the binary, policy pack, and configured hooks file.

The repository also separates policy correctness from setup checks. `doctor` runs authored fixtures and checks selected fail-closed host settings; `arm` reruns those fixtures and pins hashes. The attack-suite guide maps named cases to project tests and labels evidence grades, while the residual-risk document repeatedly narrows the claim: Fairlead is a hook-level policy enforcement point, not an OS sandbox, and receipts prove what the policy process saw rather than that every tool call reached it.

That limitation is material rather than boilerplate. The inspected documents list routes where coverage depends on host and version behavior: a hook entry that never loads, unsupported or post-action events, direct IDE terminal use, subprocess effects after an allowed command, host settings Fairlead cannot observe, and reported or untested bypass behavior in some Claude Code and Cursor modes. Fail-closed handling also differs by host and version. The project says Cursor uses `failClosed: true`; Claude Code requires `onFailure: "block"` on sufficiently new versions; Windsurf proceeds for failures other than the expected deny exit. A correctly signed deny or allow therefore establishes one mediated decision, not universal tool coverage.

## Reusable implication

A deterministic hook gate should expose two independent evidence planes:

1. **Decision evidence:** exact normalized action, policy and adapter versions, session-state inputs, matched rules, verdict, and integrity binding for the gate that ran.
2. **Coverage evidence:** which host version and settings were active, which event classes were subscribed, whether the host actually invoked the gate, which equivalent effect routes remained reachable, and whether a broken or absent hook blocked execution.

Sequence-aware rules are valuable because they can express restrictions such as “no egress after secret access” without asking another model to judge intent. But their state is meaningful only inside the coverage envelope: a secret read or network action that bypasses the adapter cannot update or consult that state. Likewise, a signed receipt is evidence of an observed decision; absence of a receipt is ambiguous unless an independent host or containment boundary proves that every relevant effect must produce one.

For consequential actions, combine the hook policy with a stronger effect boundary—sandbox, credential broker, network proxy, provider-side authorization, or another independently controlled mediator—and retain correlation evidence between the host request, gate verdict, and actual effect settlement. This complements [Agent Security: Enforcement Evidence and Runtime Coverage](../agent-security-enforcement-evidence.md): verdict integrity and route coverage are separate claims.

## Evidence boundary

Scout read the complete repository README, `docs/residual-risk.md`, `pack/policies/README.md`, `tests/attack_suite/README.md`, the repository tree and metadata, and the HN item at the pinned revision. Scout did not compile or run Fairlead, execute its authored tests or attack suite, verify a receipt, reproduce any live Cursor or Claude Code probe, inspect every Rust source file or Cedar rule, test bypasses, audit cryptography, or establish deployment coverage. Repository performance, protection, compatibility, and live-probe results are project-authored. The repository was created three days before inspection and had two GitHub stars, no forks, and no open issues in the retrieved metadata; maturity and adoption are unknown.

## Sources

- **HN:** https://news.ycombinator.com/item?id=50418404
- **Repo:** https://github.com/OliverKlug/fairlead
- **Pinned revision:** https://github.com/OliverKlug/fairlead/commit/066fe7efe9508a565656cdb2d72cfcb4863c7dcc
- **Residual-risk record:** https://github.com/OliverKlug/fairlead/blob/066fe7efe9508a565656cdb2d72cfcb4863c7dcc/docs/residual-risk.md
- **Policy contract:** https://github.com/OliverKlug/fairlead/blob/066fe7efe9508a565656cdb2d72cfcb4863c7dcc/pack/policies/README.md
- **Attack-suite guide:** https://github.com/OliverKlug/fairlead/blob/066fe7efe9508a565656cdb2d72cfcb4863c7dcc/tests/attack_suite/README.md
