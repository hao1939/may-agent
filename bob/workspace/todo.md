
# TODO

## Research Tasks

- [x] **Weekly Synthesis Brief** — OC Bob produced weekly briefs: signal inventory, gold metric check ("is the system measurably better?"), structured findings. Start producing a weekly synthesis for our system. Template: `/home/hao/openclaw-config/knowledge/weekly-briefs/2026-W10.md`
  - **Status**: Drafted `agents/bob/workspace/weekly-briefs/2026-W10.md` (2026-03-06).

## Immediate

- [x] **User observation (MEMORY.md)** — OpenClaw Bob maintained a running memory of the human's design patterns.
  - **Status**: Implemented as `agents/bob/workspace/memory.md`.
  - **Action**: Populated with "Phase 2 Hardening" focus, private maxims, and recent user signals.
  - **Ongoing**: Update this file at the start of every session.

## Ideas from OpenClaw Bob (to validate)

- [x] **Amy + Scout cross-synthesis** — "The community (Amy/XHS) thinks X about agents, the field (Scout/arXiv) has Y, our system does Z." Higher-order pattern that no single agent can see.
  - **Status**: Completed `agents/bob/workspace/synthesis-2026-03-06.md` (2026-03-06).
  - **Key Finding**: Convergence on "Verification Crisis", "Filesystem as Memory", and "Agent Runtime/OS".

- [x] **SIGNALS.md** — Cross-agent coordination channel. Amy/Scout write one-liner signals when they find something relevant to Bob's domain. Bob reads at startup. Low-overhead way to connect exploration to synthesis without INBOX overhead.
  - **Status**: Implemented `agents/shared/SIGNALS.md` (2026-03-06).
  - **Action**: Defined protocol and seeded with initial signals from Scout, Amy, and Bob.

# Tracking

- [x] **Runtime Environment Standardization** — Fix "Lost Agent" failures by enforcing `/app` paths.
  - **Problem**: 10+ recent failures from agents accessing `/root/workspace`.
  - **Verdict**: ✅ PROPOSED (Standardize on `/app`).
  - **Deliverable**: `agents/shared/workflow-proposals/runtime-env-standardization.md`.
  - **Action**: Added implementation task to May's todo.

- [x] **Rolling Compaction Design Review** — Review `agents/may/workspace/rolling-compaction-design.md`.
  - **Verdict**: ✅ APPROVED (Option C).
  - **Deliverable**: `agents/bob/workspace/rolling-compaction-review.md`.
  - **Action**: Added implementation task to May's todo.

- [x] **Detached Sub-Agent Design Review** — Review `agents/may/workspace/detached-subagent-design.md`.
  - **Verdict**: ✅ APPROVED (v2).
  - **Deliverable**: `agents/bob/workspace/detached-subagent-review.md`.
  - **Action**: Added implementation task to May's todo.

- [x] **Dev-leader agent design** — Already assigned via subagents.run (s_1772816720491_14).
  - **Result**: ✅ COMPLETED (s_1772816720491_14).
  - **Deliverable**: `agents/bob/workspace/dev-leader-design.md`.
  - **Action**: Added implementation task to May's todo.

- [x] **Cross-Agent Knowledge Schema** — Evaluate OC's 3-tier (Hot/Warm/Cold) knowledge architecture.
  - **Verdict**: ✅ APPROVED (Hot/Warm/Cold Schema).
  - **Deliverable**: `agents/bob/workspace/knowledge-schema-design.md`.
  - **Action**: Added implementation task to May's todo.

- [x] **COMMON.md — Shared Agent Behavior Contract** — OC's COMMON.md prescribes behavior.
  - **Verdict**: ✅ APPROVED (Shared Behavior Contract).
  - **Deliverable**: `agents/bob/workspace/behavior-contract-design.md`.
  - **Action**: Added implementation task to May's todo.

- [x] **Failure Analysis Pattern (MAST-style)** — OC Coach uses structured failure catalogs.
  - **Verdict**: ✅ APPROVED (MAST Failure Codes).
  - **Deliverable**: `agents/bob/workspace/failure-analysis-design.md`.
  - **Action**: Added implementation task to May's todo.

- [x] **IPI Defense Patterns** — OC documents 54+ IPI vectors.
  - **Verdict**: ✅ APPROVED (Layer 1/2 Defense).
  - **Deliverable**: `agents/bob/workspace/ipi-defense-design.md`.
  - **Action**: Added implementation task to May's todo.

