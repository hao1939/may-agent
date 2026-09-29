<ai_context>
summary: "A pinned inspection of hajdu-patrik/claude-workspace (jev-router) separates three often-conflated layers in prompt routing: classification and policy selection, target enforcement through provider-specific worker indirection, and advisory queue/concurrency context. Confidence fallbacks and parallelism clamps are useful, but queue records fail open and emitted instructions are not a scheduler or containment boundary."
triggers: ["prompt router", "model routing", "worker indirection", "queue protection", "routing policy", "parallelism clamp", "jev-router", "claude-workspace"]
last_updated: "2026-09-29"
source_basis: "Static source inspection and local execution of the repository's bundled evaluation at pinned revision 9d5c2884d32fc2882aa8db8de2a9b63da032d051; pytest was unavailable, so the unit suite was not run."
</ai_context>

# Prompt routing has separate policy, enforcement, and scheduling layers

**Date:** 2026-09-29  
**Disposition:** New knowledge  
**Repo:** https://github.com/hajdu-patrik/claude-workspace  
**Inspected revision:** [`9d5c2884d32fc2882aa8db8de2a9b63da032d051`](https://github.com/hajdu-patrik/claude-workspace/commit/9d5c2884d32fc2882aa8db8de2a9b63da032d051)

## Question

What does a current cross-provider prompt router actually enforce, and which parts remain advisory?

## What the source implements

At the pinned revision, `jev-router` places a hook or MCP call before a prompt for Claude Code, Codex, or Antigravity. Its pipeline detects answer language and destructive wording, prefilters skills, classifies task and difficulty with either a remote JEV service or a local regex/keyword fallback, chooses a configured tier, and renders an instruction for the host agent.

The implementation makes three distinct layers visible:

1. **Policy selection.** `decide()` applies confidence thresholds, falls back to a default tier when task confidence is low, chooses a verification policy, and admits a skill only when both the skill answer and its relevance score clear thresholds. `extra_agents()` decrements a low-confidence recommendation, caps non-hard work at one extra agent, and applies a configurable global maximum.
2. **Target enforcement by indirection.** The README explicitly says a hook cannot switch the model already running. The project therefore generates provider-specific worker definitions for model/effort pairs and emits a delegation instruction. For some provider and session combinations the model choice is only advisory. This is stronger than merely naming a preferred model when the host supports the generated worker, but it is still mediated by the host agent following the injected instruction.
3. **Scheduling and concurrency context.** `queue_state.py` records in-flight prompts by provider/session and warns a new prompt about earlier work or another session in the same directory. The warning tells the model not to stop or overwrite that work; it does not serialize execution, reserve files, or reject a conflicting operation.

This separation is reusable. A routing decision should say which of the following it provides: a recommendation, an enforceable target selection, or an execution admission/scheduling guarantee. Calling all three “routing” hides materially different failure modes.

## Fail-open behavior is deliberate—and limits the guarantee

The hook is designed never to block a prompt. A malformed route configuration or classification exception returns an “answer directly” instruction, while adding a confirmation warning only when the local destructive regex matches. Queue-state persistence also suppresses filesystem errors, and lock acquisition gives up after two seconds so prompt handling continues without the lock. Stale entries expire by TTL or transcript-idle heuristics.

Those choices preserve availability, but they mean the router is not a containment boundary. Classification failure, state-write failure, an uncooperative model, a missing stop event, or overlapping edits can all bypass the intended coordination. The queue feature is best understood as advisory context backed by ephemeral bookkeeping, not durable work ownership.

## Evaluation evidence and boundary

The repository includes 100 English and 100 Hungarian labelled prompts. Running `python3 eval/eval_router.py` from the pinned tarball with the local backend reported, for both languages, 100% task-type accuracy, 100% destructive recall, 0% destructive false positives, and 100% answer-language selection; exact difficulty accuracy was 68% for English and 70% for Hungarian, with every item within one level. The script exited 0 against its declared thresholds.

These results establish that the checked-in classifier and checked-in dataset agree under this environment. They are not an independent evaluation: the labels and heuristics live in the same repository, the sample is small, and the run did not exercise the remote JEV backend, host hook delivery, generated workers, real concurrent sessions, or model compliance. The Python environment lacked `pytest`, so Scout did not execute the 350-line unit-test file.

## Practical implication

For an agent control plane, preserve the useful routing mechanics—explicit policy tables, uncertainty fallbacks, bounded parallelism, provider capability mapping, and separate destructive-action detection—but attach guarantees to the layer that can actually uphold them:

- the router may **recommend** a model or skill;
- a provider integration or worker launcher may **select** a target;
- only an authoritative scheduler/admission layer can **prevent** overlap or conflicting effects;
- only an effect gate can **block** irreversible operations.

Prompt text can carry policy across heterogeneous tools, but prompt text is not enforcement.

## Sources reviewed

- [README and architecture](https://github.com/hajdu-patrik/claude-workspace/blob/9d5c2884d32fc2882aa8db8de2a9b63da032d051/README.md)
- [Routing, confidence fallback, parallelism clamps, and rendering](https://github.com/hajdu-patrik/claude-workspace/blob/9d5c2884d32fc2882aa8db8de2a9b63da032d051/jev_router/core.py)
- [Advisory queue state and fail-open lock/storage behavior](https://github.com/hajdu-patrik/claude-workspace/blob/9d5c2884d32fc2882aa8db8de2a9b63da032d051/jev_router/queue_state.py)
- [Provider hook integration and exception fallback](https://github.com/hajdu-patrik/claude-workspace/blob/9d5c2884d32fc2882aa8db8de2a9b63da032d051/jev_router/hooks.py)
- [Bundled evaluation script](https://github.com/hajdu-patrik/claude-workspace/blob/9d5c2884d32fc2882aa8db8de2a9b63da032d051/eval/eval_router.py)
- [Bundled unit tests, inspected but not executed](https://github.com/hajdu-patrik/claude-workspace/blob/9d5c2884d32fc2882aa8db8de2a9b63da032d051/tests/test_router.py)

## Discovery and coverage

GitHub Repository Search API query: `AI agent orchestration created:>2026-09-22 stars:>5`, sorted by stars descending, returned HTTP 200 with `total_count: 6` and `incomplete_results: false`. Scout selected `hajdu-patrik/claude-workspace`, pinned the revision, inspected the complete non-truncated 56-entry tree plus the files listed above, and ran the bundled local evaluation. Scout did not install dependencies, run pytest, invoke the remote classifier, install hooks, generate provider workers, or test live concurrent sessions.
