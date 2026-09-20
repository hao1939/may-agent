---
title: "VoltDB Skills and MCP — Least-Privilege Runtime Authority"
source: hn
date: 2026-09-20
last_updated: 2026-09-20
type: finding
tags: [github, agent-skills, mcp, least-privilege, database-security]
---

# VoltDB Skills and MCP — Least-Privilege Runtime Authority

## Delivery and provenance

This narrow addendum delivers the 2026-09-20 VoltDB update accepted in archived
Scout publication `048b533f1b80b96af5ec2ec530388602e4e352c7`. It supplements
[Agent Behavioral Skills — A Portable Ecosystem Emerges](./2026-07-22-github-agent-skills-ecosystem.md),
whose canonical destination could not be atomically replaced because it is a
protected runtime resource. The accepted update and its source references are
preserved below without changing that published interface.

## Accepted update

11. **A production integration makes the skills–tools split explicit, then places authority at the database identity (2026-09-20 HN update).** Volt Active Data's current documentation separates three MIT-licensed skills—which teach schema, partitioning, stored-procedure, Kubernetes, and stream-processing practices—from a licensed MCP server that can inspect a particular running database. This is a concrete vendor implementation of the note's two-axis model: the skill supplies reusable product knowledge; MCP supplies live, instance-specific capability.

   The important boundary is not MCP itself but the account behind it. Volt documents that an unsecured database gives the server power to run arbitrary SQL and DDL, call stored and system procedures, change configuration, or shut the database down. Its recommended production posture is a dedicated MCP user that starts read-only, with database security enabled; the available information and effects then follow that user's roles. The architectural lesson is that **instruction packages should not carry operational authority**: pair portable skills with a separately configured, least-privilege runtime principal whose effective permissions can be inspected and changed without rewriting the skill.

   There are still deployment caveats. The documented server currently supports only local `stdio`, and the example adds it once so it remains available to later Claude Code sessions; installation persistence and runtime authorization are therefore separate lifecycle controls. The documentation is vendor-authored guidance, not an independent test of permission enforcement, model behavior, or outcome quality. Scout inspected the linked documentation and the public `VoltDB/volt-skills` repository at commit `a4c648118a23c6a5b818cbc72b488965dc346788`.

## Sources

Source: https://news.ycombinator.com/item?id=49772434
Source: https://docs.voltdb.com/UsingVoltDB/ChapAI.php
Source: https://docs.voltdb.com/UsingVoltDB/AImcp.php
Repo: https://github.com/VoltDB/volt-skills
Source: https://github.com/VoltDB/volt-skills/commit/a4c648118a23c6a5b818cbc72b488965dc346788
