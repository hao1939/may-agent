# Synthesis: Agent Skills as Context Management (Consolidation)

**Date:** 2026-03-14
**Source:** Scout Discoveries (HuggingFace/skills, Manus Blog, LangChain Filesystem Post, Step 3.5)
**Status:** DRAFT

## 1. The Convergence: Filesystem as Memory
Across the industry, "Context Engineering" has converged on a single dominant pattern: **The Filesystem**.
- **Manus (Production)**: Uses filesystem to manage context. "KV-cache hit rate is the #1 metric."
- **LangChain (Framework)**: "Filesystems for Context Engineering" — treating files as the memory layer.
- **Claude Code (Product)**: Uses `.claude/skills/` as a dynamic skill registry.
- **HuggingFace (Community)**: `huggingface/skills` provides a package manager for agent capabilities.

**Our Validation:** We are already doing this.
- `knowledge/` = Semantic Memory (World Facts)
- `workspace/` = Episodic Memory (Current Task)
- `agents/*/skills/` = Procedural Memory (Capabilities)
- `SOUL.md` = Core Identity (System Prompt)

**The Gap:** We treat skills as "static tools". The industry treats them as "dynamic packages" that are loaded/unloaded to manage context.
- **Problem:** Our agents load *all* skills into context. This hurts KV-cache and distracts the model.
- **Solution (P131):** Isolate complex skills into sub-agents or use "Load on Demand" (Context Forking).

## 2. The Rise of "Agent Skills" (Package Management)
HuggingFace's `cuda-kernels` skill demonstrates a new paradigm: **Expertise as a Package**.
- Instead of prompt engineering a generalist model, you "install" a skill (prompts + examples + specialized tools) that makes it an expert in a narrow domain.
- **Performance:** 6% end-to-end speedup in real pipelines.
- **Mechanism:** The skill is a directory of files. The agent reads it when needed.

**Our Opportunity:** We should formalize our "skills" not just as text files, but as **installable packages** (Skill + Tool + Test).
- Current: `agents/shared/skills/growth-cycle.md` (Text)
- Future: `skills/growth-cycle/` containing:
  - `README.md` (The prompt)
  - `tools/` (The code)
  - `tests/` (The verification)

## 3. Efficiency Frontier: MoE and Tabular Offloading
- **Step 3.5 Flash (11B MoE)**: Claiming frontier performance with small active params.
- **TabAgent**: Replacing LLM decisions with tabular classifiers (95% faster).
- **Implication:** We are right to use `gemini-2.0-flash` for high-volume loops (Evaluator) and `claude-3-7-sonnet` for deep reasoning. We should explore offloading "routine decisions" (like routing) to simpler heuristics or smaller models.

## 4. Recommendations
1. **Adopt "Skill as Package" Structure**: Move from `skills/*.md` to `skills/*/README.md` to bundle code and tests with the prompt.
2. **Formalize Context Loading**: Implementing "Context Forking" (P131) is the correct architectural response to "Too Many Skills".
3. **Double Down on Filesystem**: Our "Everything is a File" philosophy is now industry standard. We should optimize our tools (`read`, `grep`) to be even better at navigating this filesystem (CodeCompass "Navigation Paradox").

## 5. Next Steps
- Brief Tech-Lead to prototype a "Skill Package" structure.
- Update `philosophy.md` to explicitly cite "Filesystem as Memory" as a core tenet.
