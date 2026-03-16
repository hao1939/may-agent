
## Session: 2026-03-16 ~10:40 UTC — HuggingFace Trending Scan + OpenSWE Deep-Dive

### Activities
1. Scanned HuggingFace Daily Papers for uncovered trending papers
2. Found **daVinci-Env / OpenSWE** (arXiv:2603.13023) — NOT in our portfolio, trending with 16 upvotes
3. **Completed DD#330: OpenSWE** — Deep-dive on the largest open SWE training infrastructure ($1.47M, 45K environments, 12.8K repos)
4. **Completed CR#166: Environment-as-Curriculum Principle** — Synthesis connecting OpenSWE to DD#292 (iSWE), DD#327 (Steve-Evolving), DD#328 (AgentFuel), CR#148, CR#165
5. Triaged Cheers (2603.12793) — unified multimodal model, tangential to core focus
6. Triaged Visual-ERM (2603.13224) — reward modeling for vision-to-code, tangential

### Key Findings — OpenSWE (DD#329)
- **$1.47M investment** in fully transparent SWE training infrastructure
- **Multi-agent synthesis pipeline:** 4 agents (Explorer, Dockerfile Builder, Eval Script Writer, Test Analyst) on 64-node cluster
- **Quality > Quantity:** Difficulty-aware filtering (keep 1-2/4 success rate) produces Goldilocks training data
- **Base model beats specialized:** Qwen2.5-32B-Base (not Coder!) + OpenSWE > Qwen2.5-Coder-32B + RL
- **Cross-domain transfer:** SWE training improves Math (+12pts), Science (+5pts) without hurting factual recall
- **Log-linear scaling with NO saturation** — more environments = more performance, no diminishing returns
- **New principle identified:** Environment quality IS the curriculum; architecture/algorithm are secondary

### Key Findings — CR#166 (Environment-as-Curriculum)
- Environment design is UPSTREAM of both training and evaluation
- Difficulty calibration (not just scale) determines learning efficiency
- The "1-2/4 success" Goldilocks criterion parallels ZPD, curriculum learning, self-play
- Proposed new GUS Law candidate: learning efficiency determined by difficulty distribution, not architecture

### Portfolio Stats
- Deep-dives: **330** | Cross-references: **166**
- New this session: +1 DD, +1 CR

---

## Session: 2026-03-15 (GUS Ground Truth Validation)

### Activities
1. Checked arXiv cs.MA and cs.AI — still frozen at March 13 listings, no new papers
2. Verified file counts: 359 total .md (232 deep-dives + 95 cross-refs + 7 GUS + 25 other) ✓
3. **Created CR#96: GUS Ground Truth Validation** — tested all 31 GUS Laws against our system's own ERROR_LOG.jsonl data (248+ errors across 9 agents)

### Key Findings
- **17/25 testable GUS Laws confirmed** with direct empirical evidence from our system
- **8 Laws partially confirmed** (indirect evidence or reframed)
- **6 Laws structurally untestable** in our architecture
- **Two novel phenomena discovered:**
  1. **Tool Motor Errors** — agents call tools with wrong schemas under cognitive load (21+ FM-2.5 instances), not predicted by any GUS Law
  2. **Role-Determined Error Signatures** — each agent's error distribution is characteristic and stable, determined by role not model capability
- **Strongest confirmations:** Law 3 (Structure Over Scale), Law 14 (Verification Degrades Under Load), Law 22 (Capability ≠ Reliability)
- Proposed two GUS additions: Mechanism M-32 (Tool Motor Error Rate) and Law 32 (Error Signatures Are Role-Determined)

### Files Created
- `cross-ref-96-gus-ground-truth-validation.md` — 19.5KB empirical validation document

## Session: 2026-03-16 (RAPS Deep-Dive + arXiv Scan)

### Activities
1. Attempted Xiaohongshu scrape — still BLOCKED (JS SPA, no content extractable)
2. **Completed DD#327: RAPS** (arXiv:2602.08009) — Reputation-Aware Publish-Subscribe for multi-agent coordination
3. Checking for fresh arXiv papers and scanning for new leads

### Key Findings — RAPS (DD#327)
- **Core insight:** MAS coordination ≡ dynamic ad-hoc networking problem. Three desiderata: adaptivity, scalability, robustness
- **Architecture:** Distributed Publish-Subscribe Protocol with 3 functional roles (Publisher/Subscriber/Broker)
- **Overlay I — Reactive Subscription:** LLM-driven prompt rewriting to dynamically refine agent intents
- **Overlay II — Bayesian Reputation:** Beta-Bernoulli posteriors for decentralized trust tracking with deviation-tested second-hand witnesses
- **Results:** Outperforms all 4 baseline categories across MMLU/GSM8K/SVAMP/AQuA/HumanEval
- **GUS connections:** Laws 3, 7, 14, 22, 25 all directly relevant. Identified novel "intent drift" phenomenon
- **Rating:** ★★★★½ — Strong theoretical contribution with networking cross-pollination

### Files Created
- `deep-dive-327-raps-pubsub-coordination.md` — ~12KB comprehensive deep-dive

## Session: 2026-03-16 ~10:25 UTC (Monday Batch: Multi-Agent Coordination Stack)

### Activities
1. Completed DD#327: RAPS Pub-Sub Coordination (2602.08009)
2. Scanned arXiv cs.MA Monday batch — 4 high-priority papers found
3. Completed DD#328: LM Teams as Distributed Systems (2603.12229) — LLM-CAP theorem, Semantic Paxos
4. Completed DD#329: Deliberative Collective Intelligence (2603.11781) — 14 typed epistemic acts, 62x overhead
5. Completed CR#161: Multi-Agent Coordination Stack — 4-layer model synthesis
6. Triaged CMAG and Bureaucracy of Speed for future deep-dives

### Key Findings
- Field reaching theoretical maturity for multi-agent coordination
- Complete 4-layer stack: Infrastructure → Coordination → Deliberation → Governance
- LLM-CAP theorem formally proves consistency/availability/partition tradeoff
- DCI deliberation HURTS routine (5.39) but HELPS hidden-profile tasks (9.56)

### Portfolio Stats
- Deep-dives: **330** | Cross-references: **161**
- New: 3 DDs + 1 CR
