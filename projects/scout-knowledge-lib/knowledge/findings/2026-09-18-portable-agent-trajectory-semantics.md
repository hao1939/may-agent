<ai_context>
summary: "agent-crashtest shows that cross-framework agent assertions require an explicit semantic contract, not only a shared event schema. Its adapters make ordered-step and tool-name checks portable, but they preserve different evidence across LangGraph, Microsoft Agent Framework, and Google ADK; proposal, execution, approval, result, and node activity therefore cannot be treated as interchangeable outcomes."
triggers: ["agent-crashtest", "agent evaluation", "execution trajectory", "cross-framework adapter", "prompt injection testing", "tool-call semantics", "LangGraph", "Microsoft Agent Framework", "Google ADK"]
last_updated: "2026-09-18"
source_basis: "GitHub repository HariSankar27/agent-crashtest at pinned revision a3c72e352accf5dcb64d8c462d8f810c2f4926cc; inspected repository metadata, complete recursive tree, README, architecture and decision docs, trajectory/assertion/injection/judge implementations, all three adapters, and relevant repository-authored tests. Static inspection only; Scout did not execute the package, run its tests, or validate it against live models or deployed agents."
</ai_context>

# Portable agent trajectories need portable semantics

**Date:** 2026-09-18  
**Source:** GitHub repository inspection  
**Repo:** https://github.com/HariSankar27/agent-crashtest  
**Pinned revision:** [`a3c72e352accf5dcb64d8c462d8f810c2f4926cc`](https://github.com/HariSankar27/agent-crashtest/commit/a3c72e352accf5dcb64d8c462d8f810c2f4926cc)

## Observation

`agent-crashtest` is a new pytest plugin that translates traces from LangGraph, Microsoft Agent Framework, and Google ADK into a Pydantic `Trajectory`. Its shared assertions check ordered event names, required or forbidden tool names, repeated calls, and whether a prompt-injection fixture triggered a forbidden tool. The practical signal is useful: teams using several agent runtimes can write behavioral checks against one vocabulary instead of binding each evaluation to framework-specific response objects.

The pinned implementation also makes the limits of schema-level portability visible. The normalized event has only four kinds—`node`, `tool_call`, `tool_result`, and `message`—plus a name and free-form data. Each adapter fills that schema differently:

- **LangGraph:** `from_langgraph_stream` emits one `node` event for every `{node_name: output}` entry. It does not derive `tool_call` events from a node's output, even when that output dictionary is retained as event data. Consequently, `Trajectory.tool_calls()` is empty for this adapter unless another transformation adds such events; a forbidden-tool assertion alone cannot establish that a tool was not used inside a node.
- **Microsoft Agent Framework:** function calls and pending approval requests both become `tool_call` events. This intentionally catches a model that *proposed* an injected action before a human gate rejects it. The decision record explicitly notes that the normalized trace cannot distinguish proposed-and-approved from proposed-and-rejected; function results retain a call ID as the event name but discard the result value.
- **Google ADK:** `get_function_calls()` becomes named `tool_call` events with arguments. The adapter does not preserve messages, tool results, agent identity, or approval state.

The repository's cross-repository prompt-injection scenario tests an actual sibling agent orchestration function and real Agent Framework `Content` objects, but the hijacked and resistant models are simulated. The scenario's safety verdict is a name-level invariant: failure occurs if `stop_process` appears among normalized calls. This is valuable as a regression test for a specified dangerous capability, while remaining narrower than proving that no harmful action, aliased tool, unsafe argument, or indirect side effect occurred.

## Why this matters

A common trajectory type removes API friction, but it does not make source traces semantically equivalent. Portable evaluation needs to state both the invariant and the adapter's evidence coverage.

A stronger cross-runtime contract would keep separate fields or event kinds for at least **proposed**, **approved**, **executed**, **succeeded/failed**, and **result observed**, with stable call IDs linking phases. It would also publish a per-adapter capability matrix: whether calls inside graph nodes are decoded, arguments and results are retained, approvals are represented, parallel ordering is stable, and messages or agent identities survive normalization. Assertions could then fail as **unsupported/unknown** when the selected adapter cannot observe the requested property, rather than passing from an empty event class.

The same distinction applies to injection evaluations. “The model proposed no forbidden named tool” measures a reasoning-layer signal. “The mediator executed no forbidden effect” is an enforcement-layer claim and requires effect-owning evidence. Both are useful, but merging them into one `tool_call` label makes comparisons across frameworks misleading.

## Limits

The repository was created on 2026-09-18, has no stars in the inspected metadata, and is at version `0.1.0`. Repository-authored tests indicate intended behavior, not independent validation. Scout did not install dependencies or run the claimed 19 tests. The README says the cross-repository scenario is skipped in CI when its Windows-only sibling dependency is unavailable, and that the LLM judge has not been tested against a real model.

The built-in injection corpus contains four hand-written payload shapes and the project itself labels it a smoke test rather than a security guarantee. The judge interpolates rubric and output into a prompt and returns a model-produced structured verdict; the available unit test uses a fake model, so this revision provides no evidence about live judge calibration or resistance to adversarial candidate output. Finally, the adapter gaps above are conclusions from static source inspection, not observations of every possible framework trace shape or configuration.

## Sources

- Repository: https://github.com/HariSankar27/agent-crashtest
- Pinned README and status: https://github.com/HariSankar27/agent-crashtest/blob/a3c72e352accf5dcb64d8c462d8f810c2f4926cc/README.md
- Normalized trajectory model: https://github.com/HariSankar27/agent-crashtest/blob/a3c72e352accf5dcb64d8c462d8f810c2f4926cc/src/agent_crashtest/trajectory.py
- Assertions: https://github.com/HariSankar27/agent-crashtest/blob/a3c72e352accf5dcb64d8c462d8f810c2f4926cc/src/agent_crashtest/assertions.py
- Injection checks and corpus: https://github.com/HariSankar27/agent-crashtest/blob/a3c72e352accf5dcb64d8c462d8f810c2f4926cc/src/agent_crashtest/injection.py
- LangGraph adapter: https://github.com/HariSankar27/agent-crashtest/blob/a3c72e352accf5dcb64d8c462d8f810c2f4926cc/src/agent_crashtest/adapters/langgraph.py
- Microsoft Agent Framework adapter: https://github.com/HariSankar27/agent-crashtest/blob/a3c72e352accf5dcb64d8c462d8f810c2f4926cc/src/agent_crashtest/adapters/agent_framework.py
- Google ADK adapter: https://github.com/HariSankar27/agent-crashtest/blob/a3c72e352accf5dcb64d8c462d8f810c2f4926cc/src/agent_crashtest/adapters/adk.py
- Approval-semantics decision: https://github.com/HariSankar27/agent-crashtest/blob/a3c72e352accf5dcb64d8c462d8f810c2f4926cc/docs/decisions/0002-pending-approval-counts-as-a-tool-call.md
- Cross-repository injection scenario: https://github.com/HariSankar27/agent-crashtest/blob/a3c72e352accf5dcb64d8c462d8f810c2f4926cc/tests/scenarios/test_winops_injection.py
- Judge implementation and fake-model test: https://github.com/HariSankar27/agent-crashtest/blob/a3c72e352accf5dcb64d8c462d8f810c2f4926cc/src/agent_crashtest/judge.py
- Complete pinned tree: https://api.github.com/repos/HariSankar27/agent-crashtest/git/trees/a3c72e352accf5dcb64d8c462d8f810c2f4926cc?recursive=1
