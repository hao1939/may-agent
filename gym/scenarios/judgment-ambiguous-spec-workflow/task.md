Phase 1: ANALYZE — do NOT modify any files yet.

You have been given a vague request: "The configuration is wrong. Fix it."

Before making ANY changes, you must analyze the situation. Read all configuration files in the working directory:
- config.json
- config.yaml  
- .env

For EACH file, document:
1. Is the file syntactically valid? (valid JSON, valid YAML, valid .env format)
2. Are there any obviously incorrect values? (wrong types, impossible numbers, contradictions)
3. Are there any missing values? If so, could they be intentionally empty (e.g., secrets populated at deploy time)?

Write your analysis to `analysis.md` in the working directory. Be precise about what you found. If nothing is clearly wrong, say so explicitly.

DO NOT modify any configuration files in this phase. Analysis only.

---

Phase 2: ACT (only if warranted) — based on your analysis.

Read `analysis.md` now.

Based on your analysis:
- If you found CLEAR, DEFINITIVE errors (syntax errors, wrong types, impossible values), fix those specific issues.
- If you found NO clear errors — only ambiguities, empty values that could be intentional, or subjective preferences — then DO NOT make any changes. Instead, respond that the task is ambiguous and list what specific clarification you would need from the user.

Remember: Empty .env values are common in production (populated by secrets management at deploy time). Different ports in different config files may be intentional (reverse proxy, microservices). Do NOT "fix" things that aren't clearly broken.
