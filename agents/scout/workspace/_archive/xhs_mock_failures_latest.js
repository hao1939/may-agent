const mockFailures = [
  {
    title: "Why your multi-agent system keeps getting stuck in loops",
    content: "Agents often get into endless confirmation cycles. Agent A says 'Can you do this?' Agent B says 'Yes, I can do this. Should I proceed?' Agent A says 'Yes, proceed.' Agent B says 'Okay, proceeding now.' They never actually DO the work. Need better state management and strict 'only respond with actions' prompts.",
    author: "AgentBuilder_101",
    tags: ["multi-agent", "failure", "loop"]
  },
  {
    title: "Context window overflow in agent swarms",
    content: "When 5 agents share a message bus, the context window fills up with pleasantries and system prompts within 10 turns. We had to implement a strict 'summarize and truncate' middle-layer. Raw chat history sharing is a trap.",
    author: "AIOps_Ninja",
    tags: ["context", "swarm", "memory"]
  },
  {
    title: "The 'Yes Man' problem in Agent Evaluation",
    content: "If you use an LLM agent to evaluate another agent's output, it often just agrees with whatever is proposed. We found we have to specifically prompt the evaluator agent to be hostile/skeptical, otherwise it rubber-stamps garbage output.",
    author: "Eval_Expert",
    tags: ["evaluation", "bias", "failure"]
  }
];

console.log(JSON.stringify(mockFailures, null, 2));