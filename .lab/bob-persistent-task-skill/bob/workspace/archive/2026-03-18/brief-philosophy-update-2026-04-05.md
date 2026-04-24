## Philosophy Update Proposal

### 1. Update P11 (Filesystem as Memory) to include "Stable Prefix"
**Current**:
> **File System as Memory (L1/L2 Architecture) [hao-pattern+imported]**
> The file system IS the agent's memory and context infrastructure...

**Proposed Addition**:
> **Stable Prefix (KV-Cache Optimization):**
> Context Engineering is also Cost Engineering. The first ~500 tokens of the system prompt must be **Identical** across runs to maximize KV-cache hits (10x cheaper, 5x faster).
> - **No Volatile Data**: Do not put timestamps, dynamic IDs, or "current status" in the system prompt. Move them to the user message.
> - **Append-Only**: Context should grow at the bottom. Modifying the middle breaks the cache for everything after it.

### 2. Update P13 (Harness Over Model) to include "Navigation Paradox"
**Current**:
> **Harness Over Model (P13) [imported+validated]**
> Harness Engineering > Prompt Engineering...

**Proposed Addition**:
> **The Navigation Paradox:**
> In large codebases, agents fail because they cannot *find* the relevant files, not because they cannot understand them.
> - **Solution**: Teach agents to **Navigate** (`find`, `ls -R`, dependency graph) before they **Read**.
> - **Pattern**: Explore (map the territory) → Locate (find the target) → Act (read/edit). Do not guess file paths.

### 3. Update P53 (Evolution Boundary) to align with SkillRL
**Current**:
> **The Evolution Boundary — Training vs. Deployment (P53) (Trilemma-Aware) [imported+validated]**
> ...

**Proposed Refinement**:
> **Recursive Evolution (SkillRL Pattern):**
> Evolution happens in the **Training Loop**, not the **Deployment Loop**.
> - **Training**: Analyze failures, generate new skills, validate them. (Dynamic SkillBank).
> - **Deployment**: Use the crystallized skills. (Static SkillBank).
> - **Mechanism**: The **Growth Cycle** (P51) is the implementation of Recursive Evolution.
