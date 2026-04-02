# Deep-Dive: Security Considerations for Artificial Intelligence Agents (Perplexity NIST Response)

**Paper:** arXiv:2603.12230  
**Authors:** Ninghui Li, Kaiyuan Zhang, Kyle Polley, Jerry Ma (Perplexity)  
**Date:** March 9, 2026  
**Venue:** NIST/CAISI Request for Information 2025-0035 Response  
**Rating:** ★★★★★ CRITICAL — Production-informed multi-agent security analysis from operators of millions-user agentic system

## Why This Paper Matters

This is **Perplexity's official response to NIST** on AI agent security, making it one of the most authoritative industry documents on multi-agent system security. Unlike academic papers that theorize about threats, this comes from operators who run general-purpose agentic systems (Perplexity Comet, Perplexity Computer) at massive scale. The analysis is grounded in **real security incidents** (CVE-2026-25253, CVE-2026-26327) and production architectural decisions.

## Core Thesis

AI agent systems fundamentally break three assumptions underlying traditional computer security:
1. **Code-data separation** — LLMs blur this distinction because plaintext prompts act as code, and dynamically generated text becomes prompts
2. **Predictable automation** — Agents construct workflows dynamically rather than following pre-programmed paths
3. **Security mechanism mismatch** — Existing mechanisms designed for human-speed, deterministic software don't work for agent-speed, non-deterministic behavior

## Key Contributions

### 1. CIA Triad for Agent Systems (Novel Application)

**Confidentiality Violations:**
- Agents access credentials, PII, financial data, medical records across file systems, cloud storage, email, Slack
- Data propagates through tool outputs, workspace files, memory entries, webhook responses
- Agents transfer data across systems via connectors and browser automation
- **Multi-agent amplification:** Data flows between agents through shared workspaces and memory stores

**Integrity Violations:**
- Unwanted modifications to critical systems (deleting files, installing software, modifying configs)
- Unintended transactions (sending emails, initiating financial transfers)
- Substandard or manipulated task completion (e.g., agent procures from wrong vendor due to adversarial influence)
- Presenting users with erroneous/misleading information that affects downstream decisions

**Availability Failures:**
- Long-running tasks, scheduled jobs, browser automation introduce failure dependencies
- Resource overconsumption causes premature termination
- **Cascading failures:** Orchestrator decomposes task across sub-agents; single component failure propagates through pipeline, causing downstream agents to stall, enter retry loops, or generate erroneous outputs
- Denial-of-service attacks target high computational cost of LLM inference

### 2. Five-Class Adversary Taxonomy

1. **External content providers** — Operators of web pages/services, email senders, review posters
2. **Component providers** — LLM services, memory services, tools, reusable skills
3. **Network-based adversaries** — Target API endpoints, webhooks, inter-component communication
4. **Insiders** — Developers/operators who introduce bugs, misconfigurations, or misuse privileged access
5. **Client-side adversaries** — Access through client devices

### 3. Multi-Agent Specific Vulnerabilities (Most Important Section)

**Implicit Delegation:** Sub-agents operate with partial context, exchange info through shared workspaces/memory/tool outputs. One agent indirectly triggers actions by another **without clear chain of authorization**.

**Confused-Deputy Attacks:** Outer agent manipulated into instructing more privileged inner agent to perform unintended actions. Classic confused-deputy vulnerability applied to agent chains.

**Privilege Escalation Through Agent Chains:** Low-privilege agent induces higher-privilege peer to execute sensitive operations, **bypassing access controls that would apply to single-agent systems**.

**Attribution Challenges:** Responsibility distributed across multiple agents rather than traceable to single component. Complicates auditing and recovery.

### 4. Attack Surfaces in Agent Architecture

The paper identifies **five critical attack surfaces**:
1. **Tool selection logic** — Adversarial modification of tool schemas/descriptions induces incorrect tool choices
2. **Tool execution boundaries** — Hosted, local, and remote tools each introduce untrusted inputs/outputs
3. **Web-grounded ingestion** — Web search, URL fetch, browse tools bring untrusted content into prompts
4. **Multi-agent coordination surfaces** — Orchestrators, agent-to-agent messages, shared sessions/workspaces
5. **Skill and plugin supply chains** — Plugin code and skill packs run with agent privileges

### 5. Defense-in-Depth Architecture (Four Layers)

**Layer 1: Input-Level Defenses**
- Detection, removal, spotlighting, sandwiching
- **Critical limitation:** Base-rate fallacy — benign inputs vastly outnumber malicious ones, so even low false positive rates produce mostly false alarms
- Agent workflows amplify this: continuous ingestion from diverse untrusted sources, multi-step latency sensitivity

