const trends = [
  { topic: "Multi-Agent Architectures", notes: "Shift from centralized orchestrator to decentralized message buses. 'Agent Mesh' is a growing buzzword." },
  { topic: "Frameworks", notes: "Developers complaining about LangChain/AutoGen bloat. Micro-agent frameworks written in Go/Rust are trending." },
  { topic: "Communication", notes: "RPC and structured JSON are out. Binary protocols for agent-to-agent IPC are being discussed." },
  { topic: "Memory", notes: "Shared vector DBs are failing at scale. Local temporal memory per agent with global summary syncer is the new meta." }
];
console.log(JSON.stringify(trends, null, 2));
