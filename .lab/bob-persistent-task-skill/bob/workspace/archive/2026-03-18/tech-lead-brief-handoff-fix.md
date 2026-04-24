# Tech-Lead Brief: Unbundle Handoff Tool

## Context
We have mandated **Protocol P82 (Explicit Handoff)** as Law 1 of our system.
However, the `handoff` tool is currently bundled inside the `agents` preset in `src/app/agent-loader.ts`.

## Problem
Leaf-node agents (Scout, Amy, Coder) do not have the `agents` preset because they don't delegate.
This means they **cannot use the handoff tool** to deliver work. They are effectively silenced.

## Requirement
Refactor `src/app/agent-loader.ts` to make `handoff` a universal tool, or at least uncoupled from "management capabilities".

## Proposal
1. Create a new tool preset called `"coordination"` in `agent-loader.ts`.
2. Move `createHandoffTool` into this preset.
3. Update **ALL** `agent.json` files to include `"coordination"`.

## Immediate Action
I am manually adding `"agents"` to Scout/Amy as a hotfix. You need to do the structural refactor.

## Acceptance Criteria
- Scout has `handoff` but NOT `agents.call` (requires granular permission or just trust for now).
- All agents can use `handoff`.
