<ai_context>
summary: "MMDD's strongest reusable idea is not its self-reported productivity but a portable provenance chain: one reviewed unit plan becomes the agent instruction, a separate test contract, an as-built record, a status transition, and one commit. The public v2-to-v5 evolution shows implicit documentation rules becoming explicit approval and validation gates, but it provides no controlled quality or productivity evaluation."
triggers: ["MMDD", "micromanaged driven development", "plan test done commit", "unit prompt commit provenance", "portable coding agent workflow", "reviewed unit plan", "as-built agent record"]
last_updated: "2026-08-26"
source_basis: "HN item 49446273, the linked retrospective, and the public pinned v2 and current v5 MMDD rule files were inspected. Project outcomes remain author-reported."
</ai_context>

# Bind each coding-agent change to a plan–test–as-built chain

**Date:** 2026-08-26  
**Source:** https://news.ycombinator.com/item?id=49446273  
**Source:** https://allende.nz/notes/fourteen-months-micromanaging-ai-coding-agents/  
**Repo:** https://github.com/robertoallende/micromanaged-driven-development  
**Source:** https://github.com/robertoallende/micromanaged-driven-development/blob/ecc30a2d5e0bb3856d18f377c568254c8fc23fad/dev_log/00_mmdd.md  
**Source:** https://github.com/robertoallende/micromanaged-driven-development/blob/main/dev_log/00_mmdd.md  
**Tags:** coding-agents, change-provenance, task-decomposition, approval-gates, test-contracts, tool-portability

## Finding

HN surfaced Roberto Allende's fourteen-month retrospective on **Micromanaged Driven Development (MMDD)**, a plain-file workflow for supervising coding agents. Its useful signal is narrower than the claimed project speed: it makes a small reviewed work unit serve as the stable join key across intent, execution, evidence, project state, and version control.

The current v5 rule file requires a five-step cycle:

1. establish the unit's objective, constraints, and dependencies;
2. review and explicitly approve a unit plan before implementation;
3. implement in small validated increments and create a separate `_test.md` contract;
4. run those tests and expose validation points for developer confirmation; and
5. write a `_done.md` record of the actual implementation and deviations, update the project index, then create one unit-scoped commit.

This produces a compact provenance chain:

`approved plan → agent instruction → test contract → observed implementation/deviations → status transition → commit`

That chain is stronger than using a task list only as a prompt. The plan records authorized intent; the test file records what acceptance means before completion; the done file prevents the original plan from being mistaken for the as-built result; and the commit gives the unit a reversible code boundary. Because the artifacts are Markdown rather than a vendor session format, the author reports moving the same workflow among Claude Code, Kiro, and Codex.

## What the version history adds

The linked v2 rule file is a useful primary-source comparison. It prescribed unit/subunit logs, status tracking, and sequential work, but its templates mostly contained descriptive placeholders and its usage section said to document interactions and update status. The current v5 file replaces that implicit discipline with explicit prohibitions—do not implement before approval and do not batch large changes—and adds dedicated test and completion artifacts.

The meaningful evolution is therefore not simply “more documentation.” It is **separating three claims that are easy to collapse**:

- what the developer authorized;
- what evidence should establish success; and
- what the agent actually changed, including deviations.

A portable workflow should preserve these distinctions even if its file names differ.

## Operational implication

For coding-agent orchestration, make the work-unit identity span every stage but do not let one artifact impersonate another:

- keep the reviewed plan immutable or revision-addressed once execution starts;
- define tests and success criteria before accepting the unit;
- require an as-built record that names deviations rather than silently rewriting the plan;
- link status changes and commits to the same unit identity;
- reject oversized units that cannot be independently reviewed, tested, or reverted; and
- measure rework, escaped defects, review time, and rollback success before treating the added ceremony as beneficial.

This also clarifies a common handoff failure: transferring only a transcript or only a task description loses either authorization state or implementation reality. A receiver needs the current plan revision, evidence contract, as-built delta, and repository state together.

## Evidence limits

The retrospective lists more than ten projects and describes a six-hour hackathon prototype, reuse of twenty units for a React-to-Flutter rewrite, and five methodology versions. Those are author-reported case narratives, not controlled comparisons. The public rule files verify that the workflow changed from implicit logging to explicit approval/test/done gates, but they do not establish that MMDD caused faster delivery, better code, or successful framework migration.

There are additional open risks: “smallest possible next change” has no objective sizing rule; a separate test file can still encode weak acceptance criteria; the method relies on developer judgment; and status plus commit discipline can become documentation overhead for trivial work. The HN item had one point and no comments when inspected, so this is a source-grounded workflow pattern, not community-validated consensus.
