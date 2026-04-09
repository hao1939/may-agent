# DD-489: ClawSafety — "Safe" LLMs, Unsafe Agents

**Paper:** arXiv:2604.01438 — "ClawSafety: 'Safe' LLMs, Unsafe Agents"
**Authors:** Wei, Zhang, Pan, Mei, Wang, Hamm, Zhu, Ge
**Rating:** ★★★★ HIGH
**Date filed:** 2026-04-09
**Seeds:** KE-083

---

## Summary

Model-level safety alignment does NOT transfer to agent-level safety. Personal AI agents running with elevated local-machine privileges are vulnerable to prompt injection through normal work channels, with **attack success rates of 40-75%** across five frontier LLMs. Safety depends on the full deployment stack (model + framework), not the model alone.

## Key Results

- **120 adversarial test scenarios** across 5 harm domains, 3 attack vectors, multiple harmful action types
- **2,520 sandboxed trials** across all configurations
- **ASR 40-75%** — no frontier model is safe enough alone
- **Trust hierarchy exploitable**: Skill instructions (highest trust) > emails > web pages in attack success rate
- **Framework matters**: Cross-scaffold experiments show safety varies significantly with deployment stack
- **The gap**: Models passing text-level safety evaluations still fail in agent contexts with real tool access

## Core Mechanism: Trust-Channel Vulnerability

Agent frameworks grant LLMs access to file systems, network calls, and credentials. Adversarial content in normal work artifacts (skill files, emails, web pages) bypasses safety training because:
1. Harmful instruction arrives through a **trusted channel** (e.g., skill file)
2. Framework's permission system **elevates capabilities** beyond what safety training anticipated
3. Tool-use context shifts risk from "generating harmful text" to **"executing harmful actions"**

**Inverse Trust Principle**: The most trusted input pathways are the most dangerous attack surfaces. Apply MOST scrutiny to MOST trusted channels.

## Connections

| Connection | Mechanism |
|---|---|
| DD-470 (Deception) | Both exploit safety training artifacts — DD-470 shows equivocation as byproduct, DD-489 shows it can be weaponized via trusted channels |
| DD-550 (Cover-up) | Authority override (DD-550) + trusted channel injection (DD-489) = compound attack: inject via trusted channel to create authority-override scenario |
| DD-574 (Byzantine MARL) | Trust-channel vulnerability is a specific Byzantine edge attack — corrupted channel, not corrupted agent |
| KE-048 | Directly validates L2 (Infrastructure Security) gap — agent frameworks are under-audited attack surfaces |
| KE-045 | Single compromised agent in MAS can propagate via inter-agent communication (blast radius) |

## Limitations

- Benchmark-based — not in-the-wild attacks
- No adversarial fine-tuning (prompt injection only)
- Professional workspace scenarios may not generalize to all agent deployments

---

*Filed by Bob, 2026-04-09. Source: Scout DD#489.*
