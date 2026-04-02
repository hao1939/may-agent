# DD#328 Enhanced: LM Teams as Distributed Systems — Full Paper Deep-Read

**Paper:** arXiv:2603.12229
**Authors:** Elizabeth Mieczkowski, Katherine M. Collins, Ilia Sucholutsky, Natalia Vélez, Thomas L. Griffiths — Princeton, MIT, Cambridge, NYU
**Date read in full:** 2026-03-16
**Prior coverage:** DD#328 (abstract-level), CR#161 (coordination stack)

---

## New Findings from Full Paper Read

### 1. Real Experiments with Frontier Models
The paper uses **actual experiments** (not just theory) with Claude-Sonnet-4-6, Gemini-3-Flash, and GPT-5.2 on collaborative coding tasks. This is one of very few papers with cross-model team evaluation.

### 2. Amdahl's Law Validated Empirically for LLM Teams
- Speedup = 1 / ((1-p) + p/s) where p = parallelizable fraction
- **Highly parallel tasks** (p=0.9): Teams showed real speedup approaching Amdahl bound
- **Serial tasks** (p=0.2): Almost no speedup regardless of team size
- Claude Sonnet 4.6 matched the Amdahl bound (p=0.45); GPT-5.2 and Gemini underperformed
- Kruskal-Wallis H=61.4, p<0.001 confirming parallelizability matters

### 3. Decentralization Tax Quantified
- **Preassigned (centralized)**: Median speedup 1.36×
- **Decentralized (self-coordinating)**: Median speedup 0.88×
- Mann–Whitney U=155,523, p<0.001
- **Decentralization often makes things WORSE** — negative speedup on most non-parallel tasks

### 4. Three Types of Consistency Violations
When agents self-coordinate:
1. **Concurrent writes** — two agents edit same file simultaneously, silently overwriting
2. **Rewrites** — agent completely overwrites teammate's prior file
3. **Temporal consistency violations** — implementing task before its dependency exists
- Decentralized: median 19 test failures vs preassigned: median 4 (p<0.001)

### 5. Communication Overhead Scales Polynomially
- Decentralized teams exchange significantly more messages (p<0.001)
- Message count increases with team size (r=0.483, p<0.001)
- Idle rounds increase — agents communicating but not progressing
- **Agents sometimes "cheer each other on"** rather than doing work (see paper appendix!)

### 6. Token Cost vs Speedup Tradeoff (Critical Table)
Most striking finding from Table 1:

| Model | Task | N=5 Preassigned Speedup/Token | N=5 Decentral Speedup/Token |
|-------|------|------|------|
| Claude | Parallel | 3.35× / 1.33× | 0.83× / 4.65× |
| Claude | Serial | 0.79× / 5.76× | 0.65× / 6.24× |
| Gemini | Parallel | 1.14× / 7.53× | 0.84× / 4.20× |
| GPT-5.2 | Parallel | 1.36× / 2.48× | 1.09× / 2.80× |

**Key insight**: Claude Sonnet 4.6 is the only model that achieves cost-efficient parallelism (3.35× speedup for only 1.33× token increase). Other models show token costs far exceeding speedup.

### 7. Straggler Mitigation — Decentralization's One Advantage
- Preassigned teams: median straggler gap 2.64s
- Decentralized teams: median straggler gap 1.42s
- Decentralized teams can dynamically reassign when agents stall
- This advantage matters most for serial/mixed tasks with dependency chains

### 8. The "Cheering" Finding
The paper notes agents sometimes "cheer each other on" — using tokens and messages without task progress. This is a form of **sycophantic coordination overhead** unique to LLM teams.

---

## What Our DD#328 Missed

1. **Specific model comparison data** — Claude dramatically outperforms others in team efficiency
2. **The cost-efficiency paradox** — most team configurations cost MORE per unit speedup
3. **The 0.88× median** — decentralized teams are often SLOWER than a single agent
4. **The cheering behavior** — sycophantic coordination as resource waste
5. **Three specific consistency violation types** with empirical frequencies
6. **Amdahl's Law quantitative fit** — not just analogy, but measured correspondence

## Synthesis Opportunities

This paper's empirical findings connect to:
- **CR#170 (Compute Allocation Stack)** — adds L6: Team-Level coordination cost
- **CR#143 (Coordination Paradigm Spectrum)** — provides the empirical evidence the spectrum lacked
- **DD#329 (DCI)** — 62× token overhead maps to decentralized overhead here
- **DD#283 (AdaptOrch)** — validates topology > model selection: Claude teams with good topology > any model with bad topology
- **CR#169 (Domain-Dependent Ceiling)** — task parallelizability is another ceiling axis

### Novel Synthesis Angle: "The Coordination Tax"
Across the entire corpus, we keep finding that coordination has a COST that often exceeds its BENEFIT:
- DD#328: Decentralized teams 0.88× speedup, 4.65× tokens
- DD#329 (DCI): 62× token overhead
- DD#336 (DataFactory): NL consultation adds latency but improves quality
- DD#335 (EduClaw): Tool saturation at 7-8 (more tools = more coordination overhead)
- DD#283 (AdaptOrch): Var_τ / Var_M ≥ Ω(1/ε²) — topology cost grows quadratically

**Key law: "Coordination cost grows faster than coordination benefit"** — a general principle?
