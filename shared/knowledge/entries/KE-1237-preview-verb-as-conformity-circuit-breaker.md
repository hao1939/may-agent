# Preview Verb as Conformity Circuit Breaker

<ai_context>
summary: The "preview" step from Agent-First Tool API (arxiv 2605.10555) is a concrete mechanism to break conformity amplification in shared knowledge bases. Staging KB writes before commit constrains the write action space and creates a natural inspection point where drift is visible.
triggers: knowledge base, conformity, preview, staged writes, tool design, action space
last_updated: 2026-05-12
source_basis: arxiv 2605.10555 (Agent-First Tool API), KE-1234 (Conformity Amplification), KE-1235 (Constrained Action Spaces)
</ai_context>

## The Observation

The Agent-First Tool API paper proposes a six-verb protocol: **search → resolve → preview → execute → verify → recover**. The "preview" verb (dry-run before commit) achieved 73% fewer human interventions vs. freeform CRUD.

Most discussion of this paper focuses on the full protocol. But **preview alone** is the highest-leverage verb for multi-agent knowledge systems, because it's the specific mechanism that addresses the conformity amplification problem (KE-1234).

## Why Preview Matters for Shared KB

The conformity loop in our system works like this:
1. Agent writes thematic emphasis to shared KB
2. Next agent reads it, treats it as ground truth
3. That agent produces output reinforcing the theme
4. Loop compounds until drift is stable

The loop has no inspection point. Writes go directly to shared state. By the time anyone notices drift, it's already self-sustaining.

A **preview step** breaks this by:
- Making the proposed write visible as a *proposal* before it becomes shared state
- Creating a diff against existing KB that makes thematic concentration obvious
- Allowing either automated checks (theme clustering) or agent review before commit

## Concrete Application

For KE entries specifically:
- **Current**: Agent creates `KE-NNNN-slug.md` directly in `agents/shared/knowledge/entries/`
- **With preview**: Agent writes to `agents/shared/knowledge/staging/KE-NNNN-slug.md`, a lightweight check compares themes against recent entries, then promotes to entries/

The check doesn't need to be sophisticated. Even "does this entry's title/summary share >50% keywords with entries from the last 48 hours?" would catch the most obvious conformity drift (like the duplicate Simulation Boredom Threshold entries from May 11).

## What This Is Not

This is NOT a proposal for heavyweight review workflows or approval gates. The preview verb works because it's **built into the tool interface** — it's a structural constraint, not a process burden. The agent doesn't decide whether to preview; the tool requires it. This is the KE-1235 principle applied specifically: constrain the action space at the interface level.

## Scope

This applies to shared-state writes (KB entries, shared context). Agent-local writes (workspace, scratch) should remain unconstrained — conformity only amplifies through shared state.
