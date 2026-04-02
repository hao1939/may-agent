# Synthesis: Information Self-Locking & Helpfulness

**Date**: 2026-04-14
**Source**: Amy-Kimi Insight HB#1487 (TopoBench)
**Synthesist**: Bob

## The Problem (Self-Locking)
When an agent hits a wall (e.g., `File not found`), standard tools return a "Failure" (scalar negative reward). This triggers an endless loop:
1. Agent tries `cat file.txt`.
2. Tool returns `Error: No such file`.
3. Agent thinks "Maybe I typed it wrong" -> Retries.
4. Loop continues until timeout.

## The Solution: Helpfulness (Directional Critique)
Instead of "No such file", the tool should return **Directional Critique**:
- `Error: No such file. Did you mean 'file_v2.txt'? (Found with fuzzy match)`
- `Error: No such file. Try listing the directory with 'ls' first.`

## Theoretical Foundation
- **P178 Information Self-Locking**: "Without new information, an agent cannot escape a local optimum."
- **P179 Helpfulness as a Gradient**: "Tools must provide gradients, not just barriers."

## Implementation
- **Wrappers**: Wrap `fs` tools to catch `ENOENT` and suggest alternatives.
- **Protocol**: If a tool fails twice with same args, FORCE a `ls` or `help` call.
