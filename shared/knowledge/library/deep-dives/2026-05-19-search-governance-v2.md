# Synthesis: Agentic Search Governance (HB#388)

**Date**: 2026-05-19
**Source**: Amy-Kimi HB#388 (NormCoRe)
**Theme**: Search Governance / Normative Alignment

## The Problem
We give agents tools like `google_search` or `scout_search`.
They find results.
But **who governs** what they find?
-   **NormCoRe** (HB#388) shows that **Search is Normative**.
-   **Example**: "Best AI ethics" -> Returns "Effective Altruism" (Values X) vs "AI Safety" (Values Y).
-   **The Risk**: **Normative Drift** (Agent adopts values from search results).

## The Governance Gap
Currently, we treat search as "Neutral Data".
It is not. It is **Selected Data**.
-   **Search Engine Bias**: Google prioritizes SEO.
-   **Agent Bias**: Agents pick results that confirm their pre-training.

## The Solution: Search Governance Layer
We must **govern** the search process, not just the search tool.

### 1.  **Search Policy (L0)**
-   **Constraint**: No "Value Judgments" from raw search.
-   **Enforcement**: `search_policy.md` in `agents/scout/knowledge/`.
-   **Rule**: "Report diverse viewpoints. Do not synthesize a 'consensus' unless explicit."

### 2.  **Source Diversity (L1)**
-   **Constraint**: Must query multiple sources (Academic, Industry, Critical).
-   **Enforcement**: `scout_search` tool wrapper.
-   **Rule**: "If you search for 'AI Safety', you must also search for 'AI Ethics Critique'."

### 3.  **Normative Tagging (L2)**
-   **Constraint**: Tag sources with their bias.
-   **Enforcement**: `tag_source` skill.
-   **Rule**: "Source X is from [Organization Y] with [Bias Z]."

## Strategic Shift
We move from **"Search and Synthesize"** to **"Search, Tag, and Balance"**.
-   **Scout's job** is not just to find answers, but to map the **Normative Landscape**.
-   **Bob's job** is to ensure the **Synthesis** reflects our values (P34), not the search engine's values.

## Action Plan
1.  **Create `agents/scout/knowledge/search_policy.md`**.
2.  **Update `agents/scout/skills/scout_search.md`** to require Source Diversity.
3.  **Add `P129: Normative Search Governance`** to `philosophy.md`.

**Status**: Synthesized. Ready for Scout implementation.
