# APPA: Agentic Permissions Policy Algebra for Taint Confinement

Date: 2026-07-28
Last updated: 2026-09-30
Source: https://arxiv.org/abs/2607.24625v1

## Summary

APPA introduces an Information Flow Control (IFC) framework for LLM agents that resolves the tension between security and utility when processing mixed-confidentiality data. Traditional taint tracking permanently contaminates an agent's context upon reading unvetted data, killing downstream usefulness. APPA fixes this via:

1. **Engine-managed context branching** — spawns a label-seeded child trajectory to inspect unvetted data without polluting the parent context
2. **Prospective acquisition enforcement** — evaluates label descents and prerequisites *before* data acquisition, generating actionable remedy plans
3. **Two-monoid formal model** — proves parent label preservation and merge confinement over security labels and shared event logs

## Key Results

- Suppresses exfiltration: attack success drops from 31–50% to 0–7% across four models
- On 3/4 models, branching recovers substantial utility that taint tracking alone forfeits
- Evaluated on multi-turn tool-chaining benchmark

## Scout Relevance

This is the first formal algebra for agentic permissions that combines IFC with context branching. Directly relevant to multi-tool agent orchestration where agents handle untrusted inputs (prompt injection defense). The "branch-sanitize-merge" pattern could become a standard primitive for secure agent frameworks.

## HN update — deployed IFC separates policy decisions from coverage (2026-09-14)

