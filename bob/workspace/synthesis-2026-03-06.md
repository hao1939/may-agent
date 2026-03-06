# Synthesis: Agent Ecology & Engineering Patterns (2026-03-06)

**Source:** Scout Discoveries (2026-02-25 to 2026-03-06)
**Analyst:** Bob
**Status:** Verified & Actionable

This synthesis cross-references recent external findings (Scout) with our internal design trajectory to identify confirmations, gaps, and new opportunities.

## 1. The Verification Gap is the Primary Bottleneck
**External Signal:**
- **MAST Taxonomy (IBM/Berkeley):** The most common fatal failure for high-capability models (Gemini-3-Flash) is **FM-3.3 Incorrect Verification** ("declaring victory prematurely").
- **Vibe Code Bench:** The strongest predictor of success (r=0.72) is **self-testing during generation**. Models that write tests first, win.
- **Ralph Loop (Research):** Hard-gated exit (cannot finish until external tool says PASS) is the solution to "LGTM" hallucinations.

**Our System State:**
- We rely heavily on "QA" as a separate agent to verify.
- We do not *force* Coder to run tests before handing off. Coder often says "I have updated the code" without running verification.

**Design Implication:**
- **Shift verification left.** Verification isn't just for QA; it must be part of the Coder's *inner loop*.
- **Adoption:** The **"Hard-Gated Exit"** (Ralph Loop) is not just a cool idea; it's the industry-standard fix for the FM-3.3 failure mode. We must enforce this structurally.

## 2. "Skills" Are Becoming a Standardized Unit of Distribution
**External Signal:**
- **HuggingFace/skills:** A standardized format for packaging tool-use capabilities. "Install a skill" -> Agent gets metadata -> Agent lazy-loads implementation.
- **Anthropic Skill Creator:** Uses `SKILL.md` with progressive disclosure.
- **Claude Agent SDK:** Tools are defined as data, passed to the `query` loop.

**Our System State:**
- We have `tools/` (TypeScript files) and `knowledge/` (Markdown files).
- We manually inject tool definitions into system prompts.
- We lack a "package manager" mindset for capabilities.

**Design Implication:**
- **Adopt the Skill Pattern.** A "Skill" = Tool Code + Usage Docs + Examples, packaged together.
- **Lazy Loading:** We should not dump all tool docs into the context. We should inject *signatures* and let the agent request *manuals*. This saves tokens and improves focus (Manus Context Engineering).

## 3. Context Hygiene is Operational Criticality
**External Signal:**
- **Manus Engineering Blog:** KV-cache hit rate is the #1 metric for cost/latency. **Stable Prefix** is non-negotiable. A timestamp at the top of the prompt invalidates the entire cache.
- **MAST Taxonomy:** **FM-1.4 Memory Loss** is a fatal failure mode for cascading models.

**Our System State:**
- We use `domain.md` and `lessons.md` which are relatively stable.
- **Risk:** If we inject the current time/date *before* the heavy knowledge files in the system prompt, we are burning money and latency.

**Design Implication:**
- **Audit System Prompt Structure.** Ensure volatile data (timestamps, session IDs, recent messages) comes *after* static data (role definition, core knowledge, tool definitions).
- **Filesystem as Memory:** Continue this. It aligns with the industry trend of offloading context to retrieval/storage (Jido 2.0).

## 4. Runtime Matters (The "BEAM" Argument)
**External Signal:**
- **Jido 2.0:** Elixir/BEAM is the ideal runtime because of fault tolerance and supervision trees. "Let it crash" works if you have a supervisor.
- **MAST:** "Fatal" failures often involve crashing or hanging without recovery.

**Our System State:**
- We run on Node.js/TypeScript.
- We have `May` as a supervisor, but it's an *LLM* supervisor, not a *runtime* supervisor.
- We have `restart-may.sh` for process crashes, but internal agent logic crashes (loops) are handled by timeout.

**Design Implication:**
- **Supervision Trees in Logic.** We cannot switch to Erlang, but we can adopt the **Supervision Pattern**. Every agent session is a child process; the parent monitors it. If the child gets stuck (timeout) or hallucinates (loop), the parent kills and restarts it with a "corrected" state. This is exactly what our `evaluator -> optimizer` loop is trying to do at a macro level.

## Recommendations for Optimizer

1.  **Enforce Test-Driven Coder:** Update Coder's system prompt or toolset to *require* a successful test run (or at least a compile check) before the `finish` tool can be called. (Anti-FM-3.3).
2.  **Audit Prompt Ordering:** Check `agent-loader.ts` or `system-prompt.ts`. Ensure `Date.now()` or equivalent is injected at the very end of the prompt construction, not the beginning.
3.  **Skill Refactoring:** Experiment with converting one complex domain (e.g., "Git Operations") into a "Skill" format (lazy-loaded docs) to see if it improves adherence.
