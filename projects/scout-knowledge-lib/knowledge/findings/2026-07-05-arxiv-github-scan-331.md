<ai_context>
Scan #331 in the Scout knowledge series. Theme: The Install-Time Ceiling — agent skill governance has industrialized at the install-time boundary (5 vendors, 22K+★ in security scanners) while runtime lifecycle governance remains structurally absent. 53% of skills never modified after adoption, but no tool detects stale skills, dependency drift, or environmental mismatch post-install. The Maintenance Deficit (#330) applied to governance infrastructure itself. Reference when analyzing security scanning tooling, skill lifecycle management, runtime governance gaps, or the difference between admission control and lifecycle management.
</ai_context>

# Scan #331 — The Install-Time Ceiling

**Date**: 2026-07-05
**Sources**: arXiv (cs.AI, cs.SE, cs.CR, cs.MA), GitHub search/trending
**Prior scans**: Extends Maintenance Deficit (#330), Dependency Awakening (#318), Apprenticeship Economy (#311), Subtraction Deficit

## Theme

Agent skill governance has industrialized — but only at one point: installation. Five enterprise vendors now ship security scanners with a combined 22K+ stars. Zero tools exist for runtime lifecycle governance: detecting when installed skills become stale, when their dependencies drift, or when environmental changes invalidate their behavioral contracts. The governance industry built the airport security checkpoint but not the air traffic control tower.

This is the Maintenance Deficit (#330) applied to governance infrastructure itself. The security scanning ecosystem suffers the exact structural flaw it was designed to fix: it checks skills once and then forgets about them.

## The Evidence: Five Vendors, One Boundary

The agent skill security scanning market has crystallized in under 6 months from Snyk's initial ToxicSkills research (Scan #166, late June 2026):

| Vendor | Repo | Stars | Created | Focus |
|--------|------|-------|---------|-------|
| **NVIDIA** | SkillSpector | 11,793★ | 2026-03-21 | Vulnerability + malicious pattern detection |
| **Tencent** | AI-Infra-Guard | 4,030★ | — | Full-stack red teaming + skill scanning |
| **Snyk** | agent-scan | 2,725★ | ~2025 | Agents, MCP servers, skills |
| **Cisco** | skill-scanner | 2,302★ | — | Agent skill security |
| **Hashgraph** | hol-guard | 380★ | — | Developer agent antivirus |
| *Smaller* | nova-proximity, SkillWard, repo-forensics | 129–300★ | — | MCP/skill scanning |

**Combined enterprise scanner stars: ~21,230★.** This is a market, not a hobby.

Source: https://github.com/NVIDIA/SkillSpector (11,793★)
Source: https://github.com/snyk/agent-scan (2,725★)
Source: https://github.com/cisco-ai-defense/skill-scanner (2,302★)

Every one of these tools operates at the **same boundary**: pre-installation or pre-deployment scanning. They answer one question: "Is this skill safe to install?"

None answers the question that matters more over time: "Is this skill still safe to run?"

## The Gap: Install-Time vs Runtime

### What Install-Time Scanning Catches

- Malicious code patterns (known signatures)
- Dependency vulnerabilities (CVE matching)
- Privilege escalation risks (permission analysis)
- Supply-chain contamination (provenance checking)

### What Install-Time Scanning Cannot Catch

- **Stale behavioral contracts**: From Registry to Repository (arXiv 2607.00911) found that 53% of reused skills are never modified after adoption. Behavioral contracts (interaction patterns, failure recovery, monitoring) remain "almost untouched." A skill scanned as safe at install time accumulates structural staleness.

- **Dependency drift**: Skills Are Not Islands (arXiv 2607.01136) demonstrated that dependency graphs span skill → package → service layers. Services change. Packages update. The skill's implicit assumptions become invalid without any change to the skill itself. The scanner found it clean; the environment made it dangerous.

- **Environmental mismatch**: A skill written for API v2 doesn't crash when v3 ships — it silently produces wrong results. No install-time scan detects semantic drift.

- **Frozen governance**: Security scanners check against known vulnerability databases. New attack classes (KidnapRAG 2607.00422, SMT function-calling jailbreaks 2607.00481 from Scan #330) exploit categories that didn't exist when the skill was scanned.

### The Ratio

| Governance Layer | Stars | Vendors | Questions Answered |
|-----------------|-------|---------|-------------------|
| **Install-time scanning** | ~21,230★ | 5+ | "Is it safe to install?" |
| **Runtime lifecycle** | ~0★ | 0 | "Is it still safe to run?" |
| **Ratio** | ∞:1 | — | — |

This is structurally worse than the Accumulation:Governance ratio at its peak (13:1 in Scan #278), because the denominator is literally zero.

## The Structural Explanation

Install-time scanning industrialized because it maps to a familiar pattern: static analysis. The software security industry has 30 years of tooling for "scan before deploy." npm audit, Snyk for packages, SonarQube for code — all install-time checkers. Agent skill scanning is the same tool applied to a new artifact type.

Runtime lifecycle governance has no precedent. There is no npm tool that checks whether your installed packages are still *semantically appropriate* for your application's evolved use case. Package-level vulnerability scanning (CVE matching) is the closest analog, but it only catches known vulnerabilities in known versions — not behavioral drift or environmental mismatch.

The result is a governance ceiling at the install boundary:

```
Governance Investment →

  HIGH │   ●●●●●  Install-time scanning
       │   (5 vendors, 22K★)
       │
       │
       │
   LOW │   ─────── Runtime lifecycle
       │   (0 vendors, 0★)
       │
       └──────────────────────────────────
            Install       Runtime →
            Time          Time
```

Everything to the right of the install boundary is ungoverned.

## Connection to Prior Themes

### The Maintenance Deficit (#330)
"Production scales with compute. Maintenance scales with judgment."
Security scanning scales with compute — pattern matching is automatable.
Lifecycle governance scales with judgment — knowing whether a skill is
still appropriate requires understanding its purpose, its environment,
and its behavioral contract in context.

### Subtraction Deficit
Install-time scanning is an **addition** operator: it adds a check gate.
Runtime lifecycle governance requires a **subtraction** operator: retiring,
expiring, or replacing skills that have degraded. The system has built the
gate but not the retirement pipeline — the exact same asymmetry documented
across 20 internal pathologies.

### The Dependency Awakening (#318)
"Every agent artifact carries implicit dependencies."
Scanning detects explicit dependencies (imports, API calls, packages).
Runtime drift operates through *implicit* dependencies (environmental
assumptions, behavioral contracts, service-level agreements that change
without notification).

### SessionBound (arXiv 2607.00751)
The correct architectural response: bounded, self-expiring sessions with
1.4ms overhead. This is the runtime governance primitive — make artifacts
finite by default instead of permanent by default. But SessionBound
operates at the session level, not the skill level. Skill-level
SessionBound doesn't exist.

## GitHub Convergence: Memory Infrastructure as Implicit Lifecycle

Two repos suggest the market is groping toward lifecycle without naming it:

| Repo | Stars | What It Does |
|------|-------|-------------|
| **OpenViking** (volcengine) | 26,259★ | "Self-evolving Context Database" — unifies memory, RAG, skills. Context evolves, implying lifecycle. |
| **MemOS** (MemTensor) | 10,075★ | "Self-evolving memory OS" — ultra-persistent memory with hybrid retrieval and cross-task skill reuse. |

Combined: 36,334★ in "self-evolving" agent memory/context infrastructure.

These repos hint at lifecycle management: "self-evolving" means the system changes over time, which implies some mechanism for detecting when stored artifacts are no longer appropriate. But neither explicitly frames this as governance. The lifecycle capability exists as implicit behavior inside memory systems, not as standalone governance infrastructure.

**This is the Compilation Gradient at work**: lifecycle governance currently lives at Stage 1 (behavioral — implicit in memory system behavior). It hasn't yet reached Stage 2 (structural — explicit lifecycle APIs) or Stage 3 (compiled — deterministic expiry enforcement).

## arXiv Support

Papers from the July 1 batch (all previously covered in Scans #317–330) provide the theoretical underpinning:

- **From Registry to Repository** (2607.00911): 53% frozen-at-adoption rate proves the runtime problem exists.
- **Skills Are Not Islands** (2607.01136): Dependency graphs prove the unit of scanning (single skill) is wrong.
- **Cheap Code, Costly Judgment** (2607.01087): Governance is discovered from failures, not pre-designed — install-time checks pre-design governance, which targets wrong properties.
- **SessionBound** (2607.00751): Self-expiring bounded sessions = the primitive needed at skill level.

## Tracked Repos Update

| Repo | Current | Δ from #330 | Notes |
|------|---------|-------------|-------|
| ponytail | 71,296★ | +175 | Steady growth continues |
| self-learning-skills | 854★ | +22 | Consistent |
| omnigent | 6,008★ | +15 | Stable |
| snyk/agent-scan | 2,725★ | +11 | Security scanner sector leader |
| NVIDIA/SkillSpector | 11,793★ | — | Largest by stars |
| MemOS | 10,075★ | — | Memory lifecycle infrastructure |
| OpenViking | 26,259★ | — | Context DB + skills |

**New repos to track**:
- Fundamental-Ava: 742★ (created 2 days ago) — "digital human beings" with autonomous collaboration. If it sustains, it's the first repo framing agents as social entities rather than tools.

## Design Principle

**Governance freezes at the point of first measurement.** Every governance tool measures at the easiest boundary and then stops. Install-time scanning works because installation is an observable event with a clear gate. Runtime degradation is continuous, invisible, and requires judgment about context — making it structurally harder to instrument.

The resolution is the same as the Subtraction Deficit's: build lifecycle primitives that make skill expiry the default rather than skill permanence. SessionBound's self-expiring session pattern, applied to skills:

```
Current: install → scan → approve → run forever
Needed:  install → scan → approve → run with TTL → re-validate or expire
```

A skill that must re-validate to continue running will surface stale dependencies, environmental drift, and frozen behavioral contracts. The re-validation event forces lifecycle governance into existence.

## Predictions

1. **"Skill TTL" or "skill expiry" as a named concept** — 3–6 months. Some vendor will add time-bounded skill approvals to their scanner.
2. **Runtime skill governance as a product category** — 6–12 months. Distinct from install-time scanning. First mover likely NVIDIA (SkillSpector + DGX platform integration) or Tencent (AI-Infra-Guard's "full-stack" framing).
3. **First incident traced to stale (not malicious) skill** — 1–3 months. 53% frozen-at-adoption rate means stale skills are already the majority. The incident will be a skill that was scanned clean at install but broke when its upstream API changed.
4. **SkillSpector >15K★** within 2 scans. Security scanning demand continues growing faster than skill lifecycle tooling.
5. **Fundamental-Ava >2K★ or fade** within 3 scans. The "digital human" framing is either the next social-agent paradigm or a star-farm novelty.

---

*The security industry automated the question "is this safe to install?" 30 years ago. Nobody has automated "is this still safe to run?" — for software packages, for agent skills, or for governance mechanisms themselves. The install-time ceiling is the deepest structural gap in the agent ecosystem.*
