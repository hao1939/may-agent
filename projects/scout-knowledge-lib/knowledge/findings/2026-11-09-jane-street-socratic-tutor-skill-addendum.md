---
title: "Jane Street Socratic Tutor Skill — Behavioral Contract Addendum"
source: hn
source_date: 2026-11-09
date: 2026-11-09
type: finding
tags: [hn, github, agent-skills, behavioral-contracts, tutoring, verification]
---

# Jane Street Socratic Tutor Skill — Behavioral Contract Addendum

This narrow addendum delivers the accepted 2026-11-09 update to [Agent Behavioral Skills — A Portable Ecosystem Emerges](./2026-07-22-github-agent-skills-ecosystem.md) without replacing that established finding. It preserves the reviewed content from archived Scout candidate `91b631a3954a4ffbe2c17e110572eda90cc14208` as a separately writable, source-grounded note.

## Ecosystem Entry

| Stars | Repo | What It Does |
|-------|------|-------------|
| 1,776 | **janestreet/agent_skills** | Jane Street's first published skill packages a strict Socratic tutor as one `SKILL.md` with explicit activation exclusions, performance-based progression, regression on failed review, and a manual resume-state envelope. |

## Behavioral Contract, Without External Enforcement

A skill can encode a behavioral contract, but prose does not enforce it. Jane Street's pinned `socratic-tutor` skill is a compact example of contract-shaped authoring. Its frontmatter names both positive triggers and exclusions; the body separates intent confirmation, diagnostic placement, one-question-at-a-time interaction, performance-based level changes, regression after failed spaced review, a terminal assessment, and an explicit save/resume envelope. This is stronger than an undifferentiated persona prompt because activation, state transition, evidence, completion, and user override are independently stated.

The inspected repository contains one skill and a short README, not a harness, conformance suite, experiment, learner study, or execution trace. The skill map is model-maintained prose state, and the rules such as "one question at a time" and "raise a level only on 2+ independent checks" have no external validator. The source therefore supports a useful authoring pattern, not claims that the policy is reliably followed, that state survives intact, or that the pedagogy improves learning. Portable skill systems should represent activation, state, evidence, completion, and override as testable host contracts when those properties matter.

## Coverage and Provenance

This adds `janestreet/agent_skills` as a contract-shaped single-file tutoring policy without external enforcement. It is an adaptation of the accepted update originally reviewed for `knowledge/findings/2026-07-22-github-agent-skills-ecosystem.md`; it does not rename, duplicate, or overwrite that base finding.

- HN discussion: https://news.ycombinator.com/item?id=50429183
- Repository: https://github.com/janestreet/agent_skills
- Reviewed repository revision: https://github.com/janestreet/agent_skills/commit/7c6715c29548a3b39d4a9545c698ee4fd17a7213
- Accepted archive revision: `91b631a3954a4ffbe2c17e110572eda90cc14208`
