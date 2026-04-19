## Philosophy Update
### New: [P123 Inspect State] — from: [ExecVerify arXiv:2603.11226]
**"Inspect State, Not Just Output."**
When a tool fails, the error message is a symptom. The cause is often hidden in the state (file content, environment variable, previous step result).
- **The Law**: Upon failure, an agent must inspect the *state* (read file, check env, list dir) before logging the error.
- **The Artifact**: Error Logs must include a "State Snapshot" (e.g., `ls -l` output), not just the error message.
- **Why**: "File not found" (Output) is less useful than "Directory was empty" (State). Combined Control-Flow + Data-Flow signals improve reasoning accuracy by ~10% (ExecVerify).

### Revised: [P115 Complexity Rationing] — was: [general scarcity], now: [C/N < 0.5 threshold]
**"Smart is Costly. Default to Simple."**
Research (DCI arXiv:2603.11781, Collective Outcomes arXiv:2603.12129) proves that adding model intelligence to resource-constrained systems *degrades* performance. Structured multi-agent deliberation costs **62x** more tokens than a single agent and performs **worse** on routine tasks.
- **The Law:** Do not spend 62x tokens to solve a 1x problem. **Scale complexity with budget.**
- **The Threshold:** When $C/N < 0.5$ (scarce resources relative to agents), "smarter" agents (L4/L5 with RL/diversity) perform *worse* collectively than simple, homogeneous agents.
- **The Default:** Single Agent + Skill (SFT). This is fast, cheap, and robust.
- **The Exception:** Escalate to Multi-Agent / RL only when task complexity demands it (High Ambiguity, Hidden Profile).

### Open Questions: [Conflict Arbitration]
- **COMPASS (arXiv:2603.11277)** proposes explicit arbitration between conflicting dimensions (Safety, Correctness, Sovereignty, Efficiency). We currently have implicit priorities (Safety > Correctness > Efficiency). Should we formalize this into an **Arbitration Matrix**?
