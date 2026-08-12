<ai_context>
summary: "desktop-harness implements a cost- and ambiguity-ordered control ladder for Mac agents: shell before GUI, accessibility structure before screenshots, semantic AX actions before coordinate clicks, then visual verification after mutation. The implementation also exposes an important policy boundary: sensitive-app blocking is runtime code, but confirmation for consequential actions remains natural-language skill guidance."
triggers: ["desktop-harness", "desktop agent", "computer use", "accessibility tree", "AXPress", "representation ladder", "GUI automation"]
last_updated: "2026-08-11"
source_basis: "GitHub repository README, SKILL.md, helpers.py, ax.py, and safety.py inspected at commit 57739ae71c563a9856a7a9a376435d17861099ef."
</ai_context>

# Desktop agents benefit from a representation-and-action ladder

**Date:** 2026-08-11  
**Repo:** https://github.com/xfreeze2/desktop-harness  
**Commit:** https://github.com/xfreeze2/desktop-harness/tree/57739ae71c563a9856a7a9a376435d17861099ef  
**Tags:** computer-use, desktop-agents, accessibility, representation-routing, safety, verification

## Finding

`desktop-harness` is a young macOS control CLI and agent skill that makes its routing order explicit:

1. use shell or an API when the task is not genuinely graphical;
2. inspect a bounded Accessibility (AX) tree rather than sending a screenshot to vision;
3. activate a named element with `AXPress` or set its value;
4. fall back to a coordinate click when semantic activation fails;
5. use a window screenshot when AX cannot represent the interface; and
6. after a screen-changing action, capture current state for the agent to verify rather than treating a successful API return as task success.

This is implemented rather than only advertised. `helpers.py` exposes bounded AX snapshots and makes `click_text` search labelled elements, prefer `AXPress`, then click the matched frame. `ax.py` extracts roles, labels, values, enabled state, frames, and tree paths while capping traversal depth and node count. The bundled `SKILL.md` separately requires post-action visual verification because a successful AX call proves only that the call was accepted, not that the intended screen state resulted.

## Operational implication

Computer-use routing should choose **both a representation and an actuation level**, ordered from the most semantic and least ambiguous to the most perceptual and open-ended. “Text versus vision” is too coarse:

- shell/API can remove the GUI problem entirely;
- AX supplies compact semantic state;
- AX actions preserve target identity better than coordinates;
- pixel actions recover coverage for custom canvases; and
- post-action pixels can verify a transition even when pixels were unnecessary for choosing the action.

The non-obvious point is that perception and verification need not use the same representation. A runtime can select an action cheaply from structured state, then spend on vision only at the evidence boundary. This differs from a screenshot-first loop and from a single representation router: it is a **monotone fallback ladder with an explicit proof step**.

## Safety boundary exposed by the code

The repository also usefully distinguishes enforced and instructed controls, although its README does not emphasize the gap:

- `safety.py` blocks mutations when a password-manager-, wallet-, or bank-like app is frontmost unless an environment override is set.
- Mutating helpers call that runtime check and write a local JSONL audit event.
- By contrast, “ask before send/post/pay/delete/security changes/passwords” is a string in `safety.py` and a rule in `SKILL.md`; the runtime does not classify or interlock those actions.
- Audit writes swallow exceptions, so the log is best-effort rather than a completion receipt.

A deployer should therefore label controls as **mechanism-enforced**, **agent-mediated**, or **observational**. A safety list in a skill file is not equivalent to an actuation gate, and an audit attempt is not equivalent to durable evidence.

## Evidence limits

This is implementation evidence from a repository created on 2026-08-10, not a benchmark. The project reports no controlled latency, token-cost, task-success, or safety evaluation against screenshot-first agents. It is macOS-specific, AX coverage varies by application, and the skill itself notes screenshot fallback for interfaces such as custom canvases and some Electron surfaces. Treat the ladder and control-boundary decomposition as a testable architecture pattern, not as proof that this package is production-safe or universally faster.
