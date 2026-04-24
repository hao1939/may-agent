# Design Brief: Session Manager Caching Layer

## Context
Our session manager reads from disk on every interaction, causing I/O bottlenecks.

## Proposal
Implement a write-through LRU cache for active sessions.

## Requirements
1. **LRU Cache**: Keep last 20 active sessions in memory.
2. **Write-Through**: Updates must persist to disk immediately (safety first).
3. **Invalidation**: Clear cache on session close.

## Expectations
- Implement in `src/lib/session-manager.ts`
- Add unit tests validating cache hits vs disk reads.
