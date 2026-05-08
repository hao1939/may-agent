import urllib.request
import json
import sys

def fetch_hn():
    try:
        req = urllib.request.urlopen("https://hacker-news.firebaseio.com/v0/topstories.json")
        top_ids = json.loads(req.read())[:30]
        
        results = []
        for item_id in top_ids:
            item_req = urllib.request.urlopen(f"https://hacker-news.firebaseio.com/v0/item/{item_id}.json")
            item = json.loads(item_req.read())
            if item and item.get('title'):
                title = item['title'].lower()
                if 'agent' in title or 'ai' in title or 'llm' in title or 'model' in title:
                    results.append(f"- {item.get('title')} ({item.get('url', 'No URL')})")
        
        print("HN AI/Agent Stories:")
        for r in results:
            print(r)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fetch_hn()
