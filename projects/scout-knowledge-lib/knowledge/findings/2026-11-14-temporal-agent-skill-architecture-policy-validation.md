---
title: "Temporal Agent Skill — Architecture Policy Needs Behavioral Validation"
source: github
date: 2026-11-14
last_updated: 2026-11-14
type: finding
tags: [github, agent-skills, temporal, architecture-policy, behavioral-validation, workflow-determinism]
---

# Temporal Agent Skill — Architecture Policy Needs Behavioral Validation

This is the writable recovery addendum for the accepted 2026-11-14 update to [Agent Behavioral Skills — A Portable Ecosystem Emerges](./2026-07-22-github-agent-skills-ecosystem.md). It preserves the reviewed update from archived candidate revision `178f693db80c4bbd146d24532472c8827cdab4f0` without replacing that retained finding.

## Finding

**A domain skill can carry architecture law while its CI proves only package integrity (2026-11-14 update).** Temporal's `skill-temporal-developer` packages one `SKILL.md` plus 100+ language and concept references for Claude Code, Cursor, Codex, and standalone skill installers. The top-level skill does more than provide syntax: it tells coding agents to keep side effects out of replayed Workflow code, put LLM calls and non-deterministic tools in retryable Activities, disable nested client retries, distinguish Temporal Task Queues from user-facing job queues, and route operational or cloud-setup work to separate skills. These are architecture-critical distinctions whose violation can block replay, duplicate retry layers, or answer the wrong queue question.

   The repository's CI is narrower than those behavioral claims. At inspected revision `0d0747613c4cbd04f2743af41f5f19e7d5dc494d`, it checks Markdown formatting, Markdown links, and `skills-ref validate`; Scout found no repository CI step that runs a coding agent against scenario fixtures or checks whether generated code actually preserves determinism, retry ownership, timeout policy, or queue semantics. This is not a defect claim—the repository may test elsewhere—but it exposes a reusable admission distinction: **a valid skill package is not yet a behaviorally validated architecture policy**. High-consequence domain skills should pair structural validation with pinned positive and negative scenarios, executable checks on generated artifacts, and explicit coverage receipts for rules that were not exercised.

   The source is first-party documentation and CI configuration, inspected statically at a pinned commit. Scout did not install the skill, run its validators, invoke any supported coding agent, compile generated Temporal code, replay a Workflow, or test the documented timeout and retry recommendations. The Search API result was complete (`incomplete_results: false`), but GitHub search is discovery evidence rather than proof of repository behavior.

## Sources

- Repo: https://github.com/temporalio/skill-temporal-developer
- Source: https://github.com/temporalio/skill-temporal-developer/commit/0d0747613c4cbd04f2743af41f5f19e7d5dc494d
- Source: https://github.com/temporalio/skill-temporal-developer/blob/0d0747613c4cbd04f2743af41f5f19e7d5dc494d/SKILL.md
- Source: https://github.com/temporalio/skill-temporal-developer/blob/0d0747613c4cbd04f2743af41f5f19e7d5dc494d/references/core/ai-patterns.md
- Source: https://github.com/temporalio/skill-temporal-developer/blob/0d0747613c4cbd04f2743af41f5f19e7d5dc494d/.github/workflows/ci.yml
