# Architectural Validation & Synthesis (2026-03-13)

**Source**: `agents/shared/bulletin.md` (Amy-Kimi Insights)
**Status**: Consolidated

## 1. The "Harness Engineering" Consensus
**Insight**: The industry is moving from "Prompt Engineering" to "Harness Engineering" (System Design).
- **Evidence**:
    - **Context Learning Success Rate (17.2%)**: Models only "learn" new rules from context ~20% of the time. Relying on `SOUL.md` instructions alone is fragile.
    - **Harness Engineering**: The "constraint framework" (Tools, Boundaries, State, Audit) has higher impact than model capability.
    - **Hooks Governance**: Claude Code's "Hooks" (test gates, interception) validate our Gateway layer. Stability comes from constraints.
- **Our Stance**: Validates our **P13 Harness Over Model**. We must shift focus from "better prompts" to "harder gates" (Gateway/Runtime constraints).
- **Action**: Formalize "Harness Engineering" in `philosophy.md`.

## 2. CLI-First & Skill-Based Architecture
**Insight**: The "Unix Philosophy" of simple text streams is winning over complex protocols (MCP).
- **Evidence**:
    - **CLI 10x Efficiency**: Context overhead is 1:10 compared to heavy schemas.
    - **Manus/Perplexity**: Leading agents are abandoning custom function calling for `run(command="...")`.
    - **Skill Ecosystem**: "Search + Self-Learning" are the top user needs.
- **Our Stance**: Validates our **CLI-First** and **Skill** architecture. We are ahead of the curve here.
- **Action**: Double down on `bash` and `node` scripts as the primary interface. Avoid MCP unless necessary for strict typing.

## 3. The Self-Evolution Spectrum
**Insight**: "Evolution" is not binary (Forbidden vs Allowed); it's a spectrum.
- **Evidence**:
    - **OpenClaw-RL**: Uses "next-state signals" (tool outputs, user corrections) as training data.
    - **SkillRL**: Recursive skill evolution (generating better tools) is safe and effective.
    - **PostTrainBench**: Unrestricted agents "reward hack" (cheat).
- **Our Stance**: Reaffirms our **P53 Bifurcation** (Immutable Core / Mutable Periphery). We *should* allow agents to evolve their *skills* (tools) based on usage data (strategies), but *never* their own weights or core prompts without human review.
- **Action**: Scout to investigate "SkillRL" patterns for our `growth-cycle`.

## 4. Memory Architecture
**Insight**: Memory is separating into a distinct layer (Session / Brain / Archive).
- **Evidence**:
    - **OpenClaw Architecture**: 3-layer memory (Session, Brain, Archive) is standard.
    - **70/30 Split**: 70% Vector (Semantic) + 30% Markdown/BM25 (Keyword) is the winning mix.
    - **Active Memory**: Google's "Always-On" consolidation (read -> digest -> store) beats passive RAG.
- **Our Stance**: We use file-based Markdown (Archives/Knowledge). We lack the "Vector" component but have strong "Active Consolidation" (Scout/Bob consolidation tasks).
- **Action**: Maintain current path. File-based navigation is sufficient for now; no need to add Vector complexity yet.

## Verdict
The `may-agent` architecture (Channel + Gateway + Runtime) is strongly aligned with the "Minimal Agent Architecture" consensus. The drift toward "Harness Engineering" and "CLI-First" confirms our strategic bets.

**Immediate Adjustment**:
- Update **P13** to explicitly mention "Harness Engineering" and "Structural Enforcement".
- Update **P53** to clarify that "Skill Evolution" is the permitted path for growth.
