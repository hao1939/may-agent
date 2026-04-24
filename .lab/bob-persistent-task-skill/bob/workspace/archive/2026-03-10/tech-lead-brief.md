# Tech Lead Brief: Refactor Agent Descriptions

## Context
Our review of arXiv:2601.12538 ("Agentic Reasoning") suggests that orchestrators (like May) perform better when sub-agent descriptions are structured and capability-focused (EASYTOOL style), rather than just vague prose.

## Task
Refactor the **Feature Team** and **Meta Team** tables in `agents/shared/system-design.md`.

## Requirements
1.  **Structure the descriptions** to explicitly include:
    *   **Capabilities**: Key verbs (e.g., "Implement code", "Review docs", "Scrape XHS").
    *   **Input**: What it expects (e.g., "Feature spec", "URL", "Topic").
    *   **Output**: What it returns (e.g., "Modified files", "Markdown report").
    *   **Constraint**: Specific limitations (e.g., "Cannot commit", "Read-only").
2.  **Format**: You can keep the Markdown table if it stays readable, or switch to a structured list if the content becomes too dense for a table cell.
3.  **Source of Truth**: Use the current `agents/shared/system-design.md` content as the base truth. Do not invent new capabilities; just clarify the existing ones.

## Goal
Make it unambiguous for May (and humans) to know exactly *who* to call for a specific task and *what* to give them.