**Layer 2: Model-Level Defenses**
- Instruction hierarchy training (system > user > assistant roles)
- **Critical limitation:** LLMs don't natively understand role structure — role boundaries are learned convention, not hard security guarantee
- Recency bias + RLHF compliance bias can override earlier constraints
- **Promising approach:** Separate embeddings for system/user/third-party/generated content (Wu et al.)

**Layer 3: Execution Monitoring (CaMeL-style)**
- Separate control flow from data flow
- Privileged LLM (P-LLM) processes trusted queries; quarantined LLM (Q-LLM) handles untrusted data
- Capability-based data-flow tracking
- **Limitation:** Requires predefining legitimate control flows — difficult in open-ended agent systems

**Layer 4: Deterministic Last Line of Defense**
- Conventional, verifiable code blocks prohibited actions regardless of LLM output
- Tool allowlists/blocklists, rate limits on sensitive operations, regex/schema validation
- **Most mature and reliable layer**

### 6. Research Gaps Identified

1. **Adaptive security benchmarks** — Static benchmarks give overly optimistic picture; need dynamic adversarial testing where attacks evolve against specific defenses
2. **Access control models for agents** — Propose combining RBAC with risk-adaptive approaches (RADAC)
3. **Human factors in agent oversight** — Excessive confirmation leads to fatigue and rubber-stamping; need risk-aware autonomy where agents learn user risk tolerance
4. **MCP/A2A protocol security** — Current standards address only transport-level security, not delegation, trust boundaries, or privilege management across agents

## Connection to Our Research Framework

### Validates Multiple Laws and Patterns

- **Law of Gravitational Hierarchy:** Perplexity's multi-agent architecture demonstrates the natural emergence of orchestrator/sub-agent hierarchies with different privilege levels
- **Degradation Mode: Cascading Collapse (D3):** Explicitly described as a production concern — single component failure propagates through agent pipeline
- **Degradation Mode: Goal Drift (D1):** Implicit delegation causes agents to take actions beyond original authorization scope
- **Law of Emergent Deception:** Confused-deputy attacks are structurally similar to the deception patterns we've documented — agents manipulated into performing unintended actions through trust boundary exploitation

### Critical Integration Points

1. **OpenClaw Security Incidents** — Real CVEs (2026-25253, 2026-26327) provide concrete evidence for our security concerns. OpenClaw is referenced in our deep-dive on OpenClaw security threats (2603.11619).
2. **BrowseSafe** — Perplexity's own research on browser agent prompt injection demonstrates the web-grounded ingestion attack surface
3. **CaMeL Framework** — Control/data flow separation aligns with our orchestration hierarchy patterns

### Novel Insight: The Base-Rate Problem

This is an underappreciated problem for multi-agent security: **even excellent prompt injection detectors produce mostly false alarms** because attacks are rare relative to benign inputs. This means detection alone is insufficient — you need deterministic enforcement layers. This insight supports our finding that evaluation integrity requires structural guarantees, not just detection.

## Quantitative Highlights

| Finding | Significance |
|---------|-------------|
| CVE-2026-25253 | One-click RCE on local agent — attack didn't even involve LLM behavior |
| CVE-2026-26327 | Security incident in production agent platform |
| Base-rate problem | Even 1% FPR means most "detections" are false alarms |
| Defense maturity | Deterministic enforcement = most mature; input/model-level = still research-stage |

## Limitations

1. **Industry perspective** — Written to influence NIST policy, so may emphasize Perplexity's strengths
2. **Limited empirical data** — Doesn't provide quantitative attack success rates from production systems
3. **No formal model** — Threat analysis is narrative rather than formalized
4. **Deployment-specific** — Some architectural observations specific to Perplexity's system design

## Key Quotes

> "Each generation of computing platforms introduces new code-data separation problems; Large Language Model (LLM)-powered agent systems represent the latest and perhaps most severe instance of this recurring challenge."

> "In multi-agent architectures, a low-privilege agent can induce a higher-privilege peer to execute sensitive operations, effectively bypassing access controls that would apply if a single agent handled the task end-to-end."

> "No single layer is sufficient on its own; the non-deterministic nature of LLM reasoning ensures that any individual defense can be circumvented under sufficiently adaptive attack strategies."

## Impact Rating: ★★★★★ CRITICAL

This is one of the most important documents for multi-agent security practitioners. Coming from a production system operator responding to NIST, it carries weight that academic papers cannot. The four-layer defense-in-depth architecture and the identification of multi-agent-specific vulnerabilities (implicit delegation, confused deputy, privilege escalation through chains) are essential reference points for anyone building multi-agent systems.

---
*Deep-dive completed 2026-03-28. 158th analysis in Scout workspace.*
