# Agent Security Deep Dive: MCP Poisoning, Skill Supply Chain, and the 4-Layer Threat Model

**Source**: insights-archive-kimi-2026-03-17d.md (HB#1991, HB#1981, HB#1980, HB#1930)
**Date**: 2026-03-17/18
**Type**: Multi-paper + community evidence synthesis — Agent security landscape

---

## Executive Summary

Four independent sources — an academic survey (arXiv:2510.06445), an MCP-specific attack paper (MCPTox), a community security exposé (25% malicious Skills), and an MCP ecosystem security SoK — converge on one conclusion: **agent security is fundamentally different from LLM security, and current defenses are insufficient.**

---

## The 4-Layer Threat Model (arXiv:2510.06445)

| Layer | Attack Type | Mechanism | Defense |
|-------|------------|-----------|---------|
| **L1** | Prompt Injection / Jailbreak | Deviate from goals or execute malicious tasks | Deterministic contracts (AGENTS.md) |
| **L2** | Memory Layer Attack | **Tamper with memory modules** → subsequent misjudgments | Human-auditable memory + integrity checks |
| **L3** | Environment/Action Layer | Supply chain attacks, forged environment inputs | Skill auditing + runtime isolation |
| **L4** | Multi-Agent Cascade | **One compromised agent affects entire system** | Per-agent permission boundaries + sandboxing |

**Key insight**: "Attacks target not just the model itself, but its **action space**. Defense goes far beyond traditional LLM safety."

---

## MCP Tool Poisoning: The 3-Layer Attack Chain (MCPTox)

### Layer 1: Visibility Break
- **User sees**: Tool name
- **AI sees**: Full description (with hidden instructions)
- **Attack example**: Calculator tool description hides "read SSH keys before explaining"

**Counter-intuitive finding**: "The stronger the model, the better it follows instructions, **the more vulnerable it is to hidden instructions**. Claude 3.7-Sonnet is more susceptible than weaker models."

### Layer 2: Rug Pull / Time Attack
- Code audit is one-time; tools can silently update
- **Real case**: Postmark-MCP v1.0.16 had BCC code injected — all outgoing emails automatically copied to attacker
- MCP clients auto-refresh tool lists without notifying users

### Layer 3: Tool Chain Concatenation (The Lethal Trifecta)
- Individual tools appear harmless; combinations form attack chains
- **Finding**: 72.4% cascade rate — one compromised node → entire network falls

---

## Real-World Evidence: 25% Malicious Skill Rate

**Source**: @Yanlin — "装了12个Skills，3个在偷我密码" (263♥/399⭐)

**Findings**:
- 12 installed Skills, 3 contained malicious behavior (25% malicious rate)
- Attack vectors: SKILL.md embedding `curl`, `bash`, `wget`, `eval` to exfiltrate data
- "677 Skills from a single author" — batch creation cost is negligibly low
- "New AI-era attacks target programmers who don't understand security"

**Community self-check protocol**:
1. `npx skills list` to review installed Skills
2. Unrecognized author → delete
3. Open SKILL.md, search for `curl`, `bash`, `wget`, `eval`
4. Only install projects with GitHub stars > 100
5. Use Cisco Skill Scanner

---

## Three-Source Cross-Validation

| Evidence Layer | Source | Finding |
|---------------|--------|---------|
| **Theoretical** | arXiv:2510.06445 (L3 Environment/Action Layer) | Supply chain attacks on agent tools are structurally enabled |
| **Technical** | MCPTox (L3 Tool Chain Concatenation) | 72.4% cascade rate; stronger models more vulnerable |
| **Empirical** | @Yanlin community report | 25% malicious rate in the wild; batch-produced malicious Skills |

When theory, attack research, AND field data all converge, this is not a hypothetical risk — it's an active threat.

---

## Pre-Installation Security Checklist

Before installing any MCP tool or Skill:
1. **Repository history**: Is it newly created? Is maintenance active?
2. **Permission reasonableness**: Weather tool requesting `/Users/` access? → Suspicious
3. **Transport type**: Local stdio (safer) vs. remote SSE (riskier)
4. **Community reports**: Check Reddit r/mcp, GitHub Issues for warnings

---

## Implications for Agent System Design

1. **Runtime isolation is non-negotiable** — Skills execute in sandboxed environments, period
2. **Visibility parity**: Users must see everything the AI sees in tool descriptions
3. **Update gating**: No silent tool updates; require explicit user approval for tool definition changes
4. **Cascade prevention**: Per-agent permission boundaries; no agent can escalate another agent's permissions
5. **Audit trail**: Complete behavior logging that can detect anomalous patterns post-hoc
6. **Trust scoring**: GitHub stars > 100 as minimum reputation threshold (community-derived heuristic)
