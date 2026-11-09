<ai_context>
summary: "Pinned Precedent review: learning operating rules from team chat is safer when evidence extraction, human rule admission, start authorization, and in-progress execution checks remain separate, durable control stages."
triggers: ["Precedent", "mined business rules", "agent rulebook", "execution revalidation", "human-approved agent policy", "rule drift"]
last_updated: "2026-11-09"
source_basis: "Static inspection of burhan-mujahid/precedent README, design and security documents, rule store, chat episode extraction, decision runtime, execution guard, drift logic, and selected project-authored tests at commit 91d9eabd397abd74bd5ace3f203c4874822cb53a; Scout did not run the package, tests, demo, model providers, MCP integration, or CI."
</ai_context>

# Mined operating rules need separate admission and execution gates

**Date:** 2026-11-09  
**Disposition:** new knowledge  
**Question:** What control boundaries are needed when an agent system turns team conversations into reusable operating rules?  
**Repo:** https://github.com/burhan-mujahid/precedent  
**Reviewed version:** commit [`91d9eabd397abd74bd5ace3f203c4874822cb53a`](https://github.com/burhan-mujahid/precedent/commit/91d9eabd397abd74bd5ace3f203c4874822cb53a)  
**Coverage:** repository metadata, README and tree; `docs/DESIGN.md`; `SECURITY.md`; `precedent/ingest/episodes.py`; `precedent/store.py`; `precedent/runtime.py`; `precedent/guard.py`; `precedent/drift.py`; and selected project-authored guard and runtime tests. Scout did not execute any code.

## Source observation

Precedent is a local Python rulebook layer for agents. Its distinctive signal is not merely that it extracts policies from Slack, WhatsApp, or JSONL. The inspected source separates four decisions that are easy to collapse into one unsafe “learn from experience” loop:

1. **Evidence extraction:** chat ingest uses explicit question-pattern and time-window heuristics to form candidate question-and-answer episodes. The module states that this is tuned for recall and leaves precision to review. Source message identities remain attached to mined drafts.
2. **Rule admission:** mined answers, gap answers, overrides, and drift responses become proposals. The design describes approved proposals as the only route into the rulebook. Rule files are versioned, prior versions are retained, and gap and decision history is appended as events.
3. **Action-start authorization:** `runtime.py` retrieves approved rules, then applies coverage, model judgement, citation grounding, confidence, and risk gates. Missing coverage, model errors, conflicts, invented citations, or invented numeric values escalate rather than authorize action. High-risk matches require a separate sign-off.
4. **In-progress revalidation:** `guard.py` checks again before effectful steps and after completion. It halts unknown, already-used, unsigned, expired, changed-rule, and lexically out-of-scope decisions. Halts are sticky across a run, and selected halts open a new gap that can later produce another reviewable proposal.

The implementation also treats rule maintenance as a different loop from rule use. `drift.py` derives stale, repeatedly overridden, unused, duplicate, and coverage findings from rule, decision, feedback, and halt records. Some findings can draft deprecate or reconfirm proposals, but they do not directly rewrite approved rules. Regression cases can be accumulated from resolved gaps and confirmations, while `health --strict` and `eval --min-pass` are intended to gate changes in CI.

The repository is unusually explicit about important limits. Its security document says there is no authentication for people or processes that can write the rulebook directory; the MCP server trusts its local client; the system cannot stop an agent that never calls the gate; a halt takes effect only at the next check; and scope checks are lexical rather than semantic. Static exports such as skills or `AGENTS.md` cannot enforce the runtime gates.

## Interpretation

A system that learns policy from operational traces should preserve a **four-stage authority chain**:

- **observed evidence** says what people appeared to discuss or decide;
- **admitted rule** says which interpretation an accountable reviewer accepted;
- **decision authorization** says whether that rule covers this particular situation now;
- **execution authorization** says whether the next concrete effect still fits the decision and unchanged rule state.

These stages need separate identities and records. A source message is not a rule. An approved rule is not authorization for every similar request. Authorization to begin is not authorization for every later step. A successful past action is not permission to promote its behavior automatically.

This separation also improves learning quality. Escalations, overrides, and halts can become evidence for a new proposal without allowing the agent or monitor to mutate live policy directly. Drift detection can request review without being the authority that approves its own repair. The resulting loop is slower than autonomous self-editing, but it preserves a review boundary exactly where inferred practice becomes future agent authority.

For agent platforms, the most reusable pattern is to bind a decision to the exact rule identifiers, versions, and content hashes it used, then invalidate that decision when the rule changes, the approval expires, the decision is reused, or the proposed step adds consequential terms or amounts. That converts “the agent consulted policy” from a prompt claim into a checkable relation between evidence, policy revision, decision, and effect.

## Comparison with existing Scout knowledge

[Aegis — Method-Pack Governance for Architecture-Aware Coding Agents](./2026-08-04-github-aegis-method-pack-governance.md) describes a portable discipline layer whose own documentation limits its authority and does not claim runtime control. Precedent is a different implementation subject: it stores human-approved domain rules and implements local decision and execution checks, while admitting that those checks remain bypassable unless the host owns the effect route.

[Local agent checks still need a non-bypassable acceptance boundary](./2026-11-07-local-agent-hooks-need-non-bypassable-acceptance.md) establishes the broader complete-mediation problem. This source adds a specific policy-learning boundary: mined conversations can safely inform agent behavior only when extraction, human admission, per-situation authorization, and per-step revalidation do not share one automatic promotion path.

## Limitations

This was static source inspection. Scout did not install Precedent, run its tests or demo, call a model provider, ingest real organizational chat, exercise concurrent approval, connect an MCP host, verify CI behavior, or reproduce the repository's live-model results, latency figures, security claims, or PyPI package behavior.

The implementation is pre-1.0 and local-directory security is outside its enforcement boundary. Anyone able to write the rulebook can approve or edit rules. Reviewer and sign-off identity is recorded but not authenticated by Precedent itself. Complete mediation depends on the surrounding agent framework preventing equivalent effects that bypass `consult_rulebook` and `check_action`.

The extraction heuristics do not prove that a reply is authoritative, current, or correctly scoped. Redaction is documented as a floor rather than a guarantee. Numeric grounding and high-risk-term checks cover only narrow lexical classes; semantically unsafe instructions without novel numbers or configured terms can pass. Project-authored documentation and tests are implementation evidence, not independent validation or proof of production reliability.

The public repository Search API response used for discovery reported `incomplete_results: false`, but that describes only the bounded query response and is not exhaustive GitHub coverage.
