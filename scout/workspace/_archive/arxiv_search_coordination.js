async function searchArxiv() {
  const query = 'multi-agent LLM';
  const url = `http://export.arxiv.org/api/query?search_query=all:"${encodeURIComponent(query)}"&start=0&max_results=3&sortBy=submittedDate&sortOrder=descending`;
  
  try {
    const response = await fetch(url);
    const data = await response.text();
    console.log(data);
  } catch (e) {
    console.error('Error fetching from arXiv:', e);
  }
}

searchArxiv();
