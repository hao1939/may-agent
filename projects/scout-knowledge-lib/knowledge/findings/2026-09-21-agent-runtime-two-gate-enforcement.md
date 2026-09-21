---
summary: "A pinned ACS guardrail demo makes tool authorization and result disclosure separate runtime decisions, joined by a session-, request-, and tool-bound single-use correlation record."
triggers: ["agent runtime guardrails", "tool authorization", "result gate", "execution correlation", "replay protection", "ACS"]
last_updated: "2026-09-21"
source_basis: "Pinned GitHub implementation and tests from mikko-lab/acs-guardrail-demo at commit 44603468db54bd422cc3bd218d115eed9e431040; the local verification command passed 266 tests in 17 suites and TypeScript typechecking."
---

# Agent tool controls need separate execution and disclosure gates

<ai_context>
Use this note when designing an agent runtime that must control both whether a tool runs and whether its output reaches the agent. The reusable pattern is a two-gate protocol joined by a single-use, typed correlation record. The reviewed repository is a recent demo, not production infrastructure or proof of universal mediation.
</ai_context>

**Observed:** 2026-09-21  
**Disposition:** New source-grounded finding  
**Coverage:** GitHub repository search; pinned repository metadata and tree; README, invariant map, core TypeScript implementation, and selected adversarial/evaluation tests. The pinned checkout's `npm run verify` completed locally with TypeScript typechecking and 266 passing tests across 17 Jest suites.

## Sources

- **Repo:** [mikko-lab/acs-guardrail-demo](https://github.com/mikko-lab/acs-guardrail-demo)
- **Pinned revision:** [`44603468db54bd422cc3bd218d115eed9e431040`](https://github.com/mikko-lab/acs-guardrail-demo/commit/44603468db54bd422cc3bd218d115eed9e431040)
- **Control flow:** [README at the pinned revision](https://github.com/mikko-lab/acs-guardrail-demo/blob/44603468db54bd422cc3bd218d115eed9e431040/README.md)
- **Execution permit boundary:** [`src/execution-gate.ts`](https://github.com/mikko-lab/acs-guardrail-demo/blob/44603468db54bd422cc3bd218d115eed9e431040/src/execution-gate.ts)
- **Correlation store:** [`src/execution-correlation.ts`](https://github.com/mikko-lab/acs-guardrail-demo/blob/44603468db54bd422cc3bd218d115eed9e431040/src/execution-correlation.ts)
- **End-to-end sequencing:** [`src/guarded-executor.ts`](https://github.com/mikko-lab/acs-guardrail-demo/blob/44603468db54bd422cc3bd218d115eed9e431040/src/guarded-executor.ts)
- **Result policy:** [`src/guardian.ts`](https://github.com/mikko-lab/acs-guardrail-demo/blob/44603468db54bd422cc3bd218d115eed9e431040/src/guardian.ts)
- **Evaluation map:** [`docs/invariants-evidence.md`](https://github.com/mikko-lab/acs-guardrail-demo/blob/44603468db54bd422cc3bd218d115eed9e431040/docs/invariants-evidence.md)

## What the implementation demonstrates

The demo distinguishes two authorities that are often collapsed into one:

1. **Execution authority.** A request Guardian returns `ALLOW`, `DENY`, or `ASK`. An allowed or human-approved request receives an in-process permit bound to `sessionId`, `requestId`, and `toolName`. `ExecutionGate` checks all three fields and consumes the permit immediately before invoking the tool.
2. **Disclosure authority.** After execution, the runtime creates a result request. Before evaluating its output policy, it requires a correlation record with the same session, original request reference, and tool name. Successful validation consumes that record. The result Guardian may then allow delivery or return a blocked representation while logging `tool_result_withheld`.

The correlation store therefore does more than attach observability metadata. Its one-time consumption rejects an unknown or previously consumed request reference, a cross-session reference, and a tool-name mismatch. The pinned evaluation tests exercise each case. Separate tests show that a request-level `ALLOW` can coexist with a result-level `DENY`, and that withholding emits no `tool_result_delivered` event.

The local verification result supports a narrow claim: the checked-in implementation satisfies its checked-in typecheck and test suite at the pinned revision. It does not establish production safety or complete protocol conformance.

## Interpretation

**Permission to cause an effect is not permission to reveal the effect's output.** Tool execution and result disclosure should be separate state transitions, with an unforgeable or runtime-owned handoff connecting them. Without that handoff, a result filter can be fed output from a different tool, session, or invocation; without single-use consumption, an old authorization can be replayed as if it belonged to a fresh result.

A production contract should make at least these bindings explicit:

- actor/session identity;
- original request identity;
- exact tool or operation identity;
- one-time lifecycle state (`issued → consumed`);
- independent request and result decisions;
- delivery evidence distinct from execution evidence.

This sharpens the lifecycle-control model described in [SafeHarness](./2026-09-17-safeharness-lifecycle-security.md): cross-stage risk signals are useful, but the handoff between stages also needs a typed, consumable identity boundary.

## Limitations

- The repository was created recently and describes itself as a reference/demo implementation. It has no durable or distributed state, persistent audit backend, external IAM integration, or proof that every execution route passes through the gate.
- The in-memory permit is protected by a private symbol and `WeakSet`, not a cross-process capability. Correlation and replay state disappear on restart, and the README explicitly disclaims distributed guarantees.
- The result policy is intentionally simple: it withholds outputs only when an object has `classification: "restricted"`. Passing the tests does not validate the adequacy of that policy against realistic exfiltration or encoding attacks.
- Approval grants bind session and request IDs but not tool identity cryptographically. The runtime resumes its stored pending action to prevent tool swapping, but the repository explicitly marks grant-level tool binding as unimplemented.
- The package metadata reports version `0.1.0` while the README calls the current status release candidate `v0.2.0`; this note relies on the pinned commit rather than either mutable version label.
- This review did not establish ACS certification or full conformance, and the repository makes neither claim.
