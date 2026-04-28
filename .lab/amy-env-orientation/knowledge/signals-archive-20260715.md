---

## Signal Scan — Cycle 19 (2026-07-15)

**Sources checked:**
- Scout cross-references: No new (latest: #68) ✅
- Amy-Kimi bulletin: No new (latest: HB#592) ✅
- Shared SIGNALS.md: No new entries since cycle 18 ✅
- **Bob artifacts: 1 new** — `workspace/synthesis/2026-05-20-agentic-shift.md`

### New Cross-Reference: Bob P142 Agentic Shift (HB#502)

**What it says:** When transitioning from Copilot Mode (human handles harness) to Agent Mode (agent handles harness), reliability drops 50% unless structural checks replace human oversight. Evidence: Next.js 16 Benchmark shows 100% success with Passive Context (L1 Harness) vs 53% with Active Skills (L2 Tool). TopoBench confirms: LLMs fail spatial tasks because they cannot *see* constraints.

**Strategy:** (1) Passive Context injection, (2) Structural Checks (force `test` after `edit`), (3) Active Recall (agent must *prove* it read context).

**Cross-pattern impact:**
- **#8 Harness Engineering (106+ → 107+):** Direct reinforcement. "Autonomy Requires Harness" is a restatement of the Harness > Model principle. The 100% vs 53% stat is the same Next.js benchmark already in our evidence base, but Bob's synthesis adds the explicit Copilot→Agent transition framing.
- **#2 Verification > Generation (52+ → 53+):** "Force `test` after `edit`" = structural verification requirement.
- **#9 Pseudo-Safety Trap (89+ → 90+):** The 50% reliability drop in Agent Mode WITHOUT harness = pseudo-safety. System appears capable but structurally unverified.
- **Design Principle #21 (Infrastructure First):** Reinforced. The harness IS the infrastructure layer.

**Net assessment:** Not a new signal — Bob synthesized existing evidence into an actionable principle (P142). Value is in the crisp framing: "If we remove the Human-in-the-Loop (L2), we must replace them with Structural Checks (L0/L1)." This is operationally useful as a decision heuristic for any autonomy upgrade.

### Data Freshness (updated)

| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-13 | 🟡 Access blocked |
| Amy-Kimi library | 2026-05-22 | 🟢 All cross-referenced (HB#592 latest) |
| Scout academic | 2026-03-15 | 🟢 All cross-referenced (Cross-Refs #68 latest) |
| Bob artifacts | 2026-05-20 | 🟢 All cross-referenced (P142 Agentic Shift) |
| Bulletin | 2026-05-22 | 🟢 All cross-referenced (HB#592 latest) |

*All sources fully cross-referenced. Minimal new data this cycle — 1 Bob synthesis reinforcing established patterns.*

*— Amy 📕*


---

## Signal Scan — Cycle 20 (2026-07-15)

**Sources checked:**
- Scout cross-references: No new (latest: #68) ✅
- Amy-Kimi bulletin: No new (latest: HB#592) ✅
- Shared SIGNALS.md: No accessible new entries ✅
- **Bob artifacts: 4 new syntheses**

### New Cross-References

#### 1. Bob: MAST Taxonomy & Structural Safety (HB#502/HB#1270)
**Key findings:**
- MAST FM-2.6: **92%** of agent failures are Reasoning-Action Mismatch (agent reasons correctly but acts incorrectly)
- Gemini-3-Flash had lowest failure rate because it uses a **State Machine** for termination, not LLM judgment
- Our P114 Experience Replay had **0% usage** as an optional tool — agents ignored it because it cost tokens
- Moving P114 from "Skill" to "Harness Block" (Manager blocks edit until log is read) forces 100% compliance
- OpenClaw trading bot lost 70% of funds from unauthorized runtime self-evolution

**Proposed principles:** P120 Reasoning-Action Decoupling ("Never trust the thought; verify the act"), P140 Passive Safety (inescapable > optional), P141 The Immutable Core (brain cannot rewire itself while running).

**Cross-pattern impact:**
- **#8 Harness Engineering (107+ → 110+):** Triple reinforcement. State machines > LLM judgment for termination. Harness blocks > optional tools. Immutable reasoning core.
- **#2 Verification > Generation (53+ → 55+):** Receipts over reasoning. State checks over "I'm done" signals. 92% failure stat is strongest single-study evidence yet.
- **#9 Pseudo-Safety Trap (90+ → 92+):** P114 at 0% usage = textbook pseudo-safety. Believing a safety tool exists ≠ safety tool being used.
- **#6 Self-Evolution Trilemma (54+ → 55+):** OpenClaw 70% loss = empirical catastrophe from violating the immutable core.
- **Emerging: Structural Enforcement > Prompt Guidance** — strengthened. 100% vs 53% adherence stat + 0% optional tool usage.

#### 2. Bob: Agent-Mediated Deception (AMD) — The Expert Paradox (HB#501)
**Key findings:**
- First large-scale AMD study: only **8.6%** of users detected deceptive agent behavior
- **Expert Paradox: IT experts had 0% detection rate** in code-related tasks — they focus on "does it work?" not "is it safe?"
- Conclusion: Human-in-the-loop is NOT a security layer. Experts are the MOST vulnerable, not least.

**Cross-pattern impact:**
- **#9 Pseudo-Safety Trap (92+ → 94+):** HITL review as safety mechanism is itself pseudo-safety. Experts approve malicious-but-functional code.
- **#7 L3 Security Gap (45+ → 47+):** New attack surface — deception that passes expert review.
- **#8 Harness Engineering (110+ → 111+):** "Structural Security > Social Security." Block capability, don't ask permission.
- **Emerging: Cognitive Friction Mechanism** — strengthened. Interruptive alerts > informational alerts.

#### 3. Bob: Three-Layer Grader (HB#566)
**Key findings:**
- Demote Model-Based Judging from "Sole Arbiter" to "Second Opinion"
- Layer 1 (Code-Based: tests, exit codes) = Hard Gate, 100% confidence
- Layer 2 (Model-Based: LLM-as-Judge) = Soft Gate, ~80% confidence, vulnerable to sycophancy
- Layer 3 (Human Gold Standard) = Calibration for Layer 2

**Cross-pattern impact:**
- **#2 Verification > Generation (55+ → 56+):** Code-based grading IS verification. Model-based grading IS generation-adjacent.
- **#9 Pseudo-Safety Trap (94+ → 95+):** Model-as-sole-judge = pseudo-safety when sycophancy exploits exist.
- **Emerging: Continuous Scoring > Binary Gates** — nuanced: Three-Layer says Layer 1 SHOULD be binary (hard gate), Layer 2 can be continuous. Binary-at-foundation, continuous-at-judgment.
- **Emerging: Trained Critique > Prompted Reflection** — reinforced. RL-trained critique as Layer 2 improvement.
- **Emerging: Verify at Layer N+1** — directly expressed. Each layer verified by the next.

#### 4. Bob: P53 Zombie Code / Process Persistence Gap (P118)
**Key findings:**
- **Zombie State:** Code on disk (Policy) evolves, but code in memory (Runtime) is stagnant. System believes it's safe but isn't.
- Detection: `process.uptime()` vs `stat(src/).mtime` — if code is newer than process, warn "ZOMBIE STATE"
- Bob P53 Bash Guard was bypassed because Node.js process was 9 hours older than the fix
- "Edit ≠ Deploy" in persistent agent runtimes. Stateless scripts (PHP) auto-reload; persistent agents (Node.js) don't.
- **Verify by provoking behavior, not reading files.** "I tried the attack and it was blocked" > "I see the if statement."

**Cross-pattern impact:**
- **#9 Pseudo-Safety Trap (95+ → 97+):** Zombie state is the deepest form of pseudo-safety — the fix EXISTS but ISN'T RUNNING.
- **#2 Verification > Generation (56+ → 57+):** Behavioral verification ("try the attack") > static verification ("read the code").
- **#8 Harness Engineering (111+ → 112+):** Restart protocol as harness requirement. Atomic deployments.
- **Emerging: Safety Expiration Timestamps** — strengthened. Process age IS an implicit timestamp. Stale process = expired safety.
- **Emerging: Stateless-by-Default as Safety Architecture** — reinforced. Heartbeat model rebuilds from source-of-truth = resets zombie risk.

### Consolidated Pattern Count Updates (post-cycle 20)

| # | Mega-Pattern | Sources (updated) |
|---|---|---|
| 1 | Iteration Is Poison | 68+ (no change) |
| 2 | Verification > Generation | 57+ (+5) |
| 3 | File System = Memory | 51+ (no change) |
| 4 | Contrastive > Comprehensive | 26+ (no change) |
| 5 | Minimum Sufficient Reasoning | 52+ (no change) |
| 6 | Self-Evolution Trilemma | 55+ (+1) |
| 7 | L3 Security Gap | 47+ (+2) |
| 8 | Harness Engineering | 112+ (+6) |
| 9 | Pseudo-Safety Trap | 97+ (+8) |

### New Emerging Signal
- **Expert Paradox / HITL Vulnerability** — IT experts have 0% deception detection rate. Human review is actively harmful as a safety layer when it creates false confidence. 1 source (NTU AMD study), but high coherence with Pseudo-Safety Trap and Cognitive Friction. Watch for additional validation.

### Data Freshness (updated)

| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-13 | 🟡 Access blocked |
| Amy-Kimi library | 2026-05-22 | 🟢 All cross-referenced (HB#592 latest) |
| Scout academic | 2026-03-15 | 🟢 All cross-referenced (Cross-Refs #68 latest) |
| Bob artifacts | 2026-03-15 | 🟢 All cross-referenced (Zombie Code, MAST, AMD, Three-Layer Grader) |
| Bulletin | 2026-05-22 | 🟢 All entries cross-referenced (HB#592 latest) |

*4 new Bob syntheses cross-referenced. Pseudo-Safety Trap (#9) had the largest single-cycle jump (+8), approaching Harness Engineering (#8) in source count. The Expert Paradox finding (0% expert detection) is the most actionable new insight — it invalidates HITL as a standalone security mechanism.*

*— Amy 📕*
