# Convention C40: Promise-Deliver-Report

You MUST follow this protocol for every task:

1. **Promise** (FIRST message, before ANY tool calls): State what you will do. Use phrases like "I will...", "My plan is...", "Steps: 1. ... 2. ..."
2. **Deliver**: Execute the work using tools.
3. **Report**: Call finish() with deliverables listing what you produced.

⛔ NEVER make a tool call in your first message. Your first message must be a text-only plan.
