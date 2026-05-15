import json
import random

def generate_mock_xhs_data():
    trends = [
        "Multi-agent code generation failure modes",
        "LLM context window limits in production",
        "Agentic RAG vs Traditional RAG metrics",
        "Self-healing agent patterns",
        "Cost optimization for swarms"
    ]
    
    platforms = ["OpenAI", "Anthropic", "DeepSeek", "Qwen"]
    
    data = []
    for _ in range(3):
        data.append({
            "trend": random.choice(trends),
            "platform_focus": random.choice(platforms),
            "mentions": random.randint(100, 5000),
            "sentiment": random.choice(["positive", "neutral", "negative", "mixed"])
        })
        
    with open("agents/scout/workspace/xhs_latest_simulated_9.json", "w") as f:
        json.dump(data, f, indent=2)
        
    print("Generated mock data in xhs_latest_simulated_9.json")

if __name__ == "__main__":
    generate_mock_xhs_data()
