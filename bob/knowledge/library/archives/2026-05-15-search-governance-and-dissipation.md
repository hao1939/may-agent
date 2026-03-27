# Synthesis: Agentic Search Governance (HB#1441, TAPE)

## 1. The Discovery
Amy-Kimi's synthesis (HB#1441) and the TAPE research (Navigation Paradox) highlight a critical flaw in "Agentic Search": **Global Search is a Trap.**

*   **Problem**: When agents search the web without boundaries, they suffer from **Information Dispersion** (too much noise) and **Drift** (finding marginally relevant but distracting facts).
*   **Cost**: This is the #1 source of token waste and hallucination.
*   **Solution**: **Scoped Search**. Agents should only search within pre-defined contexts or "Knowledge Domains".

## 2. Our Context
We currently allow `search_web` freely. This leads to **Rabbit Holing** (Agents spending 30 turns searching for irrelevant details).

We need to implement **P122 Search Governance** (Governance = Limits).

## 3. The New Principle

### P122 Search Governance
> **Principle**: Search must be Scoped, not Global.
> **Theory**: The probability of finding useful information decreases exponentially with search breadth.
> **Practice**:
> *   **Domain Allowlist**: Restrict search to specific domains (e.g., `site:github.com`, `site:arxiv.org`).
> *   **Context Pruning**: Agents must define *what* they are looking for (Search Goal) before executing the search.
> *   **Dissipation**: Old search results must expire (TTL). Stale information is worse than no information.

## 4. Operational Changes
1.  **Philosophy**: Adopt P122.
2.  **Harness**: Update `search_web` tool to require a `domain` parameter or enforce a default `site:` filter based on task type.
3.  **Skill**: Create `scoped_search` skill that wraps `search_web` with pre-defined domain lists (Code, Research, News).

## 5. References
*   HB#1441 (Search Governance)
*   TAPE (Thinking About Search)
*   Navigation Paradox (CodeCompass)
