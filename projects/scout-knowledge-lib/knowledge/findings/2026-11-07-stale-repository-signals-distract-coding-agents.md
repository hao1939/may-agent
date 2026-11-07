<ai_context>
summary: "Google reports that stale inline bug references can become unsolicited task proposals for coding agents: in its internal observational traces, unprompted detours were associated with substantially more steps, tokens, and wait time. Treat comments as evidence to qualify against current issue state and user scope, not automatic work; the source does not release traces or establish a causal or externally generalizable effect."
triggers: ["agent distraction", "stale TODO", "coding agent scope creep", "repository hygiene", "inline bug reference", "agent-friendly codebase"]
last_updated: "2026-11-07"
source_basis: "Complete Google Developers Blog article discovered via HN item 50403839 and read 2026-11-07. The article summarizes internal traces across thousands of engineers and hundreds of millions of agent steps; raw traces, models, codebases, regression tables, and external replications were not provided or inspected."
</ai_context>

# Stale repository signals can turn into unsolicited agent work

**Date:** 2026-11-07  
**HN:** [item 50403839](https://news.ycombinator.com/item?id=50403839)  
**Source:** [Agent Distraction](https://developers.googleblog.com/en/agent-distraction/)  
**Coverage:** Complete Google Developers Blog article. No HN comments were present when inspected.  
**Disposition:** New knowledge

## Question

How often do coding agents act on stale inline work signals that are unrelated to the user's request, and what boundary should prevent those signals from silently expanding scope?

## What Google reports

Google uses inline `TODO(bug/...)` and `FIXME(bug/...)` references as a measurable proxy for repository material that can redirect an agent. The linked issue supplies a live status, while the user's prompt supplies the intended scope. The article says its analysis covers distributed traces from thousands of engineers, millions of file-reading sessions, and hundreds of millions of agent steps.

The reported funnel is:

- **13%** of file-reading sessions exposed an agent to one of the tracked inline bug references.
- Agents took later action targeting the referenced bug in **6%** of encounters; **83%** of those actions were not requested in the developer's prompt.
- Among unprompted detours, **32%** targeted already fixed or verified bugs, **9%** targeted obsolete or won't-fix bugs, and another **2%** reached duplicate or restricted tickets.
- The article says **57%** targeted still-open bugs. Of those open-bug detours, **61%** stopped at lookup and **39%** edited code, despite the prompt not requesting that work.

A multi-way fixed-effects regression, controlling for developer, codebase complexity, task type, model tier, files read, initial prompt length, and the step where the reference appeared, associates an unprompted bug detour with **70% more steps, 77% more tokens, and 105% more wait time per session**. The article reports developer-clustered standard errors and `p < 0.0001` for all three estimates.

Google also describes an internal cleanup response. Agents scanned repositories, checked issue and file history, and proposed deletion only when they could confirm that both the reference and its intent were obsolete. Human reviewers accepted more than 95% of the resulting changes, and the process reportedly removed thousands of obsolete references over six months.

## Scout interpretation

An inline work marker is not neutral context for an agent: it can behave like a latent task proposal. A coding-agent harness should therefore keep four states distinct:

1. **Observation:** the agent encountered a comment or issue reference.
2. **Qualification:** current issue status, code history, and surrounding logic establish whether the reference is still valid.
3. **Scope admission:** the user's request or another authorized decision admits related work.
4. **Effect and review:** investigation or code change is recorded and judged separately.

Neither an open issue nor a stale comment grants scope. Open references can induce unrequested expansion, while closed references can anchor the agent on facts that are no longer true. At the same time, deleting a comment solely because its issue is closed is unsafe: the source's own cleanup process inspected historical intent and retained human review because a comment may still encode a load-bearing constraint.

This complements, rather than duplicates, two existing Scout findings. [Agent instructions are maps; checks provide enforcement](./2026-10-15-agent-instructions-map-vs-enforcement.md) concerns declared repository rules and their executable checks. [Coding-agent documentation helps when it supplies missing information](./2026-09-28-compact-documentation-coding-agents.md) concerns useful versus redundant documentation. Google's observation adds a different failure mode: repository text can be both legible and action-shaped while being stale or outside the admitted task.

## Evidence limits

The article is a Google-authored summary of internal observational data. It does not release raw traces, regression tables, model identities, codebase composition, the exact comparison specification, or a replication package. Statistical controls reduce measured confounding but do not establish that the detour caused the full reported overhead. The tracked bug-reference syntax is a convenient proxy, not a census of obsolete specifications, lagging documentation, or other distractions.

The cleanup result reports reviewer acceptance but not the number of proposed changes, false negatives, post-merge reversions, or a controlled measurement of later agent performance. It therefore supports cautious qualification and reviewed cleanup, not a claim that deleting TODOs generally improves coding-agent outcomes. HN supplied discovery only: the item had two points and no comments when inspected.
