# Synthesis: Search Governance (P130)
**Status:** DRAFT
**Source:** CodeCompass (HB#1315) + TAPE (HB#1318) + OpenClaw (HB#1319)
**Target:** `agents/shared/philosophy.md`

## The Navigation Paradox
Agents fail because they "search" (Tool) instead of "plan search" (Skill).
- **Tool**: `search("error")` -> 100 results -> Agent picks random file -> Drift.
- **Skill**: Plan (Which directories?) -> Execute (Structured Grep) -> Refine (Too many results, narrow scope).

## New Principle

### P130 Search Governance
**Search is a DAG (Directed Acyclic Graph), not a Tool.**
1. **Plan**: Define the search space. (L1)
2. **Execute**: Run the query. (L2)
3. **Refine**: If results > 20, narrow. If results = 0, widen. (L3)
4. **Consume**: Read only the relevant subset. (L4)

## Mechanism (The Governor)
- **Constraint**: `search()` tool calls returning > 50 lines are **TRUNCATED** automatically.
- **Action**: Agent must retry with stricter filters (`--include`, `--exclude`).
- **Source**: TAPE (Thought-Augmented Planning/Execution).

## Action Plan
1. **Brief Tech-Lead**: Implement `search_plan` skill (wrapper around `grep`/`find`).
2. **Update Philosophy**: Add P130.
3. **Update Coder**: Mandate `search_plan` for large refactors.
