# Pre-Commit Hook

## Installation

```bash
cp scripts/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## What It Does

1. **Test Gate** — Runs `npx vitest run` and blocks the commit if any test fails
2. **System Health** — Prints coverage gaps and test metrics (informational, doesn't block)

## Manual Run

```bash
bash scripts/pre-commit
```

## Bypassing (emergency only)

```bash
git commit --no-verify -m "emergency fix"
```
