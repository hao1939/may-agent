# APPA: Agentic Permissions Policy Algebra for Taint Confinement

Date: 2026-07-28
Last updated: 2026-09-14
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

## Tags

agent-security, information-flow-control, prompt-injection-defense, permissions, formal-methods
