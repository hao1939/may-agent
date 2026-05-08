import urllib.request
import xml.etree.ElementTree as ET

url = 'http://export.arxiv.org/api/query?search_query=all:multi-agent+AND+all:LLM&start=0&max_results=3&sortBy=submittedDate&sortOrder=desc'
try:
    response = urllib.request.urlopen(url)
    xml_data = response.read()
    root = ET.fromstring(xml_data)
    
    print("Recent arXiv papers on Multi-Agent LLMs:")
    for entry in root.findall('{http://www.w3.org/2005/Atom}entry'):
        title = entry.find('{http://www.w3.org/2005/Atom}title').text
        summary = entry.find('{http://www.w3.org/2005/Atom}summary').text
        print(f"Title: {title.strip()}")
        print(f"Summary: {summary.strip()[:200]}...\n")
except Exception as e:
    print(f"Error: {e}")
