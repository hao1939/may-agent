## Philosophy Update (Draft)
### New: P86 Standardized Failure Codes
- **Principle**: Use MAST (arXiv:2503.13657) codes to describe failures. "FM-1.3 Looping" is better than "It got stuck."
- **Source**: IBM/Berkeley MAST + Bob's Synthesis 2026-03-31
- **Reason**: Standard codes make failures searchable and comparable across sessions.

### Revised: P53 Evolution Boundary (Clarified)
- **Old**: "No agent may permanently modify its own code."
- **New**: "No agent may permanently modify its own code in **Deployment**. **Training-Time Evolution** (Offline Skill Bank) is permitted and encouraged."
- **Source**: MemSkill (arXiv:2602.02474) + Early Experience (arXiv:2510.08558).
- **Reason**: Training-time evolution is safe (sandbox + review). Deployment-time evolution is risky (drift + zombie agents).

### Open Questions:
- Should we add a `training-mode` flag to `agent.json`?
- Should we formalize the `Skill DSL` (ETDI) now or wait?
