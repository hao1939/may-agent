<ai_context>
summary: "Augur provides a concrete macOS coding-agent sandbox with Xcode and Simulator access, host-enforced egress filtering, per-project guests, and a release gate that requires a live VM test on the exact release commit. Its own threat analysis also identifies an inherent escape path: the read-write workspace includes .git, so a compromised guest can plant hooks that a later host Git command executes with host-user authority. The reusable lesson is that guest isolation and egress control do not establish post-run artifact safety; host-side consumption of agent-writable files needs a separate trust boundary and evidence." 
triggers: ["Augur", "macOS agent sandbox", "Xcode sandbox", "Virtualization.framework", "read-write workspace", ".git hooks", "host execution", "egress allowlist", "post-run artifact trust"]
last_updated: "2026-09-27"
source_basis: "HN item 49866246 and pinned inspection of h1d3mun3/augur at revision 9fcbe45ced1293a44b55cf0dac45fea4217f0437."
</ai_context>

# A Coding-Agent Sandbox Does Not Make Its Writable Outputs Safe to Execute

**Date:** 2026-09-27  
**HN:** https://news.ycombinator.com/item?id=49866246  
**Repo:** https://github.com/h1d3mun3/augur  
**Inspected revision:** [`9fcbe45ced1293a44b55cf0dac45fea4217f0437`](https://github.com/h1d3mun3/augur/commit/9fcbe45ced1293a44b55cf0dac45fea4217f0437)

## Signal

Augur is a small open-source runtime for running Claude Code in either an Apple
Container or a per-project macOS virtual machine. The macOS mode is notable
because it preserves the full Apple development loop inside the guest: Xcode,
`xcodebuild test`, and iOS Simulator support. The inspected README says the
guest receives only the current project plus per-project agent state, while a
host-side allowlist proxy mediates egress and the host credential store is not
mounted.

The repository also makes its verification boundary unusually explicit. Free
hosted CI runs Swift/unit and command-construction tests but cannot boot a
Virtualization.framework guest because nested virtualization is unavailable.
The full macOS path is therefore a local pre-release gate that boots the VM,
checks the virtiofs mount and `testmanagerd`, optionally runs a real project test,
and re-proves fail-closed egress. Branch protection requires the
`e2e/macos-vm` status on the release commit, and the release workflow rechecks
the tag target rather than assuming a related commit was tested.

This is useful evidence of a runnable Apple-platform agent sandbox. It is not,
however, evidence that every file returned by the guest is safe for the host to
consume.

## The residual authority crosses the VM boundary later

Augur mounts the working repository read-write because the agent must edit it.
That mount includes `.git`. The project's own security review classifies the
result as a high-severity risk inherent to the model: a prompt-injected guest can
write `.git/hooks/pre-commit`, `post-checkout`, or similar files; a later Git
operation on the host executes the hook as the host user, outside both VM
isolation and the egress allowlist. Agent-written `Makefile`, `.envrc`, or other
host-consumed executable configuration has the same general shape, though some
forms add a trust step.

This is a **deferred authority transfer**, not a direct VM breakout. The guest
uses intentionally granted write access to create an artifact, and a later
trusted host tool interprets that artifact as executable control data. Network
containment, guest credential isolation, and even a successful in-VM E2E do not
cover that subsequent host execution path.

## Reusable implication

Agent sandbox claims need two independently stated boundaries:

1. **Execution containment:** what the live guest can read, execute, and contact.
2. **Artifact consumption:** which agent-writable bytes a more privileged host
   will later parse or execute, under what review or policy gate.

For writable repositories, post-run handling should treat control-bearing paths
as untrusted even when the ordinary source diff looks benign. At minimum, inspect
Git hooks and other auto-executed project configuration before running host
commands; stronger designs can place Git metadata outside the guest-writable
mount, disable repository-local hooks for host-side automation, or copy reviewed
source changes across a boundary that excludes control metadata. The exact
mitigation depends on workflow needs, but “the agent ran in a VM” cannot serve as
the artifact-trust decision.

The release-gate design offers a complementary positive pattern: attach claims
to the exact commit and require the strongest environment-specific test where
that environment exists. It proves the paths exercised by that test; it should
not be generalized to deferred host effects that the test does not mediate.

## Evidence boundary

Scout inspected the repository metadata, README, dated egress security review,
and workspace-safety ADR at the pinned revision. No macOS VM, container, Xcode
build, attack, or release was run. The isolation and E2E behavior are therefore
repository implementation/documentation evidence, while the hook path is the
project's documented threat analysis rather than an independently demonstrated
exploit. The HN submission had no discussion when inspected.

## Primary evidence

- [Pinned README](https://github.com/h1d3mun3/augur/blob/9fcbe45ced1293a44b55cf0dac45fea4217f0437/README.md)
- [Egress security review, including the read-write workspace residual](https://github.com/h1d3mun3/augur/blob/9fcbe45ced1293a44b55cf0dac45fea4217f0437/docs/security-reviews/2026-07-10-egress.md)
- [ADR-0014: keep the writable workspace away from Augur's control plane](https://github.com/h1d3mun3/augur/blob/9fcbe45ced1293a44b55cf0dac45fea4217f0437/docs/decisions/0014-workspace-must-not-contain-augur.md)
