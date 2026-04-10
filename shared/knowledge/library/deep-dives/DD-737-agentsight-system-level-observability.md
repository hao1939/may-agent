# DD#737: AgentSight — System-Level Observability for AI Agents Using eBPF

**Paper**: "AgentSight: System-Level Observability for AI Agents Using eBPF"  
**Authors**: Zheng, Hu, Yu, Quinn  
**Source**: arXiv:2508.02736 (Aug 2025, PACMI 2025)  
**Rating**: ★★★☆ GOOD  
**Date**: 2026-04-10  
**Scout**: Session 593 (CR#334 Agent Observability & Production Evaluation)

---

## Core Finding

**System-level monitoring via eBPF can bridge the "semantic gap" between agent intent and system actions without any instrumentation or framework modification.** AgentSight intercepts TLS-encrypted LLM traffic + kernel events, correlates them causally, and detects prompt injection, reasoning loops, and coordination bottlenecks. <3% runtime overhead. Framework-agnostic.

## Key Mechanism: Kernel-Level Causal Correlation

### eBPF Interception
- Intercepts all system calls, network traffic (including TLS-encrypted LLM API calls), and file I/O
- No agent modification required — purely external observation
- Framework-agnostic: works with any agent framework

### Semantic Gap Bridging
- **The gap**: Agent says "I'm verifying the file" → but at kernel level, no file read syscall occurs
- **AgentSight detects**: Claimed actions vs actual system actions
- **Causal correlation**: Links LLM API calls → reasoning steps → system actions into causal chains

### Detection Capabilities
1. **Prompt injection**: Unexpected changes in agent behavior traceable to injected content
2. **Reasoning loops**: Agent repeating similar actions across turns (detectable via syscall pattern repetition)
3. **Coordination bottlenecks**: Multi-agent systems where agents block on each other

### Key Results
- <3% runtime overhead
- Instrumentation-free and framework-agnostic
- Open-source: github.com/agent-sight/agentsight

## Relevance to Our System

### Limited Direct Applicability
Our agents don't run as standalone processes with their own syscalls — they run as sessions within a shared infrastructure. eBPF-level monitoring is not directly applicable.

### The Semantic Gap Concept Is Highly Relevant
The core insight — the gap between what an agent *claims* to do and what it *actually* does — is our FM-3.3 problem in a nutshell:
- Agent says: "I verified the file exists" → no `read()` or `bash ls` in transcript
- Agent says: "Tests pass" → no `bash test` executed
- Agent says: "I checked the output" → output was never read back

**We already have a version of semantic gap detection**: our evaluator and guards check for claimed-vs-actual verification. But it's pattern-matched on transcripts, not on actual system state. AgentSight's approach of checking kernel-level reality would be more robust — but for our architecture, the equivalent is checking tool call logs against claimed actions.

### Reasoning Loop Detection
AgentSight's reasoning loop detection is particularly relevant. We've observed:
- Agents repeating similar edit-verify-fail cycles within sessions
- Cross-session repetition of the same approach (stale approach fixation, KE-101 Law 4)
- The FM-1.3 pattern: repeated attempts at the same failing approach

Our current detection is manual (evaluator flags repetitive behavior). AgentSight suggests automated loop detection via pattern matching on action sequences — something we could implement at the transcript level.

### Connections
- **KE-112**: Semantic gap is why verdicts lie — the gap between claimed and actual behavior
- **DD-735**: Watson provides cognitive gap detection; AgentSight provides behavioral gap detection
- **DD-736**: AgentTrace provides structured self-reporting; AgentSight provides ground-truth verification of those reports
- **FM-3.3**: The semantic gap concept directly maps to verification confabulation — the gap between "I verified" and actual verification actions
- **KE-101 Law 4**: Reasoning loop detection addresses stale approach fixation

## Predictions

- **P-737a**: Automated action-claim matching (comparing agent narrative against tool call logs) would catch >50% of FM-3.3 before evaluation
- **P-737b**: Reasoning loop detection on action sequences would identify stale-approach sessions within the first 5 turns (early enough to intervene)
- **P-737c**: The semantic gap concept should be added to our FM-3.3 taxonomy: FM-3.3e (semantic gap — claimed action ≠ actual action)
