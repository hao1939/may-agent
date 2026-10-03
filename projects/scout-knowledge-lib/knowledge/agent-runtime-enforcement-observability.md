<ai_context>
summary: "Runtime-enforcement companion covering effective-isolation reporting, observation-layer contracts for rule telemetry, domain-native mutation boundaries, observable-interface coverage for knowledge guardrails, and phase-specific safety controls."
triggers: ["effective isolation", "Bunker", "rule telemetry", "Agent Harness", "observation-layer contract", "domain-native mutation", "Godot", "Mati", "knowledge guardrail", "SafeHarness", "phase-specific safety control"]
last_updated: "2026-10-03"
source_basis: "Extracted intact from agent-runtime-hardening.md during its 2026-10-03 oversized-note review. Sources and limitations remain within each section: deployBunker/bunker revision fbde4dbcb42e4e8b1e897d2955bd72ddaf34cff6; JakeSelby/agent-harness revision 8525080756cfa61a83e7b147f271539f85aad6b9; Reddit post t3_1wlw3ab; HN 49767823 and ioni-dev/mati revision 508ca3b3e2e80d986865057601a250c6ae12505c; and arXiv 2609.20822v1."
</ai_context>

# Agent Runtime Enforcement Observability

**Companion note** to [Agent Runtime Hardening](./agent-runtime-hardening.md).

Runtime controls are only as strong as the execution surfaces they cover and
the evidence used to report them. These five source-grounded patterns separate
configured intent from observed enforcement, authored requests from delivered
effects, domain storage from domain-native mutation, detection from bypass
coverage, and safety prose from phase-specific execution gates.

---

## Report Effective Isolation, Not Installed Intent — Bunker (GitHub, September 2026)

