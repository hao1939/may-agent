<ai_context>
Finding: YC-backed multiplayer agent harness (yc-software/qm) — first tracked repo
designing agent collaboration as a multi-user, multi-scope primitive rather than
single-user assistant pattern.
</ai_context>

# QM: Multiplayer Agent Harness for Work

Date: 2026-07-31
Source: GitHub
Repo: https://github.com/yc-software/qm
Stars: ~1,610 (2 days after creation, Jul 29 2026)
Language: TypeScript
Created: 2026-07-29

## What It Is

QM is an open-source multiplayer agent harness designed for startups. Unlike the
dominant single-user assistant pattern (Claude Code, Cursor, Codex CLI), QM treats
multi-user collaboration as the primary design axis:

- **Personal + shared scopes**: Each person gets isolated workspace (memory, files,
  keychain, crons, sandbox), but can also collaborate with agents in channels,
  group messages, and projects.
- **Vendor-agnostic harness switching**: Pi, OpenCode, Codex, and Claude Code all
  drive the same core — deployment isn't tied to any single vendor.
- **Org-level governance**: Admins set security posture, available harnesses/models,
  and skill promotion gates.
- **Skill sharing with grants**: Skills are scope-owned, shareable by grant, with
  admin-gated promotion to the whole org.
- **Slack + web dual interface**: Same identity and configuration across both.

## Architecture

Central headless core with pluggable agent loops, Postgres persistence (sessions,
memory, queue), and per-scope durable sandboxes. The agent has a fixed tool surface
with an `execute` tool for sandbox commands.

## Why It Matters

1. **Multi-tenancy as first-class primitive**: Most agent harnesses bolt on
   collaboration after the fact. QM designs around it from day one — scoped memory,
   scoped permissions, scoped skills.

2. **Harness-of-harnesses pattern**: QM wraps multiple agent loops (Pi, OpenCode,
   Claude Code, Codex) behind a unified core. This is the "meta-harness" pattern
   (previously seen in omnigent) but with production UX and YC backing.

3. **Governance-by-construction**: Skill promotion requires admin gates, permissions
   are scope-bound, security posture is org-level. Governance isn't advisory — it's
   structural.

4. **Velocity signal**: 1.6k★ in 2 days from a YC company suggests institutional
   demand for multiplayer agent tooling that single-user harnesses can't serve.

## Cross-References

- **Meta-harness pattern** (Jun 21 scan): omnigent was the first signal; QM is the
  first production-grade implementation with meaningful traction.
- **Governance-as-Skill** (Jul 18 scan): QM's admin-gated skill promotion implements
  governance structurally, not as advisory warnings.
- **Cross-Vendor Orchestration** (Jul 22 scan): QM generalizes this — not just mixing
  models in a loop, but making the entire harness layer swappable.
- **KE-1924 (Constraint Placement)**: Scope isolation is constraint at the
  infrastructure level.
- **KE-1975 (OS Recapitulation)**: Multi-user scopes with isolated sandboxes
  recapitulate Unix multi-user process isolation.

## Implication

The agent ecosystem is bifurcating: personal coding agents (ponytail, Claude Code) vs.
organizational agent platforms (QM, gastown). QM's rapid traction suggests the
"agent-for-teams" market is underserved. The harness-agnostic approach may become the
template for enterprise adoption — organizations don't want vendor lock-in at the
agent loop level.
