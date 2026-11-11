<ai_context>
summary: "Pinned opencode-gearbox source treats adaptive effort/model routing as a constrained control decision: preserve explicit operator and agent model choices, isolate each queued prompt's decision, bound judge latency with a fallback, and price cache loss before switching a warm session. The source and tests are producer-authored and were inspected statically; Scout did not run the plugin, tests, benchmark, providers, or OpenCode."
triggers: ["adaptive model routing", "reasoning effort routing", "subagent model selection", "prompt cache economics", "routing fallback", "operator model choice"]
last_updated: "2026-11-11"
source_basis: "miguelmartens/opencode-gearbox at commit e56751c6f80d9163e984fea1433bbc2e56d071a3; complete non-truncated 124-entry Git tree plus selected README, design, implementation, and producer-authored tests."
</ai_context>

# Adaptive agent routing must price cache loss and preserve operator intent

**Date:** 2026-11-11  
**Disposition:** New knowledge  
**Repo:** https://github.com/miguelmartens/opencode-gearbox  
**Reviewed revision:** [`e56751c6f80d9163e984fea1433bbc2e56d071a3`](https://github.com/miguelmartens/opencode-gearbox/commit/e56751c6f80d9163e984fea1433bbc2e56d071a3)  
**Content read:** Complete non-truncated 124-entry recursive tree; README; design; prompt classifier and judge; routing implementation; selected producer-authored routing, classifier, and judge-model tests.

## Source observation

`opencode-gearbox` is a new OpenCode plugin that assigns a reasoning-effort level to each prompt and can route subagents to cheaper models. Its useful signal is not the general claim that cheaper models can save money—that is already covered in [The Token Economics Trap](../the-token-economics-trap.md)—but the constraints its implementation places around a routing decision.

At the pinned revision:

- A named effort level bypasses the judge, while a manually selected model variant pauses automatic routing. An agent definition with an explicit model retains that model; the router may adjust effort but does not replace the operator's selection.
- The prompt hook stores a decision by user-message ID. Producer-authored tests cover a prompt queued during an active turn and assert that it cannot change the running turn's effort; the queued prompt receives its own later decision.
- Judge, model-catalog, session-lineage, and related reads share a bounded deadline. Timeout, provider error, unreadable output, or unknown model state falls back to the last level or `medium`; routing failures leave the request unchanged rather than blocking it.
- A fresh subagent may move to a cheaper model because it has no warm prompt cache. A resumed subagent or main session is switched only when an estimated saving exceeds a configured margin after accounting for cache-read, cache-write/input, and expected-output cost. A resumed subagent is not promoted to a more expensive model by this mechanism.
- The README explicitly says main-chat switching does not work on the tested OpenCode 2.2.6 hook surface, so that path remains feature-detected rather than presented as current behavior.

## Interpretation

Adaptive routing is a **control-plane decision with state**, not just prompt classification. A defensible router should keep at least four receipts separate:

1. **Intent receipt:** Did the user or agent definition explicitly choose a model or effort level?
2. **Turn receipt:** Which exact prompt and session state produced this decision?
3. **Economic receipt:** Did the expected savings include the cost of abandoning a warm cache and the classifier call itself?
4. **Fallback receipt:** What level and model were actually used when judging or state lookup failed?

This also clarifies where routing should differ by lifecycle. A new child session has little cache value to preserve, while an established session can make a nominally cheaper model switch more expensive. “Choose the cheapest capable model” is therefore incomplete without cache ownership, session age, and an explicit minimum-saving threshold.

The repository complements the earlier Sabi observation in [The Token Economics Trap](../the-token-economics-trap.md#a-router-can-behave-as-designed-and-still-cost-more): policy correctness and economic superiority still require separate evidence. `opencode-gearbox` adds a more local implementation lesson—calculate the switching boundary before mutation and preserve explicit human configuration—but does not prove that its policy saves money or maintains task quality in deployment.

## Limitations

- The repository was created on 2026-11-11 and had three GitHub stars when inspected; there is no adoption or production-reliability evidence here.
- All implementation, tests, benchmark descriptions, and compatibility statements are producer-authored.
- Scout inspected source and tests statically but did not install dependencies, run the test suite or benchmark, execute OpenCode, call any model provider, or measure latency, quality, cache behavior, or cost.
- The README reports provider and OpenCode compatibility, but Scout did not independently verify those environments. It also says OpenCode 2.2.6 does not fire the hook needed for main-chat model switching.
- Passing unit tests would establish encoded behavior only; they would not establish that the judge classifies difficulty correctly, that expected-output constants predict real calls, or that routed tasks retain quality.

## Sources inspected

- Repository: https://github.com/miguelmartens/opencode-gearbox
- Pinned tree: https://github.com/miguelmartens/opencode-gearbox/tree/e56751c6f80d9163e984fea1433bbc2e56d071a3
- README: https://github.com/miguelmartens/opencode-gearbox/blob/e56751c6f80d9163e984fea1433bbc2e56d071a3/README.md
- Design: https://github.com/miguelmartens/opencode-gearbox/blob/e56751c6f80d9163e984fea1433bbc2e56d071a3/docs/superpowers/specs/2026-11-10-opencode-gearbox-design.md
- Prompt rules: https://github.com/miguelmartens/opencode-gearbox/blob/e56751c6f80d9163e984fea1433bbc2e56d071a3/src/core/rules.ts
- Judge protocol: https://github.com/miguelmartens/opencode-gearbox/blob/e56751c6f80d9163e984fea1433bbc2e56d071a3/src/core/judge.ts
- Routing implementation: https://github.com/miguelmartens/opencode-gearbox/blob/e56751c6f80d9163e984fea1433bbc2e56d071a3/src/server/routing.ts
- Routing tests: https://github.com/miguelmartens/opencode-gearbox/blob/e56751c6f80d9163e984fea1433bbc2e56d071a3/test/server/routing.test.ts
- Judge-model tests: https://github.com/miguelmartens/opencode-gearbox/blob/e56751c6f80d9163e984fea1433bbc2e56d071a3/test/server/judge-model.test.ts
