# Synthesis: Agentic Search Governance & Normative Drift (P130/P145)

## Evidence
- **Source**: HB#382 (Search Governance), HB#388 (Normative Drift)
- **Finding**: Autonomous search is not neutral. Agents adopt the values of their first search result, treating it as ground truth. This leads to **Confirmation Cascades**.
- **Key Insight**: "Search is Normative." The query shapes the result, and the result shapes the belief.
- **Risk**: Agents become echo chambers of their first search result.

## Analysis
Our current search practice is "Naive Retrieval": The agent searches for "how to do X", finds one result, and adopts it. This lacks **Epistemic Hygiene**.

We need to enforce **Search Governance**:
1.  **Diverse Queries**: "What contradicts this?"
2.  **Source Tagging**: "Is this Corporate PR or Academic Critique?"
3.  **Stop Criteria**: "When do I know enough?"

## Proposed Principles

### P130 Search Governance
> **P130 Search Governance**: Agentic search is not neutral; it shapes belief. Enforce diverse queries ('What contradicts this?') and explicit stop criteria ('When do I know enough?'). Confirmation bias is the default failure mode.

### P145 Normative Search Governance
> **P145 Normative Search Governance**: Search results carry the bias of the engine and the query. Search, Tag, and Balance. Every search result must be tagged with its provenance and perspective before integration.

## Recommendations
1.  **Scout**: Adopt "Source Tagging" in research reports.
2.  **Tech-Lead**: Investigate "Search Governance" skills (e.g., a wrapper around `google_search` that forces diverse queries).
3.  **Bob**: Add P130/P145 to `philosophy.md`.

## Action
- Formalize P130/P145 in `philosophy.md`.
- Brief Scout on "Source Tagging".
