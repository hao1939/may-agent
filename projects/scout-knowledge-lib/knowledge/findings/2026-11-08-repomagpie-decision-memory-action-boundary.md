<ai_context>
summary: "RepoMagpie turns human-authored repository and package verdicts into local Markdown decision memory, retrieves them during agent planning, and checks exact avoid matches again at package-install hooks; the useful boundary is between provenance, retrieval, and effect interception."
triggers: ["RepoMagpie", "decision memory", "tool verdict", "package install hook", "action-boundary memory", "human-authored agent memory"]
last_updated: "2026-11-08"
source_basis: "HN item 50411918 and Varshavia/RepoMagpie revision 5cd7febbd0590c356a3de9ff074d7012d8769db0; README, SECURITY.md, docs/spec.md, decision 0036, and selected hook source inspected. Software and tests were not run."
</ai_context>

# RepoMagpie separates decision memory from action-boundary enforcement

- **Date observed:** 2026-11-08
- **Question:** What agent-memory pattern does RepoMagpie substantiate beyond generic semantic recall?
- **HN source:** https://news.ycombinator.com/item?id=50411918
- **Repo:** https://github.com/Varshavia/RepoMagpie
- **Reviewed revision:** `5cd7febbd0590c356a3de9ff074d7012d8769db0`
- **Coverage:** HN submission metadata; repository README and SECURITY.md; selected specification, decision, and hook-source sections. The package, hooks, and tests were not run.
- **Disposition:** new knowledge; no existing Scout file declared this primary source.

## Source-grounded finding

RepoMagpie is a local Markdown journal for human-authored decisions about repositories, packages, CLIs, MCP servers, and agent skills. Its README and specification distinguish the user's verdict and use/avoid conditions from agent-authored summaries. Skills and an MCP server expose those records while an agent is selecting tools. A second mechanism checks concrete package-install commands: exact avoid-note matches can ask the user before the install, or—where a host cannot reliably ask—deny the first attempt and let a matching retry through for ten minutes.

The useful architectural signal is narrower than “agents need memory.” A negative tool experience is represented as an inspectable decision record and introduced at two different boundaries:

1. **Planning-time retrieval:** search and recall help an agent choose among tools.
2. **Effect-time interception:** per-agent hooks inspect a pending package installation and reintroduce a matching avoid verdict before the effect.

That split matters because retrieval is advisory. Even a relevant record can be missed or ignored by the model; an action-boundary check can still surface it when the repeated choice is about to have an effect. Conversely, the hook is not a general policy engine: it checks a bounded class of package-install commands and relies on host-specific ask or deny behavior.

The implementation also makes provenance and prompt treatment explicit. Notes are plain files owned by the user or project, and the security document says note text is capped, quoted, source-labelled, and treated as data rather than executable instructions. This supports a typed-decision-memory model: preserve author, scope, rationale, alternatives, review date, match basis, intercepted action, enforcement outcome, and explicit override separately rather than collapsing them into an embedding and a single “remembered” flag.

## Evidence boundaries and limitations

- The HN item had one point and no comments when rechecked, so it supplies discovery rather than community validation.
- Claims about seven coding-agent integrations, performance, and live hook tests are repository-authored and were not independently reproduced.
- Host semantics differ. Some integrations can ask; others use a temporary first-attempt deny. Hooks may fail open, and package-less install commands are outside the described match path.
- A durable verdict can become stale or be wrong in a new context. The mechanism improves provenance, recall, and interception; it does not prove that the remembered decision is currently valid.
- Static source inspection does not establish complete install-command coverage, non-bypassability, or runtime behavior in every supported host.

## Reusable implication

Agent memory that can alter actions should emit separate receipts for: the human-authored decision and its scope; the evidence version against which it remains valid; retrieval during planning; the concrete action matched; the ask, deny, pass, or override result; and whether the effect later settled. A memory hit is not itself an authorization decision, and a hook verdict is not proof that every equivalent effect route was covered.
