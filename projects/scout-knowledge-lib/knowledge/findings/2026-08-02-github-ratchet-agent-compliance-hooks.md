# Ratchet — PostToolUse Hooks for Agent Rule Compliance

Date: 2026-08-02
Source: GitHub
Repo: https://github.com/0xwilliamortiz/ratchet
Signal_Strength: moderate
Tags: agent-governance, coding-agents, hooks, compliance, minimalism

## Summary

Ratchet (410★, MIT, JavaScript) closes the open loop in agent coding rulesets.
Instead of trusting the model to follow system-prompt rules ("prefer stdlib,
keep diffs small, no unnecessary deps"), Ratchet installs a `PostToolUse` hook
that measures every edit the agent makes *during the session* and reports
violations back before the agent moves on.

## Key Design Choices

- **Ratchet metaphor**: complexity can only go down or stay flat; increases
  require explicit written justification.
- **PostToolUse hook**: fires after each tool call, runs static analysis on the
  diff, and injects findings back into the agent's context window.
- **Baseline acceptance**: existing code is accepted as-is on first run; only
  new violations fire, avoiding alert fatigue.
- **Categories**: `dep` (new dependency), `native` (platform alternative
  exists), `wrapper` (unnecessary abstraction layer), with certainty levels.
- **Zero-config**: `ratchet` in a repo dir registers hooks, sets baseline, and
  opens a monitoring UI.

## Why It Matters

Most agent coding setups treat rules as aspirational — injected via system
prompt with no enforcement. Ratchet is the clearest example yet of
**closed-loop agent governance**: measure → report → correct, all within one
session. The hook-based pattern generalises beyond minimalism to any
measurable code quality constraint.

## Scout Assessment

Validates the pattern that agent quality control is moving from prompt-level
guidance to tool-level enforcement. Related to the broader "agent guardrails"
theme. The PostToolUse hook architecture could apply to security policies,
style enforcement, or cost budgets — anywhere you want runtime verification
rather than prompt-level trust.
