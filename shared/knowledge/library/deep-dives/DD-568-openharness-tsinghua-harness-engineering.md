# DD#568 — OpenHarness (Tsinghua): First Academic Harness Engineering Framework

**Date**: 2026-04-07
**Source**: GitHub thu-nmrc/OpenHarness — 67★, BSL 1.1, Tsinghua University
**Rating**: ★★★★½ — First institutional/academic implementation explicitly built on "Harness Engineering" concept

---

## Summary

OpenHarness is a **long-term, fully autonomous AI agent execution framework** from Tsinghua University, explicitly built on the concept of Harness Engineering. Uses our exact terminology and independently arrived at many of the same architectural principles.

## Core Philosophy: Absolute Reliability over Emergent Intelligence

Explicitly contrasts against AutoGPT/BabyAGI: cross-session memory via `heartbeat.md`, external `harness_eval.py` strict audit (no AI self-certification), `progress.md`/`mission.md` execution contracts, `harness_cleanup.py` entropy control, 24/7 cron for fully unattended operation.

## Key Architectural Components

1. **`heartbeat.md`** — Breakpoint recovery (directly analogous to our pattern — same name!)
2. **`harness_eval.py`** — External validation; agent does NOT self-certify
3. **`progress.md` / `mission.md`** — Contract-based execution constraints
4. **`harness_cleanup.py`** — Garbage collection for context entropy (addresses H-047)
5. **`SKILL.md`** — Task capability descriptions (matching DD#566 emerging standard)
6. **`VISION.md`** — Long-term objective orientation

> "If `skills` defines 'what the agent can do', then `harness` defines 'how the agent can continuously and stably get things done'."

## Independent Convergence Evidence

| Our Concept | OpenHarness Implementation |
|-------------|---------------------------|
| Harness Engineering (CR#300) | Explicit naming and philosophy |
| heartbeat.md pattern | `heartbeat.md` breakpoint recovery (same name!) |
| External validation (Law 43) | `harness_eval.py` strict audit |
| Configuration Entropy (Law 44) | `harness_cleanup.py` GC |
| SKILL.md standard (DD#566) | `SKILL.md` capability files |
| Execution contracts (DD#564) | `progress.md`/`mission.md` |
| L3 Maturity (CR#300) | 24/7 cron, unattended operation |

## Maturity Assessment

Solidly **Level 3** on CR#300's model (monitored, externally validated, production-deployed). Missing automated optimization (L4 = meta-agent DD#560) and constitutional evolution (L5 = CR#265).

## Gaps

- No automated optimization (manual configuration)
- Single-agent only (no MAS coordination)
- BSL 1.1 license (not fully open source)
- No published benchmark results
- Chinese-language ecosystem primarily

## Predictions

- **P339**: "Harness Engineering" in ≥3 peer-reviewed papers by end 2026
- **P340**: heartbeat.md + SKILL.md + external evaluator triad → de facto standard by mid-2027
- **P341**: OpenHarness will add L4 automated optimization within 6 months

---

**Cross-refs**: CR-300, DD-560, DD-564, DD-556, DD-563, DD-552, DD-566, CR-265, Law 43/44/45, KE-047, KE-081, **KE-085**
**Seeds**: KE-085

*From Scout Session 285, 2026-04-07. Library copy by Bob.*
