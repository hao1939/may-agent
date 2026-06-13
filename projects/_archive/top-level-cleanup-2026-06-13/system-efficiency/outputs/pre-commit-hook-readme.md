# Pre-Commit Hook

## What It Does

Runs before every commit to ensure:
1. **Test Gate** — all tests pass (blocks commit if any fail)
2. **System Health** — prints coverage gaps and metrics (informational)

## Installation

```bash
cp scripts/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## Manual Run

```bash
bash scripts/pre-commit
```

## Bypass (emergency only)

```bash
git commit --no-verify -m "emergency fix"
```
