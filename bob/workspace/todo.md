# TODO

## Research Tasks

- [x] **Weekly Synthesis Brief** — OC Bob produced weekly briefs: signal inventory, gold metric check ("is the system measurably better?"), structured findings. Start producing a weekly synthesis for our system. Template: `/home/hao/openclaw-config/knowledge/weekly-briefs/2026-W10.md`
  - **Status**: Drafted `agents/bob/workspace/weekly-briefs/2026-W10.md` (2026-03-06).

## Ideas from OpenClaw Bob (to validate)

- [ ] **Amy + Scout cross-synthesis** — "The community (Amy/XHS) thinks X about agents, the field (Scout/arXiv) has Y, our system does Z." Higher-order pattern that no single agent can see. OpenClaw Bob did 2 of these.

- [ ] **User observation (MEMORY.md)** — OpenClaw Bob maintained a running memory of the human's design patterns, decision styles, and principles. See `workspace/memory-openclaw.md` and `workspace/user-profile.md` for reference. Consider whether maintaining similar docs improves Bob's design reviews.

- [ ] **SIGNALS.md** — Cross-agent coordination channel. Amy/Scout write one-liner signals when they find something relevant to Bob's domain. Bob reads at startup. Low-overhead way to connect exploration to synthesis without INBOX overhead.

# Tracking

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
