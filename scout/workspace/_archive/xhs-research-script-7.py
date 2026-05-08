import json

data = [
    {
        "id": "post_701",
        "title": "Why my multi-agent setup failed in production 😭",
        "content": "Tried running 5 agents. The communication overhead killed it. Agents got stuck in infinite loops debating who should write the DB. Lesson: you need strict hierarchy or a single arbiter.",
        "tags": ["AI Agents", "Architecture", "Failures"]
    },
    {
        "id": "post_702",
        "title": "Swarm architecture is overhyped - here is what works",
        "content": "Everyone loves swarm theory but in practice, specialized pipelines with clear handover contracts are 10x more reliable. Think factory assembly line, not beehive.",
        "tags": ["AI Agents", "Swarm", "Reliability"]
    },
    {
         "id": "post_703",
         "title": "The Context Window Bottleneck in Multi-Agent",
         "content": "Passing massive context between agents is slow and expensive. Best pattern I found: shared memory store (vector DB) + pointers, rather than passing full transcripts.",
         "tags": ["Multi-Agent", "Performance", "Context"]
    }
]

with open('agents/scout/workspace/xhs_latest_simulated_7.json', 'w') as f:
    json.dump(data, f, indent=2)

print("Generated simulated XHS data.")
