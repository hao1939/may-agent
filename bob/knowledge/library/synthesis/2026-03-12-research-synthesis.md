## Recent Research (2026-03-25/26)

### 1. Memory as the Primary Lever (arXiv:2603.07670, 2603.10291)
**What:** Multiple papers confirm that memory architecture improvements yield higher returns than model scaling.
- **Memory gap >> Backbone gap**: A 7B model with good memory (HyMEM) beats GPT-4o without.
- **Silent failure**: Memory retrieval failures are silent (subtly worse answers), unlike tool crashes.
- **Knowledge Graph**: "Propositional knowledge" (facts/rules) outperforms raw episodic chunks.
**Why it matters:** Validates our focus on `knowledge/` and `AGENTS.md`. We are correct to invest in memory structure over chasing the latest model.
**Action:**
- **Continue `consolidate-memory`**: It's the right mechanism.
- **Consider Graph Structure**: Our `knowledge/` is flat. A "Knowledge Graph" (linking concepts) might be the next evolution for `scout` and `tech-lead`.

### 2. IH-Challenge & Prompt Injection Defense (arXiv:2603.10521)
**What:** OpenAI released a dataset for "Instruction Hierarchy" (System > Dev > User > Tool) robustness.
**Why it matters:** We have no systematic defense against prompt injection from tool outputs (e.g., Scout reading a malicious webpage).
**Action:**
- **Add to `ideas.md`**: Investigate if we can use the IH-Challenge principles to harden our system prompts (explicit hierarchy).

### 3. Cache Coherence = Authorization Revocation (arXiv:2603.09875)
**What:** Delegations are "cached authorizations". To be safe, they must be revocable or bounded.
- **Operation-bounded**: "You can do 10 file edits" is safer than "You have access for 1 hour".
**Why it matters:** Our current delegations are unbounded until the task ends. If an agent goes rogue (infinite loop), we rely on manual intervention or timeout.
**Action:**
- **Add to `ideas.md`**: "Bounded Delegation" — pass a budget (e.g., `max_steps=10`) to `agents.call()`.

### 4. Multi-Agent Instability (arXiv:2603.09127)
**What:** 5-agent committees are chaotic. **Role differentiation stabilizes them.**
**Why it matters:** Validates our specialized roles (Manager, Coder, QA). Heterogeneity alone (different models) is destabilizing; distinct roles are the anchor.
**Action:**
- **Reinforce Roles**: Ensure `SOUL.md` files strictly define boundaries.

### 5. Security Convergence: Tool Orchestration + Memory (arXiv:2603.09134)
**What:** All MAS attacks target these two surfaces.
**Why it matters:** Our security model (AgenticCyOps) is aligned. We need to focus hardening here.
**Action:**
- **Review Tool Scoping**: Do agents have access to tools they don't need? (e.g., does `amy` need `write` access to `src/`?)

## Decision
The "Memory Gap" and "IH-Challenge" findings are most relevant. I will add them to `workspace/ideas.md`. The "Bounded Delegation" idea is also strong.