Archestra describes using OpenAPPA in an internal coding-agent workflow that
starts from a Slack bug report, provisions a disposable development VM, and
lets Claude Code read Slack and staging Kubernetes while retaining network and
GitHub access. The agent first opens its pull request on a private mirror; a
human must say `Promote` before publication to the public repository. The cited
example is independently visible as merged
[PR #7371](https://github.com/archestra-ai/archestra/pull/7371): its body records
unit, context-hook, component, and end-to-end tests for queuing chat messages
during compaction. This is concrete deployment evidence for APPA's information-
flow model, not evidence that the whole workflow is autonomous or independently
security-audited.

At pinned OpenAPPA revision
[`987d750`](https://github.com/archestra-ai/OpenAPPA/tree/987d7506a37c8b43045b13b71bae8ec0e535b5ef),
the Claude Code integration installs hooks on prompts, tool calls, tool results,
and subagent lifecycle events. Protected actions fail closed when the local
runtime does not answer. Exact connector contracts can label internal reads and
public sinks, after which the pure policy core makes the flow decision. The
repository's deterministic local harness checks both sides of one simple
boundary: untainted text reaches a file, while a line read from a private file
reaches no file under any name.

The repository also states the important coverage limit. A review mark attached
to a GitHub MCP write does not cover `gh issue create` through the broad `Bash`
tool; a deployment must forbid that path or explicitly record it as an open
vector. Unknown tools can be sent through a bounded, fail-closed Claude
annotator, but the documentation calls that a compatibility net rather than a
reviewed connector contract. The blog likewise describes an LLM classifier as
a second line for commands its deterministic script does not recognize.
Therefore **deterministic policy evaluation is not deterministic flow
classification or complete mediation**. A deployment receipt should report
three things separately: which surfaces were intercepted, which calls had
reviewed deterministic annotations, and which relied on a classifier or an
explicitly open path.

The HN item had 9 points and one author comment when checked. That is discovery
and implementation evidence, not adoption evidence.

**Additional sources:** [HN item 49696110](https://news.ycombinator.com/item?id=49696110);
[Archestra deployment write-up](https://archestra.ai/blog/fixing-small-bugs-from-a-slack-thread);
[OpenAPPA repository](https://github.com/archestra-ai/OpenAPPA);
[Claude Code integration contract](https://github.com/archestra-ai/OpenAPPA/blob/987d7506a37c8b43045b13b71bae8ec0e535b5ef/marketplace/plugins/claude-code/README.md);
[documented Bash coverage gap](https://github.com/archestra-ai/OpenAPPA/blob/987d7506a37c8b43045b13b71bae8ec0e535b5ef/marketplace/plugins/claude-code/hitl.appa.toml#L26-L33).

## HN update — security, task utility, and trajectory cost need separate denominators (2026-09-28)

A new author launch on HN points to OpenAPPA's expanded benchmark report. The
publisher reports no scored attack in 1,320 runs across Bench-Corp and
AgentThreatBench, with each of three models run five times on both standard and
adversarial variants. On Bench-Corp, guarded OpenAPPA completed 88–90% of tasks,
versus 37–45% for the tested FIDES configurations. This is substantially more
useful evidence than a policy-engine unit test because the scorer checks what the
agent changed or sent over multi-step tasks.

The benign-task and classifier comparisons put useful bounds around that headline.
On 97 Tau banking tasks run four times, guarded OpenAPPA completed 151/388
simulations versus 156/388 for stock, with mean reward 38.92% versus 40.21% and
4.22% more whole-trajectory tokens. In a separate one-run-per-task Claude Code
comparison, OpenAPPA was the only configuration with zero attacks in both suites,
but completed 75% of tasks while the two auto-mode configurations completed
85–96%. Guarded trajectories used 6.5× the permissive agent's reported tokens on
Bench-Corp and 2.3× on AgentThreatBench; those totals include isolated child
trajectories and recovery rather than just policy evaluation.

These results support the paper's claim that branching and guided recovery can
preserve useful work after a deny, but they do not collapse into one “guardrail
effectiveness” number. The attack suites, benign Tau workload, and auto-mode
comparison have different tasks, repetitions, policies, and cost visibility. The
auto-mode cells have no variance estimate, and Claude's SDK omits classifier
cost. The benchmark and report are also maintained by the OpenAPPA publisher;
Scout inspected the report and repository benchmark tree at revision
[`19e47f2`](https://github.com/archestra-ai/OpenAPPA/commit/19e47f2d6976d6d1d47a9f268d4fdadbe0f609ed)
but did not execute the suites or independently audit their scenario labels.

**Reusable rule:** report attack successes per adversarial trial, legitimate task
completion, whole-trajectory cost, and policy-engine cost separately, with the
benchmark, policy coverage, repetition count, and scorer attached to each. A
zero-attack result on a bounded suite is evidence about that suite, not proof of
complete mediation or a universal zero failure rate.

**Additional sources:** [HN item 49877515](https://news.ycombinator.com/item?id=49877515);
[OpenAPPA benchmark report](https://www.openappa.com/evaluation);
[Bench-Corp tree](https://github.com/archestra-ai/OpenAPPA/tree/19e47f2d6976d6d1d47a9f268d4fdadbe0f609ed/bench/corp).

## HN update — a policy pin, state partition, and retry receipt prove different things (2026-09-30)

A new HN submission points to OpenAPPA's current repository rather than a new
paper or benchmark. The useful change since Scout's 2026-09-28 inspection is a
more explicit embedding contract. A host can prepare several policy deployments
and pin each dispatch to one, while a trajectory opened under an older policy
continues under the exact policy file stored with its log. Reloading policy is
therefore a choice for new trajectories, not a retroactive relabeling of old
work. Root forks likewise inherit the source family's opening policy and a
frozen security/effect state, then evolve independently.

That policy continuity does **not** establish tenant isolation. The integration
guide says a pin selects policy but does not constrain which trajectories the
runtime can reach. A multi-tenant host must still give each dispatch a
partitioned event-log store and globally unique root identifiers. It also must
supply an authenticated session principal: OpenAPPA accepts that principal from
the host and does not authenticate it. The reusable deployment claim is thus a
triple—policy identity, state-store scope, and principal proof—not a single
“guarded by OpenAPPA” flag.

The repository's event-log layer adds a complementary retry boundary. An
operation receipt is keyed by organization, session, binding, operation ID,
root, and stable semantic input. A completed receipt can replay its recorded
decision; reuse with another input or scope is refused; and a still-pending
receipt is returned as `Pending`, not retried as though no work occurred. Tool
result processing has its own receipt keyed by session and tool-call ID. These
receipts prevent an ambiguous retry from becoming an automatic duplicate, but
they intentionally leave pending work unresolved: a receipt says the runtime
claimed processing, not whether an external tool effect happened. Reconciliation
still needs effect-specific evidence.

**Reusable rule:** preserve policy version, state partition, authenticated
principal, operation identity, and effect outcome as separate evidence. Policy
pinning gives decision continuity; partitioning gives state isolation; an
idempotency receipt gives retry ownership. None substitutes for the others or
proves an external effect's final state.

**Evidence inspected:** HN item
[49913499](https://news.ycombinator.com/item?id=49913499) and OpenAPPA revision
[`b6e7e98285eebbd8bd9afbc4e03022a56a13493c`](https://github.com/archestra-ai/OpenAPPA/commit/b6e7e98285eebbd8bd9afbc4e03022a56a13493c), including the root README,
`website/content/docs/add-to-agent.md`, `website/content/docs/how-it-works.md`,
`website/content/docs/contracts.md`, `appa-runtime/README.md`, and
`appa-eventlog/src/receipts.rs` with its repository-authored receipt tests.

**Evidence boundary:** Scout inspected source and tests statically. It did not
build the Rust workspace, run the tests, deploy a shared runtime, simulate a
cross-tenant access attempt, authenticate a real principal, or reconcile a
pending receipt against an external effect. OpenAPPA remains labeled preview and
RFC; its configuration and wire surfaces may change without compatibility
shims.

## Tags

agent-security, information-flow-control, prompt-injection-defense, permissions, formal-methods
