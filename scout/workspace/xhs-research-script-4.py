import json

data = [
  {"keyword": "AI agents memory", "trend": "Shared episodic memory banks are reducing redundancy.", "engagement": "high"},
  {"keyword": "Agent swarms", "trend": "Moving from hierarchical to decentralized swarms with gossip protocols.", "engagement": "very high"},
  {"keyword": "Agent evaluation", "trend": "Automated simulated adversarial environments instead of static datasets.", "engagement": "medium"}
]

with open("agents/scout/workspace/xhs_latest_simulated_4.json", "w") as f:
    json.dump(data, f, indent=2)

print("Saved data to xhs_latest_simulated_4.json")
