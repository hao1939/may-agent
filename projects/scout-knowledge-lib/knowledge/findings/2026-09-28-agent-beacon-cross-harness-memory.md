<ai_context>
summary: "Agent Beacon separates raw traces, scored candidates, approved memory, and promoted skills; a same-day follow-up also shows commit attribution marked as inferred and explicit, reversible setup for cross-harness hosted retrieval."
triggers: "agent memory, cross-harness memory, trace archive, memory admission, skill promotion, provenance, commit attribution, MCP configuration, Agent Beacon"
last_updated: "2026-09-28"
source_basis: "Static inspection of Asymptote-Labs/agent-beacon at commits 24ec69adf6b5d6f8f80b90b23177c66fcf8df441 and 91e92216b79108475ba9b587d49c5ff3f7356fd8"
</ai_context>

# Agent Beacon: cross-harness memory needs two admission boundaries

**Date observed:** 2026-09-28  
**Disposition:** New knowledge  
**Coverage:** Repository metadata and static inspection of selected documentation, skills, Go implementation, and tests at the pinned revision below. No binary was installed or executed, and no runtime, privacy, security, retrieval-quality, or cross-harness interoperability claim was independently tested.

- **Repo:** https://github.com/Asymptote-Labs/agent-beacon
- **Inspected revision:** [`24ec69adf6b5d6f8f80b90b23177c66fcf8df441`](https://github.com/Asymptote-Labs/agent-beacon/tree/24ec69adf6b5d6f8f80b90b23177c66fcf8df441)
- **Discovery query:** [`"AI agent" in:name,description stars:>100`, sorted by recently updated](https://api.github.com/search/repositories?q=%22AI+agent%22+in%3Aname%2Cdescription+stars%3A%3E100&sort=updated&order=desc&per_page=20) (`incomplete_results: false`)

## What the source shows

Beacon describes itself as a local-first capture and memory layer across Claude Code, Cursor, Codex, OpenCode, and other harnesses. The more reusable signal is the shape of its admission pipeline:

1. **Raw session traces remain distinct from memory.** The recall skill explicitly labels traces as unreviewed history and approved memory as a separate class. It instructs an agent to quote raw history narrowly and not present it as approved knowledge.
2. **An evaluator only nominates candidates.** The distillation skill says evaluation probabilities identify potentially reusable traces but do not write the lesson. A reviewer or an agent working with the reviewer must read the source trace and draft grounded text.
3. **Promotion has a non-compensable success gate.** In [`candidate.go`](https://github.com/Asymptote-Labs/agent-beacon/blob/24ec69adf6b5d6f8f80b90b23177c66fcf8df441/cli/beacon/internal/learning/candidate.go), a trace needs both a mean evaluation score of at least `0.60` and `task_success >= 0.50`. High reusability and evidence scores cannot average away a failed task. [`promotion_test.go`](https://github.com/Asymptote-Labs/agent-beacon/blob/24ec69adf6b5d6f8f80b90b23177c66fcf8df441/cli/beacon/internal/learning/promotion_test.go) preserves regression cases where failed tasks previously cleared the mean threshold.
4. **Candidate approval is another state transition.** The learning schema distinguishes `candidate`, `approved`, `rejected`, and `superseded`. Approval records reviewer-edited text, evidence references, and a review reason; scoring alone does not make a candidate retrievable canon.
5. **Broad distribution is separate from approval.** Approved memory can be rendered as a repository Agent Skill, but the promotion skill requires preview and user confirmation. The generated skill carries memory and candidate IDs plus trace references, and installation refuses to overwrite an existing skill unless forced.

The repository also models source quality rather than flattening all captured events. [`provenance.go`](https://github.com/Asymptote-Labs/agent-beacon/blob/24ec69adf6b5d6f8f80b90b23177c66fcf8df441/pkg/asymptoteobserve/provenance.go) separates collection method (`hook`, `otlp`, `plugin`, or `poll`) from event fidelity (`observed` or `inferred`). Its comments warn that a typed hook event and a keyword guess can otherwise appear as the same action. This is important because a memory pipeline can preserve trace IDs yet still overstate what the underlying trace actually proves.

## Current-source follow-up: attribution and retrieval setup are separate controls

A same-day recheck found `main` at [`91e92216b79108475ba9b587d49c5ff3f7356fd8`](https://github.com/Asymptote-Labs/agent-beacon/tree/91e92216b79108475ba9b587d49c5ff3f7356fd8), 47 commits ahead of the originally inspected revision. Static inspection of the changed implementation adds two useful boundaries:

- **Commit linkage is recorded as an inference, not authorship proof.** The new git integration links a session to a commit using changed-file overlap and emits `session.commit_linked` into that session's timeline. Both the [implementation](https://github.com/Asymptote-Labs/agent-beacon/blob/91e92216b79108475ba9b587d49c5ff3f7356fd8/cli/beacon/internal/gitlink/events.go) and [documentation](https://github.com/Asymptote-Labs/agent-beacon/blob/91e92216b79108475ba9b587d49c5ff3f7356fd8/docs/cli/git.mdx) label the event `fidelity: inferred`. Automatic linking skips replay operations such as rebase and cherry-pick. Sharing links through Git notes is opt-in; its pre-push hook has a ten-second budget and does not fail the user's code push if sharing fails.
- **Cross-harness retrieval setup is explicit and owner-scoped.** `beacon mcp connect` plans changes, requires confirmation unless explicitly run with `--yes`, backs up edited harness configs, and records its own entries in a private manifest so disconnect can remove only Beacon-managed configuration. The [connection engine](https://github.com/Asymptote-Labs/agent-beacon/blob/91e92216b79108475ba9b587d49c5ff3f7356fd8/cli/beacon/internal/mcpconnect/engine.go) preserves unrelated configuration and records progress after each successful write. OAuth is the default; token mode writes an environment-variable reference rather than the token value. The separate [token-minting client](https://github.com/Asymptote-Labs/agent-beacon/blob/91e92216b79108475ba9b587d49c5ff3f7356fd8/cli/beacon/internal/account/mcp_token.go) refuses redirects before sending the account credential and returns the newly minted token without storing it.

Together these changes extend the admission model into operational provenance: a retained trace may support a memory candidate, a file-overlap heuristic may connect that trace to a commit, and an explicit configuration change may expose hosted history to another harness. Those are three different authority claims and should remain distinguishable in audit output.

## Why it matters

The design turns “agent memory” into two explicit control decisions:

- **Evidence → approved memory:** Is this lesson grounded, reusable, correctly scoped, and reviewed?
- **Approved memory → ambient instruction:** Is it common and important enough to be loaded automatically by multiple harnesses?

Those decisions should not collapse into one ranking score. A lesson can be valid but too narrow for ambient loading; a trace can look reusable while documenting a failed task. The hard task-success gate is a concrete example of why additive scoring needs non-compensable predicates for disqualifying conditions.

This extends the library’s [operational-memory note](../hn-agent-operational-memory.md): retaining source-complete traces makes re-extraction possible, while candidate states, review, supersession, and explicit skill promotion govern what becomes current or ambient authority.

## Reusable guidance

- Keep raw execution history, candidate lessons, approved memory, and auto-loaded instructions as separate artifacts and states.
- Use ranking to prioritize review, not to admit knowledge automatically.
- Encode disqualifying conditions as hard gates; do not let unrelated high scores compensate for task failure or weak provenance.
- Preserve a path from distributed guidance back to the approved memory and source trace.
- Treat instruction promotion as a second review because its retrieval scope and blast radius are larger than on-demand memory.

## Limitations and open questions

This was static source inspection, not a product evaluation. The repository’s claims of support for 20+ harnesses, exact replay, local-first behavior, and interoperability were not exercised. The generated skill includes provenance identifiers and trace references, but this scan did not verify whether a consumer can always resolve them after export, repository transfer, or memory-store loss. It also did not test evaluator calibration, redaction quality, adversarial trace content, supersession propagation, or whether installed skills are automatically refreshed when an approved memory changes; the promotion documentation says they are not.

## Primary files inspected

- [README.md](https://github.com/Asymptote-Labs/agent-beacon/blob/24ec69adf6b5d6f8f80b90b23177c66fcf8df441/README.md)
- [beacon-memory-distill skill](https://github.com/Asymptote-Labs/agent-beacon/blob/24ec69adf6b5d6f8f80b90b23177c66fcf8df441/agent-skills/skills/beacon-memory-distill/SKILL.md)
- [lesson-quality reference](https://github.com/Asymptote-Labs/agent-beacon/blob/24ec69adf6b5d6f8f80b90b23177c66fcf8df441/agent-skills/skills/beacon-memory-distill/references/lesson-quality.md)
- [beacon-memory-recall skill](https://github.com/Asymptote-Labs/agent-beacon/blob/24ec69adf6b5d6f8f80b90b23177c66fcf8df441/agent-skills/skills/beacon-memory-recall/SKILL.md)
- [beacon-memory-promote skill](https://github.com/Asymptote-Labs/agent-beacon/blob/24ec69adf6b5d6f8f80b90b23177c66fcf8df441/agent-skills/skills/beacon-memory-promote/SKILL.md)
- [learning schema](https://github.com/Asymptote-Labs/agent-beacon/blob/24ec69adf6b5d6f8f80b90b23177c66fcf8df441/pkg/asymptoteobserve/learning.go)
- [candidate admission implementation](https://github.com/Asymptote-Labs/agent-beacon/blob/24ec69adf6b5d6f8f80b90b23177c66fcf8df441/cli/beacon/internal/learning/candidate.go)
- [skill rendering and installation](https://github.com/Asymptote-Labs/agent-beacon/blob/24ec69adf6b5d6f8f80b90b23177c66fcf8df441/cli/beacon/internal/learning/skills.go)
- [event provenance model](https://github.com/Asymptote-Labs/agent-beacon/blob/24ec69adf6b5d6f8f80b90b23177c66fcf8df441/pkg/asymptoteobserve/provenance.go)
- [current git-link documentation](https://github.com/Asymptote-Labs/agent-beacon/blob/91e92216b79108475ba9b587d49c5ff3f7356fd8/docs/cli/git.mdx)
- [current commit-link event implementation](https://github.com/Asymptote-Labs/agent-beacon/blob/91e92216b79108475ba9b587d49c5ff3f7356fd8/cli/beacon/internal/gitlink/events.go)
- [current MCP connection documentation](https://github.com/Asymptote-Labs/agent-beacon/blob/91e92216b79108475ba9b587d49c5ff3f7356fd8/docs/cli/mcp-connect.mdx)
- [current MCP configuration engine](https://github.com/Asymptote-Labs/agent-beacon/blob/91e92216b79108475ba9b587d49c5ff3f7356fd8/cli/beacon/internal/mcpconnect/engine.go)
- [current MCP token client](https://github.com/Asymptote-Labs/agent-beacon/blob/91e92216b79108475ba9b587d49c5ff3f7356fd8/cli/beacon/internal/account/mcp_token.go)
