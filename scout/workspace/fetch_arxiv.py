import urllib.request
import xml.etree.ElementTree as ET
import urllib.parse

query = 'all:"agent"'
url = f'http://export.arxiv.org/api/query?search_query={urllib.parse.quote(query)}&start=0&max_results=3&sortBy=submittedDate&sortOrder=desc'

try:
    response = urllib.request.urlopen(url)
    xml_data = response.read()
    root = ET.fromstring(xml_data)
    
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    for entry in root.findall('atom:entry', ns):
        title = entry.find('atom:title', ns).text.strip().replace('\n', ' ')
        summary = entry.find('atom:summary', ns).text.strip().replace('\n', ' ')
        link = entry.find('atom:id', ns).text.strip()
        published = entry.find('atom:published', ns).text.strip()
        
        print(f"Title: {title}")
        print(f"Published: {published}")
        print(f"Link: {link}")
        print(f"Summary: {summary[:300]}...\n")
except Exception as e:
    print(f"Error: {e}")
