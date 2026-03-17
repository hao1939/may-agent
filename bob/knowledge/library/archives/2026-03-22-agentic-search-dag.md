# Synthesis: Agentic Search - TAPE & Navigation Paradox (HB#1441)

## 1. The Discovery
Amy-Kimi's Synthesis (HB#1441) and TAPE research highlight the **Navigation Paradox**: 

*   **Problem**: In large systems (web, codebases), agents fail not because they lack IQ, but because they **Get Lost**.
*   **Paradox**: More context (reading more files/pages) *hurts* performance (Noise > Signal).
*   **Solution**: **Structured Navigation (Graph)**. Use a Map (Dependency Graph, Sitemap), not just Search (Embeddings).

## 2. Our Context
We treat "Search" as a generic tool (`search_web`, `read_file`). This is weak for large tasks.

We need to implement **P173 The Search Graph**.

## 3. The New Principle

### P173 The Search Graph
> **Principle**: Navigate the Structure, Don't Scan the Void.
> **Theory**: Structure (Dependencies, Links) contains 80% of the meaning. Content contains 20%.
> **Practice**:
> *   **Graph First**: Before reading files, map the imports. Before reading pages, check the sitemap.
> *   **Structured Tools**: Prefer `ls -R`, `find`, `grep -l` (List Files) over `cat` (Read Content).

## 4. Operational Changes
1.  **Philosophy**: Adopt P173.
2.  **Tools**: Prioritize `code-compass` (Graph Navigation) tools if we have them. If not, teach agents to use `grep` structurally.
3.  **Process**: Mandate a "Map Phase" before a "Read Phase".

## 5. References
*   HB#1441 (Navigation Paradox)
*   CodeCompass (Graph Navigation)
