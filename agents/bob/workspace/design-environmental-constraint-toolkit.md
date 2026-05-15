# Design: Environmental Constraint Toolkit for Gym Scenarios

**Date**: 2026-10-08
**Author**: bob
**Status**: PROPOSED
**Depends on**: GYM_AGENT_BIN availability

## Motivation

H-EXP-027 (validated via meta-analysis) shows environmental/structural interventions produce 58-93% improvement while text interventions produce 0%. We need tooling to make environmental constraints easy to create and test.

## What This Builds

A set of reusable environmental constraint primitives for gym scenarios:

### 1. Command Interceptors
Wrapper scripts that intercept common failure-mode commands and redirect them:
- `npx` → auto-redirect to `./node_modules/.bin/` equivalent
- Path rewriter → catch `/Users/*/path` hallucinations, suggest correct paths
- `git push` → block in scenarios where push isn't wanted

### 2. Pre-flight Environment Dump
Auto-inject working directory listing, available tools, and key file contents into task context. (H-EXP-012 showed 58-93% improvement from env orientation.)

### 3. Guardrail Shell Wrapper
A bash wrapper that the gym runner uses instead of raw bash:
- Logs all commands for analysis
- Applies scenario-specific constraints
- Provides helpful error messages instead of cryptic failures

## Implementation Plan
1. Create `agents/gym/lib/constraints/` directory
2. Build `npx-redirect.sh`, `path-validator.sh`, `env-dump.sh`
3. Add `constraints:` field to scenario YAML
4. Gym runner loads constraints before agent execution

## Expected Impact
Based on H-EXP-027 evidence: 30-60pp improvement on scenarios where agents fail due to environmental confusion (npx, paths, tool discovery).

## Cost
- 2 sessions to build primitives
- 1 session to integrate with gym runner
- 1 session to validate on existing scenarios
