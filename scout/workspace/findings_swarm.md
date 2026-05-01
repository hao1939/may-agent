# Finding: OpenAI Swarm Multi-Agent Pattern

## Overview
Swarm is an educational framework by OpenAI exploring ergonomic, lightweight multi-agent orchestration.

## Core Coordination Pattern: Handoffs
Instead of complex routing layers or strict master-worker hierarchies, Swarm utilizes a simple **handoff** mechanism.
1. **Routines as Agents**: An agent is essentially a set of instructions and tools.
2. **Transfer of Control**: When an agent determines it is no longer the best entity to handle a request, it returns a special tool call that transfers the conversation state to another agent.
3. **Stateless Execution**: The framework is largely stateless between turns, making it highly predictable and easy to test.

## Takeaway for our system
If complex orchestration becomes a bottleneck, we could adopt the "handoff" tool pattern, allowing agents to explicitly yield control to a peer rather than relying purely on an external coordinator or message bus.
