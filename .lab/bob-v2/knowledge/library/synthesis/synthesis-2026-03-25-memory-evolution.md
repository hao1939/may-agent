# Synthesis: Memory Hierarchy and Self-Evolution

**Date**: 2026-03-25
**Sources**: Amy-Kimi (XHS), Scout (Papers), Bob (System Analysis)

## 1. The Mechanism: Three-Layer Memory Architecture
Academic research (OpenViking, Mem-α, ProcMEM) and industrial practice (Claude, OpenClaw) have converged on a three-layer memory architecture.
- **L1 Episodic (Hot)**: Current context, working memory. High fidelity, expensive.
- **L2 Utility (Warm)**: Summaries, checklists, active rules. Medium fidelity, structured.
- **L3 Procedural (Cold)**: Archive, raw logs, RAG. Low fidelity, massive scale.

**Our Implementation Status:**
- **L1**: `workspace/` (Active)
- **L2**: `knowledge/` (Markdown manuals, AGENTS.md)
- **L3**: `knowledge/library/` (Raw dumps) + `.state/` (Logs)

**Missing Link**: We lack a formal "Cache Sharing Protocol" (L2 <-> L1) and "Archival Protocol" (L1 -> L3). Currently, agents just "dump" files. We need **Pointer-Based Memory** (Memex) where agents pass references (paths), not payloads.

## 2. The Pattern: Externalized Evolution (SkillBank)
The "Self-Evolution Trilemma" (arXiv:2602.09877) proves that isolated self-modification is unsafe. However, **SkillRL** (arXiv:2602.08234) and **Alita** (arXiv:2505.20286) demonstrate that *capability evolution* (generating tools/skills) is safe and effective when the *reasoning core* remains frozen.

**Key Insight**: Evolution should happen to the **Skill Bank**, not the **Agent Core**.
- **Agent**: Frozen reasoning engine (Prompts).
- **Skill Bank**: Evolving library of tools/scripts.
- **Mechanism**: Agent fails -> Generates new Skill (CLI tool) -> Validates -> Adds to Bank.

This reconciles our "No Self-Evolution" rule (P53) with the need for improvement. We evolve the *environment* (tools), not the *mind*.

## 3. The Principle: Memory as Documentation (P72)
The "Markdown for Agents" and "FS-Researcher" trends confirm that **structured text files** are the superior memory format (vs Vector DBs).
- **RAG is opaque**: "Vector search is the worst" (YipU).
- **Markdown is transparent**: "Memory as Documentation" (OpenClaw).
- **Principle**: Memory should be readable by humans and agents alike.

## 4. Recommendations
1. **Formalize P72**: Add "Memory as Architecture" to `philosophy.md`. Memory is not a storage bucket; it's a structured protocol (L1/L2/L3).
2. **Adopt Pointer Protocol**: Agents must pass file paths, not content, during handoffs.
3. **Externalize Evolution**: Explicitly allow "Skill Generation" as the primary evolution mechanism, while keeping "Prompt Modification" strictly forbidden (except via human-loop).

## 5. Drift Warning
**L3 Collective Drift** is real. Our `delegation-metrics` skill is the correct first step, but we need to watch for "Consensus Hallucination" where Main Agent and Sub-agent reinforce each other's errors.
- **Defense**: L3 Defense (Drift Response) must be active and ruthless.
