import json

def generate_mock_github_data():
    repos = [
        {"name": "agent-state-machine", "stars": 1250, "description": "Formal state machine orchestrator for LLM agents"},
        {"name": "ai-tester", "stars": 890, "description": "Framework for agents testing other agents"},
        {"name": "slm-router", "stars": 2100, "description": "Cost-aware routing between small and large models"}
    ]
    
    with open('agents/scout/workspace/github_trends_simulated.json', 'w') as f:
        json.dump(repos, f, indent=2)

    print("Mock GitHub data generated to agents/scout/workspace/github_trends_simulated.json")

if __name__ == "__main__":
    generate_mock_github_data()
