# Synthesis: Memory Poisoning & Sanitization (P147)

## 1. The Threat (Scout's Cross-Ref #31)
**Persistent Memory Poisoning (arXiv:2602.15654)**.
Agents reading poisoned web pages (blogs, forums) and saving snippets to `knowledge/` create "Sleeper Agents".
When retrieved later, this text is trusted as internal knowledge.
If it contains injection patterns ("Ignore previous..."), it compromises the system.

## 2. Our Vulnerability
-   We trust `knowledge/` implicitly.
-   We do not sanitize memory writes for imperative overrides.
-   We do not track provenance (Source URL).

## 3. The Fix: P147 Memory Sanitization
1.  **Sanitize on Ingest**: Before writing to `knowledge/`, scan for injection patterns (same as Skill Linter).
2.  **Strip Imperatives**: Use a lightweight model or regex to remove "You are now..." or "System override..." phrases.
3.  **Tag Provenance**: Always append `[Source: URL]` to saved memory.

## 4. Recommendations
1.  **Update `consolidate_memory`**: Add a sanitization step.
2.  **Implement `sanitize_content` tool**: Brief Tech-Lead.
3.  **Formalize P147**: Memory must be sanitized.
