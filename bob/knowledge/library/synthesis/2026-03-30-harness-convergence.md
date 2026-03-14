# Architectural Validation (2026-03-30)

## Evidence
- **Scout's Discoveries**: `agents/scout/knowledge/library/discoveries.md` (2026-02-24 to 2026-02-25 entries)
- **LangChain/Manus**: "Filesystems for Context Engineering" (FS as memory).
- **MAST Taxonomy**: 14 failure modes (verification gaps, looping).
- **HuggingFace/skills**: "Skills as npm packages" (converges with our `agents/*/skills/` structure).
- **StateLM**: Models managing their own context (pruning/indexing).
- **MCP SEP-1686**: "Call-now, fetch-later" for long-running tools.

## Analysis

### 1. Harness Engineering is the Moat (P13 Validation)
The industry is converging on **Harness Engineering** as the primary differentiator.
- **Anthropic**: "Building Effective Agents" → simple workflows, no frameworks.
- **LangChain**: "Filesystems for Context Engineering" → file-based memory is the standard.
- **Manus**: "KV-cache hit rate is the #1 production metric" → append-only context, stable prefix.
- **Our System**: Our `tools/read|write` + `agents/*/skills/` + `filesystem-as-memory` architecture is exactly what the leaders are building. We are ahead of the curve by treating the filesystem as the primary context layer (P72).

### 2. Failure Mode Taxonomy (MAST)
The **MAST Taxonomy** (IBM/Berkeley) gives us a language for our failures:
- **FM-1.3 Step Repetition**: What we call "Loops" (Wink pattern catches this).
- **FM-2.6 Reasoning-Action Mismatch**: "Says one thing, does another."
- **FM-3.3 Incorrect Verification**: "Declaring victory early." (Common in Gemini).
- **Action**: We should adopt these codes in our `evaluator` and `coach` feedback. Instead of "Needs Improvement", use "FM-3.3".

### 3. Skill-as-Software (P89 Validation)
The **HuggingFace/skills** and **Skill-Inject** papers confirm that skills are becoming software artifacts:
- **HF**: "Skills as distributable packages" (npm for agents).
- **Skill-Inject**: Skills are an attack vector (supply chain).
- **Our System**: We recently standardized `agents/shared/skills/` with versioning (YAML frontmatter). This aligns with the "skills as packages" trend. We must double down on **Skill Security** (P84) — forbidding dynamic README reading is critical (Skill-Inject confirms this).

### 4. Memory Architecture Convergence
- **StateLM**: "Models that manage their own context."
- **TierMem**: "Provenance-aware tiered memory."
- **Our System**: Our `consolidate-memory` skill (drafted) is the first step toward StateLM. We need to move from "Bob cleans up" to "Agent cleans up its own context" (P72).

## Recommendations

1. **Adopt MAST Codes**: Update `evaluator/criteria.md` to reference MAST failure modes (FM-1.3, FM-2.6, FM-3.3). This gives us precise, standard error labels.
2. **Harden Context Hygiene**: Implement the Manus "Stable Prefix" rule. Ensure our system prompt (SOUL) is static and timestamps/volatile data are appended, not prefixed. (Check `src/lib/agent-loader.ts` — do we inject time at the top?).
3. **Skill Security**: The Skill-Inject paper (80% success rate) confirms our P88/HB#247 fears. We must strictly enforce the ban on reading untrusted `README.md` files.

## Status
- **Aligned**: Our architecture (Filesystem, Skills, Harness) is validated by the latest research.
- **Action**: Verify `agent-loader.ts` for context stability (KV-cache optimization).
