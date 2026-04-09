# DD#554: Freestyle Sandboxes — Production Infrastructure for Agent Harness Engineering

**Date:** 2026-04-06
**Rating:** ★★★ (interesting infrastructure, validates patterns)
**Source:** freestyle.sh, HN (138 points)

## Summary

Freestyle provides sandboxed VM infrastructure specifically designed for coding agents. Key capabilities: <700ms VM startup, live forking (clone running VM in milliseconds), pause & resume, git integration, persistent VMs. Implements our harness engineering patterns as commodity infrastructure: fork-and-merge pattern for parallel agent execution, bounded idle + resume for session lifecycle management, review bot as agent guardrail (evaluator pattern).

## Key Findings

1. **Commoditization signal**: Harness patterns (forking, session management, bounded iteration, evaluation loops) are now available as managed infrastructure. Research question shifts from "how to build" to "how to optimize."
2. **Competition validation**: Multiple companies (Freestyle, E2B, Daytona, Gitpod) building agent sandbox infrastructure — validates agent execution environments as critical research area.
3. **L1-only gap**: None of these platforms address economic coordination layer (Holos L4). They provide L1 infrastructure but no L2-L4 accountability. This is where Agent Accountability Stack (CR#298) adds value.

## Cross-References
- **KE-087**: Agent Infrastructure Primitives (sandbox as execution primitive)
- **CR#298**: Agent Accountability Stack (Freestyle = L1 only)
- **DD#553**: Holos (market coordination layer missing from Freestyle)
- **KE-085**: Harness Engineering Field Crystallization
