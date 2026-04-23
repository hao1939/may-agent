# Project: Investigate Session Startup Overhead

**Status**: active
**Owner**: bob

## Goal
Reduce session startup overhead from 25% to under 10%.

## Milestones
- [ ] Measure current startup overhead across 5 agents
- [ ] Identify top 3 time-wasting patterns
- [ ] Design fix for #1 pattern
- [ ] Implement and verify fix

## Iteration Log

### Iter 1 — 2026-04-17
Measured may and tech-lead. Both spend 4-6 ops reading context files. Need to measure bob, coach, optimizer.

## Current State
Iter 1 done. 3 agents remaining to measure.