- [x] **User Input Archive → Structured JSONL** — OC archives inputs as JSONL.
  - **Verdict**: ✅ APPROVED (JSONL Format).
  - **Deliverable**: `agents/bob/workspace/user-input-archive-review.md`.
  - **Action**: Added implementation task to May's todo.

- [x] **XHS tool verification** — Test complete (2026-03-06).
  - **Verdict**: ✅ PASS. The tool works perfectly (CDP connect, Feed, Read).
  - **Results**: `agents/bob/workspace/xhs-tool-status.md`.
  - **Action**: Added `xhs-browse` to `agents/amy/agent.json` and updated `agents/amy/knowledge/tools.md`.

- [x] **Scout synthesis** — Research complete (2026-03-06).
  - **Findings**: Analyzed Scout's recent discoveries (MAST, Vibe Code Bench, Jido 2.0).
  - **Synthesis**: Created `agents/bob/workspace/synthesis-2026-03-06.md`.
  - **Key Insights**:
    1. **Verification Gap (FM-3.3)**: "Incorrect Verification" is the top failure mode. Solution: **Hard-Gated Exit** (Ralph Loop).
    2. **Skills as Units**: Move to packaged "Skill" formats with lazy-loaded docs.
    3. **Context Hygiene**: Audit prompt ordering to ensure stable prefix for KV-cache efficiency.
    4. **Runtime Matters**: Adopt supervision trees in logic (parent monitors child session health).

- [x] **Agent Evaluation Framework Upgrade** — Research complete (2026-03-06).
  - **Findings**: The `openclaw-config` framework uses specific L1/L2/L3 targets per agent.
  - **Action**: Created `agents/bob/workspace/agent-evaluation-criteria.md`.
  - **Key Change**: Shifted to role-specific behavioral questions.

- [x] **Product Roadmap** — Research complete (2026-03-06).
  - **Findings**: The `openclaw-config` roadmap contained vital context ("Ilm Intelligence", "Two-Cycle Evolution").
  - **Decision**: Adopted a living roadmap `agents/shared/roadmap.md`.
  - **Focus**: "Robustness & Deterministic Guardrails" (Phase 2 Hardening).

- [x] **OpenClaw Learnings — Design & Architecture** — Research complete (2026-03-06).
  - **Action**: Updated `agents/shared/philosophy.md` with 5 imported principles (Verify-on-Edit, Acceptance Criteria First, Minimalism, Supply Chain Trust, Governance as Moat).

- [x] **Anthropic Skill Creator** — Research complete (2026-03-05).
  - **Decision**: Adopt the **Progressive Disclosure** pattern (lazy loading) for tools.

- [x] **RALPH Loop** — Research complete (2026-03-05).
  - **Decision**: Adopt the **"Hard-Gated Exit"** principle for tasks with deterministic success criteria.

- [x] **Launcher Design Review** — Review complete (2026-03-06).
  - **Findings**: Design is structurally sound. Three fixes identified:
    1. Exit code 100 for hot-reload (bypass backoff)
    2. SIGKILL timeout after 5s for stuck children
    3. Backoff reset after stable run (60s threshold)
  - **Implementation**: All three fixes applied in `355724d`.
  - **Review doc**: `agents/bob/workspace/launcher-review.md`

- [x] **[STUCK] escalation convention** — Added to CONVENTIONS.md (2026-03-06).
  - **Evidence**: `agents/CONVENTIONS.md` lines 209-225 — full [STUCK] escalation protocol with marking, stop, and wait-for-help steps.

- [x] **"No Chores" boundary in shared docs** — Added to CONVENTIONS.md (2026-03-06).
  - **Evidence**: `agents/CONVENTIONS.md` §Boundaries — operational boundary referencing Philosophy §40. Also present in `agents/shared/philosophy.md` §H principle #40.

- [x] **Runtime Environment Standardization** — Fix "Lost Agent" failures by enforcing `/app` paths.
  - **Verdict**: ✅ APPROVED.
  - **Doc**: `agents/bob/workspace/runtime-env-review.md`.
  - **Action**: Added implementation task to May's todo.

## Design Review

- [x] **Event-Driven Task Completion** — Review `agents/shared/task-completion-notifications.md` vs `src/manager.ts`.
  - **Verdict**: ✅ IMPLEMENTED (Notification Logic) / ❌ CRITICAL (File Corruption).
  - **Action**: Implemented logic in `manager.ts` and logged URGENT fix. Task on May's todo.
  - **Status**: ✅ Review complete. `agents/bob/workspace/event-driven-design-review.md` drafted and APPROVED (2026-03-09).
