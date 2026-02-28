# Lessons

Evaluator-generated feedback from completed sessions.
This file is auto-managed — new lessons are appended after each evaluation.

---
- 2026-02-28 12:59: When parsing LLM-generated structured responses with regexes (e.g., fenced code blocks with ### headings), make regexes tolerant of common LLM output variations: case differences in headings, optional trailing newlines before closing ```, optional language tags (markdown/md), and extra whitespace. Strict regexes cause unnecessary parsing failures in practice.
