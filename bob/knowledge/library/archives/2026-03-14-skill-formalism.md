# Synthesis: Skill Formalism & The CLI/MCP Hybrid
**Date:** 2026-03-14
**Sources:** HB#392 (arXiv:2603.11808), HB#415 (XHS@AI-Memo), HB#403 (Perplexity/MCP)

## 1. The Skill Quadruple (S)
Research (arXiv:2603.11808) has provided a mathematical formalism for what we intuitively built as `SKILL.md`.

**Formal Definition:** `S = (𝒞, π, 𝒯, ℛ)`

| Component | Formal Definition | OpenClaw Implementation | Status |
|-----------|-------------------|-------------------------|--------|
| **𝒞 (Conditions)** | Applicability Predicates | `trigger` / `applicability` in metadata | ✅ Implicit |
| **π (Policy)** | Executable Procedure | The Markdown content (Instructions) | ✅ Explicit |
| **𝒯 (Termination)** | Success Criteria | The "Verification" section in Skills | ⚠️ Weak |
| **ℛ (Interface)** | Action Space | The underlying Tool definitions | ✅ Explicit |

**Consolidation Action:** We should update our `SKILL.md` template to explicitly map to this quadruple. specifically strengthening **𝒯 (Termination)** criteria, which are often vague in our current skills.

## 2. The G1-G4 Security Pipeline
The same paper proposes a security pipeline that matches our "Consolidation Mode" goals.

- **G1 (Static):** Grep for dangerous patterns (we have this for P53/bash).
- **G2 (Semantic):** LLM-based intent check (we have this in `manager.ts` somewhat).
- **G3 (Sandboxing):** Containerization (we rely on `docker` for some, but not all).
- **G4 (Permission):** Allowed-list (we have L0/Constitutional).

**Gap Analysis:** We lack a systematic **G1 Static Scan** for *skills themselves*. We check *commands* at runtime, but we don't scan `agents/*/skills/*.md` for injected prompts or dangerous patterns at rest.

## 3. The CLI vs MCP Dialectic
Community debate (HB#415) and Perplexity's move (HB#403) validate our hybrid architecture.

- **The Trap:** "Everything must be an MCP server."
- **The Reality:** 
    - **CLI** = High autonomy, low latency, "escape hatch" for edge cases. Best for *Agents* (Active).
    - **MCP** = Standardized, type-safe, discoverable. Best for *Tools* (Passive).
- **Our Model:** `Skill = Context (π) + Tool (ℛ)`
    - The Skill bridges the gap. It uses the CLI for flexibility or the MCP for structure, but the *Agent* interacts with the Skill.

**Conclusion:** We are right to keep `bash` (CLI) as a primary tool for builders (Tech-Lead/Coder) while using MCP for strict integrations. We should **not** migrate core internal flows to pure MCP if it adds friction.

## Recommendations (Consolidation)
1. **Harden Skills**: Update `agents/shared/skill-template.md` to include a required `## Termination Criteria (𝒯)` section.
2. **Security**: Brief Tech-Lead to implement a "Skill Linter" (G1) that runs specifically on `agents/*/skills/*.md` to catch policy drift or prompt injections.
