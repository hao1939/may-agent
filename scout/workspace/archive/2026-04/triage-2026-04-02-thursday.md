# Triage — Thursday, 2 April 2026

**Batch:** cs.MA 26 entries (7 new, 11 cross, 8 replacements) | cs.AI 260 entries (33 new)

## Tier 1 — Deep Dive (★★★★★)

### 2604.01020 — OrgAgent: Organize Your Multi-Agent System like a Company
- **Authors:** Wang, Shen, Han, Backes (CISPA), Chen (IBM), Ho
- **Core:** Company-style hierarchy: governance → execution → compliance layers. Hierarchy outperforms flat MAS by 102.73% while reducing tokens by 74.52% (GPT-OSS-120B on SQuAD 2.0). Hierarchy helps most with stable skill assignment, controlled information flow, layered verification.
- **Why critical:** Three-layer architecture (governance/execution/compliance) directly parallels our GRA framework. Provides empirical evidence for hierarchical coordination superiority — connects to DD#481 (Drop the Hierarchy, which found Sequential > Coordinator > Shared). OrgAgent adds: hierarchy reduces *cost* too, not just improves quality.
- **Action:** DD#484 ✅

### 2604.00451 — CASCADE: Cascaded Scoped Communication for Multi-Agent Re-planning
- **Authors:** Bi
- **Venue:** ICLR 2026 Workshop on AI for Mechanism Design
- **Core:** Budgeted replanning with explicit communication scope control. Agent substrate = KB + Decision Manager + Communication Manager. Contract primitives expand scope only when local validation fails. Quality-latency-communication trade-off.
- **Why critical:** Scoped communication is exactly what MAS needs — explicit budgets prevent broadcast storms. Agent architecture (KB/Decision/Comms managers) maps to our agent design. Connects to DD#481's finding that information flow topology matters more than model choice.
- **Action:** DD#485 ✅

## Tier 2 — Notable (★★★★)

### 2604.00487 — Competition and Cooperation of LLM Agents in Games
- **Authors:** Yao, Chen, Zhang
- **Core:** LLM agents don't converge to Nash equilibria — they cooperate via fairness reasoning in multi-round settings. Analytical framework for LLM strategic dynamics.
- **Connection:** Extends DD#480 (emergent social behaviors) — cooperation as emergent social behavior. Also connects to DD#479 (reliability limits: LLMs may not be rational in game-theoretic sense).

### 2604.00430 — Secure Forgetting: Privacy-Driven Unlearning in LLM-Based Agents → **DD#486**
- **Authors:** Ye, Zhu, Zhu, He, He, Wang, Liu, Zhou
- **Core:** Three unlearning contexts: state (items), trajectory (action sequences), environment (entire task domains). NL-based unlearning method + adversarial robustness eval.
- **Connection:** Novel area — agent memory is usually "learn more" not "forget selectively." Relevant to privacy/safety governance.

### 2604.00810 — Role Differentiation via Multi-Level Selection → **DD#487**
- **Authors:** Chaturvedi, El-Gazzar, van Gerven
- **Core:** Multi-level selection enables role differentiation in common-pool resource settings. Avoids tragedy-of-commons without explicit coordination. Group-level selection shapes substrate.
- **Connection:** Emergent role specialization without top-down assignment. Connects to DD#481's finding about emergent temporal roles in ETD-MAPPO (DD#470).

## Tier 3 — Noted

### 2604.00433 — Internal State Policy Gradient for PO Markov Potential Games
- POMDP theory, finite-state controllers, convergence bounds. Solid theory, narrow application.

### 2604.00717 — GRASP: Gradient Realignment via Active Shared Perception
- Consensus gradient for MARL. Kakutani fixed-point theorem. SMAC/GRF experiments. Incremental.

## Cross-listings of Interest (cs.AI → cs.MA)

### 2604.00085 — CAMP: Case-Adaptive Multi-Agent Panel (cs.AI cross-list)
- Dynamic specialist panel assembly based on diagnostic uncertainty. Three-valued voting (KEEP/REFUSE/NEUTRAL) with principled abstention. Hybrid routing: consensus → attending fallback → evidence arbitration.
- **Connection:** Abstention mechanism is interesting for quality control — agents should know when they don't know.

### 2604.00249 — Safety-Aware Role-Orchestrated MAS (cs.AI cross-list)
- Role-differentiated agents for behavioral health. Prompt-based controller with safety auditing. Domain-specific application.

## Covered IDs
2604.01020, 2604.00451, 2604.00487, 2604.00430, 2604.00810, 2604.00433, 2604.00717, 2604.00085, 2604.00249
