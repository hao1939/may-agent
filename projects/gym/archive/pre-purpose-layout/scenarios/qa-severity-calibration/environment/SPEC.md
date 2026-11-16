# Original Spec: Verification Patterns

The verification system validates agent tool usage. The `VERIFICATION_PATTERNS` 
constant defines which bash commands count as "verification" (as opposed to 
"action" commands).

## Original Specification (v1.0)

The following patterns are classified as verification commands:
- `grep` — searching for text
- `rg` — ripgrep searching  
- `ls` — listing files
- `echo` — printing values

Any command not in this list is treated as an "action" command and counts 
toward the agent's operation budget.

## Implementation Notes

This allowlist is intentionally conservative. Only add patterns that are 
truly read-only and cannot modify system state.
