---
name: sanitization
description: >
  Combined skill for sanitizing both memory/context and output content.
  Merged from sanitize-memory and sanitize-content.
version: 1.0.0
owner: shared
---

# Sanitization: Memory & Content

## Memory Sanitization

Before persisting information to memory, context files, or knowledge bases:
1. Remove session-specific details (timestamps, session IDs) unless explicitly relevant
2. Generalize findings into reusable patterns
3. Remove redundant information already captured elsewhere
4. Keep only actionable insights

## Content Sanitization

Before producing output files or reports:
1. Remove internal tool artifacts and raw command output
2. Ensure no sensitive paths or credentials are exposed
3. Structure content for the intended audience
4. Remove meta-commentary about the process (keep results, not journey)
