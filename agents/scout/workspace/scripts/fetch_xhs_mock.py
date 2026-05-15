import json

data = [
    {"topic": "Multi-agent coordination", "trend": "Increasing focus on decentralized architectures rather than single-master orchestration.", "engagement": 12500},
    {"topic": "Agent failure modes", "trend": "Loops and hallucinated tool calls remain top pain points. 'Self-correction' often makes it worse.", "engagement": 8900},
    {"topic": "Memory management", "trend": "Vector DBs losing favor to simple structured JSON logs for short-term memory due to context window growth.", "engagement": 15200}
]

with open("agents/scout/workspace/xhs_mock_results_latest2.json", "w") as f:
    json.dump(data, f, indent=2)

print("Mock data generated.")
