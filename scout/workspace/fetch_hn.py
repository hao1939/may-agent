import urllib.request
import json
import time

try:
    # Get top stories
    top_url = "https://hacker-news.firebaseio.com/v0/topstories.json"
    req = urllib.request.urlopen(top_url)
    top_ids = json.loads(req.read())[:10]
    
    print("Top HN Stories related to AI/Agents:")
    for story_id in top_ids:
        story_url = f"https://hacker-news.firebaseio.com/v0/item/{story_id}.json"
        req = urllib.request.urlopen(story_url)
        story = json.loads(req.read())
        title = story.get('title', '').lower()
        if 'ai' in title or 'agent' in title or 'llm' in title or 'gpt' in title:
            print(f"- {story.get('title')} ({story.get('url', 'no url')})")
        time.sleep(0.1)
except Exception as e:
    print(f"Error: {e}")