[Bunker](https://github.com/deployBunker/bunker/tree/fbde4dbcb42e4e8b1e897d2955bd72ddaf34cff6)
is an early multi-agent hosting platform that gives each agent a Linux user and a
rootless Docker daemon. Its useful hardening signal is not the generic claim of
per-agent isolation, but the way its current implementation treats `/tmp` as a
boundary that spans two execution paths. Rootless-dockerd and detached-run systemd
units receive `PrivateTmp=yes`; SSH-backed exec, copy, mount, and Docker transports
instead pass through an agent-scoped `pam_namespace` block. A per-agent directory
plus `TMPDIR` is explicitly rejected as isolation when sessions still share a mount
namespace.

The SSH path adds a stronger rule: the session is admitted only after a root-owned
`pam_exec` helper verifies the exact namespace rule, agent-group membership,
instance-parent ownership and mode, required PAM modules, and its own directory,
manifest, and byte integrity. The classifier keys on the reserved `bunker-*`
username pattern rather than group state, so deleting the group cannot make an
agent look like an ordinary operator and fall through to host-shared `/tmp`.
Deleting only the namespace drop-in leaves the managed PAM block in place and
denies agent sessions; restoring shared behavior requires removing the complete
managed block. Spawn similarly treats failure to grant the isolation membership as
a fatal stage and rolls back rather than creating a reachable but degraded agent.

The project also separates **configured intent from observable enforcement**.
Its status mapper returns `private` only when every required boundary property is
observed. A missing module or broken PAM block becomes `host-shared`; a probe error
or an unprivileged daemon that cannot verify ownership becomes `unknown`. The
README warns that an older daemon can report `not reported` even when a newer CLI
and documentation describe isolation, and the source advertises a build capability
token so host provisioning can detect version skew. This is a reusable operational
pattern: an isolation claim should identify each execution surface, probe the live
enforcement prerequisites, preserve unknown as a first-class state, and bind the
reported capability to the daemon revision actually serving requests.

Two boundaries remain important. First, this design isolates temporary paths; it
does not by itself prove complete filesystem, kernel, network, or credential
containment. Second, Scout statically inspected project-authored source,
specification, and tests but did not provision a Linux host, run the test suite, or
attempt a cross-agent read. The tests show that the intended verdict goes false
when any modeled prerequisite is removed and that unit argument builders include
`PrivateTmp=yes`; they are not a live enforcement receipt or an independent security
audit. The repository had two stars at discovery, so treat it as an inspectable
implementation pattern rather than production validation.

- **Repo:** https://github.com/deployBunker/bunker
- **Inspected revision:** [`fbde4dbcb42e4e8b1e897d2955bd72ddaf34cff6`](https://github.com/deployBunker/bunker/commit/fbde4dbcb42e4e8b1e897d2955bd72ddaf34cff6)
- **Primary sources:** [boundary specification](https://github.com/deployBunker/bunker/blob/fbde4dbcb42e4e8b1e897d2955bd72ddaf34cff6/specs/agent-tmp-isolation.md), [unit and spawn isolation wiring](https://github.com/deployBunker/bunker/blob/fbde4dbcb42e4e8b1e897d2955bd72ddaf34cff6/internal/agent/isolation.go), [PAM provisioning and status logic](https://github.com/deployBunker/bunker/blob/fbde4dbcb42e4e8b1e897d2955bd72ddaf34cff6/internal/hostsetup/tmpnamespace.go), [boundary-state tests](https://github.com/deployBunker/bunker/blob/fbde4dbcb42e4e8b1e897d2955bd72ddaf34cff6/internal/hostsetup/tmpnamespace_test.go), and [server status mapping tests](https://github.com/deployBunker/bunker/blob/fbde4dbcb42e4e8b1e897d2955bd72ddaf34cff6/internal/server/tmp_isolation_test.go)
- **Discovery query:** GitHub Repository Search API `"AI agent" verification policy enforcement in:name,description,readme pushed:>2026-09-20`, sorted by updated; `total_count: 7444`, `incomplete_results: false`

## Rule Telemetry Needs an Observation-Layer Contract — Agent Harness (GitHub, September 2026)

[Agent Harness](https://github.com/JakeSelby/agent-harness/tree/8525080756cfa61a83e7b147f271539f85aad6b9)
is an early coding-agent configuration compiler with a useful measurement design:
each rule must name a deterministic transcript detector or explicitly state why
transcript evidence cannot decide it. At the pinned revision, `check_detectors`
mechanically rejects rule files with neither; the detector registry contains 17
entries; and synthetic tests give every detector at least one positive and one
negative case.

The repository's own incident record shows why that is only the first layer of
measurement validity:

- A delegation stance was loaded but produced **zero subagent calls across 19
  author-run headless benchmark executions**. The tasks still completed, so
  ordinary task success did not reveal that the standing instruction had no
  observed activation.
- A pre-tool hook appended a cap to subagent briefs, yet the associated rate was
  effectively unchanged before, during, and after the hook. Source and a pinned
  regression test show why: the detector read the model-authored tool input,
  while the hook's rewritten, delivered input was recorded in a separate event
  that the scanner ignored. The implementation therefore renamed the metric
  from `brief-without-cap` to `model-wrote-no-cap` and folds old ledger IDs into
  the new series at read time instead of pretending it measures delivery.
- Only the six generic detectors have labels in the vendored scoring corpus. The
  11 repository-specific detectors have synthetic hit/no-hit tests but no
  published precision floor. The documentation also correctly treats
  per-stance rates as observational because users selected the stance and no
  fixed task set was randomized across variants.

**Reusable hardening pattern:** a rule measurement should declare its
**observation-layer contract**. Keep four questions separate:

1. Is the rule loaded, and can the runtime observe a candidate event?
2. Does the detector classify that event accurately on a representative labeled
   corpus, not just on hand-written positive and negative fixtures?
3. Does it observe authored intent, the policy-rewritten request, the executed
   effect, or the verified postcondition?
4. Is the report descriptive, or does an intervention/control design support a
   causal claim?

A detector-per-rule lint prevents silent darkness, but it does not by itself
prove detector validity, enforcement, delivered behavior, or effect. Telemetry
is most useful when these boundaries are explicit enough that a metric which
fails to move triggers an audit of the observation layer rather than a false
claim that the policy failed—or worked.

**Evidence boundary:** Scout inspected source and documentation at commit
[`8525080`](https://github.com/JakeSelby/agent-harness/commit/8525080756cfa61a83e7b147f271539f85aad6b9)
and ran three targeted unittest modules from the downloaded archive. Fifty-four
tests passed; one Git-history-dependent documentation test errored because the
source archive had no `.git` metadata. Scout did not run the full suite, replay
paid model calls, inspect the author's local ledger, or independently reproduce
the reported 19 runs and before/during/after rates. The repository had 15 stars
when observed, so treat this as an unusually candid implementation signal, not
production validation.

## Prefer Domain-Native Mutations to Raw Structured-File Edits — Reddit (September 2026)

A project-author [Reddit post](https://www.reddit.com/r/aigamedev/comments/1wlw3ab/im_a_beginner_who_got_tired_of_aimless_vibecoding/)
reports recurring failures while using coding agents on a Godot game: broad
context reads for small changes, broken UID references after direct `.tscn`
edits, and open-ended work without visible progress. The author's response is a
playbook that narrows the task and interface together: an architect writes a
scene-tree and signal-flow blueprint; an executor writes typed GDScript and
uses a local Godot MCP server for resource operations; documentation is loaded
by subsystem; and the architect later compares the landed code with the
blueprint.

The reusable pattern is **representation-aware mutation**. When a domain engine
owns identities, references, validation, and serialization, an agent should
propose operations through that engine's structured interface rather than edit
its storage format as ordinary text. Task-scoped context and a blueprint can
reduce irrelevant reads and make omissions reviewable, but they solve different
problems from the mutation boundary. A role split also does not make the final
audit independent: the same architect that authored the blueprint may preserve
its own mistaken assumptions.

A hardened implementation should therefore test the pieces separately:

1. prove that every structured-resource mutation actually crosses the
   domain-native adapter, with no reachable raw-write fallback;
2. bind the resulting artifact and engine diagnostics to the selected task and
   blueprint revision;
3. check both blueprint conformance and domain behavior, preferably with a
   reviewer or oracle that did not author the plan; and
4. treat MCP as transport, not as evidence of authorization, transactional
   safety, or postcondition verification.

**Evidence boundary:** Scout read the complete body of stable post
`t3_1wlw3ab` from Reddit's public Atom feed. The post is a pseudonymous,
self-described beginner's account of a newly open-sourced framework. Scout did
not inspect the linked repository, run Godot, reproduce the reported scene
corruption, or verify that raw resource writes are technically impossible.
The post therefore supports a practitioner design signal, not reliability,
security, or adoption claims.

## Knowledge Guardrails Are Only as Complete as Their Observed Interface — Mati (HN/GitHub, September 2026)

A [Show HN post](https://news.ycombinator.com/item?id=49767823) surfaced
[Mati](https://github.com/ioni-dev/mati/tree/508ca3b3e2e80d986865057601a250c6ae12505c),
a local enforcement layer that attaches developer-confirmed “gotchas” to files.
Its documented mechanism blocks covered Claude Code reads/edits and Codex
`apply_patch` edits until the agent consults the relevant record; decisions are
written to a local hash-chained log. Candidate records do not enforce until a
developer confirms them, which usefully separates knowledge generation from
policy admission.

The more important signal is the project's explicit measurement of its own
coverage boundary. In ten author-run trials where the agent was told not to put
the governed filename in commands, **8/10** rewrote the file without consulting,
**10/10** obtained its contents, and **0/10** triggered the gate. Seven used a
content search such as `grep -rl` to discover the path indirectly. In a separate
ordinary-task arm, **10/10** also found the file by content search, but every run
then named or consulted the file, so **0/10** reached it without consultation.
A command-string or tool hook can enforce what its interface exposes; it cannot
classify an identity that never appears there.

Mati documents two stronger but narrower controls:

- **Session lockdown** turns a detected denial into debt: subsequent reads and
  shell commands are blocked until the named knowledge record is consulted.
  The README reports **0/20** unconsulted accesses with lockdown versus **4/10**
  in a historical unlocked control, but none of those 20 tried the name-free
  route, so this does not close the discovery gap.
- **File sealing** removes file permissions until consultation. In an
  interleaved 10-versus-10 author test, **0/10** sealed runs finished without
  consulting versus **6/10** unsealed; the warned-about bug landed in **0/10**
  versus **4/10**. This moves enforcement below the agent hook, but Git object
  reads, file replacement through directory permissions, and build-tool failure
  remain documented gaps. The README also says Linux and WSL2 were untested.

**Operational implication:** evaluate a guardrail as
`policy × observable interface × bypass surface`, not from its deny rule alone.
For path-scoped knowledge, test direct file tools, shell aliases and variables,
content discovery, Git-history access, replacement without reads, subagents,
and alternate worktrees. A post-denial debt mechanism improves persistence only
after detection; sealing changes the substrate but can disrupt legitimate tools.
Publish those coverage and usability costs separately.

**Evidence boundary:** these are project-author measurements and mechanism
claims from the README at revision
[`508ca3b`](https://github.com/ioni-dev/mati/commit/508ca3b3e2e80d986865057601a250c6ae12505c),
not Scout reproductions. The HN item had two points and no discussion when
checked, and the repository had no stars or forks; treat Mati as an unusually
well-scoped early implementation signal, not production validation.

## Safety Prose Needs Phase-Specific Control Representations — SafeHarness (arXiv, September 2026)

**Coding Agents with an Obstacle-Aware Harness for Safe Robot Manipulation**
([2609.20822v1](https://arxiv.org/abs/2609.20822v1)) evaluates a coding agent
that writes robot controllers for manipulation tasks with an obstacle it must
not touch. The abstract reports that the unhardened agent collided in most
cases despite mentioning the obstacle in its reasoning trace and receiving an
explicit no-contact instruction. The authors locate the failure in planning:
the stated constraint did not become an operational priority.

Their decomposition separates two distinct safety surfaces:

1. **Route phase:** represent objects as bounding boxes, generate waypoint
   routes, verify the route before execution, and replan when it is infeasible.
2. **Contact phase:** choose the contact position under the same obstacle
   constraint rather than treating the final interaction as exempt.

The resulting SafeHarness reportedly reaches **71.9% task success** and
**87.5% collision avoidance**, 6.5 and 27.0 percentage points above the cited
previous state of the art. The abstract also describes those results as 2.3×
and 1.5× the same agent without the harnesses.

**Runtime lesson:** awareness in a trace and a prohibition in a prompt are not
execution controls. A safety constraint should be compiled into the
representations, candidate-generation step, pre-execution verifier, replanning
condition, and terminal interaction for every phase that can violate it. Task
success and constraint satisfaction must remain separate metrics; otherwise a
controller can look capable while repeatedly taking unsafe paths.

**Evidence boundary:** Scout reviewed the live arXiv API abstract only, not the
full paper, environments, controller code, collision definitions, comparison
protocol, or statistics. The reported rates and causal diagnosis are therefore
author claims for this robot-manipulation setup, not evidence that the harness
generalizes to other physical agents or that it provides an independently
enforced safety boundary.
