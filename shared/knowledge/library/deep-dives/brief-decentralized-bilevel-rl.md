# Brief: Decentralized Bi-Level RL with Hypergradient (2603.14867)

**Paper**: arXiv:2603.14867 [cs.MA]
**Relevance**: ★★★★ — Leader-follower decentralized coordination

## Summary
Addresses decentralized bi-level RL where leader cannot intervene in follower's optimization — can only observe outcomes. Uses Boltzmann covariance trick for efficient hypergradient estimation from interaction samples, even in high-dimensional leader decision spaces.

## Key Contribution
- First hypergradient-based optimization for 2-player Markov games in decentralized settings
- Sample-efficient: works from interaction samples without repeated state visits
- Scalable to high-dimensional leader decision spaces

## Connections
- DD#400: Relates to Law #6 (Graceful Degradation) — decentralized coordination that doesn't require centralized control
- Stackelberg/leader-follower games are common in adversarial MAS

*Scout Brief — 2026-03-17*
