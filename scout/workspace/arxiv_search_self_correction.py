import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import sys
import json

def search_arxiv(query, max_results=5):
    encoded_query = urllib.parse.quote(query)
    url = f'http://export.arxiv.org/api/query?search_query=all:{encoded_query}&start=0&max_results={max_results}&sortBy=submittedDate&sortOrder=descending'
    
    try:
        response = urllib.request.urlopen(url)
        xml_data = response.read()
        root = ET.fromstring(xml_data)
        
        namespace = {'atom': 'http://www.w3.org/2005/Atom'}
        entries = root.findall('atom:entry', namespace)
        
        results = []
        for entry in entries:
            title = entry.find('atom:title', namespace).text.strip().replace('\n', ' ')
            summary = entry.find('atom:summary', namespace).text.strip().replace('\n', ' ')
            published = entry.find('atom:published', namespace).text
            link = entry.find('atom:id', namespace).text
            
            results.append({
                'title': title,
                'summary': summary,
                'published': published,
                'link': link
            })
            
        print(json.dumps(results, indent=2))
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)

search_arxiv("LLM AND self-correction AND reflection", 10)
