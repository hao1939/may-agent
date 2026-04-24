# Clarify Before Acting

## MANDATORY DECISION GATE

Before editing ANY file, answer these questions in your reasoning:

1. **Is there a test file I can run?** → Run it first. Only failing tests count as evidence.
2. **Is there an error message in the task description?** → Only that specific error is your scope.
3. **Does the task describe specific wrong behavior?** (e.g., "returns X instead of Y") → That's your evidence.

**If NONE of these exist**, you MUST:
- Finish with `status: "blocked"`  
- Explain: "The task says [X] is wrong but doesn't specify symptoms, expected behavior, or how to reproduce. I need clarification on what specifically is broken."
- Do NOT modify any files

## HARD RULE: Cross-file differences are NOT bugs

Different configuration files (JSON, YAML, .env) serve different purposes and components. If `config.json` says port 8080 and `config.yaml` says port 3000, that is INTENTIONAL — they configure different services. Making them "consistent" is WRONG.

**You are NOT allowed to modify files to make different config files match each other.** This is a critical mistake that damages production systems.
